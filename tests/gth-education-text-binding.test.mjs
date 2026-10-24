/**
 * Offline races in the shipped education native text writer. The marked open
 * editor, plain school/major items, and saved record shape are already covered
 * by gth-education-live.test.mjs and gth-education-complex-controls.test.mjs.
 * No live DOM, browser, or site support claim is introduced here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../src/content/gth-education.js', import.meta.url), 'utf8');
const PAGE = 'https://hr.gtht.com/resume/edit/';
const TITLES = ['基本信息', '教育经历', '求职意向', '工作经验', '职业技能与特长', '附件简历', '其他信息'];
const BINDING = { version: 1, epoch: '00000000-0000-4000-8000-000000000001', profileHash: 'a'.repeat(64) };
const ANSWER = '计算机';
const MULTILINE = '学生会活动\n组织校园讲座';

function fixture({ at = 0, mutate = () => {}, deny = false, textarea = false } = {}) {
  const item = (label, id, value) => `<div class="el-form-item"><label class="el-form-item__label">${label}</label><div class="el-form-item__content"><input type="text" id="${id}" value="${value}"></div></div>`;
  // These optional controls are the existing education-live editor fixture.
  const fullFields = textarea ? `
    <div class="el-form-item"><label class="el-form-item__label">在校活动/职务</label><div class="el-form-item__content"><textarea id="activities"></textarea></div></div>
    ${item('在校成绩排名', 'rank', '')}
    <div class="el-form-item"><label class="el-form-item__label">专业描述</label><div class="el-form-item__content"><textarea id="description"></textarea></div></div>
    ${item('绩点', 'gpa', '')}${item('学校所在地', 'location', '')}
    <div class="el-form-item"><label class="el-form-item__label">学历</label><div class="el-form-item__content"><div class="el-select"><input type="text" id="degree" value=""></div></div></div>
    <div class="el-form-item"><label class="el-form-item__label">是否统招</label><div class="el-form-item__content"><div class="el-radio-group"><label class="el-radio"><input type="radio" name="unified" value="是"><span class="el-radio__label">是</span></label><label class="el-radio"><input type="radio" name="unified" value="否"><span class="el-radio__label">否</span></label></div></div></div>
    <div class="el-form-item"><label class="el-form-item__label">在校时间</label><div class="el-form-item__content">${['start', 'end'].map(id => `<div class="el-date-editor el-date-editor--month"><span class="el-input__prefix"><i class="el-input__icon el-icon-date" id="${id}-icon"></i></span><input type="text" id="${id}" value=""></div>`).join('')}</div></div>
    <div class="el-form-item"><label class="el-form-item__label">专业类别</label><div class="el-form-item__content"><div id="category-shell"></div></div></div>` : '';
  const editor = `<form class="el-form sec-form" id="education" data-resume-gth-education-record-index="0">
    ${item('毕业学校', 'school', '复旦大学')}${item('专业名称', 'major', textarea ? ANSWER : '')}${fullFields}
    <button type="button" id="cancel">取消</button><button type="button" id="save">保存</button>
  </form><div class="sec-context"><div class="sec-detail">已有教育</div></div>`;
  const html = TITLES.map(title => `<section class="r-section"><div class="title_">${title}</div>${title === '教育经历' ? editor : ''}</section>`).join('');
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, {
    url: PAGE, pretendToBeVisual: true, runScripts: 'dangerously'
  });
  const { window } = dom;
  const { document } = window;
  window.Element.prototype.getClientRects = () => [{ width: 8, height: 8 }];
  Object.defineProperty(document, 'readyState', { get: () => 'complete' });
  Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
  const control = document.getElementById(textarea ? 'activities' : 'major');
  const events = [];
  const clicks = [];
  for (const type of ['input', 'change']) control.addEventListener(type, () => events.push(type));
  const originalClick = window.HTMLElement.prototype.click;
  window.HTMLElement.prototype.click = function () { clicks.push(this); return originalClick.call(this); };
  let checks = 0;
  let mutationRan = false;
  window.chrome = { runtime: {
    sendMessage: async message => {
      if (message.type !== 'RESUME_PROFILE_BINDING_CHECK') return { allowed: false };
      checks += 1;
      // Resolve the binding check only after a page turn has changed the target.
      await Promise.resolve();
      if (checks === at) {
        mutate({ document, control, window });
        mutationRan = true;
        if (deny) return { allowed: false };
      }
      return { allowed: true };
    },
    onMessage: { addListener() {}, removeListener() {} }
  } };
  window.eval(source);
  return { dom, document, control, events, clicks, mutationRan: () => mutationRan,
    run: () => window.ResumeGthEducationTextTrial[textarea ? 'fullTrial' : 'trial']({
      requestId: 'offline-education-text-binding', rowIndex: 0, profileIndex: 0, profileBinding: BINDING,
      educationCandidates: [{ profileIndex: 0, school: '复旦大学', major: ANSWER,
        ...(textarea ? { campusActivities: MULTILINE } : {}),
        confirmedPaths: ['education.0.school', 'education.0.major', ...(textarea ? ['education.0.campusActivities'] : [])] }]
    }) };
}

function neverSave(page, result) {
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.softwareClickedSave, false);
  assert.equal(result.softwareClickedSubmit, false);
  assert.equal(result.softwareClickedDelete, false);
  assert.equal(result.savedOnSite, null);
  assert.equal(result.submitted, null);
  assert.equal(page.clicks.length, 0);
  assert.equal(page.document.getElementById('education').isConnected, true);
}

test('unchanged education text target still fills and dispatches native events', async t => {
  const page = fixture(); t.after(() => page.dom.window.close());
  const result = await page.run();
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.writeStarted, true);
  assert.equal(page.control.value, ANSWER);
  assert.deepEqual(page.events, ['input', 'change']);
  assert.equal(page.document.getElementById('school').value, '复旦大学');
  assert.equal(result.fields.find(field => field.question === '专业名称').reason, 'readback_matched');
  neverSave(page, result);
});

test('unchanged education textarea preserves confirmed multiline text', async t => {
  const page = fixture({ textarea: true }); t.after(() => page.dom.window.close());
  const result = await page.run();
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.writeStarted, true);
  assert.equal(page.control.value, MULTILINE);
  assert.deepEqual(page.events, ['input', 'change']);
  assert.equal(result.fields.find(field => field.question === '在校活动/职务').reason, 'readback_matched');
  neverSave(page, result);
});

const mutations = [
  ['new own text', ({ control }) => { control.value = '页面新输入'; }, 'original_value_changed'],
  ['changed neighbor', ({ document }) => { document.getElementById('school').value = '页面新学校'; }, 'original_value_changed'],
  ['connected old control', ({ document, control }) => {
    const replacement = control.cloneNode();
    control.after(replacement);
    document.querySelectorAll('.r-section')[1].appendChild(control);
  }, 'original_value_changed'],
  ['readonly control', ({ control }) => { control.readOnly = true; }, 'education_target_not_plain_text'],
  ['disabled control', ({ control }) => { control.disabled = true; }, 'education_target_not_plain_text'],
  ['changed input type', ({ control }) => { control.type = 'email'; }, 'education_target_not_plain_text'],
  ['shorter maxlength', ({ control }) => { control.maxLength = 1; }, 'value_too_long'],
  ['changed saved record', ({ document }) => { document.querySelector('.sec-detail').textContent = '页面修改了已有教育'; }, 'original_value_changed'],
  ['changed outside section', ({ document }) => { document.querySelectorAll('.r-section')[0].append('页面修改了基本信息'); }, 'original_value_changed'],
  ['another education form', ({ document }) => {
    document.querySelectorAll('.r-section')[1].appendChild(document.createElement('form'));
  }, 'original_value_changed']
];

// The first check validates the request. Checks 2/3/4 precede setter/input/change.
for (const [stage, at, expectedEvents] of [['setter', 2, []], ['input', 3, []], ['change', 4, ['input']]]) {
  for (const [name, mutate, reason] of mutations) {
    test(`education ${stage} refuses ${name} changed during binding verification`, async t => {
      const page = fixture({ at, mutate }); t.after(() => page.dom.window.close());
      const result = await page.run();
      assert.equal(page.mutationRan(), true);
      assert.equal(result.ok, false);
      assert.equal(result.reason, reason);
      assert.equal(result.activeField, 'major');
      assert.equal(result.selectorStep, 'text_input_events');
      assert.equal(result.writeStarted, stage !== 'setter');
      assert.deepEqual(page.events, expectedEvents);
      assert.equal(result.fields.some(field => field.question === '专业名称' && field.status === 'verified'), false);
      if (name === 'new own text') assert.equal(page.control.value, '页面新输入');
      else assert.equal(page.control.value, stage === 'setter' ? '' : ANSWER);
      neverSave(page, result);
    });
  }
  test(`education textarea ${stage} preserves new page text during binding verification`, async t => {
    const page = fixture({ textarea: true, at, mutate: ({ control }) => { control.value = '页面新活动\n保留此内容'; } });
    t.after(() => page.dom.window.close());
    const result = await page.run();
    assert.equal(page.mutationRan(), true);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'original_value_changed');
    assert.equal(result.activeField, 'campusActivities');
    assert.equal(result.writeStarted, stage !== 'setter');
    assert.equal(page.control.value, '页面新活动\n保留此内容');
    assert.deepEqual(page.events, expectedEvents);
    neverSave(page, result);
  });
}

test('education binding refusal before the setter records no started write', async t => {
  const page = fixture({ at: 2, deny: true }); t.after(() => page.dom.window.close());
  const result = await page.run();
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'profile_binding_changed');
  assert.equal(result.writeStarted, false);
  assert.equal(page.control.value, '');
  assert.deepEqual(page.events, []);
  neverSave(page, result);
});
