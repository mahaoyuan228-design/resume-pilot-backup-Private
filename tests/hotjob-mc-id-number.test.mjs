// Offline tests; no browser, network, save, or live-support claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../src/content/hotjob-mc-id-number.js', import.meta.url), 'utf8');
const baseFixture = readFileSync(new URL('./fixtures/hotjob-mc-basic-form.html', import.meta.url), 'utf8');
const fixture = readFileSync(new URL('./fixtures/hotjob-mc-id-number-form.html', import.meta.url), 'utf8');
const raw = JSON.parse(readFileSync(new URL('../dist/site-probes/HOTJOB_MC_OPERATIONRESUMER_raw.json', import.meta.url), 'utf8'));
const PAGE = 'https://wecruit.hotjob.cn/SU661f37091eb8053acd6cdf3d/mc/deliver/operationResumer';
const LABEL = '证件号码';
const VALUE = 'SYNTHETIC-ID-001';

function boot({ url = PAGE, empty = true, mutate } = {}) {
  const dom = new JSDOM(fixture, { url, pretendToBeVisual: true, runScripts: 'outside-only' });
  const { window } = dom;
  window.Element.prototype.getClientRects = function getClientRects() {
    return this.isConnected ? [{ x: 0, y: 0, width: 10, height: 10 }] : [];
  };
  const input = window.document.querySelector('[id="29_ref"] .am-input-control input');
  if (empty) input.value = '';
  if (mutate) mutate(window.document, input, window);
  const stats = { clicks: 0, input: 0, change: 0, blur: 0, focus: 0 };
  window.document.addEventListener('click', () => { stats.clicks += 1; }, true);
  for (const type of ['input', 'change', 'blur', 'focus']) {
    input.addEventListener(type, () => { stats[type] += 1; });
  }
  window.eval(source);
  return { dom, window, document: window.document, input, api: window.ResumeHotjobMcIdNumber, stats };
}

function assertFlags(result) {
  assert.equal(result.siteId, 'hotjob-mc');
  assert.equal(result.saved, false);
  assert.equal(result.skippedSave, true);
  assert.equal(result.saveClicks, 0);
  assert.equal(result.neverSave, true);
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.supportClaimed, false);
  for (const key of ['Next', 'Save', 'Submit', 'Deliver', 'Delete']) assert.equal(result[`softwareClicked${key}`], false);
  assert.equal(result.note, '待真机 Never-Save，未宣称已支持');
}

function neighborSnapshot(document) {
  return [...document.querySelectorAll('input, .select-am-list-extra')]
    .filter((node) => !node.closest('[id="29_ref"]'))
    .map((node) => ({ value: node.matches('input') ? node.value : node.textContent, checked: node.checked ?? null }));
}

test('fixture preserves the exact existing DOM and documented raw-probe provenance', () => {
  const baseline = new JSDOM(baseFixture);
  const subset = new JSDOM(fixture);
  const ids = ['2_ref', '20_ref', '28_ref', '29_ref', '36_ref', '37_ref'];
  assert.equal(subset.window.document.querySelectorAll('.my-list-item').length, ids.length);
  for (const id of ids) {
    assert.equal(subset.window.document.getElementById(id).outerHTML, baseline.window.document.getElementById(id).outerHTML);
  }
  assert.ok(raw.probe.placeholders.includes('请填写证件号码'));
  assert.match(source, /item\.id !== '29_ref'/);
  assert.doesNotMatch(source, /\.click\s*\(|dispatchEvent\(new MouseEvent|\.submit\s*\(|requestSubmit\s*\(/u);
  baseline.window.close();
  subset.window.close();
});

test('fills only the empty id-number control with readback and unchanged neighbors', async () => {
  const { api, input, document, stats, dom } = boot();
  const before = neighborSnapshot(document);
  const result = await api.fillField(LABEL, VALUE);
  assertFlags(result);
  assert.equal(result.ok, true);
  assert.equal(result.reason, 'readback_matched');
  assert.equal(result.status, 'verified');
  assert.equal(result.before, '');
  assert.equal(result.after, VALUE);
  assert.equal(result.expected, VALUE);
  assert.equal(result.writeAttempted, true);
  assert.equal(result.neighborsUnchanged, true);
  assert.equal(input.value, VALUE);
  assert.deepEqual(neighborSnapshot(document), before);
  assert.deepEqual(stats, { clicks: 0, input: 1, change: 1, blur: 1, focus: 1 });
  dom.window.close();
});

test('existing values including whitespace are preserved without focus or write events', async () => {
  for (const value of ['NEIGHBOR_KEEP', ' ', VALUE]) {
    const { api, input, stats, dom } = boot();
    input.value = value;
    const result = await api.fillField(LABEL, VALUE);
    assertFlags(result);
    assert.equal(result.ok, value === VALUE);
    assert.equal(result.reason, value === VALUE ? 'preexisting_same_value' : 'existing_value');
    assert.equal(result.writeAttempted, false);
    assert.equal(input.value, value);
    assert.deepEqual(stats, { clicks: 0, input: 0, change: 0, blur: 0, focus: 0 });
    dom.window.close();
  }
});

test('confirmed canonical identityNumber profile fact fills; missing and unconfirmed facts refuse', async () => {
  const { api, input, stats, dom } = boot();
  for (const [profile, reason] of [
    [null, 'profile_missing'],
    [[], 'profile_missing'],
    [{ identityNumber: VALUE }, 'profile_fact_unconfirmed'],
    [{ identityNumber: VALUE, confirmedFields: ['idNumber'] }, 'profile_fact_unconfirmed'],
    [{ identityNumber: '', confirmedFields: ['identityNumber'] }, 'missing_profile_value'],
    [{ identityNumber: 12345, confirmedFields: ['identityNumber'] }, 'missing_profile_value'],
    [{ idNumber: VALUE, confirmedFields: ['identityNumber'] }, 'missing_profile_value']
  ]) {
    const result = await api.fillProfile(profile);
    assertFlags(result);
    assert.equal(result.ok, false);
    assert.equal(result.reason, reason);
    assert.equal(result.writeAttempted, false);
    assert.equal(input.value, '');
  }
  assert.equal(stats.focus, 0);
  const filled = await api.fillProfile({ identityNumber: VALUE, confirmedFields: ['identityNumber'] });
  assertFlags(filled);
  assert.equal(filled.ok, true);
  assert.equal(filled.path, 'identityNumber');
  assert.equal(input.value, VALUE);
  assert.equal(stats.clicks, 0);
  dom.window.close();
});

test('unknown labels and empty or non-string explicit values fail before any write', async () => {
  const { api, input, stats, dom } = boot();
  for (const [label, value, reason] of [
    ['姓名', VALUE, 'label_not_allowed'],
    ['identityNumber', VALUE, 'label_not_allowed'],
    [LABEL, '', 'empty_value'],
    [LABEL, ' \t ', 'empty_value'],
    [LABEL, 12345, 'empty_value'],
    [LABEL, null, 'empty_value']
  ]) {
    const result = await api.fillField(label, value);
    assertFlags(result);
    assert.equal(result.ok, false);
    assert.equal(result.reason, reason);
    assert.equal(result.writeAttempted, false);
    assert.equal(input.value, '');
  }
  assert.deepEqual(stats, { clicks: 0, input: 0, change: 0, blur: 0, focus: 0 });
  dom.window.close();
});

test('pb, wrong host, insecure protocol, route drift, and unreadied shells refuse', async () => {
  for (const options of [
    { url: PAGE.replace('/mc/deliver/operationResumer', '/pb/resumeOperation.html') },
    { url: PAGE.replace('wecruit.hotjob.cn', 'wecruit.hotjob.cn.example.org') },
    { url: PAGE.replace('https:', 'http:') },
    { url: `${PAGE}/` },
    { mutate(document) { document.querySelector('.resume-info-title').textContent = '教育经历'; } },
    { mutate(document) { document.querySelector('.resume-info-title').remove(); } },
    { mutate(document) { document.querySelector('.resume-info-title').hidden = true; } },
    { mutate(document) { document.body.appendChild(document.createElement('div')).className = 'ant-form-item'; } },
    { mutate(document, input, window) { Object.defineProperty(window.document, 'visibilityState', { value: 'hidden' }); } }
  ]) {
    const { api, input, stats, dom } = boot(options);
    const result = await api.fillField(LABEL, VALUE);
    assertFlags(result);
    assert.equal(result.ok, false);
    assert.ok(['wrong_page', 'page_hidden'].includes(result.reason));
    assert.equal(result.writeAttempted, false);
    assert.equal(input.value, '');
    assert.equal(stats.focus, 0);
    assert.equal(stats.clicks, 0);
    dom.window.close();
  }
});

test('ambiguous, missing, hidden, readonly, wrong placeholder, and changed controls fail closed', async () => {
  const mutations = [
    (document, input) => input.closest('.my-list-item').after(input.closest('.my-list-item').cloneNode(true)),
    (document, input) => input.closest('.my-list-item').remove(),
    (document, input) => { input.id = 'changed'; input.closest('.my-list-item').id = 'changed'; },
    (document, input) => { input.placeholder = '证件号码'; },
    (document, input) => { input.removeAttribute('type'); },
    (document, input) => { input.type = 'number'; },
    (document, input) => { input.readOnly = true; },
    (document, input) => { input.disabled = true; },
    (document, input) => { input.hidden = true; },
    (document, input) => { input.parentElement.style.display = 'none'; },
    (document, input) => { input.parentElement.style.visibility = 'hidden'; },
    (document, input) => { input.parentElement.className = 'plain-input'; },
    (document, input) => input.closest('.my-list-item').appendChild(document.createElement('input')),
    (document, input) => input.closest('.my-list-item').appendChild(document.createElement('textarea')),
    (document, input) => input.closest('.my-list-item').appendChild(document.querySelector('[id="29_ref"] .header-title').cloneNode(true)),
    (document, input) => { input.remove(); }
  ];
  for (const mutate of mutations) {
    const { api, input, stats, dom } = boot({ mutate });
    const result = await api.fillField(LABEL, VALUE);
    assertFlags(result);
    assert.equal(result.ok, false, mutate.toString());
    assert.ok(['field_ambiguous', 'field_missing', 'control_drift'].includes(result.reason), result.reason);
    assert.equal(result.writeAttempted, false);
    assert.equal(input.value, '');
    assert.equal(stats.focus, 0);
    assert.equal(stats.clicks, 0);
    dom.window.close();
  }
});

test('focus-time values are preserved and concurrent calls refuse', async () => {
  const focusCase = boot();
  focusCase.input.addEventListener('focus', () => { focusCase.input.value = 'FOCUS_KEEP'; });
  const changed = await focusCase.api.fillField(LABEL, VALUE);
  assertFlags(changed);
  assert.equal(changed.reason, 'control_changed_before_write');
  assert.equal(changed.writeAttempted, false);
  assert.equal(focusCase.input.value, 'FOCUS_KEEP');
  assert.equal(focusCase.stats.input, 0);
  focusCase.dom.window.close();

  const concurrent = boot();
  const first = concurrent.api.fillField(LABEL, VALUE);
  const second = await concurrent.api.fillField(LABEL, 'SYNTHETIC-ID-002');
  assertFlags(second);
  assert.equal(second.reason, 'control_busy');
  assert.equal(second.writeAttempted, false);
  assert.equal((await first).ok, true);
  assert.equal(concurrent.input.value, VALUE);
  assert.equal(concurrent.stats.input, 1);
  concurrent.dom.window.close();
});

test('controlled readback mismatch and changed neighbor are reported as failures', async () => {
  const mismatch = boot();
  mismatch.input.addEventListener('change', () => { mismatch.input.value = ''; });
  const failed = await mismatch.api.fillField(LABEL, VALUE);
  assertFlags(failed);
  assert.equal(failed.ok, false);
  assert.equal(failed.reason, 'readback_mismatch');
  assert.equal(failed.writeAttempted, true);
  assert.equal(failed.after, '');
  assert.equal(mismatch.stats.clicks, 0);
  mismatch.dom.window.close();

  const neighbor = boot();
  neighbor.input.addEventListener('input', () => { neighbor.document.querySelector('[id="2_ref"] input').value = 'NEIGHBOR_CHANGED'; });
  const changed = await neighbor.api.fillField(LABEL, VALUE);
  assertFlags(changed);
  assert.equal(changed.ok, false);
  assert.equal(changed.reason, 'neighbors_changed');
  assert.equal(changed.neighborsUnchanged, false);
  assert.equal(changed.writeAttempted, true);
  assert.equal(neighbor.stats.clicks, 0);
  neighbor.dom.window.close();
});

test('default fixture occupied id number is preserved and existing globals are untouched', async () => {
  const sentinel = Object.freeze({ existing: true });
  const booted = boot({ empty: false, mutate(document, input, window) {
    window.ResumeHotjobMcBasic = sentinel;
    window.CMS_BASIC = sentinel;
  } });
  const result = await booted.api.fillProfile({ identityNumber: VALUE, confirmedFields: ['identityNumber'] });
  assertFlags(result);
  assert.equal(result.reason, 'existing_value');
  assert.equal(booted.input.value, 'NEIGHBOR_KEEP');
  assert.equal(booted.window.ResumeHotjobMcBasic, sentinel);
  assert.equal(booted.window.CMS_BASIC, sentinel);
  assert.equal(booted.stats.clicks, 0);
  booted.dom.window.close();
});
