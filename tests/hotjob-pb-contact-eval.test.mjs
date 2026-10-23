// Offline Never-Save trials for hotjob pb 联系地址 and 评价内容.
// Markup is built from tests/fixtures/hotjob-pb-contact-eval-probe-dom.json
// (2026-10-23 probe classes, labels, placeholders, and the address display token).
// The live 评价内容 intro is omitted. Profile strings below are trial input, not a
// stored essay. A green run is not a live support claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../src/content/hotjob-pb-contact-eval.js', import.meta.url), 'utf8');
const basicSource = readFileSync(new URL('../src/content/hotjob-pb-basic.js', import.meta.url), 'utf8');
const regionSource = readFileSync(new URL('../src/content/hotjob-pb-region.js', import.meta.url), 'utf8');
const eduSource = readFileSync(new URL('../src/content/hotjob-pb-edu-intent.js', import.meta.url), 'utf8');
const eduHistorySource = readFileSync(new URL('../src/content/hotjob-pb-edu-history.js', import.meta.url), 'utf8');
const workSource = readFileSync(new URL('../src/content/hotjob-pb-work.js', import.meta.url), 'utf8');
const certsSource = readFileSync(new URL('../src/content/hotjob-pb-certs.js', import.meta.url), 'utf8');
const intentSource = readFileSync(new URL('../src/content/hotjob-pb-intent-location.js', import.meta.url), 'utf8');
const salarySource = readFileSync(new URL('../src/content/hotjob-pb-intent-salary.js', import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../manifest.json', import.meta.url), 'utf8');
const engine = readFileSync(new URL('../src/content/engine.js', import.meta.url), 'utf8');
const popup = readFileSync(new URL('../src/popup/popup.js', import.meta.url), 'utf8');
const cmsBasic = readFileSync(new URL('../src/background/cms-basic-auto.mjs', import.meta.url), 'utf8');
const cmsEdu = readFileSync(new URL('../src/background/cms-education-task-runner.mjs', import.meta.url), 'utf8');
const mcSource = readFileSync(new URL('../src/content/hotjob-mc-basic.js', import.meta.url), 'utf8');
const mcRunner = readFileSync(new URL('../src/background/hotjob-mc-basic-auto.mjs', import.meta.url), 'utf8');
const probe = JSON.parse(readFileSync(new URL('../tests/fixtures/hotjob-pb-contact-eval-probe-dom.json', import.meta.url), 'utf8'));

const PAGE = `https://${probe.page.hostname}${probe.page.samplePath}`;
const FIELD = Object.fromEntries(probe.fields.map((field) => [field.key, field]));
const ADDRESS = FIELD.address.label;
const NOTE = FIELD.note.label;
const SAMPLE = FIELD.address.valueSample;
const FORBIDDEN = probe.page.forbiddenButtons;
const MODULE = 'hotjob-pb-contact-eval';
const NOTE_PROFILE = '合成评价内容';
const NOTE_KEEP_NEWLINE = '合成评价内容\n第二行 仍然是资料原文';

function esc(value) {
  return String(value).replace(/[&<>"]/gu, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function classes(value) {
  return String(value).split(/\s+/u).filter(Boolean);
}

function exact(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/gu, '')
    .replace(/[\s\u00a0]+/gu, '')
    .trim();
}

function row(key, label, inner, extra = {}) {
  const itemClass = extra.dropRow ? 'ant-form-item' : probe.page.itemClass;
  const hidden = extra.hidden ? ' hidden' : '';
  const caption = extra.rawLabel != null ? extra.rawLabel : `${label}*`;
  const extraLabel = extra.extraLabel ? `<label>${esc(extra.extraLabel)}</label>` : '';
  if (extra.wrapControl) {
    return `<div class="${esc(itemClass)}" data-field="${esc(key)}"${hidden}><label>${esc(caption)}${inner}</label>${extraLabel}</div>`;
  }
  return `<div class="${esc(itemClass)}" data-field="${esc(key)}"${hidden}><label>${esc(caption)}</label>${extraLabel}<span class="${esc(probe.page.childrenClass)}">${inner}</span></div>`;
}

function addressInner(value, state) {
  const className = state.dropAntInput
    ? 'plain-input'
    : (state.calendarOnAddress ? probe.neighbors.birth.controlClass : probe.text.controlClass);
  const type = state.typeNumber ? 'number' : probe.text.inputType;
  const readonly = state.readonlyAddress ? ' readonly' : '';
  const disabled = state.disabledAddress ? ' disabled' : '';
  const placeholder = state.missingAddressPlaceholder
    ? ''
    : ` placeholder="${esc(state.badAddressPlaceholder || FIELD.address.placeholder)}"`;
  const extra = state.extraTextInput
    ? `<input class="${esc(probe.text.controlClass)}" type="text" value="">`
    : '';
  const noise = [];
  if (state.fileOnAddress) noise.push('<input type="file">');
  if (state.radioOnAddress) noise.push(`<input class="${esc(probe.neighbors.obey.controlClass)}" type="${esc(probe.neighbors.obey.inputType)}">`);
  if (state.checkboxOnAddress) noise.push(`<input class="${esc(probe.neighbors.research.controlClass)}" type="${esc(probe.neighbors.research.inputType)}">`);
  if (state.selectOnAddress) noise.push(`<div class="${esc(probe.neighbors.degree.controlClass)}"></div>`);
  if (state.nativeSelectOnAddress) noise.push('<select></select>');
  if (state.cascaderOnAddress) noise.push(`<span class="${esc(probe.neighbors.residence.menuClass)}"></span>`);
  return `${noise.join('')}<input id="address-input" class="${esc(className)}" type="${type}"${placeholder}${readonly}${disabled} value="${esc(value)}">${extra}`;
}

function noteInner(value, state) {
  if (state.noteAsInput) {
    return `<input id="note-input" class="${esc(probe.text.controlClass)}" type="text" placeholder="${esc(FIELD.note.placeholder)}" value="${esc(value)}">`;
  }
  const className = state.plainTextarea ? 'plain-area' : probe.textarea.controlClass;
  const readonly = state.readonlyNote ? ' readonly' : '';
  const disabled = state.disabledNote ? ' disabled' : '';
  const placeholder = state.missingNotePlaceholder
    ? ''
    : ` placeholder="${esc(state.badNotePlaceholder || FIELD.note.placeholder)}"`;
  const extra = state.extraTextarea ? `<textarea class="${esc(probe.textarea.controlClass)}"></textarea>` : '';
  const noise = [];
  if (state.fileOnNote) noise.push('<input type="file">');
  if (state.radioOnNote) noise.push(`<input class="${esc(probe.neighbors.obey.controlClass)}" type="${esc(probe.neighbors.obey.inputType)}">`);
  if (state.checkboxOnNote) noise.push(`<input class="${esc(probe.neighbors.research.controlClass)}" type="${esc(probe.neighbors.research.inputType)}">`);
  if (state.selectOnNote) noise.push(`<div class="${esc(probe.neighbors.degree.controlClass)}"></div>`);
  if (state.nativeSelectOnNote) noise.push('<select></select>');
  if (state.textOnNote) noise.push(`<input class="${esc(probe.text.controlClass)}" type="text" value="">`);
  return `${noise.join('')}<textarea id="note-input" class="${esc(className)}"${placeholder}${readonly}${disabled}>${esc(value)}</textarea>${extra}`;
}

function textRow(id, label, value, placeholder, controlClass = probe.text.controlClass) {
  return row(id, label, `<input id="${id}-input" class="${esc(controlClass)}" type="text" placeholder="${esc(placeholder)}" value="${esc(value)}">`, {});
}

function areaRow(id, label, value, placeholder) {
  return row(id, label, `<textarea id="${id}-input" class="${esc(probe.textarea.controlClass)}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`, {});
}

function html(state) {
  const neighbor = probe.neighbors;
  const rootClass = state.dropRoot ? 'page-root' : probe.page.rootClass;
  const shell = state.elForm ? '<div class="el-form"></div>' : '';
  const addressValue = state.address ?? '';
  const noteValue = state.note ?? '';
  const address = row('address', ADDRESS, addressInner(addressValue, state), {
    hidden: state.hiddenAddress,
    dropRow: state.dropAntRow,
    rawLabel: state.addressLabel,
    extraLabel: state.sameAddressCaption ? `${ADDRESS}*` : (state.disagreeAddress || '')
  });
  const note = row('note', NOTE, noteInner(noteValue, state), {
    hidden: state.hiddenNote,
    wrapControl: state.wrapNote,
    rawLabel: state.noteLabel,
    extraLabel: state.disagreeNote || ''
  });
  const addressCopy = state.duplicateAddress
    ? row('address-copy', ADDRESS, addressInner('', { ...state, extraTextInput: false }).replace('id="address-input"', 'id="address-copy-input"'), {})
    : '';
  const noteCopy = state.duplicateNote
    ? row('note-copy', NOTE, noteInner('', { ...state, extraTextarea: false }).replace('id="note-input"', 'id="note-copy-input"'), {})
    : '';
  const obey = neighbor.obey.options.map((text) => `<label><span><input class="${esc(neighbor.obey.controlClass)}" type="${esc(neighbor.obey.inputType)}" name="pb-obey"></span><span>${esc(text)}</span></label>`).join('');
  const leaf = state.openCascader ? `<span id="cascader-leaf">${esc(neighbor.residence.token)}</span>` : '';
  const buttons = [...probe.page.buttonLabels, ...FORBIDDEN.filter((label) => !probe.page.buttonLabels.includes(label))]
    .map((label) => `<button type="button">${esc(label)}</button>`).join('');
  const degreeClass = state.busy ? probe.menu.openClass : neighbor.degree.controlClass;
  return `<!doctype html><body>${shell}<div class="${esc(rootClass)}"><div class="${esc(probe.page.contentClass)}">${address}${addressCopy}${note}${noteCopy
  }${textRow('name', neighbor.name.label, neighbor.name.token, neighbor.name.placeholder)
  }${areaRow('major-note', neighbor.majorNote.label, neighbor.majorNote.token, neighbor.majorNote.placeholder)
  }${areaRow('work-note', neighbor.workNote.label, '', neighbor.workNote.placeholder)
  }${areaRow('cert-note', neighbor.certNote.label, neighbor.certNote.token, neighbor.certNote.placeholder)
  }${row('residence', neighbor.residence.label, `<span class="${esc(neighbor.residence.menuClass)}">${leaf}<div class="${esc(neighbor.residence.controlClass)}" id="residence-select"><span id="residence-value">${esc(neighbor.residence.token)}</span></div></span>`, {})
  }${row('birth', neighbor.birth.label, `<input id="birth-input" class="${esc(neighbor.birth.controlClass)}" type="text" readonly value="${esc(neighbor.birth.token)}">`, {})
  }${row('obey', neighbor.obey.label, obey, {})
  }${row('research', neighbor.research.label, `<input id="research" class="${esc(neighbor.research.controlClass)}" type="${esc(neighbor.research.inputType)}">`, {})
  }${row('degree', neighbor.degree.label, `<div class="${esc(degreeClass)}" id="degree-select"><span id="degree-value">${esc(neighbor.degree.token)}</span></div>`, {})
  }${`<div class="${esc(neighbor.photo.itemClass)}"><label>${esc(neighbor.photo.label)}*</label><input id="photo" type="file"></div>`
  }${buttons}</div></div><div class="${esc(probe.menu.dropdownClass)}" id="select-menu" hidden><ul id="select-options"></ul></div></body>`;
}

function hide(node, hidden) {
  node.hidden = hidden;
  node.style.display = hidden ? 'none' : '';
}

function wire(document, state) {
  const stats = {
    open: 0, option: 0, escape: 0, forbidden: 0, button: 0, file: 0, radio: 0, checkbox: 0,
    textInput: 0, focus: 0
  };
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (button) {
      stats.button += 1;
      if (FORBIDDEN.includes(button.textContent.trim())) stats.forbidden += 1;
    }
    if (event.target.matches?.('input[type="file"]')) stats.file += 1;
    if (event.target.matches?.('input.ant-radio-input, input[type="radio"]')) stats.radio += 1;
    if (event.target.matches?.('input.ant-checkbox-input, input[type="checkbox"]')) stats.checkbox += 1;
    if (event.target.closest?.('#select-menu')) stats.option += 1;
  }, true);
  document.addEventListener('input', (event) => {
    if (event.target.id === 'address-input' || event.target.id === 'note-input') stats.textInput += 1;
  });
  document.addEventListener('focus', (event) => {
    if (event.target.id === 'address-input' || event.target.id === 'note-input') stats.focus += 1;
  }, true);
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    stats.escape += 1;
    if (state.ignoreEscape) return;
    for (const select of document.querySelectorAll('.ant-select')) {
      select.classList.remove('ant-select-open', 'ant-select-focused');
    }
    hide(document.getElementById('select-menu'), true);
    const leaf = document.getElementById('cascader-leaf');
    if (leaf) leaf.remove();
  });
  if (state.busy) hide(document.getElementById('select-menu'), false);
  return stats;
}

function patch(window) {
  window.Element.prototype.getClientRects = function () {
    for (let node = this; node?.nodeType === 1; node = node.parentElement) {
      if (node.hidden || node.style.display === 'none') return [];
    }
    return [{ width: 8, height: 8, top: 0, left: 0, right: 8, bottom: 8 }];
  };
}

async function boot(state = {}) {
  const dom = new JSDOM(html(state), { url: state.url || PAGE, pretendToBeVisual: true, runScripts: 'dangerously' });
  const { window } = dom;
  const { document } = window;
  patch(window);
  const stats = wire(document, state);
  window.eval(source);
  return { dom, window, document, stats, api: window.ResumeHotjobPbContactEval };
}

function valueOf(document, id) {
  return document.getElementById(id).value;
}

function assertNeverSaved(row) {
  assert.equal(row.liveSupportClaimed, false);
  assert.equal(row.supportClaimed, false);
  assert.equal(row.neverSave, true);
  assert.equal(row.leftUnsaved, true);
  assert.equal(row.saved, false);
  assert.equal(row.skippedSave, true);
  assert.equal(row.complete, false);
  assert.equal(row.softwareClickedSave, false);
  assert.equal(row.softwareClickedSubmit, false);
  assert.equal(row.softwareClickedDeliver, false);
  assert.equal(row.softwareClickedDelete, false);
  assert.equal(row.softwareClickedNext, false);
}

function unchanged(document, stats) {
  const neighbor = probe.neighbors;
  assert.equal(valueOf(document, 'name-input'), neighbor.name.token);
  assert.equal(valueOf(document, 'major-note-input'), neighbor.majorNote.token);
  assert.equal(valueOf(document, 'work-note-input'), '');
  assert.equal(valueOf(document, 'cert-note-input'), neighbor.certNote.token);
  assert.equal(document.getElementById('residence-value').textContent, neighbor.residence.token);
  assert.equal(valueOf(document, 'birth-input'), neighbor.birth.token);
  assert.equal(document.getElementById('degree-value').textContent, neighbor.degree.token);
  assert.equal([...document.querySelectorAll('input[name="pb-obey"]')].some((node) => node.checked), false);
  assert.equal(document.getElementById('research').checked, false);
  assert.equal(document.getElementById('photo').files.length, 0);
  assert.equal(stats.forbidden, 0);
  assert.equal(stats.button, 0);
  assert.equal(stats.file, 0);
  assert.equal(stats.radio, 0);
  assert.equal(stats.checkbox, 0);
  assert.equal(stats.option, 0);
}

test('source stays unregistered and does not claim support or invent copy', () => {
  assert.match(source, /ResumeHotjobPbContactEval/);
  assert.match(source, /liveSupportClaimed:\s*false/);
  assert.match(source, /supportClaimed:\s*false/);
  assert.match(source, /neverSave:\s*true/);
  assert.match(source, /leftUnsaved:\s*true/);
  assert.doesNotMatch(source, /liveSupportClaimed:\s*true/);
  assert.doesNotMatch(source, /supportClaimed:\s*true/);
  assert.doesNotMatch(source, /已支持/);
  assert.doesNotMatch(source, /hotjob-mc-basic|ResumeHotjobMc|ResumeHotjobPbBasic|ResumeHotjobPbRegion|ResumeHotjobPbWork|ResumeHotjobPbEdu|ResumeHotjobPbIntent|ResumeHotjobPbCerts|mc\/deliver|cms-region|engine\.js/);
  assert.doesNotMatch(source, /textContent\s*=/);
  assert.doesNotMatch(source, /\.value\s*=[^=]/);
  assert.doesNotMatch(source, /\.checked\s*=/);
  assert.doesNotMatch(source, /innerHTML/);
  assert.doesNotMatch(source, /\.click\s*\(/);
  assert.doesNotMatch(source, /\bexport\s/);
  assert.doesNotMatch(source, new RegExp(SAMPLE));
  assert.doesNotMatch(source, /合成/);
  assert.match(source, /保存\|提交\|投递\|删除\|下一步\|返回\|确定/);
  assert.match(source, /input\.ant-input/);
  assert.match(source, /textarea/);
  const untouched = [
    manifest, engine, popup, cmsBasic, cmsEdu, mcSource, mcRunner,
    basicSource, regionSource, eduSource, eduHistorySource, workSource, certsSource, intentSource, salarySource
  ];
  for (const file of untouched) {
    assert.equal(file.includes(MODULE), false);
    assert.equal(file.includes('ResumeHotjobPbContactEval'), false);
  }
  for (const token of [
    ADDRESS, NOTE, FIELD.address.placeholder, FIELD.note.placeholder,
    probe.page.rootClass, 'ant-calendar-picker-input',
    ...classes(probe.menu.dropdownClass),
    '.cascader-plugins-wrap'
  ]) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  }
});

test('fixture html uses probe classes and does not store the omitted intro', () => {
  const built = html({});
  for (const token of [
    probe.page.rootClass, probe.page.contentClass, probe.page.childrenClass,
    ...classes(probe.page.itemClass), probe.text.controlClass, probe.textarea.controlTag,
    ...classes(probe.menu.dropdownClass), probe.neighbors.residence.menuClass,
    probe.neighbors.photo.itemClass, probe.neighbors.obey.controlClass,
    probe.neighbors.research.controlClass, probe.neighbors.birth.controlClass
  ]) assert.match(built, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  for (const field of probe.fields) {
    assert.match(built, new RegExp(`>${field.label}\\*`));
    assert.match(built, new RegExp(field.placeholder.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  }
  assert.equal(built.includes(SAMPLE), false);
  assert.equal(JSON.stringify(probe).includes(NOTE_PROFILE), false);
  assert.equal(JSON.stringify(probe).includes(NOTE_KEEP_NEWLINE), false);
  assert.match(JSON.stringify(probe), new RegExp(SAMPLE));
  for (const label of probe.page.buttonLabels) assert.match(built, new RegExp(`>${label}<`));
  assert.doesNotMatch(built, /<li>[^<]/u);
});

test('inspect reads both controls and does not claim support', async () => {
  const spaced = `${SAMPLE.slice(0, 3)} ${SAMPLE.slice(3)}`;
  const h = await boot({ address: spaced, note: NOTE_KEEP_NEWLINE });
  try {
    const view = h.api.inspect();
    assert.equal(h.api.liveSupportClaimed, false);
    assert.equal(h.api.supportClaimed, false);
    assert.equal(h.api.neverSave, true);
    assert.equal(h.api.leftUnsaved, true);
    assert.equal(h.window.ResumeHotjobPbBasic, undefined);
    assert.equal(h.window.ResumeHotjobPbEduIntent, undefined);
    assert.equal(h.window.ResumeHotjobPbIntentSalary, undefined);
    assertNeverSaved(view);
    assert.equal(view.ok, true);
    assert.equal(view.reason, 'structure_matched');
    assert.equal(view.fields.length, 2);
    assert.equal(view.fields.every((field) => field.supported === false), true);
    assert.deepEqual(Array.from(view.fields, (field) => field.label), [ADDRESS, NOTE]);
    assert.deepEqual(Array.from(view.fields, (field) => field.kind), ['text', 'textarea']);
    assert.equal(view.fields[0].reason, 'structure_matched');
    assert.equal(view.fields[0].value, spaced);
    assert.equal(view.fields[1].value, NOTE_KEEP_NEWLINE);
    const labels = view.fields.map((field) => field.label);
    assert.equal(labels.includes(probe.neighbors.majorNote.label), false);
    assert.equal(labels.includes(probe.neighbors.workNote.label), false);
    assert.equal(labels.includes(probe.neighbors.certNote.label), false);
    assert.equal(h.stats.focus, 0);
    assert.equal(h.stats.textInput, 0);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('empty 联系地址 paints the probed sample once and empty 评价内容 paints the profile string once', async () => {
  const h = await boot({});
  try {
    const address = await h.api.fillField(`  ${ADDRESS}*  `, `  ${SAMPLE}  `);
    const note = await h.api.fillField(NOTE, `  ${NOTE_KEEP_NEWLINE}  `);
    assert.equal(address.ok, true, JSON.stringify(address));
    assert.equal(address.reason, 'readback_matched');
    assert.equal(address.status, 'verified');
    assert.equal(address.after, SAMPLE);
    assert.equal(address.expected, SAMPLE);
    assert.equal(address.opened, false);
    assert.equal(address.canceled, false);
    assertNeverSaved(address);
    assert.equal(note.ok, true, JSON.stringify(note));
    assert.equal(note.reason, 'readback_matched');
    assert.equal(note.after, NOTE_KEEP_NEWLINE);
    assert.equal(note.expected, NOTE_KEEP_NEWLINE);
    assert.equal(note.after.includes('\n'), true);
    assert.equal(note.after.includes(' '), true);
    assertNeverSaved(note);
    assert.equal(valueOf(h.document, 'address-input'), SAMPLE);
    assert.equal(valueOf(h.document, 'note-input'), NOTE_KEEP_NEWLINE);
    assert.equal(h.stats.focus, 2);
    assert.equal(h.stats.textInput, 2);
    assert.equal(h.stats.escape, 0);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a query string still fills and fillFields covers only these two labels', async () => {
  const h = await boot({ url: `${PAGE}?recruitType=1&resumeId=synthetic&tid=synthetic&lang=1` });
  try {
    const filled = await h.api.fillFields({
      [ADDRESS]: SAMPLE,
      [NOTE]: NOTE_PROFILE
    });
    assert.equal(filled.ok, true, JSON.stringify(filled.fields));
    assertNeverSaved(filled);
    assert.equal(filled.fields.length, 2);
    assert.equal(filled.fields.every((field) => field.reason === 'readback_matched'), true);
    assert.equal(valueOf(h.document, 'address-input'), SAMPLE);
    assert.equal(valueOf(h.document, 'note-input'), NOTE_PROFILE);
    assert.equal(h.stats.textInput, 2);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('preexisting same values are verified and not rewritten', async () => {
  const spaced = `${SAMPLE.slice(0, 3)} ${SAMPLE.slice(3)}`;
  const shown = `合成\n评价 内容`;
  const h = await boot({ address: spaced, note: shown });
  try {
    const address = await h.api.fillField(ADDRESS, SAMPLE);
    const note = await h.api.fillField(NOTE, '合成评价内容');
    const same = await h.api.fillField(NOTE, `  ${shown}  `);
    assert.equal(address.reason, 'preexisting_same_value');
    assert.equal(address.status, 'verified');
    assert.equal(address.ok, true);
    assert.equal(address.before, SAMPLE);
    assert.equal(address.after, SAMPLE);
    assert.equal(address.opened, false);
    assertNeverSaved(address);
    assert.equal(note.reason, 'preexisting_same_value');
    assert.equal(note.ok, true);
    assert.equal(note.status, 'verified');
    assert.equal(note.after, shown);
    assert.equal(exact(note.after), exact(note.expected));
    assert.equal(same.reason, 'preexisting_same_value');
    assert.equal(same.after, shown);
    assert.equal(valueOf(h.document, 'address-input'), spaced);
    assert.equal(valueOf(h.document, 'note-input'), shown);
    assert.equal(h.stats.focus, 0);
    assert.equal(h.stats.textInput, 0);
    assert.equal(h.stats.escape, 0);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a different existing value is kept', async () => {
  const h = await boot({ address: '已有地址', note: NOTE_KEEP_NEWLINE });
  try {
    const filled = await h.api.fillFields({ [ADDRESS]: SAMPLE, [NOTE]: NOTE_PROFILE });
    assert.equal(filled.ok, false);
    assertNeverSaved(filled);
    const byLabel = Object.fromEntries(filled.fields.map((field) => [field.label, field]));
    assert.equal(byLabel[ADDRESS].reason, 'existing_value');
    assert.equal(byLabel[ADDRESS].status, 'skipped');
    assert.equal(byLabel[ADDRESS].ok, false);
    assert.equal(byLabel[NOTE].reason, 'existing_value');
    assert.equal(byLabel[NOTE].after, NOTE_KEEP_NEWLINE);
    assert.equal(valueOf(h.document, 'address-input'), '已有地址');
    assert.equal(valueOf(h.document, 'note-input'), NOTE_KEEP_NEWLINE);
    assert.equal(h.stats.focus, 0);
    assert.equal(h.stats.textInput, 0);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('empty profile values and out-of-scope labels fail closed', async () => {
  const h = await boot({});
  try {
    for (const value of ['', '   ', '\n', null, 1, undefined]) {
      const address = await h.api.fillField(ADDRESS, value);
      assert.equal(address.reason, 'missing_profile_value', String(value));
      assert.equal(address.ok, false);
      assertNeverSaved(address);
      const note = await h.api.fillField(NOTE, value);
      assert.equal(note.reason, 'missing_profile_value', String(value));
    }
    for (const label of [
      '评价',
      '评价内容补充',
      '评价内容（必填）',
      '联系地址栏',
      probe.neighbors.name.label,
      probe.neighbors.majorNote.label,
      probe.neighbors.workNote.label,
      probe.neighbors.certNote.label,
      probe.neighbors.residence.label,
      probe.neighbors.birth.label,
      probe.neighbors.obey.label,
      probe.neighbors.research.label,
      probe.neighbors.degree.label,
      probe.neighbors.photo.label,
      '自我评价内容',
      '我的评价内容'
    ]) {
      const rowResult = await h.api.fillField(label, SAMPLE);
      assert.equal(rowResult.reason, 'label_not_allowed', label);
      const canceled = await h.api.cancelField(label);
      assert.equal(canceled.reason, 'label_not_allowed', label);
    }
    const none = await h.api.fillFields(null);
    assert.equal(none.ok, false);
    assertNeverSaved(none);
    assert.equal(none.fields.every((field) => field.reason === 'missing_profile_value'), true);
    assert.equal(valueOf(h.document, 'address-input'), '');
    assert.equal(valueOf(h.document, 'note-input'), '');
    assert.equal(h.stats.focus, 0);
    assert.equal(h.stats.textInput, 0);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('NFKC and whitespace still match 评价内容 and do not touch other textareas', async () => {
  const h = await boot({
    addressLabel: '联\u200b系\u00a0地址*',
    noteLabel: '评\u3000价内容：',
    wrapNote: true,
    note: NOTE_KEEP_NEWLINE
  });
  try {
    const view = h.api.inspect();
    assert.equal(view.fields.find((field) => field.label === NOTE).reason, 'structure_matched');
    assert.equal(view.fields.find((field) => field.label === NOTE).value, NOTE_KEEP_NEWLINE);
    assert.equal(view.fields.find((field) => field.label === ADDRESS).reason, 'structure_matched');
    const address = await h.api.fillField(ADDRESS, SAMPLE);
    assert.equal(address.reason, 'readback_matched');
    const note = await h.api.fillField('评 价 内 容*', NOTE_PROFILE);
    assert.equal(note.reason, 'existing_value');
    assert.equal(valueOf(h.document, 'note-input'), NOTE_KEEP_NEWLINE);
    assert.equal(valueOf(h.document, 'major-note-input'), probe.neighbors.majorNote.token);
    assert.equal(valueOf(h.document, 'work-note-input'), '');
    assert.equal(valueOf(h.document, 'cert-note-input'), probe.neighbors.certNote.token);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('identical captions still name the row', async () => {
  const h = await boot({ sameAddressCaption: true });
  try {
    const address = await h.api.fillField(ADDRESS, SAMPLE);
    assert.equal(address.reason, 'readback_matched', JSON.stringify(address));
    assert.equal(valueOf(h.document, 'address-input'), SAMPLE);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('Escape leaves both values unsaved and does not click', async () => {
  const h = await boot({ address: SAMPLE, note: NOTE_KEEP_NEWLINE });
  try {
    const address = await h.api.cancelField(ADDRESS);
    const note = await h.api.cancelField(` ${NOTE}* `);
    assert.equal(address.ok, true, JSON.stringify(address));
    assert.equal(address.reason, 'left_unsaved');
    assert.equal(address.status, 'verified');
    assert.equal(address.canceled, true);
    assert.equal(address.leftUnsaved, true);
    assert.equal(address.before, SAMPLE);
    assert.equal(address.after, SAMPLE);
    assert.equal(address.stillOpen, 0);
    assertNeverSaved(address);
    assert.equal(note.reason, 'left_unsaved');
    assert.equal(note.after, NOTE_KEEP_NEWLINE);
    assert.equal(note.canceled, true);
    assert.ok(h.stats.escape >= 2);
    assert.equal(h.stats.focus, 0);
    assert.equal(h.stats.textInput, 0);
    assert.equal(valueOf(h.document, 'address-input'), SAMPLE);
    assert.equal(valueOf(h.document, 'note-input'), NOTE_KEEP_NEWLINE);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('an open menu is left with Escape and is not filled through', async () => {
  const h = await boot({ busy: true, note: NOTE_KEEP_NEWLINE });
  try {
    const blocked = await h.api.fillField(ADDRESS, SAMPLE);
    assert.equal(blocked.reason, 'control_busy', JSON.stringify(blocked));
    assert.equal(blocked.ok, false);
    assertNeverSaved(blocked);
    assert.equal(valueOf(h.document, 'address-input'), '');
    assert.equal(h.stats.focus, 0);
    assert.equal(h.stats.textInput, 0);
    assert.equal(h.document.getElementById('select-menu').hidden, false);
    const canceled = await h.api.cancelField(NOTE);
    assert.equal(canceled.ok, true, JSON.stringify(canceled));
    assert.equal(canceled.reason, 'left_unsaved');
    assert.equal(canceled.leftUnsaved, true);
    assert.equal(canceled.after, NOTE_KEEP_NEWLINE);
    assert.equal(h.document.getElementById('select-menu').hidden, true);
    assert.equal(h.document.querySelectorAll('.ant-select-open').length, 0);
    assert.equal(h.stats.option, 0);
    assert.equal(valueOf(h.document, 'note-input'), NOTE_KEEP_NEWLINE);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a menu that ignores Escape fails closed without a write', async () => {
  const h = await boot({ busy: true, ignoreEscape: true, address: '已有地址' });
  try {
    const canceled = await h.api.cancelField(ADDRESS);
    assert.equal(canceled.ok, false);
    assert.equal(canceled.reason, 'menu_cleanup_failed');
    assert.equal(canceled.stillOpen, 1);
    assert.equal(canceled.leftUnsaved, true);
    assert.equal(canceled.after, '已有地址');
    assert.equal(h.stats.option, 0);
    assert.equal(h.stats.forbidden, 0);
    const blocked = await h.api.fillField(NOTE, NOTE_PROFILE);
    assert.equal(blocked.reason, 'control_busy');
    assert.equal(valueOf(h.document, 'note-input'), '');
    assert.equal(valueOf(h.document, 'address-input'), '已有地址');
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('an open cascader blocks the write until Escape clears it', async () => {
  const h = await boot({ openCascader: true });
  try {
    const blocked = await h.api.fillField(NOTE, NOTE_PROFILE);
    assert.equal(blocked.reason, 'control_busy');
    assert.equal(valueOf(h.document, 'note-input'), '');
    const canceled = await h.api.cancelField(ADDRESS);
    assert.equal(canceled.reason, 'left_unsaved');
    assert.equal(h.document.getElementById('cascader-leaf'), null);
    const note = await h.api.fillField(NOTE, NOTE_PROFILE);
    assert.equal(note.reason, 'readback_matched');
    assert.equal(valueOf(h.document, 'note-input'), NOTE_PROFILE);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('missing, duplicate, and drifted controls fail closed', async () => {
  const cases = [
    [{ dropAntInput: true }, ADDRESS, SAMPLE],
    [{ readonlyAddress: true }, ADDRESS, SAMPLE],
    [{ disabledAddress: true }, ADDRESS, SAMPLE],
    [{ calendarOnAddress: true }, ADDRESS, SAMPLE],
    [{ extraTextInput: true }, ADDRESS, SAMPLE],
    [{ hiddenAddress: true }, ADDRESS, SAMPLE],
    [{ typeNumber: true }, ADDRESS, SAMPLE],
    [{ dropAntRow: true }, ADDRESS, SAMPLE],
    [{ duplicateAddress: true }, ADDRESS, SAMPLE],
    [{ disagreeAddress: '姓名*' }, ADDRESS, SAMPLE],
    [{ badAddressPlaceholder: '请填写姓名' }, ADDRESS, SAMPLE],
    [{ missingAddressPlaceholder: true }, ADDRESS, SAMPLE],
    [{ fileOnAddress: true }, ADDRESS, SAMPLE],
    [{ radioOnAddress: true }, ADDRESS, SAMPLE],
    [{ checkboxOnAddress: true }, ADDRESS, SAMPLE],
    [{ selectOnAddress: true }, ADDRESS, SAMPLE],
    [{ nativeSelectOnAddress: true }, ADDRESS, SAMPLE],
    [{ cascaderOnAddress: true }, ADDRESS, SAMPLE],
    [{ noteAsInput: true }, NOTE, NOTE_PROFILE],
    [{ extraTextarea: true }, NOTE, NOTE_PROFILE],
    [{ readonlyNote: true }, NOTE, NOTE_PROFILE],
    [{ disabledNote: true }, NOTE, NOTE_PROFILE],
    [{ hiddenNote: true }, NOTE, NOTE_PROFILE],
    [{ plainTextarea: true }, NOTE, NOTE_PROFILE],
    [{ badNotePlaceholder: '请填写专业描述' }, NOTE, NOTE_PROFILE],
    [{ missingNotePlaceholder: true }, NOTE, NOTE_PROFILE],
    [{ duplicateNote: true }, NOTE, NOTE_PROFILE],
    [{ disagreeNote: '专业描述*' }, NOTE, NOTE_PROFILE],
    [{ fileOnNote: true }, NOTE, NOTE_PROFILE],
    [{ radioOnNote: true }, NOTE, NOTE_PROFILE],
    [{ checkboxOnNote: true }, NOTE, NOTE_PROFILE],
    [{ selectOnNote: true }, NOTE, NOTE_PROFILE],
    [{ nativeSelectOnNote: true }, NOTE, NOTE_PROFILE],
    [{ textOnNote: true }, NOTE, NOTE_PROFILE],
    [{ dropRoot: true }, ADDRESS, SAMPLE],
    [{ elForm: true }, ADDRESS, SAMPLE],
    [{ url: 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/mc/deliver/operationResumer' }, ADDRESS, SAMPLE],
    [{ url: 'https://gszq.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html' }, NOTE, NOTE_PROFILE],
    [{ url: 'http://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html' }, ADDRESS, SAMPLE],
    [{ busy: true }, NOTE, NOTE_PROFILE]
  ];
  for (const [state, label, value] of cases) {
    const h = await boot(state);
    try {
      const rowResult = await h.api.fillField(label, value);
      assert.equal(rowResult.ok, false, JSON.stringify({ state, row: rowResult }));
      assert.notEqual(rowResult.reason, 'readback_matched', JSON.stringify(state));
      assert.ok(['control_not_supported', 'control_busy', 'wrong_page'].includes(rowResult.reason), JSON.stringify({ state, row: rowResult }));
      assertNeverSaved(rowResult);
      assert.equal(h.stats.forbidden, 0, JSON.stringify(state));
      assert.equal(h.stats.option, 0, JSON.stringify(state));
      assert.equal(h.stats.file, 0, JSON.stringify(state));
      if (!state.dropRoot && !state.elForm && !state.url && !state.dropAntRow && !state.duplicateAddress && label === ADDRESS && !state.dropAntInput && !state.typeNumber) {
        assert.equal(valueOf(h.document, 'address-input') ?? '', '');
      }
      if (!state.dropRoot && !state.elForm && !state.url && !state.noteAsInput && !state.plainTextarea && label === NOTE) {
        assert.equal(valueOf(h.document, 'note-input') ?? '', '');
      }
      if (!state.dropRoot && !state.elForm) unchanged(h.document, h.stats);
    } finally { h.dom.window.close(); }
  }
});

test('a hidden page fails closed before a write', async () => {
  const h = await boot({});
  try {
    Object.defineProperty(h.document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    const address = await h.api.fillField(ADDRESS, SAMPLE);
    const note = await h.api.fillField(NOTE, NOTE_PROFILE);
    assert.equal(address.reason, 'fill_interrupted_page_hidden');
    assert.equal(note.reason, 'fill_interrupted_page_hidden');
    assertNeverSaved(address);
    assert.equal(h.stats.focus, 0);
    assert.equal(h.stats.textInput, 0);
    assert.equal(valueOf(h.document, 'address-input'), '');
    assert.equal(valueOf(h.document, 'note-input'), '');
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('wrong page and a drifted row do not cancel into a write', async () => {
  const wrong = await boot({ url: 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/social.html' });
  try {
    const view = wrong.api.inspect();
    assert.equal(view.reason, 'wrong_page');
    assert.equal(view.fields.length, 0);
    assert.equal(view.leftUnsaved, true);
    assert.equal(view.supportClaimed, false);
    const canceled = await wrong.api.cancelField(ADDRESS);
    assert.equal(canceled.reason, 'wrong_page');
    assert.equal(canceled.leftUnsaved, true);
    assert.equal(wrong.stats.escape, 0);
    assert.equal(wrong.stats.button, 0);
  } finally { wrong.dom.window.close(); }

  const drifted = await boot({ selectOnNote: true, address: SAMPLE });
  try {
    const view = drifted.api.inspect();
    assert.equal(view.ok, false);
    assert.equal(view.fields.find((field) => field.label === NOTE).reason, 'control_not_supported');
    assert.equal(view.fields.find((field) => field.label === NOTE).supported, false);
    assert.equal(view.fields.find((field) => field.label === ADDRESS).reason, 'structure_matched');
    const canceled = await drifted.api.cancelField(NOTE);
    assert.equal(canceled.reason, 'control_not_supported');
    assert.equal(canceled.leftUnsaved, true);
    assert.equal(valueOf(drifted.document, 'address-input'), SAMPLE);
    assert.equal(drifted.stats.textInput, 0);
    unchanged(drifted.document, drifted.stats);
  } finally { drifted.dom.window.close(); }
});
