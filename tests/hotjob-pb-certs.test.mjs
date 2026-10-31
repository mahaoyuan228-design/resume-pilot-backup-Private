// Offline Never-Save trials for hotjob pb certificate, English, and major-rank flat selects.
// Markup is built from tests/fixtures/hotjob-pb-certs-probe-dom.json (2026-10-23
// probe classes, labels, and captured display tokens only). A green run is not a live support claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../src/content/hotjob-pb-certs.js', import.meta.url), 'utf8');
const basicSource = readFileSync(new URL('../src/content/hotjob-pb-basic.js', import.meta.url), 'utf8');
const regionSource = readFileSync(new URL('../src/content/hotjob-pb-region.js', import.meta.url), 'utf8');
const eduSource = readFileSync(new URL('../src/content/hotjob-pb-edu-intent.js', import.meta.url), 'utf8');
const workSource = readFileSync(new URL('../src/content/hotjob-pb-work.js', import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../manifest.json', import.meta.url), 'utf8');
const engine = readFileSync(new URL('../src/content/engine.js', import.meta.url), 'utf8');
const popup = readFileSync(new URL('../src/popup/popup.js', import.meta.url), 'utf8');
const cmsBasic = readFileSync(new URL('../src/background/cms-basic-auto.mjs', import.meta.url), 'utf8');
const cmsEdu = readFileSync(new URL('../src/background/cms-education-task-runner.mjs', import.meta.url), 'utf8');
const probe = JSON.parse(readFileSync(new URL('../tests/fixtures/hotjob-pb-certs-probe-dom.json', import.meta.url), 'utf8'));
const PAGE = `https://${probe.page.hostname}${probe.page.samplePath}`;
const FIELD = Object.fromEntries(probe.select.fields.map((field) => [field.key, field]));
const FORBIDDEN = probe.page.forbiddenButtons;
const LIVE = probe.select.liveReadback;
const CAPTURED = probe.select.fields.filter((field) => field.optionsSample.length === 1);
const PROFILE = Object.fromEntries(CAPTURED.map((field) => [field.label, field.valueSample]));

function esc(value) {
  return String(value).replace(/[&<>"]/gu, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function classes(value) {
  return String(value).split(/\s+/u).filter(Boolean);
}

function selectInner(field, value, state) {
  if (state.ambiguousValue && field.key === 'securities') {
    const prompt = `${LIVE.placeholderPrefix}${field.label}`;
    return `<span class="${esc(LIVE.selectedValueClass)}" id="${field.key}-value">${esc(field.valueSample)}</span><span class="${esc(LIVE.selectedValueClass)}">${esc(prompt)}</span>`;
  }
  const classMash = state.placeholderMash === 'class' || (field.key === 'score' && state.placeholderMash !== 'text');
  if (classMash) {
    const prompt = field.placeholder || `${LIVE.placeholderPrefix}${field.label}`;
    return `<span class="${esc(LIVE.placeholderClass)}">${esc(prompt)}</span><span class="${esc(LIVE.selectedValueClass)}" id="${field.key}-value">${esc(value)}</span>`;
  }
  const shown = state.placeholderMash === 'text' ? `${LIVE.placeholderPrefix}${field.label}${value}` : value;
  return `<span id="${field.key}-value">${esc(shown)}</span>`;
}

function selectField(field, value, state, controlClass) {
  const selectClass = controlClass || (state.dropAllowClear && field.key === 'securities'
    ? 'ant-select ant-select-enabled'
    : probe.select.controlClass);
  const trigger = state.dropSearch && field.key === 'securities'
    ? ''
    : `<input class="${esc(probe.select.triggerClass)}" type="text" value="">`;
  const extra = state.extraSelect && field.key === 'securities'
    ? `<div class="${esc(probe.select.controlClass)}"><span></span><input class="${esc(probe.select.triggerClass)}" type="text" value=""></div>`
    : '';
  const inner = selectInner(field, value, state);
  const bare = state.closedSearchBare && field.key === 'securities';
  const faced = !bare && (state.closedSearch || state.placeholderMash === 'class' || field.key === 'score')
    ? `<div class="${esc(LIVE.faceClass)}" role="${esc(LIVE.faceRole)}">${inner}</div>`
    : inner;
  const hidden = state.hiddenSelect && field.key === 'securities' ? ' hidden' : '';
  const itemClass = state.dropAntRow && field.key === 'securities' ? 'ant-form-item' : probe.page.itemClass;
  const noise = [];
  if (field.key === 'securities') {
    if (state.checkboxInside) noise.push(`<input class="${esc(probe.neighbors.research.controlClass)}" type="checkbox">`);
    if (state.radioInside) noise.push(`<input class="${esc(probe.neighbors.obey.controlClass)}" type="radio">`);
    if (state.textareaInside) noise.push(`<textarea class="${esc(probe.neighbors.certNote.controlClass)}"></textarea>`);
    if (state.fileInside) noise.push('<input type="file">');
    if (state.calendarInside) noise.push(`<input class="${esc(probe.neighbors.earned.controlClass)}" type="text" readonly value="">`);
    if (state.textInside) noise.push(`<input class="${esc(probe.neighbors.name.controlClass)}" type="text" value="">`);
    if (state.cascaderInside) noise.push(`<span class="${esc(probe.neighbors.residence.menuClass)}"></span>`);
  }
  return `<div class="${esc(itemClass)}" data-field="${field.key}"${hidden}><label>${esc(field.label)}*</label><span class="${esc(probe.page.childrenClass)}">${noise.join('')}<div class="${esc(selectClass)}" id="${field.key}-select">${faced}${trigger}</div>${extra}</span></div>`;
}

function optionsFor(field, state) {
  if (state.confirmOption && field?.key === 'securities') return ['确定'];
  if (state.emptyMenu && field?.key === 'securities') return [];
  const rows = [...(field?.optionsSample || [])];
  if (state.duplicateOption && field?.key === 'securities') rows.push(state.duplicateOption);
  return rows;
}

function neighborSelect(id, label, value, controlClass = probe.select.controlClass) {
  return `<div class="${esc(probe.page.itemClass)}" data-field="${id}"><label>${esc(label)}*</label><span class="${esc(probe.page.childrenClass)}"><div class="${esc(controlClass)}" id="${id}-select"><span id="${id}-value">${esc(value)}</span><input class="${esc(probe.select.triggerClass)}" type="text" value=""></div></span></div>`;
}

function neighborText(id, label, value, placeholder, controlClass) {
  const ph = placeholder ? ` placeholder="${esc(placeholder)}"` : '';
  return `<div class="${esc(probe.page.itemClass)}" data-field="${id}"><label>${esc(label)}</label><span class="${esc(probe.page.childrenClass)}"><input id="${id}-input" class="${esc(controlClass)}" type="text" readonly value="${esc(value)}"${ph}></span></div>`;
}

function neighborArea(id, label, value, placeholder, controlClass) {
  return `<div class="${esc(probe.page.itemClass)}" data-field="${id}"><label>${esc(label)}</label><span class="${esc(probe.page.childrenClass)}"><textarea id="${id}-input" class="${esc(controlClass)}" placeholder="${esc(placeholder)}">${esc(value)}</textarea></span></div>`;
}

function html(state) {
  const neighbor = probe.neighbors;
  const rootClass = state.dropRoot ? 'page-root' : probe.page.rootClass;
  const shell = state.elForm ? '<div class="el-form"></div>' : '';
  const dropdownClass = state.badDropdown
    ? 'ant-select-dropdown ant-select-dropdown-placement-bottomLeft'
    : probe.select.dropdownClass;
  const buttons = [...probe.page.buttonLabels, ...FORBIDDEN.filter((label) => !probe.page.buttonLabels.includes(label))]
    .map((label) => `<button type="button">${esc(label)}</button>`).join('');
  const fields = probe.select.fields.map((field) => selectField(field, state[field.key] ?? '', state)).join('');
  const rankCopy = state.duplicateRank
    ? selectField(FIELD.rank, '', state).replaceAll('id="rank-', 'id="rank-copy-').replace('data-field="rank"', 'data-field="rank-copy"')
    : '';
  const obey = neighbor.obey.options.map((text) => `<label><span><input class="${esc(neighbor.obey.controlClass)}" type="${esc(neighbor.obey.inputType)}" name="pb-obey"></span><span>${esc(text)}</span></label>`).join('');
  return `<!doctype html><body>${shell}<div class="${esc(rootClass)}"><div class="${esc(probe.page.contentClass)}">${fields}${rankCopy
  }${neighborArea('cert-note-1', neighbor.certNote.label, neighbor.certNote.token, neighbor.certNote.placeholder, neighbor.certNote.controlClass)
  }${neighborArea('cert-note-2', neighbor.certNote.label, neighbor.certNote.token, neighbor.certNote.placeholder, neighbor.certNote.controlClass)
  }${neighborText('earned', neighbor.earned.label, neighbor.earned.token, neighbor.earned.placeholder, neighbor.earned.controlClass)
  }${neighborText('edu-start', neighbor.eduStart.label, neighbor.eduStart.token, neighbor.eduStart.placeholder, neighbor.eduStart.controlClass)
  }${neighborSelect('school', neighbor.school.label, neighbor.school.token)
  }${neighborText('major', neighbor.major.label, neighbor.major.token, neighbor.major.placeholder, neighbor.major.controlClass)
  }${neighborArea('major-note', neighbor.majorNote.label, neighbor.majorNote.token, neighbor.majorNote.placeholder, neighbor.majorNote.controlClass)
  }${neighborSelect('nature', neighbor.nature.label, neighbor.nature.token)
  }${neighborText('name', neighbor.name.label, neighbor.name.token, neighbor.name.placeholder, neighbor.name.controlClass)
  }${neighborArea('note', neighbor.note.label, neighbor.note.token, neighbor.note.placeholder, neighbor.note.controlClass)
  }${`<div class="${esc(probe.page.itemClass)}"><label>${esc(neighbor.residence.label)}*</label><span class="${esc(probe.page.childrenClass)}"><span class="${esc(neighbor.residence.menuClass)}"><div class="${esc(neighbor.residence.controlClass)}" id="residence-select"><span id="residence-value">${esc(neighbor.residence.token)}</span></div></span></span></div>`
  }${`<div class="${esc(probe.page.itemClass)}"><label>${esc(neighbor.intent.label)}*</label><span class="${esc(probe.page.childrenClass)}"><span class="${esc(neighbor.intent.menuClass)}"><div class="${esc(neighbor.intent.controlClass)}" id="intent-select"><span id="intent-value">${esc(neighbor.intent.token)}</span></div></span></span></div>`
  }${neighborSelect('interview', neighbor.interview.label, neighbor.interview.token)
  }${`<div class="${esc(probe.page.itemClass)}"><label>${esc(neighbor.obey.label)}*</label><span class="${esc(probe.page.childrenClass)}">${obey}</span></div>`
  }${`<div class="${esc(probe.page.itemClass)}"><label>${esc(neighbor.research.label)}*</label><span class="${esc(probe.page.childrenClass)}"><label><input id="research" class="${esc(neighbor.research.controlClass)}" type="${esc(neighbor.research.inputType)}"><span>${esc(neighbor.research.option)}</span></label></span></div>`
  }${`<div class="${esc(neighbor.photo.itemClass)}"><label>${esc(neighbor.photo.label)}*</label><input id="photo" type="file"></div>`
  }${`<div class="${esc(neighbor.portrait.itemClass)}"><label>${esc(neighbor.portrait.label)}*</label><input id="portrait" type="file"></div>`
  }${buttons}</div></div><div class="${esc(dropdownClass)}" id="select-menu" hidden><ul id="select-options"></ul></div></body>`;
}

function hide(node, hidden) {
  node.hidden = hidden;
  node.style.display = hidden ? 'none' : '';
}

function closeWidgets(document) {
  for (const select of document.querySelectorAll('.ant-select')) {
    select.classList.remove('ant-select-open', 'ant-select-focused');
  }
  hide(document.getElementById('select-menu'), true);
}

function paintMenu(document, select, state) {
  const field = probe.select.fields.find((row) => select.id === `${row.key}-select`);
  const options = field ? optionsFor(field, state) : [probe.neighbors.interview.token];
  const list = document.getElementById('select-options');
  list.replaceChildren();
  for (const text of options) {
    const li = document.createElement('li');
    if (state.confirmOption && field?.key === 'securities') {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = text;
      li.appendChild(button);
    } else {
      li.textContent = text;
    }
    list.appendChild(li);
  }
  hide(document.getElementById('select-menu'), false);
}

function wire(document, state) {
  const stats = {
    open: 0, option: 0, escape: 0, forbidden: 0, button: 0, file: 0, radio: 0, checkbox: 0,
    openClass: '', triggerClass: '', faceClass: ''
  };
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (button) {
      stats.button += 1;
      if (FORBIDDEN.includes(button.textContent.trim())) stats.forbidden += 1;
    }
    if (event.target.matches?.('input[type="file"]')) stats.file += 1;
    if (event.target.matches?.('input.ant-radio-input')) stats.radio += 1;
    if (event.target.matches?.('input.ant-checkbox-input')) stats.checkbox += 1;
  }, true);
  for (const select of document.querySelectorAll('.ant-select')) {
    select.addEventListener('click', (event) => {
      if (document.getElementById('select-menu').contains(event.target)) return;
      stats.open += 1;
      if (event.target.classList?.contains(probe.select.triggerClass)) stats.triggerClass = probe.select.triggerClass;
      if (event.target.closest?.(`.${LIVE.faceClass}`)) stats.faceClass = LIVE.faceClass;
      select.classList.add(...classes(probe.select.openClass));
      stats.openClass = select.className;
      paintMenu(document, select, state);
    });
  }
  document.getElementById('select-menu').addEventListener('click', (event) => {
    const li = event.target.closest('li');
    if (!li || state.confirmOption) return;
    const select = document.querySelector('.ant-select.ant-select-open');
    if (!select) return;
    stats.option += 1;
    const slot = select.querySelector('.ant-select-selection-selected-value, [id$="-value"]');
    slot.textContent = li.textContent.trim();
    if (!state.keepOpen) closeWidgets(document);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    stats.escape += 1;
    if (state.ignoreEscape) return;
    closeWidgets(document);
  });
  if (state.busy) {
    const select = document.getElementById('securities-select');
    select.classList.add('ant-select-open', 'ant-select-focused');
    paintMenu(document, select, state);
  }
  return stats;
}

function patch(window, state) {
  window.Element.prototype.getClientRects = function () {
    if ((state.closedSearch || state.closedSearchBare) && this.classList?.contains(probe.select.triggerClass)) return [];
    if (state.zeroRectSelect && this.id === 'securities-select') return [];
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
  patch(window, state);
  const stats = wire(document, state);
  window.eval(source);
  return { dom, window, document, stats, api: window.ResumeHotjobPbCerts };
}

function textOf(document, id) {
  return document.getElementById(id).textContent;
}

function valueOf(document, id) {
  return document.getElementById(id).value;
}

function unchanged(document, stats) {
  const neighbor = probe.neighbors;
  assert.equal(valueOf(document, 'cert-note-1-input'), neighbor.certNote.token);
  assert.equal(valueOf(document, 'cert-note-2-input'), neighbor.certNote.token);
  assert.equal(valueOf(document, 'earned-input'), neighbor.earned.token);
  assert.equal(valueOf(document, 'edu-start-input'), neighbor.eduStart.token);
  assert.equal(textOf(document, 'school-value'), neighbor.school.token);
  assert.equal(valueOf(document, 'major-input'), neighbor.major.token);
  assert.equal(valueOf(document, 'major-note-input'), neighbor.majorNote.token);
  assert.equal(textOf(document, 'nature-value'), neighbor.nature.token);
  assert.equal(valueOf(document, 'name-input'), neighbor.name.token);
  assert.equal(valueOf(document, 'note-input'), neighbor.note.token);
  assert.equal(textOf(document, 'residence-value'), neighbor.residence.token);
  assert.equal(textOf(document, 'intent-value'), neighbor.intent.token);
  assert.equal(textOf(document, 'interview-value'), neighbor.interview.token);
  assert.equal([...document.querySelectorAll('input[name="pb-obey"]')].some((node) => node.checked), false);
  assert.equal(document.getElementById('research').checked, false);
  assert.equal(document.getElementById('photo').files.length, 0);
  assert.equal(document.getElementById('portrait').files.length, 0);
  assert.equal(stats.forbidden, 0);
  assert.equal(stats.file, 0);
  assert.equal(stats.radio, 0);
  assert.equal(stats.checkbox, 0);
}

test('source stays on the probed pb classes and does not claim support', () => {
  assert.match(source, /ResumeHotjobPbCerts/);
  assert.match(source, /liveSupportClaimed:\s*false/);
  assert.match(source, /supportClaimed:\s*false/);
  assert.match(source, /neverSave:\s*true/);
  assert.doesNotMatch(source, /liveSupportClaimed:\s*true/);
  assert.doesNotMatch(source, /supportClaimed:\s*true/);
  assert.doesNotMatch(source, /已支持/);
  assert.doesNotMatch(source, /hotjob-mc-basic|ResumeHotjobMc|ResumeHotjobPbBasic|ResumeHotjobPbRegion|ResumeHotjobPbWork|ResumeHotjobPbEdu|mc\/deliver|cms-region|engine\.js/);
  assert.doesNotMatch(source, /textContent\s*=/);
  assert.doesNotMatch(source, /\.value\s*=[^=]/);
  assert.doesNotMatch(source, /\.checked\s*=/);
  assert.doesNotMatch(source, /innerHTML/);
  assert.doesNotMatch(source, /\bexport\s/);
  assert.doesNotMatch(source, /ant-cascader-menus|form-cell|ant-select-selection--single|ant-radio-wrapper|ant-select-dropdown-menu-item/);
  assert.match(source, /保存\|提交\|投递\|删除\|下一步\|返回\|确定/);
  assert.equal(manifest.includes('hotjob-pb-certs'), false);
  assert.equal(engine.includes('hotjob-pb-certs'), false);
  assert.equal(basicSource.includes('hotjob-pb-certs'), false);
  assert.equal(regionSource.includes('hotjob-pb-certs'), false);
  assert.equal(eduSource.includes('hotjob-pb-certs'), false);
  assert.equal(workSource.includes('hotjob-pb-certs'), false);
  assert.equal(popup.includes('hotjob-pb-certs'), false);
  assert.equal(cmsBasic.includes('hotjob-pb-certs'), false);
  assert.equal(cmsEdu.includes('hotjob-pb-certs'), false);
  assert.doesNotMatch(source, /1\d{10}/);
  for (const field of probe.select.fields) {
    if (field.valueSample) assert.doesNotMatch(source, new RegExp(field.valueSample.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  }
  assert.doesNotMatch(source, /无排名|雅思|未通过/);
  for (const token of [
    ...classes(probe.page.itemClass),
    ...classes(probe.select.controlClass),
    probe.select.triggerClass,
    ...classes(probe.select.dropdownClass),
    ...classes(probe.select.openClass),
    probe.page.rootClass,
    'ant-calendar-picker-input',
    LIVE.selectedValueClass,
    LIVE.placeholderClass,
    LIVE.placeholderPrefix,
    LIVE.faceClass,
    '[role="combobox"]',
    '.ant-select-selector',
    '.ant-select-selection-item',
    ...probe.select.fields.map((field) => field.label)
  ]) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  }
});

test('fixture html uses only the probe class list, labels, and captured tokens', () => {
  const built = html({});
  for (const token of [
    probe.page.rootClass, probe.page.contentClass, probe.page.childrenClass,
    ...classes(probe.page.itemClass),
    ...classes(probe.select.controlClass), probe.select.triggerClass,
    ...classes(probe.select.dropdownClass),
    probe.neighbors.earned.controlClass, probe.neighbors.residence.menuClass,
    probe.neighbors.photo.itemClass, probe.neighbors.portrait.itemClass,
    probe.neighbors.research.controlClass, probe.neighbors.obey.controlClass
  ]) assert.match(built, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  for (const field of probe.select.fields) assert.match(built, new RegExp(`>${field.label}\\*`));
  for (const field of CAPTURED) {
    assert.deepEqual(field.optionsSample, [field.valueSample]);
    assert.equal(built.includes(`>${field.valueSample}<`), false);
  }
  assert.deepEqual(FIELD.score.optionsSample, []);
  assert.equal(FIELD.score.placeholder, `${LIVE.placeholderPrefix}${FIELD.score.label}`);
  assert.match(built, new RegExp(`>${FIELD.score.placeholder}<`));
  for (const label of probe.page.buttonLabels) assert.match(built, new RegExp(`>${label}<`));
  assert.doesNotMatch(built, /ant-radio-wrapper|ant-select-selection--single|ant-cascader-menus|ant-select-dropdown-menu-item/);
  assert.doesNotMatch(built, /1\d{10}/);
  assert.doesNotMatch(JSON.stringify(probe), /1\d{10}|悉尼|@/);
});

test('inspect matches the eight probed selects and reads the score placeholder as empty', async () => {
  const state = Object.fromEntries(CAPTURED.map((field) => [field.key, field.valueSample]));
  const h = await boot(state);
  try {
    const view = h.api.inspect();
    assert.equal(h.api.liveSupportClaimed, false);
    assert.equal(h.api.supportClaimed, false);
    assert.equal(h.api.neverSave, true);
    assert.equal(h.window.ResumeHotjobPbBasic, undefined);
    assert.equal(h.window.ResumeHotjobPbRegion, undefined);
    assert.equal(h.window.ResumeHotjobPbWork, undefined);
    assert.equal(h.window.ResumeHotjobPbEduIntent, undefined);
    assert.equal(view.liveSupportClaimed, false);
    assert.equal(view.supportClaimed, false);
    assert.equal(view.neverSave, true);
    assert.equal(view.saved, false);
    assert.equal(view.complete, false);
    assert.equal(view.fields.length, 8);
    assert.equal(view.fields.every((field) => field.supported === false), true);
    assert.equal(view.fields.every((field) => field.kind === 'select'), true);
    assert.equal(view.fields.every((field) => field.reason === 'structure_matched'), true);
    for (const field of CAPTURED) {
      assert.equal(view.fields.find((row) => row.label === field.label).value, field.valueSample, field.label);
    }
    const score = view.fields.find((row) => row.label === FIELD.score.label);
    assert.equal(score.value, '');
    assert.equal(view.fields.map((field) => field.label).includes(probe.neighbors.certNote.label), false);
    assert.equal(view.fields.map((field) => field.label).includes(probe.neighbors.nature.label), false);
    assert.equal(h.stats.open, 0);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('empty captured selects read back the probed token and do not claim support', async () => {
  const h = await boot({});
  try {
    const rows = [];
    for (const field of CAPTURED) rows.push(await h.api.fillField(field.label, ` ${field.valueSample} `));
    for (const row of rows) {
      assert.equal(row.ok, true, JSON.stringify(row));
      assert.equal(row.reason, 'readback_matched');
      assert.equal(row.status, 'verified');
      assert.equal(row.after, row.expected);
      assert.equal(row.opened, true);
      assert.equal(row.canceled, false);
      assert.equal(row.stillOpen, 0);
      assert.equal(row.liveSupportClaimed, false);
      assert.equal(row.supportClaimed, false);
      assert.equal(row.neverSave, true);
      assert.equal(row.saved, false);
      assert.equal(row.skippedSave, true);
      assert.equal(row.complete, false);
      assert.equal(row.softwareClickedSave, false);
    }
    assert.equal(h.stats.triggerClass, probe.select.triggerClass);
    assert.equal(h.stats.faceClass, '');
    assert.match(h.stats.openClass, /ant-select-open/);
    assert.match(h.stats.openClass, /ant-select-focused/);
    assert.match(h.stats.openClass, /ant-select-enabled/);
    assert.equal(h.stats.option, CAPTURED.length);
    assert.equal(h.stats.button, 0);
    assert.equal(h.document.querySelectorAll('.ant-select-open').length, 0);
    assert.equal(h.document.getElementById('select-menu').hidden, true);
    for (const field of CAPTURED) {
      assert.equal(h.document.getElementById(`${field.key}-value`).textContent, field.valueSample, field.label);
    }
    assert.equal(h.document.getElementById('score-value').textContent, '');
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('fillFields paints captured tokens and fails closed on 成绩 without a captured option', async () => {
  const h = await boot({});
  try {
    const filled = await h.api.fillFields({ ...PROFILE, [FIELD.score.label]: FIELD.score.inventoryValueSample });
    assert.equal(filled.ok, false);
    assert.equal(filled.liveSupportClaimed, false);
    assert.equal(filled.supportClaimed, false);
    assert.equal(filled.saved, false);
    assert.equal(filled.complete, false);
    assert.equal(filled.neverSave, true);
    for (const field of CAPTURED) {
      const row = filled.fields.find((item) => item.label === field.label);
      assert.equal(row.reason, 'readback_matched', field.label);
      assert.equal(row.after, field.valueSample, field.label);
    }
    const score = filled.fields.find((item) => item.label === FIELD.score.label);
    assert.equal(score.ok, false);
    assert.equal(score.reason, 'control_not_supported', JSON.stringify(score));
    assert.equal(score.after, '');
    assert.equal(score.opened, true);
    assert.equal(score.canceled, true);
    assert.equal(score.stillOpen, 0);
    assert.equal(h.document.getElementById('score-value').textContent, '');
    assert.equal(h.document.querySelector('#score-select .ant-select-selection__placeholder').textContent, FIELD.score.placeholder);
    assert.equal(h.document.getElementById('select-menu').hidden, true);
    assert.equal(h.stats.option, CAPTURED.length);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('preexisting same display values, including a placeholder mash, do not reopen', async () => {
  const state = { placeholderMash: 'text' };
  for (const field of CAPTURED) state[field.key] = field.valueSample;
  const h = await boot(state);
  try {
    for (const field of CAPTURED) {
      const row = await h.api.fillField(field.label, ` ${field.valueSample} `);
      assert.equal(row.reason, 'preexisting_same_value', JSON.stringify(row));
      assert.equal(row.status, 'verified');
      assert.equal(row.ok, true);
      assert.equal(row.before, field.valueSample);
      assert.equal(row.opened, false);
      assert.equal(row.saved, false);
      assert.equal(row.liveSupportClaimed, false);
      assert.equal(h.document.getElementById(`${field.key}-value`).textContent, `${LIVE.placeholderPrefix}${field.label}${field.valueSample}`);
    }
    const score = await h.api.fillField(FIELD.score.label, FIELD.score.inventoryValueSample);
    assert.notEqual(score.reason, 'preexisting_same_value');
    assert.equal(score.ok, false);
    assert.equal(score.before, '');
    assert.equal(h.stats.option, 0);
    assert.equal(h.document.getElementById('score-value').textContent, `${LIVE.placeholderPrefix}${FIELD.score.label}`);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a placeholder class is ignored and the selected token is kept without opening', async () => {
  const state = { placeholderMash: 'class' };
  for (const field of CAPTURED) state[field.key] = field.valueSample;
  const h = await boot(state);
  try {
    const view = h.api.inspect();
    assert.equal(view.liveSupportClaimed, false);
    for (const field of CAPTURED) {
      const row = view.fields.find((item) => item.label === field.label);
      assert.equal(row.value, field.valueSample, field.label);
      const filled = await h.api.fillField(field.label, field.valueSample);
      assert.equal(filled.reason, 'preexisting_same_value', JSON.stringify(filled));
      assert.equal(filled.opened, false);
    }
    assert.equal(view.fields.find((row) => row.label === FIELD.score.label).value, '');
    assert.equal(h.stats.open, 0);
    const rank = h.document.querySelector('#rank-select .ant-select-selection-selected-value');
    const prompt = h.document.querySelector('#rank-select .ant-select-selection__placeholder');
    assert.equal(rank.textContent, FIELD.rank.valueSample);
    assert.equal(prompt.textContent, `${LIVE.placeholderPrefix}${FIELD.rank.label}`);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a different existing value is kept and nothing is opened', async () => {
  const h = await boot({ english: FIELD.english.valueSample, securities: FIELD.securities.valueSample });
  try {
    const english = await h.api.fillField(FIELD.english.label, FIELD.securities.valueSample);
    const securities = await h.api.fillField(FIELD.securities.label, FIELD.english.valueSample);
    assert.equal(english.reason, 'existing_value');
    assert.equal(english.status, 'skipped');
    assert.equal(english.ok, false);
    assert.equal(english.opened, false);
    assert.equal(securities.reason, 'existing_value');
    assert.equal(securities.ok, false);
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.option, 0);
    assert.equal(h.document.getElementById('english-value').textContent, FIELD.english.valueSample);
    assert.equal(h.document.getElementById('securities-value').textContent, FIELD.securities.valueSample);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('empty values, unknown options, and out-of-scope labels fail closed', async () => {
  const h = await boot({});
  try {
    for (const value of ['', '   ', null, 1]) {
      const row = await h.api.fillField(FIELD.rank.label, value);
      assert.equal(row.reason, 'missing_profile_value', String(value));
      assert.equal(row.ok, false);
      assert.equal(row.opened, false);
    }
    const unknown = await h.api.fillField(FIELD.securities.label, FIELD.english.valueSample);
    assert.equal(unknown.reason, 'option_not_found', JSON.stringify(unknown));
    assert.equal(unknown.opened, true);
    assert.equal(unknown.canceled, true);
    assert.equal(unknown.stillOpen, 0);
    assert.equal(unknown.after, '');
    assert.ok(h.stats.escape >= 1);
    assert.equal(h.stats.option, 0);
    assert.equal(h.document.getElementById('securities-value').textContent, '');
    assert.equal(h.document.getElementById('select-menu').hidden, true);
    for (const label of [
      probe.neighbors.certNote.label,
      probe.neighbors.earned.label,
      probe.neighbors.eduStart.label,
      probe.neighbors.school.label,
      probe.neighbors.major.label,
      probe.neighbors.majorNote.label,
      probe.neighbors.nature.label,
      probe.neighbors.name.label,
      probe.neighbors.note.label,
      probe.neighbors.residence.label,
      probe.neighbors.intent.label,
      probe.neighbors.interview.label,
      probe.neighbors.obey.label,
      probe.neighbors.research.label,
      probe.neighbors.photo.label,
      probe.neighbors.portrait.label,
      '移动电话',
      '学位',
      '学历',
      '期望工作性质'
    ]) {
      const row = await h.api.fillField(label, FIELD.rank.valueSample);
      assert.equal(row.reason, 'label_not_allowed', label);
      assert.equal(row.ok, false);
    }
    const none = await h.api.fillFields(null);
    assert.equal(none.ok, false);
    assert.equal(none.liveSupportClaimed, false);
    assert.equal(none.fields.every((field) => field.reason === 'missing_profile_value'), true);
    assert.equal(h.document.getElementById('rank-value').textContent, '');
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('Escape closes an open flat select and does not change the value', async () => {
  const h = await boot({ securities: '', rank: FIELD.rank.valueSample });
  try {
    const canceled = await h.api.cancelField(FIELD.securities.label);
    assert.equal(canceled.ok, true, JSON.stringify(canceled));
    assert.equal(canceled.reason, 'menu_closed');
    assert.equal(canceled.canceled, true);
    assert.equal(canceled.stillOpen, 0);
    assert.equal(canceled.before, '');
    assert.equal(canceled.after, '');
    assert.equal(canceled.liveSupportClaimed, false);
    assert.equal(canceled.saved, false);
    assert.equal(h.stats.open, 1);
    assert.equal(h.stats.option, 0);
    assert.equal(h.stats.button, 0);
    assert.ok(h.stats.escape >= 1);
    assert.equal(h.document.getElementById('select-menu').hidden, true);
    assert.equal(h.document.querySelectorAll('.ant-select-open').length, 0);
    assert.equal(h.document.getElementById('rank-value').textContent, FIELD.rank.valueSample);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a menu that ignores Escape fails closed and does not keep a painted value', async () => {
  const h = await boot({ ignoreEscape: true });
  try {
    const canceled = await h.api.cancelField(FIELD.cpa.label);
    assert.equal(canceled.ok, false);
    assert.equal(canceled.reason, 'menu_cleanup_failed');
    assert.equal(canceled.stillOpen, 1);
    assert.equal(canceled.after, '');
    assert.equal(h.stats.option, 0);
    const blocked = await h.api.fillField(FIELD.bar.label, FIELD.bar.valueSample);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.reason, 'control_busy');
    assert.equal(h.document.getElementById('bar-value').textContent, '');
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('duplicate options and a confirm button fail closed before a write', async () => {
  const ambiguous = await boot({ duplicateOption: FIELD.securities.valueSample });
  try {
    const row = await ambiguous.api.fillField(FIELD.securities.label, FIELD.securities.valueSample);
    assert.equal(row.reason, 'ambiguous_option', JSON.stringify(row));
    assert.equal(row.after, '');
    assert.equal(row.stillOpen, 0);
    assert.equal(ambiguous.stats.option, 0);
    assert.equal(ambiguous.document.getElementById('select-menu').hidden, true);
    unchanged(ambiguous.document, ambiguous.stats);
  } finally { ambiguous.dom.window.close(); }

  const confirm = await boot({ confirmOption: true });
  try {
    const row = await confirm.api.fillField(FIELD.securities.label, '确定');
    assert.equal(row.reason, 'never_save', JSON.stringify(row));
    assert.equal(row.ok, false);
    assert.equal(row.canceled, true);
    assert.equal(row.stillOpen, 0);
    assert.equal(confirm.stats.option, 0);
    assert.equal(confirm.stats.button, 0);
    assert.equal(confirm.stats.forbidden, 0);
    assert.equal(confirm.document.getElementById('securities-value').textContent, '');
    assert.equal(confirm.document.getElementById('select-menu').hidden, true);
  } finally { confirm.dom.window.close(); }
});

test('two selected display tokens fail closed before a click', async () => {
  const h = await boot({ ambiguousValue: true, securities: FIELD.securities.valueSample });
  try {
    const view = h.api.inspect();
    assert.equal(view.ok, false);
    assert.equal(view.fields.find((field) => field.label === FIELD.securities.label).reason, 'control_not_supported');
    const row = await h.api.fillField(FIELD.securities.label, FIELD.securities.valueSample);
    assert.equal(row.reason, 'control_not_supported');
    assert.equal(row.opened, false);
    assert.equal(h.stats.open, 0);
    assert.equal(h.document.getElementById('securities-value').textContent, FIELD.securities.valueSample);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('missing, duplicate, and drifted controls fail closed', async () => {
  const cases = [
    [{ dropSearch: true }, FIELD.securities.label, FIELD.securities.valueSample],
    [{ closedSearchBare: true }, FIELD.securities.label, FIELD.securities.valueSample],
    [{ dropAllowClear: true }, FIELD.securities.label, FIELD.securities.valueSample],
    [{ extraSelect: true }, FIELD.securities.label, FIELD.securities.valueSample],
    [{ dropAntRow: true }, FIELD.securities.label, FIELD.securities.valueSample],
    [{ hiddenSelect: true }, FIELD.securities.label, FIELD.securities.valueSample],
    [{ zeroRectSelect: true }, FIELD.securities.label, FIELD.securities.valueSample],
    [{ ambiguousValue: true }, FIELD.securities.label, FIELD.securities.valueSample],
    [{ checkboxInside: true }, FIELD.securities.label, FIELD.securities.valueSample],
    [{ radioInside: true }, FIELD.securities.label, FIELD.securities.valueSample],
    [{ textareaInside: true }, FIELD.securities.label, FIELD.securities.valueSample],
    [{ fileInside: true }, FIELD.securities.label, FIELD.securities.valueSample],
    [{ calendarInside: true }, FIELD.securities.label, FIELD.securities.valueSample],
    [{ textInside: true }, FIELD.securities.label, FIELD.securities.valueSample],
    [{ cascaderInside: true }, FIELD.securities.label, FIELD.securities.valueSample],
    [{ duplicateRank: true }, FIELD.rank.label, FIELD.rank.valueSample],
    [{ badDropdown: true }, FIELD.cpa.label, FIELD.cpa.valueSample],
    [{ emptyMenu: true }, FIELD.securities.label, FIELD.securities.valueSample],
    [{ busy: true }, FIELD.bar.label, FIELD.bar.valueSample],
    [{ dropRoot: true }, FIELD.rank.label, FIELD.rank.valueSample],
    [{ elForm: true }, FIELD.rank.label, FIELD.rank.valueSample],
    [{ url: 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/mc/deliver/operationResumer' }, FIELD.frm.label, FIELD.frm.valueSample],
    [{ url: 'https://gszq.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html' }, FIELD.cfa.label, FIELD.cfa.valueSample]
  ];
  for (const [state, label, value] of cases) {
    const h = await boot(state);
    try {
      const row = await h.api.fillField(label, value);
      assert.notEqual(row.reason, 'readback_matched', JSON.stringify(state));
      assert.equal(row.ok, false, JSON.stringify({ state, row }));
      assert.ok(['control_not_supported', 'control_busy', 'wrong_page'].includes(row.reason), JSON.stringify({ state, row }));
      assert.equal(row.liveSupportClaimed, false);
      assert.equal(row.supportClaimed, false);
      assert.equal(h.stats.option, 0, JSON.stringify(state));
      assert.equal(h.stats.forbidden, 0, JSON.stringify(state));
      assert.equal(h.stats.file, 0, JSON.stringify(state));
      assert.equal(h.stats.button, 0, JSON.stringify(state));
    } finally { h.dom.window.close(); }
  }
});

test('an empty closed flat select opens from the visible face and reads the selected token', async () => {
  const h = await boot({ closedSearch: true });
  try {
    const rank = await h.api.fillField(FIELD.rank.label, FIELD.rank.valueSample);
    assert.equal(rank.ok, true, JSON.stringify(rank));
    assert.equal(rank.reason, 'readback_matched');
    assert.equal(rank.after, FIELD.rank.valueSample);
    assert.equal(rank.before, '');
    assert.equal(rank.opened, true);
    assert.equal(rank.stillOpen, 0);
    assert.equal(rank.liveSupportClaimed, false);
    assert.equal(rank.saved, false);
    assert.equal(rank.neverSave, true);
    assert.equal(h.stats.open, 1);
    assert.equal(h.stats.option, 1);
    assert.equal(h.stats.triggerClass, '');
    assert.equal(h.stats.faceClass, LIVE.faceClass);
    assert.equal(h.document.getElementById('rank-value').textContent, FIELD.rank.valueSample);
    assert.equal(h.document.getElementById('select-menu').hidden, true);
    const english = await h.api.fillField(FIELD.english.label, FIELD.english.valueSample);
    const cfa = await h.api.fillField(FIELD.cfa.label, FIELD.cfa.valueSample);
    assert.equal(english.reason, 'readback_matched');
    assert.equal(cfa.reason, 'readback_matched');
    assert.equal(h.stats.faceClass, LIVE.faceClass);
    assert.equal(h.stats.triggerClass, '');
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a hidden page fails closed before a click', async () => {
  const h = await boot({});
  try {
    Object.defineProperty(h.document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    const row = await h.api.fillField(FIELD.rank.label, FIELD.rank.valueSample);
    const score = await h.api.fillField(FIELD.score.label, FIELD.score.inventoryValueSample);
    assert.equal(row.reason, 'fill_interrupted_page_hidden');
    assert.equal(score.reason, 'fill_interrupted_page_hidden');
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.option, 0);
    assert.equal(row.liveSupportClaimed, false);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

// These are negative mutations of the captured fixture, not additional supported
// page layouts, certificate choices, or live-site evidence.
function neverSaved(row, stats) {
  assert.equal(row.liveSupportClaimed, false);
  assert.equal(row.supportClaimed, false);
  assert.equal(row.neverSave, true);
  assert.equal(row.saved, false);
  assert.equal(row.softwareClickedSave, false);
  assert.equal(row.softwareClickedSubmit, false);
  assert.equal(row.softwareClickedDeliver, false);
  assert.equal(row.softwareClickedDelete, false);
  assert.equal(row.softwareClickedNext, false);
  assert.equal(stats.forbidden, 0);
  assert.equal(stats.button, 0);
}

const OWNERSHIP_MUTATIONS = {
  'matching row outside the only wrapper': (h) => {
    h.document.body.append(h.document.querySelector('[data-field="securities"]'));
  },
  'second empty wrapper': (h) => {
    const extra = h.document.createElement('div');
    extra.className = probe.page.rootClass;
    h.document.body.append(extra);
  },
  'nested wrapper': (h) => {
    const inner = h.document.createElement('div');
    inner.className = probe.page.rootClass;
    h.document.querySelector(`.${probe.page.rootClass}`).append(inner);
  },
  'hidden wrapper': (h) => {
    h.document.querySelector(`.${probe.page.rootClass}`).hidden = true;
  },
  'hidden form item with visible-looking control': (h) => {
    h.document.querySelector('[data-field="securities"]').style.visibility = 'hidden';
  },
  'disabled search input': (h) => {
    h.document.querySelector('#securities-select input').disabled = true;
  },
  'readonly search input': (h) => {
    h.document.querySelector('#securities-select input').readOnly = true;
  }
};

for (const [name, mutate] of Object.entries(OWNERSHIP_MUTATIONS)) {
  for (const operation of ['fill', 'cancel']) {
    test(`${operation} refuses ${name} before any click`, async () => {
      const h = await boot();
      try {
        mutate(h);
        const inspection = h.api.inspect().fields.find((field) => field.label === FIELD.securities.label);
        assert.notEqual(inspection?.reason, 'structure_matched');
        const row = operation === 'fill'
          ? await h.api.fillField(FIELD.securities.label, FIELD.securities.valueSample)
          : await h.api.cancelField(FIELD.securities.label);
        assert.equal(row.ok, false, JSON.stringify(row));
        assert.equal(h.stats.open, 0);
        assert.equal(h.stats.option, 0);
        neverSaved(row, h.stats);
        unchanged(h.document, h.stats);
      } finally { h.dom.window.close(); }
    });
  }
}

const OPEN_MUTATIONS = {
  'row moved outside wrapper': (h, select) => h.document.body.append(select.closest('.ant-form-item')),
  'select moved outside its row': (h, select) => h.document.querySelector(`.${probe.page.rootClass}`).append(select),
  'row replaced by an identical clone': (_h, select) => {
    const item = select.closest('.ant-form-item');
    item.replaceWith(item.cloneNode(true));
  },
  'root replaced by an identical clone': (h) => {
    const root = h.document.querySelector(`.${probe.page.rootClass}`);
    root.replaceWith(root.cloneNode(true));
  },
  'label changed': (_h, select) => { select.closest('.ant-form-item').querySelector('label').textContent = FIELD.cpa.label; },
  'row hidden': (_h, select) => { select.closest('.ant-form-item').hidden = true; },
  'select disabled': (_h, select) => { select.classList.add('ant-select-disabled'); },
  'search replaced': (_h, select) => {
    const search = select.querySelector('input');
    search.replaceWith(search.cloneNode(true));
  },
  'search disabled': (_h, select) => { select.querySelector('input').disabled = true; },
  'page hidden': (h) => {
    Object.defineProperty(h.document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  },
  'same PB path with another resume query': (h) => { h.window.history.replaceState({}, '', '?resumeId=changed'); },
  'second wrapper inserted': (h) => {
    const root = h.document.createElement('div');
    root.className = probe.page.rootClass;
    h.document.body.append(root);
  },
  'mixed textarea inserted': (h, select) => {
    const textarea = h.document.createElement('textarea');
    textarea.className = probe.neighbors.certNote.controlClass;
    select.parentElement.append(textarea);
  }
};

for (const [name, mutate] of Object.entries(OPEN_MUTATIONS)) {
  for (const operation of ['fill', 'cancel']) {
    test(`${operation} stops after opening when ${name}`, async () => {
      const h = await boot();
      try {
        const select = h.document.getElementById('securities-select');
        const display = h.document.getElementById('securities-value');
        select.addEventListener('click', () => mutate(h, select), { once: true });
        const row = operation === 'fill'
          ? await h.api.fillField(FIELD.securities.label, FIELD.securities.valueSample)
          : await h.api.cancelField(FIELD.securities.label);
        assert.equal(row.ok, false, JSON.stringify(row));
        assert.equal(h.stats.open, 1);
        assert.equal(h.stats.option, 0);
        assert.equal(display.textContent, '');
        assert.equal(h.document.getElementById('select-menu').hidden, true);
        assert.equal(row.stillOpen, 0);
        neverSaved(row, h.stats);
        unchanged(h.document, h.stats);
      } finally { h.dom.window.close(); }
    });
  }
}

for (const occupied of [FIELD.securities.valueSample, FIELD.english.valueSample]) {
  test(`an intervening display edit (${occupied}) is preserved without clicking an option`, async () => {
    const h = await boot();
    try {
      const display = h.document.getElementById('securities-value');
      h.document.getElementById('securities-select').addEventListener('click', () => {
        display.textContent = occupied;
      }, { once: true });
      const row = await h.api.fillField(FIELD.securities.label, FIELD.securities.valueSample);
      assert.equal(row.ok, false, JSON.stringify(row));
      assert.equal(display.textContent, occupied);
      assert.equal(h.stats.option, 0);
      assert.equal(row.stillOpen, 0);
      neverSaved(row, h.stats);
      unchanged(h.document, h.stats);
    } finally { h.dom.window.close(); }
  });
}

const OPTION_MUTATIONS = {
  'option detached': (_h, option) => option.remove(),
  'option replaced': (_h, option) => option.replaceWith(option.cloneNode(true)),
  'option moved outside dropdown': (h, option) => h.document.body.append(option),
  'option hidden': (_h, option) => { option.hidden = true; },
  'option text changed': (_h, option) => { option.textContent = FIELD.english.valueSample; },
  'dropdown replaced': (h) => {
    const menu = h.document.getElementById('select-menu');
    menu.replaceWith(menu.cloneNode(true));
  }
};

for (const [name, mutate] of Object.entries(OPTION_MUTATIONS)) {
  test(`an option captured before await is not clicked after ${name}`, async () => {
    const h = await boot();
    try {
      let staleClicks = 0;
      h.document.getElementById('securities-select').addEventListener('click', () => {
        const option = h.document.querySelector('#select-options li');
        option.addEventListener('click', () => { staleClicks += 1; });
        h.window.queueMicrotask(() => mutate(h, option));
      }, { once: true });
      const row = await h.api.fillField(FIELD.securities.label, FIELD.securities.valueSample);
      assert.equal(row.ok, false, JSON.stringify(row));
      assert.equal(staleClicks, 0);
      assert.equal(h.stats.option, 0);
      assert.equal(h.document.getElementById('securities-value').textContent, '');
      assert.equal(row.stillOpen, 0);
      neverSaved(row, h.stats);
      unchanged(h.document, h.stats);
    } finally { h.dom.window.close(); }
  });
}

for (const operation of ['fill', 'cancel']) {
  test(`${operation} preserves a menu that was already busy`, async () => {
    const h = await boot({ busy: true });
    try {
      const row = operation === 'fill'
        ? await h.api.fillField(FIELD.securities.label, FIELD.securities.valueSample)
        : await h.api.cancelField(FIELD.securities.label);
      assert.equal(row.reason, 'control_busy');
      assert.equal(h.stats.open, 0);
      assert.equal(h.stats.option, 0);
      assert.equal(h.stats.escape, 0);
      assert.equal(h.document.getElementById('select-menu').hidden, false);
      neverSaved(row, h.stats);
      unchanged(h.document, h.stats);
    } finally { h.dom.window.close(); }
  });
}

for (const mutate of ['row', 'URL', 'visibility']) {
  test(`a painted value cannot verify after option click changes ${mutate}`, async () => {
    const h = await boot();
    try {
      h.document.getElementById('select-menu').addEventListener('click', () => {
        if (mutate === 'row') h.document.body.append(h.document.querySelector('[data-field="securities"]'));
        if (mutate === 'URL') h.window.history.replaceState({}, '', '?resumeId=changed');
        if (mutate === 'visibility') {
          Object.defineProperty(h.document, 'visibilityState', { configurable: true, get: () => 'hidden' });
        }
      }, { once: true });
      const row = await h.api.fillField(FIELD.securities.label, FIELD.securities.valueSample);
      assert.equal(h.stats.option, 1);
      assert.equal(row.ok, false, JSON.stringify(row));
      assert.notEqual(row.status, 'verified');
      assert.equal(row.stillOpen, 0);
      neverSaved(row, h.stats);
      unchanged(h.document, h.stats);
    } finally { h.dom.window.close(); }
  });
}

test('cancel on an initially hidden page does not open or Escape a menu', async () => {
  const h = await boot();
  try {
    Object.defineProperty(h.document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    const row = await h.api.cancelField(FIELD.securities.label);
    assert.equal(row.ok, false);
    assert.equal(row.reason, 'fill_interrupted_page_hidden');
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.option, 0);
    assert.equal(h.stats.escape, 0);
    neverSaved(row, h.stats);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

for (const operation of ['fill', 'cancel']) {
  test(`${operation} rejects replacing the visible face while the original search remains`, async () => {
    const h = await boot({ closedSearch: true });
    try {
      const select = h.document.getElementById('securities-select');
      select.addEventListener('click', () => {
        const face = select.querySelector(`.${LIVE.faceClass}`);
        face.replaceWith(face.cloneNode(true));
      }, { once: true });
      const row = operation === 'fill'
        ? await h.api.fillField(FIELD.securities.label, FIELD.securities.valueSample)
        : await h.api.cancelField(FIELD.securities.label);
      assert.equal(row.ok, false, JSON.stringify(row));
      assert.equal(h.stats.open, 1);
      assert.equal(h.stats.option, 0);
      assert.equal(row.stillOpen, 0);
      assert.equal(h.document.getElementById('securities-value').textContent, '');
      neverSaved(row, h.stats);
      unchanged(h.document, h.stats);
    } finally { h.dom.window.close(); }
  });
}

test('cancel cannot verify when Escape changes the resume URL', async () => {
  const h = await boot();
  try {
    h.document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') h.window.history.replaceState({}, '', '?resumeId=changed');
    }, { once: true });
    const row = await h.api.cancelField(FIELD.securities.label);
    assert.equal(row.ok, false, JSON.stringify(row));
    assert.notEqual(row.status, 'verified');
    assert.equal(h.stats.open, 1);
    assert.equal(h.stats.option, 0);
    assert.equal(row.stillOpen, 0);
    neverSaved(row, h.stats);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a second open select after await cannot redirect the option into an occupied neighbor', async () => {
  const h = await boot({ rank: FIELD.rank.valueSample });
  try {
    h.document.getElementById('securities-select').addEventListener('click', () => {
      h.window.queueMicrotask(() => {
        h.document.getElementById('rank-select').classList.add('ant-select-open', 'ant-select-focused');
      });
    }, { once: true });
    const row = await h.api.fillField(FIELD.securities.label, FIELD.securities.valueSample);
    assert.equal(row.ok, false, JSON.stringify(row));
    assert.equal(h.stats.option, 0);
    assert.equal(h.document.getElementById('rank-value').textContent, FIELD.rank.valueSample);
    assert.equal(h.document.getElementById('securities-value').textContent, '');
    assert.equal(row.stillOpen, 0);
    neverSaved(row, h.stats);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

for (const context of ['URL', 'root', 'visibility']) {
  test(`fillFields pins the original ${context} for the entire batch`, async () => {
    const h = await boot();
    try {
      h.document.getElementById('rank-select').addEventListener('click', () => {
        if (context === 'URL') h.window.history.replaceState({}, '', '?resumeId=changed');
        if (context === 'root') {
          const root = h.document.querySelector(`.${probe.page.rootClass}`);
          root.replaceWith(root.cloneNode(true));
        }
        if (context === 'visibility') {
          Object.defineProperty(h.document, 'visibilityState', { configurable: true, get: () => 'hidden' });
        }
      }, { once: true });
      const result = await h.api.fillFields(PROFILE);
      assert.equal(result.ok, false);
      assert.equal(result.fields.length, probe.select.fields.length);
      assert.equal(result.fields.every((field) => field.ok === false), true);
      assert.equal(h.stats.open, 1);
      assert.equal(h.stats.option, 0);
      for (const field of CAPTURED) assert.equal(h.document.getElementById(`${field.key}-value`).textContent, '');
      neverSaved(result, h.stats);
      unchanged(h.document, h.stats);
    } finally { h.dom.window.close(); }
  });
}

for (const context of ['URL', 'visibility']) {
  test(`fillFields stays interrupted when Escape restores ${context}`, async () => {
    const h = await boot();
    try {
      let hidden = false;
      Object.defineProperty(h.document, 'visibilityState', { configurable: true, get: () => hidden ? 'hidden' : 'visible' });
      h.document.getElementById('rank-select').addEventListener('click', () => {
        if (context === 'URL') h.window.history.replaceState({}, '', '?resumeId=changed');
        else hidden = true;
      }, { once: true });
      h.document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        if (context === 'URL') h.window.history.replaceState({}, '', PAGE);
        else hidden = false;
      });
      const result = await h.api.fillFields(PROFILE);
      assert.equal(result.ok, false);
      assert.equal(result.fields.length, probe.select.fields.length);
      assert.equal(result.fields.every((field) => field.ok === false), true);
      assert.equal(h.stats.open, 1);
      assert.equal(h.stats.option, 0);
      neverSaved(result, h.stats);
      unchanged(h.document, h.stats);
    } finally { h.dom.window.close(); }
  });
}

for (const target of ['nested checkbox', 'external checkbox', 'external Save button']) {
  test(`an option label cannot activate a ${target}`, async () => {
    const h = await boot();
    try {
      let associated;
      h.document.getElementById('securities-select').addEventListener('click', () => {
        const option = h.document.querySelector('#select-options li');
        const label = h.document.createElement('label');
        const span = h.document.createElement('span');
        span.textContent = option.textContent;
        if (target === 'nested checkbox') {
          associated = h.document.createElement('input');
          associated.type = probe.neighbors.research.inputType;
          associated.className = probe.neighbors.research.controlClass;
          label.append(associated);
        } else if (target === 'external checkbox') {
          associated = h.document.getElementById('research');
          label.htmlFor = associated.id;
        } else {
          associated = [...h.document.querySelectorAll('button')].find((button) => button.textContent === probe.page.buttonLabels[0]);
          associated.id = 'captured-save';
          label.htmlFor = associated.id;
        }
        label.append(span);
        option.replaceChildren(label);
      }, { once: true });
      const row = await h.api.fillField(FIELD.securities.label, FIELD.securities.valueSample);
      assert.equal(row.ok, false, JSON.stringify(row));
      assert.equal(h.stats.option, 0);
      assert.equal(h.stats.checkbox, 0);
      if (target !== 'external Save button') assert.equal(associated.checked, false);
      assert.equal(row.stillOpen, 0);
      neverSaved(row, h.stats);
      unchanged(h.document, h.stats);
    } finally { h.dom.window.close(); }
  });
}
