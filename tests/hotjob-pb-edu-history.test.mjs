// Offline Never-Save trials for hotjob pb education-history 学校 and 城市.
// Markup is built from tests/fixtures/hotjob-pb-edu-history-probe-dom.json
// (2026-10-23 probe classes, labels, and the captured display tokens only).
// A green run is not a live support claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../src/content/hotjob-pb-edu-history.js', import.meta.url), 'utf8');
const basicSource = readFileSync(new URL('../src/content/hotjob-pb-basic.js', import.meta.url), 'utf8');
const regionSource = readFileSync(new URL('../src/content/hotjob-pb-region.js', import.meta.url), 'utf8');
const eduSource = readFileSync(new URL('../src/content/hotjob-pb-edu-intent.js', import.meta.url), 'utf8');
const workSource = readFileSync(new URL('../src/content/hotjob-pb-work.js', import.meta.url), 'utf8');
const certsSource = readFileSync(new URL('../src/content/hotjob-pb-certs.js', import.meta.url), 'utf8');
const intentSource = readFileSync(new URL('../src/content/hotjob-pb-intent-location.js', import.meta.url), 'utf8');
const mcSource = readFileSync(new URL('../src/content/hotjob-mc-basic.js', import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../manifest.json', import.meta.url), 'utf8');
const engine = readFileSync(new URL('../src/content/engine.js', import.meta.url), 'utf8');
const popup = readFileSync(new URL('../src/popup/popup.js', import.meta.url), 'utf8');
const cmsBasic = readFileSync(new URL('../src/background/cms-basic-auto.mjs', import.meta.url), 'utf8');
const cmsEdu = readFileSync(new URL('../src/background/cms-education-task-runner.mjs', import.meta.url), 'utf8');
const probe = JSON.parse(readFileSync(new URL('../tests/fixtures/hotjob-pb-edu-history-probe-dom.json', import.meta.url), 'utf8'));

const PAGE = `https://${probe.page.hostname}${probe.page.samplePath}`;
const SCHOOL = probe.school.label;
const CITY = probe.city.label;
const SCHOOL_VALUE = probe.school.valueSample;
const CITY_VALUE = probe.city.valueSample;
const FORBIDDEN = probe.page.forbiddenButtons;
const OUT = probe.outOfScope;
const LIVE = probe.school.liveReadback;
const PAIR = probe.city.livePair;
const FILL_PREFIX = probe.school.childrenTextSample.slice(0, probe.school.childrenTextSample.length - SCHOOL_VALUE.length);
const OTHER = 'NOT_IN_MENU';

function esc(value) {
  return String(value).replace(/[&<>"]/gu, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function classes(value) {
  return String(value).split(/\s+/u).filter(Boolean);
}

function textOf(document, id) {
  return document.getElementById(id)?.textContent ?? '';
}

function row(key, label, inner, state, extra = {}) {
  const itemClass = state.dropAntRow === key ? 'ant-form-item' : probe.page.itemClass;
  const star = extra.noStar ? '' : '*';
  const extraLabel = extra.extraLabel ? `<label>${esc(extra.extraLabel)}${star}</label>` : '';
  const hidden = extra.hidden ? ' hidden' : '';
  const style = extra.itemStyle ? ` style="${esc(extra.itemStyle)}"` : '';
  if (extra.wrapControl) {
    return `<div class="${esc(itemClass)}" data-field="${esc(key)}"${hidden}${style}><label>${esc(label)}${star}${inner}</label>${extraLabel}</div>`;
  }
  return `<div class="${esc(itemClass)}" data-field="${esc(key)}"${hidden}${style}><label>${esc(label)}${star}</label>${extraLabel}<span class="${esc(probe.page.childrenClass)}">${inner}</span></div>`;
}

function tokenRow(key, label, token, extra = {}) {
  return row(key, label, `<span id="${esc(key)}-token">${esc(token)}</span>`, {}, extra);
}

function textRow(key, label, id, value, placeholder) {
  const holder = placeholder ? ` placeholder="${esc(placeholder)}"` : '';
  return row(key, label, `<input id="${esc(id)}" class="${esc(probe.text.controlClass)}" type="${esc(probe.text.inputType)}"${holder} value="${esc(value)}">`, {});
}

function schoolInner(value, state) {
  if (state.ambiguousSchool) {
    return `<span class="${esc(LIVE.selectedValueClass)}">${esc(value || '甲')}</span><span class="${esc(LIVE.selectedValueClass)}">乙</span>`;
  }
  if (state.schoolMash === 'class' || state.fillPlaceholder) {
    const prompt = state.fillPlaceholder ? FILL_PREFIX : `${LIVE.placeholderPrefix}${SCHOOL}`;
    return `<span class="${esc(LIVE.placeholderClass)}">${esc(prompt)}</span><span class="${esc(LIVE.selectedValueClass)}" id="school-value">${esc(value)}</span>`;
  }
  const shown = state.schoolMash === 'text' ? `${LIVE.placeholderPrefix}${SCHOOL}${value}` : value;
  return `<span id="school-value">${esc(shown)}</span>`;
}

function schoolControl(value, state) {
  if (state.schoolAsText) {
    return `<input id="school-value" class="${esc(probe.text.controlClass)}" type="text" value="${esc(value)}">`;
  }
  const disabled = state.schoolDisabled ? ' ant-select-disabled' : '';
  const selectClass = `${state.dropAllowClear ? probe.city.controlClass : probe.school.controlClass}${disabled}`;
  const trigger = state.dropSearch ? '' : `<input class="${esc(probe.school.triggerClass)}" type="text" value="">`;
  const inner = schoolInner(value, state);
  const faced = state.closedSearch || state.schoolMash === 'class' || state.fillPlaceholder
    ? `<div class="${esc(LIVE.faceClass)}" role="${esc(LIVE.faceRole)}">${inner}</div>`
    : inner;
  const hidden = state.hiddenSchool ? ' hidden' : '';
  const extra = state.extraSelect
    ? `<div class="${esc(probe.school.controlClass)}"><span></span><input class="${esc(probe.school.triggerClass)}" type="text" value=""></div>`
    : '';
  return `<div class="${esc(selectClass)}" id="school-select"${hidden}>${faced}${trigger}</div>${extra}`;
}

function schoolMenu(state) {
  const dropdownClass = state.badDropdown
    ? 'ant-select-dropdown ant-select-dropdown-placement-bottomLeft'
    : probe.school.dropdownClass;
  let body = '';
  if (state.saveSchoolOption) {
    body = `<li><button type="button">${esc(FORBIDDEN[0])}</button></li>`;
  } else if (!state.emptySchoolMenu) {
    const rows = [...probe.school.optionsSample];
    if (state.duplicateSchoolOption) rows.push(SCHOOL_VALUE);
    body = rows.map((text) => `<li>${esc(text)}</li>`).join('');
  }
  return `<div class="${esc(dropdownClass)}" id="school-menu" hidden><ul>${body}</ul></div>`;
}

function schoolField(value, state) {
  if (state.onlyHiddenSchoolText) return '';
  const stray = [
    state.straySchoolText ? `<input class="${esc(probe.text.controlClass)}" type="text" value="">` : '',
    state.straySchoolRadio ? '<input class="ant-radio-input" type="radio">' : '',
    state.straySchoolFile ? '<input type="file">' : '',
    state.schoolCalendar ? `<input class="${esc(OUT.start.controlClass)}" type="text" readonly value="">` : '',
    state.schoolCascader ? `<span class="${esc(probe.city.menuClass)}"></span>` : ''
  ].join('');
  return row('school', SCHOOL, `${stray}${schoolControl(value, state)}`, state, {
    extraLabel: state.sameSchool ? SCHOOL : (state.disagreeSchool ? OUT.graduation.label : ''),
    wrapControl: state.wrapSchool,
    itemStyle: state.schoolItemStyle || ''
  }) + schoolMenu(state);
}

function partnerInput(id, state) {
  const partner = probe.school.hiddenTextPartner;
  const readonly = state.hiddenSchoolTextReadonly ? ' readonly' : '';
  const disabled = state.hiddenSchoolTextDisabled ? ' disabled' : '';
  return `<input id="${esc(id)}" class="${esc(partner.controlClass)}" type="${esc(partner.inputType)}" placeholder="${esc(partner.placeholder)}"${readonly}${disabled} value="">`;
}

function schoolPartner(state) {
  const partner = probe.school.hiddenTextPartner;
  if (state.hiddenDuplicateSchool) {
    return row('school-copy', SCHOOL, `<div class="${esc(probe.school.controlClass)}" id="school-select-copy"><span id="school-copy-value">${esc(SCHOOL_VALUE)}</span><input class="${esc(probe.school.triggerClass)}" type="text" value=""></div>`, state, {
      itemStyle: partner.itemStyle
    });
  }
  const rows = [];
  const textRowWanted = state.hiddenSchoolText || state.onlyHiddenSchoolText || state.visibleSchoolText
    || state.hiddenSchoolTextReadonly || state.hiddenSchoolTextDisabled || state.hiddenSchoolTextAttr;
  if (textRowWanted) {
    const extra = state.hiddenSchoolTextAttr
      ? { hidden: true }
      : (state.visibleSchoolText ? {} : { itemStyle: partner.itemStyle });
    rows.push(row('school-text', partner.label, partnerInput('school-text-input', state), state, extra));
  }
  if (state.secondHiddenSchoolText) {
    rows.push(row('school-text-2', partner.label, partnerInput('school-text-input-2', state), state, {
      itemStyle: partner.itemStyle
    }));
  }
  return rows.join('');
}

function schoolBlock(state) {
  const field = schoolField(state.school ?? '', state);
  const partner = schoolPartner(state);
  return state.hiddenSchoolTextFirst ? `${partner}${field}` : `${field}${partner}`;
}

function cityBody(value, state) {
  if (state.ambiguousCity) {
    return `<span class="${esc(PAIR.selectedValueClass)}">${esc(CITY_VALUE)}</span><span class="${esc(PAIR.selectedValueClass)}">${esc(OUT.residence.token)}</span>`;
  }
  if (state.placeholderOnly) {
    return `<span id="city-value">${esc(PAIR.placeholderPrefix + CITY)}</span>`;
  }
  if (state.cascaderMash) {
    return `<span class="${esc(PAIR.placeholderClass)}">${esc(PAIR.placeholderPrefix + CITY)}</span><span class="${esc(PAIR.selectedValueClass)}" id="city-value">${esc(value)}</span>`;
  }
  if (state.textMash) {
    return `<span id="city-value">${esc(`${PAIR.placeholderPrefix}${CITY}${value}`)}</span>`;
  }
  return `<span id="city-value">${esc(value)}</span>`;
}

function cityTwin(value, state) {
  const text = state.twinDrift ? OUT.residence.token : value;
  const className = [
    probe.city.controlClass,
    state.twinDisabled ? 'ant-select-disabled' : '',
    state.twinAllowClear ? 'ant-select-allow-clear' : ''
  ].filter(Boolean).join(' ');
  const hidden = state.twinHidden ? ' hidden' : '';
  const body = state.cascaderMash
    ? `<span class="${esc(PAIR.placeholderClass)}">${esc(PAIR.placeholderPrefix + CITY)}</span><span class="${esc(PAIR.selectedValueClass)}">${esc(text)}</span>`
    : `<span>${esc(text)}</span>`;
  return `<div class="${esc(className)}" id="city-twin"${hidden}>${body}</div>`;
}

function cityMenu(state) {
  if (state.saveCityOption) return `<ul hidden><li><button type="button">${esc(FORBIDDEN[0])}</button></li></ul>`;
  if (state.emptyCityMenu) return '<ul hidden></ul>';
  const rows = [...probe.city.optionsSample];
  if (state.duplicateCityOption) rows.push(CITY_VALUE);
  return `<ul hidden>${rows.map((text) => `<li>${esc(text)}</li>`).join('')}</ul>`;
}

function cityField(value, state) {
  if (state.cityAsSelect) {
    return row('city', CITY, `<div class="${esc(probe.school.controlClass)}" id="city-select"><span id="city-value">${esc(value)}</span><input class="${esc(probe.school.triggerClass)}" type="text" value=""></div>`, state);
  }
  const selectClass = [
    state.dropEnabled ? 'ant-select' : probe.city.controlClass,
    state.allowClearOnCascader ? 'ant-select-allow-clear' : '',
    state.cityDisabled ? 'ant-select-disabled' : ''
  ].filter(Boolean).join(' ');
  const hidden = state.hiddenCity ? ' hidden' : '';
  const wrapClass = state.dropWrap ? '' : probe.city.menuClass;
  const paired = state.twinSelect || state.twinDrift || state.twinDisabled || state.twinAllowClear || state.twinHidden;
  const inside = [
    paired ? cityTwin(value, state) : '',
    state.tripleSelect
      ? `<div class="${esc(probe.city.controlClass)}"><span>${esc(PAIR.sameDisplay)}</span></div><div class="${esc(probe.city.controlClass)}"><span>${esc(PAIR.sameDisplay)}</span></div>`
      : ''
  ].join('');
  const outside = [
    state.outsideSelect ? `<div class="${esc(probe.city.controlClass)}" id="outside-select"><span>${esc(CITY_VALUE)}</span></div>` : '',
    state.twoWraps ? `<span class="${esc(probe.city.menuClass)}"><div class="${esc(probe.city.controlClass)}"><span>${esc(CITY_VALUE)}</span></div><ul hidden><li>${esc(CITY_VALUE)}</li></ul></span>` : '',
    state.strayCityText ? `<input class="${esc(probe.text.controlClass)}" type="text" value="CITY_TEXT_KEEP">` : '',
    state.strayCityRadio ? '<input class="ant-radio-input" type="radio">' : ''
  ].join('');
  const inner = `${outside}<span class="${esc(wrapClass)}"><div class="${esc(selectClass)}" id="city-select"${hidden}>${cityBody(value, state)}</div>${inside}${cityMenu(state)}</span>`;
  return row('city', CITY, inner, state, {
    extraLabel: state.sameCity ? CITY : (state.disagreeCity ? OUT.origin.label : ''),
    wrapControl: state.wrapCity
  });
}

function residenceField() {
  return row('residence', OUT.residence.label, `<span class="${esc(OUT.residence.menuClass)}"><div class="${esc(OUT.residence.controlClass)}" id="residence-select"><span id="residence-value">${esc(OUT.residence.token)}</span></div><ul hidden><li>${esc(OUT.residence.token)}</li></ul></span>`, {});
}

function duplicateSchool(state) {
  if (!state.duplicateSchool) return '';
  return row('school-copy', SCHOOL, `<div class="${esc(probe.school.controlClass)}" id="school-select-copy"><span id="school-copy-value">${esc(SCHOOL_VALUE)}</span><input class="${esc(probe.school.triggerClass)}" type="text" value=""></div>`, {});
}

function duplicateCity(state) {
  if (!state.duplicateCity) return '';
  return row('city-copy', CITY, `<span class="${esc(probe.city.menuClass)}"><div class="${esc(probe.city.controlClass)}" id="city-select-copy"><span id="city-copy-value">${esc(CITY_VALUE)}</span></div><ul hidden><li>${esc(CITY_VALUE)}</li></ul></span>`, {});
}

function html(state) {
  const rootClass = state.dropRoot ? 'page-root' : probe.page.rootClass;
  const shell = [
    state.elForm ? '<div class="el-form"></div>' : '',
    state.mcList ? '<div class="my-list-item"></div>' : ''
  ].join('');
  const buttons = [...probe.page.buttonLabels, ...FORBIDDEN.filter((label) => !probe.page.buttonLabels.includes(label))]
    .map((label) => `<button type="button">${esc(label)}</button>`).join('');
  const description = row('description', OUT.description.label, `<textarea id="description-input" class="${esc(probe.text.controlClass)}" placeholder="${esc(OUT.description.placeholder)}">${esc(OUT.description.token)}</textarea>`, {}, { noStar: true });
  return `<!doctype html><body>${shell}<div class="${esc(rootClass)}"><div class="${esc(probe.page.contentClass)}">${
    tokenRow('email', OUT.email.label, OUT.email.token)
  }${residenceField()
  }${tokenRow('origin', OUT.origin.label, OUT.origin.token)
  }${tokenRow('graduation', OUT.graduation.label, OUT.graduation.token)
  }${tokenRow('basic-degree', OUT.basicDegree.label, OUT.basicDegree.token)
  }${tokenRow('basic-level', OUT.basicLevel.label, OUT.basicLevel.token)
  }${textRow('basic-major', OUT.basicMajor.label, 'basic-major-input', OUT.basicMajor.token, OUT.basicMajor.placeholder)
  }${row('start', OUT.start.label, `<input id="start-input" class="${esc(OUT.start.controlClass)}" type="text" readonly value="${esc(OUT.start.token)}">`, {})
  }${schoolBlock(state)
  }${cityField(state.city ?? '', state)
  }${duplicateSchool(state)
  }${duplicateCity(state)
  }${tokenRow('history-degree', OUT.historyDegree.label, OUT.historyDegree.token)
  }${tokenRow('history-level', OUT.historyLevel.label, OUT.historyLevel.token)
  }${textRow('history-major', OUT.historyMajor.label, 'history-major-input', OUT.historyMajor.token, OUT.historyMajor.placeholder)
  }${description
  }${tokenRow('rank', OUT.rank.label, OUT.rank.token)
  }${row('photo', OUT.photo.label, '<input id="photo" type="file">', {})
  }<button type="button" id="add-edu">${esc(probe.page.addEducation)}</button>${buttons}</div></div></body>`;
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
  hide(document.getElementById('school-menu'), true);
  for (const menu of document.querySelectorAll('.cascader-plugins-wrap ul')) hide(menu, true);
}

function wire(document, state) {
  const stats = {
    open: 0, option: 0, escape: 0, forbidden: 0, file: 0, addEdu: 0,
    openedIds: [], openClass: '', triggerClass: '', faceClass: ''
  };
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (button && FORBIDDEN.includes((button.textContent || '').replace(/\s+/gu, ''))) stats.forbidden += 1;
    if (button && button.id === 'add-edu') stats.addEdu += 1;
    if (event.target.matches?.('input[type="file"]')) stats.file += 1;
  }, true);
  for (const select of document.querySelectorAll('.ant-select')) {
    const wrap = select.closest('.cascader-plugins-wrap');
    const menu = wrap?.querySelector('ul') || null;
    select.addEventListener('click', (event) => {
      if (menu && menu.contains(event.target)) return;
      if (select.id === 'school-select' && document.getElementById('school-menu')?.contains(event.target)) return;
      stats.open += 1;
      stats.openedIds.push(select.id || 'anon');
      if (event.target.classList?.contains(probe.school.triggerClass)) stats.triggerClass = probe.school.triggerClass;
      if (event.target.closest?.(`.${LIVE.faceClass}`)) stats.faceClass = LIVE.faceClass;
      select.classList.add(...classes(probe.school.openClass));
      stats.openClass = select.className;
      if (menu) hide(menu, false);
      if (select.id === 'school-select') hide(document.getElementById('school-menu'), false);
    });
  }
  document.getElementById('school-menu')?.addEventListener('click', (event) => {
    const li = event.target.closest('li');
    if (!li) return;
    stats.option += 1;
    const select = document.getElementById('school-select');
    const slot = select?.querySelector('.ant-select-selection-selected-value, #school-value') || select?.querySelector('span');
    if (slot) slot.textContent = li.textContent.trim();
    closeWidgets(document);
  });
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
  if (state.busySchool && document.getElementById('school-select')) {
    document.getElementById('school-select').classList.add('ant-select-open', 'ant-select-focused');
    hide(document.getElementById('school-menu'), false);
  }
  if (state.busyCity && document.getElementById('city-select')) {
    const select = document.getElementById('city-select');
    select.classList.add('ant-select-open', 'ant-select-focused');
    hide(select.closest('.cascader-plugins-wrap')?.querySelector('ul'), false);
  }
  return stats;
}

function patch(window, state) {
  window.Element.prototype.getClientRects = function () {
    if (state.closedSearch && this.classList?.contains(probe.school.triggerClass)) return [];
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
  return { dom, window, document, stats, api: window.ResumeHotjobPbEduHistory };
}

function assertNeverSaved(row) {
  assert.equal(row.liveSupportClaimed, false);
  assert.equal(row.supportClaimed, false);
  assert.equal(row.neverSave, true);
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
  assert.equal(textOf(document, 'email-token'), OUT.email.token);
  assert.equal(textOf(document, 'residence-value'), OUT.residence.token);
  assert.equal(textOf(document, 'origin-token'), OUT.origin.token);
  assert.equal(textOf(document, 'graduation-token'), OUT.graduation.token);
  assert.equal(textOf(document, 'basic-degree-token'), OUT.basicDegree.token);
  assert.equal(textOf(document, 'basic-level-token'), OUT.basicLevel.token);
  assert.equal(document.getElementById('basic-major-input').value, OUT.basicMajor.token);
  assert.equal(document.getElementById('start-input').value, OUT.start.token);
  assert.equal(textOf(document, 'history-degree-token'), OUT.historyDegree.token);
  assert.equal(textOf(document, 'history-level-token'), OUT.historyLevel.token);
  assert.equal(document.getElementById('history-major-input').value, OUT.historyMajor.token);
  assert.equal(document.getElementById('description-input').value, '');
  assert.equal(textOf(document, 'rank-token'), OUT.rank.token);
  const schoolText = document.getElementById('school-text-input');
  if (schoolText) assert.equal(schoolText.value, '');
  const schoolText2 = document.getElementById('school-text-input-2');
  if (schoolText2) assert.equal(schoolText2.value, '');
  assert.equal(document.getElementById('photo').files.length, 0);
  assert.equal(stats.forbidden, 0);
  assert.equal(stats.file, 0);
  assert.equal(stats.addEdu, 0);
  assert.equal(stats.openedIds.includes('residence-select'), false);
}

test('source stays on the probed pb classes and does not claim support', () => {
  assert.match(source, /ResumeHotjobPbEduHistory/);
  assert.match(source, /liveSupportClaimed:\s*false/);
  assert.match(source, /supportClaimed:\s*false/);
  assert.match(source, /neverSave:\s*true/);
  assert.doesNotMatch(source, /liveSupportClaimed:\s*true/);
  assert.doesNotMatch(source, /supportClaimed:\s*true/);
  assert.doesNotMatch(source, /已支持/);
  assert.doesNotMatch(source, /悉尼大学|北京市/);
  assert.doesNotMatch(source, /hotjob-mc-basic|ResumeHotjobMc|ResumeHotjobPbBasic|ResumeHotjobPbRegion|ResumeHotjobPbWork|ResumeHotjobPbEduIntent|ResumeHotjobPbIntentLocation|ResumeHotjobPbCerts|mc\/deliver|cms-region|engine\.js/);
  assert.doesNotMatch(source, /textContent\s*=/);
  assert.doesNotMatch(source, /\.value\s*=[^=]/);
  assert.doesNotMatch(source, /innerHTML/);
  assert.doesNotMatch(source, /\bexport\s/);
  assert.doesNotMatch(source, /ant-cascader-menus|form-cell|ant-select-selection--single|ant-select-dropdown-menu-item/);
  assert.match(source, /保存\|提交\|投递\|删除\|下一步\|返回\|确定/);
  const untouched = [manifest, engine, popup, cmsBasic, cmsEdu, basicSource, regionSource, eduSource, workSource, certsSource, intentSource, mcSource];
  for (const file of untouched) {
    assert.equal(file.includes('hotjob-pb-edu-history'), false);
    assert.equal(file.includes('ResumeHotjobPbEduHistory'), false);
  }
  for (const token of [
    ...classes(probe.page.itemClass),
    ...classes(probe.school.controlClass),
    ...classes(probe.school.openClass),
    ...classes(probe.school.dropdownClass),
    probe.school.triggerClass,
    ...classes(probe.city.controlClass),
    probe.city.menuClass,
    probe.page.rootClass,
    LIVE.selectedValueClass,
    LIVE.placeholderClass,
    LIVE.placeholderPrefix,
    LIVE.faceClass,
    '[role="combobox"]',
    '.ant-select-selector',
    '.ant-select-selection-item',
    'ant-select-disabled',
    'ant-select-allow-clear',
    OUT.start.controlClass.split(/\s+/u)[0],
    SCHOOL,
    CITY
  ]) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  }
});

test('fixture html uses the probe class list, labels, and display tokens', () => {
  const built = html({ school: SCHOOL_VALUE, city: CITY_VALUE, twinSelect: true, fillPlaceholder: true });
  for (const token of [
    probe.page.rootClass, probe.page.contentClass, probe.page.childrenClass,
    ...classes(probe.page.itemClass), ...classes(probe.school.controlClass),
    probe.school.triggerClass, ...classes(probe.school.dropdownClass),
    ...classes(probe.city.controlClass), probe.city.menuClass,
    probe.text.controlClass, OUT.start.controlClass.split(/\s+/u)[0],
    LIVE.selectedValueClass, LIVE.placeholderClass, LIVE.faceClass, LIVE.faceRole
  ]) assert.match(built, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  for (const label of [SCHOOL, CITY, OUT.graduation.label, OUT.historyDegree.label, OUT.historyLevel.label, OUT.historyMajor.label, OUT.description.label, OUT.rank.label, OUT.residence.label, OUT.email.label]) {
    assert.match(built, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  }
  assert.match(built, new RegExp(`>${SCHOOL}\\*`));
  assert.match(built, new RegExp(`>${CITY}\\*`));
  for (const option of [...probe.school.optionsSample, ...probe.city.optionsSample]) {
    assert.match(built, new RegExp(`>${option}<`));
  }
  for (const label of probe.page.buttonLabels) assert.match(built, new RegExp(`>${label}<`));
  assert.match(built, new RegExp(`>${probe.page.addEducation}<`));
  assert.match(built, new RegExp(FILL_PREFIX.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  assert.equal(FILL_PREFIX + SCHOOL_VALUE, probe.school.childrenTextSample);
  assert.equal(probe.school.hiddenTextPartner.placeholder, FILL_PREFIX);
  assert.equal(probe.school.hiddenTextPartner.label, SCHOOL);
  assert.equal(probe.school.hiddenTextPartner.hasSelect, false);
  assert.equal(probe.school.hiddenTextPartner.itemStyle, 'display: none');
  assert.equal(probe.school.hiddenTextPartner.controlClass, probe.text.controlClass);
  assert.equal(probe.school.hiddenTextPartner.inputType, probe.text.inputType);
  assert.equal(probe.city.pageTextPair, `${CITY_VALUE} ${CITY_VALUE}`);
  assert.equal(probe.city.livePair.selectCount, 2);
  assert.doesNotMatch(built, /ant-cascader-menus|ant-select-selection--single|ant-select-dropdown-menu-item|form-cell/);
  assert.doesNotMatch(JSON.stringify(probe), /1\d{10}/);
  assert.equal(OUT.description.token, '');
});

test('inspect matches 学校 and 城市 and does not claim support', async () => {
  const h = await boot({
    url: `${PAGE}?lang=1`,
    school: SCHOOL_VALUE,
    city: CITY_VALUE,
    twinSelect: true,
    fillPlaceholder: true
  });
  try {
    const view = h.api.inspect();
    assert.equal(Object.isFrozen(h.api), true);
    assert.equal(h.api.liveSupportClaimed, false);
    assert.equal(h.api.supportClaimed, false);
    assert.equal(h.api.neverSave, true);
    assert.equal(h.window.ResumeHotjobPbBasic, undefined);
    assert.equal(h.window.ResumeHotjobPbRegion, undefined);
    assert.equal(h.window.ResumeHotjobPbEduIntent, undefined);
    assert.equal(h.window.ResumeHotjobPbIntentLocation, undefined);
    assert.equal(h.window.ResumeHotjobPbWork, undefined);
    assert.equal(h.window.ResumeHotjobPbCerts, undefined);
    assert.equal(view.liveSupportClaimed, false);
    assert.equal(view.supportClaimed, false);
    assert.equal(view.neverSave, true);
    assert.equal(view.complete, false);
    assert.equal(view.saved, false);
    assert.equal(view.skippedSave, true);
    assert.equal(view.ok, true);
    assert.equal(view.reason, 'structure_matched');
    assert.equal(view.fields.length, 2);
    assert.equal(view.fields.every((field) => field.supported === false), true);
    assert.deepEqual(Array.from(view.fields, (field) => field.label), [SCHOOL, CITY]);
    assert.deepEqual(Array.from(view.fields, (field) => field.kind), ['select', 'cascader']);
    assert.equal(view.fields[0].reason, 'structure_matched');
    assert.equal(view.fields[1].reason, 'structure_matched');
    assert.equal(view.fields[0].value, SCHOOL_VALUE);
    assert.equal(view.fields[1].value, CITY_VALUE);
    assert.notEqual(view.fields[0].value, probe.school.childrenTextSample);
    assert.equal(h.stats.open, 0);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('empty 学校 and 城市 read back the captured display token', async () => {
  const h = await boot({});
  try {
    const school = await h.api.fillField(SCHOOL, ` \u200b${SCHOOL_VALUE} `);
    const city = await h.api.fillField(CITY, ` ${CITY_VALUE} `);
    assert.equal(school.ok, true, JSON.stringify(school));
    assert.equal(school.status, 'verified');
    assert.equal(school.reason, 'readback_matched');
    assert.equal(school.before, '');
    assert.equal(school.after, SCHOOL_VALUE);
    assert.equal(school.expected, SCHOOL_VALUE);
    assert.equal(school.opened, true);
    assert.equal(school.canceled, false);
    assert.equal(school.stillOpen, 0);
    assertNeverSaved(school);
    assert.equal(city.reason, 'readback_matched');
    assert.equal(city.after, CITY_VALUE);
    assert.equal(city.stillOpen, 0);
    assertNeverSaved(city);
    assert.equal(h.stats.triggerClass, probe.school.triggerClass);
    assert.match(h.stats.openClass, /ant-select-open/);
    assert.match(h.stats.openClass, /ant-select-focused/);
    assert.match(h.stats.openClass, /ant-select-enabled/);
    assert.deepEqual(h.stats.openedIds, ['school-select', 'city-select']);
    assert.equal(textOf(h.document, 'school-value'), SCHOOL_VALUE);
    assert.equal(textOf(h.document, 'city-value'), CITY_VALUE);
    assert.equal(h.document.querySelectorAll('.ant-select-open').length, 0);
    assert.equal(h.document.getElementById('school-menu').hidden, true);
    assert.equal(h.document.querySelector('[data-field="city"] .cascader-plugins-wrap ul').hidden, true);
    assert.equal(h.stats.open, 2);
    assert.equal(h.stats.option, 2);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('fillFields reads back both fields and leaves the other education rows untouched', async () => {
  const h = await boot({});
  try {
    const filled = await h.api.fillFields({ [SCHOOL]: SCHOOL_VALUE, [CITY]: CITY_VALUE });
    assert.equal(filled.ok, true, JSON.stringify(filled.fields));
    assertNeverSaved(filled);
    assert.equal(filled.fields.map((field) => field.reason).join(','), 'readback_matched,readback_matched');
    assert.equal(textOf(h.document, 'school-value'), SCHOOL_VALUE);
    assert.equal(textOf(h.document, 'city-value'), CITY_VALUE);
    assert.deepEqual(h.stats.openedIds, ['school-select', 'city-select']);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a filled page verifies without opening either menu', async () => {
  const h = await boot({ school: SCHOOL_VALUE, city: CITY_VALUE, twinSelect: true });
  try {
    const filled = await h.api.fillFields({
      [SCHOOL]: ` ${SCHOOL_VALUE} `,
      [CITY]: CITY_VALUE
    });
    assert.equal(filled.ok, true, JSON.stringify(filled.fields));
    assert.equal(filled.fields.every((field) => field.reason === 'preexisting_same_value'), true);
    assert.equal(filled.fields.every((field) => field.status === 'verified'), true);
    assert.equal(filled.fields.every((field) => field.opened === false), true);
    assert.equal(filled.fields[0].before, SCHOOL_VALUE);
    assert.equal(filled.fields[1].before, CITY_VALUE);
    assert.equal(filled.fields[1].after, CITY_VALUE);
    assertNeverSaved(filled);
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.option, 0);
    assert.equal(textOf(h.document, 'school-value'), SCHOOL_VALUE);
    assert.equal(textOf(h.document, 'city-value'), CITY_VALUE);
    assert.equal(textOf(h.document, 'city-twin'), CITY_VALUE);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a different existing value is kept and the menu stays closed', async () => {
  const h = await boot({ school: SCHOOL_VALUE, city: CITY_VALUE });
  try {
    const school = await h.api.fillField(SCHOOL, OTHER);
    const city = await h.api.fillField(CITY, OTHER);
    assert.equal(school.reason, 'existing_value');
    assert.equal(school.status, 'skipped');
    assert.equal(school.ok, false);
    assert.equal(school.opened, false);
    assert.equal(school.after, SCHOOL_VALUE);
    assert.equal(city.reason, 'existing_value');
    assert.equal(city.ok, false);
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.option, 0);
    assert.equal(textOf(h.document, 'school-value'), SCHOOL_VALUE);
    assert.equal(textOf(h.document, 'city-value'), CITY_VALUE);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('empty values and out-of-scope labels fail closed without opening', async () => {
  const h = await boot({ school: SCHOOL_VALUE, city: CITY_VALUE });
  try {
    for (const value of ['', '   ', null, 1]) {
      const rowResult = await h.api.fillField(SCHOOL, value);
      assert.equal(rowResult.reason, 'missing_profile_value', String(value));
      assert.equal(rowResult.ok, false);
      assertNeverSaved(rowResult);
    }
    for (const label of [
      OUT.graduation.label,
      OUT.basicDegree.label,
      OUT.basicLevel.label,
      OUT.basicMajor.label,
      OUT.historyDegree.label,
      OUT.description.label,
      OUT.rank.label,
      OUT.residence.label,
      OUT.origin.label,
      OUT.start.label,
      OUT.email.label,
      probe.page.addEducation,
      '意向工作地点'
    ]) {
      const rowResult = await h.api.fillField(label, SCHOOL_VALUE);
      assert.equal(rowResult.reason, 'label_not_allowed', label);
      assert.equal(rowResult.ok, false);
    }
    const none = await h.api.fillFields(null);
    assert.equal(none.ok, false);
    assertNeverSaved(none);
    assert.equal(none.fields.every((field) => field.reason === 'missing_profile_value'), true);
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.option, 0);
    assert.equal(textOf(h.document, 'school-value'), SCHOOL_VALUE);
    assert.equal(textOf(h.document, 'city-value'), CITY_VALUE);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('Escape closes both menus and does not change the value', async () => {
  const h = await boot({ school: '', city: CITY_VALUE });
  try {
    const school = await h.api.cancelField(SCHOOL);
    assert.equal(school.ok, true, JSON.stringify(school));
    assert.equal(school.reason, 'menu_closed');
    assert.equal(school.canceled, true);
    assert.equal(school.stillOpen, 0);
    assert.equal(school.before, '');
    assert.equal(school.after, '');
    assertNeverSaved(school);
    assert.equal(h.stats.open, 1);
    assert.equal(h.stats.option, 0);
    assert.ok(h.stats.escape >= 1);
    assert.equal(h.document.getElementById('school-menu').hidden, true);
    assert.equal(h.document.querySelectorAll('.ant-select-open').length, 0);
    const city = await h.api.cancelField(CITY);
    assert.equal(city.reason, 'menu_closed');
    assert.equal(city.after, CITY_VALUE);
    assert.equal(city.canceled, true);
    assert.equal(textOf(h.document, 'city-value'), CITY_VALUE);
    assert.equal(h.document.querySelector('[data-field="city"] .cascader-plugins-wrap ul').hidden, true);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a menu that ignores Escape fails closed and does not paint', async () => {
  const h = await boot({ ignoreEscape: true, city: '' });
  try {
    const canceled = await h.api.cancelField(CITY);
    assert.equal(canceled.ok, false);
    assert.equal(canceled.reason, 'menu_cleanup_failed');
    assert.equal(canceled.stillOpen, 1);
    assert.equal(canceled.after, '');
    assert.equal(h.stats.option, 0);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('missing and duplicate options and a forbidden menu button fail closed', async () => {
  const missing = await boot({});
  try {
    const school = await missing.api.fillField(SCHOOL, OTHER);
    const city = await missing.api.fillField(CITY, OTHER);
    assert.equal(school.reason, 'option_not_found', JSON.stringify(school));
    assert.equal(school.after, '');
    assert.equal(school.stillOpen, 0);
    assert.equal(city.reason, 'option_not_found');
    assert.equal(city.after, '');
    assert.ok(missing.stats.escape >= 1);
    assert.equal(missing.stats.option, 0);
    unchanged(missing.document, missing.stats);
  } finally { missing.dom.window.close(); }

  const ambiguous = await boot({ duplicateSchoolOption: true, duplicateCityOption: true });
  try {
    const school = await ambiguous.api.fillField(SCHOOL, SCHOOL_VALUE);
    const city = await ambiguous.api.fillField(CITY, CITY_VALUE);
    assert.equal(school.reason, 'ambiguous_option');
    assert.equal(school.after, '');
    assert.equal(city.reason, 'ambiguous_option');
    assert.equal(city.after, '');
    assert.equal(ambiguous.stats.option, 0);
    unchanged(ambiguous.document, ambiguous.stats);
  } finally { ambiguous.dom.window.close(); }

  const blocked = await boot({ saveSchoolOption: true });
  try {
    const school = await blocked.api.fillField(SCHOOL, FORBIDDEN[0]);
    assert.equal(school.reason, 'never_save', JSON.stringify(school));
    assert.equal(school.ok, false);
    assert.equal(school.canceled, true);
    assert.equal(school.stillOpen, 0);
    assert.equal(blocked.stats.forbidden, 0);
    assert.equal(blocked.stats.option, 0);
    assert.equal(textOf(blocked.document, 'school-value'), '');
    unchanged(blocked.document, blocked.stats);
  } finally { blocked.dom.window.close(); }

  const blockedCity = await boot({ saveCityOption: true });
  try {
    const city = await blockedCity.api.fillField(CITY, FORBIDDEN[0]);
    assert.equal(city.reason, 'never_save', JSON.stringify(city));
    assert.equal(city.canceled, true);
    assert.equal(city.stillOpen, 0);
    assert.equal(blockedCity.stats.forbidden, 0);
    assert.equal(blockedCity.stats.option, 0);
    unchanged(blockedCity.document, blockedCity.stats);
  } finally { blockedCity.dom.window.close(); }
});

test('structure drift and the wrong page fail closed without painting', async () => {
  const cases = [
    [{ dropSearch: true }, SCHOOL, SCHOOL_VALUE],
    [{ dropAllowClear: true }, SCHOOL, SCHOOL_VALUE],
    [{ schoolDisabled: true }, SCHOOL, SCHOOL_VALUE],
    [{ hiddenSchool: true }, SCHOOL, SCHOOL_VALUE],
    [{ extraSelect: true }, SCHOOL, SCHOOL_VALUE],
    [{ schoolAsText: true }, SCHOOL, SCHOOL_VALUE],
    [{ straySchoolText: true }, SCHOOL, SCHOOL_VALUE],
    [{ straySchoolRadio: true }, SCHOOL, SCHOOL_VALUE],
    [{ straySchoolFile: true }, SCHOOL, SCHOOL_VALUE],
    [{ schoolCalendar: true }, SCHOOL, SCHOOL_VALUE],
    [{ schoolCascader: true }, SCHOOL, SCHOOL_VALUE],
    [{ ambiguousSchool: true, school: SCHOOL_VALUE }, SCHOOL, SCHOOL_VALUE],
    [{ disagreeSchool: true, school: SCHOOL_VALUE }, SCHOOL, SCHOOL_VALUE],
    [{ duplicateSchool: true, school: SCHOOL_VALUE }, SCHOOL, SCHOOL_VALUE],
    [{ duplicateSchool: true }, SCHOOL, SCHOOL_VALUE],
    [{ hiddenSchoolText: true }, SCHOOL, SCHOOL_VALUE],
    [{ hiddenSchoolText: true, dropAllowClear: true, school: SCHOOL_VALUE }, SCHOOL, SCHOOL_VALUE],
    [{ hiddenSchoolText: true, schoolDisabled: true, school: SCHOOL_VALUE }, SCHOOL, SCHOOL_VALUE],
    [{ hiddenSchoolText: true, straySchoolText: true, school: SCHOOL_VALUE }, SCHOOL, SCHOOL_VALUE],
    [{ hiddenSchoolText: true, duplicateSchool: true, school: SCHOOL_VALUE }, SCHOOL, SCHOOL_VALUE],
    [{ visibleSchoolText: true, school: SCHOOL_VALUE }, SCHOOL, SCHOOL_VALUE],
    [{ hiddenSchoolTextReadonly: true, school: SCHOOL_VALUE }, SCHOOL, SCHOOL_VALUE],
    [{ hiddenSchoolTextDisabled: true, school: SCHOOL_VALUE }, SCHOOL, SCHOOL_VALUE],
    [{ hiddenDuplicateSchool: true, school: SCHOOL_VALUE }, SCHOOL, SCHOOL_VALUE],
    [{ onlyHiddenSchoolText: true }, SCHOOL, SCHOOL_VALUE],
    [{ onlyHiddenSchoolText: true, secondHiddenSchoolText: true }, SCHOOL, SCHOOL_VALUE],
    [{ schoolItemStyle: probe.school.hiddenTextPartner.itemStyle, school: SCHOOL_VALUE }, SCHOOL, SCHOOL_VALUE],
    [{ dropAntRow: 'school' }, SCHOOL, SCHOOL_VALUE],
    [{ badDropdown: true }, SCHOOL, SCHOOL_VALUE],
    [{ emptySchoolMenu: true }, SCHOOL, SCHOOL_VALUE],
    [{ busySchool: true }, SCHOOL, SCHOOL_VALUE],
    [{ dropWrap: true }, CITY, CITY_VALUE],
    [{ dropEnabled: true }, CITY, CITY_VALUE],
    [{ allowClearOnCascader: true }, CITY, CITY_VALUE],
    [{ cityDisabled: true }, CITY, CITY_VALUE],
    [{ hiddenCity: true }, CITY, CITY_VALUE],
    [{ cityAsSelect: true }, CITY, CITY_VALUE],
    [{ outsideSelect: true, city: CITY_VALUE }, CITY, CITY_VALUE],
    [{ twoWraps: true, city: CITY_VALUE }, CITY, CITY_VALUE],
    [{ strayCityText: true, city: CITY_VALUE }, CITY, CITY_VALUE],
    [{ strayCityRadio: true }, CITY, CITY_VALUE],
    [{ tripleSelect: true, city: CITY_VALUE }, CITY, CITY_VALUE],
    [{ twinDrift: true, city: CITY_VALUE }, CITY, CITY_VALUE],
    [{ twinDisabled: true, city: CITY_VALUE }, CITY, CITY_VALUE],
    [{ twinAllowClear: true, city: CITY_VALUE }, CITY, CITY_VALUE],
    [{ twinHidden: true, city: CITY_VALUE }, CITY, CITY_VALUE],
    [{ twinSelect: true }, CITY, CITY_VALUE],
    [{ ambiguousCity: true, city: CITY_VALUE }, CITY, CITY_VALUE],
    [{ disagreeCity: true, city: CITY_VALUE }, CITY, CITY_VALUE],
    [{ duplicateCity: true, city: CITY_VALUE }, CITY, CITY_VALUE],
    [{ dropAntRow: 'city' }, CITY, CITY_VALUE],
    [{ emptyCityMenu: true }, CITY, CITY_VALUE],
    [{ busyCity: true }, CITY, CITY_VALUE],
    [{ dropRoot: true }, SCHOOL, SCHOOL_VALUE],
    [{ elForm: true }, SCHOOL, SCHOOL_VALUE],
    [{ mcList: true }, CITY, CITY_VALUE],
    [{ url: 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/mc/deliver/operationResumer' }, SCHOOL, SCHOOL_VALUE],
    [{ url: 'https://gszq.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html' }, CITY, CITY_VALUE]
  ];
  for (const [state, label, value] of cases) {
    const h = await boot(state);
    try {
      const rowResult = await h.api.fillField(label, value);
      assert.equal(rowResult.ok, false, JSON.stringify({ state, rowResult }));
      assert.notEqual(rowResult.reason, 'readback_matched', JSON.stringify(state));
      assert.notEqual(rowResult.reason, 'preexisting_same_value', JSON.stringify(state));
      assert.ok(['control_not_supported', 'control_busy', 'wrong_page'].includes(rowResult.reason), JSON.stringify({ state, rowResult }));
      assert.equal(rowResult.liveSupportClaimed, false);
      assert.equal(rowResult.supportClaimed, false);
      assert.equal(h.stats.option, 0, JSON.stringify(state));
      assert.equal(h.stats.forbidden, 0, JSON.stringify(state));
      assert.equal(h.stats.addEdu, 0, JSON.stringify(state));
      if (!state.dropRoot && !state.elForm && !state.url && !state.mcList) unchanged(h.document, h.stats);
      if (!state.badDropdown && !state.emptySchoolMenu && !state.emptyCityMenu && !state.busySchool && !state.busyCity && !state.dropRoot && !state.elForm && !state.url && !state.mcList) {
        assert.equal(h.stats.open, 0, JSON.stringify(state));
      }
    } finally { h.dom.window.close(); }
  }
});

function schoolItems(document) {
  return [...document.querySelectorAll('.ant-row.ant-form-item')].filter((item) => {
    const labels = [...item.querySelectorAll('label')].filter((node) => node.closest('.ant-row.ant-form-item') === item);
    const captions = [...new Set(labels.map((node) => node.textContent.replace(/[＊*？?\s\u00a0]/gu, '')))];
    return captions.length === 1 && captions[0] === SCHOOL;
  });
}

test('a visible 学校 select is used when a hidden text row repeats the label', async () => {
  const partner = probe.school.hiddenTextPartner;
  const filled = await boot({
    hiddenSchoolText: true,
    fillPlaceholder: true,
    school: SCHOOL_VALUE,
    city: CITY_VALUE,
    twinSelect: true
  });
  try {
    const rowNode = filled.document.querySelector('[data-field="school-text"]');
    const input = filled.document.getElementById('school-text-input');
    assert.equal(schoolItems(filled.document).length, 2);
    assert.equal(rowNode.hasAttribute('hidden'), false);
    assert.equal(rowNode.style.display, 'none');
    assert.equal(filled.window.getComputedStyle(rowNode).display, 'none');
    assert.equal(rowNode.querySelector('.ant-select'), null);
    assert.equal(input.placeholder, partner.placeholder);
    assert.equal(input.value, '');
    const view = filled.api.inspect();
    assert.equal(view.ok, true, JSON.stringify(view.fields));
    assert.equal(view.liveSupportClaimed, false);
    assert.equal(view.supportClaimed, false);
    assert.equal(view.fields[0].supported, false);
    assert.equal(view.fields[0].reason, 'structure_matched');
    assert.equal(view.fields[0].value, SCHOOL_VALUE);
    assert.notEqual(view.fields[0].value, partner.placeholder);
    assert.notEqual(view.fields[0].value, probe.school.childrenTextSample);
    assert.equal(view.fields[1].reason, 'structure_matched');
    assert.equal(view.fields[1].value, CITY_VALUE);
    const result = await filled.api.fillFields({ [SCHOOL]: ` ${SCHOOL_VALUE} `, [CITY]: CITY_VALUE });
    assert.equal(result.ok, true, JSON.stringify(result.fields));
    assert.equal(result.fields.every((field) => field.reason === 'preexisting_same_value'), true);
    assert.equal(result.fields.every((field) => field.opened === false), true);
    assert.equal(result.fields[0].before, SCHOOL_VALUE);
    assert.equal(result.fields[0].after, SCHOOL_VALUE);
    assertNeverSaved(result);
    assert.equal(filled.api.liveSupportClaimed, false);
    assert.equal(filled.api.supportClaimed, false);
    const kept = await filled.api.fillField(SCHOOL, OTHER);
    assert.equal(kept.reason, 'existing_value');
    assert.equal(kept.opened, false);
    const missing = await filled.api.fillField(SCHOOL, '  ');
    assert.equal(missing.reason, 'missing_profile_value');
    assert.equal(missing.opened, false);
    assert.equal(filled.stats.open, 0);
    assert.equal(filled.stats.option, 0);
    const canceled = await filled.api.cancelField(SCHOOL);
    assert.equal(canceled.ok, true, JSON.stringify(canceled));
    assert.equal(canceled.reason, 'menu_closed');
    assert.equal(canceled.canceled, true);
    assert.equal(canceled.stillOpen, 0);
    assert.equal(canceled.before, SCHOOL_VALUE);
    assert.equal(canceled.after, SCHOOL_VALUE);
    assertNeverSaved(canceled);
    assert.ok(filled.stats.escape >= 1);
    assert.equal(filled.stats.option, 0);
    assert.deepEqual(filled.stats.openedIds, ['school-select']);
    assert.equal(filled.document.getElementById('school-menu').hidden, true);
    assert.equal(filled.document.querySelectorAll('.ant-select-open').length, 0);
    assert.equal(filled.document.querySelector('[data-field="city"] .cascader-plugins-wrap ul').hidden, true);
    assert.equal(input.value, '');
    assert.equal(textOf(filled.document, 'school-value'), SCHOOL_VALUE);
    assert.equal(textOf(filled.document, 'city-value'), CITY_VALUE);
    assert.equal(textOf(filled.document, 'city-twin'), CITY_VALUE);
    unchanged(filled.document, filled.stats);
  } finally { filled.dom.window.close(); }

  const reversed = await boot({
    hiddenSchoolText: true,
    hiddenSchoolTextFirst: true,
    school: SCHOOL_VALUE,
    city: CITY_VALUE,
    twinSelect: true
  });
  try {
    assert.equal(schoolItems(reversed.document).length, 2);
    assert.ok(reversed.document.querySelector('[data-field="school-text"]').compareDocumentPosition(reversed.document.querySelector('[data-field="school"]')) & reversed.window.Node.DOCUMENT_POSITION_FOLLOWING);
    const school = await reversed.api.fillField(SCHOOL, SCHOOL_VALUE);
    assert.equal(school.reason, 'preexisting_same_value', JSON.stringify(school));
    assert.equal(school.before, SCHOOL_VALUE);
    assert.equal(reversed.stats.open, 0);
    assert.equal(reversed.document.getElementById('school-text-input').value, '');
    unchanged(reversed.document, reversed.stats);
  } finally { reversed.dom.window.close(); }

  const attribute = await boot({
    hiddenSchoolTextAttr: true,
    school: SCHOOL_VALUE,
    city: CITY_VALUE
  });
  try {
    const rowNode = attribute.document.querySelector('[data-field="school-text"]');
    assert.equal(rowNode.hidden, true);
    assert.equal(rowNode.style.display, '');
    const school = await attribute.api.fillField(SCHOOL, SCHOOL_VALUE);
    assert.equal(school.reason, 'preexisting_same_value', JSON.stringify(school));
    assert.equal(attribute.stats.open, 0);
    assert.equal(attribute.document.getElementById('school-text-input').value, '');
    unchanged(attribute.document, attribute.stats);
  } finally { attribute.dom.window.close(); }

  const empty = await boot({
    hiddenSchoolText: true,
    fillPlaceholder: true,
    city: CITY_VALUE,
    twinSelect: true
  });
  try {
    const view = empty.api.inspect();
    assert.equal(view.ok, false);
    assert.equal(view.liveSupportClaimed, false);
    assert.equal(view.supportClaimed, false);
    assert.equal(view.fields[0].reason, 'control_not_supported');
    assert.equal(view.fields[0].value, '');
    assert.equal(view.fields[0].supported, false);
    assert.equal(view.fields[1].reason, 'structure_matched');
    assert.equal(view.fields[1].value, CITY_VALUE);
    const school = await empty.api.fillField(SCHOOL, SCHOOL_VALUE);
    const canceled = await empty.api.cancelField(SCHOOL);
    assert.equal(school.reason, 'control_not_supported', JSON.stringify(school));
    assert.equal(school.ok, false);
    assertNeverSaved(school);
    assert.equal(canceled.reason, 'control_not_supported');
    assert.equal(empty.stats.open, 0);
    assert.equal(empty.stats.option, 0);
    assert.equal(empty.document.getElementById('school-text-input').value, '');
    assert.equal(textOf(empty.document, 'school-value'), '');
    assert.equal(textOf(empty.document, 'city-value'), CITY_VALUE);
    unchanged(empty.document, empty.stats);
  } finally { empty.dom.window.close(); }
});

test('dual-face city, placeholder readback, and a closed search field stay fail-closed or verify', async () => {
  const plain = await boot({ twinSelect: true, school: SCHOOL_VALUE, city: PAIR.sameDisplay });
  try {
    const view = plain.api.inspect();
    assert.equal(view.fields[0].value, SCHOOL_VALUE);
    assert.equal(view.fields[1].value, CITY_VALUE);
    assert.equal(view.fields.every((field) => field.supported === false && field.reason === 'structure_matched'), true);
    const filled = await plain.api.fillFields({ [SCHOOL]: SCHOOL_VALUE, [CITY]: CITY_VALUE });
    assert.equal(filled.ok, true, JSON.stringify(filled.fields));
    assert.equal(filled.fields.every((field) => field.reason === 'preexisting_same_value'), true);
    assert.equal(plain.stats.open, 0);
    unchanged(plain.document, plain.stats);
  } finally { plain.dom.window.close(); }

  const mashed = await boot({
    twinSelect: true,
    cascaderMash: true,
    schoolMash: 'class',
    school: SCHOOL_VALUE,
    city: CITY_VALUE
  });
  try {
    const school = await mashed.api.fillField(SCHOOL, SCHOOL_VALUE);
    const city = await mashed.api.fillField(CITY, CITY_VALUE);
    assert.equal(school.reason, 'preexisting_same_value', JSON.stringify(school));
    assert.equal(school.before, SCHOOL_VALUE);
    assert.notEqual(school.before, `${LIVE.placeholderPrefix}${SCHOOL}${SCHOOL_VALUE}`);
    assert.equal(city.reason, 'preexisting_same_value', JSON.stringify(city));
    assert.equal(city.before, CITY_VALUE);
    assert.equal(mashed.stats.open, 0);
    unchanged(mashed.document, mashed.stats);
  } finally { mashed.dom.window.close(); }

  const text = await boot({ textMash: true, schoolMash: 'text', school: SCHOOL_VALUE, city: CITY_VALUE });
  try {
    const school = await text.api.fillField(SCHOOL, SCHOOL_VALUE);
    const city = await text.api.fillField(CITY, CITY_VALUE);
    assert.equal(school.reason, 'preexisting_same_value', JSON.stringify(school));
    assert.equal(school.before, SCHOOL_VALUE);
    assert.equal(city.before, CITY_VALUE);
    assert.equal(textOf(text.document, 'school-value').includes(LIVE.placeholderPrefix), true);
    assert.equal(textOf(text.document, 'city-value').includes(PAIR.placeholderPrefix), true);
    assert.equal(text.stats.open, 0);
    unchanged(text.document, text.stats);
  } finally { text.dom.window.close(); }

  const painted = await boot({ cascaderMash: true, schoolMash: 'class' });
  try {
    const school = await painted.api.fillField(SCHOOL, SCHOOL_VALUE);
    const city = await painted.api.fillField(CITY, CITY_VALUE);
    assert.equal(school.reason, 'readback_matched', JSON.stringify(school));
    assert.equal(school.after, SCHOOL_VALUE);
    assert.equal(city.reason, 'readback_matched', JSON.stringify(city));
    assert.equal(city.after, CITY_VALUE);
    assert.equal(city.stillOpen, 0);
    assert.equal(painted.document.querySelector('#school-select .ant-select-selection-selected-value').textContent, SCHOOL_VALUE);
    assert.equal(painted.document.querySelector('#school-select .ant-select-selection__placeholder').textContent, `${LIVE.placeholderPrefix}${SCHOOL}`);
    assert.equal(painted.document.querySelector('#city-select .ant-select-selection-selected-value').textContent, CITY_VALUE);
    assert.equal(painted.document.querySelector('#city-select .ant-select-selection__placeholder').textContent, `${PAIR.placeholderPrefix}${CITY}`);
    unchanged(painted.document, painted.stats);
  } finally { painted.dom.window.close(); }

  const prompt = await boot({ placeholderOnly: true, school: '' });
  try {
    const view = prompt.api.inspect();
    assert.equal(view.fields[1].reason, 'structure_matched');
    assert.equal(view.fields[1].value, '');
    const city = await prompt.api.fillField(CITY, CITY_VALUE);
    assert.equal(city.reason, 'readback_matched', JSON.stringify(city));
    assert.equal(city.before, '');
    assert.equal(city.after, CITY_VALUE);
    unchanged(prompt.document, prompt.stats);
  } finally { prompt.dom.window.close(); }

  const children = await boot({ fillPlaceholder: true, school: SCHOOL_VALUE, city: CITY_VALUE });
  try {
    const school = await children.api.fillField(SCHOOL, SCHOOL_VALUE);
    assert.equal(school.reason, 'preexisting_same_value', JSON.stringify(school));
    assert.equal(school.before, SCHOOL_VALUE);
    assert.notEqual(school.before, probe.school.childrenTextSample);
    assert.equal(children.document.querySelector('#school-select .ant-select-selection__placeholder').textContent, FILL_PREFIX);
    assert.equal(children.stats.open, 0);
    unchanged(children.document, children.stats);
  } finally { children.dom.window.close(); }

  const closed = await boot({ closedSearch: true });
  try {
    const school = await closed.api.fillField(SCHOOL, SCHOOL_VALUE);
    assert.equal(school.reason, 'readback_matched', JSON.stringify(school));
    assert.equal(school.after, SCHOOL_VALUE);
    assert.equal(school.stillOpen, 0);
    assertNeverSaved(school);
    assert.equal(closed.stats.open, 1);
    assert.equal(closed.stats.option, 1);
    assert.equal(closed.stats.triggerClass, '');
    assert.equal(closed.stats.faceClass, LIVE.faceClass);
    assert.equal(closed.document.getElementById('school-menu').hidden, true);
    unchanged(closed.document, closed.stats);
  } finally { closed.dom.window.close(); }

  const same = await boot({ sameSchool: true, sameCity: true, wrapSchool: true, school: SCHOOL_VALUE, city: CITY_VALUE, twinSelect: true });
  try {
    const view = same.api.inspect();
    assert.equal(view.ok, true, JSON.stringify(view.fields));
    assert.equal(view.fields[0].value, SCHOOL_VALUE);
    assert.equal(view.fields[1].value, CITY_VALUE);
    const school = await same.api.fillField(SCHOOL, SCHOOL_VALUE);
    assert.equal(school.reason, 'preexisting_same_value');
    assert.equal(same.stats.open, 0);
    unchanged(same.document, same.stats);
  } finally { same.dom.window.close(); }
});

test('one field can be painted while the other already matches', async () => {
  const schoolOnly = await boot({ city: CITY_VALUE, twinSelect: true });
  try {
    const school = await schoolOnly.api.fillField(SCHOOL, SCHOOL_VALUE);
    assert.equal(school.reason, 'readback_matched', JSON.stringify(school));
    assert.equal(textOf(schoolOnly.document, 'city-value'), CITY_VALUE);
    assert.equal(textOf(schoolOnly.document, 'city-twin'), CITY_VALUE);
    assert.deepEqual(schoolOnly.stats.openedIds, ['school-select']);
    unchanged(schoolOnly.document, schoolOnly.stats);
  } finally { schoolOnly.dom.window.close(); }

  const cityOnly = await boot({ school: SCHOOL_VALUE });
  try {
    const city = await cityOnly.api.fillField(CITY, CITY_VALUE);
    assert.equal(city.reason, 'readback_matched', JSON.stringify(city));
    assert.equal(textOf(cityOnly.document, 'school-value'), SCHOOL_VALUE);
    assert.deepEqual(cityOnly.stats.openedIds, ['city-select']);
    unchanged(cityOnly.document, cityOnly.stats);
  } finally { cityOnly.dom.window.close(); }
});

test('a hidden page fails closed before a click', async () => {
  const h = await boot({});
  try {
    Object.defineProperty(h.document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    const school = await h.api.fillField(SCHOOL, SCHOOL_VALUE);
    const city = await h.api.fillField(CITY, CITY_VALUE);
    assert.equal(school.reason, 'fill_interrupted_page_hidden');
    assert.equal(city.reason, 'fill_interrupted_page_hidden');
    assertNeverSaved(school);
    assert.equal(h.stats.open, 0);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('an open menu blocks the other field', async () => {
  const h = await boot({ busySchool: true, city: '' });
  try {
    const city = await h.api.fillField(CITY, CITY_VALUE);
    const school = await h.api.fillField(SCHOOL, SCHOOL_VALUE);
    assert.equal(city.reason, 'control_busy');
    assert.equal(school.reason, 'control_busy');
    assert.equal(h.stats.option, 0);
    assert.equal(h.stats.open, 0);
    assert.equal(textOf(h.document, 'city-value'), '');
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('inspect on the wrong page does not claim support', async () => {
  const h = await boot({ elForm: true, school: SCHOOL_VALUE, city: CITY_VALUE });
  try {
    const view = h.api.inspect();
    assert.equal(view.ok, false);
    assert.equal(view.reason, 'wrong_page');
    assert.equal(view.fields.length, 0);
    assert.equal(view.liveSupportClaimed, false);
    assert.equal(view.supportClaimed, false);
    assert.equal(h.api.liveSupportClaimed, false);
    assert.equal(h.api.supportClaimed, false);
  } finally { h.dom.window.close(); }
});
