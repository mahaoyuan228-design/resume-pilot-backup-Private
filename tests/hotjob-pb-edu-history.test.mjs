// Offline Never-Save trials for hotjob pb education-history 学校, 城市,
// 学位, 学历, 专业名称, and 专业排名.
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
const DEGREE = probe.degree.label;
const LEVEL = probe.level.label;
const MAJOR = probe.major.label;
const RANK = probe.rank.label;
const SCHOOL_VALUE = probe.school.valueSample;
const CITY_VALUE = probe.city.valueSample;
const DEGREE_VALUE = probe.degree.valueSample;
const LEVEL_VALUE = probe.level.valueSample;
const MAJOR_VALUE = probe.major.valueSample;
const RANK_VALUE = probe.rank.valueSample;
const FORBIDDEN = probe.page.forbiddenButtons;
const OUT = probe.outOfScope;
const LIVE = probe.school.liveReadback;
const PAIR = probe.city.livePair;
const FILL_PREFIX = probe.school.childrenTextSample.slice(0, probe.school.childrenTextSample.length - SCHOOL_VALUE.length);
const OTHER = 'NOT_IN_MENU';
const HISTORY_FILLED = Object.freeze({
  degree: DEGREE_VALUE,
  level: LEVEL_VALUE,
  major: MAJOR_VALUE,
  rank: RANK_VALUE
});

function compact(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/gu, '')
    .replace(/[\s\u00a0]+/gu, '')
    .trim();
}

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
  if (state.dropSchool) return '';
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
  if (state.dropCity) return '';
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

function flatMenu(key, label, value, options, flags = {}) {
  const disabled = flags.disabled ? ' ant-select-disabled' : '';
  const selectClass = `${flags.dropAllowClear ? probe.city.controlClass : probe.school.controlClass}${disabled}`;
  const trigger = flags.dropSearch ? '' : `<input class="${esc(probe.school.triggerClass)}" type="text" value="">`;
  const valueId = `${key}-value`;
  let inner;
  if (flags.ambiguous) {
    inner = `<span class="${esc(LIVE.selectedValueClass)}">${esc(value || '甲')}</span><span class="${esc(LIVE.selectedValueClass)}">乙</span>`;
  } else if (flags.mash === 'class') {
    inner = `<span class="${esc(LIVE.placeholderClass)}">${esc(`${LIVE.placeholderPrefix}${label}`)}</span><span class="${esc(LIVE.selectedValueClass)}" id="${esc(valueId)}">${esc(value)}</span>`;
  } else if (flags.mash === 'text') {
    inner = `<span id="${esc(valueId)}">${esc(`${LIVE.placeholderPrefix}${label}${value}`)}</span>`;
  } else {
    inner = `<span id="${esc(valueId)}">${esc(value)}</span>`;
  }
  const faced = flags.closedSearch || flags.mash === 'class'
    ? `<div class="${esc(LIVE.faceClass)}" role="${esc(LIVE.faceRole)}">${inner}</div>`
    : inner;
  const hidden = flags.hidden ? ' hidden' : '';
  const extra = flags.extraSelect
    ? `<div class="${esc(probe.school.controlClass)}"><span></span><input class="${esc(probe.school.triggerClass)}" type="text" value=""></div>`
    : '';
  const control = `<div class="${esc(selectClass)}" id="${esc(key)}-select"${hidden}>${faced}${trigger}</div>${extra}`;
  const dropdownClass = flags.badDropdown
    ? 'ant-select-dropdown ant-select-dropdown-placement-bottomLeft'
    : probe.school.dropdownClass;
  let body = '';
  if (flags.saveOption) body = `<li><button type="button">${esc(FORBIDDEN[0])}</button></li>`;
  else if (!flags.emptyMenu) {
    const rows = [...options];
    if (flags.duplicateOption) {
    const sample = options.find(Boolean) || value;
    if (sample) rows.push(sample);
  }
    body = rows.map((text) => `<li>${esc(text)}</li>`).join('');
  }
  const menu = `<div class="${esc(dropdownClass)}" id="${esc(key)}-select-menu" hidden><ul>${body}</ul></div>`;
  return { control, menu };
}

function selectFlags(state, key) {
  return {
    disabled: !!state[`${key}Disabled`],
    dropAllowClear: !!state[`${key}DropAllowClear`],
    dropSearch: !!state[`${key}DropSearch`],
    hidden: !!state[`${key}Hidden`],
    extraSelect: !!state[`${key}ExtraSelect`],
    ambiguous: !!state[`${key}Ambiguous`],
    mash: state[`${key}Mash`] || '',
    closedSearch: !!state[`${key}ClosedSearch`],
    badDropdown: !!state[`${key}BadDropdown`],
    emptyMenu: !!state[`${key}EmptyMenu`],
    duplicateOption: !!state[`${key}DuplicateOption`],
    saveOption: !!state[`${key}SaveOption`]
  };
}

function historySelect(key, label, value, options, state) {
  if (state[`${key}AsText`]) {
    return row(key, label, `<input id="${esc(key)}-input" class="${esc(probe.text.controlClass)}" type="text" value="${esc(value)}">`, state);
  }
  const stray = [
    state[`${key}StrayText`] ? `<input class="${esc(probe.text.controlClass)}" type="text" value="">` : '',
    state[`${key}StrayRadio`] ? '<input class="ant-radio-input" type="radio">' : '',
    state[`${key}StrayFile`] ? '<input type="file">' : ''
  ].join('');
  const built = flatMenu(key, label, value, options, selectFlags(state, key));
  return row(key, label, `${stray}${built.control}`, state, {
    extraLabel: state[`${key}Disagree`] ? OUT.graduation.label : '',
    wrapControl: !!state[`${key}Wrap`]
  }) + built.menu;
}

function basicSelect(key, label, value, state) {
  const shown = state.hintInSelect && key === 'basic-degree' ? probe.section.hint : value;
  const built = flatMenu(key, label, shown, [shown], {});
  return row(key, label, built.control, state) + built.menu;
}

function hintMarkup(state) {
  if (state.dropHint || state.hintInSelect) return '';
  const text = state.hintText || probe.section.hint;
  const second = state.secondHint ? `<p id="edu-history-hint-2">${esc(text)}</p>` : '';
  return `<p id="edu-history-hint">${esc(text)}</p>${second}`;
}

function degreeBlock(state) {
  if (state.dropDegree) return '';
  return historySelect('degree', DEGREE, state.degree ?? '', probe.degree.optionsSample, state);
}

function levelBlock(state) {
  if (state.dropLevel) return '';
  return historySelect('level', LEVEL, state.level ?? '', probe.level.optionsSample, state);
}

function rankBlock(state) {
  if (state.dropRank) return '';
  return historySelect('rank', RANK, state.rank ?? '', probe.rank.optionsSample, state);
}

function majorField(state) {
  const value = state.major ?? '';
  if (state.dropMajor) return '';
  if (state.majorAsSelect) {
    const built = flatMenu('major', MAJOR, value, [value || '甲'], {});
    return row('major', MAJOR, built.control, state) + built.menu;
  }
  const placeholder = Object.hasOwn(state, 'majorPlaceholder') ? state.majorPlaceholder : probe.major.placeholder;
  const readonly = state.majorReadonly ? ' readonly' : '';
  const disabled = state.majorDisabled ? ' disabled' : '';
  const type = state.majorTypeNumber ? 'number' : probe.major.inputType;
  const className = state.majorDropClass ? 'plain-input' : probe.major.controlClass;
  const extra = state.majorExtra ? `<input class="${esc(probe.text.controlClass)}" type="text" value="MAJOR_EXTRA">` : '';
  const area = state.majorTextarea ? `<textarea class="${esc(probe.text.controlClass)}"></textarea>` : '';
  const holder = placeholder ? ` placeholder="${esc(placeholder)}"` : '';
  const input = `<input id="major-input" class="${esc(className)}" type="${esc(type)}"${holder}${readonly}${disabled} value="${esc(value)}">`;
  return row('major', MAJOR, `${input}${extra}${area}`, state, {
    hidden: !!state.majorHidden,
    extraLabel: state.majorDisagree ? OUT.graduation.label : '',
    wrapControl: !!state.majorWrap
  });
}

function duplicateFlat(state, flag, key, label, value, options) {
  if (!state[flag]) return '';
  const built = flatMenu(key, label, value, options, {});
  return row(key, label, built.control, state) + built.menu;
}

function html(state) {
  const rootClass = state.dropRoot ? 'page-root' : probe.page.rootClass;
  const shell = [
    state.elForm ? '<div class="el-form"></div>' : '',
    state.mcList ? '<div class="my-list-item"></div>' : ''
  ].join('');
  const buttons = [...probe.page.buttonLabels, ...FORBIDDEN.filter((label) => !probe.page.buttonLabels.includes(label))]
    .map((label) => `<button type="button">${esc(label)}</button>`).join('');
  const description = row('description', OUT.description.label, `<textarea id="description-input" class="${esc(probe.text.controlClass)}" placeholder="${esc(OUT.description.placeholder)}">${esc(state.description ?? OUT.description.token)}</textarea>`, {}, { noStar: true });
  const hint = hintMarkup(state);
  const hintEarly = state.hintBeforeBasic ? hint : '';
  const hintMid = !state.hintBeforeBasic && !state.hintAfterFields ? hint : '';
  const hintLate = state.hintAfterFields ? hint : '';
  const degreeEarly = state.degreeBeforeCity ? degreeBlock(state) : '';
  const degree = state.degreeBeforeCity ? '' : degreeBlock(state);
  return `<!doctype html><body>${shell}<div class="${esc(rootClass)}"><div class="${esc(probe.page.contentClass)}">${
    tokenRow('email', OUT.email.label, OUT.email.token)
  }${residenceField()
  }${tokenRow('origin', OUT.origin.label, OUT.origin.token)
  }${tokenRow('graduation', OUT.graduation.label, OUT.graduation.token)
  }${hintEarly
  }${basicSelect('basic-degree', OUT.basicDegree.label, OUT.basicDegree.token, state)
  }${basicSelect('basic-level', OUT.basicLevel.label, OUT.basicLevel.token, state)
  }${textRow('basic-major', OUT.basicMajor.label, 'basic-major-input', state.basicMajor ?? OUT.basicMajor.token, OUT.basicMajor.placeholder)
  }${hintMid
  }${row('start', OUT.start.label, `<input id="start-input" class="${esc(OUT.start.controlClass)}" type="text" readonly value="${esc(OUT.start.token)}">`, {})
  }${schoolBlock(state)
  }${degreeEarly
  }${cityField(state.city ?? '', state)
  }${duplicateSchool(state)
  }${duplicateCity(state)
  }${degree
  }${levelBlock(state)
  }${majorField(state)
  }${description
  }${rankBlock(state)
  }${duplicateFlat(state, 'duplicateDegree', 'degree-copy', DEGREE, state.degreeCopy ?? '', probe.degree.optionsSample)
  }${duplicateFlat(state, 'duplicateLevel', 'level-copy', LEVEL, '', probe.level.optionsSample)
  }${duplicateFlat(state, 'duplicateRank', 'rank-copy', RANK, '', probe.rank.optionsSample)
  }${state.duplicateMajor ? row('major-copy', MAJOR, `<input id="major-copy-input" class="${esc(probe.major.controlClass)}" type="text" placeholder="${esc(probe.major.placeholder)}" value="">`, state) : ''
  }${hintLate
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
  for (const menu of document.querySelectorAll('.ant-select-dropdown, .cascader-plugins-wrap ul')) hide(menu, true);
}

function menuFor(document, select) {
  const wrap = select.closest('.cascader-plugins-wrap');
  if (wrap) return wrap.querySelector('ul');
  return document.getElementById(`${select.id}-menu`)
    || (select.id === 'school-select' ? document.getElementById('school-menu') : null);
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
  const wiredMenus = new Set();
  for (const select of document.querySelectorAll('.ant-select')) {
    const menu = menuFor(document, select);
    select.addEventListener('click', (event) => {
      if (menu && menu.contains(event.target)) return;
      stats.open += 1;
      stats.openedIds.push(select.id || 'anon');
      if (event.target.classList?.contains(probe.school.triggerClass)) stats.triggerClass = probe.school.triggerClass;
      if (event.target.closest?.(`.${LIVE.faceClass}`)) stats.faceClass = LIVE.faceClass;
      select.classList.add(...classes(probe.school.openClass));
      stats.openClass = select.className;
      if (menu) hide(menu, false);
    });
    if (!menu || wiredMenus.has(menu)) continue;
    wiredMenus.add(menu);
    menu.addEventListener('click', (event) => {
      const li = event.target.closest('li');
      if (!li || !menu.contains(li)) return;
      stats.option += 1;
      const wrap = menu.closest('.cascader-plugins-wrap');
      const target = wrap
        ? (wrap.querySelector('.ant-select.ant-select-open') || wrap.querySelector('.ant-select'))
        : select;
      const slot = target?.querySelector('.ant-select-selection-selected-value, [id$="-value"]') || target?.querySelector('span');
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
  if (state.busyDegree && document.getElementById('degree-select')) {
    const select = document.getElementById('degree-select');
    select.classList.add('ant-select-open', 'ant-select-focused');
    hide(document.getElementById('degree-select-menu'), false);
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

function unchanged(document, stats, history = {}) {
  assert.equal(textOf(document, 'email-token'), OUT.email.token);
  assert.equal(textOf(document, 'residence-value'), OUT.residence.token);
  assert.equal(textOf(document, 'origin-token'), OUT.origin.token);
  assert.equal(textOf(document, 'graduation-token'), OUT.graduation.token);
  assert.equal(textOf(document, 'basic-degree-value'), history.basicDegree ?? OUT.basicDegree.token);
  assert.equal(textOf(document, 'basic-level-value'), history.basicLevel ?? OUT.basicLevel.token);
  assert.equal(document.getElementById('basic-major-input').value, history.basicMajor ?? OUT.basicMajor.token);
  assert.equal(document.getElementById('start-input').value, OUT.start.token);
  assert.ok(document.getElementById('degree-value'));
  assert.equal(textOf(document, 'degree-value'), history.degree ?? '');
  assert.ok(document.getElementById('level-value'));
  assert.equal(textOf(document, 'level-value'), history.level ?? '');
  assert.ok(document.getElementById('major-input'));
  assert.equal(document.getElementById('major-input').value, history.major ?? '');
  assert.ok(document.getElementById('rank-value'));
  assert.equal(textOf(document, 'rank-value'), history.rank ?? '');
  assert.equal(document.getElementById('description-input').value, history.description ?? '');
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
    CITY,
    DEGREE,
    LEVEL,
    MAJOR,
    RANK,
    probe.section.anchor,
    probe.major.placeholder
  ]) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  }
  assert.match(source, /专业描述/);
  assert.doesNotMatch(source, /学士|本科|无排名|Economics|金融学|硕士研究生/);
  assert.doesNotMatch(source, /硕士/);
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
  for (const label of [SCHOOL, CITY, OUT.graduation.label, DEGREE, LEVEL, MAJOR, OUT.description.label, RANK, OUT.residence.label, OUT.email.label, OUT.basicDegree.label]) {
    assert.match(built, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  }
  assert.match(built, new RegExp(probe.section.hint.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  assert.match(built, new RegExp(probe.major.placeholder.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  for (const option of [DEGREE_VALUE, LEVEL_VALUE, RANK_VALUE, OUT.basicDegree.token, OUT.basicLevel.token]) {
    assert.match(built, new RegExp(`>${option}<`));
  }
  assert.match(built, new RegExp(`value="${OUT.basicMajor.token}"`));
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

test('inspect matches the education-history row and does not claim support', async () => {
  const h = await boot({
    url: `${PAGE}?lang=1`,
    school: SCHOOL_VALUE,
    city: CITY_VALUE,
    twinSelect: true,
    fillPlaceholder: true,
    ...HISTORY_FILLED
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
    assert.equal(view.fields.length, 6);
    assert.equal(view.fields.every((field) => field.supported === false), true);
    assert.deepEqual(Array.from(view.fields, (field) => field.label), [SCHOOL, CITY, DEGREE, LEVEL, MAJOR, RANK]);
    assert.deepEqual(Array.from(view.fields, (field) => field.kind), ['select', 'cascader', 'select', 'select', 'text', 'select']);
    assert.equal(view.fields.every((field) => field.reason === 'structure_matched'), true);
    assert.equal(view.fields[0].value, SCHOOL_VALUE);
    assert.equal(view.fields[1].value, CITY_VALUE);
    assert.equal(view.fields[2].value, DEGREE_VALUE);
    assert.equal(view.fields[3].value, LEVEL_VALUE);
    assert.equal(view.fields[4].value, compact(MAJOR_VALUE));
    assert.equal(view.fields[5].value, RANK_VALUE);
    assert.notEqual(view.fields[0].value, probe.school.childrenTextSample);
    assert.notEqual(view.fields[2].value, OUT.basicDegree.token);
    assert.notEqual(view.fields[3].value, OUT.basicLevel.token);
    assert.notEqual(view.fields[4].value, compact(OUT.basicMajor.token));
    assert.equal(h.document.getElementById('major-input').value, MAJOR_VALUE);
    assert.equal(h.stats.open, 0);
    unchanged(h.document, h.stats, HISTORY_FILLED);
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

test('fillFields reads back the education-history row and leaves the basic block untouched', async () => {
  const h = await boot({ description: '' });
  try {
    const filled = await h.api.fillFields({
      [SCHOOL]: SCHOOL_VALUE,
      [CITY]: CITY_VALUE,
      [DEGREE]: DEGREE_VALUE,
      [LEVEL]: LEVEL_VALUE,
      [MAJOR]: ` \u200b${MAJOR_VALUE} `,
      [RANK]: RANK_VALUE,
      [OUT.description.label]: 'SHOULD_NOT_WRITE'
    });
    assert.equal(filled.ok, true, JSON.stringify(filled.fields));
    assertNeverSaved(filled);
    assert.equal(filled.fields.length, 6);
    assert.equal(filled.fields.map((field) => field.reason).join(','), [
      'readback_matched', 'readback_matched', 'readback_matched',
      'readback_matched', 'readback_matched', 'readback_matched'
    ].join(','));
    assert.equal(filled.fields[4].after, compact(MAJOR_VALUE));
    assert.equal(textOf(h.document, 'school-value'), SCHOOL_VALUE);
    assert.equal(textOf(h.document, 'city-value'), CITY_VALUE);
    assert.equal(textOf(h.document, 'degree-value'), DEGREE_VALUE);
    assert.equal(textOf(h.document, 'level-value'), LEVEL_VALUE);
    assert.equal(h.document.getElementById('major-input').value, MAJOR_VALUE);
    assert.equal(textOf(h.document, 'rank-value'), RANK_VALUE);
    assert.equal(h.document.getElementById('description-input').value, '');
    assert.deepEqual(h.stats.openedIds, ['school-select', 'city-select', 'degree-select', 'level-select', 'rank-select']);
    assert.equal(h.stats.openedIds.includes('basic-degree-select'), false);
    assert.equal(h.stats.openedIds.includes('basic-level-select'), false);
    unchanged(h.document, h.stats, HISTORY_FILLED);
  } finally { h.dom.window.close(); }
});

test('a filled page verifies without opening a menu', async () => {
  const h = await boot({
    school: SCHOOL_VALUE,
    city: CITY_VALUE,
    twinSelect: true,
    ...HISTORY_FILLED
  });
  try {
    const filled = await h.api.fillFields({
      [SCHOOL]: ` ${SCHOOL_VALUE} `,
      [CITY]: CITY_VALUE,
      [DEGREE]: DEGREE_VALUE,
      [LEVEL]: ` ${LEVEL_VALUE} `,
      [MAJOR]: ` ${MAJOR_VALUE} `,
      [RANK]: RANK_VALUE,
      [OUT.description.label]: 'SHOULD_NOT_WRITE'
    });
    assert.equal(filled.ok, true, JSON.stringify(filled.fields));
    assert.equal(filled.fields.every((field) => field.reason === 'preexisting_same_value'), true);
    assert.equal(filled.fields.every((field) => field.status === 'verified'), true);
    assert.equal(filled.fields.every((field) => field.opened === false), true);
    assert.equal(filled.fields[0].before, SCHOOL_VALUE);
    assert.equal(filled.fields[1].before, CITY_VALUE);
    assert.equal(filled.fields[1].after, CITY_VALUE);
    assert.equal(filled.fields[2].before, DEGREE_VALUE);
    assert.equal(filled.fields[4].before, compact(MAJOR_VALUE));
    assert.equal(h.document.getElementById('major-input').value, MAJOR_VALUE);
    assertNeverSaved(filled);
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.option, 0);
    assert.equal(textOf(h.document, 'school-value'), SCHOOL_VALUE);
    assert.equal(textOf(h.document, 'city-value'), CITY_VALUE);
    assert.equal(textOf(h.document, 'city-twin'), CITY_VALUE);
    assert.equal(h.document.getElementById('description-input').value, '');
    unchanged(h.document, h.stats, HISTORY_FILLED);
  } finally { h.dom.window.close(); }
});

test('a different existing value is kept and the menu stays closed', async () => {
  const h = await boot({ school: SCHOOL_VALUE, city: CITY_VALUE, ...HISTORY_FILLED });
  try {
    const school = await h.api.fillField(SCHOOL, OTHER);
    const city = await h.api.fillField(CITY, OTHER);
    const degree = await h.api.fillField(DEGREE, OTHER);
    const level = await h.api.fillField(LEVEL, OTHER);
    const major = await h.api.fillField(MAJOR, 'Other Major');
    const rank = await h.api.fillField(RANK, OTHER);
    assert.equal(school.reason, 'existing_value');
    assert.equal(school.status, 'skipped');
    assert.equal(school.ok, false);
    assert.equal(school.opened, false);
    assert.equal(school.after, SCHOOL_VALUE);
    assert.equal(city.reason, 'existing_value');
    assert.equal(city.ok, false);
    assert.equal(degree.reason, 'existing_value');
    assert.equal(degree.after, DEGREE_VALUE);
    assert.equal(level.reason, 'existing_value');
    assert.equal(major.reason, 'existing_value');
    assert.equal(major.opened, false);
    assert.equal(major.after, compact(MAJOR_VALUE));
    assert.equal(rank.reason, 'existing_value');
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.option, 0);
    assert.equal(textOf(h.document, 'school-value'), SCHOOL_VALUE);
    assert.equal(textOf(h.document, 'city-value'), CITY_VALUE);
    assert.equal(h.document.getElementById('major-input').value, MAJOR_VALUE);
    unchanged(h.document, h.stats, HISTORY_FILLED);
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
      OUT.description.label,
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
    const described = await h.api.fillField(OUT.description.label, '');
    assert.equal(described.reason, 'label_not_allowed');
    assert.equal(h.document.getElementById('description-input').value, '');
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
    assert.equal(result.fields[0].reason, 'preexisting_same_value', JSON.stringify(result.fields));
    assert.equal(result.fields[1].reason, 'preexisting_same_value');
    assert.equal(result.fields.slice(2).every((field) => field.reason === 'missing_profile_value'), true);
    assert.equal(result.fields.every((field) => field.opened === false), true);
    assert.equal(result.ok, false);
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
    assert.equal(filled.fields[0].reason, 'preexisting_same_value', JSON.stringify(filled.fields));
    assert.equal(filled.fields[1].reason, 'preexisting_same_value');
    assert.equal(filled.fields.slice(2).every((field) => field.reason === 'missing_profile_value'), true);
    assert.equal(filled.fields.every((field) => field.opened === false), true);
    assert.equal(filled.ok, false);
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

test('education-history degree, level, major, and rank do not cross-fill the basic block', async () => {
  const h = await boot({});
  try {
    const degree = await h.api.fillField(DEGREE, OUT.basicDegree.token);
    const level = await h.api.fillField(LEVEL, OUT.basicLevel.token);
    const major = await h.api.fillField(MAJOR, OUT.basicMajor.token);
    assert.equal(degree.reason, 'option_not_found', JSON.stringify(degree));
    assert.equal(degree.before, '');
    assert.equal(degree.after, '');
    assert.equal(degree.stillOpen, 0);
    assert.equal(level.reason, 'option_not_found', JSON.stringify(level));
    assert.equal(level.before, '');
    assert.equal(major.reason, 'readback_matched', JSON.stringify(major));
    assert.equal(major.before, '');
    assert.equal(major.opened, false);
    assert.equal(h.document.getElementById('major-input').value, OUT.basicMajor.token);
    assert.deepEqual(h.stats.openedIds, ['degree-select', 'level-select']);
    assert.equal(textOf(h.document, 'basic-degree-value'), OUT.basicDegree.token);
    assert.equal(textOf(h.document, 'basic-level-value'), OUT.basicLevel.token);
    assert.equal(h.document.getElementById('basic-major-input').value, OUT.basicMajor.token);
    const painted = await h.api.fillFields({
      [SCHOOL]: SCHOOL_VALUE,
      [CITY]: CITY_VALUE,
      [DEGREE]: DEGREE_VALUE,
      [LEVEL]: LEVEL_VALUE,
      [MAJOR]: OUT.basicMajor.token,
      [RANK]: RANK_VALUE
    });
    assert.equal(painted.fields.find((field) => field.label === DEGREE).reason, 'readback_matched');
    assert.equal(painted.fields.find((field) => field.label === LEVEL).reason, 'readback_matched');
    assert.equal(painted.fields.find((field) => field.label === RANK).reason, 'readback_matched');
    assert.equal(painted.fields.find((field) => field.label === MAJOR).reason, 'preexisting_same_value');
    assert.equal(textOf(h.document, 'degree-value'), DEGREE_VALUE);
    assert.equal(textOf(h.document, 'level-value'), LEVEL_VALUE);
    assert.equal(textOf(h.document, 'rank-value'), RANK_VALUE);
    assert.notEqual(DEGREE_VALUE, OUT.basicDegree.token);
    assert.notEqual(LEVEL_VALUE, OUT.basicLevel.token);
    assert.equal(h.document.getElementById('description-input').value, '');
    assert.equal(h.stats.openedIds.includes('basic-degree-select'), false);
    assert.equal(h.stats.openedIds.includes('basic-level-select'), false);
    unchanged(h.document, h.stats, {
      degree: DEGREE_VALUE,
      level: LEVEL_VALUE,
      major: OUT.basicMajor.token,
      rank: RANK_VALUE
    });
  } finally { h.dom.window.close(); }
});

test('Escape closes 学位 and 专业排名 and a text row cannot be canceled', async () => {
  const h = await boot({ degree: DEGREE_VALUE, rank: '' });
  try {
    const degree = await h.api.cancelField(DEGREE);
    assert.equal(degree.ok, true, JSON.stringify(degree));
    assert.equal(degree.reason, 'menu_closed');
    assert.equal(degree.canceled, true);
    assert.equal(degree.stillOpen, 0);
    assert.equal(degree.before, DEGREE_VALUE);
    assert.equal(degree.after, DEGREE_VALUE);
    assertNeverSaved(degree);
    const rank = await h.api.cancelField(RANK);
    assert.equal(rank.reason, 'menu_closed');
    assert.equal(rank.after, '');
    assert.equal(rank.canceled, true);
    assert.equal(h.document.getElementById('degree-select-menu').hidden, true);
    assert.equal(h.document.getElementById('rank-select-menu').hidden, true);
    assert.equal(h.document.querySelectorAll('.ant-select-open').length, 0);
    const major = await h.api.cancelField(MAJOR);
    assert.equal(major.reason, 'cancel_not_applicable');
    assert.equal(major.opened, false);
    assert.equal(major.canceled, false);
    assert.equal(h.document.getElementById('major-input').value, '');
    assert.ok(h.stats.escape >= 1);
    assert.equal(h.stats.option, 0);
    unchanged(h.document, h.stats, { degree: DEGREE_VALUE });
  } finally { h.dom.window.close(); }
});

test('missing, duplicate, and forbidden education-history options fail closed', async () => {
  const missing = await boot({});
  try {
    const degree = await missing.api.fillField(DEGREE, OTHER);
    const rank = await missing.api.fillField(RANK, OTHER);
    assert.equal(degree.reason, 'option_not_found', JSON.stringify(degree));
    assert.equal(degree.after, '');
    assert.equal(degree.stillOpen, 0);
    assert.equal(rank.reason, 'option_not_found');
    assert.equal(rank.after, '');
    assert.equal(missing.stats.option, 0);
    unchanged(missing.document, missing.stats);
  } finally { missing.dom.window.close(); }

  const ambiguous = await boot({ degreeDuplicateOption: true, rankDuplicateOption: true, degree: '', rank: '' });
  try {
    const degree = await ambiguous.api.fillField(DEGREE, DEGREE_VALUE);
    const rank = await ambiguous.api.fillField(RANK, RANK_VALUE);
    assert.equal(degree.reason, 'ambiguous_option', JSON.stringify(degree));
    assert.equal(degree.after, '');
    assert.equal(rank.reason, 'ambiguous_option');
    assert.equal(rank.after, '');
    assert.equal(ambiguous.stats.option, 0);
    unchanged(ambiguous.document, ambiguous.stats);
  } finally { ambiguous.dom.window.close(); }

  const blocked = await boot({ degreeSaveOption: true, rankSaveOption: true });
  try {
    const degree = await blocked.api.fillField(DEGREE, FORBIDDEN[0]);
    const rank = await blocked.api.fillField(RANK, FORBIDDEN[0]);
    assert.equal(degree.reason, 'never_save', JSON.stringify(degree));
    assert.equal(degree.canceled, true);
    assert.equal(degree.stillOpen, 0);
    assert.equal(rank.reason, 'never_save');
    assert.equal(blocked.stats.forbidden, 0);
    assert.equal(blocked.stats.option, 0);
    assert.equal(textOf(blocked.document, 'degree-value'), '');
    assert.equal(textOf(blocked.document, 'rank-value'), '');
    unchanged(blocked.document, blocked.stats);
  } finally { blocked.dom.window.close(); }
});

test('section drift fails closed and does not paint the basic block', async () => {
  const blocked = [
    { dropHint: true },
    { secondHint: true },
    { hintAfterFields: true },
    { hintText: '教育经历' },
    { hintInSelect: true },
    { dropSchool: true },
    { dropCity: true },
    { onlyHiddenSchoolText: true },
    { duplicateSchool: true, school: SCHOOL_VALUE },
    { duplicateCity: true, city: CITY_VALUE }
  ];
  for (const state of blocked) {
    const h = await boot(state);
    try {
      const degree = await h.api.fillField(DEGREE, DEGREE_VALUE);
      const level = await h.api.fillField(LEVEL, LEVEL_VALUE);
      const major = await h.api.fillField(MAJOR, MAJOR_VALUE);
      const rank = await h.api.fillField(RANK, RANK_VALUE);
      for (const rowResult of [degree, level, major, rank]) {
        assert.equal(rowResult.ok, false, JSON.stringify({ state, rowResult }));
        assert.equal(rowResult.reason, 'control_not_supported', JSON.stringify({ state, rowResult }));
        assert.equal(rowResult.liveSupportClaimed, false);
        assert.equal(rowResult.supportClaimed, false);
      }
      assert.equal(h.stats.open, 0, JSON.stringify(state));
      assert.equal(h.stats.option, 0, JSON.stringify(state));
      assert.equal(h.stats.openedIds.includes('basic-degree-select'), false, JSON.stringify(state));
      assert.equal(h.stats.openedIds.includes('basic-level-select'), false, JSON.stringify(state));
      if (!state.hintInSelect) {
        assert.equal(textOf(h.document, 'basic-degree-value'), OUT.basicDegree.token, JSON.stringify(state));
      } else {
        assert.equal(textOf(h.document, 'basic-degree-value'), probe.section.hint);
      }
      assert.equal(textOf(h.document, 'basic-level-value'), OUT.basicLevel.token, JSON.stringify(state));
      assert.equal(h.document.getElementById('basic-major-input').value, OUT.basicMajor.token, JSON.stringify(state));
      const historyMajor = h.document.getElementById('major-input');
      if (historyMajor) assert.equal(historyMajor.value, '', JSON.stringify(state));
      assert.equal(h.document.getElementById('description-input').value, '');
    } finally { h.dom.window.close(); }
  }

  const degreeOnly = [
    { degreeBeforeCity: true },
    { duplicateDegree: true },
    { dropDegree: true }
  ];
  for (const state of degreeOnly) {
    const h = await boot(state);
    try {
      const degree = await h.api.fillField(DEGREE, DEGREE_VALUE);
      const level = await h.api.fillField(LEVEL, LEVEL_VALUE);
      assert.equal(degree.reason, 'control_not_supported', JSON.stringify({ state, degree }));
      assert.equal(degree.ok, false);
      assert.equal(level.reason, 'readback_matched', JSON.stringify({ state, level }));
      assert.equal(textOf(h.document, 'basic-level-value'), OUT.basicLevel.token, JSON.stringify(state));
      assert.equal(h.stats.openedIds.includes('basic-degree-select'), false, JSON.stringify(state));
      assert.equal(h.stats.openedIds.includes('basic-level-select'), false, JSON.stringify(state));
      if (h.document.getElementById('degree-value')) assert.equal(textOf(h.document, 'degree-value'), '', JSON.stringify(state));
      assert.equal(textOf(h.document, 'level-value'), LEVEL_VALUE, JSON.stringify(state));
    } finally { h.dom.window.close(); }
  }

  const oneLabel = [
    [{ duplicateLevel: true }, LEVEL, LEVEL_VALUE],
    [{ duplicateMajor: true }, MAJOR, MAJOR_VALUE],
    [{ duplicateRank: true }, RANK, RANK_VALUE]
  ];
  for (const [state, label, value] of oneLabel) {
    const h = await boot(state);
    try {
      const rowResult = await h.api.fillField(label, value);
      const degree = await h.api.fillField(DEGREE, DEGREE_VALUE);
      assert.equal(rowResult.reason, 'control_not_supported', JSON.stringify({ state, rowResult }));
      assert.equal(degree.reason, 'readback_matched', JSON.stringify({ state, degree }));
      assert.equal(textOf(h.document, 'basic-degree-value'), OUT.basicDegree.token);
      assert.equal(textOf(h.document, 'degree-value'), DEGREE_VALUE);
      assert.equal(h.stats.openedIds.includes('basic-degree-select'), false);
    } finally { h.dom.window.close(); }
  }

  const early = await boot({ hintBeforeBasic: true });
  try {
    const degree = await early.api.fillField(DEGREE, DEGREE_VALUE);
    const major = await early.api.fillField(MAJOR, MAJOR_VALUE);
    assert.equal(degree.reason, 'readback_matched', JSON.stringify(degree));
    assert.equal(major.reason, 'readback_matched', JSON.stringify(major));
    assert.equal(textOf(early.document, 'basic-degree-value'), OUT.basicDegree.token);
    assert.equal(early.document.getElementById('basic-major-input').value, OUT.basicMajor.token);
    assert.equal(textOf(early.document, 'degree-value'), DEGREE_VALUE);
    assert.equal(early.document.getElementById('major-input').value, MAJOR_VALUE);
    assert.deepEqual(early.stats.openedIds, ['degree-select']);
    unchanged(early.document, early.stats, { degree: DEGREE_VALUE, major: MAJOR_VALUE });
  } finally { early.dom.window.close(); }
});

test('education-history control drift fails closed without painting', async () => {
  const cases = [
    [{ degreeDropAllowClear: true }, DEGREE, DEGREE_VALUE],
    [{ degreeDisabled: true }, DEGREE, DEGREE_VALUE],
    [{ degreeHidden: true }, DEGREE, DEGREE_VALUE],
    [{ degreeExtraSelect: true }, DEGREE, DEGREE_VALUE],
    [{ degreeStrayText: true }, DEGREE, DEGREE_VALUE],
    [{ degreeStrayRadio: true }, DEGREE, DEGREE_VALUE],
    [{ degreeStrayFile: true }, DEGREE, DEGREE_VALUE],
    [{ degreeAsText: true }, DEGREE, DEGREE_VALUE],
    [{ degreeDisagree: true }, DEGREE, DEGREE_VALUE],
    [{ degreeAmbiguous: true, degree: DEGREE_VALUE }, DEGREE, DEGREE_VALUE],
    [{ degreeBadDropdown: true }, DEGREE, DEGREE_VALUE],
    [{ degreeEmptyMenu: true }, DEGREE, DEGREE_VALUE],
    [{ degreeDropSearch: true }, DEGREE, DEGREE_VALUE],
    [{ levelDropAllowClear: true }, LEVEL, LEVEL_VALUE],
    [{ rankHidden: true }, RANK, RANK_VALUE],
    [{ rankDropAllowClear: true }, RANK, RANK_VALUE],
    [{ majorReadonly: true }, MAJOR, MAJOR_VALUE],
    [{ majorDisabled: true }, MAJOR, MAJOR_VALUE],
    [{ majorHidden: true }, MAJOR, MAJOR_VALUE],
    [{ majorPlaceholder: '请填写其他' }, MAJOR, MAJOR_VALUE],
    [{ majorPlaceholder: '' }, MAJOR, MAJOR_VALUE],
    [{ majorDropClass: true }, MAJOR, MAJOR_VALUE],
    [{ majorTypeNumber: true }, MAJOR, MAJOR_VALUE],
    [{ majorExtra: true }, MAJOR, MAJOR_VALUE],
    [{ majorTextarea: true }, MAJOR, MAJOR_VALUE],
    [{ majorAsSelect: true }, MAJOR, MAJOR_VALUE],
    [{ majorDisagree: true }, MAJOR, MAJOR_VALUE],
    [{ busyDegree: true }, MAJOR, MAJOR_VALUE],
    [{ busyDegree: true }, RANK, RANK_VALUE],
    [{ busySchool: true }, DEGREE, DEGREE_VALUE]
  ];
  for (const [state, label, value] of cases) {
    const h = await boot(state);
    try {
      const rowResult = await h.api.fillField(label, value);
      assert.equal(rowResult.ok, false, JSON.stringify({ state, rowResult }));
      assert.notEqual(rowResult.reason, 'readback_matched', JSON.stringify(state));
      assert.notEqual(rowResult.reason, 'preexisting_same_value', JSON.stringify(state));
      assert.ok(['control_not_supported', 'control_busy'].includes(rowResult.reason), JSON.stringify({ state, rowResult }));
      assert.equal(rowResult.liveSupportClaimed, false);
      assert.equal(rowResult.supportClaimed, false);
      assert.equal(h.stats.option, 0, JSON.stringify(state));
      assert.equal(h.stats.forbidden, 0, JSON.stringify(state));
      assert.equal(textOf(h.document, 'basic-degree-value'), OUT.basicDegree.token, JSON.stringify(state));
      assert.equal(h.document.getElementById('basic-major-input').value, OUT.basicMajor.token, JSON.stringify(state));
      const historyMajor = h.document.getElementById('major-input');
      if (historyMajor && !state.majorReadonly && !state.majorDisabled) assert.equal(historyMajor.value, '', JSON.stringify(state));
      assert.equal(h.document.getElementById('description-input').value, '');
      if (!state.degreeBadDropdown && !state.degreeEmptyMenu && !state.busyDegree && !state.busySchool) {
        assert.equal(h.stats.open, 0, JSON.stringify(state));
      }
    } finally { h.dom.window.close(); }
  }
});

test('a closed 学位 search field still paints through the visible face', async () => {
  const h = await boot({ closedSearch: true, degreeClosedSearch: true, degreeMash: 'class' });
  try {
    const degree = await h.api.fillField(DEGREE, DEGREE_VALUE);
    assert.equal(degree.reason, 'readback_matched', JSON.stringify(degree));
    assert.equal(degree.after, DEGREE_VALUE);
    assert.equal(degree.stillOpen, 0);
    assertNeverSaved(degree);
    assert.equal(h.stats.open, 1);
    assert.equal(h.stats.option, 1);
    assert.equal(h.stats.triggerClass, '');
    assert.equal(h.stats.faceClass, LIVE.faceClass);
    assert.equal(h.document.querySelector('#degree-select .ant-select-selection-selected-value').textContent, DEGREE_VALUE);
    assert.equal(h.document.getElementById('degree-select-menu').hidden, true);
    assert.equal(textOf(h.document, 'basic-degree-value'), OUT.basicDegree.token);
    unchanged(h.document, h.stats, { degree: DEGREE_VALUE });
  } finally { h.dom.window.close(); }
});

test('an open education menu blocks 专业名称 and a hidden page does not type', async () => {
  const busy = await boot({ busyDegree: true });
  try {
    const major = await busy.api.fillField(MAJOR, MAJOR_VALUE);
    assert.equal(major.reason, 'control_busy', JSON.stringify(major));
    assert.equal(busy.document.getElementById('major-input').value, '');
    assert.equal(busy.stats.option, 0);
    unchanged(busy.document, busy.stats);
  } finally { busy.dom.window.close(); }

  const hidden = await boot({});
  try {
    Object.defineProperty(hidden.document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    const degree = await hidden.api.fillField(DEGREE, DEGREE_VALUE);
    const major = await hidden.api.fillField(MAJOR, MAJOR_VALUE);
    assert.equal(degree.reason, 'fill_interrupted_page_hidden');
    assert.equal(major.reason, 'fill_interrupted_page_hidden');
    assertNeverSaved(degree);
    assert.equal(hidden.stats.open, 0);
    assert.equal(hidden.document.getElementById('major-input').value, '');
    unchanged(hidden.document, hidden.stats);
  } finally { hidden.dom.window.close(); }
});
