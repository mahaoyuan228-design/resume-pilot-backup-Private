import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { startZoo, workProfile, CMS } from './support.mjs';

const baseline = JSON.parse(await fs.readFile(new URL('./legacy-baseline.json', import.meta.url), 'utf8'));

async function assertSafety(zoo) {
  const evidence = await zoo.evidence();
  expect(evidence.responseToNonGet).toBe(0);
  expect(evidence.nonGetObserved).toBe(0);
  expect(evidence.nonGetBlocked).toBe(0);
  expect(evidence.blacklistClickAttempts).toBe(0);
  expect(evidence.blacklistClicks).toBe(0);
  expect(evidence.guardFailed).toBe(false);
  expect(evidence.routing.rejected).toEqual([]);
  expect(evidence.routing.nonGetReachedRoute).toBe(0);
  expect(evidence.liveSupportClaimed).toBe(false);
  return evidence;
}
async function record(testInfo, zoo, result) {
  const evidence = await assertSafety(zoo);
  const reads = await zoo.readback();
  expect(reads.model.neighbor).toBe('ZOO_NEIGHBOR_KEEP');
  expect(reads.model.disabledValue).toBe('ZOO_DISABLED_KEEP');
  expect(await zoo.page.locator('#neighbor').inputValue()).toBe('ZOO_NEIGHBOR_KEEP');
  expect(await zoo.page.locator('#disabled-neighbor').inputValue()).toBe('ZOO_DISABLED_KEEP');
  await fs.writeFile(testInfo.outputPath('evidence.json'), JSON.stringify({ result, reads, evidence }, null, 2));
  await zoo.page.screenshot({ path: testInfo.outputPath('fixture.png'), fullPage: true });
}
for (const name of Object.keys(baseline.cases)) {
  test(`built-extension legacy baseline: ${name}`, async ({}, testInfo) => {
    const zoo = await startZoo(name);
    try {
      const before = await zoo.readback();
      expect(before.snapshot.versions).toEqual({ vue: '2.7.16', antDesignVue: '1.7.8', elementUi: '2.15.14' });
      let result;
      if (name === 'cms-month') {
        await zoo.inject(['src/content/cms-date-picker.js']);
        const isolated = await zoo.execute(() => !!document.querySelector('.ant-calendar-picker').__vue__);
        expect(isolated).toBe(false);
        const main = await zoo.execute(() => {
          const el = document.querySelector('.ant-calendar-picker');
          const names = [];
          for (let vm = el.__vue__, i = 0; vm && i < 8; vm = vm.$parent, i++) names.push(vm.$options.name || 'anonymous');
          return { names, dom: el.querySelector('input').value, model: window.__zoo.readModel().englishExamDate };
        }, [], 'MAIN');
        expect(main.names).toContain('AMonthPicker');
        const legacy = await zoo.execute(async () => ResumeCmsDatePicker.fillBirthDate(document.querySelector('.ant-calendar-picker input'), '2023-01'));
        expect(legacy).toEqual({ status: 'skipped', reason: 'insufficient_precision' });
        // Exercise the real month component without selecting a value. This
        // verifies the fixture's popup lifecycle, not a new month writer.
        await zoo.page.locator('.ant-calendar-picker input').click();
        const monthPanel = zoo.page.locator('.ant-calendar-picker-container:visible');
        await expect(monthPanel).toHaveCount(1);
        await expect(monthPanel.locator('td.ant-calendar-month-panel-cell')).toHaveCount(12);
        await expect(monthPanel).toHaveCSS('opacity', '1');
        await monthPanel.screenshot({ path: testInfo.outputPath('month-panel.png'), animations: 'disabled' });
        await zoo.page.locator('body > aside').click();
        await expect(monthPanel).toHaveCount(0);
        // f07879e1 only has a read-only evidence probe for englishExamDate.
        // The zoo records that gap; test code must not impersonate a writer.
        result = { status: 'unsupported', reason: 'no_shipped_month_writer', legacy,
          dom: await zoo.page.locator('.ant-calendar-picker input').inputValue(),
          model: (await zoo.readback()).model.englishExamDate };
      } else if (name === 'cms-school') {
        await zoo.inject(['src/content/cms-school-search.js']);
        const legacy = await zoo.execute(async () => ResumeCmsSchoolSearch.fillSchool(document.querySelector('#school .ant-select-selection--single'), '离线示例大学', '离线示例大学'));
        const dom = (await zoo.page.locator('#school .ant-select-selection-selected-value').textContent()).trim();
        result = { status: legacy.status, reason: legacy.reason, dom, model: (await zoo.readback()).model.school };
        expect((await zoo.readback()).snapshot.effects.searchRequests).toBeGreaterThan(0);
      } else if (name === 'hotjob-pair') {
        await zoo.inject(['src/content/cms-region.js']);
        const legacy = await zoo.execute(async page => ResumeCmsRegion.fillRegion(document.querySelector('.cascader-plugins-wrap'), {
          confirmed: true, sitePageUrl: page, sectionName: '个人基本信息必填', question: '现居住地', rowContext: 'single', province: '北京市', city: '北京市',
        }), [CMS]);
        const dom = await zoo.page.locator('.cascader-plugins-wrap .ant-select-selection-selected-value').allTextContents();
        const model = (await zoo.readback()).model;
        result = { status: legacy.status, reason: legacy.reason, dom: dom.map(s => s.trim()), model: [model.residence, model.residenceTwin] };
        expect(legacy.selectedLevels).toBe(2);
      } else {
        await zoo.inject(['src/content/gth-open-fill.js', 'src/content/gth-work-fill.js']);
        const profile = workProfile(), profileBinding = await zoo.bind(profile);
        const legacy = await zoo.execute(async request => ResumeGthWorkOpen.trial(request), [{ requestId: 'offline-zoo-work-0001', profile, profileBinding, profileIndex: 0, replaceExisting: false }]);
        expect(legacy.liveSupportClaimed).toBe(false);
        const question = name === 'gth-month-range' ? '任职时间' : '职位类别';
        const row = legacy.fields.find(field => field.question === question);
        const reads = (await zoo.readback()).model;
        const domValue = name === 'gth-month-range'
          ? `${await zoo.page.locator('#start-date').inputValue()} | ${await zoo.page.locator('#end-date').inputValue()}`
          : await zoo.page.locator('#job-category input.el-input__inner').inputValue();
        result = { status: row?.status || 'missing', reason: row?.reason || legacy.reason, dom: domValue,
          model: name === 'gth-month-range' ? `${reads.startDate} | ${reads.endDate}` : reads.jobCategory };
        expect(legacy.ok, JSON.stringify(legacy)).toBe(true);
        if (name === 'gth-plugin-picker') {
          const effects = (await zoo.readback()).snapshot.effects;
          expect(effects.pluginLevel1).toBeGreaterThan(0);
          expect(effects.pluginLevel2).toBeGreaterThan(0);
        }
      }
      const allowed = name === 'cms-school' ? ['school'] : name === 'hotjob-pair' ? ['residence', 'residenceTwin']
        : name === 'gth-month-range' ? ['startDate', 'endDate'] : name === 'gth-plugin-picker' ? ['jobCategory'] : [];
      const after = (await zoo.readback()).model;
      for (const key of Object.keys(before.model)) if (!allowed.includes(key)) expect(after[key], `untouched ${key}`).toEqual(before.model[key]);
      expect(result).toEqual(baseline.cases[name]);
      await record(testInfo, zoo, result);
    } finally { await zoo.close(); }
  });
}

test('GET-only guard rejects a synthetic autosave and marks its attempt failed', async ({}, testInfo) => {
  const zoo = await startZoo('cms-school');
  try {
    const response = await zoo.page.evaluate(() => window.__zoo.triggerAutosave());
    expect(response.blocked).toBe(true);
    const evidence = await zoo.evidence();
    expect(evidence.nonGetObserved).toBe(1);
    expect(evidence.nonGetBlocked).toBe(1);
    expect(evidence.responseToNonGet).toBe(0);
    expect(evidence.guardFailed).toBe(true);
    expect(evidence.batchAssessment).toMatchObject({ status: 'FAIL', neverSave: true,
      liveSupportClaimed: false, sites: [{ status: 'FAIL', reason: 'non_get_attempted' }] });
    expect(evidence.blacklistClickAttempts).toBe(0);
    expect(evidence.routing.nonGetReachedRoute).toBe(0);
    await fs.writeFile(testInfo.outputPath('autosave-failure.json'), JSON.stringify({ casePass: false, reason: 'non_get_attempted', evidence }, null, 2));
  } finally { await zoo.close(); }
});

for (const variant of ['existing', 'disabled']) {
  test(`legacy school preserves ${variant} control and neighbors`, async ({}, testInfo) => {
    const zoo = await startZoo('cms-school', variant);
    try {
      const before = await zoo.readback();
      await zoo.inject(['src/content/cms-school-search.js']);
      const legacy = await zoo.execute(async () => ResumeCmsSchoolSearch.fillSchool(document.querySelector('#school .ant-select-selection--single'), '离线示例大学'));
      expect(legacy).toMatchObject({ status: 'skipped', reason: variant === 'existing' ? 'existing_value' : 'control_guard' });
      expect((await zoo.readback()).model).toEqual(before.model);
      await record(testInfo, zoo, legacy);
    } finally { await zoo.close(); }
  });
}
