// Offline Never-Save trials for hotjob pb certificate, English, and major-rank flat selects.
// Markup is built from tests/fixtures/hotjob-pb-certs-probe-dom.json (2026-10-23
// probe classes, labels, and captured display tokens only). A green run is not a live support claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { emptyProfile, listFilledPaths, normalizeProfile } from '../src/profile/store.js';

const source = readFileSync(new URL('../src/content/hotjob-pb-certs.js', import.meta.url), 'utf8');
const basicSource = readFileSync(new URL('../src/content/hotjob-pb-basic.js', import.meta.url), 'utf8');
const regionSource = readFileSync(new URL('../src/content/hotjob-pb-region.js', import.meta.url), 'utf8');
const eduSource = readFileSync(new URL('../src/content/hotjob-pb-edu-intent.js', import.meta.url), 'utf8');
const workSource = readFileSync(new URL('../src/content/hotjob-pb-work.js', import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../manifest.json', import.meta.url), 'utf8');
const engine = readFileSync(new URL('../src/content/engine.js', import.meta.url), 'utf8');
const popup = readFileSync(new URL('../src/popup/popup.js', import.meta.url), 'utf8');
const optionsPage = readFileSync(new URL('../src/profile/options.js', import.meta.url), 'utf8');
const storeSource = readFileSync(new URL('../src/profile/store.js', import.meta.url), 'utf8');
const cmsBasic = readFileSync(new URL('../src/background/cms-basic-auto.mjs', import.meta.url), 'utf8');
const cmsEdu = readFileSync(new URL('../src/background/cms-education-task-runner.mjs', import.meta.url), 'utf8');
const probe = JSON.parse(readFileSync(new URL('../tests/fixtures/hotjob-pb-certs-probe-dom.json', import.meta.url), 'utf8'));
const PAGE = `https://${probe.page.hostname}${probe.page.samplePath}`;
const FIELD = Object.fromEntries(probe.select.fields.map((field) => [field.key, field]));
const FORBIDDEN = probe.page.forbiddenButtons;
const LIVE = probe.select.liveReadback;
const CAPTURED = probe.select.fields.filter((field) => field.optionsSample.length === 1);
const PROFILE = Object.fromEntries(CAPTURED.map((field) => [field.label, field.valueSample]));
// The probe captured no 成绩 option text. These strings are profile values
// painted into the open menu only to prove click and readback. They are not
// harvested live options and must not appear in the content script.
const SCORE_BANDS = ['6.5', '7.0', '7.5'];
const SCORE_VALUE = '7.0';

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
  if (field?.key === 'score' && Array.isArray(state.scoreOptions)) return state.scoreOptions;
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
  const fields = probe.select.fields
    .filter((field) => !(state.omitEnglish && field.key === 'english'))
    .map((field) => selectField(field, state[field.key] ?? '', state)).join('');
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
  assert.doesNotMatch(source, /6\.5|7\.0|7\.5/);
  assert.match(source, new RegExp(FIELD.score.profilePath));
  assert.equal(optionsPage.includes(FIELD.score.profilePath), false);
  assert.equal(popup.includes(FIELD.score.profilePath), false);
  assert.match(storeSource, /profile\.ieltsScore = ieltsScore/);
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
    assert.equal(score.path, FIELD.score.profilePath);
    assert.equal(h.api.englishScorePath, FIELD.score.profilePath);
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
    assert.equal(score.path, FIELD.score.profilePath);
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.option, 0);
    assert.equal(row.liveSupportClaimed, false);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

function scoreProfile(value, confirmed = true) {
  const profile = { [FIELD.score.profilePath]: value };
  if (confirmed) profile.confirmedFields = [FIELD.score.profilePath];
  return profile;
}

test('ieltsScore stays off emptyProfile and is kept only when explicitly present', () => {
  assert.equal(Object.hasOwn(emptyProfile(), FIELD.score.profilePath), false);
  assert.equal(Object.hasOwn(normalizeProfile({}), FIELD.score.profilePath), false);
  const kept = normalizeProfile({
    ieltsScore: ` ${SCORE_VALUE} `,
    confirmedFields: [FIELD.score.profilePath],
    sources: { [FIELD.score.profilePath]: 'import' }
  });
  assert.equal(kept.ieltsScore, SCORE_VALUE);
  assert.equal(listFilledPaths(kept).includes(FIELD.score.profilePath), true);
  assert.equal(kept.confirmedFields.includes(FIELD.score.profilePath), true);
  assert.equal(kept.sources.ieltsScore, 'import');
  const blank = normalizeProfile({ ieltsScore: '   ', confirmedFields: [FIELD.score.profilePath] });
  assert.equal(Object.hasOwn(blank, FIELD.score.profilePath), false);
  assert.equal(blank.confirmedFields.includes(FIELD.score.profilePath), false);
  const other = normalizeProfile({ education: [{ gpa: SCORE_VALUE, gradeRank: '前10%' }] });
  assert.equal(Object.hasOwn(other, FIELD.score.profilePath), false);
});

test('empty 成绩 fills a confirmed ieltsScore and reads that menu text back', async () => {
  const h = await boot({ scoreOptions: SCORE_BANDS });
  try {
    const row = await h.api.fillField(FIELD.score.label, '', scoreProfile(SCORE_VALUE));
    assert.equal(row.ok, true, JSON.stringify(row));
    assert.equal(row.reason, 'readback_matched');
    assert.equal(row.status, 'verified');
    assert.equal(row.before, '');
    assert.equal(row.after, SCORE_VALUE);
    assert.equal(row.expected, SCORE_VALUE);
    assert.equal(row.path, FIELD.score.profilePath);
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
    assert.equal(row.softwareClickedSubmit, false);
    assert.equal(row.softwareClickedDeliver, false);
    assert.equal(row.softwareClickedNext, false);
    assert.equal(h.document.getElementById('score-value').textContent, SCORE_VALUE);
    assert.equal(h.document.querySelector('#score-select .ant-select-selection__placeholder').textContent, FIELD.score.placeholder);
    assert.equal(h.document.getElementById('select-menu').hidden, true);
    assert.equal(h.stats.option, 1);
    assert.equal(h.stats.button, 0);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('fillFields uses a confirmed ieltsScore when 成绩 is blank', async () => {
  const direct = await boot({ scoreOptions: SCORE_BANDS });
  try {
    const filled = await direct.api.fillFields(
      { ...PROFILE, [FIELD.score.label]: '   ' },
      scoreProfile(` ${SCORE_BANDS[2]} `)
    );
    assert.equal(filled.ok, true, JSON.stringify(filled));
    assert.equal(filled.liveSupportClaimed, false);
    assert.equal(filled.supportClaimed, false);
    assert.equal(filled.saved, false);
    assert.equal(filled.complete, false);
    assert.equal(filled.neverSave, true);
    const score = filled.fields.find((item) => item.label === FIELD.score.label);
    assert.equal(score.reason, 'readback_matched');
    assert.equal(score.after, SCORE_BANDS[2]);
    assert.equal(score.path, FIELD.score.profilePath);
    assert.equal(direct.document.getElementById('score-value').textContent, SCORE_BANDS[2]);
    assert.equal(direct.stats.button, 0);
    unchanged(direct.document, direct.stats);
  } finally { direct.dom.window.close(); }

  const shaped = await boot({ scoreOptions: SCORE_BANDS });
  try {
    const filled = await shaped.api.fillFields({
      ...PROFILE,
      ieltsScore: SCORE_BANDS[0],
      confirmedFields: [FIELD.score.profilePath]
    });
    const score = filled.fields.find((item) => item.label === FIELD.score.label);
    assert.equal(filled.ok, true, JSON.stringify(score));
    assert.equal(score.reason, 'readback_matched');
    assert.equal(score.after, SCORE_BANDS[0]);
    assert.equal(shaped.document.getElementById('english-value').textContent, FIELD.english.valueSample);
    unchanged(shaped.document, shaped.stats);
  } finally { shaped.dom.window.close(); }
});

test('a displayed 成绩 is kept and a different profile score does not reopen', async () => {
  const same = await boot({ score: SCORE_VALUE, scoreOptions: SCORE_BANDS });
  try {
    const row = await same.api.fillField(FIELD.score.label, '', scoreProfile(SCORE_VALUE));
    assert.equal(row.reason, 'preexisting_same_value', JSON.stringify(row));
    assert.equal(row.ok, true);
    assert.equal(row.before, SCORE_VALUE);
    assert.equal(row.after, SCORE_VALUE);
    assert.equal(row.opened, false);
    assert.equal(row.saved, false);
    assert.equal(row.liveSupportClaimed, false);
    assert.equal(same.stats.open, 0);
    assert.equal(same.document.getElementById('score-value').textContent, SCORE_VALUE);
    unchanged(same.document, same.stats);
  } finally { same.dom.window.close(); }

  const other = await boot({ score: SCORE_BANDS[2], scoreOptions: SCORE_BANDS });
  try {
    const row = await other.api.fillField(FIELD.score.label, '', scoreProfile(SCORE_VALUE));
    assert.equal(row.reason, 'existing_value', JSON.stringify(row));
    assert.equal(row.ok, false);
    assert.equal(row.status, 'skipped');
    assert.equal(row.before, SCORE_BANDS[2]);
    assert.equal(row.after, SCORE_BANDS[2]);
    assert.equal(row.expected, SCORE_VALUE);
    assert.equal(row.opened, false);
    assert.equal(other.stats.open, 0);
    assert.equal(other.document.getElementById('score-value').textContent, SCORE_BANDS[2]);
    unchanged(other.document, other.stats);
  } finally { other.dom.window.close(); }

  const pageOnly = await boot({ score: SCORE_BANDS[0] });
  try {
    const row = await pageOnly.api.fillField(FIELD.score.label, '');
    assert.equal(row.reason, 'preexisting_same_value', JSON.stringify(row));
    assert.equal(row.ok, true);
    assert.equal(row.expected, SCORE_BANDS[0]);
    assert.equal(row.opened, false);
    assert.equal(row.path, FIELD.score.profilePath);
    assert.equal(pageOnly.stats.open, 0);
    unchanged(pageOnly.document, pageOnly.stats);
  } finally { pageOnly.dom.window.close(); }
});

test('missing, unconfirmed, and placeholder ieltsScore values do not open 成绩', async () => {
  const h = await boot({ scoreOptions: SCORE_BANDS });
  try {
    const absent = await h.api.fillField(FIELD.score.label, '', { confirmedFields: [] });
    const unconfirmed = await h.api.fillField(FIELD.score.label, '  ', scoreProfile(SCORE_VALUE, false));
    const placeholder = await h.api.fillField(FIELD.score.label, '', scoreProfile(FIELD.score.placeholder));
    const token = await h.api.fillField(FIELD.score.label, '', scoreProfile(FIELD.score.inventoryValueSample));
    const unknown = await h.api.fillField(FIELD.score.label, '', scoreProfile('NO_SUCH_BAND'));
    assert.equal(absent.reason, 'missing_profile_value');
    assert.equal(absent.opened, false);
    assert.equal(absent.path, FIELD.score.profilePath);
    assert.equal(unconfirmed.reason, 'unconfirmed_profile_value');
    assert.equal(unconfirmed.opened, false);
    assert.equal(unconfirmed.path, FIELD.score.profilePath);
    assert.equal(placeholder.reason, 'missing_profile_value');
    assert.equal(placeholder.opened, false);
    assert.equal(token.reason, 'missing_profile_value');
    assert.equal(token.opened, false);
    assert.equal(unknown.reason, 'option_not_found', JSON.stringify(unknown));
    assert.equal(unknown.opened, true);
    assert.equal(unknown.canceled, true);
    assert.equal(unknown.stillOpen, 0);
    assert.equal(unknown.after, '');
    assert.equal(h.document.getElementById('score-value').textContent, '');
    assert.equal(h.document.getElementById('select-menu').hidden, true);
    assert.equal(h.stats.option, 0);
    assert.equal(h.stats.button, 0);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('成绩 without the English certificate select fails closed before a click', async () => {
  const h = await boot({ omitEnglish: true, scoreOptions: SCORE_BANDS });
  try {
    const view = h.api.inspect();
    assert.equal(view.ok, false);
    assert.equal(view.fields.find((field) => field.label === FIELD.score.label).reason, 'control_not_supported');
    assert.equal(view.fields.find((field) => field.label === FIELD.english.label).reason, 'control_not_supported');
    const row = await h.api.fillField(FIELD.score.label, '', scoreProfile(SCORE_VALUE));
    assert.equal(row.ok, false);
    assert.equal(row.reason, 'control_not_supported');
    assert.equal(row.opened, false);
    assert.equal(row.path, FIELD.score.profilePath);
    assert.equal(row.liveSupportClaimed, false);
    assert.equal(row.saved, false);
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.option, 0);
    assert.equal(h.stats.button, 0);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});
