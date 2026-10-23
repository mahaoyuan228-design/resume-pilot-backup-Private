/**
 * Shipped skills/other fills inject the open-editor scripts and send
 * GTH_SKILLS_FILL / GTH_OTHER_FILL. The page probe stays in MAIN.
 * The legacy section globals are not the MAIN fill. They ignore caller
 * answers, including TEST placeholders, and write only confirmed profile facts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function load(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('gth-other-auto fill sends GTH_OTHER_FILL; probe stays MAIN', () => {
  const src = load('src/background/gth-other-auto.mjs');
  const dispatch = load('src/background/gth-open-fills.mjs');
  assert.match(src, /executeScript\(\{target:\{tabId\},world:'MAIN',func:probePageFunc/);
  assert.match(src, /shippedGthOtherFill/);
  assert.match(src, /function otherFillProfile/);
  assert.match(src, /liveSupportClaimed:false/);
  assert.doesNotMatch(src, /invalid_test_answer/);
  assert.match(dispatch, /GTH_OTHER_FILL/);
  assert.match(dispatch, /'src\/content\/gth-other\.js'/);
  assert.equal(/world:'MAIN',\s*\n\s*func:async\(payload\)=>typeof globalThis\.ResumeGthOtherSection/.test(src), false);
  const section = load('src/content/gth-other-section.js');
  assert.match(section, /const formsOf = sections => \[\.\.\.sections\[6\]\.querySelectorAll\('form'\)\]/);
  assert.match(section, /ResumeGthOtherSectionRevision=4/);
  assert.match(section, /missing_profile_value/);
  assert.match(section, /profile_fact_unconfirmed/);
  assert.match(section, /liveSupportClaimed: false/);
  assert.doesNotMatch(section, /invalid_test_answer/);
  assert.doesNotMatch(section, /answers\[spec\.question\]/);
});

test('gth-simple-auto fill sends GTH_SKILLS_FILL; probe stays MAIN', () => {
  const src = load('src/background/gth-simple-auto.mjs');
  const dispatch = load('src/background/gth-open-fills.mjs');
  assert.match(src, /executeScript\(\{target:\{tabId\},world:'MAIN',func:probePageFunc/);
  assert.match(src, /shippedGthSkillsFill/);
  assert.match(src, /function skillsFillProfile/);
  assert.match(src, /liveSupportClaimed:false/);
  assert.doesNotMatch(src, /invalid_test_answer/);
  assert.match(dispatch, /GTH_SKILLS_FILL/);
  assert.match(dispatch, /'src\/content\/gth-skills\.js'/);
  assert.equal(/world:'MAIN',\s*\n\s*func:async\(payload\)=>typeof globalThis\.ResumeGthSimpleSection/.test(src), false);
  const section = load('src/content/gth-simple-section.js');
  assert.match(section, /const formsOf = sections => \[\.\.\.sections\[4\]\.querySelectorAll\('form'\)\]/);
  assert.match(section, /ResumeGthSimpleSectionRevision=4/);
  assert.match(section, /missing_profile_value/);
  assert.match(section, /profile_fact_unconfirmed/);
  assert.match(section, /liveSupportClaimed: false/);
  assert.doesNotMatch(section, /invalid_test_answer/);
  assert.doesNotMatch(section, /answers\?\.\[QUESTION\]/);
});

const PAGE = 'https://hr.gtht.com/resume/edit/';
const TITLES = ['基本信息', '教育经历', '求职意向', '工作经验', '职业技能与特长', '附件简历', '其他信息'];
const binding = { version: 1, epoch: '00000000-0000-4000-8000-000000000001', profileHash: 'a'.repeat(64) };
const FORBIDDEN = new Set(['保存', '提交', '投递', '删除']);

function confirmedProfile(section, pairs) {
  return {
    customAnswers: Object.fromEntries(pairs),
    confirmedFields: pairs.map(([question]) => `customAnswers.${question}`),
    customFacts: pairs.map(([question, answer]) => ({
      question, answer, sitePageUrl: PAGE, sectionName: section, rowContext: 'none',
    })),
  };
}

function control(label, { tag = 'input', value = '' } = {}) {
  const node = tag === 'textarea'
    ? `<textarea id="field-${label}">${value}</textarea>`
    : `<input id="field-${label}" type="text" value="${value}">`;
  return `<div class="el-form-item"><label class="el-form-item__label">${label}</label><div class="el-form-item__content">${node}</div></div>`;
}

function pageHtml(sectionName, body) {
  return `<!DOCTYPE html><body>${TITLES.map((title) => {
    if (title !== sectionName) return `<section class="r-section"><div class="title_">${title}</div></section>`;
    return `<section class="r-section" id="target"><div class="title_">${title}</div>${body}</section>`;
  }).join('')}</body>`;
}

function boot(sectionFile, html) {
  const dom = new JSDOM(html, { url: PAGE, pretendToBeVisual: true });
  const { window } = dom;
  window.Element.prototype.getClientRects = () => [{ width: 8, height: 8, top: 0, left: 0, bottom: 8, right: 8 }];
  Object.defineProperty(window.document, 'readyState', { configurable: true, get: () => 'complete' });
  Object.defineProperty(window.document, 'visibilityState', { configurable: true, get: () => 'visible' });
  const clicks = [];
  const original = window.HTMLElement.prototype.click;
  window.HTMLElement.prototype.click = function clicked() {
    clicks.push(this);
    return original.call(this);
  };
  const chrome = {
    runtime: {
      sendMessage: async (message) => (
        message?.type === 'RESUME_PROFILE_BINDING_CHECK' ? { allowed: true } : { allowed: false }
      ),
    },
  };
  const context = vm.createContext({
    chrome,
    document: window.document,
    location: window.location,
    performance: window.performance,
    HTMLInputElement: window.HTMLInputElement,
    HTMLTextAreaElement: window.HTMLTextAreaElement,
    Event: window.Event,
    getComputedStyle: window.getComputedStyle.bind(window),
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
  });
  vm.runInContext(load(sectionFile), context);
  return { dom, clicks, context, chrome };
}

function assertNeverSaved(clicks) {
  const hit = clicks.filter((node) => FORBIDDEN.has(String(node.textContent || '').replace(/[\s\u00a0]+/gu, ' ').trim()));
  assert.equal(hit.length, 0);
}

test('other section ignores TEST answers and writes only a confirmed profile', async () => {
  const html = pageHtml('其他信息', `<form>${control('描述', { tag: 'textarea' })}${control('标题')}</form>`);
  const blocked = boot('src/content/gth-other-section.js', html);
  const rejected = await blocked.context.ResumeGthOtherSection.fill({
    sectionName: '其他信息',
    answers: { '描述': 'TEST', '标题': 'TEST' },
    profileBinding: binding,
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, 'missing_profile_value');
  assert.equal(rejected.writeStarted, false);
  assert.equal(rejected.liveSupportClaimed, false);
  assert.equal(rejected.complete, false);
  assert.equal(rejected.softwareClickedSave, false);
  assert.equal(blocked.dom.window.document.getElementById('field-描述').value, '');
  assert.equal(blocked.dom.window.document.getElementById('field-标题').value, '');
  assertNeverSaved(blocked.clicks);

  const unconfirmed = boot('src/content/gth-other-section.js', html);
  const held = await unconfirmed.context.ResumeGthOtherSection.fill({
    sectionName: '其他信息',
    profileBinding: binding,
    profile: {
      customAnswers: { '描述': 'TEST', '标题': 'TEST' },
      confirmedFields: ['customAnswers.描述', 'customAnswers.标题'],
    },
  });
  assert.equal(held.ok, false);
  assert.equal(held.reason, 'profile_fact_unconfirmed');
  assert.equal(held.writeStarted, false);
  assert.equal(held.liveSupportClaimed, false);
  assert.equal(unconfirmed.dom.window.document.getElementById('field-描述').value, '');
  assertNeverSaved(unconfirmed.clicks);

  const filled = boot('src/content/gth-other-section.js', html);
  const profile = confirmedProfile('其他信息', [['描述', '维护过一个小工具'], ['标题', '开源贡献']]);
  const result = await filled.context.ResumeGthOtherSection.fill({
    sectionName: '其他信息', profile, profileBinding: binding,
  });
  assert.equal(result.ok, true);
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.complete, false);
  assert.equal(result.softwareClickedSave, false);
  assert.equal(result.softwareClickedSubmit, false);
  assert.equal(result.softwareClickedDelete, false);
  assert.equal(filled.dom.window.document.getElementById('field-描述').value, '维护过一个小工具');
  assert.equal(filled.dom.window.document.getElementById('field-标题').value, '开源贡献');
  assert.deepEqual([...result.fields].map((row) => String(row.path)), ['customAnswers.描述', 'customAnswers.标题']);
  assert.equal([...result.fields].every((row) => row.reason === 'readback_matched'), true);
  assertNeverSaved(filled.clicks);
});

test('skills section ignores a TEST answer and writes the confirmed profile fact', async () => {
  const html = pageHtml('职业技能与特长', `<form>${control('职业技能与特长', { tag: 'textarea' })}</form>`);
  const blocked = boot('src/content/gth-simple-section.js', html);
  const rejected = await blocked.context.ResumeGthSimpleSection.fill({
    sectionName: '职业技能与特长',
    answers: { '职业技能与特长': 'TEST' },
    profileBinding: binding,
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, 'missing_profile_value');
  assert.equal(rejected.writeStarted, false);
  assert.equal(rejected.liveSupportClaimed, false);
  assert.equal(blocked.dom.window.document.getElementById('field-职业技能与特长').value, '');
  assertNeverSaved(blocked.clicks);

  const opened = pageHtml('职业技能与特长', '').replace(
    '<div class="title_">职业技能与特长</div>',
    '<div class="title_">职业技能与特长<a class="h-e-btn" id="edit">编辑</a></div>',
  );
  const editRun = boot('src/content/gth-simple-section.js', opened);
  const doc = editRun.dom.window.document;
  doc.getElementById('edit').addEventListener('click', () => {
    doc.getElementById('edit').remove();
    doc.getElementById('target').insertAdjacentHTML('beforeend', `<form>${control('职业技能与特长', { tag: 'textarea' })}</form>`);
  });
  const profile = confirmedProfile('职业技能与特长', [['职业技能与特长', 'Python / SQL']]);
  const result = await editRun.context.ResumeGthSimpleSection.fill({
    sectionName: '职业技能与特长', profile, profileBinding: binding,
  });
  assert.equal(result.ok, true);
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.complete, false);
  assert.equal(doc.getElementById('field-职业技能与特长').value, 'Python / SQL');
  assert.equal(String(result.fields[0].path), 'customAnswers.职业技能与特长');
  assert.equal(result.fields[0].reason, 'readback_matched');
  assert.deepEqual(editRun.clicks.map((node) => String(node.textContent).trim()), ['编辑']);
  assertNeverSaved(editRun.clicks);
});

const invalidExistingStates = [
  ['aria-invalid', node => node.setAttribute('aria-invalid', 'true')],
  ['is-error', node => node.closest('.el-form-item').classList.add('is-error')],
  ['is-validating', node => node.closest('.el-form-item').classList.add('is-validating')],
  ['visible error', node => node.insertAdjacentHTML('afterend', '<div class="el-form-item__error">字段有误</div>')],
  ['native validity', node => node.setCustomValidity('字段有误')],
];

for (const [state, invalidate] of invalidExistingStates) {
  test(`legacy skills and other same-value readback requires validation: ${state}`, async () => {
    const cases = [
      {
        section: '职业技能与特长', file: 'src/content/gth-simple-section.js', api: 'ResumeGthSimpleSection',
        pairs: [['职业技能与特长', 'Python']],
        body: control('职业技能与特长', { tag: 'textarea', value: 'Python' }),
      },
      {
        section: '其他信息', file: 'src/content/gth-other-section.js', api: 'ResumeGthOtherSection',
        pairs: [['描述', '维护过一个小工具'], ['标题', '开源贡献']],
        body: control('描述', { tag: 'textarea', value: '维护过一个小工具' }) + control('标题', { value: '开源贡献' }),
      },
    ];
    for (const fixture of cases) {
      const page = boot(fixture.file, pageHtml(fixture.section, `<form>${fixture.body}</form>`));
      try {
        const target = page.dom.window.document.getElementById(`field-${fixture.pairs[0][0]}`);
        invalidate(target);
        const result = await page.context[fixture.api].fill({
          sectionName: fixture.section, profileBinding: binding,
          profile: confirmedProfile(fixture.section, fixture.pairs),
        });
        assert.equal(result.ok, false);
        assert.equal(result.reason, 'site_validation_failed');
        assert.equal(result.fields.some(row => row.status === 'verified'), false);
        assert.equal(result.fields.every(row => row.status === 'failed'), true);
        assert.equal(result.writeStarted, false);
        assert.equal(result.liveSupportClaimed, false);
        assert.equal(result.softwareClickedSave, false);
        assert.equal(result.softwareClickedSubmit, false);
        assert.equal(result.softwareClickedDelete, false);
        for (const [question, answer] of fixture.pairs) {
          assert.equal(page.dom.window.document.getElementById(`field-${question}`).value, answer);
        }
        assert.deepEqual(page.clicks, []);
      } finally {
        page.dom.window.close();
      }
    }
  });
}

test('legacy matching values still verify without dispatching input or change', async () => {
  const skills = boot('src/content/gth-simple-section.js', pageHtml('职业技能与特长',
    `<form>${control('职业技能与特长', { tag: 'textarea', value: 'Python' })}</form>`));
  const other = boot('src/content/gth-other-section.js', pageHtml('其他信息',
    `<form>${control('描述', { tag: 'textarea', value: '维护过一个小工具' })}${control('标题', { value: '开源贡献' })}</form>`));
  try {
    for (const [page, section, api, pairs] of [
      [skills, '职业技能与特长', 'ResumeGthSimpleSection', [['职业技能与特长', 'Python']]],
      [other, '其他信息', 'ResumeGthOtherSection', [['描述', '维护过一个小工具'], ['标题', '开源贡献']]],
    ]) {
      const events = [];
      for (const type of ['input', 'change']) page.dom.window.document.addEventListener(type, () => events.push(type));
      const result = await page.context[api].fill({ sectionName: section, profileBinding: binding, profile: confirmedProfile(section, pairs) });
      assert.equal(result.ok, true);
      assert.equal(result.fields.every(row => row.status === 'verified' && row.reason === 'preexisting_same_value'), true);
      assert.equal(result.writeStarted, false);
      assert.equal(result.liveSupportClaimed, false);
      assert.deepEqual(events, []);
      assert.deepEqual(page.clicks, []);
    }
  } finally {
    skills.dom.window.close();
    other.dom.window.close();
  }
});

test('legacy same-value paths recheck after the binding await before reporting verification', async () => {
  for (const kind of ['own value', 'outside section', 'target identity']) {
    for (const fixture of [
      {
        section: '职业技能与特长', file: 'src/content/gth-simple-section.js', api: 'ResumeGthSimpleSection',
        pairs: [['职业技能与特长', 'Python']],
        body: control('职业技能与特长', { tag: 'textarea', value: 'Python' }),
      },
      {
        section: '其他信息', file: 'src/content/gth-other-section.js', api: 'ResumeGthOtherSection',
        pairs: [['描述', '维护过一个小工具'], ['标题', '开源贡献']],
        body: control('描述', { tag: 'textarea', value: '维护过一个小工具' }) + control('标题', { value: '开源贡献' }),
      },
    ]) {
      const page = boot(fixture.file, pageHtml(fixture.section, `<form>${fixture.body}</form>`));
      try {
        const document = page.dom.window.document;
        let checks = 0;
        page.chrome.runtime.sendMessage = async message => {
          assert.equal(message.type, 'RESUME_PROFILE_BINDING_CHECK');
          checks += 1;
          if (checks === 2) {
            const target = document.getElementById(`field-${fixture.pairs[0][0]}`);
            if (kind === 'own value') target.value = 'Edited during binding check';
            if (kind === 'outside section') document.querySelector('.r-section').append('External section changed');
            if (kind === 'target identity') target.replaceWith(target.cloneNode(true));
          }
          return { allowed: true };
        };
        const result = await page.context[fixture.api].fill({
          sectionName: fixture.section, profileBinding: binding,
          profile: confirmedProfile(fixture.section, fixture.pairs),
        });
        assert.equal(checks, 2);
        assert.equal(result.ok, false, `${fixture.section}: ${kind}`);
        assert.equal(result.reason, 'original_value_changed');
        assert.equal(result.fields.some(row => row.status === 'verified'), false);
        assert.equal(result.writeStarted, false);
        assert.equal(result.liveSupportClaimed, false);
        assert.deepEqual(page.clicks, []);
      } finally {
        page.dom.window.close();
      }
    }
  }
});

test('legacy write-success paths recheck the final binding await before reporting verification', async () => {
  for (const kind of ['own value', 'outside section', 'target identity', 'validation']) {
    for (const fixture of [
      {
        section: '职业技能与特长', file: 'src/content/gth-simple-section.js', api: 'ResumeGthSimpleSection',
        pairs: [['职业技能与特长', 'Python']],
        body: control('职业技能与特长', { tag: 'textarea' }),
        driftReason: kind === 'own value' ? 'readback_mismatch' : 'other_values_changed',
      },
      {
        section: '其他信息', file: 'src/content/gth-other-section.js', api: 'ResumeGthOtherSection',
        pairs: [['描述', '维护过一个小工具'], ['标题', '开源贡献']],
        body: control('描述', { tag: 'textarea' }) + control('标题'),
        driftReason: 'readback_mismatch',
      },
    ]) {
      const page = boot(fixture.file, pageHtml(fixture.section, `<form>${fixture.body}</form>`));
      try {
        const document = page.dom.window.document;
        const finalCheck = 2 + fixture.pairs.length * 3;
        let checks = 0;
        page.chrome.runtime.sendMessage = async message => {
          assert.equal(message.type, 'RESUME_PROFILE_BINDING_CHECK');
          checks += 1;
          if (checks === finalCheck) {
            // Every requested value has passed the writer's readback already.
            for (const [question, answer] of fixture.pairs) {
              assert.equal(document.getElementById(`field-${question}`).value, answer);
            }
            const target = document.getElementById(`field-${fixture.pairs[0][0]}`);
            if (kind === 'own value') target.value = 'Edited during final binding check';
            if (kind === 'outside section') document.querySelector('.r-section').append('External section changed');
            if (kind === 'target identity') target.replaceWith(target.cloneNode(true));
            if (kind === 'validation') target.setAttribute('aria-invalid', 'true');
          }
          return { allowed: true };
        };
        const result = await page.context[fixture.api].fill({
          sectionName: fixture.section, profileBinding: binding,
          profile: confirmedProfile(fixture.section, fixture.pairs),
        });
        assert.equal(checks, finalCheck);
        assert.equal(result.ok, false, `${fixture.section}: ${kind}`);
        assert.equal(result.reason, kind === 'validation' ? 'site_validation_failed' : fixture.driftReason);
        assert.equal(result.fields.every(row => row.status === 'failed'), true);
        assert.equal(result.writeStarted, true);
        assert.equal(result.liveSupportClaimed, false);
        assert.equal(result.softwareClickedSave, false);
        assert.equal(result.softwareClickedSubmit, false);
        assert.equal(result.softwareClickedDelete, false);
        assert.deepEqual(page.clicks, []);
      } finally {
        page.dom.window.close();
      }
    }
  }
});
