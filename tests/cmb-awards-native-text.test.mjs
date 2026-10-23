// The field fixture is a verbatim metadata subset of the live read-only census.
// Tests reconstruct only observed native controls. Negative scenarios are
// deliberately synthetic guard mutations, not additional live DOM evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const probe = JSON.parse(readFileSync(new URL('./fixtures/cmb-awards-native-text-probe-dom.json', import.meta.url), 'utf8'));
const census = JSON.parse(readFileSync(new URL('../dist/site-probes/cmb-remaining-dom-ids-20261019.json', import.meta.url), 'utf8'));
const source = readFileSync(new URL('../src/content/cmb-awards-native-text.js', import.meta.url), 'utf8');
const values = () => Object.fromEntries(probe.fields.map((field, index) =>
  [field.id, field.tag === 'textarea' ? 'Confirmed text ' + index + '\nSecond line' : 'Confirmed text ' + index]));
const profile = () => ({ values: values(), confirmedFields: probe.fields.map(field => field.id) });

function boot(url = probe.url) {
  const dom = new JSDOM('<!doctype html><body></body>', { url, pretendToBeVisual: true, runScripts: 'outside-only' });
  const { window } = dom, { document } = window;
  Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });
  window.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  const counts = { clicks: 0, requests: 0, submits: 0 }, events = [];
  window.HTMLElement.prototype.click = () => { counts.clicks++; throw Error('Unexpected click'); };
  window.HTMLFormElement.prototype.submit = window.HTMLFormElement.prototype.requestSubmit = () => {
    counts.submits++; throw Error('Unexpected submission');
  };
  window.fetch = () => { counts.requests++; throw Error('Unexpected request'); };
  window.XMLHttpRequest.prototype.open = () => { counts.requests++; throw Error('Unexpected request'); };
  for (const field of [...probe.fields, ...probe.neighbors]) {
    const node = document.createElement(field.tag);
    for (const [key, attr] of [['id', 'id'], ['name', 'name'], ['type', 'type'],
      ['role', 'role'], ['className', 'class'], ['placeholder', 'placeholder'],
      ['ariaControls', 'aria-controls'], ['ariaLabel', 'aria-label']]) {
      if (field[key] !== null) node.setAttribute(attr, field[key]);
    }
    if (probe.neighbors.includes(field)) node.value = 'keep neighbor';
    for (const name of ['input', 'change', 'blur']) node.addEventListener(name, () => events.push([node.id, name]));
    document.body.append(node);
  }
  window.eval(source);
  const api = window.ResumeCmbAwardsNativeText;
  return { dom, window, document, api, counts, events, node: id => document.getElementById(id) };
}
function safe(result, p) {
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.supportClaimed, false);
  assert.equal(result.complete, false);
  assert.equal(result.neverSave, true);
  for (const key of ['softwareClickedSave', 'softwareClickedSubmit', 'softwareClickedDeliver',
    'softwareClickedDelete', 'softwareClickedNext', 'saved', 'submitted']) assert.equal(result[key], false, key);
  assert.deepEqual(p.counts, { clicks: 0, requests: 0, submits: 0 });
  for (const field of probe.neighbors) assert.equal(p.node(field.id).value, 'keep neighbor');
}

test('awards: fixture metadata comes verbatim from the live census', () => {
  assert.equal(probe.sourceCommit, '3fd7a99d7044230f5210b8fa146dba5b67378cac');
  assert.equal(probe.url, census.url);
  for (const field of [...probe.fields, ...probe.neighbors])
    assert.deepEqual(field, census.fields.find(row => row.id === field.id));
  assert.ok(probe.fields.every(field => field.labelText && field.className.includes('ant-input')
    && (field.tag === 'textarea' || field.type === 'text')));
});

test('awards: fills every observed empty control, preserves text, and emits native events without clicks', async () => {
  const p = boot();
  try {
    const requested = profile(), result = await p.api.fillProfile(requested);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.writeAttempted, true);
    assert.equal(result.fields.length, probe.fields.length);
    for (const field of probe.fields) {
      assert.equal(p.node(field.id).value, requested.values[field.id]);
      const row = result.fields.find(item => item.id === field.id);
      assert.equal(row.status, 'verified');
      assert.equal(row.reason, 'readback_matched');
      assert.deepEqual(p.events.filter(([id]) => id === field.id).map(([, event]) => event), ['input', 'change', 'blur']);
    }
    safe(result, p);
  } finally { p.dom.window.close(); }
});

test('awards: invalid preexisting matches are not reported as verified', async () => {
  const p = boot();
  try {
    const id = probe.fields[0].id, node = p.node(id);
    node.value = 'Confirmed preexisting';
    node.setCustomValidity('site invalid');
    const result = await p.api.fillField(id, node.value, { confirmed: true });
    assert.equal(result.reason, 'site_validation_failed');
    assert.equal(result.field.status, 'failed');
    assert.equal(result.writeAttempted, false);
    assert.deepEqual(p.events, []);
    safe(result, p);
  } finally { p.dom.window.close(); }
});

test('awards: navigation and page hiding during site events stop later actions', async () => {
  for (const mode of ['navigation', 'hidden']) {
    const p = boot();
    try {
      const id = probe.fields[0].id;
      p.node(id).addEventListener('input', () => {
        if (mode === 'navigation') p.dom.reconfigure({ url: 'https://career.cmbchina.com/center/other' });
        else Object.defineProperty(p.document, 'visibilityState', { configurable: true, value: 'hidden' });
      });
      const result = await p.api.fillProfile(profile());
      assert.equal(result.reason, mode === 'navigation' ? 'wrong_page' : 'page_hidden');
      assert.equal(result.fields[0].status, 'failed');
      assert.deepEqual(p.events.map(([, name]) => name), ['input']);
      for (const field of probe.fields.slice(1)) assert.equal(p.node(field.id).value, '');
      safe(result, p);
    } finally { p.dom.window.close(); }
  }
});

test('awards: existing different values are preserved with no events', async () => {
  const p = boot();
  try {
    for (const field of probe.fields) p.node(field.id).value = 'existing user value';
    const result = await p.api.fillProfile(profile());
    assert.equal(result.ok, false);
    assert.equal(result.writeAttempted, false);
    assert.ok(result.fields.every(row => row.reason === 'existing_value' && row.status === 'skipped'));
    for (const field of probe.fields) assert.equal(p.node(field.id).value, 'existing user value');
    assert.deepEqual(p.events, []);
    safe(result, p);
  } finally { p.dom.window.close(); }
});

test('awards: preexisting matches are read back without rewriting', async () => {
  const p = boot();
  try {
    const requested = profile();
    for (const field of probe.fields) p.node(field.id).value = requested.values[field.id];
    const result = await p.api.fillFields(requested.values, { confirmedFields: requested.confirmedFields });
    assert.equal(result.ok, true);
    assert.equal(result.writeAttempted, false);
    assert.ok(result.fields.every(row => row.reason === 'preexisting_same_value'));
    assert.deepEqual(p.events, []);
    safe(result, p);
  } finally { p.dom.window.close(); }
});

test('awards: a kept first field never blocks independent empty fields or causes overwrite', async () => {
  const p = boot();
  try {
    const first = probe.fields[0];
    p.node(first.id).value = 'keep existing';
    const result = await p.api.fillProfile(profile());
    assert.equal(p.node(first.id).value, 'keep existing');
    assert.equal(result.fields[0].reason, 'existing_value');
    for (const field of probe.fields.slice(1)) {
      assert.equal(p.node(field.id).value, values()[field.id]);
      assert.equal(result.fields.find(row => row.id === field.id).reason, 'readback_matched');
    }
    safe(result, p);
  } finally { p.dom.window.close(); }
});

test('awards: single-field API requires explicit confirmation and never infers another row', async () => {
  const p = boot();
  try {
    const id = probe.fields[0].id;
    const refused = await p.api.fillField(id, 'Confirmed single');
    assert.equal(refused.reason, 'profile_fact_unconfirmed');
    assert.equal(refused.writeAttempted, false);
    const result = await p.api.fillField(id, 'Confirmed single', { confirmed: true });
    assert.equal(result.field.id, id);
    assert.equal(result.field.status, 'verified');
    for (const field of probe.fields.slice(1)) assert.equal(p.node(field.id).value, '');
    safe(result, p);
  } finally { p.dom.window.close(); }
});

test('awards: invalid plans and unsupported IDs fail before all writes', async () => {
  const p = boot();
  try {
    const first = probe.fields[0].id;
    for (const requested of [
      { values: { [first]: 'unconfirmed' }, confirmedFields: [] },
      { values: { [first]: 42 }, confirmedFields: [first] },
      { values: { [first]: ' ' }, confirmedFields: [first] },
      { values: { [first]: 'bad\u0000text' }, confirmedFields: [first] },
      { values: { ...values(), resume_unknown: 'no' }, confirmedFields: [...profile().confirmedFields, 'resume_unknown'] }
    ]) {
      const result = await p.api.fillProfile(requested);
      assert.equal(result.ok, false);
      assert.equal(result.writeAttempted, false);
      assert.ok(probe.fields.every(field => p.node(field.id).value === ''));
      safe(result, p);
    }
    for (const field of probe.fields.filter(row => row.tag === 'input')) {
      const result = await p.api.fillField(field.id, 'line one\nline two', { confirmed: true });
      assert.equal(result.reason, 'invalid_profile_value');
      assert.equal(result.writeAttempted, false);
    }
    assert.deepEqual(p.events, []);
  } finally { p.dom.window.close(); }
});

test('awards: unknown later target fails preflight before an earlier valid target is written', async () => {
  const p = boot();
  try {
    p.node(probe.fields.at(-1).id).remove();
    const result = await p.api.fillProfile(profile());
    assert.equal(result.reason, 'target_missing');
    assert.equal(result.writeAttempted, false);
    for (const field of probe.fields.slice(0, -1)) assert.equal(p.node(field.id).value, '');
    safe(result, p);
  } finally { p.dom.window.close(); }
});

test('awards: ambiguity, disabled state, readonly, hidden state, and DOM drift fail closed', async () => {
  const mutations = [
    node => node.after(node.cloneNode()),
    node => { node.disabled = true; },
    node => { node.readOnly = true; },
    node => { node.hidden = true; },
    node => { node.style.display = 'none'; },
    node => { node.setAttribute('aria-disabled', 'true'); },
    node => { node.classList.remove('ant-input'); },
    node => { node.setAttribute('role', 'combobox'); },
    node => { node.setAttribute('placeholder', 'drift'); },
    node => { node.setAttribute('form', 'foreign'); },
    node => { const fieldset = node.ownerDocument.createElement('fieldset'); fieldset.disabled = true; node.replaceWith(fieldset); fieldset.append(node); }
  ];
  for (const mutate of mutations) {
    const p = boot();
    try {
      mutate(p.node(probe.fields[0].id));
      const result = await p.api.fillProfile(profile());
      assert.equal(result.ok, false);
      assert.equal(result.writeAttempted, false);
      assert.deepEqual(p.events, []);
      safe(result, p);
    } finally { p.dom.window.close(); }
  }
});

test('awards: native setter bypasses an instance setter and success validation class is optional', async () => {
  const p = boot();
  try {
    const id = probe.fields[0].id, node = p.node(id);
    node.classList.remove('ant-input-status-success');
    let ownSetterCalls = 0;
    Object.defineProperty(node, 'value', {
      configurable: true,
      get() { const prototype = node.tagName === 'TEXTAREA' ? p.window.HTMLTextAreaElement.prototype : p.window.HTMLInputElement.prototype;
        return Object.getOwnPropertyDescriptor(prototype, 'value').get.call(node); },
      set() { ownSetterCalls++; }
    });
    const result = await p.api.fillField(id, 'Confirmed native', { confirmed: true });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(node.value, 'Confirmed native');
    assert.equal(ownSetterCalls, 0);
    safe(result, p);
  } finally { p.dom.window.close(); }
});

test('awards: asynchronous site readback rejection is failed, never verified', async () => {
  const p = boot();
  try {
    const id = probe.fields[0].id, node = p.node(id);
    node.addEventListener('change', () => p.window.setTimeout(() => { node.value = 'site rejected'; }, 0));
    const result = await p.api.fillField(id, 'Confirmed readback', { confirmed: true });
    assert.equal(result.reason, 'readback_mismatch');
    assert.equal(result.field.status, 'failed');
    assert.equal(result.writeAttempted, true);
    safe(result, p);
  } finally { p.dom.window.close(); }
});

test('awards: a neighboring control change stops the remaining plan', async () => {
  const p = boot();
  try {
    const id = probe.fields[0].id;
    p.node(id).addEventListener('input', () => { p.node(probe.neighbors[0].id).value = 'site side effect'; });
    const result = await p.api.fillProfile(profile());
    assert.equal(result.reason, 'neighbor_changed');
    assert.equal(result.fields[0].status, 'failed');
    for (const field of probe.fields.slice(1)) assert.equal(p.node(field.id).value, '');
    assert.deepEqual(p.counts, { clicks: 0, requests: 0, submits: 0 });
    assert.equal(result.liveSupportClaimed, false);
    assert.equal(result.softwareClickedSave, false);
  } finally { p.dom.window.close(); }
});

test('awards: control replacement during an input event fails identity readback', async () => {
  const p = boot();
  try {
    const id = probe.fields[0].id, node = p.node(id);
    node.addEventListener('input', () => node.replaceWith(node.cloneNode()));
    const result = await p.api.fillField(id, 'Confirmed identity', { confirmed: true });
    assert.equal(result.reason, 'target_changed');
    assert.equal(result.field.status, 'failed');
    safe(result, p);
  } finally { p.dom.window.close(); }
});

test('awards: runtime maxlength and native validity are enforced', async () => {
  for (const mode of ['maxLength', 'validity']) {
    const p = boot();
    try {
      const id = probe.fields[0].id, node = p.node(id);
      if (mode === 'maxLength') node.maxLength = 2;
      else node.setCustomValidity('site refuses this value');
      const result = await p.api.fillField(id, 'Confirmed validation', { confirmed: true });
      assert.equal(result.reason, mode === 'maxLength' ? 'value_too_long' : 'site_validation_failed');
      assert.equal(result.field.status, 'failed');
      if (mode === 'maxLength') assert.equal(result.writeAttempted, false);
      safe(result, p);
    } finally { p.dom.window.close(); }
  }
});

test('awards: page identity, visibility, and readiness are checked before writing', async () => {
  for (const mode of ['host', 'path', 'query', 'hidden', 'loading']) {
    const p = boot(mode === 'host' ? 'https://example.com/center/resume'
      : mode === 'path' ? 'https://career.cmbchina.com/center/other'
        : mode === 'query' ? probe.url + '?other=1' : probe.url);
    try {
      if (mode === 'hidden') Object.defineProperty(p.document, 'visibilityState', { configurable: true, value: 'hidden' });
      if (mode === 'loading') Object.defineProperty(p.document, 'readyState', { configurable: true, value: 'loading' });
      const result = await p.api.fillProfile(profile());
      assert.equal(result.ok, false);
      assert.equal(result.writeAttempted, false);
      assert.deepEqual(p.events, []);
      safe(result, p);
    } finally { p.dom.window.close(); }
  }
});

test('awards: concurrent calls fail closed while a field is settling', async () => {
  const p = boot();
  try {
    const id = probe.fields[0].id;
    const first = p.api.fillField(id, 'First confirmed', { confirmed: true });
    const second = await p.api.fillField(id, 'Second confirmed', { confirmed: true });
    assert.equal(second.reason, 'fill_busy');
    assert.equal(second.writeAttempted, false);
    const result = await first;
    assert.equal(result.ok, true);
    assert.equal(p.node(id).value, 'First confirmed');
    safe(result, p);
  } finally { p.dom.window.close(); }
});
