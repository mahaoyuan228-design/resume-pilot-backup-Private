// Synthetic offline repeated-row arrangements; this is not a live DOM capture.
// Observed field tokens come from the existing probe fixture. The saved live
// report supplies only the count of five same-label form-items.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../src/content/hotjob-pb-cert-note.js', import.meta.url), 'utf8');
const fixture = JSON.parse(readFileSync(new URL('fixtures/hotjob-pb-cert-note-multirow-offline.json', import.meta.url), 'utf8'));
const probe = JSON.parse(readFileSync(new URL('fixtures/hotjob-pb-cert-note-probe-dom.json', import.meta.url), 'utf8'));
const LABEL = fixture.field.label;
const CALLER = 'Explicit synthetic passed-subject fact\nKeeps  internal spaces';
const PAGE = `https://${probe.page.hostname}${probe.page.samplePath}`;
const initialValues = () => fixture.rows.map(({ value }) => value);
const esc = (value) => String(value).replace(/[&<>"]/gu, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
const row = (label, content) => `<div class="${probe.page.itemClass}"><label>${esc(label)}*</label><span class="${probe.page.childrenClass}">${content}</span></div>`;

function boot(state = {}) {
  const values = state.values || initialValues();
  const rows = values.map((value, rowIndex) => row(LABEL,
    `<textarea id="note-${rowIndex}" class="${fixture.field.controlClass}" placeholder="${esc(fixture.field.placeholder)}">${esc(value)}</textarea>`)).join('');
  const neighbors = Object.values(probe.neighbors).filter((field) => field.controlTag === 'textarea')
    .map((field, index) => row(field.label, `<textarea data-neighbor="${index}" class="${field.controlClass}" placeholder="${esc(field.placeholder)}">KEEP_NEIGHBOR_${index}</textarea>`)).join('');
  const buttons = probe.page.forbiddenButtons.map((label) => `<button>${esc(label)}</button>`).join('');
  const dom = new JSDOM(`<!doctype html><body><div class="${probe.page.rootClass}"><div class="${probe.page.contentClass}">${rows}${neighbors}${row(probe.neighbors.name.label, '<input id="name" class="ant-input" value="KEEP_NAME">')}${row(probe.neighbors.birth.label, `<input id="birth" class="${probe.neighbors.birth.controlClass}" readonly value="KEEP_DATE">`)}${row(probe.neighbors.obey.label, '<input id="radio" type="radio">')}${row(probe.neighbors.research.label, '<input id="checkbox" type="checkbox">')}${row(probe.neighbors.photo.label, '<input id="file" type="file">')}${buttons}</div></div><div id="menu" class="${probe.menu.dropdownClass}" hidden></div></body>`, {
    url: PAGE, pretendToBeVisual: true, runScripts: 'dangerously'
  });
  const { window } = dom;
  const { document } = window;
  // Assign raw fixture values after parsing: HTML strips a leading LF after a
  // textarea start tag, while the adapter must preserve an existing LF value.
  values.forEach((value, index) => { document.getElementById(`note-${index}`).value = value; });
  window.HTMLElement.prototype.getClientRects = function () {
    for (let node = this; node; node = node.parentElement) {
      if (node.hidden || window.getComputedStyle(node).display === 'none') return [];
    }
    return [{ width: 100, height: 20 }];
  };
  const stats = { events: [], clicks: 0, danger: 0, escapes: [] };
  document.addEventListener('click', (event) => {
    stats.clicks += 1;
    if (event.target.closest('button, [type="submit"]')) stats.danger += 1;
  }, true);
  for (const type of ['input', 'change', 'blur']) document.addEventListener(type, (event) => {
    if (!event.target.id.startsWith('note-')) return;
    stats.events.push({ id: event.target.id, type });
    state.onEvent?.({ event, document, window });
  });
  document.addEventListener('focus', (event) => {
    if (event.target.id.startsWith('note-')) state.onFocus?.({ event, document, window });
  }, true);
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    stats.escapes.push(event.target.id || event.target.tagName);
    document.getElementById('menu').hidden = true;
  });
  state.prepare?.({ document, window });
  window.eval(source);
  return { dom, window, document, stats, api: window.ResumeHotjobPbCertNote };
}

const valuesOf = (h) => fixture.rows.map((_, index) => h.document.getElementById(`note-${index}`)?.value);
const eventsFor = (rowIndex) => ['input', 'change', 'blur'].map((type) => ({ id: `note-${rowIndex}`, type }));
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

test('cert-note multirow: fixture explicitly distinguishes synthesis from observed field tokens and count', () => {
  assert.equal(fixture.liveDomCaptured, false);
  assert.equal(fixture.liveSupportClaimed, false);
  assert.equal(fixture.neverSave, true);
  assert.match(fixture.source, /Synthetic offline/u);
  assert.match(fixture.source, /only.*count/u);
  assert.equal(fixture.rowCount, 5);
  assert.equal(fixture.rows.length, fixture.rowCount);
  for (const key of ['label', 'controlTag', 'controlClass', 'placeholder']) assert.equal(fixture.field[key], probe.field[key]);
});

test('cert-note multirow: inspect reports all five same-label candidates without events or support claims', () => {
  const h = boot();
  try {
    const result = h.api.inspect();
    assert.equal(result.ok, true);
    assert.equal(result.fields.length, fixture.rowCount);
    assert.deepEqual(Array.from(result.fields, (field) => field.value), initialValues());
    assert.deepEqual(Array.from(result.fields, (field) => field.rowIndex), [0, 1, 2, 3, 4]);
    for (const field of result.fields) {
      assert.equal(field.label, LABEL);
      assert.equal(field.kind, 'textarea');
      assert.equal(field.supported, false);
    }
    assert.deepEqual(h.stats.events, []);
    safe(h, result);
  } finally { h.dom.window.close(); }
});

test('cert-note multirow: default fills only the first literally empty row and preserves all others', async () => {
  const h = boot();
  try {
    const result = await h.api.fillField(LABEL, CALLER);
    assert.equal(result.ok, true);
    assert.equal(result.reason, 'readback_matched');
    assert.equal(result.rowIndex, 1);
    const expected = initialValues();
    expected[1] = CALLER;
    assert.deepEqual(valuesOf(h), expected);
    assert.deepEqual(h.stats.events, eventsFor(1));
    safe(h, result);
  } finally { h.dom.window.close(); }
});

test('cert-note multirow: explicit zero-based rowIndex fills the chosen later empty row', async () => {
  const h = boot();
  try {
    const result = await h.api.fillField(LABEL, CALLER, { rowIndex: 4 });
    assert.equal(result.ok, true);
    assert.equal(result.rowIndex, 4);
    assert.equal(result.reason, 'readback_matched');
    const expected = initialValues();
    expected[4] = CALLER;
    assert.deepEqual(valuesOf(h), expected);
    assert.deepEqual(h.stats.events, eventsFor(4));
    safe(h, result);
  } finally { h.dom.window.close(); }
});

test('cert-note multirow: whitespace is an existing raw value and is never overwritten by default', async () => {
  const values = [' ', '\n', '\u200b', '', 'KEEP_LAST'];
  const h = boot({ values });
  try {
    const result = await h.api.fillField(LABEL, CALLER);
    assert.equal(result.ok, true);
    assert.equal(result.rowIndex, 3);
    assert.deepEqual(valuesOf(h), [' ', '\n', '\u200b', CALLER, 'KEEP_LAST']);
    assert.deepEqual(h.stats.events, eventsFor(3));
    safe(h, result);
  } finally { h.dom.window.close(); }
});

test('cert-note multirow: no empty row fails safely even when an existing row already matches the caller', async () => {
  const values = ['KEEP_0', CALLER, 'KEEP_2', 'KEEP_3', 'KEEP_4'];
  const h = boot({ values });
  try {
    const result = await h.api.fillField(LABEL, CALLER);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'row_not_empty');
    assert.deepEqual(valuesOf(h), values);
    assert.deepEqual(h.stats.events, []);
    safe(h, result);
  } finally { h.dom.window.close(); }
});

for (const [rowIndex, reason] of [[-1, 'invalid_row_index'], [0.5, 'invalid_row_index'], ['1', 'invalid_row_index'], [null, 'invalid_row_index'], [NaN, 'invalid_row_index'], [Infinity, 'invalid_row_index'], [5, 'row_index_out_of_range'], [999, 'row_index_out_of_range']]) {
  test(`cert-note multirow: rowIndex ${String(rowIndex)} fails without falling back to an empty row`, async () => {
    const h = boot();
    try {
      const result = await h.api.fillField(LABEL, CALLER, { rowIndex });
      assert.equal(result.ok, false);
      assert.equal(result.reason, reason);
      assert.deepEqual(valuesOf(h), initialValues());
      assert.deepEqual(h.stats.events, []);
      safe(h, result);
    } finally { h.dom.window.close(); }
  });
}

for (const options of [null, 4, '4', [], { rowIndex: undefined }]) {
  test(`cert-note multirow: invalid selection options ${JSON.stringify(options)} cannot choose a fallback`, async () => {
    const h = boot();
    try {
      const result = await h.api.fillField(LABEL, CALLER, options);
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'invalid_row_index');
      assert.deepEqual(valuesOf(h), initialValues());
      assert.deepEqual(h.stats.events, []);
      safe(h, result);
    } finally { h.dom.window.close(); }
  });
}

test('cert-note multirow: explicit occupied row preserves its value without filling another row', async () => {
  const h = boot();
  try {
    const result = await h.api.fillField(LABEL, CALLER, { rowIndex: 0 });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'existing_value');
    assert.equal(result.rowIndex, 0);
    assert.deepEqual(valuesOf(h), initialValues());
    assert.deepEqual(h.stats.events, []);
    safe(h, result);
  } finally { h.dom.window.close(); }
});

test('cert-note multirow: explicit matching row verifies without rewriting or selecting an empty row', async () => {
  const values = initialValues();
  values[3] = CALLER;
  const h = boot({ values });
  try {
    const result = await h.api.fillField(LABEL, CALLER, { rowIndex: 3 });
    assert.equal(result.ok, true);
    assert.equal(result.reason, 'preexisting_same_value');
    assert.equal(result.rowIndex, 3);
    assert.deepEqual(valuesOf(h), values);
    assert.deepEqual(h.stats.events, []);
    safe(h, result);
  } finally { h.dom.window.close(); }
});

for (const kind of ['disabled', 'readonly', 'hidden', 'placeholder', 'extraArea', 'stray']) {
  test(`cert-note multirow: ${kind} candidate cannot be skipped to fill a different row`, async () => {
    const h = boot({ prepare({ document }) {
      const target = document.getElementById('note-1');
      if (kind === 'disabled') target.disabled = true;
      if (kind === 'readonly') target.readOnly = true;
      if (kind === 'hidden') target.hidden = true;
      if (kind === 'placeholder') target.placeholder = 'DRIFT';
      if (kind === 'extraArea') target.after(document.createElement('textarea'));
      if (kind === 'stray') target.after(document.createElement('input'));
    } });
    try {
      const result = await h.api.fillField(LABEL, CALLER);
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'control_not_supported');
      assert.deepEqual(valuesOf(h), initialValues());
      assert.deepEqual(h.stats.events, []);
      safe(h, result);
    } finally { h.dom.window.close(); }
  });
}

test('cert-note multirow: focus-time value changes preserve the selected row and never advance to the next empty row', async () => {
  const h = boot({ onFocus({ event }) { event.target.value = 'KEEP_FOCUS_VALUE'; } });
  try {
    const result = await h.api.fillField(LABEL, CALLER);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'existing_value');
    assert.deepEqual(valuesOf(h), ['KEEP_SYNTHETIC_ROW_0', 'KEEP_FOCUS_VALUE', '', 'KEEP_SYNTHETIC_ROW_3', '']);
    assert.deepEqual(h.stats.events, []);
    safe(h, result);
  } finally { h.dom.window.close(); }
});

test('cert-note multirow: focus-time row removal cannot retarget the next empty row', async () => {
  const h = boot({ onFocus({ event }) { event.target.closest('.ant-row.ant-form-item').remove(); } });
  try {
    const result = await h.api.fillField(LABEL, CALLER);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'control_not_supported');
    assert.deepEqual(valuesOf(h), ['KEEP_SYNTHETIC_ROW_0', undefined, '', 'KEEP_SYNTHETIC_ROW_3', '']);
    assert.deepEqual(h.stats.events, []);
    safe(h, result);
  } finally { h.dom.window.close(); }
});

for (const kind of ['reorder', 'add', 'replace']) {
  test(`cert-note multirow: focus-time ${kind} fails before writing to a shifted or replaced target`, async () => {
    const h = boot({ onFocus({ event, document }) {
      const item = event.target.closest('.ant-row.ant-form-item');
      if (kind === 'reorder') item.before(document.getElementById('note-2').closest('.ant-row.ant-form-item'));
      if (kind === 'add') {
        const clone = item.cloneNode(true);
        clone.querySelector('textarea').id = 'note-added';
        item.before(clone);
      }
      if (kind === 'replace') event.target.replaceWith(event.target.cloneNode(true));
    } });
    try {
      const result = await h.api.fillField(LABEL, CALLER);
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'control_not_supported');
      assert.deepEqual(valuesOf(h), initialValues());
      assert.deepEqual(h.stats.events, []);
      if (kind === 'add') assert.equal(h.document.getElementById('note-added').value, '');
      safe(h, result);
    } finally { h.dom.window.close(); }
  });
}

test('cert-note multirow: input-time selected row removal stops events and cannot verify another matching row', async () => {
  const values = initialValues();
  values[2] = CALLER;
  const h = boot({ values, onEvent({ event }) {
    if (event.type === 'input') event.target.closest('.ant-row.ant-form-item').remove();
  } });
  try {
    const result = await h.api.fillField(LABEL, CALLER);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'control_not_supported');
    assert.deepEqual(valuesOf(h), ['KEEP_SYNTHETIC_ROW_0', undefined, CALLER, 'KEEP_SYNTHETIC_ROW_3', '']);
    assert.deepEqual(h.stats.events, [{ id: 'note-1', type: 'input' }]);
    safe(h, result);
  } finally { h.dom.window.close(); }
});

test('cert-note multirow: input-time reorder stops later events and fails verification', async () => {
  const h = boot({ onEvent({ event, document }) {
    if (event.type === 'input') document.getElementById('note-2').closest('.ant-row.ant-form-item').after(event.target.closest('.ant-row.ant-form-item'));
  } });
  try {
    const result = await h.api.fillField(LABEL, CALLER);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'control_not_supported');
    const expected = initialValues();
    expected[1] = CALLER;
    assert.deepEqual(valuesOf(h), expected);
    assert.deepEqual(h.stats.events, [{ id: 'note-1', type: 'input' }]);
    safe(h, result);
  } finally { h.dom.window.close(); }
});

test('cert-note multirow: same-row framework replacement can verify its current raw value', async () => {
  let original;
  const h = boot({ onEvent({ event }) {
    if (event.type !== 'input') return;
    original = event.target;
    const replacement = original.cloneNode(true);
    replacement.value = original.value;
    original.replaceWith(replacement);
  } });
  try {
    const result = await h.api.fillField(LABEL, CALLER);
    assert.equal(result.ok, true);
    assert.equal(result.reason, 'readback_matched');
    assert.equal(original.isConnected, false);
    assert.notEqual(h.document.getElementById('note-1'), original);
    const expected = initialValues();
    expected[1] = CALLER;
    assert.deepEqual(valuesOf(h), expected);
    assert.deepEqual(h.stats.events, [{ id: 'note-1', type: 'input' }]);
    safe(h, result);
  } finally { h.dom.window.close(); }
});

test('cert-note multirow: moving another row control into the selected item cannot pass matching readback', async () => {
  const values = initialValues();
  values[2] = CALLER;
  const h = boot({ values, onEvent({ event, document }) {
    if (event.type !== 'input') return;
    const other = document.getElementById('note-2');
    const marker = document.createTextNode('');
    event.target.replaceWith(marker);
    other.replaceWith(event.target);
    marker.replaceWith(other);
  } });
  try {
    const result = await h.api.fillField(LABEL, CALLER);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'control_not_supported');
    assert.deepEqual(valuesOf(h), ['KEEP_SYNTHETIC_ROW_0', CALLER, CALLER, 'KEEP_SYNTHETIC_ROW_3', '']);
    assert.deepEqual(h.stats.events, [{ id: 'note-1', type: 'input' }]);
    safe(h, result);
  } finally { h.dom.window.close(); }
});

test('cert-note multirow: a side effect on another note fails verification and stops later events', async () => {
  const h = boot({ onEvent({ event, document }) {
    if (event.type === 'input') document.getElementById('note-3').value = 'FRAMEWORK_SIDE_EFFECT';
  } });
  try {
    const result = await h.api.fillField(LABEL, CALLER);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'readback_mismatch');
    assert.deepEqual(valuesOf(h), ['KEEP_SYNTHETIC_ROW_0', CALLER, '', 'FRAMEWORK_SIDE_EFFECT', '']);
    assert.deepEqual(h.stats.events, [{ id: 'note-1', type: 'input' }]);
    safe(h, result);
  } finally { h.dom.window.close(); }
});

for (const method of ['fillFields', 'fillProfile']) {
  test(`cert-note multirow: ${method} forwards an explicit row selection`, async () => {
    const h = boot();
    try {
      const argument = method === 'fillFields' ? { [LABEL]: CALLER } : { customAnswers: { [LABEL]: CALLER }, confirmedFields: [`customAnswers.${LABEL}`] };
      const result = await h.api[method](argument, { rowIndex: 4 });
      const field = method === 'fillFields' ? result.fields[0] : result;
      assert.equal(result.ok, true);
      assert.equal(field.rowIndex, 4);
      const expected = initialValues();
      expected[4] = CALLER;
      assert.deepEqual(valuesOf(h), expected);
      assert.deepEqual(h.stats.events, eventsFor(4));
      safe(h, result);
      safe(h, field);
    } finally { h.dom.window.close(); }
  });
}

test('cert-note multirow: explicit cancel preserves every row and leaves the page unsaved', async () => {
  const h = boot({ prepare({ document }) { document.getElementById('menu').hidden = false; } });
  try {
    const result = await h.api.cancelField(LABEL, { rowIndex: 3 });
    assert.equal(result.ok, true);
    assert.equal(result.reason, 'left_unsaved');
    assert.equal(result.rowIndex, 3);
    assert.equal(result.before, 'KEEP_SYNTHETIC_ROW_3');
    assert.equal(result.after, 'KEEP_SYNTHETIC_ROW_3');
    assert.equal(result.stillOpen, 0);
    assert.equal(result.canceled, true);
    assert.ok(h.stats.escapes.includes('note-3'));
    assert.deepEqual(valuesOf(h), initialValues());
    assert.deepEqual(h.stats.events, []);
    safe(h, result);
  } finally { h.dom.window.close(); }
});
