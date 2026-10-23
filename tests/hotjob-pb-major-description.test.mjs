// Offline trial only. DOM comes from the cited, existing probe fixture.
// Text values are synthetic caller facts and are never advertised as live evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { normalizeProfile } from '../src/profile/store.js';

const SLUG = 'major-description';
const API = 'ResumeHotjobPbMajorDescription';
const source = readFileSync(new URL(`../src/content/hotjob-pb-${SLUG}.js`, import.meta.url), 'utf8');
const probe = JSON.parse(readFileSync(new URL(`fixtures/hotjob-pb-${SLUG}-probe-dom.json`, import.meta.url), 'utf8'));
const original = JSON.parse(readFileSync(new URL('fixtures/hotjob-pb-contact-eval-probe-dom.json', import.meta.url), 'utf8'));
const certs = JSON.parse(readFileSync(new URL('fixtures/hotjob-pb-certs-probe-dom.json', import.meta.url), 'utf8'));
const LABEL = probe.field.label;
const PAGE = `https://${probe.page.hostname}${probe.page.samplePath}`;
const CALLER = 'Explicit caller fact\nSecond line  keeps spaces';
const esc = (value) => String(value).replace(/[&<>"]/gu, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
const row = (label, html) => `<div class="${probe.page.itemClass}"><label>${esc(label)}*</label><span class="${probe.page.childrenClass}">${html}</span></div>`;

function markup(state) {
  const target = state.asInput
    ? `<input id="target" class="ant-input" placeholder="${esc(probe.field.placeholder)}" value="${esc(state.value || '')}">`
    : `<textarea id="target" class="${state.plain ? 'plain-area' : probe.field.controlClass}" placeholder="${esc(state.placeholder ?? probe.field.placeholder)}"${state.disabled ? ' disabled' : ''}${state.readonly ? ' readonly' : ''}>${esc(state.value || '')}</textarea>`;
  let targetRow = row(LABEL, target + (state.extraArea ? '<textarea class="ant-input"></textarea>' : '') + (state.stray ? '<input class="ant-input" type="text">' : ''));
  if (state.sameCaption) targetRow = targetRow.replace('</label>', `</label><label>${esc(LABEL)}*</label>`);
  if (state.badCaption) targetRow = targetRow.replace('</label>', '</label><label>OTHER_LABEL</label>');
  if (state.hidden) targetRow = `<div style="display:none">${targetRow}</div>`;
  const neighbors = Object.values(probe.neighbors).filter((field) => field.controlTag === 'textarea')
    .map((field, index) => row(field.label, `<textarea data-neighbor="${index}" class="${field.controlClass}" placeholder="${esc(field.placeholder)}">KEEP_NEIGHBOR_${index}</textarea>`)).join('');
  const buttons = probe.page.forbiddenButtons.map((label) => `<button>${esc(label)}</button>`).join('');
  return `<!doctype html><body>${state.element ? '<div class="el-form"></div>' : ''}<div class="${state.noRoot ? 'other-root' : probe.page.rootClass}"><div class="${probe.page.contentClass}">${targetRow}${state.duplicate ? targetRow.replace('id="target"', 'id="copy"') : ''}${neighbors}${row(probe.neighbors.name.label, '<input id="name" class="ant-input" value="KEEP_NAME">')}${row(probe.neighbors.birth.label, `<input id="birth" class="${probe.neighbors.birth.controlClass}" readonly value="KEEP_DATE">`)}${row(probe.neighbors.obey.label, `<input id="radio" class="${probe.neighbors.obey.controlClass}" type="radio">`)}${row(probe.neighbors.research.label, `<input id="checkbox" class="${probe.neighbors.research.controlClass}" type="checkbox">`)}${row(probe.neighbors.photo.label, '<input id="file" type="file">')}${buttons}</div></div><div id="menu" class="${probe.menu.dropdownClass}"${state.busy ? '' : ' hidden'}><span>MENU_SENTINEL</span></div></body>`;
}

function boot(state = {}) {
  const dom = new JSDOM(markup(state), { url: state.url || PAGE, pretendToBeVisual: true, runScripts: 'dangerously' });
  const { window } = dom;
  const { document } = window;
  window.HTMLElement.prototype.getClientRects = function () {
    for (let node = this; node; node = node.parentElement) {
      if (node.hidden || window.getComputedStyle(node).display === 'none') return [];
    }
    return [{ width: 100, height: 20 }];
  };
  const stats = { clicks: 0, danger: 0, events: [], escapes: 0 };
  document.addEventListener('click', (event) => {
    stats.clicks += 1;
    if (event.target.closest('button, [type="submit"]')) stats.danger += 1;
  }, true);
  for (const type of ['input', 'change', 'blur']) document.addEventListener(type, (event) => {
    if (event.target.id !== 'target') return;
    stats.events.push(type);
    if (type === 'input' && state.revert) event.target.value = '';
    if (type === 'input' && state.stripNewlines) event.target.value = event.target.value.replace(/\n/gu, ' ');
    if (type === 'input' && state.replace) {
      const replacement = event.target.cloneNode();
      replacement.value = '';
      event.target.replaceWith(replacement);
    }
    if (type === 'input' && state.deferredReplace) window.queueMicrotask(() => {
      const replacement = event.target.cloneNode();
      replacement.value = '';
      event.target.replaceWith(replacement);
    });
    if (type === 'input' && state.deferredHidden) window.queueMicrotask(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    });
    if (type === 'input' && state.deferredNavigate) window.queueMicrotask(() => {
      dom.reconfigure({ url: PAGE.replace('/pb/', '/mc/') });
    });
  });
  document.addEventListener('focus', (event) => {
    if (event.target.id !== 'target') return;
    if (state.focusValue) event.target.value = state.focusValue;
    if (state.focusReplace) event.target.replaceWith(event.target.cloneNode());
    if (state.focusHidden) Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    if (state.focusNavigate) dom.reconfigure({ url: PAGE.replace('/pb/', '/mc/') });
    if (state.focusBusy) document.getElementById('menu').hidden = false;
  }, true);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      stats.escapes += 1;
      if (!state.ignoreEscape) document.getElementById('menu').hidden = true;
    }
  });
  if (state.hiddenPage) Object.defineProperty(document, 'visibilityState', { value: 'hidden' });
  window.eval(source);
  return { dom, document, window, stats, api: window[API] };
}

function safe(h, result) {
  for (const key of ['liveSupportClaimed', 'supportClaimed', 'saved', 'complete', 'softwareClickedSave', 'softwareClickedSubmit', 'softwareClickedDeliver', 'softwareClickedDelete', 'softwareClickedNext']) assert.equal(result[key], false, key);
  for (const key of ['neverSave', 'leftUnsaved', 'skippedSave']) assert.equal(result[key], true, key);
  for (const [index, node] of [...h.document.querySelectorAll('[data-neighbor]')].entries()) assert.equal(node.value, `KEEP_NEIGHBOR_${index}`);
  assert.equal(h.document.getElementById('name').value, 'KEEP_NAME');
  assert.equal(h.document.getElementById('birth').value, 'KEEP_DATE');
  assert.equal(h.document.getElementById('radio').checked, false);
  assert.equal(h.document.getElementById('checkbox').checked, false);
  assert.equal(h.document.getElementById('file').value, '');
  assert.equal(h.stats.clicks, 0);
  assert.equal(h.stats.danger, 0);
}

test(`${SLUG}: fixture retains the exact existing observed label/tag/class/placeholder`, () => {
  const key = 'majorNote';
  for (const document of [original, certs]) {
    for (const prop of ['label', 'controlClass', 'controlTag', 'placeholder']) assert.equal(probe.field[prop], document.neighbors[key][prop]);
  }
  assert.equal(probe.field.controlTag, 'textarea');
  assert.equal(probe.evidence.length, 2);
  assert.doesNotMatch(source, /\.click\(|chrome\.|fetch\(|localStorage|setAttribute\(/u);
});

test(`${SLUG}: inspect locates only the evidence-backed target`, () => {
  const h = boot();
  try {
    const result = h.api.inspect();
    assert.equal(result.ok, true);
    assert.equal(result.fields.length, 1);
    assert.equal(result.fields[0].label, LABEL);
    assert.equal(result.fields[0].kind, 'textarea');
    assert.equal(result.fields[0].supported, false);
    assert.equal(result.fields[0].value, '');
    safe(h, result);
  } finally { h.dom.window.close(); }
});

test(`${SLUG}: empty textarea paints only explicit caller prose and reads it back`, async () => {
  const h = boot();
  try {
    const result = await h.api.fillFields({ [LABEL]: `  ${CALLER}\u200b  `, 评价内容: 'MUST_NOT_FILL' });
    const field = result.fields[0];
    assert.equal(result.ok, true);
    assert.equal(field.reason, 'readback_matched');
    assert.equal(field.before, '');
    assert.equal(field.after, CALLER);
    assert.equal(field.expected, CALLER);
    assert.equal(h.document.getElementById('target').value, CALLER);
    assert.deepEqual(h.stats.events, ['input', 'change', 'blur']);
    safe(h, result);
    safe(h, field);
  } finally { h.dom.window.close(); }
});

for (const [value, wanted, reason, ok] of [
  ['KEEP_EXISTING', CALLER, 'existing_value', false],
  [' \n ', CALLER, 'existing_value', false],
  ['\u200b', CALLER, 'existing_value', false],
  [CALLER, CALLER, 'preexisting_same_value', true],
  ['First line Second line', 'First line\nSecond line', 'existing_value', false],
  ['Passed A B', 'Passed AB', 'existing_value', false],
  [`  ${CALLER}  `, CALLER, 'existing_value', false]
]) test(`${SLUG}: ${reason} preserves the original raw value`, async () => {
  const h = boot({ value });
  try {
    const result = await h.api.fillField(LABEL, wanted);
    assert.equal(result.ok, ok);
    assert.equal(result.reason, reason);
    assert.equal(result.after, value);
    assert.equal(h.document.getElementById('target').value, value);
    assert.deepEqual(h.stats.events, []);
    safe(h, result);
  } finally { h.dom.window.close(); }
});

for (const phase of ['before fill', 'focus', 'input', 'change', 'blur']) test(`${SLUG}: a row outside the PB wrapper during ${phase} cannot verify`, async () => {
  const h = boot();
  try {
    const target = h.document.getElementById('target');
    const moveOutside = () => h.document.body.append(target.closest('.ant-row.ant-form-item'));
    if (phase === 'before fill') moveOutside();
    else target.addEventListener(phase, moveOutside, { once: true });
    const result = await h.api.fillField(LABEL, CALLER);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'control_not_supported');
    assert.equal(target.closest(`.${probe.page.rootClass}`), null);
    const eventTypes = ['input', 'change', 'blur'];
    const eventIndex = eventTypes.indexOf(phase);
    assert.equal(target.value, eventIndex >= 0 ? CALLER : '');
    assert.deepEqual(h.stats.events, eventTypes.slice(0, eventIndex + 1));
    assert.equal(h.api.inspect().ok, false);
    safe(h, result);
  } finally { h.dom.window.close(); }
});

test(`${SLUG}: multiple PB wrappers refuse an otherwise matching target`, async () => {
  const h = boot();
  try {
    const second = h.document.createElement('div');
    second.className = probe.page.rootClass;
    h.document.body.append(second);
    const result = await h.api.fillField(LABEL, CALLER);
    assert.equal(result.reason, 'control_not_supported');
    assert.equal(h.document.getElementById('target').value, '');
    assert.deepEqual(h.stats.events, []);
    safe(h, result);
  } finally { h.dom.window.close(); }
});

test(`${SLUG}: caller CRLF and CR follow native textarea LF readback`, async () => {
  const h = boot();
  try {
    const result = await h.api.fillField(LABEL, 'First line\r\nSecond line\rThird line');
    assert.equal(result.ok, true);
    assert.equal(result.reason, 'readback_matched');
    assert.equal(result.after, 'First line\nSecond line\nThird line');
    assert.equal(result.after, result.expected);
    assert.equal(h.document.getElementById('target').value, result.expected);
    safe(h, result);
  } finally { h.dom.window.close(); }
});

for (const [state, reason] of [
  [{ focusValue: 'FOCUS_KEEP' }, 'existing_value'],
  [{ focusReplace: true }, 'control_not_supported'],
  [{ focusHidden: true }, 'fill_interrupted_page_hidden'],
  [{ focusNavigate: true }, 'wrong_page'],
  [{ focusBusy: true }, 'control_busy']
]) test(`${SLUG}: ${Object.keys(state)[0]} cannot cause a stale write after focus`, async () => {
  const h = boot(state);
  try {
    const result = await h.api.fillField(LABEL, CALLER);
    assert.equal(result.ok, false);
    assert.equal(result.reason, reason);
    assert.equal(h.document.getElementById('target').value, state.focusValue || '');
    assert.deepEqual(h.stats.events, []);
    safe(h, result);
  } finally { h.dom.window.close(); }
});

for (const [state, reason] of [
  [{ deferredHidden: true }, 'fill_interrupted_page_hidden'],
  [{ deferredNavigate: true }, 'wrong_page']
]) test(`${SLUG}: ${Object.keys(state)[0]} cannot verify a changed page after events`, async () => {
  const h = boot(state);
  try {
    const result = await h.api.fillField(LABEL, CALLER);
    assert.equal(result.ok, false);
    assert.equal(result.reason, reason);
    safe(h, result);
  } finally { h.dom.window.close(); }
});

for (const state of [{ revert: true }, { stripNewlines: true }, { replace: true }, { deferredReplace: true }]) {
  test(`${SLUG}: strict readback rejects ${Object.keys(state)[0]}`, async () => {
    const h = boot(state);
    try {
      const result = await h.api.fillField(LABEL, CALLER);
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'readback_mismatch');
      assert.notEqual(result.after, CALLER);
      safe(h, result);
    } finally { h.dom.window.close(); }
  });
}

for (const state of [{ duplicate: true }, { disabled: true }, { readonly: true }, { hidden: true }, { placeholder: 'DRIFT' }, { plain: true }, { extraArea: true }, { stray: true }, { badCaption: true }, { asInput: true }]) {
  test(`${SLUG}: ${Object.keys(state)[0]} fails closed before an event`, async () => {
    const h = boot(state);
    try {
      const result = await h.api.fillField(LABEL, CALLER);
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'control_not_supported');
      assert.deepEqual(h.stats.events, []);
      safe(h, result);
    } finally { h.dom.window.close(); }
  });
}

test(`${SLUG}: repeated identical captions on the same row retain one target`, async () => {
  const h = boot({ sameCaption: true });
  try {
    const result = await h.api.fillField(` ${LABEL}*：`, CALLER);
    assert.equal(result.ok, true);
    safe(h, result);
  } finally { h.dom.window.close(); }
});

test(`${SLUG}: absent or non-string caller data never invents text`, async () => {
  const h = boot();
  try {
    for (const value of [undefined, null, 7, {}, '', ' \n\u200b ']) {
      const result = await h.api.fillField(LABEL, value);
      assert.equal(result.reason, 'missing_profile_value');
      safe(h, result);
    }
    assert.deepEqual(h.stats.events, []);
  } finally { h.dom.window.close(); }
});

for (const state of [
  { url: PAGE.replace('/pb/', '/mc/') }, { url: PAGE.replace('https:', 'http:') },
  { url: PAGE.replace('wecruit.hotjob.cn', 'example.invalid') }, { noRoot: true }, { element: true }
]) test(`${SLUG}: rejects foreign page ${JSON.stringify(state)}`, async () => {
  const h = boot(state);
  try {
    const result = await h.api.fillField(LABEL, CALLER);
    assert.equal(result.reason, 'wrong_page');
    assert.deepEqual(h.stats.events, []);
    safe(h, result);
  } finally { h.dom.window.close(); }
});

test(`${SLUG}: hidden pages, other labels, and open menus do not receive text`, async () => {
  for (const [state, label, reason] of [[{ hiddenPage: true }, LABEL, 'fill_interrupted_page_hidden'], [{}, '工作描述', 'label_not_allowed'], [{ busy: true }, LABEL, 'control_busy']]) {
    const h = boot(state);
    try {
      const result = await h.api.fillField(label, CALLER);
      assert.equal(result.reason, reason);
      assert.deepEqual(h.stats.events, []);
      safe(h, result);
    } finally { h.dom.window.close(); }
  }
});

test(`${SLUG}: cancellation leaves raw text unsaved and closes an existing menu by Escape`, async () => {
  const h = boot({ value: CALLER, busy: true });
  try {
    const result = await h.api.cancelField(LABEL);
    assert.equal(result.ok, true);
    assert.equal(result.reason, 'left_unsaved');
    assert.equal(result.before, CALLER);
    assert.equal(result.after, CALLER);
    assert.equal(result.stillOpen, 0);
    assert.equal(result.canceled, true);
    assert.ok(h.stats.escapes > 0);
    assert.deepEqual(h.stats.events, []);
    safe(h, result);
  } finally { h.dom.window.close(); }
});

test(`${SLUG}: ignored Escape reports menu cleanup failure without a click`, async () => {
  const h = boot({ value: CALLER, busy: true, ignoreEscape: true });
  try {
    const result = await h.api.cancelField(LABEL);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'menu_cleanup_failed');
    assert.equal(result.stillOpen, 1);
    assert.equal(result.after, CALLER);
    safe(h, result);
  } finally { h.dom.window.close(); }
});


test('major description: existing normalized profile data fills only its confirmed selected index', async () => {
  const h = boot();
  try {
    const profile = normalizeProfile({ education: [{ majorDescription: 'DO_NOT_CHOOSE_FIRST' }, { majorDescription: CALLER }], confirmedFields: ['education.1.majorDescription'] });
    const result = await h.api.fillProfile(profile, 1);
    assert.equal(result.ok, true);
    assert.equal(result.path, 'education.1.majorDescription');
    assert.equal(result.after, CALLER);
    safe(h, result);
  } finally { h.dom.window.close(); }
});

test('major description: missing/unconfirmed descriptions and invalid indices are refused', async () => {
  const h = boot();
  try {
    const missing = await h.api.fillProfile(normalizeProfile({ education: [{ major: 'MUST_NOT_INFER' }], confirmedFields: ['education.0.major'] }));
    assert.equal(missing.reason, 'missing_profile_value');
    const unconfirmed = await h.api.fillProfile(normalizeProfile({ education: [{ majorDescription: CALLER }] }));
    assert.equal(unconfirmed.reason, 'unconfirmed_profile_value');
    for (const index of [-1, 0.5, 30, '0']) {
      const result = await h.api.fillProfile({}, index);
      assert.equal(result.reason, 'invalid_profile_index');
      safe(h, result);
    }
    assert.deepEqual(h.stats.events, []);
    safe(h, missing);
    safe(h, unconfirmed);
  } finally { h.dom.window.close(); }
});
