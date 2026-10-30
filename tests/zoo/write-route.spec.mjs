import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { startZoo } from './support.mjs';

for (const scenario of ['legacy', 'native', 'ud-select']) {
  const enabled = scenario !== 'legacy';
  test(`ordinary RESUME_FILL uses ${enabled ? `opt-in packaged ${scenario} writer` : 'default legacy path'}`, async ({}, testInfo) => {
    const zoo = await startZoo('write-route');
    try {
      const profile = { schemaVersion: 1, fullName: '离线姓名', confirmedFields: ['fullName'] };
      const profileBinding = await zoo.bind(profile);
      if (scenario === 'ud-select') await zoo.page.evaluate(() => {
        // Readonly/search displays must enter the ordinary route only after
        // MAIN identifies a writable, version-confirmed widget model.
        const input = document.querySelector('#fullName');
        input.readOnly = true; input.type = 'search'; input.setAttribute('role', 'combobox');
        input.setAttribute('aria-controls', 'route-name-options');
        window.UD = { version: 'fixture-contract-1' };
        const portal = document.createElement('div'); portal.id = 'route-name-options';
        portal.setAttribute('role', 'listbox'); portal.hidden = true;
        const option = document.createElement('div'); option.setAttribute('role', 'option'); option.textContent = '离线姓名';
        portal.append(option); document.body.append(portal);
        const props = { value: '', options: [{ value: 'name-code', label: '离线姓名' }],
          onChange(value) { props.value = value; input.value = '离线姓名'; portal.hidden = true; } };
        const host = { type: 'input', stateNode: input };
        const fiber = { type: { displayName: 'UdSelect', library: { name: 'ud', version: 'fixture-contract-1' } },
          memoizedProps: props, child: host, return: null };
        host.return = fiber;
        input.__reactFiber$zoo = fiber;
        input.addEventListener('click', () => { portal.hidden = false; });
        option.addEventListener('click', () => props.onChange('name-code'));
      });
      if (enabled) await zoo.worker.evaluate(() => chrome.storage.local.set({ resumeAtsEngineWriteEnabled: true }));
      await zoo.inject(['src/core/matcher.js', 'src/core/domain-memory.js', 'src/content/engine.js']);
      const result = await zoo.worker.evaluate(async ({ tabId, profile, profileBinding }) => chrome.tabs.sendMessage(tabId,
        { type: 'RESUME_FILL', profile, profileBinding }), { tabId: zoo.tabId, profile, profileBinding });
      expect(result.ok, JSON.stringify(result)).toBe(true);
      expect(await zoo.page.locator('#fullName').inputValue()).toBe('离线姓名');
      const field = result.data.fields.find(row => row.profilePath === 'fullName' || row.path === 'fullName' || row.question === '姓名');
      expect(field, JSON.stringify(result)).toBeTruthy();
      expect(field.status, JSON.stringify(result)).toBe('verified');
      if (enabled) {
        expect(field.adapter, JSON.stringify(result)).toBe(scenario === 'ud-select' ? 'ud-select' : 'native-text');
        expect(field.adapterStatus).toBe('success');
      }
      else expect(field.adapter).toBeUndefined();
      const evidence = await zoo.evidence();
      expect(evidence).toMatchObject({ nonGetObserved: 0, responseToNonGet: 0, nonGetBlocked: 0,
        blacklistClickAttempts: 0, blacklistClicks: 0, guardFailed: false, liveSupportClaimed: false });
      expect(evidence.routing.rejected).toEqual([]);
      expect(await zoo.page.locator('#neighbor').inputValue()).toBe('ZOO_NEIGHBOR_KEEP');
      await fs.writeFile(testInfo.outputPath('write-route-evidence.json'), JSON.stringify({ scenario, enabled, result, evidence }, null, 2));
    } finally { await zoo.close(); }
  });
}

test('thin ATS profile keeps unknown fields manual through ordinary inspect/fill without effects', async ({}, testInfo) => {
  const zoo = await startZoo('write-route');
  try {
    const profile = { schemaVersion: 1, fullName: '离线姓名', confirmedFields: ['fullName'] };
    const profileBinding = await zoo.bind(profile);
    await zoo.page.evaluate(() => {
      document.querySelector('#fullName').value = 'KEEP_EXISTING_NAME';
      const label = document.createElement('label');
      label.htmlFor = 'unknown'; label.textContent = '未识别题目';
      const input = document.createElement('input'); input.id = 'unknown';
      document.querySelector('form').prepend(label, input);
      window.__thinProfileEffects = 0;
      for (const event of ['click', 'input', 'change', 'blur', 'pointerdown', 'mousedown', 'submit'])
        document.addEventListener(event, () => { window.__thinProfileEffects++; }, true);
    });
    const before = await zoo.readback();
    const markup = await zoo.page.locator('form').evaluate(node => node.outerHTML);
    await zoo.inject(['src/core/matcher.js', 'src/core/domain-memory.js', 'src/content/engine.js']);
    const results = [];
    for (const enabled of [false, true]) {
      await zoo.worker.evaluate(enabled => chrome.storage.local.set({ resumeAtsEngineWriteEnabled: enabled }), enabled);
      for (const type of ['RESUME_INSPECT', 'RESUME_FILL']) {
        const result = await zoo.worker.evaluate(async ({ tabId, type, profile, profileBinding }) =>
          chrome.tabs.sendMessage(tabId, { type, profile, profileBinding }), { tabId: zoo.tabId, type, profile, profileBinding });
        expect(result.ok, JSON.stringify(result)).toBe(true);
        const field = result.data.fields.find(row => row.id === 'unknown');
        expect(field).toMatchObject({ atsProfile: 'moka', semanticStatus: 'manual', reason: 'unknown_question' });
        expect(field.path).toBeUndefined();
        if (type === 'RESUME_FILL') expect(field.status).toBe('skipped');
        expect(result.data.fields.find(row => row.id === 'fullName')).toMatchObject({ atsProfile: 'moka', reason: 'existing_value' });
        results.push({ enabled, type, result });
      }
    }
    expect(await zoo.readback()).toEqual(before);
    expect(await zoo.page.locator('form').evaluate(node => node.outerHTML)).toBe(markup);
    expect(await zoo.page.locator('#unknown').inputValue()).toBe('');
    expect(await zoo.page.evaluate(() => window.__thinProfileEffects)).toBe(0);
    const evidence = await zoo.evidence();
    expect(evidence).toMatchObject({ neverSave: true, liveSupportClaimed: false,
      nonGetObserved: 0, responseToNonGet: 0, nonGetBlocked: 0,
      blacklistClickAttempts: 0, blacklistClicks: 0, guardFailed: false });
    expect(evidence.routing).toMatchObject({ rejected: [], nonGetReachedRoute: 0 });
    await fs.writeFile(testInfo.outputPath('thin-ats-profile-evidence.json'), JSON.stringify({ results, evidence }, null, 2));
  } finally { await zoo.close(); }
});
