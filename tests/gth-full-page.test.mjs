import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { buildPageExpression, isAllowedRequest, PHOTO_SIZE_LOOKUP, SALARY_UNIT_LOOKUP } from '../scripts/live/lib/gth-full-page.mjs';
import { SECTION_TITLES } from '../scripts/live/gth-intent-live.mjs';

const PAGE = 'https://hr.gtht.com/resume/edit/';
const item = '<div class="el-form-item"><label class="el-form-item__label">标题</label><div class="el-form-item__content"><input value="自我介绍"></div></div>';

function boot({ cancel = 'remove', delayedItems = false, stubXhr = false, waitTimeoutMs = 80 } = {}) {
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
  if (stubXhr) {
    window.XMLHttpRequest.prototype.open = function (method, url) { this.testRequest = { method, url }; };
    window.XMLHttpRequest.prototype.send = function () { sent.push(this.testRequest); };
  }
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
  window.eval(buildPageExpression({ waitTimeoutMs, pollMs: 1 }));
  return { dom, window, sections, api: window.__gthFullLive, sent, nativeClick, nativeFetch };
}

test('full runner request allowlist permits GET plus the exact salary-unit and photo-size lookup POSTs', () => {
  assert.equal(isAllowedRequest('GET', 'https://elsewhere.test/arbitrary'), true);
  assert.equal(isAllowedRequest('POST', `${SALARY_UNIT_LOOKUP}?cache=1`), true);
  assert.equal(isAllowedRequest('POST', '/interface/js/type/getsalaryunit.json?cache=1'), true);
  assert.equal(isAllowedRequest('POST', `${PHOTO_SIZE_LOOKUP}?cache=1`), true);
  assert.equal(isAllowedRequest('POST', '/interface/photo/type/getPhotoSize.json?cache=1'), true);
  for (const method of ['HEAD', 'OPTIONS', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal(isAllowedRequest(method, SALARY_UNIT_LOOKUP), false, method);
    assert.equal(isAllowedRequest(method, PHOTO_SIZE_LOOKUP), false, method);
  }
  for (const url of ['https://hr.gtht.com/api/resume/getsalaryunit.json',
    'https://evil.test/interface/js/type/getsalaryunit.json',
    `${SALARY_UNIT_LOOKUP}/`, 'https://user@hr.gtht.com/interface/js/type/getsalaryunit.json',
    'http://hr.gtht.com/interface/js/type/getsalaryunit.json',
    'https://hr.gtht.com/api/resume/save.json',
    'https://hr.gtht.com/interface/photo/type/savePhoto.json',
    'https://hr.gtht.com/interface/resume/submit.json',
    'https://hr.gtht.com/interface/resume/delete.json',
    'https://hr.gtht.com:444/interface/photo/type/getPhotoSize.json',
    'https://hr.gtht.com/interface/photo/type/getphotosize.json',
    'https://hr.gtht.com/interface/photo/type/%67etPhotoSize.json',
    'https://hr.gtht.com/interface/photo/type/getPhotoSize.json/extra',
    'https://hr.gtht.com/interface/photo/type/getPhotoSize.json;save',
    'https://evil.test/interface/photo/type/getPhotoSize.json',
    `${PHOTO_SIZE_LOOKUP}/`, 'https://user@hr.gtht.com/interface/photo/type/getPhotoSize.json',
    'http://hr.gtht.com/interface/photo/type/getPhotoSize.json']) {
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

test('cancel physically removes a hidden or replacement editor before the next section opens', async () => {
  for (const mode of ['hide', 'stay']) {
    const { dom, api } = boot({ cancel: mode });
    try {
      assert.equal((await api.open(6)).ok, true);
      const cancel = await api.cancel(6);
      assert.equal(cancel.closed, true, mode);
      assert.equal(cancel.forced, true, mode);
      assert.equal(api.state().editorFormCount, 0);
      assert.equal(api.state().activeSectionIndex, null);
      assert.equal((await api.open(4)).ok, true);
      assert.equal((await api.cancel(4)).closed, true);
    } finally { api.restore(); dom.window.close(); }
  }
  const { dom, api, sections } = boot();
  try {
    await api.open(6);
    const form = sections[6].querySelector('form');
    form.querySelector('button').addEventListener('click', () => sections[6].append(form.cloneNode(true)));
    assert.equal((await api.cancel(6)).closed, true);
    assert.equal(sections[6].querySelector('form'), null);
    assert.equal(api.state().editorFormCount, 0);
  } finally { api.restore(); dom.window.close(); }
});

test('an existing editor also waits for .el-form-item before returning ready', async () => {
  // Allow delayed fixture rendering when parallel Windows test processes are busy.
  const { dom, window, api, sections } = boot({ waitTimeoutMs: 1000 });
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

test('click allowlist admits in-panel options, date controls and 确定, and still blocks 保存', async () => {
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
    const bare = window.document.createElement('div');
    form.append(bare);
    assert.throws(() => bare.click(), /refusing_forbidden_click/);
    form.insertAdjacentHTML('beforeend', [
      '<div class="el-select-dropdown el-popper"><ul><li class="el-select-dropdown__item"><span>一个月内</span></li></ul></div>',
      '<div class="dialog-wrap plugin-dialog-wrap popover blue"><div class="eo-cascader-panel"><div class="eo-cascader-menu simple-tree-outer"><ul class="simple-tree-wrapper"><li class="branch"><span>大兴区</span><input type="checkbox"></li></ul></div></div><div class="pop-foot plugin-dialog-pop-foot"><a class="confirm pop-btn">确定</a><button type="submit">确定</button></div></div>',
      '<div class="el-picker-panel"><div class="el-date-picker__header"><button type="button" class="el-picker-panel__icon-btn"><i class="el-icon-d-arrow-left"></i></button></div><table class="el-date-table"><tr><td class="available"><span>15</span></td></tr></table><div class="el-picker-panel__footer"><button type="button">确定</button></div></div>',
      '<div class="el-date-editor el-date-editor--month"><span class="el-input__prefix"><i class="el-input__icon el-icon-date"></i></span></div>'
    ].join(''));
    form.querySelector('.el-select-dropdown__item span').click();
    form.querySelector('li.branch span').click();
    form.querySelector('li.branch input').click();
    form.querySelector('a.confirm').click();
    form.querySelector('.el-icon-d-arrow-left').click();
    form.querySelector('.el-date-table span').click();
    form.querySelector('.el-picker-panel__footer button').click();
    form.querySelector('.el-icon-date').click();
    assert.throws(() => form.querySelector('.pop-foot button[type="submit"]').click(), /refusing_forbidden_click/);
    assert.equal(api.clicks().filter(row => row.allowed && row.kind === 'picker_option').length, 3);
    assert.equal(api.clicks().filter(row => row.allowed && row.kind === 'panel_confirm').length, 2);
    assert.equal(api.clicks().filter(row => row.allowed && row.kind === 'date_panel').length, 2);
    assert.equal(api.clicks().filter(row => row.allowed && row.kind === 'picker_trigger').length, 1);
    assert.equal(api.clicks().filter(row => !row.allowed && row.label === '保存').length, 2);
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
    await window.fetch(`${PHOTO_SIZE_LOOKUP}?cache=1`, { method: 'POST' });
    await assert.rejects(window.fetch('/save', { method: 'POST' }), /disallowed_non_get/);
    await assert.rejects(window.fetch(SALARY_UNIT_LOOKUP, { method: 'HEAD' }), /disallowed_non_get/);
    const xhr = new window.XMLHttpRequest();
    xhr.open('OPTIONS', SALARY_UNIT_LOOKUP);
    assert.throws(() => xhr.send(), /disallowed_non_get/);
    assert.equal(window.navigator.sendBeacon('/log', 'x'), false);
    assert.throws(() => sections[6].querySelector('form').submit(), /disallowed_non_get/);
    assert.equal(sent.length, 3);
    assert.equal(api.requests().some(row => row.allowed && row.url === PHOTO_SIZE_LOOKUP), true);
    assert.equal(api.requests().some(row => row.allowed && row.url === SALARY_UNIT_LOOKUP), true);
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


test('the shipped month trigger, header year arrows, month links and TD retry stay Never-Save', async () => {
  const { dom, api, sections, window } = boot();
  try {
    await api.open(0);
    const form = sections[0].querySelector('form');
    // Same month markup as gth-education-live-complex and shipped basic/open-fill.
    form.insertAdjacentHTML('afterbegin', '<div class="el-form-item"><label class="el-form-item__label">出生年月</label><div class="el-date-editor el-date-editor--month"><input type="text" readonly><span class="el-input__prefix"><i class="el-input__icon el-icon-date"></i></span></div></div>');
    window.document.body.insertAdjacentHTML('beforeend', `<div class="el-picker-panel el-date-picker" style="display:none">
      <div class="el-date-picker__header"><button type="button" class="el-picker-panel__icon-btn el-icon-d-arrow-left"></button><span class="el-date-picker__header-label">2024 年</span><button type="button" class="el-picker-panel__icon-btn el-icon-d-arrow-right"></button></div>
      <table class="el-month-table"><tbody><tr>${['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'].map(text => `<td><div><a class="cell">${text}</a></div></td>`).join('')}</tr></tbody></table>
    </div>`);
    const panel = window.document.querySelector('.el-picker-panel');
    let year = 2024;
    form.querySelector('.el-icon-date').addEventListener('click', () => { panel.style.display = ''; });
    for (const [selector, delta] of [['.el-icon-d-arrow-left', -1], ['.el-icon-d-arrow-right', 1]]) {
      panel.querySelector(selector).addEventListener('click', () => {
        year += delta;
        panel.querySelector('.el-date-picker__header-label').textContent = `${year} 年`;
      });
    }
    form.querySelector('.el-icon-date').click();
    panel.querySelector('.el-icon-d-arrow-left').click();
    panel.querySelector('.el-icon-d-arrow-right').click();
    panel.querySelector('a.cell').click();
    panel.querySelector('td').click();
    assert.equal(year, 2024);
    assert.equal(api.clicks().filter(row => row.allowed && row.kind === 'date_panel').length, 4);
    const link = panel.querySelector('a.cell');
    link.href = '/resume/save/';
    assert.throws(() => link.click(), /refusing_forbidden_click/);
    link.removeAttribute('href');
    panel.querySelector('td').classList.add('disabled');
    assert.throws(() => panel.querySelector('td').click(), /refusing_forbidden_click/);
    panel.style.display = 'none';
    assert.throws(() => panel.querySelector('.el-icon-d-arrow-left').click(), /refusing_forbidden_click/);
    await api.cancel(0);
    assert.equal(api.state().formCount, 0);
  } finally { api.restore(); dom.window.close(); }
});

test('writer-owned education open and in-form radios use the current section roles', async () => {
  const { dom, api, sections, window } = boot();
  try {
    sections[1].querySelector('.title_ a').remove();
    sections[1].insertAdjacentHTML('beforeend', '<div class="sec-context"><div class="sec-detail"><a href="javascript:;"><i class="el-icon-edit-outline"></i></a></div></div>');
    const edit = sections[1].querySelector('.sec-detail a');
    assert.throws(() => edit.click(), /refusing_forbidden_click/);
    assert.equal(api.activate(1).ok, true);
    let opened = false;
    edit.addEventListener('click', () => { opened = true; });
    edit.querySelector('i').click();
    assert.equal(opened, true);
    sections[1].insertAdjacentHTML('beforeend', '<form class="el-form sec-form"><div class="el-form-item"><label class="el-form-item__label">是否统招</label><div class="el-radio-group"><label class="el-radio"><input type="radio" style="display:none" name="admission"><span class="el-radio__label">是</span></label><label class="el-radio"><input type="radio" style="display:none" name="admission"><span class="el-radio__label">否</span></label></div></div><button type="button">取消</button></form>');
    const form = sections[1].querySelector('form');
    form.querySelector('label.el-radio').click();
    assert.equal(form.querySelector('input').checked, true, 'label forwards its click to the hidden native radio');
    form.querySelector('.el-radio__label').click();
    assert.equal(api.clicks().some(row => row.allowed && row.kind === 'radio_option'), true);
    assert.throws(() => edit.click(), /refusing_forbidden_click/, 'cannot open a second record');
    assert.equal(api.activate(0).reason, 'other_section_editor_open');
    await api.cancel(1);
    await api.open(0);
    const basic = sections[0].querySelector('form');
    basic.insertAdjacentHTML('afterbegin', '<div class="el-form-item"><label class="el-form-item__label">性别</label><div class="el-radio-group"><label class="el-radio"><input type="radio" style="display:none" name="gender"><span class="el-radio__label">男</span></label><label class="el-radio"><input type="radio" style="display:none" name="gender"><span class="el-radio__label">女</span></label></div></div>');
    const female = basic.querySelectorAll('label.el-radio')[1];
    female.click();
    assert.equal(female.querySelector('input').checked, true);
    female.classList.add('is-disabled');
    assert.throws(() => female.click(), /refusing_forbidden_click/);
    await api.cancel(0);
    assert.equal(api.activate(-1).ok, false);
    Object.defineProperty(window.document, 'visibilityState', { configurable: true, value: 'hidden' });
    assert.equal(api.activate(1).reason, 'page_hidden');
  } finally { api.restore(); dom.window.close(); }
});

test('panel lookalikes never permit navigation, submit, disabled controls or actions without an editor', async () => {
  const { dom, api, sections, window } = boot();
  try {
    await api.open(6);
    const form = sections[6].querySelector('form');
    form.insertAdjacentHTML('beforeend', '<div class="el-picker-panel"><a class="cell">unowned cell</a><button type="button" class="el-icon-d-arrow-left"></button><div class="el-date-picker__header"><button type="submit" class="el-icon-d-arrow-right"></button></div><div class="el-picker-panel__footer"><button type="button" formaction="/resume/save">确定</button></div><button type="button" class="el-select-dropdown__item">删除</button></div>');
    for (const node of form.querySelectorAll('.el-picker-panel a,.el-picker-panel button')) {
      assert.throws(() => node.click(), /refusing_forbidden_click/);
    }
    await api.cancel(6);
    window.document.body.insertAdjacentHTML('beforeend', '<div class="el-select-dropdown"><li class="el-select-dropdown__item">unowned option</li></div>');
    assert.throws(() => window.document.querySelector('.el-select-dropdown__item').click(), /refusing_forbidden_click/);
  } finally { api.restore(); dom.window.close(); }
});


test('page fetch, XHR and beacon hooks only pass the two exact lookup POSTs', async () => {
  const { dom, api, window, sent } = boot({ stubXhr: true });
  try {
    for (const lookup of [SALARY_UNIT_LOOKUP, PHOTO_SIZE_LOOKUP]) {
      const url = `${lookup}?cache=1`;
      await window.fetch(url, { method: 'POST' });
      const xhr = new window.XMLHttpRequest();
      xhr.open('POST', url);
      xhr.send();
      assert.equal(window.navigator.sendBeacon(url, 'dictionary'), true);
      for (const rejected of [`${lookup}/`, lookup.replace('hr.gtht.com', 'other.test'), '/resume/save/']) {
        await assert.rejects(window.fetch(rejected, { method: 'POST' }), /disallowed_non_get/);
        const blockedXhr = new window.XMLHttpRequest();
        blockedXhr.open('POST', rejected);
        assert.throws(() => blockedXhr.send(), /disallowed_non_get/);
        assert.equal(window.navigator.sendBeacon(rejected, 'x'), false);
      }
    }
    assert.equal(sent.length, 6, 'forbidden requests never reach any original transport');
    assert.equal(api.requests().filter(row => row.allowed).length, 6);
    assert.equal(api.requests().filter(row => row.blocked).length, 18);
    assert.equal(api.requests().some(row => row.url.includes('?')), false, 'evidence strips query values');
  } finally { api.restore(); dom.window.close(); }
});
