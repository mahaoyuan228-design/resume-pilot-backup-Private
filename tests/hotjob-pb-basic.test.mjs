// Offline Never-Save trials for hotjob pb basic text, 性别 radios, and flat selects.
// Markup is built from tests/fixtures/hotjob-pb-basic-probe-dom.json (2026-10-23
// probe classes, labels, and menu text only). A green run is not a live support claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const root = new URL('..', import.meta.url);
const source = readFileSync(new URL('../src/content/hotjob-pb-basic.js', import.meta.url), 'utf8');
const regionSource = readFileSync(new URL('../src/content/hotjob-pb-region.js', import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../manifest.json', import.meta.url), 'utf8');
const engine = readFileSync(new URL('../src/content/engine.js', import.meta.url), 'utf8');
const popup = readFileSync(new URL('../src/popup/popup.js', import.meta.url), 'utf8');
const mcRunner = readFileSync(new URL('../src/background/hotjob-mc-basic-auto.mjs', import.meta.url), 'utf8');
const probe = JSON.parse(readFileSync(new URL('../tests/fixtures/hotjob-pb-basic-probe-dom.json', import.meta.url), 'utf8'));
const PAGE = `https://${probe.page.hostname}${probe.page.samplePath}`;
const TEXT = Object.fromEntries(probe.text.fields.map((field) => [field.key, field]));
const SELECTS = Object.fromEntries(probe.select.fields.map((field) => [field.key, field]));
const PHONE = TEXT.phone.label;
const EMAIL = TEXT.email.label;
const HEIGHT = TEXT.height.label;
const ID_NUMBER = TEXT.idNumber.label;
const HEIGHT_SAMPLE = TEXT.height.valueSample;
const ID_SAMPLE = TEXT.idNumber.valueSample;
const FORBIDDEN = probe.page.forbiddenButtons;
const PROFILE = {
  [TEXT.name.label]: '合成姓名',
  [probe.gender.label]: '男',
  [HEIGHT]: HEIGHT_SAMPLE,
  [SELECTS.nation.label]: '中国香港',
  [SELECTS.ethnic.label]: '回族',
  [SELECTS.marriage.label]: '已婚',
  [SELECTS.politics.label]: '共青团员',
  [SELECTS.idType.label]: '身份证',
  [ID_NUMBER]: ID_SAMPLE,
  [PHONE]: '13800138000',
  [EMAIL]: 'synthetic.pb@example.com'
};

function esc(value) {
  return String(value).replace(/[&<>"]/gu, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function classes(value) {
  return String(value).split(/\s+/u).filter(Boolean);
}

function textHit(state, field) {
  return field.key === (state.textDriftKey || 'name');
}

function textField(field, value, state) {
  const hit = textHit(state, field);
  const dropClass = state.dropAntInput && hit;
  const calendar = state.calendarOnName && hit;
  const className = dropClass ? 'plain-input' : (calendar ? probe.neighbors.birth.controlClass : probe.text.controlClass);
  const type = state.typeNumber && hit ? 'number' : probe.text.inputType;
  const readonly = state.readonlyName && hit ? ' readonly' : '';
  const placeholderText = hit && Object.hasOwn(state, 'placeholderOverride') ? state.placeholderOverride : field.placeholder;
  const placeholder = placeholderText ? ` placeholder="${esc(placeholderText)}"` : '';
  const extra = state.extraTextInput && hit
    ? `<input class="${esc(probe.text.controlClass)}" type="text" value="">` : '';
  const hidden = state.hiddenName && hit ? ' hidden' : '';
  const itemClass = state.dropAntRow && hit ? 'ant-form-item' : probe.page.itemClass;
  return `<div class="${esc(itemClass)}" data-field="${field.key}"${hidden}><label>${esc(field.label)}*</label><span class="${esc(probe.page.childrenClass)}"><input id="${field.key}-input" class="${esc(className)}" type="${type}"${placeholder}${readonly} value="${esc(value)}"></span>${extra}</div>`;
}

function radioGroup(id, label, options, name, checked, state) {
  const bare = state.genderBare && id === 'gender';
  const control = state.dropRadioClass && id === 'gender' ? 'plain-radio' : probe.gender.controlClass;
  const type = state.genderCheckbox && id === 'gender' ? 'checkbox' : probe.gender.inputType;
  let rows = options.map((text) => {
    const mark = checked === text ? ' checked' : '';
    const disabled = state.genderDisabled && id === 'gender' ? ' disabled' : '';
    return `<label><span><input class="${esc(control)}" type="${type}" name="${name}"${mark}${disabled}></span><span>${esc(text)}</span></label>`;
  });
  if (state.genderOne && id === 'gender') rows = rows.slice(0, 1);
  if (state.duplicateGenderText && id === 'gender') {
    rows = [
      `<label><span><input class="${esc(probe.gender.controlClass)}" type="radio" name="${name}"></span><span>男</span></label>`,
      `<label><span><input class="${esc(probe.gender.controlClass)}" type="radio" name="${name}"></span><span>男</span></label>`
    ];
  }
  const body = bare
    ? options.map(() => `<input class="${esc(probe.gender.controlClass)}" type="radio" name="${name}">`).join('') + options.join('')
    : rows.join('');
  return `<div class="${esc(probe.page.itemClass)}" data-field="${id}"><label>${esc(label)}*</label><span class="${esc(probe.page.childrenClass)}">${body}</span></div>`;
}

function selectInner(field, value, state) {
  const live = probe.select.liveReadback;
  if (state.ambiguousValue && field.key === 'nation') {
    return `<span class="${esc(live.selectedValueClass)}">中国</span><span class="${esc(live.selectedValueClass)}">中国香港</span>`;
  }
  if (state.placeholderMash === 'class') {
    return `<span class="${esc(live.placeholderClass)}">${esc(live.placeholderPrefix + field.label)}</span><span class="${esc(live.selectedValueClass)}" id="${field.key}-value">${esc(value)}</span>`;
  }
  const shown = state.placeholderMash === 'text' ? `${live.placeholderPrefix}${field.label}${value}` : value;
  return `<span id="${field.key}-value">${esc(shown)}</span>`;
}

function selectField(field, value, state) {
  const live = probe.select.liveReadback;
  const selectClass = state.dropAllowClear && field.key === 'nation'
    ? 'ant-select ant-select-enabled'
    : probe.select.controlClass;
  const trigger = state.dropSearch && field.key === 'nation' ? '' : `<input class="${esc(probe.select.triggerClass)}" type="text" value="">`;
  const extra = state.extraSelect && field.key === 'nation'
    ? `<div class="${esc(probe.select.controlClass)}"><span></span><input class="${esc(probe.select.triggerClass)}" type="text" value=""></div>` : '';
  const inner = selectInner(field, value, state);
  const faced = (state.closedSearch || state.placeholderMash === 'class')
    ? `<div class="${esc(live.faceClass)}" role="${esc(live.faceRole)}">${inner}</div>`
    : inner;
  return `<div class="${esc(probe.page.itemClass)}" data-field="${field.key}"><label>${esc(field.label)}*</label><span class="${esc(probe.page.childrenClass)}"><div class="${esc(selectClass)}" id="${field.key}-select">${faced}${trigger}</div>${extra}</span></div>`;
}

function optionsFor(field, state) {
  const rows = [...field.optionsSample];
  if (state.duplicateOption && field.key === 'marriage') rows.push(state.duplicateOption);
  if (state.emptyMenu && field.key === 'marriage') return [];
  return rows;
}

function html(state) {
  const rootClass = state.dropRoot ? 'page-root' : probe.page.rootClass;
  const shell = state.elForm ? '<div class="el-form"></div>' : '';
  const duplicate = state.duplicateName
    ? textField(TEXT.name, '', state).replace('data-field="name"', 'data-field="name-copy"')
    : state.duplicateKey
      ? textField(TEXT[state.duplicateKey], '', {}).replace(
        `data-field="${state.duplicateKey}"`,
        `data-field="${state.duplicateKey}-copy"`
      )
      : '';
  const dropdownClass = state.badDropdown
    ? 'ant-select-dropdown ant-select-dropdown-placement-bottomLeft'
    : probe.select.dropdownClass;
  const buttons = [...probe.page.buttonLabels, ...FORBIDDEN.filter((label) => !probe.page.buttonLabels.includes(label))]
    .map((label) => `<button type="button">${esc(label)}</button>`).join('');
  const neighbor = probe.neighbors;
  return `<!doctype html><body>${shell}<div class="${esc(rootClass)}"><div class="${esc(probe.page.contentClass)}">${
    textField(TEXT.name, state.name ?? '', state)
  }${radioGroup('gender', probe.gender.label, probe.gender.options, 'pb-gender', state.gender ?? '', state)
  }${textField(TEXT.height, state.height ?? '', state)
  }${probe.select.fields.map((field) => selectField(field, state[field.key] ?? '', state)).join('')
  }${textField(TEXT.idNumber, state.idNumber ?? '', state)
  }${textField(TEXT.phone, state.phone ?? '', state)
  }${textField(TEXT.email, state.email ?? '', state)
  }${textField({ key: 'address', label: neighbor.address.label, placeholder: neighbor.address.placeholder }, state.address ?? neighbor.address.token, {})
  }<div class="${esc(probe.page.itemClass)}"><label>${esc(neighbor.birth.label)}*</label><span class="${esc(probe.page.childrenClass)}"><input id="birth-input" class="${esc(neighbor.birth.controlClass)}" type="text" readonly value="${esc(neighbor.birth.token)}"></span></div>${
    `<div class="${esc(probe.page.itemClass)}"><label>${esc(neighbor.residence.label)}*</label><span class="${esc(probe.page.childrenClass)}"><span class="${esc(neighbor.residence.menuClass)}"><div class="${esc(neighbor.residence.controlClass)}" id="residence-select"><span id="residence-value">${esc(neighbor.residence.token)}</span></div></span></span></div>`
  }${selectField({ key: 'interview', label: neighbor.interview.label }, state.interview ?? neighbor.interview.token, {})
  }${radioGroup('obey', neighbor.obey.label, neighbor.obey.options, 'pb-obey', '', {})
  }<div class="${esc(neighbor.photo.itemClass)}"><label>${esc(neighbor.photo.label)}*</label><input id="photo" type="file"></div><div class="${esc(neighbor.portrait.itemClass)}"><label>${esc(neighbor.portrait.label)}*</label><input id="portrait" type="file"></div><div class="${esc(probe.page.itemClass)}"><label>${esc(neighbor.note.label)}*</label><textarea id="note" class="${esc(neighbor.note.controlClass)}">${esc(neighbor.note.token)}</textarea></div>${duplicate}${buttons}</div></div><div class="${esc(dropdownClass)}" id="select-menu" hidden><ul id="select-options"></ul></div></body>`;
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
  const field = probe.select.fields.find((row) => `${row.key}-select` === select.id);
  const options = field ? optionsFor(field, state) : [probe.neighbors.interview.token];
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
    open: 0, option: 0, escape: 0, forbidden: 0, file: 0, radio: 0, textInput: 0, focus: 0,
    openClass: '', triggerClass: '', faceClass: ''
  };
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (button && FORBIDDEN.includes(button.textContent.trim())) stats.forbidden += 1;
    if (event.target.matches?.('input[type="file"]')) stats.file += 1;
    const radio = event.target.closest?.('input.ant-radio-input, input.plain-radio');
    if (radio) {
      stats.radio += 1;
      stats.triggerClass = radio.className;
    }
  }, true);
  for (const input of document.querySelectorAll('input.ant-input, #name-input')) {
    input.addEventListener('input', () => { stats.textInput += 1; });
    input.addEventListener('focus', () => { stats.focus += 1; });
  }
  for (const select of document.querySelectorAll('.ant-select')) {
    select.addEventListener('click', (event) => {
      if (document.getElementById('select-menu').contains(event.target)) return;
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
    const slot = select.querySelector('.ant-select-selection-selected-value, [id$="-value"]') || select.querySelector('span');
    slot.textContent = li.textContent.trim();
    closeWidgets(document);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    stats.escape += 1;
    if (state.ignoreEscape) return;
    closeWidgets(document);
  });
  if (state.busy) {
    const select = document.getElementById('nation-select');
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
  return { dom, window, document, stats, api: window.ResumeHotjobPbBasic };
}

function unchanged(document, stats, owned = {}) {
  assert.equal(document.getElementById('address-input').value, probe.neighbors.address.token);
  assert.equal(document.getElementById('idNumber-input').value, owned.idNumber ?? '');
  assert.equal(document.getElementById('height-input').value, owned.height ?? '');
  assert.equal(document.getElementById('height-input').getAttribute('placeholder'), TEXT.height.placeholder);
  assert.equal(document.getElementById('idNumber-input').getAttribute('placeholder'), TEXT.idNumber.placeholder);
  assert.equal(document.getElementById('birth-input').value, probe.neighbors.birth.token);
  assert.equal(document.getElementById('residence-value').textContent, probe.neighbors.residence.token);
  assert.equal(document.getElementById('interview-value').textContent, probe.neighbors.interview.token);
  assert.equal(document.getElementById('note').value, probe.neighbors.note.token);
  assert.equal(document.getElementById('photo').files.length, 0);
  assert.equal(document.getElementById('portrait').files.length, 0);
  assert.equal([...document.querySelectorAll('input[name="pb-obey"]')].some((node) => node.checked), false);
  assert.equal(stats.forbidden, 0);
  assert.equal(stats.file, 0);
}

test('source stays on the probed pb classes and does not claim support', () => {
  assert.match(source, /ResumeHotjobPbBasic/);
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
  assert.doesNotMatch(source, /ant-cascader-menus|form-cell|ant-select-selection--single|ant-radio-wrapper|ant-select-dropdown-menu-item/);
  assert.equal(manifest.includes('hotjob-pb-basic'), false);
  assert.equal(engine.includes('hotjob-pb-basic'), false);
  assert.equal(popup.includes('hotjob-pb-basic'), false);
  assert.equal(mcRunner.includes('hotjob-pb-basic'), false);
  assert.equal(regionSource.includes('hotjob-pb-basic'), false);
  assert.doesNotMatch(source, /1\d{10}/);
  assert.doesNotMatch(source, /11010220020125231X/);
  for (const token of [
    ...classes(probe.page.itemClass),
    probe.text.controlClass,
    probe.gender.controlClass,
    ...classes(probe.select.controlClass),
    probe.select.triggerClass,
    ...classes(probe.select.dropdownClass),
    ...classes(probe.select.openClass),
    probe.page.rootClass,
    'ant-calendar-picker-input',
    probe.select.liveReadback.selectedValueClass,
    probe.select.liveReadback.placeholderClass,
    probe.select.liveReadback.placeholderPrefix,
    probe.select.liveReadback.faceClass,
    '[role="combobox"]',
    '.ant-select-selector',
    '.ant-select-selection-item',
    TEXT.name.label,
    HEIGHT,
    ID_NUMBER,
    TEXT.height.placeholder,
    TEXT.idNumber.placeholder,
    PHONE,
    EMAIL,
    probe.gender.label,
    ...probe.select.fields.map((field) => field.label)
  ]) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  }
});

test('fixture html uses only the probe class list, labels, and menu text', () => {
  const built = html({});
  for (const token of [
    probe.page.rootClass, probe.page.contentClass, probe.page.childrenClass,
    ...classes(probe.page.itemClass), probe.text.controlClass, probe.gender.controlClass,
    ...classes(probe.select.controlClass), probe.select.triggerClass,
    ...classes(probe.select.dropdownClass), probe.neighbors.birth.controlClass,
    probe.neighbors.residence.menuClass, probe.neighbors.photo.itemClass,
    probe.neighbors.portrait.itemClass
  ]) assert.match(built, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  for (const field of probe.text.fields) assert.match(built, new RegExp(`>${field.label}\\*`));
  for (const option of probe.gender.options) assert.match(built, new RegExp(`>${option}<`));
  for (const field of probe.select.fields) {
    assert.match(built, new RegExp(`>${field.label}\\*`));
  }
  for (const label of probe.page.buttonLabels) assert.match(built, new RegExp(`>${label}<`));
  assert.match(built, new RegExp(`placeholder="${TEXT.height.placeholder.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}"`));
  assert.match(built, new RegExp(`placeholder="${TEXT.idNumber.placeholder.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}"`));
  assert.equal(TEXT.height.valueSample, '182');
  assert.equal(TEXT.idNumber.valueSample, '11010220020125231X');
  assert.equal(TEXT.height.placeholder, '（单位：cm）');
  assert.equal(TEXT.idNumber.placeholder, '请填写证件号码');
  assert.doesNotMatch(built, /ant-radio-wrapper|ant-select-selection--single|ant-cascader-menus|ant-select-dropdown-menu-item/);
  assert.doesNotMatch(built, /1\d{10}/);
  assert.doesNotMatch(JSON.stringify(probe).split(ID_SAMPLE).join(''), /1\d{10}/);
  assert.equal(built.includes('placeholder="请填写电子邮箱'), false);
});

test('inspect matches the eleven probed fields and does not claim support', async () => {
  const h = await boot({
    gender: '男',
    height: HEIGHT_SAMPLE,
    idNumber: ID_SAMPLE,
    nation: '中国',
    ethnic: '汉族',
    marriage: '未婚',
    politics: '群众',
    idType: '身份证'
  });
  try {
    const view = h.api.inspect();
    assert.equal(h.api.liveSupportClaimed, false);
    assert.equal(h.api.supportClaimed, false);
    assert.equal(h.api.neverSave, true);
    assert.equal(h.window.ResumeHotjobPbRegion, undefined);
    assert.equal(view.liveSupportClaimed, false);
    assert.equal(view.supportClaimed, false);
    assert.equal(view.neverSave, true);
    assert.equal(view.complete, false);
    assert.equal(view.saved, false);
    assert.equal(view.fields.length, 11);
    const expectedLabels = [
      TEXT.name.label,
      probe.gender.label,
      HEIGHT,
      SELECTS.nation.label,
      SELECTS.ethnic.label,
      SELECTS.marriage.label,
      SELECTS.politics.label,
      SELECTS.idType.label,
      ID_NUMBER,
      PHONE,
      EMAIL
    ];
    assert.deepEqual(Array.from(view.fields, (field) => field.label), expectedLabels);
    assert.equal(view.fields.every((field) => field.supported === false), true);
    assert.equal(view.fields.every((field) => field.reason === 'structure_matched'), true);
    assert.equal(view.fields.find((field) => field.label === probe.gender.label).kind, 'radio');
    assert.equal(view.fields.find((field) => field.label === probe.gender.label).value, '男');
    assert.equal(view.fields.find((field) => field.label === SELECTS.nation.label).value, '中国');
    assert.equal(view.fields.find((field) => field.label === PHONE).kind, 'text');
    assert.equal(view.fields.find((field) => field.label === HEIGHT).kind, 'text');
    assert.equal(view.fields.find((field) => field.label === HEIGHT).value, HEIGHT_SAMPLE);
    assert.equal(view.fields.find((field) => field.label === ID_NUMBER).kind, 'text');
    assert.equal(view.fields.find((field) => field.label === ID_NUMBER).value, ID_SAMPLE);
    assert.equal(view.fields.find((field) => field.label === HEIGHT).supported, false);
    assert.equal(view.fields.find((field) => field.label === ID_NUMBER).supported, false);
    assert.equal(view.fields.map((field) => field.label).includes(probe.neighbors.residence.label), false);
    assert.equal(view.fields.map((field) => field.label).includes(probe.neighbors.interview.label), false);
    unchanged(h.document, h.stats, { height: HEIGHT_SAMPLE, idNumber: ID_SAMPLE });
  } finally { h.dom.window.close(); }
});

test('empty text, radio, and flat selects read back the probed option or written value', async () => {
  const h = await boot({});
  try {
    const name = await h.api.fillField(TEXT.name.label, '  合成姓名  ');
    const height = await h.api.fillField(HEIGHT, ` ${HEIGHT_SAMPLE} `);
    const idNumber = await h.api.fillField(ID_NUMBER, ` ${ID_SAMPLE} `);
    const gender = await h.api.fillField(probe.gender.label, '男');
    const nation = await h.api.fillField(SELECTS.nation.label, '中国');
    const phone = await h.api.fillField(PHONE, '138 0013 8000');
    const email = await h.api.fillField(EMAIL, PROFILE[EMAIL]);
    const idType = await h.api.fillField(SELECTS.idType.label, '身份证');
    assert.equal(name.ok, true, JSON.stringify(name));
    assert.equal(name.reason, 'readback_matched');
    assert.equal(name.after, '合成姓名');
    assert.equal(name.opened, false);
    assert.equal(height.ok, true, JSON.stringify(height));
    assert.equal(height.reason, 'readback_matched');
    assert.equal(height.after, HEIGHT_SAMPLE);
    assert.equal(height.before, '');
    assert.equal(height.opened, false);
    assert.equal(height.canceled, false);
    assert.equal(height.saved, false);
    assert.equal(height.skippedSave, true);
    assert.equal(height.neverSave, true);
    assert.equal(height.liveSupportClaimed, false);
    assert.equal(height.supportClaimed, false);
    assert.equal(height.complete, false);
    assert.equal(idNumber.reason, 'readback_matched');
    assert.equal(idNumber.after, ID_SAMPLE);
    assert.equal(idNumber.opened, false);
    assert.equal(idNumber.saved, false);
    assert.equal(idNumber.liveSupportClaimed, false);
    assert.equal(idNumber.supportClaimed, false);
    assert.equal(name.liveSupportClaimed, false);
    assert.equal(name.complete, false);
    assert.equal(name.saved, false);
    assert.equal(name.skippedSave, true);
    assert.equal(name.neverSave, true);
    assert.equal(gender.reason, 'readback_matched');
    assert.equal(gender.after, '男');
    assert.equal(gender.opened, false);
    assert.equal(nation.reason, 'readback_matched');
    assert.equal(nation.after, '中国');
    assert.equal(nation.opened, true);
    assert.equal(nation.stillOpen, 0);
    assert.equal(phone.after, '13800138000');
    assert.equal(email.after, PROFILE[EMAIL]);
    assert.equal(idType.after, '身份证');
    assert.equal(h.stats.triggerClass, probe.select.triggerClass);
    assert.match(h.stats.openClass, /ant-select-open/);
    assert.match(h.stats.openClass, /ant-select-focused/);
    assert.match(h.stats.openClass, /ant-select-enabled/);
    assert.equal(h.document.getElementById('name-input').value, '合成姓名');
    assert.equal(h.document.getElementById('height-input').value, HEIGHT_SAMPLE);
    assert.equal(h.document.getElementById('idNumber-input').value, ID_SAMPLE);
    assert.equal(h.document.getElementById('phone-input').value, '13800138000');
    assert.equal(h.document.getElementById('nation-value').textContent, '中国');
    assert.equal(h.document.querySelector('input[name="pb-gender"]').checked, true);
    assert.equal(h.document.querySelectorAll('.ant-select-open').length, 0);
    assert.equal(h.document.getElementById('select-menu').hidden, true);
    assert.equal(h.stats.option, 2);
    assert.equal(h.stats.radio, 1);
    assert.equal(h.stats.forbidden, 0);
    unchanged(h.document, h.stats, { height: HEIGHT_SAMPLE, idNumber: ID_SAMPLE });
  } finally { h.dom.window.close(); }
});

test('fillFields reads back all eleven and leaves neighbors untouched', async () => {
  const h = await boot({});
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
    assert.equal(h.document.getElementById('ethnic-value').textContent, '回族');
    assert.equal(h.document.getElementById('marriage-value').textContent, '已婚');
    assert.equal(h.document.getElementById('politics-value').textContent, '共青团员');
    assert.equal(h.document.getElementById('email-input').value, PROFILE[EMAIL]);
    assert.equal(h.document.getElementById('height-input').value, HEIGHT_SAMPLE);
    assert.equal(h.document.getElementById('idNumber-input').value, ID_SAMPLE);
    assert.equal(h.stats.option, 5);
    assert.equal(h.stats.radio, 1);
    assert.equal(h.stats.forbidden, 0);
    assert.equal(filled.fields.find((field) => field.label === HEIGHT).reason, 'readback_matched');
    assert.equal(filled.fields.find((field) => field.label === ID_NUMBER).reason, 'readback_matched');
    assert.equal(filled.fields.find((field) => field.label === HEIGHT).liveSupportClaimed, false);
    assert.equal(filled.fields.find((field) => field.label === ID_NUMBER).supportClaimed, false);
    unchanged(h.document, h.stats, { height: HEIGHT_SAMPLE, idNumber: ID_SAMPLE });
  } finally { h.dom.window.close(); }
});

test('preexisting same values do not focus, reopen, or paint', async () => {
  const h = await boot({
    name: '合成 姓名',
    phone: '138 0013 8000',
    email: PROFILE[EMAIL],
    gender: '男',
    nation: '中国',
    ethnic: '汉族',
    marriage: '未婚',
    politics: '群众',
    idType: '身份证'
  });
  try {
    const name = await h.api.fillField(TEXT.name.label, '合成姓名');
    const phone = await h.api.fillField(PHONE, '13800138000');
    const gender = await h.api.fillField(probe.gender.label, '男');
    const nation = await h.api.fillField(SELECTS.nation.label, ' 中国 ');
    const marriage = await h.api.fillField(SELECTS.marriage.label, '未婚');
    assert.equal(name.reason, 'preexisting_same_value');
    assert.equal(name.status, 'verified');
    assert.equal(name.opened, false);
    assert.equal(phone.reason, 'preexisting_same_value');
    assert.equal(gender.reason, 'preexisting_same_value');
    assert.equal(nation.reason, 'preexisting_same_value');
    assert.equal(marriage.reason, 'preexisting_same_value');
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.option, 0);
    assert.equal(h.stats.radio, 0);
    assert.equal(h.stats.textInput, 0);
    assert.equal(h.stats.focus, 0);
    assert.equal(h.document.getElementById('name-input').value, '合成 姓名');
    assert.equal(h.document.getElementById('phone-input').value, '138 0013 8000');
    assert.equal(h.document.getElementById('nation-value').textContent, '中国');
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('probed height and id number already on the page stay preexisting and unopened', async () => {
  const h = await boot({ height: ` ${HEIGHT_SAMPLE} `, idNumber: ID_SAMPLE });
  try {
    const height = await h.api.fillField(HEIGHT, HEIGHT_SAMPLE);
    const idNumber = await h.api.fillField(ID_NUMBER, ` ${ID_SAMPLE} `);
    assert.equal(height.reason, 'preexisting_same_value');
    assert.equal(height.status, 'verified');
    assert.equal(height.ok, true);
    assert.equal(height.before, HEIGHT_SAMPLE);
    assert.equal(height.after, HEIGHT_SAMPLE);
    assert.equal(height.opened, false);
    assert.equal(height.saved, false);
    assert.equal(height.skippedSave, true);
    assert.equal(height.neverSave, true);
    assert.equal(height.liveSupportClaimed, false);
    assert.equal(height.supportClaimed, false);
    assert.equal(height.complete, false);
    assert.equal(idNumber.reason, 'preexisting_same_value');
    assert.equal(idNumber.status, 'verified');
    assert.equal(idNumber.ok, true);
    assert.equal(idNumber.before, ID_SAMPLE);
    assert.equal(idNumber.after, ID_SAMPLE);
    assert.equal(idNumber.opened, false);
    assert.equal(idNumber.liveSupportClaimed, false);
    assert.equal(idNumber.supportClaimed, false);
    assert.equal(h.stats.focus, 0);
    assert.equal(h.stats.textInput, 0);
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.option, 0);
    assert.equal(h.stats.forbidden, 0);
    assert.equal(h.document.getElementById('height-input').value, ` ${HEIGHT_SAMPLE} `);
    assert.equal(h.document.getElementById('idNumber-input').value, ID_SAMPLE);
    unchanged(h.document, h.stats, { height: ` ${HEIGHT_SAMPLE} `, idNumber: ID_SAMPLE });
  } finally { h.dom.window.close(); }

  const kept = await boot({ height: '175', idNumber: 'OTHER_ID' });
  try {
    const height = await kept.api.fillField(HEIGHT, HEIGHT_SAMPLE);
    const idNumber = await kept.api.fillField(ID_NUMBER, ID_SAMPLE);
    assert.equal(height.reason, 'existing_value');
    assert.equal(height.status, 'skipped');
    assert.equal(height.ok, false);
    assert.equal(height.opened, false);
    assert.equal(height.liveSupportClaimed, false);
    assert.equal(idNumber.reason, 'existing_value');
    assert.equal(idNumber.ok, false);
    assert.equal(idNumber.supportClaimed, false);
    assert.equal(kept.stats.focus, 0);
    assert.equal(kept.stats.textInput, 0);
    assert.equal(kept.stats.forbidden, 0);
    assert.equal(kept.document.getElementById('height-input').value, '175');
    assert.equal(kept.document.getElementById('idNumber-input').value, 'OTHER_ID');
    unchanged(kept.document, kept.stats, { height: '175', idNumber: 'OTHER_ID' });
  } finally { kept.dom.window.close(); }

  const blank = await boot({});
  try {
    for (const value of ['', '   ', null, 1]) {
      const height = await blank.api.fillField(HEIGHT, value);
      assert.equal(height.reason, 'missing_profile_value', String(value));
      assert.equal(height.ok, false);
      assert.equal(height.liveSupportClaimed, false);
      const idNumber = await blank.api.fillField(ID_NUMBER, value);
      assert.equal(idNumber.reason, 'missing_profile_value', String(value));
      assert.equal(idNumber.supportClaimed, false);
    }
    const short = await blank.api.fillField('身高', HEIGHT_SAMPLE);
    const shortId = await blank.api.fillField('证件号', ID_SAMPLE);
    assert.equal(short.reason, 'label_not_allowed');
    assert.equal(shortId.reason, 'label_not_allowed');
    assert.equal(blank.stats.focus, 0);
    assert.equal(blank.stats.textInput, 0);
    assert.equal(blank.stats.open, 0);
    assert.equal(blank.stats.forbidden, 0);
    assert.equal(blank.document.getElementById('height-input').value, '');
    assert.equal(blank.document.getElementById('idNumber-input').value, '');
    unchanged(blank.document, blank.stats);
  } finally { blank.dom.window.close(); }
});

test('a different existing value is kept and nothing is opened or painted', async () => {
  const h = await boot({ name: '已有姓名', gender: '女', nation: '中国', marriage: '未婚' });
  try {
    const name = await h.api.fillField(TEXT.name.label, '合成姓名');
    const gender = await h.api.fillField(probe.gender.label, '男');
    const nation = await h.api.fillField(SELECTS.nation.label, '中国香港');
    const marriage = await h.api.fillField(SELECTS.marriage.label, '已婚');
    assert.equal(name.reason, 'existing_value');
    assert.equal(name.status, 'skipped');
    assert.equal(name.ok, false);
    assert.equal(gender.reason, 'existing_value');
    assert.equal(gender.ok, false);
    assert.equal(nation.reason, 'existing_value');
    assert.equal(marriage.reason, 'existing_value');
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.option, 0);
    assert.equal(h.stats.radio, 0);
    assert.equal(h.stats.textInput, 0);
    assert.equal(h.document.getElementById('name-input').value, '已有姓名');
    assert.equal(h.document.getElementById('nation-value').textContent, '中国');
    assert.equal(h.document.querySelectorAll('input[name="pb-gender"]')[1].checked, true);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('empty values, short labels, internal gender codes, and out-of-scope labels fail closed', async () => {
  const h = await boot({});
  try {
    for (const value of ['', '   ', null, 1]) {
      const row = await h.api.fillField(TEXT.name.label, value);
      assert.equal(row.reason, 'missing_profile_value', String(value));
      assert.equal(row.ok, false);
    }
    const shortPhone = await h.api.fillField('移动电话', '13800138000');
    assert.equal(shortPhone.reason, 'label_not_allowed');
    const code = await h.api.fillField(probe.gender.label, '599');
    const triple = await h.api.fillField(probe.gender.label, probe.gender.valueSample);
    assert.equal(code.reason, 'option_not_found');
    assert.equal(triple.reason, 'option_not_found');
    assert.equal(h.stats.radio, 0);
    for (const label of [
      probe.neighbors.residence.label,
      '籍贯',
      probe.neighbors.interview.label,
      probe.neighbors.photo.label,
      probe.neighbors.portrait.label,
      probe.neighbors.birth.label,
      probe.neighbors.address.label,
      probe.neighbors.note.label,
      '身高',
      '证件号',
      probe.neighbors.obey.label,
      '意向一：期望工作地点'
    ]) {
      const row = await h.api.fillField(label, '上海市');
      assert.equal(row.reason, 'label_not_allowed', label);
    }
    const none = await h.api.fillFields(null);
    assert.equal(none.ok, false);
    assert.equal(none.fields.every((field) => field.reason === 'missing_profile_value'), true);
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.textInput, 0);
    assert.equal(h.stats.option, 0);
    assert.equal(h.document.getElementById('name-input').value, '');
    assert.equal(h.document.getElementById('phone-input').value, '');
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('Escape closes a flat select and does not change the value; text and radio do not click', async () => {
  const h = await boot({ nation: '', marriage: '未婚' });
  try {
    const canceled = await h.api.cancelField(SELECTS.nation.label);
    assert.equal(canceled.ok, true, JSON.stringify(canceled));
    assert.equal(canceled.reason, 'menu_closed');
    assert.equal(canceled.canceled, true);
    assert.equal(canceled.stillOpen, 0);
    assert.equal(canceled.before, '');
    assert.equal(canceled.after, '');
    assert.equal(canceled.liveSupportClaimed, false);
    assert.equal(h.stats.open, 1);
    assert.equal(h.stats.option, 0);
    assert.ok(h.stats.escape >= 1);
    assert.equal(h.document.getElementById('select-menu').hidden, true);
    assert.equal(h.document.querySelectorAll('.ant-select-open').length, 0);
    const text = await h.api.cancelField(TEXT.name.label);
    const radio = await h.api.cancelField(probe.gender.label);
    const height = await h.api.cancelField(HEIGHT);
    const idNumber = await h.api.cancelField(ID_NUMBER);
    assert.equal(text.reason, 'cancel_not_applicable');
    assert.equal(radio.reason, 'cancel_not_applicable');
    assert.equal(height.reason, 'cancel_not_applicable');
    assert.equal(height.opened, false);
    assert.equal(height.liveSupportClaimed, false);
    assert.equal(idNumber.reason, 'cancel_not_applicable');
    assert.equal(idNumber.supportClaimed, false);
    assert.equal(h.stats.radio, 0);
    assert.equal(h.stats.textInput, 0);
    assert.equal(h.document.getElementById('marriage-value').textContent, '未婚');
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a menu that ignores Escape fails closed and does not keep a painted value', async () => {
  const h = await boot({ ignoreEscape: true });
  try {
    const canceled = await h.api.cancelField(SELECTS.ethnic.label);
    assert.equal(canceled.ok, false);
    assert.equal(canceled.reason, 'menu_cleanup_failed');
    assert.equal(canceled.stillOpen, 1);
    assert.equal(canceled.after, '');
    assert.equal(h.stats.option, 0);
    const missing = await h.api.fillField(SELECTS.marriage.label, '已婚');
    assert.equal(missing.ok, false);
    assert.equal(missing.reason, 'control_busy');
    assert.equal(h.document.getElementById('marriage-value').textContent, '');
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('missing and duplicate options fail closed before a write', async () => {
  const missing = await boot({});
  try {
    const gender = await missing.api.fillField(probe.gender.label, '其他');
    assert.equal(gender.reason, 'option_not_found');
    assert.equal(gender.opened, false);
    assert.equal(missing.stats.radio, 0);
    const nation = await missing.api.fillField(SELECTS.nation.label, '护照');
    assert.equal(nation.reason, 'option_not_found', JSON.stringify(nation));
    assert.equal(nation.after, '');
    assert.equal(nation.stillOpen, 0);
    assert.ok(missing.stats.escape >= 1);
    assert.equal(missing.stats.option, 0);
    const idType = await missing.api.fillField(SELECTS.idType.label, '护照');
    assert.equal(idType.reason, 'option_not_found');
    assert.equal(missing.document.getElementById('idType-value').textContent, '');
    unchanged(missing.document, missing.stats);
  } finally { missing.dom.window.close(); }

  const ambiguous = await boot({ duplicateOption: '已婚' });
  try {
    const row = await ambiguous.api.fillField(SELECTS.marriage.label, '已婚');
    assert.equal(row.reason, 'ambiguous_option');
    assert.equal(row.after, '');
    assert.equal(ambiguous.stats.option, 0);
    assert.equal(ambiguous.document.getElementById('select-menu').hidden, true);
  } finally { ambiguous.dom.window.close(); }
});

test('missing, duplicate, and drifted controls fail closed', async () => {
  const cases = [
    [{ dropAntInput: true }, TEXT.name.label, '合成姓名'],
    [{ readonlyName: true }, TEXT.name.label, '合成姓名'],
    [{ calendarOnName: true }, TEXT.name.label, '合成姓名'],
    [{ extraTextInput: true }, TEXT.name.label, '合成姓名'],
    [{ hiddenName: true }, TEXT.name.label, '合成姓名'],
    [{ typeNumber: true }, TEXT.name.label, '合成姓名'],
    [{ dropAntRow: true }, TEXT.name.label, '合成姓名'],
    [{ duplicateName: true }, TEXT.name.label, '合成姓名'],
    [{ genderBare: true }, probe.gender.label, '男'],
    [{ genderOne: true }, probe.gender.label, '男'],
    [{ genderCheckbox: true }, probe.gender.label, '男'],
    [{ genderDisabled: true }, probe.gender.label, '男'],
    [{ dropRadioClass: true }, probe.gender.label, '男'],
    [{ duplicateGenderText: true }, probe.gender.label, '男'],
    [{ dropSearch: true }, SELECTS.nation.label, '中国'],
    [{ closedSearchBare: true }, SELECTS.nation.label, '中国'],
    [{ ambiguousValue: true }, SELECTS.nation.label, '中国'],
    [{ dropAllowClear: true }, SELECTS.nation.label, '中国香港'],
    [{ extraSelect: true }, SELECTS.nation.label, '中国'],
    [{ badDropdown: true }, SELECTS.marriage.label, '已婚'],
    [{ emptyMenu: true }, SELECTS.marriage.label, '已婚'],
    [{ busy: true }, SELECTS.marriage.label, '已婚'],
    [{ dropRoot: true }, TEXT.name.label, '合成姓名'],
    [{ elForm: true }, TEXT.name.label, '合成姓名'],
    [{ url: 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/mc/deliver/operationResumer' }, TEXT.name.label, '合成姓名'],
    [{ url: 'https://gszq.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html' }, PHONE, '13800138000'],
    [{ textDriftKey: 'height', dropAntInput: true }, HEIGHT, HEIGHT_SAMPLE],
    [{ textDriftKey: 'height', readonlyName: true }, HEIGHT, HEIGHT_SAMPLE],
    [{ textDriftKey: 'height', calendarOnName: true }, HEIGHT, HEIGHT_SAMPLE],
    [{ textDriftKey: 'height', extraTextInput: true }, HEIGHT, HEIGHT_SAMPLE],
    [{ textDriftKey: 'height', hiddenName: true }, HEIGHT, HEIGHT_SAMPLE],
    [{ textDriftKey: 'height', typeNumber: true }, HEIGHT, HEIGHT_SAMPLE],
    [{ textDriftKey: 'height', dropAntRow: true }, HEIGHT, HEIGHT_SAMPLE],
    [{ textDriftKey: 'height', placeholderOverride: '请填写身高' }, HEIGHT, HEIGHT_SAMPLE],
    [{ textDriftKey: 'height', placeholderOverride: '' }, HEIGHT, HEIGHT_SAMPLE],
    [{ duplicateKey: 'height' }, HEIGHT, HEIGHT_SAMPLE],
    [{ textDriftKey: 'idNumber', dropAntInput: true }, ID_NUMBER, ID_SAMPLE],
    [{ textDriftKey: 'idNumber', readonlyName: true }, ID_NUMBER, ID_SAMPLE],
    [{ textDriftKey: 'idNumber', extraTextInput: true }, ID_NUMBER, ID_SAMPLE],
    [{ textDriftKey: 'idNumber', hiddenName: true }, ID_NUMBER, ID_SAMPLE],
    [{ textDriftKey: 'idNumber', typeNumber: true }, ID_NUMBER, ID_SAMPLE],
    [{ textDriftKey: 'idNumber', placeholderOverride: '请输入证件号' }, ID_NUMBER, ID_SAMPLE],
    [{ textDriftKey: 'idNumber', placeholderOverride: '' }, ID_NUMBER, ID_SAMPLE],
    [{ duplicateKey: 'idNumber' }, ID_NUMBER, ID_SAMPLE]
  ];
  for (const [state, label, value] of cases) {
    const h = await boot(state);
    try {
      const row = await h.api.fillField(label, value);
      assert.notEqual(row.reason, 'readback_matched', JSON.stringify(state));
      assert.equal(row.ok, false, JSON.stringify({ state, row }));
      assert.ok(['control_not_supported', 'control_busy', 'wrong_page'].includes(row.reason), JSON.stringify({ state, row }));
      assert.equal(row.liveSupportClaimed, false);
      assert.equal(h.stats.option, 0, JSON.stringify(state));
      assert.equal(h.stats.forbidden, 0, JSON.stringify(state));
      assert.equal(h.stats.file, 0, JSON.stringify(state));
      if (!state.dropRoot && !state.elForm && !state.url && !state.duplicateName && label === TEXT.name.label) {
        assert.equal(h.document.getElementById('name-input')?.value ?? '', '');
      }
      if (!state.url && (label === HEIGHT || label === ID_NUMBER)) {
        const id = label === HEIGHT ? 'height-input' : 'idNumber-input';
        assert.equal(h.document.getElementById(id)?.value ?? '', '');
        assert.equal(h.stats.textInput, 0, JSON.stringify(state));
        assert.equal(h.stats.focus, 0, JSON.stringify(state));
        assert.equal(h.stats.forbidden, 0, JSON.stringify(state));
      }
    } finally { h.dom.window.close(); }
  }
});

test('closed flat selects with a placeholder mash match the selected value and do not open', async () => {
  const samples = Object.fromEntries(probe.select.fields.map((field) => [field.key, field.valueSample]));
  const text = await boot({
    closedSearch: true,
    placeholderMash: 'text',
    ...samples
  });
  try {
    const view = text.api.inspect();
    assert.equal(view.liveSupportClaimed, false);
    assert.equal(view.supportClaimed, false);
    assert.equal(view.neverSave, true);
    for (const field of probe.select.fields) {
      const row = view.fields.find((item) => item.label === field.label);
      assert.equal(row.reason, 'structure_matched', field.label);
      assert.equal(row.supported, false, field.label);
      assert.equal(row.value, field.valueSample, field.label);
      const filled = await text.api.fillField(field.label, ` ${field.valueSample} `);
      assert.equal(filled.reason, 'preexisting_same_value', JSON.stringify(filled));
      assert.equal(filled.before, field.valueSample);
      assert.equal(filled.opened, false);
      assert.equal(filled.saved, false);
      assert.equal(filled.liveSupportClaimed, false);
    }
    assert.equal(text.stats.open, 0);
    assert.equal(text.stats.option, 0);
    assert.equal(text.stats.faceClass, '');
    assert.equal(text.document.getElementById('nation-value').textContent, `${probe.select.liveReadback.placeholderPrefix}${SELECTS.nation.label}中国`);
    unchanged(text.document, text.stats);
  } finally { text.dom.window.close(); }

  const classes = await boot({
    closedSearch: true,
    placeholderMash: 'class',
    ...samples
  });
  try {
    for (const field of probe.select.fields) {
      const filled = await classes.api.fillField(field.label, field.valueSample);
      assert.equal(filled.reason, 'preexisting_same_value', JSON.stringify(filled));
      assert.equal(filled.before, field.valueSample);
      assert.equal(filled.opened, false);
    }
    assert.equal(classes.stats.open, 0);
    const nation = classes.document.querySelector('#nation-select .ant-select-selection-selected-value');
    const prompt = classes.document.querySelector('#nation-select .ant-select-selection__placeholder');
    assert.equal(nation.textContent, '中国');
    assert.equal(prompt.textContent, `${probe.select.liveReadback.placeholderPrefix}${SELECTS.nation.label}`);
    unchanged(classes.document, classes.stats);
  } finally { classes.dom.window.close(); }
});

test('an empty closed flat select opens from the visible face and reads the selected value', async () => {
  const h = await boot({ closedSearch: true, placeholderMash: 'class' });
  try {
    const marriage = await h.api.fillField(SELECTS.marriage.label, '已婚');
    assert.equal(marriage.ok, true, JSON.stringify(marriage));
    assert.equal(marriage.reason, 'readback_matched');
    assert.equal(marriage.after, '已婚');
    assert.equal(marriage.before, '');
    assert.equal(marriage.opened, true);
    assert.equal(marriage.stillOpen, 0);
    assert.equal(marriage.liveSupportClaimed, false);
    assert.equal(marriage.saved, false);
    assert.equal(marriage.neverSave, true);
    assert.equal(h.stats.open, 1);
    assert.equal(h.stats.option, 1);
    assert.equal(h.stats.triggerClass, '');
    assert.equal(h.stats.faceClass, probe.select.liveReadback.faceClass);
    assert.equal(h.document.querySelector('#marriage-select .ant-select-selection-selected-value').textContent, '已婚');
    assert.equal(h.document.querySelector('#marriage-select .ant-select-selection__placeholder').textContent, `${probe.select.liveReadback.placeholderPrefix}${SELECTS.marriage.label}`);
    assert.equal(h.document.getElementById('select-menu').hidden, true);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a hidden page fails closed before a click or write', async () => {
  const h = await boot({});
  try {
    Object.defineProperty(h.document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    const row = await h.api.fillField(TEXT.name.label, '合成姓名');
    const select = await h.api.fillField(SELECTS.politics.label, '群众');
    assert.equal(row.reason, 'fill_interrupted_page_hidden');
    assert.equal(select.reason, 'fill_interrupted_page_hidden');
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.textInput, 0);
    assert.equal(h.stats.focus, 0);
    assert.equal(row.liveSupportClaimed, false);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});
