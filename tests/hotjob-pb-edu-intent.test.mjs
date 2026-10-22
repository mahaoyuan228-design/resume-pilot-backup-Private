// Offline Never-Save trials for hotjob pb basic-block education/intent fields.
// Markup is built from tests/fixtures/hotjob-pb-edu-intent-probe-dom.json (2026-10-23
// probe classes, labels, and the one unopened-menu token). A green run is not a live support claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../src/content/hotjob-pb-edu-intent.js', import.meta.url), 'utf8');
const basicSource = readFileSync(new URL('../src/content/hotjob-pb-basic.js', import.meta.url), 'utf8');
const regionSource = readFileSync(new URL('../src/content/hotjob-pb-region.js', import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../manifest.json', import.meta.url), 'utf8');
const engine = readFileSync(new URL('../src/content/engine.js', import.meta.url), 'utf8');
const popup = readFileSync(new URL('../src/popup/popup.js', import.meta.url), 'utf8');
const cmsBasic = readFileSync(new URL('../src/background/cms-basic-auto.mjs', import.meta.url), 'utf8');
const cmsEdu = readFileSync(new URL('../src/background/cms-education-task-runner.mjs', import.meta.url), 'utf8');
const probe = JSON.parse(readFileSync(new URL('../tests/fixtures/hotjob-pb-edu-intent-probe-dom.json', import.meta.url), 'utf8'));
const PAGE = `https://${probe.page.hostname}${probe.page.samplePath}`;
const FIELD = Object.fromEntries(probe.fields.map((field) => [field.key, field]));
const FORBIDDEN = probe.page.forbiddenButtons;
const ADDRESS = FIELD.address.label;
const SCHOOL = FIELD.school.label;
const DEGREE = FIELD.degree.label;
const LEVEL = FIELD.level.label;
const MAJOR = FIELD.major.label;
const NOTE = FIELD.note.label;
const NATURE = FIELD.nature.label;
const SALARY = FIELD.salary.label;
const ARRIVAL = FIELD.arrival.label;
const PROFILE = {
  [ADDRESS]: '合成联系地址',
  [SCHOOL]: FIELD.school.valueSample,
  [DEGREE]: FIELD.degree.valueSample,
  [LEVEL]: FIELD.level.valueSample,
  [MAJOR]: '合成专业名称',
  [NOTE]: '合成评价内容',
  [NATURE]: FIELD.nature.valueSample,
  [SALARY]: FIELD.salary.valueSample,
  [ARRIVAL]: FIELD.arrival.valueSample
};

function esc(value) {
  return String(value).replace(/[&<>"]/gu, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function classes(value) {
  return String(value).split(/\s+/u).filter(Boolean);
}

function star(label) {
  return `${label}*`;
}

function row(key, label, inner, state, extra = {}) {
  const dropRow = (state.dropAntRow && key === 'address') || extra.dropRow;
  const itemClass = extra.itemClass || (dropRow ? 'ant-form-item' : probe.page.itemClass);
  const hidden = extra.hidden ? ' hidden' : '';
  const caption = extra.rawLabel || star(label);
  const extraLabel = extra.extraLabel ? `<label>${esc(extra.extraLabel)}</label>` : '';
  const blankLabel = extra.blankLabel ? '<label></label>' : '';
  if (extra.wrapControl) {
    return `<div class="${esc(itemClass)}" data-field="${esc(key)}"${hidden}><label>${esc(caption)}${inner}</label>${extraLabel}${blankLabel}</div>`;
  }
  return `<div class="${esc(itemClass)}" data-field="${esc(key)}"${hidden}><label>${esc(caption)}</label>${extraLabel}${blankLabel}<span class="${esc(probe.page.childrenClass)}">${inner}</span></div>`;
}

function textControl(id, value, state, key) {
  const dropClass = state.dropAntInput && key === 'address';
  const calendar = state.calendarOnAddress && key === 'address';
  const className = dropClass ? 'plain-input' : (calendar ? probe.neighbors.birth.controlClass : probe.text.controlClass);
  const type = state.typeNumber && key === 'address' ? 'number' : probe.text.inputType;
  const readonly = (state.readonlyAddress && key === 'address') ? ' readonly' : '';
  const field = FIELD[key];
  const placeholder = field?.placeholder ? ` placeholder="${esc(field.placeholder)}"` : '';
  const extra = state.extraTextInput && key === 'address'
    ? `<input class="${esc(probe.text.controlClass)}" type="text" value="">` : '';
  return `<input id="${id}" class="${esc(className)}" type="${type}"${placeholder}${readonly} value="${esc(value)}">${extra}`;
}

function areaControl(id, value, state) {
  if (state.noteAsInput) {
    return `<input id="${id}" class="${esc(probe.text.controlClass)}" type="text" value="${esc(value)}">`;
  }
  const readonly = state.readonlyNote ? ' readonly' : '';
  const extra = state.extraTextarea
    ? `<textarea class="${esc(probe.textarea.controlClass)}"></textarea>` : '';
  return `<textarea id="${id}" class="${esc(probe.textarea.controlClass)}" placeholder="${esc(FIELD.note.placeholder)}"${readonly}>${esc(value)}</textarea>${extra}`;
}

function selectInner(id, label, value, state, key) {
  const live = probe.select.liveReadback;
  const valueId = id.replace(/-select$/u, '-value');
  if (state.ambiguousValue && key === 'degree') {
    return `<span class="${esc(live.selectedValueClass)}">${esc(value || '甲')}</span><span class="${esc(live.selectedValueClass)}">乙</span>`;
  }
  if (state.placeholderMash === 'class' && FIELD[key]) {
    return `<span class="${esc(live.placeholderClass)}">${esc(live.placeholderPrefix + label)}</span><span class="${esc(live.selectedValueClass)}" id="${valueId}">${esc(value)}</span>`;
  }
  const shown = state.placeholderMash === 'text' && FIELD[key]
    ? `${live.placeholderPrefix}${label}${value}`
    : value;
  return `<span id="${valueId}">${esc(shown)}</span>`;
}

function selectControl(id, value, state, key) {
  const live = probe.select.liveReadback;
  const label = FIELD[key]?.label || '';
  const disabled = state.selectDisabled && key === 'degree' ? ' ant-select-disabled' : '';
  const selectClass = state.dropAllowClear && key === 'degree'
    ? 'ant-select ant-select-enabled'
    : `${probe.select.controlClass}${disabled}`;
  const trigger = state.dropSearch && key === 'degree' ? '' : `<input class="${esc(probe.select.triggerClass)}" type="text" value="">`;
  const extra = state.extraSelect && key === 'degree'
    ? `<div class="${esc(probe.select.controlClass)}"><span></span><input class="${esc(probe.select.triggerClass)}" type="text" value=""></div>` : '';
  const inner = selectInner(id, label, value, state, key);
  const faced = FIELD[key] && (state.closedSearch || state.placeholderMash === 'class')
    ? `<div class="${esc(live.faceClass)}" role="${esc(live.faceRole)}">${inner}</div>`
    : inner;
  return `<div class="${esc(selectClass)}" id="${id}">${faced}${trigger}</div>${extra}`;
}

function textRow(key, value, state, id = `${key}-input`) {
  const hidden = (state.hiddenAddress && key === 'address') || (state.hiddenSchool && key === 'school');
  const extraLabel = key === 'school'
    ? (state.duplicateSchoolCaption ? star(SCHOOL) : (state.schoolNoiseLabel || ''))
    : '';
  return row(key, FIELD[key].label, textControl(id, value, state, key), state, {
    hidden,
    wrapControl: state.wrapSchool && key === 'school',
    extraLabel
  });
}

function noteRow(value, state) {
  return row('note', NOTE, areaControl('note-input', value, state), state, { hidden: state.hiddenNote });
}

function selectRow(key, value, state) {
  if (state.degreeIsText && key === 'degree') return textRow('degree', value, state, 'degree-input');
  return row(key, FIELD[key].label, selectControl(`${key}-select`, value, state, key), state);
}

function majorRow(value, state) {
  if (state.majorIsSelect) return row('major', MAJOR, selectControl('major-select', value, state, 'major'), state);
  return row('major', MAJOR, textControl('major-input', value, state, 'major'), state, {
    wrapControl: state.wrapMajor,
    extraLabel: state.extraMajorCaption || '',
    blankLabel: state.blankMajorLabel
  });
}

function plainText(key, label, value, id, placeholder = '') {
  const holder = placeholder ? ` placeholder="${esc(placeholder)}"` : '';
  return row(key, label, `<input id="${id}" class="${esc(probe.text.controlClass)}" type="text"${holder} value="${esc(value)}">`, {});
}

function readonlyDate(key, label, value, id, controlClass, extra = {}) {
  return row(key, label, `<input id="${id}" class="${esc(controlClass)}" type="text" readonly value="${esc(value)}">`, {}, {
    rawLabel: label,
    ...extra
  });
}

function cascader(key, label, value, id) {
  const neighbor = key === 'intent' ? probe.neighbors.intent : (key === 'origin' ? probe.neighbors.origin : probe.neighbors.residence);
  return row(key, label, `<span class="${esc(neighbor.menuClass)}"><div class="${esc(neighbor.controlClass)}" id="${id}"><span id="${id}-value">${esc(value)}</span></div></span>`, {});
}

function flatNeighbor(key, label, value, id) {
  return row(key, label, selectControl(id, value, {}, key), {});
}

function radioNeighbor() {
  const body = probe.neighbors.obey.options.map((text) => (
    `<label><span><input class="${esc(probe.neighbors.obey.controlClass)}" type="radio" name="pb-obey"></span><span>${esc(text)}</span></label>`
  )).join('');
  return row('obey', probe.neighbors.obey.label, body, {});
}

function eduBlock(state) {
  const neighbor = probe.neighbors;
  return [
    flatNeighbor('edu-school', neighbor.eduSchool.label, state.eduSchool ?? neighbor.eduSchool.token, 'edu-school-select'),
    flatNeighbor('edu-degree', neighbor.eduDegree.label, state.eduDegree ?? neighbor.eduDegree.token, 'edu-degree-select'),
    flatNeighbor('edu-level', neighbor.eduLevel.label, state.eduLevel ?? neighbor.eduLevel.token, 'edu-level-select'),
    plainText('edu-major', neighbor.eduMajor.label, state.eduMajor ?? neighbor.eduMajor.token, 'edu-major-input', neighbor.eduMajor.placeholder),
    row('edu-desc', neighbor.eduDescription.label, `<textarea id="edu-desc" class="${esc(probe.textarea.controlClass)}">${esc(neighbor.eduDescription.token)}</textarea>`, {})
  ].join('');
}

function optionsFor(field, state) {
  const rows = [...(field.optionsSample || [])];
  if (state.duplicateOption && field.key === 'degree') rows.push(state.duplicateOption);
  if (state.emptyMenu && field.key === 'degree') return [];
  return rows;
}

function html(state) {
  const rootClass = state.dropRoot ? 'page-root' : probe.page.rootClass;
  const shell = state.elForm ? '<div class="el-form"></div>' : '';
  const neighbor = probe.neighbors;
  const duplicateAddress = state.duplicateAddress ? plainText('address-copy', ADDRESS, '', 'address-copy-input', FIELD.address.placeholder) : '';
  const duplicateMajor = state.duplicateMajorInside ? plainText('major-copy', MAJOR, '', 'major-copy-input', FIELD.major.placeholder) : '';
  const duplicateSchool = state.duplicateAnchorSchool ? flatNeighbor('school-copy', SCHOOL, '', 'school-copy-select') : '';
  const graduation = state.dropGraduation ? '' : readonlyDate(
    'graduation', neighbor.graduation.label, neighbor.graduation.token, 'grad-input', neighbor.graduation.controlClass,
    { wrapControl: state.wrapGraduation }
  );
  const duplicateGraduation = state.duplicateGraduation
    ? readonlyDate('graduation-copy', neighbor.graduation.label, neighbor.graduation.token, 'grad-copy', neighbor.graduation.controlClass)
    : '';
  const basicMajor = state.dropBasicMajor ? '' : majorRow(state.major ?? '', state);
  const dropdownClass = state.badDropdown
    ? 'ant-select-dropdown ant-select-dropdown-placement-bottomLeft'
    : probe.select.dropdownClass;
  const buttons = [...probe.page.buttonLabels, ...FORBIDDEN.filter((label) => !probe.page.buttonLabels.includes(label))]
    .map((label) => `<button type="button">${esc(label)}</button>`).join('');
  const body = [
    textRow('address', state.address ?? '', state),
    duplicateAddress,
    textRow('school', state.school ?? '', state),
    selectRow('degree', state.degree ?? '', state),
    selectRow('level', state.level ?? '', state),
    basicMajor,
    duplicateMajor,
    graduation,
    plainText('name', neighbor.name.label, neighbor.name.token, 'name-input'),
    readonlyDate('birth', `${neighbor.birth.label}*`, neighbor.birth.token, 'birth-input', neighbor.birth.controlClass),
    cascader('residence', neighbor.residence.label, neighbor.residence.token, 'residence-select'),
    cascader('origin', neighbor.origin.label, neighbor.origin.token, 'origin-select'),
    plainText('phone', neighbor.phone.label, neighbor.phone.token, 'phone-input'),
    flatNeighbor('interview', neighbor.interview.label, neighbor.interview.token, 'interview-select'),
    `<div class="${esc(neighbor.photo.itemClass)}"><label>${esc(star(neighbor.photo.label))}</label><input id="photo" type="file"></div>`,
    noteRow(state.note ?? '', state),
    selectRow('nature', state.nature ?? '', state),
    cascader('intent', neighbor.intent.label, neighbor.intent.token, 'intent-select'),
    radioNeighbor(),
    selectRow('salary', state.salary ?? '', state),
    selectRow('arrival', state.arrival ?? '', state),
    row('research', neighbor.research.label, `<input id="research" class="${esc(neighbor.research.controlClass)}" type="checkbox">`, {}),
    eduBlock(state),
    duplicateSchool,
    duplicateGraduation,
    `<div class="${esc(neighbor.portrait.itemClass)}"><label>${esc(star(neighbor.portrait.label))}</label><input id="portrait" type="file"></div>`,
    buttons
  ].join('');
  return `<!doctype html><body>${shell}<div class="${esc(rootClass)}"><div class="${esc(probe.page.contentClass)}">${body}</div></div><div class="${esc(dropdownClass)}" id="select-menu" hidden><ul id="select-options"></ul></div></body>`;
}

function hide(node, hidden) {
  if (!node) return;
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
  const field = probe.fields.find((row) => row.kind === 'select' && `${row.key}-select` === select.id);
  const options = field ? optionsFor(field, state) : [];
  const list = document.getElementById('select-options');
  list.replaceChildren();
  for (const text of options) {
    const li = document.createElement('li');
    li.textContent = text;
    list.appendChild(li);
  }
  hide(document.getElementById('select-menu'), false);
}

function wire(document, state) {
  const stats = {
    open: 0, option: 0, escape: 0, forbidden: 0, file: 0, textInput: 0, focus: 0,
    neighborFocus: 0, checkbox: 0, radio: 0, openClass: '', triggerClass: '', faceClass: ''
  };
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (button && FORBIDDEN.includes((button.textContent || '').trim())) stats.forbidden += 1;
    if (event.target.matches?.('input[type="file"]')) stats.file += 1;
    if (event.target.matches?.('input.ant-checkbox-input')) stats.checkbox += 1;
    if (event.target.matches?.('input.ant-radio-input')) stats.radio += 1;
  }, true);
  for (const input of document.querySelectorAll('input.ant-input, textarea.ant-input, #address-input, #note-input')) {
    input.addEventListener('input', () => { stats.textInput += 1; });
    input.addEventListener('focus', () => { stats.focus += 1; });
  }
  document.getElementById('grad-input')?.addEventListener('focus', () => { stats.neighborFocus += 1; });
  document.getElementById('edu-major-input')?.addEventListener('focus', () => { stats.neighborFocus += 1; });
  for (const select of document.querySelectorAll('.ant-select')) {
    select.addEventListener('click', (event) => {
      if (document.getElementById('select-menu').contains(event.target)) return;
      if (select.closest('.cascader-plugins-wrap')) return;
      stats.open += 1;
      if (event.target.classList?.contains(probe.select.triggerClass)) stats.triggerClass = probe.select.triggerClass;
      if (event.target.closest?.(`.${probe.select.liveReadback.faceClass}`)) stats.faceClass = probe.select.liveReadback.faceClass;
      select.classList.add(...classes(probe.select.openClass));
      stats.openClass = select.className;
      paintMenu(document, select, state);
    });
  }
  document.getElementById('select-menu').addEventListener('click', (event) => {
    const li = event.target.closest('li');
    if (!li) return;
    const select = document.querySelector('.ant-select.ant-select-open');
    if (!select) return;
    stats.option += 1;
    const value = select.querySelector('.ant-select-selection-selected-value, [id$="-value"]') || select.querySelector('span');
    if (value) value.textContent = li.textContent.trim();
    closeWidgets(document);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    stats.escape += 1;
    if (state.ignoreEscape) return;
    closeWidgets(document);
  });
  if (state.busy) {
    const select = document.getElementById('degree-select');
    select.classList.add('ant-select-open', 'ant-select-focused');
    paintMenu(document, select, state);
  }
  return stats;
}

function patch(window, state = {}) {
  window.Element.prototype.getClientRects = function () {
    if ((state.closedSearch || state.closedSearchBare) && this.classList?.contains(probe.select.triggerClass)) return [];
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
  return { dom, window, document, stats, api: window.ResumeHotjobPbEduIntent };
}

function valueOf(document, id) {
  return document.getElementById(id)?.value;
}

function textOf(document, id) {
  return document.getElementById(id)?.textContent;
}

function unchanged(document, stats) {
  const neighbor = probe.neighbors;
  assert.equal(valueOf(document, 'name-input'), neighbor.name.token);
  assert.equal(valueOf(document, 'birth-input'), neighbor.birth.token);
  assert.equal(valueOf(document, 'grad-input'), neighbor.graduation.token);
  assert.equal(textOf(document, 'residence-select-value'), neighbor.residence.token);
  assert.equal(textOf(document, 'origin-select-value'), neighbor.origin.token);
  assert.equal(valueOf(document, 'phone-input'), neighbor.phone.token);
  assert.equal(textOf(document, 'interview-value'), neighbor.interview.token);
  assert.equal(textOf(document, 'intent-select-value'), neighbor.intent.token);
  assert.equal(textOf(document, 'edu-school-value'), neighbor.eduSchool.token);
  assert.equal(textOf(document, 'edu-degree-value'), neighbor.eduDegree.token);
  assert.equal(textOf(document, 'edu-level-value'), neighbor.eduLevel.token);
  assert.equal(valueOf(document, 'edu-desc'), neighbor.eduDescription.token);
  assert.equal(document.getElementById('photo').files.length, 0);
  assert.equal(document.getElementById('portrait').files.length, 0);
  assert.equal(document.getElementById('research').checked, false);
  assert.equal([...document.querySelectorAll('input[name="pb-obey"]')].some((node) => node.checked), false);
  assert.equal(stats.forbidden, 0);
  assert.equal(stats.file, 0);
  assert.equal(stats.checkbox, 0);
  assert.equal(stats.radio, 0);
  assert.equal(stats.neighborFocus, 0);
}

test('source stays on the probed pb classes and does not claim support', () => {
  assert.match(source, /ResumeHotjobPbEduIntent/);
  assert.match(source, /liveSupportClaimed:\s*false/);
  assert.match(source, /supportClaimed:\s*false/);
  assert.match(source, /neverSave:\s*true/);
  assert.doesNotMatch(source, /liveSupportClaimed:\s*true/);
  assert.doesNotMatch(source, /supportClaimed:\s*true/);
  assert.doesNotMatch(source, /已支持/);
  assert.doesNotMatch(source, /hotjob-mc-basic|ResumeHotjobMc|mc\/deliver|cms-region|engine\.js/);
  assert.doesNotMatch(source, /textContent\s*=/);
  assert.doesNotMatch(source, /\.value\s*=[^=]/);
  assert.doesNotMatch(source, /\.checked\s*=/);
  assert.doesNotMatch(source, /innerHTML/);
  assert.doesNotMatch(source, /\bexport\s/);
  assert.doesNotMatch(source, /ant-cascader-menus|form-cell|ant-select-selection--single|ant-radio-wrapper|ant-select-dropdown-menu-item/);
  assert.equal(manifest.includes('hotjob-pb-edu-intent'), false);
  assert.equal(engine.includes('hotjob-pb-edu-intent'), false);
  assert.equal(basicSource.includes('hotjob-pb-edu-intent'), false);
  assert.equal(regionSource.includes('hotjob-pb-edu-intent'), false);
  assert.equal(popup.includes('hotjob-pb-edu-intent'), false);
  assert.equal(cmsBasic.includes('hotjob-pb-edu-intent'), false);
  assert.equal(cmsEdu.includes('hotjob-pb-edu-intent'), false);
  assert.match(source, /保存\|提交\|投递\|删除\|下一步\|返回\|确定/);
  assert.doesNotMatch(source, /1\d{10}/);
  assert.doesNotMatch(source, /Economics|金融学|悉尼大学|11-20万/);
  for (const field of probe.fields) {
    if (field.valueSample) assert.doesNotMatch(source, new RegExp(field.valueSample.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  }
  for (const token of [
    ...classes(probe.page.itemClass),
    probe.text.controlClass,
    probe.textarea.controlTag,
    ...classes(probe.select.controlClass),
    probe.select.triggerClass,
    ...classes(probe.select.dropdownClass),
    ...classes(probe.select.openClass),
    probe.page.rootClass,
    'ant-calendar-picker-input',
    'cascader-plugins-wrap',
    probe.anchors.before,
    probe.anchors.after,
    probe.select.liveReadback.selectedValueClass,
    probe.select.liveReadback.placeholderClass,
    probe.select.liveReadback.placeholderPrefix,
    '.ant-select-selection, .ant-select-selector',
    '.ant-select-selection-item',
    '[role="combobox"]',
    ...probe.fields.map((field) => field.label)
  ]) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  }
});

test('fixture html uses only the probe class list, labels, and menu text', () => {
  const built = html({});
  for (const token of [
    probe.page.rootClass, probe.page.contentClass, probe.page.childrenClass,
    ...classes(probe.page.itemClass), probe.text.controlClass, probe.textarea.controlTag,
    ...classes(probe.select.controlClass), probe.select.triggerClass,
    ...classes(probe.select.dropdownClass), probe.neighbors.birth.controlClass,
    probe.neighbors.residence.menuClass, probe.neighbors.photo.itemClass,
    probe.neighbors.portrait.itemClass, probe.neighbors.research.controlClass
  ]) assert.match(built, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  for (const field of probe.fields) assert.match(built, new RegExp(`>${field.label}\\*`));
  for (const field of probe.fields) {
    if (field.placeholder) assert.match(built, new RegExp(`placeholder="${field.placeholder}"`));
  }
  for (const label of probe.page.buttonLabels) assert.match(built, new RegExp(`>${label}<`));
  assert.match(built, new RegExp(`>${probe.anchors.after.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}`));
  assert.doesNotMatch(built, /ant-radio-wrapper|ant-select-selection--single|ant-cascader-menus|ant-select-dropdown-menu-item|form-cell/);
  assert.doesNotMatch(built, /1\d{10}/);
  assert.doesNotMatch(JSON.stringify(probe), /1\d{10}/);
  assert.equal(built.includes(FIELD.major.valueSample), false);
});

test('inspect matches the nine probed fields and does not claim support', async () => {
  const h = await boot({
    school: FIELD.school.valueSample,
    degree: FIELD.degree.valueSample,
    level: FIELD.level.valueSample,
    nature: FIELD.nature.valueSample,
    salary: FIELD.salary.valueSample,
    arrival: FIELD.arrival.valueSample,
    note: '已有评价'
  });
  try {
    const view = h.api.inspect();
    assert.equal(h.api.liveSupportClaimed, false);
    assert.equal(h.api.supportClaimed, false);
    assert.equal(h.api.neverSave, true);
    assert.equal(h.window.ResumeHotjobPbBasic, undefined);
    assert.equal(h.window.ResumeHotjobPbRegion, undefined);
    assert.equal(view.liveSupportClaimed, false);
    assert.equal(view.supportClaimed, false);
    assert.equal(view.neverSave, true);
    assert.equal(view.complete, false);
    assert.equal(view.saved, false);
    assert.equal(view.skippedSave, true);
    assert.equal(view.fields.length, 9);
    assert.equal(view.fields.every((field) => field.supported === false), true);
    assert.equal(view.fields.every((field) => field.reason === 'structure_matched'), true);
    assert.deepEqual(Array.from(view.fields, (field) => field.label), probe.fields.map((field) => field.label));
    assert.deepEqual(Array.from(view.fields, (field) => field.kind), probe.fields.map((field) => field.kind));
    assert.equal(view.fields.find((field) => field.label === NOTE).value, '已有评价');
    assert.equal(view.fields.find((field) => field.label === SCHOOL).kind, 'text');
    assert.equal(view.fields.find((field) => field.label === SCHOOL).value, FIELD.school.valueSample);
    assert.equal(view.fields.find((field) => field.label === DEGREE).value, FIELD.degree.valueSample);
    assert.equal(view.fields.map((field) => field.label).includes(probe.neighbors.eduSchool.label), false);
    assert.equal(view.fields.map((field) => field.label).includes(probe.neighbors.residence.label), false);
    unchanged(h.document, h.stats);
    assert.equal(valueOf(h.document, 'edu-major-input'), probe.neighbors.eduMajor.token);
  } finally { h.dom.window.close(); }
});

test('empty text, textarea, and flat selects read back without touching the education repeat', async () => {
  const h = await boot({ eduMajor: FIELD.major.valueSample });
  try {
    const address = await h.api.fillField(ADDRESS, '  合成 联系 地址  ');
    const school = await h.api.fillField(SCHOOL, FIELD.school.valueSample);
    const degree = await h.api.fillField(DEGREE, ` ${FIELD.degree.valueSample} `);
    const level = await h.api.fillField(LEVEL, FIELD.level.valueSample);
    const major = await h.api.fillField(MAJOR, '合成专业名称');
    const note = await h.api.fillField(NOTE, '合成\n评价内容');
    const nature = await h.api.fillField(NATURE, FIELD.nature.valueSample);
    const salary = await h.api.fillField(SALARY, FIELD.salary.valueSample);
    const arrival = await h.api.fillField(ARRIVAL, FIELD.arrival.valueSample);
    assert.equal(address.ok, true, JSON.stringify(address));
    assert.equal(address.reason, 'readback_matched');
    assert.equal(address.after, '合成联系地址');
    assert.equal(address.opened, false);
    assert.equal(address.liveSupportClaimed, false);
    assert.equal(address.supportClaimed, false);
    assert.equal(address.complete, false);
    assert.equal(address.saved, false);
    assert.equal(address.skippedSave, true);
    assert.equal(address.neverSave, true);
    assert.equal(address.softwareClickedSave, false);
    assert.equal(school.reason, 'readback_matched');
    assert.equal(school.opened, false);
    assert.equal(school.canceled, false);
    assert.equal(school.stillOpen, 0);
    assert.equal(degree.after, FIELD.degree.valueSample);
    assert.equal(level.after, FIELD.level.valueSample);
    assert.equal(major.after, '合成专业名称');
    assert.equal(major.opened, false);
    assert.equal(note.reason, 'readback_matched');
    assert.equal(note.after, '合成评价内容');
    assert.equal(nature.after, FIELD.nature.valueSample);
    assert.equal(salary.after, FIELD.salary.valueSample);
    assert.equal(arrival.after, FIELD.arrival.valueSample);
    assert.equal(h.stats.triggerClass, probe.select.triggerClass);
    assert.match(h.stats.openClass, /ant-select-open/);
    assert.match(h.stats.openClass, /ant-select-focused/);
    assert.match(h.stats.openClass, /ant-select-enabled/);
    assert.equal(valueOf(h.document, 'address-input'), '合成联系地址');
    assert.equal(valueOf(h.document, 'school-input'), FIELD.school.valueSample);
    assert.equal(valueOf(h.document, 'major-input'), '合成专业名称');
    assert.equal(valueOf(h.document, 'note-input'), '合成评价内容');
    assert.equal(textOf(h.document, 'degree-value'), FIELD.degree.valueSample);
    assert.equal(valueOf(h.document, 'edu-major-input'), FIELD.major.valueSample);
    assert.equal(h.document.querySelectorAll('.ant-select-open').length, 0);
    assert.equal(h.document.getElementById('select-menu').hidden, true);
    assert.equal(h.stats.option, 5);
    assert.equal(h.stats.textInput, 4);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a query string on the probed pb path still fills and fillFields covers all nine', async () => {
  const h = await boot({ url: `${PAGE}?recruitType=1&resumeId=synthetic&tid=synthetic&lang=1` });
  try {
    const filled = await h.api.fillFields(PROFILE);
    assert.equal(filled.ok, true, JSON.stringify(filled.fields));
    assert.equal(filled.liveSupportClaimed, false);
    assert.equal(filled.supportClaimed, false);
    assert.equal(filled.complete, false);
    assert.equal(filled.saved, false);
    assert.equal(filled.skippedSave, true);
    assert.equal(filled.neverSave, true);
    assert.equal(filled.fields.map((field) => field.reason).every((reason) => reason === 'readback_matched'), true);
    assert.equal(textOf(h.document, 'salary-value'), FIELD.salary.valueSample);
    assert.equal(textOf(h.document, 'arrival-value'), FIELD.arrival.valueSample);
    assert.equal(valueOf(h.document, 'edu-major-input'), probe.neighbors.eduMajor.token);
    assert.equal(h.stats.option, 5);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('preexisting same values do not focus, reopen, or paint', async () => {
  const h = await boot({
    address: '合成 联系 地址',
    major: '合成 专业 名称',
    note: '合成 评价 内容',
    school: FIELD.school.valueSample,
    degree: ` ${FIELD.degree.valueSample} `,
    level: FIELD.level.valueSample,
    nature: FIELD.nature.valueSample,
    salary: FIELD.salary.valueSample,
    arrival: FIELD.arrival.valueSample
  });
  try {
    const address = await h.api.fillField(ADDRESS, '合成联系地址');
    const note = await h.api.fillField(NOTE, '合成评价内容');
    const school = await h.api.fillField(SCHOOL, ` ${FIELD.school.valueSample} `);
    const degree = await h.api.fillField(DEGREE, FIELD.degree.valueSample);
    assert.equal(address.reason, 'preexisting_same_value');
    assert.equal(address.status, 'verified');
    assert.equal(address.ok, true);
    assert.equal(address.opened, false);
    assert.equal(note.reason, 'preexisting_same_value');
    assert.equal(school.reason, 'preexisting_same_value');
    assert.equal(school.opened, false);
    assert.equal(degree.reason, 'preexisting_same_value');
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.option, 0);
    assert.equal(h.stats.textInput, 0);
    assert.equal(h.stats.focus, 0);
    assert.equal(valueOf(h.document, 'address-input'), '合成 联系 地址');
    assert.equal(valueOf(h.document, 'note-input'), '合成 评价 内容');
    assert.equal(textOf(h.document, 'degree-value'), ` ${FIELD.degree.valueSample} `);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a different existing value is kept and nothing is opened or painted', async () => {
  const h = await boot({
    address: '已有地址',
    note: '已有评价',
    major: '已有专业',
    school: '已有院校',
    degree: '已有学位',
    nature: '已有性质'
  });
  try {
    const filled = await h.api.fillFields(PROFILE);
    assert.equal(filled.ok, false);
    const byLabel = Object.fromEntries(filled.fields.map((field) => [field.label, field]));
    for (const label of [ADDRESS, NOTE, MAJOR, SCHOOL, DEGREE, NATURE]) {
      assert.equal(byLabel[label].reason, 'existing_value', label);
      assert.equal(byLabel[label].status, 'skipped');
      assert.equal(byLabel[label].ok, false);
      assert.equal(byLabel[label].opened, false);
    }
    assert.equal(byLabel[LEVEL].reason, 'readback_matched');
    assert.equal(byLabel[SALARY].reason, 'readback_matched');
    assert.equal(byLabel[ARRIVAL].reason, 'readback_matched');
    assert.equal(h.stats.open, 3);
    assert.equal(h.stats.option, 3);
    assert.equal(h.stats.textInput, 0);
    assert.equal(h.stats.focus, 0);
    assert.equal(valueOf(h.document, 'address-input'), '已有地址');
    assert.equal(valueOf(h.document, 'note-input'), '已有评价');
    assert.equal(valueOf(h.document, 'major-input'), '已有专业');
    assert.equal(valueOf(h.document, 'school-input'), '已有院校');
    assert.equal(textOf(h.document, 'degree-value'), '已有学位');
    assert.equal(valueOf(h.document, 'edu-major-input'), probe.neighbors.eduMajor.token);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('empty values, short labels, and out-of-scope labels fail closed', async () => {
  const h = await boot({});
  try {
    for (const value of ['', '   ', null, 1]) {
      const rowResult = await h.api.fillField(ADDRESS, value);
      assert.equal(rowResult.reason, 'missing_profile_value', String(value));
      assert.equal(rowResult.ok, false);
      const note = await h.api.fillField(NOTE, value);
      assert.equal(note.reason, 'missing_profile_value', String(value));
    }
    const short = await h.api.fillField('专业', '合成专业名称');
    assert.equal(short.reason, 'label_not_allowed');
    for (const label of [
      probe.neighbors.name.label,
      probe.neighbors.birth.label,
      probe.neighbors.residence.label,
      probe.neighbors.origin.label,
      probe.neighbors.graduation.label.replace(/[＊*？?]/gu, ''),
      probe.neighbors.phone.label,
      probe.neighbors.interview.label,
      probe.neighbors.photo.label,
      probe.neighbors.portrait.label,
      probe.neighbors.intent.label,
      probe.neighbors.obey.label,
      probe.neighbors.research.label,
      probe.neighbors.eduSchool.label,
      probe.neighbors.eduDescription.label,
      '意向二：期望工作地点',
      '身高',
      '证件号码'
    ]) {
      const rowResult = await h.api.fillField(label, '合成');
      assert.equal(rowResult.reason, 'label_not_allowed', label);
    }
    const none = await h.api.fillFields(null);
    assert.equal(none.ok, false);
    assert.equal(none.liveSupportClaimed, false);
    assert.equal(none.fields.every((field) => field.reason === 'missing_profile_value'), true);
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.textInput, 0);
    assert.equal(h.stats.option, 0);
    assert.equal(h.stats.focus, 0);
    assert.equal(valueOf(h.document, 'address-input'), '');
    assert.equal(valueOf(h.document, 'major-input'), '');
    assert.equal(valueOf(h.document, 'note-input'), '');
    assert.equal(valueOf(h.document, 'grad-input'), probe.neighbors.graduation.token);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('Escape closes a flat select and does not change the value; text and textarea do not click', async () => {
  const h = await boot({ school: '', degree: FIELD.degree.valueSample });
  try {
    const canceled = await h.api.cancelField(NATURE);
    assert.equal(canceled.ok, true, JSON.stringify(canceled));
    assert.equal(canceled.reason, 'menu_closed');
    assert.equal(canceled.canceled, true);
    assert.equal(canceled.stillOpen, 0);
    assert.equal(canceled.before, '');
    assert.equal(canceled.after, '');
    assert.equal(canceled.liveSupportClaimed, false);
    assert.equal(canceled.supportClaimed, false);
    assert.equal(h.stats.open, 1);
    assert.equal(h.stats.option, 0);
    assert.ok(h.stats.escape >= 1);
    assert.equal(h.document.getElementById('select-menu').hidden, true);
    assert.equal(h.document.querySelectorAll('.ant-select-open').length, 0);
    const text = await h.api.cancelField(ADDRESS);
    const area = await h.api.cancelField(NOTE);
    assert.equal(text.reason, 'cancel_not_applicable');
    assert.equal(area.reason, 'cancel_not_applicable');
    assert.equal(h.stats.textInput, 0);
    assert.equal(h.stats.focus, 0);
    assert.equal(textOf(h.document, 'degree-value'), FIELD.degree.valueSample);
    const arrival = await h.api.fillField(ARRIVAL, FIELD.arrival.valueSample);
    assert.equal(arrival.reason, 'readback_matched');
    assert.equal(textOf(h.document, 'arrival-value'), FIELD.arrival.valueSample);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a menu that ignores Escape fails closed and does not keep a painted value', async () => {
  const h = await boot({ ignoreEscape: true });
  try {
    const canceled = await h.api.cancelField(DEGREE);
    assert.equal(canceled.ok, false);
    assert.equal(canceled.reason, 'menu_cleanup_failed');
    assert.equal(canceled.stillOpen, 1);
    assert.equal(canceled.after, '');
    assert.equal(h.stats.option, 0);
    const missing = await h.api.fillField(LEVEL, FIELD.level.valueSample);
    assert.equal(missing.ok, false);
    assert.equal(missing.reason, 'control_busy');
    assert.equal(textOf(h.document, 'level-value'), '');
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('missing and duplicate options fail closed before a write', async () => {
  const missing = await boot({});
  try {
    const school = await missing.api.fillField(NATURE, '合成性质');
    assert.equal(school.reason, 'option_not_found', JSON.stringify(school));
    assert.equal(school.after, '');
    assert.equal(school.stillOpen, 0);
    assert.equal(school.canceled, true);
    assert.ok(missing.stats.escape >= 1);
    assert.equal(missing.stats.option, 0);
    const degree = await missing.api.fillField(DEGREE, '硕士');
    assert.equal(degree.reason, 'option_not_found');
    assert.equal(textOf(missing.document, 'degree-value'), '');
    const level = await missing.api.fillField(LEVEL, '硕士研究生');
    assert.equal(level.reason, 'option_not_found');
    unchanged(missing.document, missing.stats);
  } finally { missing.dom.window.close(); }

  const ambiguous = await boot({ duplicateOption: FIELD.degree.valueSample });
  try {
    const rowResult = await ambiguous.api.fillField(DEGREE, FIELD.degree.valueSample);
    assert.equal(rowResult.reason, 'ambiguous_option');
    assert.equal(rowResult.after, '');
    assert.equal(ambiguous.stats.option, 0);
    assert.equal(ambiguous.document.getElementById('select-menu').hidden, true);
  } finally { ambiguous.dom.window.close(); }
});

test('missing, duplicate, and drifted controls fail closed', async () => {
  const cases = [
    [{ dropAntInput: true }, ADDRESS, '合成联系地址'],
    [{ readonlyAddress: true }, ADDRESS, '合成联系地址'],
    [{ calendarOnAddress: true }, ADDRESS, '合成联系地址'],
    [{ extraTextInput: true }, ADDRESS, '合成联系地址'],
    [{ hiddenAddress: true }, ADDRESS, '合成联系地址'],
    [{ typeNumber: true }, ADDRESS, '合成联系地址'],
    [{ dropAntRow: true }, ADDRESS, '合成联系地址'],
    [{ duplicateAddress: true }, ADDRESS, '合成联系地址'],
    [{ noteAsInput: true }, NOTE, '合成评价内容'],
    [{ extraTextarea: true }, NOTE, '合成评价内容'],
    [{ readonlyNote: true }, NOTE, '合成评价内容'],
    [{ hiddenNote: true }, NOTE, '合成评价内容'],
    [{ dropSearch: true }, DEGREE, FIELD.degree.valueSample],
    [{ dropAllowClear: true }, DEGREE, FIELD.degree.valueSample],
    [{ extraSelect: true }, DEGREE, FIELD.degree.valueSample],
    [{ selectDisabled: true }, DEGREE, FIELD.degree.valueSample],
    [{ hiddenSchool: true }, SCHOOL, FIELD.school.valueSample],
    [{ schoolNoiseLabel: '学历' }, DEGREE, FIELD.degree.valueSample],
    [{ badDropdown: true }, DEGREE, FIELD.degree.valueSample],
    [{ emptyMenu: true }, DEGREE, FIELD.degree.valueSample],
    [{ busy: true }, LEVEL, FIELD.level.valueSample],
    [{ duplicateMajorInside: true }, MAJOR, '合成专业名称'],
    [{ dropGraduation: true }, MAJOR, '合成专业名称'],
    [{ dropBasicMajor: true }, MAJOR, '合成专业名称'],
    [{ duplicateAnchorSchool: true }, DEGREE, FIELD.degree.valueSample],
    [{ duplicateGraduation: true }, LEVEL, FIELD.level.valueSample],
    [{ majorIsSelect: true }, MAJOR, '合成专业名称'],
    [{ closedSearchBare: true }, DEGREE, FIELD.degree.valueSample],
    [{ ambiguousValue: true }, DEGREE, FIELD.degree.valueSample],
    [{ extraMajorCaption: '学历' }, MAJOR, '合成专业名称'],
    [{ degreeIsText: true }, DEGREE, FIELD.degree.valueSample],
    [{ dropRoot: true }, ADDRESS, '合成联系地址'],
    [{ elForm: true }, ADDRESS, '合成联系地址'],
    [{ url: 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/mc/deliver/operationResumer' }, ADDRESS, '合成联系地址'],
    [{ url: 'https://gszq.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html' }, NOTE, '合成评价内容'],
    [{ url: 'http://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html' }, SCHOOL, FIELD.school.valueSample]
  ];
  for (const [state, label, value] of cases) {
    const h = await boot(state);
    try {
      const rowResult = await h.api.fillField(label, value);
      assert.notEqual(rowResult.reason, 'readback_matched', JSON.stringify(state));
      assert.equal(rowResult.ok, false, JSON.stringify({ state, row: rowResult }));
      assert.ok(['control_not_supported', 'control_busy', 'wrong_page'].includes(rowResult.reason), JSON.stringify({ state, row: rowResult }));
      assert.equal(rowResult.liveSupportClaimed, false);
      assert.equal(rowResult.supportClaimed, false);
      assert.equal(h.stats.option, 0, JSON.stringify(state));
      assert.equal(h.stats.forbidden, 0, JSON.stringify(state));
      assert.equal(h.stats.file, 0, JSON.stringify(state));
      if (!state.dropBasicMajor && !state.majorIsSelect && label === MAJOR && !state.dropRoot && !state.elForm && !state.url) {
        assert.equal(valueOf(h.document, 'major-input') ?? '', '');
      }
      if (!state.dropGraduation && !state.dropRoot && !state.elForm) {
        assert.equal(valueOf(h.document, 'grad-input'), probe.neighbors.graduation.token);
      }
      if (h.document.getElementById('edu-major-input')) {
        assert.equal(valueOf(h.document, 'edu-major-input'), probe.neighbors.eduMajor.token);
      }
    } finally { h.dom.window.close(); }
  }
});

test('closed flat selects with a placeholder mash match the selected value and do not open', async () => {
  const selects = probe.fields.filter((field) => field.kind === 'select');
  const samples = Object.fromEntries(selects.map((field) => [field.key, field.valueSample]));
  const text = await boot({
    closedSearch: true,
    placeholderMash: 'text',
    wrapSchool: true,
    school: FIELD.school.valueSample,
    ...samples
  });
  try {
    const view = text.api.inspect();
    assert.equal(view.liveSupportClaimed, false);
    assert.equal(view.supportClaimed, false);
    assert.equal(view.neverSave, true);
    assert.equal(view.saved, false);
    for (const field of selects) {
      const rowResult = view.fields.find((item) => item.label === field.label);
      assert.equal(rowResult.reason, 'structure_matched', field.label);
      assert.equal(rowResult.supported, false, field.label);
      assert.equal(rowResult.value, field.valueSample, field.label);
      const filled = await text.api.fillField(field.label, ` ${field.valueSample} `);
      assert.equal(filled.reason, 'preexisting_same_value', JSON.stringify(filled));
      assert.equal(filled.before, field.valueSample);
      assert.equal(filled.opened, false);
      assert.equal(filled.saved, false);
      assert.equal(filled.liveSupportClaimed, false);
      assert.equal(filled.supportClaimed, false);
      assert.equal(filled.softwareClickedSave, false);
    }
    assert.equal(text.stats.open, 0);
    assert.equal(text.stats.option, 0);
    assert.equal(text.stats.faceClass, '');
    assert.equal(text.stats.forbidden, 0);
    const live = probe.select.liveReadback;
    assert.equal(valueOf(text.document, 'school-input'), FIELD.school.valueSample);
    assert.equal(text.document.getElementById('degree-value').textContent, `${live.placeholderPrefix}${DEGREE}${FIELD.degree.valueSample}`);
    unchanged(text.document, text.stats);
  } finally { text.dom.window.close(); }

  const classes = await boot({
    closedSearch: true,
    placeholderMash: 'class',
    ...samples
  });
  try {
    for (const field of selects) {
      const filled = await classes.api.fillField(field.label, field.valueSample);
      assert.equal(filled.reason, 'preexisting_same_value', JSON.stringify(filled));
      assert.equal(filled.before, field.valueSample);
      assert.equal(filled.opened, false);
      assert.equal(filled.liveSupportClaimed, false);
      assert.equal(filled.supportClaimed, false);
    }
    assert.equal(classes.stats.open, 0);
    assert.equal(classes.stats.forbidden, 0);
    const nation = classes.document.querySelector('#degree-select .ant-select-selection-selected-value');
    const prompt = classes.document.querySelector('#degree-select .ant-select-selection__placeholder');
    assert.equal(nation.textContent, FIELD.degree.valueSample);
    assert.equal(prompt.textContent, `${probe.select.liveReadback.placeholderPrefix}${DEGREE}`);
    unchanged(classes.document, classes.stats);
  } finally { classes.dom.window.close(); }
});

test('an empty closed flat select opens from the visible face and reads the selected value', async () => {
  const h = await boot({ closedSearch: true, placeholderMash: 'class' });
  try {
    const selects = probe.fields.filter((field) => field.kind === 'select');
    for (const field of selects) {
      const filled = await h.api.fillField(field.label, field.valueSample);
      assert.equal(filled.ok, true, JSON.stringify(filled));
      assert.equal(filled.reason, 'readback_matched', field.label);
      assert.equal(filled.after, field.valueSample, field.label);
      assert.equal(filled.before, '', field.label);
      assert.equal(filled.opened, true, field.label);
      assert.equal(filled.stillOpen, 0, field.label);
      assert.equal(filled.saved, false, field.label);
      assert.equal(filled.liveSupportClaimed, false, field.label);
      assert.equal(filled.supportClaimed, false, field.label);
      assert.equal(filled.neverSave, true, field.label);
      assert.equal(filled.softwareClickedSave, false, field.label);
    }
    assert.equal(h.stats.open, selects.length);
    assert.equal(h.stats.option, selects.length);
    assert.equal(h.stats.triggerClass, '');
    assert.equal(h.stats.faceClass, probe.select.liveReadback.faceClass);
    assert.equal(h.stats.forbidden, 0);
    assert.equal(valueOf(h.document, 'school-input'), '');
    assert.equal(h.document.querySelector('#degree-select .ant-select-selection-selected-value').textContent, FIELD.degree.valueSample);
    assert.equal(
      h.document.querySelector('#arrival-select .ant-select-selection__placeholder').textContent,
      `${probe.select.liveReadback.placeholderPrefix}${ARRIVAL}`
    );
    assert.equal(h.document.getElementById('select-menu').hidden, true);
    assert.equal(h.document.querySelectorAll('.ant-select-open').length, 0);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('duplicate 毕业院校 captions still locate the text row and the anchored degree, level, and major', async () => {
  const h = await boot({
    duplicateSchoolCaption: true,
    wrapSchool: true,
    closedSearch: true,
    placeholderMash: 'class',
    school: FIELD.school.valueSample,
    degree: FIELD.degree.valueSample,
    level: FIELD.level.valueSample
  });
  try {
    const view = h.api.inspect();
    assert.equal(view.liveSupportClaimed, false);
    assert.equal(view.supportClaimed, false);
    assert.equal(view.neverSave, true);
    assert.equal(view.saved, false);
    for (const label of [SCHOOL, DEGREE, LEVEL, MAJOR]) {
      const field = view.fields.find((item) => item.label === label);
      assert.equal(field.reason, 'structure_matched', label);
      assert.equal(field.supported, false, label);
    }
    assert.equal(view.fields.find((field) => field.label === SCHOOL).value, FIELD.school.valueSample);
    assert.equal(view.fields.find((field) => field.label === DEGREE).value, FIELD.degree.valueSample);
    assert.equal(view.fields.find((field) => field.label === LEVEL).value, FIELD.level.valueSample);
    assert.equal(view.fields.find((field) => field.label === MAJOR).value, '');
    const school = await h.api.fillField(SCHOOL, ` ${FIELD.school.valueSample} `);
    const degree = await h.api.fillField(DEGREE, FIELD.degree.valueSample);
    const level = await h.api.fillField(LEVEL, FIELD.level.valueSample);
    const major = await h.api.fillField(MAJOR, '合成专业名称');
    assert.equal(school.reason, 'preexisting_same_value', JSON.stringify(school));
    assert.equal(school.opened, false);
    assert.equal(school.saved, false);
    assert.equal(school.liveSupportClaimed, false);
    assert.equal(school.supportClaimed, false);
    assert.equal(school.neverSave, true);
    assert.equal(degree.reason, 'preexisting_same_value', JSON.stringify(degree));
    assert.equal(degree.opened, false);
    assert.equal(degree.liveSupportClaimed, false);
    assert.equal(level.reason, 'preexisting_same_value');
    assert.equal(level.opened, false);
    assert.equal(major.ok, true, JSON.stringify(major));
    assert.equal(major.reason, 'readback_matched');
    assert.equal(major.after, '合成专业名称');
    assert.equal(major.opened, false);
    assert.equal(major.liveSupportClaimed, false);
    assert.equal(major.supportClaimed, false);
    assert.equal(valueOf(h.document, 'school-input'), FIELD.school.valueSample);
    assert.equal(valueOf(h.document, 'major-input'), '合成专业名称');
    assert.equal(valueOf(h.document, 'edu-major-input'), probe.neighbors.eduMajor.token);
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.option, 0);
    assert.equal(h.stats.forbidden, 0);
    assert.equal(h.document.querySelector('#degree-select .ant-select-selection-selected-value').textContent, FIELD.degree.valueSample);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('专业名称 stays the basic text row and does not use the education value', async () => {
  const kept = await boot({
    wrapMajor: true,
    wrapGraduation: true,
    blankMajorLabel: true,
    major: '已有专业',
    eduMajor: '合成专业名称'
  });
  try {
    const major = await kept.api.fillField(MAJOR, '合成专业名称');
    assert.equal(major.reason, 'existing_value', JSON.stringify(major));
    assert.equal(major.ok, false);
    assert.equal(major.before, '已有专业');
    assert.equal(major.opened, false);
    assert.equal(major.liveSupportClaimed, false);
    assert.equal(major.supportClaimed, false);
    assert.equal(major.saved, false);
    assert.equal(valueOf(kept.document, 'major-input'), '已有专业');
    assert.equal(valueOf(kept.document, 'edu-major-input'), '合成专业名称');
    assert.equal(kept.stats.focus, 0);
    assert.equal(kept.stats.textInput, 0);
    assert.equal(kept.stats.forbidden, 0);
    unchanged(kept.document, kept.stats);
  } finally { kept.dom.window.close(); }

  const empty = await boot({
    wrapGraduation: true,
    blankMajorLabel: true,
    eduMajor: '合成专业名称'
  });
  try {
    const major = await empty.api.fillField(MAJOR, '合成专业名称');
    assert.equal(major.ok, true, JSON.stringify(major));
    assert.equal(major.reason, 'readback_matched');
    assert.equal(major.after, '合成专业名称');
    assert.equal(major.opened, false);
    assert.equal(major.liveSupportClaimed, false);
    assert.equal(major.supportClaimed, false);
    assert.equal(valueOf(empty.document, 'major-input'), '合成专业名称');
    assert.equal(valueOf(empty.document, 'edu-major-input'), '合成专业名称');
    assert.equal(valueOf(empty.document, 'grad-input'), probe.neighbors.graduation.token);
    assert.equal(empty.stats.neighborFocus, 0);
    assert.equal(empty.stats.forbidden, 0);
    unchanged(empty.document, empty.stats);
  } finally { empty.dom.window.close(); }
});

test('a hidden page fails closed before a click or write', async () => {
  const h = await boot({});
  try {
    Object.defineProperty(h.document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    const rowResult = await h.api.fillField(ADDRESS, '合成联系地址');
    const area = await h.api.fillField(NOTE, '合成评价内容');
    const select = await h.api.fillField(NATURE, FIELD.nature.valueSample);
    assert.equal(rowResult.reason, 'fill_interrupted_page_hidden');
    assert.equal(area.reason, 'fill_interrupted_page_hidden');
    assert.equal(select.reason, 'fill_interrupted_page_hidden');
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.textInput, 0);
    assert.equal(h.stats.focus, 0);
    assert.equal(rowResult.liveSupportClaimed, false);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});
