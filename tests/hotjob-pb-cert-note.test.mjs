// Offline trial only. DOM comes from the cited, existing probe fixture.
// Text values are synthetic caller facts and are never advertised as live evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { normalizeProfile } from '../src/profile/store.js';

const SLUG = 'cert-note';
const API = 'ResumeHotjobPbCertNote';
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
  if (state.outsideRoot) document.body.append(document.getElementById('target').closest('.ant-row.ant-form-item'));
  if (state.multipleRoots) document.body.append(document.querySelector('.resume-operation-wrap').cloneNode());
  if (state.externalDuplicate) {
    const external = document.getElementById('target').closest('.ant-row.ant-form-item').cloneNode(true);
    external.querySelector('textarea').id = 'external';
    external.querySelector('textarea').value = 'KEEP_EXTERNAL';
    document.body.append(external);
  }
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
    if (type === 'input' && state.inputReparent) {
      document.body.append(event.target.closest('.ant-row.ant-form-item'));
      event.target.value = 'KEEP_REPARENTED';
    }
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
    if (state.focusReparent) document.body.append(event.target.closest('.ant-row.ant-form-item'));
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
  const key = 'certNote';
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
  ['  Explicit caller fact\nSecond line keeps spaces  ', CALLER, 'existing_value', false],
  [CALLER.replace('\n', ' '), CALLER, 'existing_value', false],
  ['Passed A B', 'Passed AB', 'existing_value', false],
  [CALLER, CALLER, 'preexisting_same_value', true]
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

for (const newline of ['\r\n', '\r']) test(`${SLUG}: caller ${JSON.stringify(newline)} line endings match textarea LF readback`, async () => {
  const h = boot();
  try {
    const result = await h.api.fillField(LABEL, CALLER.replace('\n', newline));
    assert.equal(result.ok, true);
    assert.equal(result.reason, 'readback_matched');
    assert.equal(result.expected, CALLER);
    assert.equal(result.after, CALLER);
    assert.equal(h.document.getElementById('target').value, CALLER);
    safe(h, result);
  } finally { h.dom.window.close(); }
});

for (const state of [{ outsideRoot: true }, { multipleRoots: true }]) {
  test(`${SLUG}: ${Object.keys(state)[0]} cannot receive text or events`, async () => {
    const h = boot(state);
    try {
      const result = await h.api.fillField(LABEL, CALLER);
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'control_not_supported');
      assert.equal(h.document.getElementById('target').value, '');
      assert.deepEqual(h.stats.events, []);
      safe(h, result);
    } finally { h.dom.window.close(); }
  });
}

test(`${SLUG}: an external matching row remains unchanged while the owned target fills`, async () => {
  const h = boot({ externalDuplicate: true });
  try {
    const result = await h.api.fillField(LABEL, CALLER);
    assert.equal(result.ok, true);
    assert.equal(h.document.getElementById('target').value, CALLER);
    assert.equal(h.document.getElementById('external').value, 'KEEP_EXTERNAL');
    safe(h, result);
  } finally { h.dom.window.close(); }
});

for (const [state, reason] of [
  [{ focusValue: 'FOCUS_KEEP' }, 'existing_value'],
  [{ focusReplace: true }, 'control_not_supported'],
  [{ focusReparent: true }, 'control_not_supported'],
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

test(`${SLUG}: input-time reparenting stops later events and cannot verify an external row`, async () => {
  const h = boot({ inputReparent: true });
  try {
    const result = await h.api.fillField(LABEL, CALLER);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'control_not_supported');
    const target = h.document.getElementById('target');
    assert.equal(target.closest('.resume-operation-wrap'), null);
    assert.equal(target.value, 'KEEP_REPARENTED');
    assert.deepEqual(h.stats.events, ['input']);
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


test('passed-subject note: normalized confirmed exact custom answer is used without schema additions', async () => {
  const h = boot();
  try {
    const path = 'customAnswers.' + LABEL;
    const profile = normalizeProfile({ customAnswers: { [LABEL]: CALLER }, confirmedFields: [path] });
    assert.equal(profile.customAnswers[LABEL], CALLER);
    assert.ok(profile.confirmedFields.includes(path));
    const result = await h.api.fillProfile(profile);
    assert.equal(result.ok, true);
    assert.equal(result.path, path);
    assert.equal(result.after, CALLER);
    safe(h, result);
  } finally { h.dom.window.close(); }
});

test('passed-subject note: missing, unconfirmed, ambiguous, and other-page facts are refused', async () => {
  const h = boot();
  try {
    const path = 'customAnswers.' + LABEL;
    const base = { customAnswers: { [LABEL]: CALLER }, confirmedFields: [path] };
    const cases = [
      [{ customAnswers: { OTHER_QUESTION: CALLER }, confirmedFields: [path] }, 'missing_profile_value'],
      [{ ...base, confirmedFields: [] }, 'unconfirmed_profile_value'],
      [{ ...base, customFacts: [{ question: LABEL, answer: 'FIRST' }, { question: LABEL, answer: 'SECOND' }] }, 'ambiguous_profile_value'],
      [{ ...base, customFacts: [{ question: LABEL, answer: 'CONTRADICTORY_FACT' }] }, 'conflicting_profile_value'],
      [{ ...base, customFacts: [{ question: LABEL, answer: CALLER, sitePageUrl: PAGE.replace('SU629dbc0c0dcad452299bc0f7', 'SU000000000000000000000000') }] }, 'profile_scope_mismatch'],
      [{ ...base, customFacts: [{ question: LABEL, answer: CALLER, sitePageUrl: 'bad-url' }] }, 'profile_scope_mismatch']
    ];
    for (const [profile, reason] of cases) {
      const result = await h.api.fillProfile(profile);
      assert.equal(result.reason, reason);
      assert.equal(result.path, path);
      safe(h, result);
    }
    assert.deepEqual(h.stats.events, []);
  } finally { h.dom.window.close(); }
});
