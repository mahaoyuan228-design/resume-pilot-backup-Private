// Synthetic DOM contract tests only. These fixtures are not harvested live DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { buildPageExpression, SECTION_TITLES } from '../scripts/live/gth-education-live.mjs';

const item = (label, body) => `<div class="el-form-item"><label class="el-form-item__label">${label}</label><div class="el-form-item__content">${body}</div></div>`;
const degree = '<div class="el-select"><input id="degree" type="text" readonly value="本科"></div>';
const radio = '<div class="el-radio-group"><label class="el-radio" id="yes"><input type="radio" name="admissions" style="display:none" checked><span class="el-radio__label">是</span></label><label class="el-radio" id="no"><input type="radio" name="admissions" style="display:none"><span class="el-radio__label">否</span></label></div>';
const month = (id, value) => `<div class="el-date-editor el-date-editor--month"><span class="el-input__prefix"><i id="${id}-icon" class="el-input__icon el-icon-date"></i></span><input id="${id}" type="text" value="${value}"></div>`;
const category = `<div class="cascader-wrap"><div class="input-l pointer" id="category-trigger"><input id="category" type="text" readonly value="金融学"></div><div class="popover plugin-dialog-wrap" id="category-panel" style="display:none"><input class="search-input" value="search is not a field"><div class="eo-cascader-menu"><ul><li class="branch"><label><input id="leaf" type="checkbox" uid="finance"><span uid="finance">金融学</span></label></li></ul></div><ul class="selected-view-data"><li uid="finance">金融学</li></ul><a class="pop-btn confirm" id="category-confirm" href="javascript:;">确定</a></div></div>`;
function page(extra = '') {
  const body = SECTION_TITLES.map((title, index) => `<section class="r-section"><div class="title_">${title}</div>${index === 1 ? `<form id="editor">${item('学历', degree)}${item('是否统招', radio)}${item('在校时间', month('start', '2018-09') + month('end', '2022-06'))}${item('专业类别', category)}<button type="button" id="cancel">取消</button><button type="button" id="save"><span id="nested-save">保存</span></button><button id="submit">取消</button><button type="button" id="global-confirm">确定</button></form>` : ''}</section>`).join('');
  const dom = new JSDOM(`<!doctype html><body>${body}${extra}</body>`, { url: 'https://hr.gtht.com/resume/edit/', pretendToBeVisual: true, runScripts: 'dangerously' });
  const w = dom.window;
  Object.defineProperty(w.document, 'readyState', { get: () => 'complete' });
  Object.defineProperty(w.document, 'visibilityState', { get: () => 'visible' });
  w.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  w.fetch = async () => ({ ok: true });
  const nativeClick = w.HTMLElement.prototype.click;
  w.eval(buildPageExpression());
  return { dom, w, nativeClick, api: w.__gthEducationLive, el: id => w.document.getElementById(id) };
}
function showDegree(p, location = p.w.document.body) {
  p.el('degree').addEventListener('click', () => location.insertAdjacentHTML('beforeend', '<div class="el-select-dropdown" id="degree-panel"><ul><li class="el-select-dropdown__item" id="degree-option">硕士</li></ul></div>'), { once: true });
  p.el('degree').click();
}

test('typed readback uses native radio and ordered months; popup search is excluded', () => {
  const p = page();
  const rows = p.api.read(['学历', '是否统招', '在校时间', '专业类别']).readback;
  assert.deepEqual(Array.from(rows, row => [row.q, row.value]), [['学历', '本科'], ['是否统招', '是'], ['在校时间', '2018-09 至 2022-06'], ['专业类别', '金融学']]);
  assert.equal(rows.every(row => row.reason === null && row.dom.itemCount === 1), true);
  p.el('no').click();
  assert.equal(p.api.read(['是否统招']).readback[0].value, '否');
  assert.equal(p.api.clicks().every(row => row.allowed && row.kind === 'radio_option'), true);
  p.dom.window.close();
});

test('unknown or disabled controls expose bounded DOM shape without fabricating support', () => {
  const p = page();
  p.el('degree').disabled = true;
  p.el('start').closest('.el-date-editor').classList.remove('el-date-editor--month');
  p.el('category-trigger').parentElement.classList.remove('cascader-wrap');
  const rows = p.api.read(['学历', '在校时间', '专业类别']).readback;
  assert.equal(rows.every(row => row.reason === 'control_not_supported' && row.value === null), true);
  assert.equal(rows[0].detail, 'site_control_disabled');
  assert.equal(rows[0].dom.items[0].controls[0].disabled, true);
  assert.equal(rows[1].dom.items[0].monthEditorCount, 1);
  assert.equal(rows[2].dom.items[0].categoryCount, 0);
  assert.equal(JSON.stringify(rows).includes('search is not a field'), false);
  p.dom.window.close();
});

test('a degree popup requires a preceding owned trigger and rejects foreign or ambiguous menus', () => {
  const p = page('<div class="el-select-dropdown"><li id="unarmed" class="el-select-dropdown__item">本科</li></div>');
  assert.throws(() => p.el('unarmed').click(), /refusing_forbidden_click/);
  assert.throws(() => p.el('degree').click(), /refusing_forbidden_click/);
  p.dom.window.close();
  const foreign = page();
  showDegree(foreign, foreign.w.document.querySelector('.r-section'));
  assert.throws(() => foreign.el('degree-option').click(), /refusing_forbidden_click/);
  foreign.dom.window.close();
  const ambiguous = page();
  showDegree(ambiguous);
  ambiguous.w.document.body.insertAdjacentHTML('beforeend', '<div class="el-select-dropdown"><li class="el-select-dropdown__item">博士</li></div>');
  assert.throws(() => ambiguous.el('degree-option').click(), /refusing_forbidden_click/);
  ambiguous.dom.window.close();
});

test('owned degree options are allowed once in the log; submit, nested save, and navigation stay blocked', () => {
  const p = page();
  showDegree(p);
  p.el('degree-option').click();
  assert.deepEqual(Array.from(p.api.clicks(), row => row.kind), ['picker_trigger', 'select_option']);
  for (const id of ['nested-save', 'submit', 'global-confirm']) assert.throws(() => p.el(id).click(), /refusing_forbidden_click/);
  p.el('degree-panel').insertAdjacentHTML('beforeend', '<a href="/resume/save" class="el-select-dropdown__item" id="nav">硕士</a>');
  assert.throws(() => p.el('nav').click(), /refusing_forbidden_click/);
  let saved = false;
  p.el('save').addEventListener('click', () => { saved = true; });
  assert.throws(() => p.el('nested-save').dispatchEvent(new p.w.MouseEvent('click', { bubbles: true })), /refusing_forbidden_click/);
  assert.equal(saved, false);
  p.nativeClick.call(p.el('save'));
  assert.equal(saved, false, 'capture hook also blocks previously captured native click');
  assert.equal(p.api.clicks().some(row => !row.allowed), true);
  p.dom.window.close();
});

test('category 确定 is restricted to owned panel and exact UID selected through its leaf', () => {
  const p = page();
  p.el('category-trigger').addEventListener('click', () => { p.el('category-panel').style.display = 'block'; });
  assert.throws(() => p.el('category-confirm').click(), /refusing_forbidden_click/);
  p.el('category-trigger').click();
  assert.throws(() => p.el('category-confirm').click(), /refusing_forbidden_click/);
  p.el('leaf').click();
  p.el('category-confirm').click();
  const selected = p.el('category-panel').querySelector('.selected-view-data li');
  selected.setAttribute('uid', 'foreign');
  assert.throws(() => p.el('category-confirm').click(), /refusing_forbidden_click/);
  assert.throws(() => p.el('global-confirm').click(), /refusing_forbidden_click/);
  selected.setAttribute('uid', 'finance');
  p.el('category-confirm').href = '/resume/save';
  assert.throws(() => p.el('category-confirm').click(), /refusing_forbidden_click/);
  p.dom.window.close();
});

test('every non-GET is blocked, GET form submit is sticky forbidden evidence, restore is complete', async () => {
  const p = page();
  await assert.rejects(p.w.fetch('https://hr.gtht.com/api/save?secret=x', { method: 'POST' }), /disallowed_non_get/);
  assert.equal(p.api.posts()[0].url.includes('secret'), false);
  assert.throws(() => p.el('editor').submit(), /disallowed_non_get/);
  assert.equal(p.api.clicks().some(row => row.kind === 'forbidden' && row.label === 'form_submit'), true);
  p.api.restore();
  let saved = false;
  p.el('save').addEventListener('click', () => { saved = true; });
  p.el('save').click();
  assert.equal(saved, true);
  p.dom.window.close();
});


test('cancel retains unsupported DOM structure but never returns stale readback values', async () => {
  const p = page();
  p.el('start').closest('.el-date-editor').classList.remove('el-date-editor--month');
  p.el('submit').remove();
  p.el('cancel').addEventListener('click', () => p.el('editor').remove());
  const result = await p.api.cancel();
  assert.equal(result.closed, true);
  const row = p.api.read(['在校时间']).readback[0];
  assert.equal(row.reason, 'control_not_supported');
  assert.equal(row.value, null);
  assert.equal(row.detail, 'editor_closed_after_trial');
  assert.equal(row.dom.stage, 'before_cancel');
  assert.equal(row.dom.readDetail, 'month_structure_changed');
  assert.equal(row.dom.items[0].monthEditorCount, 1);
  assert.equal(JSON.stringify(row).includes('2018-09'), false);
  p.dom.window.close();
});
