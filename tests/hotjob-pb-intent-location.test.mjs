// Offline Never-Save trials for hotjob pb 意向一/意向二 期望工作地点 and
// 期望工作地是否服从分配. Markup is built from
// tests/fixtures/hotjob-pb-intent-location-probe-dom.json (2026-10-23 probe
// classes, labels, and the captured display tokens only). A green run is not
// a live support claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../src/content/hotjob-pb-intent-location.js', import.meta.url), 'utf8');
const basicSource = readFileSync(new URL('../src/content/hotjob-pb-basic.js', import.meta.url), 'utf8');
const regionSource = readFileSync(new URL('../src/content/hotjob-pb-region.js', import.meta.url), 'utf8');
const eduSource = readFileSync(new URL('../src/content/hotjob-pb-edu-intent.js', import.meta.url), 'utf8');
const workSource = readFileSync(new URL('../src/content/hotjob-pb-work.js', import.meta.url), 'utf8');
const certsSource = readFileSync(new URL('../src/content/hotjob-pb-certs.js', import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../manifest.json', import.meta.url), 'utf8');
const engine = readFileSync(new URL('../src/content/engine.js', import.meta.url), 'utf8');
const popup = readFileSync(new URL('../src/popup/popup.js', import.meta.url), 'utf8');
const cmsBasic = readFileSync(new URL('../src/background/cms-basic-auto.mjs', import.meta.url), 'utf8');
const cmsEdu = readFileSync(new URL('../src/background/cms-education-task-runner.mjs', import.meta.url), 'utf8');
const probe = JSON.parse(readFileSync(new URL('../tests/fixtures/hotjob-pb-intent-location-probe-dom.json', import.meta.url), 'utf8'));

const PAGE = `https://${probe.page.hostname}${probe.page.samplePath}`;
const FIRST = probe.cascader.labels[0];
const SECOND = probe.cascader.labels[1];
const OBEY = probe.radio.label;
const CITY = probe.cascader.valueSample;
const YES = probe.radio.options[0];
const NO = probe.radio.options[1];
const FORBIDDEN = probe.page.forbiddenButtons;
const LIVE = probe.cascader.livePair;

function esc(value) {
  return String(value).replace(/[&<>"]/gu, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function classes(value) {
  return String(value).split(/\s+/u).filter(Boolean);
}

function menu(id, state) {
  if (state.saveOption && id === 'first') {
    return `<ul hidden><li><button type="button">${esc(FORBIDDEN[0])}</button></li></ul>`;
  }
  if (state.emptyMenu && id === 'first') return '<ul hidden></ul>';
  const rows = [...probe.cascader.optionsSample];
  if (state.duplicateOption && id === 'first') rows.push(CITY);
  return `<ul hidden>${rows.map((text) => `<li>${esc(text)}</li>`).join('')}</ul>`;
}

function cascaderBody(id, label, value, state) {
  if (state.ambiguousValue && id === 'first') {
    return `<span class="${esc(LIVE.selectedValueClass)}">${esc(LIVE.sameDisplay)}</span><span class="${esc(LIVE.selectedValueClass)}">${esc(probe.neighbors.residence.token)}</span>`;
  }
  if (state.placeholderOnly && id === 'first') {
    return `<span id="${id}-value">${esc(LIVE.placeholderPrefix + label)}</span>`;
  }
  if (state.cascaderMash && (id === 'first' || id === 'second')) {
    return `<span class="${esc(LIVE.placeholderClass)}">${esc(LIVE.placeholderPrefix + label)}</span><span class="${esc(LIVE.selectedValueClass)}" id="${id}-value">${esc(value)}</span>`;
  }
  if (state.textMash && (id === 'first' || id === 'second')) {
    return `<span id="${id}-value">${esc(`${LIVE.placeholderPrefix}${label}${value}`)}</span>`;
  }
  return `<span id="${id}-value">${esc(value)}</span>`;
}

function twinMarkup(id, label, value, state) {
  const text = state.twinDrift && id === 'first' ? probe.neighbors.residence.token : value;
  const className = [
    probe.cascader.controlClass,
    state.twinDisabled && id === 'first' ? 'ant-select-disabled' : '',
    state.twinAllowClear && id === 'first' ? 'ant-select-allow-clear' : ''
  ].filter(Boolean).join(' ');
  const hidden = state.twinHidden && id === 'first' ? ' hidden' : '';
  const body = state.cascaderMash
    ? `<span class="${esc(LIVE.placeholderClass)}">${esc(LIVE.placeholderPrefix + label)}</span><span class="${esc(LIVE.selectedValueClass)}">${esc(text)}</span>`
    : `<span>${esc(text)}</span>`;
  return `<div class="${esc(className)}" id="${id}-twin"${hidden}>${body}</div>`;
}

function cascaderField(label, value, state, id) {
  const itemClass = state.dropAntRow && id === 'first' ? 'ant-form-item' : probe.page.itemClass;
  const wrapClass = state.dropWrap && id === 'first' ? '' : probe.cascader.menuClass;
  const selectClass = [
    state.dropEnabled && id === 'first' ? 'ant-select' : probe.cascader.controlClass,
    state.allowClearOnCascader && id === 'first' ? 'ant-select-allow-clear' : '',
    state.selectDisabled && id === 'first' ? 'ant-select-disabled' : ''
  ].filter(Boolean).join(' ');
  const hidden = state.hiddenSelect && id === 'first' ? ' hidden' : '';
  const paired = ((id === 'first' || id === 'second') && state.twinSelect)
    || (id === 'first' && (state.twinDrift || state.twinDisabled || state.twinAllowClear || state.twinHidden));
  const outside = [
    state.outsideSelect && id === 'first'
      ? `<div class="${esc(probe.cascader.controlClass)}" id="outside-select"><span>${esc(LIVE.sameDisplay)}</span></div>` : '',
    state.twoWraps && id === 'first'
      ? `<span class="${esc(probe.cascader.menuClass)}"><div class="${esc(probe.cascader.controlClass)}"><span>${esc(CITY)}</span></div></span>` : '',
    state.strayRadio && id === 'first'
      ? `<input class="${esc(probe.radio.controlClass)}" type="${esc(probe.radio.inputType)}">` : '',
    state.strayText && id === 'first'
      ? `<input class="${esc(probe.stray.textClass)}" type="text" value="">` : ''
  ].join('');
  const inside = [
    paired ? twinMarkup(id, label, value, state) : '',
    state.tripleSelect && id === 'first'
      ? `<div class="${esc(probe.cascader.controlClass)}"><span>${esc(LIVE.sameDisplay)}</span></div><div class="${esc(probe.cascader.controlClass)}"><span>${esc(LIVE.sameDisplay)}</span></div>` : ''
  ].join('');
  const same = state.sameCaption && id === 'first' ? `<label>${esc(label)}*</label>` : '';
  const disagree = state.disagreeCaption && id === 'first' ? `<label>${esc(probe.neighbors.origin.label)}*</label>` : '';
  return `<div class="${esc(itemClass)}" data-field="${id}"><label>${esc(label)}*</label>${same}${disagree}<span class="${esc(probe.page.childrenClass)}">${outside}<span class="${esc(wrapClass)}"><div class="${esc(selectClass)}" id="${id}-select"${hidden}>${cascaderBody(id, label, value, state)}</div>${inside}${menu(id, state)}</span></span></div>`;
}

function radioGroup(id, label, options, name, checked, state, scope) {
  const apply = scope === 'obey';
  const bare = apply && state.obeyBare;
  const control = apply && state.dropRadioClass ? 'plain-radio' : (scope === 'gender' ? probe.neighbors.gender.controlClass : probe.radio.controlClass);
  const type = apply && state.obeyCheckbox ? 'checkbox' : probe.radio.inputType;
  let rows = options.map((text) => {
    const mark = checked === text ? ' checked' : '';
    const disabled = apply && state.obeyDisabled ? ' disabled' : '';
    const hidden = apply && state.obeyHidden ? ' hidden' : '';
    return `<label><span><input class="${esc(control)}" type="${type}" name="${name}"${mark}${disabled}${hidden}></span><span>${esc(text)}</span></label>`;
  });
  if (apply && state.obeyOne) rows = rows.slice(0, 1);
  if (apply && state.duplicateObeyText) {
    rows = [
      `<label><span><input class="${esc(probe.radio.controlClass)}" type="radio" name="${name}"></span><span>${esc(options[0])}</span></label>`,
      `<label><span><input class="${esc(probe.radio.controlClass)}" type="radio" name="${name}"></span><span>${esc(options[0])}</span></label>`
    ];
  }
  const body = bare
    ? options.map(() => `<input class="${esc(probe.radio.controlClass)}" type="radio" name="${name}">`).join('') + options.join('')
    : rows.join('');
  const extra = apply && state.extraObeyLabel ? `<label>${esc(probe.neighbors.origin.label)}</label>` : '';
  const stray = apply && state.strayOnRadio ? `<input class="${esc(probe.stray.textClass)}" type="text" value="KEEP">` : '';
  const itemClass = probe.page.itemClass;
  return `<div class="${esc(itemClass)}" data-field="${id}"><label>${esc(label)}*</label><span class="${esc(probe.page.childrenClass)}">${body}${stray}</span>${extra}</div>`;
}

function tokenRow(key, label, token) {
  return `<div class="${esc(probe.page.itemClass)}" data-field="${key}"><label>${esc(label)}*</label><span id="${key}-token">${esc(token)}</span></div>`;
}

function html(state) {
  const rootClass = state.dropRoot ? 'page-root' : probe.page.rootClass;
  const shell = state.elForm ? '<div class="el-form"></div>' : '';
  const neighbor = probe.neighbors;
  const duplicate = state.duplicateFirst
    ? cascaderField(FIRST, CITY, {}, 'first-copy') : '';
  const buttons = [...probe.page.buttonLabels, ...FORBIDDEN.filter((label) => !probe.page.buttonLabels.includes(label))]
    .map((label) => `<button type="button">${esc(label)}</button>`).join('');
  return `<!doctype html><body>${shell}<div class="${esc(rootClass)}"><div class="${esc(probe.page.contentClass)}">${
    radioGroup('gender', neighbor.gender.label, neighbor.gender.options, 'pb-gender', '', state, 'gender')
  }${cascaderField(neighbor.residence.label, neighbor.residence.token, {}, 'residence')
  }${tokenRow('origin', neighbor.origin.label, neighbor.origin.token)
  }${tokenRow('interview', neighbor.interview.label, neighbor.interview.token)
  }${tokenRow('nature', neighbor.nature.label, neighbor.nature.token)
  }${cascaderField(FIRST, state.first ?? '', state, 'first')
  }${cascaderField(SECOND, state.second ?? '', state, 'second')
  }${radioGroup('obey', OBEY, probe.radio.options, 'pb-obey', state.obey ?? '', state, 'obey')
  }<div class="${esc(neighbor.photo.itemClass)}"><label>${esc(neighbor.photo.label)}*</label><input id="photo" type="file"></div><div class="${esc(probe.page.itemClass)}"><label>${esc(neighbor.research.label)}*</label><input id="research" class="${esc(neighbor.research.controlClass)}" type="${esc(neighbor.research.inputType)}"></div>${duplicate}${buttons}</div></div></body>`;
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
  for (const menu of document.querySelectorAll('.cascader-plugins-wrap ul')) hide(menu, true);
}

function wire(document, state) {
  const stats = { open: 0, option: 0, escape: 0, forbidden: 0, file: 0, radio: 0, checkbox: 0, openClass: '' };
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (button && FORBIDDEN.includes((button.textContent || '').replace(/\s+/gu, ''))) stats.forbidden += 1;
    if (event.target.matches?.('input[type="file"]')) stats.file += 1;
    const radio = event.target.closest?.('input.ant-radio-input, input.plain-radio');
    if (radio && radio.type === 'radio') stats.radio += 1;
    if (event.target.matches?.('input.ant-checkbox-input')) stats.checkbox += 1;
  }, true);
  for (const select of document.querySelectorAll('.ant-select')) {
    const wrap = select.closest('.cascader-plugins-wrap');
    const menu = wrap?.querySelector('ul') || null;
    select.addEventListener('click', (event) => {
      if (menu && menu.contains(event.target)) return;
      stats.open += 1;
      select.classList.add(...classes(probe.cascader.openClass));
      stats.openClass = select.className;
      if (menu) hide(menu, false);
    });
  }
  for (const menu of document.querySelectorAll('.cascader-plugins-wrap ul')) {
    menu.addEventListener('click', (event) => {
      const li = event.target.closest('li');
      if (!li || !menu.contains(li)) return;
      stats.option += 1;
      const wrap = menu.closest('.cascader-plugins-wrap');
      const select = wrap?.querySelector('.ant-select.ant-select-open') || wrap?.querySelector('.ant-select');
      const slot = select?.querySelector('.ant-select-selection-selected-value, [id$="-value"]') || select?.querySelector('span');
      if (slot) slot.textContent = li.textContent.trim();
      closeWidgets(document);
    });
  }
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    stats.escape += 1;
    if (state.ignoreEscape) return;
    closeWidgets(document);
  });
  if (state.busy) {
    const select = document.getElementById('first-select');
    select.classList.add('ant-select-open', 'ant-select-focused');
    const menu = select.closest('.cascader-plugins-wrap')?.querySelector('ul');
    hide(menu, false);
  }
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
  return { dom, window, document, stats, api: window.ResumeHotjobPbIntentLocation };
}

function textOf(document, id) {
  return document.getElementById(id)?.textContent ?? '';
}

function unchanged(document, stats) {
  const neighbor = probe.neighbors;
  assert.equal(textOf(document, 'residence-value'), neighbor.residence.token);
  assert.equal(textOf(document, 'origin-token'), neighbor.origin.token);
  assert.equal(textOf(document, 'interview-token'), neighbor.interview.token);
  assert.equal(textOf(document, 'nature-token'), neighbor.nature.token);
  assert.equal([...document.querySelectorAll('input[name="pb-gender"]')].some((node) => node.checked), false);
  assert.equal(document.getElementById('photo').files.length, 0);
  assert.equal(document.getElementById('research').checked, false);
  assert.equal(stats.forbidden, 0);
  assert.equal(stats.file, 0);
  assert.equal(stats.checkbox, 0);
}

test('source stays on the probed pb classes and does not claim support', () => {
  assert.match(source, /ResumeHotjobPbIntentLocation/);
  assert.match(source, /liveSupportClaimed:\s*false/);
  assert.match(source, /supportClaimed:\s*false/);
  assert.match(source, /neverSave:\s*true/);
  assert.doesNotMatch(source, /liveSupportClaimed:\s*true/);
  assert.doesNotMatch(source, /supportClaimed:\s*true/);
  assert.doesNotMatch(source, /已支持/);
  assert.doesNotMatch(source, /hotjob-mc-basic|ResumeHotjobMc|ResumeHotjobPbBasic|ResumeHotjobPbRegion|ResumeHotjobPbWork|ResumeHotjobPbEdu|ResumeHotjobPbCerts|mc\/deliver|cms-region|engine\.js/);
  assert.doesNotMatch(source, /textContent\s*=/);
  assert.doesNotMatch(source, /\.value\s*=[^=]/);
  assert.doesNotMatch(source, /\.checked\s*=/);
  assert.doesNotMatch(source, /innerHTML/);
  assert.doesNotMatch(source, /\bexport\s/);
  assert.doesNotMatch(source, /ant-cascader-menus|form-cell|ant-select-selection--single|ant-radio-wrapper|ant-select-dropdown-menu-item/);
  assert.doesNotMatch(source, /66008|66009/);
  assert.doesNotMatch(source, /北京/);
  assert.doesNotMatch(source, /1\d{10}/);
  assert.match(source, /保存\|提交\|投递\|删除\|下一步\|返回\|确定/);
  assert.equal(manifest.includes('hotjob-pb-intent-location'), false);
  assert.equal(engine.includes('hotjob-pb-intent-location'), false);
  assert.equal(basicSource.includes('hotjob-pb-intent-location'), false);
  assert.equal(regionSource.includes('hotjob-pb-intent-location'), false);
  assert.equal(eduSource.includes('hotjob-pb-intent-location'), false);
  assert.equal(workSource.includes('hotjob-pb-intent-location'), false);
  assert.equal(certsSource.includes('hotjob-pb-intent-location'), false);
  assert.equal(popup.includes('hotjob-pb-intent-location'), false);
  assert.equal(cmsBasic.includes('hotjob-pb-intent-location'), false);
  assert.equal(cmsEdu.includes('hotjob-pb-intent-location'), false);
  for (const token of [
    ...classes(probe.page.itemClass),
    ...classes(probe.cascader.controlClass),
    ...classes(probe.cascader.openClass),
    probe.cascader.menuClass,
    probe.radio.controlClass,
    probe.page.rootClass,
    LIVE.selectedValueClass,
    LIVE.placeholderClass,
    LIVE.placeholderPrefix,
    'ant-select-search__field',
    'ant-select-allow-clear',
    'ant-select-disabled',
    probe.stray.calendarClass,
    FIRST,
    SECOND,
    OBEY
  ]) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  }
});

test('fixture html uses only the probe class list, labels, and display tokens', () => {
  const built = html({ twinSelect: true, first: CITY, second: CITY, obey: YES });
  for (const token of [
    probe.page.rootClass, probe.page.contentClass, probe.page.childrenClass,
    ...classes(probe.page.itemClass), ...classes(probe.cascader.controlClass),
    probe.cascader.menuClass, probe.radio.controlClass, probe.neighbors.photo.itemClass,
    probe.neighbors.research.controlClass, probe.neighbors.gender.controlClass
  ]) assert.match(built, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  for (const label of [...probe.cascader.labels, OBEY, probe.neighbors.residence.label]) {
    assert.match(built, new RegExp(`>${label.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\*`));
  }
  for (const option of probe.radio.options) assert.match(built, new RegExp(`>${option}<`));
  for (const option of probe.cascader.optionsSample) assert.match(built, new RegExp(`>${option}<`));
  for (const label of probe.page.buttonLabels) assert.match(built, new RegExp(`>${label}<`));
  assert.doesNotMatch(built, /ant-radio-wrapper|ant-select-selection--single|ant-cascader-menus|ant-select-dropdown-menu-item|form-cell/);
  assert.doesNotMatch(built, /66008|66009/);
  assert.doesNotMatch(JSON.stringify(probe), /1\d{10}/);
});

test('inspect matches the three probed fields and does not claim support', async () => {
  const h = await boot({ twinSelect: true, first: CITY, second: CITY, obey: YES });
  try {
    const view = h.api.inspect();
    assert.equal(h.api.liveSupportClaimed, false);
    assert.equal(h.api.supportClaimed, false);
    assert.equal(h.api.neverSave, true);
    assert.equal(h.window.ResumeHotjobPbBasic, undefined);
    assert.equal(h.window.ResumeHotjobPbRegion, undefined);
    assert.equal(h.window.ResumeHotjobPbEduIntent, undefined);
    assert.equal(view.liveSupportClaimed, false);
    assert.equal(view.supportClaimed, false);
    assert.equal(view.neverSave, true);
    assert.equal(view.complete, false);
    assert.equal(view.saved, false);
    assert.equal(view.skippedSave, true);
    assert.equal(view.softwareClickedSave, false);
    assert.equal(view.fields.length, 3);
    assert.equal(view.fields.every((field) => field.supported === false), true);
    assert.equal(view.fields.every((field) => field.reason === 'structure_matched'), true);
    assert.deepEqual(Array.from(view.fields, (field) => field.label), [FIRST, SECOND, OBEY]);
    assert.deepEqual(Array.from(view.fields, (field) => field.kind), ['cascader', 'cascader', 'radio']);
    assert.equal(view.fields[0].value, CITY);
    assert.equal(view.fields[1].value, CITY);
    assert.equal(view.fields[2].value, YES);
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.radio, 0);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('empty cascader and radio read back the captured display token', async () => {
  const h = await boot({});
  try {
    const first = await h.api.fillField(FIRST, ` ${CITY} `);
    const second = await h.api.fillField(SECOND, CITY);
    const obey = await h.api.fillField(OBEY, ` ${YES} `);
    assert.equal(first.ok, true, JSON.stringify(first));
    assert.equal(first.status, 'verified');
    assert.equal(first.reason, 'readback_matched');
    assert.equal(first.after, CITY);
    assert.equal(first.before, '');
    assert.equal(first.opened, true);
    assert.equal(first.stillOpen, 0);
    assert.equal(first.liveSupportClaimed, false);
    assert.equal(first.supportClaimed, false);
    assert.equal(first.complete, false);
    assert.equal(first.saved, false);
    assert.equal(first.skippedSave, true);
    assert.equal(second.reason, 'readback_matched');
    assert.equal(second.after, CITY);
    assert.equal(second.stillOpen, 0);
    assert.equal(obey.reason, 'readback_matched');
    assert.equal(obey.after, YES);
    assert.equal(obey.opened, false);
    assert.equal(obey.supportClaimed, false);
    assert.match(h.stats.openClass, /ant-select-open/);
    assert.match(h.stats.openClass, /ant-select-focused/);
    assert.match(h.stats.openClass, /ant-select-enabled/);
    assert.equal(textOf(h.document, 'first-value'), CITY);
    assert.equal(textOf(h.document, 'second-value'), CITY);
    assert.equal(h.document.querySelector('input[name="pb-obey"]').checked, true);
    assert.equal(h.document.querySelectorAll('.ant-select-open').length, 0);
    assert.equal(h.stats.open, 2);
    assert.equal(h.stats.option, 2);
    assert.equal(h.stats.radio, 1);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('fillFields reads back all three and leaves neighbors untouched', async () => {
  const h = await boot({});
  try {
    const filled = await h.api.fillFields({ [FIRST]: CITY, [SECOND]: CITY, [OBEY]: NO });
    assert.equal(filled.ok, true, JSON.stringify(filled.fields));
    assert.equal(filled.liveSupportClaimed, false);
    assert.equal(filled.supportClaimed, false);
    assert.equal(filled.neverSave, true);
    assert.equal(filled.complete, false);
    assert.equal(filled.saved, false);
    assert.equal(filled.fields.map((field) => field.reason).join(','), 'readback_matched,readback_matched,readback_matched');
    assert.equal(filled.fields[2].after, NO);
    assert.equal(h.document.querySelectorAll('input[name="pb-obey"]')[1].checked, true);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('preexisting 北京 and a checked radio verify without opening or clicking', async () => {
  const h = await boot({ twinSelect: true, first: CITY, second: CITY, obey: YES });
  try {
    const filled = await h.api.fillFields({ [FIRST]: CITY, [SECOND]: ` ${CITY} `, [OBEY]: YES });
    assert.equal(filled.ok, true, JSON.stringify(filled.fields));
    assert.equal(filled.fields.every((field) => field.reason === 'preexisting_same_value'), true);
    assert.equal(filled.fields.every((field) => field.opened === false), true);
    assert.equal(filled.fields.every((field) => field.status === 'verified'), true);
    assert.equal(filled.liveSupportClaimed, false);
    assert.equal(filled.supportClaimed, false);
    assert.equal(filled.saved, false);
    assert.equal(filled.complete, false);
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.option, 0);
    assert.equal(h.stats.radio, 0);
    assert.equal(textOf(h.document, 'first-value'), CITY);
    assert.equal(textOf(h.document, 'second-value'), CITY);
    assert.equal(h.document.querySelector('input[name="pb-obey"]').checked, true);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a different existing value is kept and the menu stays closed', async () => {
  const h = await boot({ first: CITY, second: CITY, obey: NO });
  try {
    const first = await h.api.fillField(FIRST, probe.neighbors.residence.token);
    const obey = await h.api.fillField(OBEY, YES);
    assert.equal(first.reason, 'existing_value');
    assert.equal(first.status, 'skipped');
    assert.equal(first.ok, false);
    assert.equal(first.opened, false);
    assert.equal(obey.reason, 'existing_value');
    assert.equal(obey.ok, false);
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.radio, 0);
    assert.equal(textOf(h.document, 'first-value'), CITY);
    assert.equal(h.document.querySelectorAll('input[name="pb-obey"]')[1].checked, true);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('empty values, internal radio codes, and out-of-scope labels fail closed', async () => {
  const h = await boot({});
  try {
    for (const value of ['', '   ', null, 1]) {
      const row = await h.api.fillField(FIRST, value);
      assert.equal(row.reason, 'missing_profile_value', String(value));
      assert.equal(row.ok, false);
      assert.equal(row.supportClaimed, false);
    }
    const code = await h.api.fillField(OBEY, '66008');
    const triple = await h.api.fillField(OBEY, probe.radio.valueSample);
    const zero = await h.api.fillField(OBEY, '0');
    assert.equal(code.reason, 'option_not_found');
    assert.equal(triple.reason, 'option_not_found');
    assert.equal(zero.reason, 'option_not_found');
    assert.equal(h.stats.radio, 0);
    for (const label of [
      probe.neighbors.residence.label,
      probe.neighbors.origin.label,
      probe.neighbors.interview.label,
      probe.neighbors.nature.label,
      probe.neighbors.gender.label,
      probe.neighbors.photo.label,
      '期望工作地点',
      '意向工作地点'
    ]) {
      const row = await h.api.fillField(label, CITY);
      assert.equal(row.reason, 'label_not_allowed', label);
    }
    const none = await h.api.fillFields(null);
    assert.equal(none.ok, false);
    assert.equal(none.supportClaimed, false);
    assert.equal(none.fields.every((field) => field.reason === 'missing_profile_value'), true);
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.option, 0);
    assert.equal(textOf(h.document, 'first-value'), '');
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('Escape closes the cascader and does not change the value; radio does not click', async () => {
  const h = await boot({ first: '', second: CITY, obey: YES });
  try {
    const canceled = await h.api.cancelField(FIRST);
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
    assert.equal(h.document.querySelector('[data-field="first"] .cascader-plugins-wrap ul').hidden, true);
    assert.equal(h.document.querySelectorAll('.ant-select-open').length, 0);
    const second = await h.api.cancelField(SECOND);
    assert.equal(second.reason, 'menu_closed');
    assert.equal(second.after, CITY);
    assert.equal(textOf(h.document, 'second-value'), CITY);
    const radio = await h.api.cancelField(OBEY);
    assert.equal(radio.reason, 'cancel_not_applicable');
    assert.equal(radio.opened, false);
    assert.equal(radio.after, YES);
    assert.equal(h.stats.radio, 0);
    assert.equal(h.document.querySelector('input[name="pb-obey"]').checked, true);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a menu that ignores Escape fails closed and does not keep a painted value', async () => {
  const h = await boot({ ignoreEscape: true });
  try {
    const canceled = await h.api.cancelField(SECOND);
    assert.equal(canceled.ok, false);
    assert.equal(canceled.reason, 'menu_cleanup_failed');
    assert.equal(canceled.stillOpen, 1);
    assert.equal(canceled.after, '');
    assert.equal(h.stats.option, 0);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('missing, duplicate, and drifted menus fail closed', async () => {
  const missing = await boot({});
  try {
    const row = await missing.api.fillField(FIRST, probe.neighbors.residence.token);
    assert.equal(row.reason, 'option_not_found', JSON.stringify(row));
    assert.equal(row.after, '');
    assert.equal(row.stillOpen, 0);
    assert.ok(missing.stats.escape >= 1);
    assert.equal(missing.stats.option, 0);
    unchanged(missing.document, missing.stats);
  } finally { missing.dom.window.close(); }

  const ambiguous = await boot({ duplicateOption: true });
  try {
    const row = await ambiguous.api.fillField(FIRST, CITY);
    assert.equal(row.reason, 'ambiguous_option');
    assert.equal(row.after, '');
    assert.equal(ambiguous.stats.option, 0);
  } finally { ambiguous.dom.window.close(); }

  const blocked = await boot({ saveOption: true });
  try {
    const row = await blocked.api.fillField(FIRST, FORBIDDEN[0]);
    assert.equal(row.reason, 'never_save', JSON.stringify(row));
    assert.equal(row.ok, false);
    assert.equal(row.canceled, true);
    assert.equal(row.stillOpen, 0);
    assert.equal(blocked.stats.forbidden, 0);
    assert.equal(blocked.stats.option, 0);
    assert.equal(textOf(blocked.document, 'first-value'), '');
    unchanged(blocked.document, blocked.stats);
  } finally { blocked.dom.window.close(); }
});

test('structure drift and the wrong page fail closed without painting', async () => {
  const cases = [
    [{ dropWrap: true }, FIRST, CITY],
    [{ outsideSelect: true }, FIRST, CITY],
    [{ allowClearOnCascader: true }, FIRST, CITY],
    [{ dropEnabled: true }, FIRST, CITY],
    [{ selectDisabled: true }, FIRST, CITY],
    [{ dropAntRow: true }, FIRST, CITY],
    [{ duplicateFirst: true }, FIRST, CITY],
    [{ twinDrift: true, first: CITY }, FIRST, CITY],
    [{ twinDisabled: true, first: CITY }, FIRST, CITY],
    [{ twinAllowClear: true, first: CITY }, FIRST, CITY],
    [{ twinHidden: true, first: CITY }, FIRST, CITY],
    [{ tripleSelect: true, first: CITY }, FIRST, CITY],
    [{ ambiguousValue: true, first: CITY }, FIRST, CITY],
    [{ twoWraps: true, first: CITY }, FIRST, CITY],
    [{ strayRadio: true }, FIRST, CITY],
    [{ strayText: true }, FIRST, CITY],
    [{ hiddenSelect: true }, FIRST, CITY],
    [{ disagreeCaption: true, first: CITY }, FIRST, CITY],
    [{ twinSelect: true }, FIRST, CITY],
    [{ busy: true }, FIRST, CITY],
    [{ dropRadioClass: true }, OBEY, YES],
    [{ obeyCheckbox: true }, OBEY, YES],
    [{ obeyOne: true }, OBEY, YES],
    [{ duplicateObeyText: true }, OBEY, YES],
    [{ obeyDisabled: true }, OBEY, YES],
    [{ obeyHidden: true }, OBEY, YES],
    [{ obeyBare: true }, OBEY, YES],
    [{ extraObeyLabel: true }, OBEY, YES],
    [{ strayOnRadio: true }, OBEY, YES],
    [{ dropRoot: true }, FIRST, CITY],
    [{ elForm: true }, FIRST, CITY],
    [{ url: 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/mc/deliver/operationResumer' }, FIRST, CITY],
    [{ url: 'https://gszq.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html' }, FIRST, CITY]
  ];
  for (const [state, label, value] of cases) {
    const h = await boot(state);
    try {
      const row = await h.api.fillField(label, value);
      assert.equal(row.ok, false, JSON.stringify({ state, row }));
      assert.notEqual(row.reason, 'readback_matched', JSON.stringify(state));
      assert.ok(['control_not_supported', 'control_busy', 'wrong_page'].includes(row.reason), JSON.stringify({ state, row }));
      assert.equal(row.supportClaimed, false);
      assert.equal(row.liveSupportClaimed, false);
      assert.equal(h.stats.option, 0, JSON.stringify(state));
      assert.equal(h.stats.radio, 0, JSON.stringify(state));
      assert.equal(h.stats.forbidden, 0, JSON.stringify(state));
      if (!state.dropRoot && !state.elForm && !state.url && !state.duplicateFirst && !state.dropAntRow && label === FIRST && !state.twinDrift) {
        const shown = textOf(h.document, 'first-value');
        assert.equal(shown === '' || shown === CITY || shown.includes(LIVE.placeholderPrefix), true, JSON.stringify({ state, shown }));
      }
    } finally { h.dom.window.close(); }
  }
});

test('two cascader selects that display the same value match without opening', async () => {
  const plain = await boot({
    twinSelect: true,
    first: LIVE.sameDisplay,
    second: LIVE.sameDisplay,
    obey: NO
  });
  try {
    const view = plain.api.inspect();
    assert.equal(view.liveSupportClaimed, false);
    assert.equal(view.supportClaimed, false);
    assert.equal(view.fields[0].reason, 'structure_matched');
    assert.equal(view.fields[0].supported, false);
    assert.equal(view.fields[0].value, CITY);
    assert.equal(view.fields[1].value, CITY);
    assert.equal(view.fields[2].value, NO);
    const filled = await plain.api.fillFields({ [FIRST]: CITY, [SECOND]: CITY, [OBEY]: NO });
    assert.equal(filled.ok, true, JSON.stringify(filled.fields));
    assert.equal(filled.fields.every((field) => field.reason === 'preexisting_same_value'), true);
    assert.equal(filled.fields.every((field) => field.opened === false), true);
    assert.equal(filled.saved, false);
    assert.equal(filled.complete, false);
    assert.equal(plain.stats.open, 0);
    assert.equal(plain.stats.option, 0);
    assert.equal(plain.stats.radio, 0);
    unchanged(plain.document, plain.stats);
  } finally { plain.dom.window.close(); }

  const mashed = await boot({
    twinSelect: true,
    cascaderMash: true,
    textMash: false,
    first: CITY,
    second: CITY,
    obey: YES
  });
  try {
    const first = await mashed.api.fillField(FIRST, CITY);
    const second = await mashed.api.fillField(SECOND, CITY);
    assert.equal(first.reason, 'preexisting_same_value', JSON.stringify(first));
    assert.equal(first.before, CITY);
    assert.equal(first.opened, false);
    assert.equal(second.before, CITY);
    assert.notEqual(first.before, `${LIVE.placeholderPrefix}${FIRST}${CITY}`);
    assert.equal(mashed.stats.open, 0);
    unchanged(mashed.document, mashed.stats);
  } finally { mashed.dom.window.close(); }
});

test('a placeholder mash reads the selected city and an empty prompt can be painted', async () => {
  const text = await boot({ textMash: true, first: CITY, second: CITY });
  try {
    const first = await text.api.fillField(FIRST, CITY);
    const second = await text.api.fillField(SECOND, CITY);
    assert.equal(first.reason, 'preexisting_same_value', JSON.stringify(first));
    assert.equal(first.before, CITY);
    assert.equal(first.opened, false);
    assert.equal(second.before, CITY);
    assert.equal(text.stats.open, 0);
    assert.equal(textOf(text.document, 'first-value').includes(LIVE.placeholderPrefix), true);
    unchanged(text.document, text.stats);
  } finally { text.dom.window.close(); }

  const painted = await boot({ cascaderMash: true });
  try {
    const first = await painted.api.fillField(FIRST, CITY);
    assert.equal(first.reason, 'readback_matched', JSON.stringify(first));
    assert.equal(first.after, CITY);
    assert.equal(first.opened, true);
    assert.equal(first.stillOpen, 0);
    assert.equal(painted.document.querySelector('#first-select .ant-select-selection-selected-value').textContent, CITY);
    assert.equal(painted.document.querySelector('#first-select .ant-select-selection__placeholder').textContent, `${LIVE.placeholderPrefix}${FIRST}`);
    unchanged(painted.document, painted.stats);
  } finally { painted.dom.window.close(); }

  const prompt = await boot({ placeholderOnly: true, second: '' });
  try {
    const view = prompt.api.inspect();
    assert.equal(view.fields[0].reason, 'structure_matched');
    assert.equal(view.fields[0].value, '');
    const first = await prompt.api.fillField(FIRST, CITY);
    assert.equal(first.reason, 'readback_matched', JSON.stringify(first));
    assert.equal(first.before, '');
    assert.equal(first.after, CITY);
    assert.equal(textOf(prompt.document, 'first-value'), CITY);
    unchanged(prompt.document, prompt.stats);
  } finally { prompt.dom.window.close(); }

  const same = await boot({ sameCaption: true, first: CITY, second: CITY, obey: YES });
  try {
    const view = same.api.inspect();
    assert.equal(view.fields.every((field) => field.reason === 'structure_matched'), true);
    const first = await same.api.fillField(FIRST, CITY);
    assert.equal(first.reason, 'preexisting_same_value');
    assert.equal(same.stats.open, 0);
    unchanged(same.document, same.stats);
  } finally { same.dom.window.close(); }
});

test('a hidden page fails closed before a click', async () => {
  const h = await boot({});
  try {
    Object.defineProperty(h.document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    const row = await h.api.fillField(FIRST, CITY);
    const radio = await h.api.fillField(OBEY, YES);
    assert.equal(row.reason, 'fill_interrupted_page_hidden');
    assert.equal(radio.reason, 'fill_interrupted_page_hidden');
    assert.equal(row.liveSupportClaimed, false);
    assert.equal(row.supportClaimed, false);
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.radio, 0);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('an open menu blocks the radio and a second cascader', async () => {
  const h = await boot({ busy: true, obey: '' });
  try {
    const second = await h.api.fillField(SECOND, CITY);
    const obey = await h.api.fillField(OBEY, YES);
    assert.equal(second.reason, 'control_busy');
    assert.equal(obey.reason, 'control_busy');
    assert.equal(h.stats.option, 0);
    assert.equal(h.stats.radio, 0);
    assert.equal(textOf(h.document, 'second-value'), '');
    assert.equal([...h.document.querySelectorAll('input[name="pb-obey"]')].some((node) => node.checked), false);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});
