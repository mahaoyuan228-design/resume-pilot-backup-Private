/**
 * Synthetic integration fixtures for the Never-Save education runner.
 * These exercise the shipped writer through the browser click/network guards.
 * They are not captured GTH DOM and do not establish live support.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import {
  ALL_QUESTIONS, COMPLEX_QUESTIONS, buildEvidence, buildFieldRows, buildPageExpression,
  clicksAreDiscardOnly, evidenceExitCode, expectedReadback, liveFillRequest
} from '../scripts/live/gth-education-live.mjs';

const writer = fs.readFileSync(new URL('../src/content/gth-education.js', import.meta.url), 'utf8');
const TITLES = ['基本信息', '教育经历', '求职意向', '工作经验', '职业技能与特长', '附件简历', '其他信息'];
const ENV = Object.freeze({
  FIELDS: '学历,是否统招,在校时间,专业类别',
  DEGREE: '本科', UNIFIED_ADMISSIONS: '是', START_DATE: '2020-09', END_DATE: '2024-06',
  MAJOR_CATEGORY: '金融学'
});
const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

function textItem(question, id, tag = 'input') {
  const control = tag === 'textarea' ? `<textarea id="${id}"></textarea>` : `<input type="text" id="${id}">`;
  return `<div class="el-form-item"><label class="el-form-item__label">${question}</label><div class="el-form-item__content">${control}</div></div>`;
}

function editorHtml({ lockedDegree = false, categoryWrappers = ['cascader-wrap'] } = {}) {
  const month = id => `<div class="el-date-editor el-date-editor--month el-input el-input--prefix">
    <span class="el-input__prefix"><i class="el-input__icon el-icon-date" id="${id}-icon"></i></span>
    <input type="text" readonly class="el-input__inner" id="${id}" aria-controls="month-panel">
  </div>`;
  const categoryBody = `<div class="input-l pointer" id="category-trigger"><input type="text" readonly class="el-input__inner" id="category"></div>
    <div class="dialog-wrap plugin-dialog-wrap popover blue" id="category-panel" style="display:none">
      <input type="text" class="search-input">
      <ul class="selected-view-data"></ul>
      <div class="dialog-search-wrap"><div class="eo-cascader-menu simple-tree-outer"><ul class="simple-tree-wrapper">
        <li class="branch"><label><input type="checkbox" uid="synthetic-finance"><span uid="synthetic-finance">金融学</span></label></li>
      </ul></div></div>
      <div class="pop-foot"><a class="pop-btn confirm" href="javascript:;">确定</a></div>
    </div>`;
  const category = categoryWrappers.reduceRight((content, classes, index) =>
    `<div class="${index === 0 ? 'el-form-item__content ' : ''}${classes}">${content}</div>`, categoryBody);
  return `<form class="el-form sec-form" id="education-form">
    ${textItem('毕业学校', 'school')}${textItem('专业名称', 'major')}
    ${textItem('在校活动/职务', 'activities', 'textarea')}${textItem('在校成绩排名', 'rank')}
    ${textItem('专业描述', 'description', 'textarea')}${textItem('绩点', 'gpa')}${textItem('学校所在地', 'location')}
    <div class="el-form-item" id="degree-item"><label class="el-form-item__label">学历</label><div class="el-form-item__content"><div class="el-select"><input type="text" readonly class="el-input__inner" id="degree" aria-controls="degree-panel" ${lockedDegree ? 'disabled value="本科"' : ''}></div></div></div>
    <div class="el-form-item"><label class="el-form-item__label">是否统招</label><div class="el-form-item__content"><div class="el-radio-group">
      <label class="el-radio" id="admissions-yes"><input style="display:none" type="radio" name="admissions" value="1"><span class="el-radio__label">是</span></label>
      <label class="el-radio" id="admissions-no"><input style="display:none" type="radio" name="admissions" value="0"><span class="el-radio__label">否</span></label>
    </div></div></div>
    <div class="el-form-item" id="dates-item"><label class="el-form-item__label">在校时间</label><div class="el-form-item__content">${month('start')}${month('end')}</div></div>
    <div class="el-form-item" id="category-item"><label class="el-form-item__label">专业类别</label>${category}</div>
    <button type="button" id="education-cancel">取消</button><button type="button" id="education-save">保存</button>
  </form>`;
}

function boot(options = {}) {
  const shell = TITLES.map(title => `<section class="r-section" ${title === '教育经历' ? 'id="education"' : ''}>
    <div class="title_">${title}${title === '教育经历' ? '<a class="h-e-btn" href="javascript:;">添加</a>' : ''}</div>
    ${title === '教育经历' ? '<div class="sec-context"><div class="sec-detail"><a id="education-edit" href="javascript:;"><i class="el-icon-edit-outline"></i>编辑</a><span>合成教育记录</span></div></div>' : ''}
  </section>`).join('');
  const dom = new JSDOM(`<!DOCTYPE html><body>${shell}</body>`, {
    url: 'https://hr.gtht.com/resume/edit/', pretendToBeVisual: true, runScripts: 'dangerously'
  });
  const { window } = dom;
  const doc = window.document;
  Object.defineProperty(doc, 'readyState', { configurable: true, get: () => 'complete' });
  Object.defineProperty(doc, 'visibilityState', { configurable: true, get: () => 'visible' });
  window.Element.prototype.getClientRects = function rectangles() {
    if (!this.isConnected) return [];
    for (let current = this; current; current = current.parentElement) {
      const style = window.getComputedStyle(current);
      if (current.hidden || style.display === 'none' || style.visibility === 'hidden') return [];
    }
    return [{ width: 8, height: 8, top: 0, left: 0, bottom: 8, right: 8 }];
  };
  window.fetch = async () => ({ ok: true });
  window.chrome = { runtime: {
    id: 'synthetic-extension',
    getManifest: () => ({ background: { service_worker: 'src/background/worker.mjs' } }),
    sendMessage: async message => ({ allowed: message?.type === 'RESUME_PROFILE_BINDING_CHECK' }),
    onMessage: { addListener() {}, removeListener() {} }
  } };
  let selectedMonthInput = null;
  let monthYear = 2024;
  const observed = { saves: 0, cancels: 0, categoryConfirms: 0, degreePicks: 0, monthPicks: [] };
  const show = node => { node.style.display = ''; };
  const hide = node => { node.style.display = 'none'; };
  doc.querySelector('#education-edit').addEventListener('click', event => {
    event.currentTarget.closest('.sec-detail').remove();
    doc.querySelector('#education').insertAdjacentHTML('beforeend', editorHtml(options));
    doc.body.insertAdjacentHTML('beforeend', `<div class="el-select-dropdown" id="degree-panel" style="display:none"><ul><li class="el-select-dropdown__item">本科</li></ul></div>
      <div class="el-picker-panel el-date-picker" id="month-panel" style="display:none">
        <div class="el-date-picker__header"><button type="button" class="el-picker-panel__icon-btn el-icon-d-arrow-left"></button><span class="el-date-picker__header-label">2024 年</span><button type="button" class="el-picker-panel__icon-btn el-icon-d-arrow-right"></button></div>
        <table class="el-month-table"><tbody><tr>${MONTHS.map((name, index) => `<td data-month="${index + 1}"><div><a class="cell">${name}</a></div></td>`).join('')}</tr></tbody></table>
      </div>`);
    const degreePanel = doc.querySelector('#degree-panel');
    const monthPanel = doc.querySelector('#month-panel');
    const categoryPanel = doc.querySelector('#category-panel');
    if (options.malformedMonth) doc.querySelector('#end').closest('.el-date-editor').classList.remove('el-date-editor--month');
    doc.querySelector('#degree').addEventListener('click', () => degreePanel.style.display === 'none' ? show(degreePanel) : hide(degreePanel));
    degreePanel.querySelector('li').addEventListener('click', () => {
      observed.degreePicks += 1;
      doc.querySelector('#degree').value = '本科';
      hide(degreePanel);
    });
    for (const id of ['start', 'end']) {
      doc.querySelector(`#${id}-icon`).addEventListener('click', () => {
        selectedMonthInput = doc.querySelector(`#${id}`);
        show(monthPanel);
      });
      doc.querySelector(`#${id}`).addEventListener('keydown', event => { if (event.key === 'Escape') hide(monthPanel); });
    }
    for (const [selector, delta] of [['.el-icon-d-arrow-left', -1], ['.el-icon-d-arrow-right', 1]]) {
      monthPanel.querySelector(selector).addEventListener('click', () => {
        monthYear += delta;
        monthPanel.querySelector('.el-date-picker__header-label').textContent = `${monthYear} 年`;
      });
    }
    monthPanel.querySelectorAll('td').forEach(cell => cell.addEventListener('click', () => {
      const value = `${monthYear}-${cell.dataset.month.padStart(2, '0')}`;
      observed.monthPicks.push({ input: selectedMonthInput.id, value });
      selectedMonthInput.value = options.rejectEndMonth && selectedMonthInput.id === 'end' ? '' : value;
      hide(monthPanel);
    }));
    doc.querySelector('#category-trigger').addEventListener('click', () => categoryPanel.style.display === 'none' ? show(categoryPanel) : hide(categoryPanel));
    categoryPanel.querySelector('input[type="checkbox"]').addEventListener('click', event => {
      categoryPanel.querySelector('.selected-view-data').innerHTML = event.currentTarget.checked
        ? '<li uid="synthetic-finance">金融学</li>' : '';
    });
    categoryPanel.querySelector('a.confirm').addEventListener('click', () => {
      observed.categoryConfirms += 1;
      doc.querySelector('#category').value = '金融学';
      hide(categoryPanel);
    });
    doc.querySelector('#education-save').addEventListener('click', () => { observed.saves += 1; });
    doc.querySelector('#education-cancel').addEventListener('click', () => {
      observed.cancels += 1;
      doc.querySelector('#education-form').remove();
      degreePanel.remove();
      monthPanel.remove();
    });
  });
  window.eval(buildPageExpression());
  window.eval(writer);
  return { dom, window, doc, api: window.__gthEducationLive, observed };
}

async function trial(page, env = ENV) {
  const result = await page.window.ResumeGthEducationTextTrial.fullTrial(liveFillRequest(env));
  const read = page.api.read(ALL_QUESTIONS);
  const rows = buildFieldRows({
    questions: ALL_QUESTIONS, fillQuestions: env.FIELDS.split(','), fillFields: result.fields,
    readback: read.readback, expected: expectedReadback(env), trialReason: result.reason
  });
  return { result, read, rows };
}

// The nesting variants exercise synthetic contracts, not observed live layouts.
for (const categoryWrappers of [
  ['cascader-wrap'],
  ['cascader-wrap', 'professional-category'],
  ['professional-category', 'cascader-wrap']
]) {
  test(`synthetic fullTrial verifies all complex groups with ${categoryWrappers.length > 1 ? 'nested ' : ''}${categoryWrappers.join(' > ')} and cancels`, async () => {
    const page = boot({ categoryWrappers });
    try {
      const { result, read, rows } = await trial(page);
      assert.equal(result.ok, true, `${result.reason}: ${JSON.stringify(result)}`);
      for (const q of COMPLEX_QUESTIONS) {
        assert.equal(rows.find(row => row.q === q)?.status, 'verified', `${q}: ${JSON.stringify(rows)}`);
      }
      assert.equal(rows.find(row => row.q === '在校时间').value, '2020-09 至 2024-06');
      assert.equal(read.readback.find(row => row.q === '是否统招').value, '是');
      const category = read.readback.find(row => row.q === '专业类别');
      assert.equal(category.value, '金融学');
      assert.equal(category.dom.items[0].categoryCount, categoryWrappers.length);
      const writerCategory = result.fields.find(row => row.question === '专业类别');
      assert.equal(writerCategory.status, 'verified');
      assert.equal(writerCategory.reason, 'readback_matched');
      assert.notEqual(result.liveSupportClaimed, true);
      assert.equal(result.softwareClickedSave, false);
      assert.equal(result.softwareClickedSubmit, false);
      assert.equal(result.softwareClickedDelete, false);
      assert.equal(page.observed.degreePicks, 1);
      assert.deepEqual(page.observed.monthPicks, [{ input: 'start', value: '2020-09' }, { input: 'end', value: '2024-06' }]);
      assert.equal(page.observed.categoryConfirms, 1);
      assert.equal(page.api.posts().length, 0);
      assert.equal(clicksAreDiscardOnly(Array.from(page.api.clicks())), true, JSON.stringify(page.api.clicks()));
      const cancelled = await page.api.cancel();
      assert.equal(cancelled.closed, true);
      assert.equal(page.observed.cancels, 1);
      assert.equal(page.observed.saves, 0);
      assert.equal(page.doc.querySelector('#education-form'), null);
      const evidence = buildEvidence({
        tipSha: 'synthetic-fixture', fields: rows, saveLikePost: Array.from(page.api.posts()),
        finalDetails: {
          fillQuestions: [...COMPLEX_QUESTIONS], auditComplete: true,
          cancelsOk: cancelled.closed, moduleClaimedSupport: result.liveSupportClaimed,
          bannedClick: !clicksAreDiscardOnly(Array.from(page.api.clicks()))
        }
      });
      assert.equal(evidence.neverSave, true);
      assert.equal(evidence.liveSupportClaimed, false);
      assert.equal(evidence.finalDetails.liveSupportClaimed, false);
      assert.equal(evidenceExitCode(evidence), 0);
    } finally { page.api.restore(); page.dom.window.close(); }
  });
}

test('final paired month readback rejects drift after successful writer results', async () => {
  const page = boot();
  try {
    const { result, rows } = await trial(page, { FIELDS: '在校时间', START_DATE: ENV.START_DATE, END_DATE: ENV.END_DATE });
    assert.equal(result.ok, true, result.reason);
    assert.equal(rows.find(row => row.q === '在校时间').status, 'verified');
    page.doc.querySelector('#end').value = '2024-05';
    const drifted = buildFieldRows({
      questions: ALL_QUESTIONS, fillQuestions: ['在校时间'], fillFields: result.fields,
      readback: page.api.read(ALL_QUESTIONS).readback,
      expected: expectedReadback({ FIELDS: '在校时间', START_DATE: ENV.START_DATE, END_DATE: ENV.END_DATE })
    });
    assert.equal(drifted.find(row => row.q === '在校时间').reason, 'readback_mismatch');
    assert.equal((await page.api.cancel()).closed, true);
    assert.equal(page.observed.saves, 0);
  } finally { page.api.restore(); page.dom.window.close(); }
});

test('unrequested complex controls remain unclaimed even when their DOM is readable', async () => {
  const page = boot();
  try {
    const { result, rows } = await trial(page, { FIELDS: '毕业学校' });
    assert.equal(result.ok, true, result.reason);
    for (const q of COMPLEX_QUESTIONS) {
      assert.equal(rows.find(row => row.q === q)?.reason, 'control_not_supported');
      assert.notEqual(rows.find(row => row.q === q)?.status, 'verified');
    }
    assert.equal(page.observed.degreePicks, 0);
    assert.equal(page.observed.monthPicks.length, 0);
    assert.equal(page.observed.categoryConfirms, 0);
    assert.equal((await page.api.cancel()).closed, true);
    assert.equal(page.observed.saves, 0);
  } finally { page.api.restore(); page.dom.window.close(); }
});

test('locked matching degree stays unsupported with runtime DOM evidence', async () => {
  const page = boot({ lockedDegree: true });
  try {
    const { result, read, rows } = await trial(page, { FIELDS: '学历', DEGREE: '本科' });
    assert.equal(result.ok, true, result.reason);
    assert.equal(result.fields.find(row => row.question === '学历').reason, 'site_control_disabled');
    const row = rows.find(row => row.q === '学历');
    assert.equal(row.reason, 'control_not_supported');
    assert.notEqual(row.status, 'verified');
    assert.match(JSON.stringify(read.readback.find(item => item.q === '学历')), /disabled/);
    assert.equal(page.observed.degreePicks, 0);
    assert.equal((await page.api.cancel()).closed, true);
    assert.equal(page.observed.saves, 0);
  } finally { page.api.restore(); page.dom.window.close(); }
});

test('an end month that rejects the click never verifies the paired date group', async () => {
  const page = boot({ rejectEndMonth: true });
  try {
    const { result, rows } = await trial(page, { FIELDS: '在校时间', START_DATE: ENV.START_DATE, END_DATE: ENV.END_DATE });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'readback_mismatch');
    assert.notEqual(rows.find(row => row.q === '在校时间').status, 'verified');
    assert.equal((await page.api.cancel()).closed, true);
    assert.equal(page.observed.saves, 0);
  } finally { page.api.restore(); page.dom.window.close(); }
});

test('picker-looking foreign actions and dispatched save clicks cannot bypass the guard', async () => {
  const page = boot();
  try {
    const { result } = await trial(page, { FIELDS: '毕业学校' });
    assert.equal(result.ok, true, result.reason);
    const save = page.doc.querySelector('#education-save');
    assert.throws(() => save.click(), /refusing_forbidden_click/);
    assert.throws(() => save.dispatchEvent(new page.window.MouseEvent('click', { bubbles: true })), /refusing_forbidden_click/);
    page.doc.querySelector('#education-form').insertAdjacentHTML('beforeend', '<button type="submit" class="el-icon-d-arrow-right">下一步</button><a class="pop-btn confirm" href="javascript:;" id="outside-confirm">确定</a>');
    assert.throws(() => page.doc.querySelector('button[type="submit"]').click(), /refusing_forbidden_click/);
    assert.throws(() => page.doc.querySelector('#outside-confirm').click(), /refusing_forbidden_click/);
    // A class match in a popup that this field never opened is insufficient.
    page.doc.querySelector('#degree-panel').style.display = '';
    assert.throws(() => page.doc.querySelector('#degree-panel li').click(), /refusing_forbidden_click/);
    page.doc.querySelector('#degree-panel').style.display = 'none';
    await assert.rejects(page.window.fetch('https://hr.gtht.com/interface/js/type/unknown.json', { method: 'POST' }), /disallowed_non_get/);
    assert.equal(page.api.posts().length, 1);
    assert.equal(page.observed.saves, 0);
    assert.equal(page.observed.degreePicks, 0);
    assert.equal(page.observed.categoryConfirms, 0);
    assert.equal(clicksAreDiscardOnly(Array.from(page.api.clicks())), false);
    assert.equal((await page.api.cancel()).closed, true);
  } finally { page.api.restore(); page.dom.window.close(); }
});

test('before-write failure retains concrete control DOM after the writer auto-cancels', async () => {
  for (const scenario of [
    { options: { lockedDegree: true }, env: { FIELDS: '学历', DEGREE: '硕士' }, q: '学历', reason: 'locked_degree_conflict' },
    { options: { malformedMonth: true }, env: { FIELDS: '在校时间', START_DATE: ENV.START_DATE, END_DATE: ENV.END_DATE }, q: '在校时间', reason: 'education_month_structure_changed' }
  ]) {
    const page = boot(scenario.options);
    try {
      const { result, read, rows } = await trial(page, scenario.env);
      assert.equal(result.ok, false);
      assert.equal(result.reason, scenario.reason);
      assert.equal(result.writeStarted, false);
      assert.equal(page.doc.querySelector('#education-form'), null);
      assert.equal(page.observed.cancels, 1);
      const retained = read.readback.find(row => row.q === scenario.q);
      assert.equal(retained.reason, 'control_not_supported');
      assert.equal(retained.value, null);
      assert.equal(retained.detail, 'editor_closed_after_trial');
      assert.equal(retained.dom.stage, 'before_cancel');
      assert.equal(retained.dom.itemCount, 1);
      if (scenario.q === '学历') {
        assert.equal(retained.dom.items[0].controls[0].disabled, true);
        assert.equal(retained.dom.items[0].controls[0].readOnly, true);
      } else {
        assert.equal(retained.dom.items[0].dateEditorCount, 2);
        assert.equal(retained.dom.items[0].monthEditorCount, 1);
      }
      const evidence = rows.find(row => row.q === scenario.q);
      assert.equal(evidence.reason, 'control_not_supported');
      assert.equal(evidence.detail, scenario.reason);
      assert.equal(evidence.value, null);
      assert.equal(evidence.dom.stage, 'before_cancel');
      assert.equal(page.observed.saves, 0);
    } finally { page.api.restore(); page.dom.window.close(); }
  }
});
