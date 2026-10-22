import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { buildPageExpression, isAllowedRequest, SALARY_UNIT_LOOKUP } from '../scripts/live/lib/gth-full-page.mjs';
import { SECTION_TITLES } from '../scripts/live/gth-intent-live.mjs';

const PAGE = 'https://hr.gtht.com/resume/edit/';
const item = '<div class="el-form-item"><label class="el-form-item__label">标题</label><div class="el-form-item__content"><input value="自我介绍"></div></div>';

function boot({ cancel = 'remove', delayedItems = false } = {}) {
  // Shell and controls mirror gth-other-skills-live.test.mjs; picker structure
  // mirrors gth-intent-census-dom.mjs / gth-work-fill.test.mjs.
  const dom = new JSDOM(`<!doctype html><body>${SECTION_TITLES.map(title =>
    `<section class="r-section"><div class="title_">${title}<a class="h-e-btn" href="javascript:;">编辑</a></div></section>`
  ).join('')}</body>`, { url: PAGE, pretendToBeVisual: true, runScripts: 'outside-only' });
  const { window } = dom;
  window.Element.prototype.getClientRects = () => [{ width: 8, height: 8 }];
  Object.defineProperty(window.document, 'readyState', { configurable: true, get: () => 'complete' });
  const sent = [];
  window.fetch = async (url, init) => { sent.push({ url, method: init?.method || 'GET' }); return { ok: true }; };
  window.navigator.sendBeacon = url => { sent.push({ url, method: 'POST' }); return true; };
  const nativeClick = window.HTMLElement.prototype.click;
  const nativeFetch = window.fetch;
  const sections = [...window.document.querySelectorAll('.r-section')];
  sections.forEach(section => {
    section.querySelector('a.h-e-btn').addEventListener('click', event => {
      event.preventDefault();
      event.currentTarget.remove();
      const form = window.document.createElement('form');
      form.className = 'el-form sec-form';
      form.innerHTML = `${delayedItems ? '' : item}<button type="button">取消</button><button type="button">保存</button>`;
      section.append(form);
      if (delayedItems) window.setTimeout(() => form.insertAdjacentHTML('afterbegin', item), 10);
      form.querySelector('button').addEventListener('click', () => {
        if (cancel === 'remove') form.remove();
        if (cancel === 'hide') form.style.display = 'none';
      });
    });
  });
  window.eval(buildPageExpression({ waitTimeoutMs: 80, pollMs: 1 }));
  return { dom, window, sections, api: window.__gthFullLive, sent, nativeClick, nativeFetch };
}

test('full runner request allowlist permits only GET and the exact salary-unit lookup POST', () => {
  assert.equal(isAllowedRequest('GET', 'https://elsewhere.test/arbitrary'), true);
  assert.equal(isAllowedRequest('POST', `${SALARY_UNIT_LOOKUP}?cache=1`), true);
  assert.equal(isAllowedRequest('POST', '/interface/js/type/getsalaryunit.json?cache=1'), true);
  for (const method of ['HEAD', 'OPTIONS', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal(isAllowedRequest(method, SALARY_UNIT_LOOKUP), false, method);
  }
  for (const url of ['https://hr.gtht.com/api/resume/getsalaryunit.json',
    'https://evil.test/interface/js/type/getsalaryunit.json',
    `${SALARY_UNIT_LOOKUP}/`, 'https://user@hr.gtht.com/interface/js/type/getsalaryunit.json',
    'http://hr.gtht.com/interface/js/type/getsalaryunit.json']) {
    assert.equal(isAllowedRequest('POST', url), false, url);
  }
});

test('full page guard waits for form items and verifies physical removal on cancel', async () => {
  const { dom, api } = boot({ delayedItems: true });
  try {
    const open = await api.open(6);
    assert.equal(open.ok, true);
    assert.equal(open.openedByUs, true);
    assert.equal(api.read(6, ['标题']).readback[0].value, '自我介绍');
    const cancel = await api.cancel(6);
    assert.equal(cancel.closed, true);
    assert.equal(api.state().editorFormCount, 0);
    assert.equal(api.state().activeSectionIndex, null);
    assert.deepEqual(Array.from(api.clicks(), row => row.label), ['编辑', '取消']);
  } finally { api.restore(); dom.window.close(); }
});

test('hidden or replaced forms fail cancel verification and prevent next editor opening', async () => {
  for (const mode of ['hide', 'stay']) {
    const { dom, api } = boot({ cancel: mode });
    try {
      assert.equal((await api.open(6)).ok, true);
      const cancel = await api.cancel(6);
      assert.equal(cancel.closed, false, mode);
      assert.equal(cancel.reason, 'editor_still_open');
      assert.equal((await api.open(4)).reason, 'other_section_editor_open');
      assert.equal(api.clicks().filter(row => row.kind === 'edit').length, 1);
    } finally { api.restore(); dom.window.close(); }
  }
  const { dom, api, sections } = boot();
  try {
    await api.open(6);
    const form = sections[6].querySelector('form');
    form.querySelector('button').addEventListener('click', () => sections[6].append(form.cloneNode(true)));
    assert.equal((await api.cancel(6)).reason, 'editor_still_open');
  } finally { api.restore(); dom.window.close(); }
});

test('an existing editor also waits for .el-form-item before returning ready', async () => {
  const { dom, window, api, sections } = boot();
  try {
    sections[6].querySelector('a.h-e-btn').remove();
    sections[6].insertAdjacentHTML('beforeend', '<form class="el-form sec-form"><button type="button">取消</button></form>');
    const form = sections[6].querySelector('form');
    window.setTimeout(() => form.insertAdjacentHTML('afterbegin', item), 10);
    const result = await api.open(6);
    assert.equal(result.ok, true);
    assert.equal(result.alreadyOpen, true);
    assert.ok(form.querySelector('.el-form-item'));
    assert.equal(api.clicks().length, 0);
  } finally { api.restore(); dom.window.close(); }
});

test('initial basic inline editor is narrowly identified, adopted, awaited and cancelled', async () => {
  const { dom, window, api, sections } = boot();
  try {
    sections[0].querySelector('a.h-e-btn').remove();
    sections[0].insertAdjacentHTML('beforeend', '<form class="el-form sec-form"><button type="button">取消</button></form>');
    const form = sections[0].querySelector('form');
    form.querySelector('button').addEventListener('click', () => form.remove());
    assert.equal(api.state().basicInitialEditor, true);
    assert.deepEqual(Array.from(api.state().sectionFormCounts), [1, 0, 0, 0, 0, 0, 0]);
    window.setTimeout(() => form.insertAdjacentHTML('afterbegin', '<div class="el-form-item"><label class="el-form-item__label">姓名</label><input value="王明"></div>'), 10);
    const opened = await api.open(0);
    assert.equal(opened.ok, true);
    assert.equal(opened.alreadyOpen, true);
    assert.equal(opened.openedByUs, false);
    assert.ok(form.querySelector('.el-form-item'));
    assert.equal(api.clicks().length, 0);
    assert.equal((await api.cancel(0)).closed, true);
    assert.equal(api.state().basicInitialEditor, false);
    assert.deepEqual(Array.from(api.state().sectionFormCounts), [0, 0, 0, 0, 0, 0, 0]);
    assert.deepEqual(Array.from(api.clicks(), row => row.label), ['取消']);
  } finally { api.restore(); dom.window.close(); }
});

test('initial basic detection rejects unsafe cancel controls, edit links and foreign forms', () => {
  const { dom, api, sections } = boot();
  try {
    sections[0].insertAdjacentHTML('beforeend', '<form class="el-form sec-form"><button type="button">取消</button></form>');
    assert.equal(api.state().basicInitialEditor, false, 'edit link remains');
    sections[0].querySelector('a.h-e-btn').remove();
    assert.equal(api.state().basicInitialEditor, true);
    const form = sections[0].querySelector('form');
    const cancel = form.querySelector('button');
    cancel.type = 'submit';
    assert.equal(api.state().basicInitialEditor, false, 'submit is not safe cancel');
    cancel.type = 'button';
    form.append(cancel.cloneNode(true));
    assert.equal(api.state().basicInitialEditor, false, 'cancel not unique');
    form.lastChild.remove();
    sections[1].insertAdjacentHTML('beforeend', '<form class="el-form sec-form"></form>');
    assert.equal(api.state().basicInitialEditor, false, 'foreign form exists');
  } finally { api.restore(); dom.window.close(); }
});

test('strict click allowlist blocks save, triggers and confirmation while admitting in-panel options', async () => {
  const { dom, window, api, sections } = boot();
  try {
    await api.open(6);
    const form = sections[6].querySelector('form');
    let dangerousClicks = 0;
    const save = form.querySelectorAll('button')[1];
    save.addEventListener('click', () => { dangerousClicks += 1; });
    assert.throws(() => save.click(), /refusing_forbidden_click/);
    assert.throws(() => save.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })), /refusing_forbidden_click/);
    assert.equal(dangerousClicks, 0);
    assert.throws(() => form.querySelector('input').click(), /refusing_forbidden_click/);
    form.insertAdjacentHTML('beforeend', '<div class="el-select-dropdown el-popper"><ul><li class="el-select-dropdown__item"><span>一个月内</span></li></ul></div><div class="dialog-wrap plugin-dialog-wrap popover blue"><div class="eo-cascader-panel"><div class="eo-cascader-menu simple-tree-outer"><ul class="simple-tree-wrapper"><li class="branch"><span>大兴区</span></li></ul></div></div><div class="pop-foot plugin-dialog-pop-foot"><a class="confirm pop-btn">确定</a></div></div>');
    form.querySelector('.el-select-dropdown__item span').click();
    form.querySelector('li.branch span').click();
    assert.throws(() => form.querySelector('a.confirm').click(), /refusing_forbidden_click/);
    assert.equal(api.clicks().filter(row => row.allowed && row.kind === 'picker_option').length, 2);
    assert.equal(api.clicks().filter(row => !row.allowed).length, 4);
    form.querySelector('.el-select-dropdown').style.display = 'none';
    assert.throws(() => form.querySelector('.el-select-dropdown__item').click(), /refusing_forbidden_click/);
    await api.cancel(6);
  } finally { api.restore(); dom.window.close(); }
});

test('fetch, XHR, beacon and direct form submits cannot send forbidden requests; restore removes hooks', async () => {
  const { dom, window, api, sent, nativeClick, nativeFetch, sections } = boot();
  try {
    await api.open(6);
    await window.fetch('/read');
    await window.fetch(`${SALARY_UNIT_LOOKUP}?secret=hidden`, { method: 'POST' });
    await assert.rejects(window.fetch('/save', { method: 'POST' }), /disallowed_non_get/);
    await assert.rejects(window.fetch(SALARY_UNIT_LOOKUP, { method: 'HEAD' }), /disallowed_non_get/);
    const xhr = new window.XMLHttpRequest();
    xhr.open('OPTIONS', SALARY_UNIT_LOOKUP);
    assert.throws(() => xhr.send(), /disallowed_non_get/);
    assert.equal(window.navigator.sendBeacon('/log', 'x'), false);
    assert.throws(() => sections[6].querySelector('form').submit(), /disallowed_non_get/);
    assert.equal(sent.length, 2);
    assert.equal(api.requests().filter(row => !row.allowed).length, 5);
    assert.equal(api.requests().some(row => row.url.includes('?')), false);
    api.restore();
    assert.equal(window.HTMLElement.prototype.click, nativeClick);
    assert.equal(window.fetch, nativeFetch);
  } finally { api.restore(); dom.window.close(); }
});

test('a foreign editor and a hidden page fail before any edit click', async () => {
  const { dom, window, api, sections } = boot();
  try {
    Object.defineProperty(window.document, 'visibilityState', { configurable: true, value: 'hidden' });
    assert.equal((await api.open(6)).reason, 'page_hidden');
    Object.defineProperty(window.document, 'visibilityState', { configurable: true, value: 'visible' });
    sections[0].insertAdjacentHTML('beforeend', '<form class="el-form sec-form"></form>');
    assert.equal((await api.open(6)).reason, 'other_section_editor_open');
    assert.equal(api.clicks().length, 0);
  } finally { api.restore(); dom.window.close(); }
});
