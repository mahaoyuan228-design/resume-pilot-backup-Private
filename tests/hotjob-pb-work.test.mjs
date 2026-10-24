// Offline Never-Save trials for hotjob pb work-block text, textarea, and flat select.
// Markup is built from tests/fixtures/hotjob-pb-work-probe-dom.json (2026-10-23
// probe classes, labels, and the captured 工作性质 token only). A green run is not a live support claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const root = new URL('..', import.meta.url);
const source = readFileSync(new URL('../src/content/hotjob-pb-work.js', import.meta.url), 'utf8');
const basicSource = readFileSync(new URL('../src/content/hotjob-pb-basic.js', import.meta.url), 'utf8');
const regionSource = readFileSync(new URL('../src/content/hotjob-pb-region.js', import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../manifest.json', import.meta.url), 'utf8');
const engine = readFileSync(new URL('../src/content/engine.js', import.meta.url), 'utf8');
const probe = JSON.parse(readFileSync(new URL('../tests/fixtures/hotjob-pb-work-probe-dom.json', import.meta.url), 'utf8'));
const PAGE = `https://${probe.page.hostname}${probe.page.samplePath}`;
const ORG = probe.text.fields[0];
const POSITION = probe.text.fields[1];
const DESCRIPTION = probe.textarea.label;
const NATURE = probe.select.label;
const FORBIDDEN = probe.page.forbiddenButtons;
const PROFILE = {
  [ORG.label]: '合成企业甲',
  [NATURE]: '实习',
  [POSITION.label]: '合成职位',
  [DESCRIPTION]: '合成工作描述甲'
};

function esc(value) {
  return String(value).replace(/[&<>"]/gu, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function classes(value) {
  return String(value).split(/\s+/u).filter(Boolean);
}

function textField(field, value, state) {
  const dropClass = state.dropAntInput && field.key === 'organization';
  const calendar = state.calendarOnOrg && field.key === 'organization';
  const className = dropClass ? 'plain-input' : (calendar ? probe.neighbors.start.controlClass : probe.text.controlClass);
  const type = state.typeNumber && field.key === 'organization' ? 'number' : probe.text.inputType;
  const readonly = state.readonlyOrg && field.key === 'organization' ? ' readonly' : '';
  const placeholder = field.placeholder ? ` placeholder="${esc(field.placeholder)}"` : '';
  const extra = state.extraTextInput && field.key === 'organization'
    ? `<input class="${esc(probe.text.controlClass)}" type="text" value="">` : '';
  const file = state.fileOnOrg && field.key === 'organization' ? '<input type="file">' : '';
  const area = state.textareaOnOrg && field.key === 'organization'
    ? `<textarea class="${esc(probe.textarea.controlClass)}"></textarea>` : '';
  const hidden = state.hiddenOrg && field.key === 'organization' ? ' hidden' : '';
  const itemClass = state.dropAntRow && field.key === 'organization' ? 'ant-form-item' : probe.page.itemClass;
  const label = state.starLabels && field.key === 'organization' ? `${field.label}*` : field.label;
  const control = state.orgAsTextarea && field.key === 'organization'
    ? `<textarea id="organization-input" class="${esc(probe.textarea.controlClass)}">${esc(value)}</textarea>`
    : `<input id="${field.key}-input" class="${esc(className)}" type="${type}"${placeholder}${readonly} value="${esc(value)}">`;
  return `<div class="${esc(itemClass)}" data-field="${field.key}"${hidden}><label>${esc(label)}</label><span class="${esc(probe.page.childrenClass)}">${control}</span>${extra}${file}${area}</div>`;
}

function textareaField(value, state) {
  const className = state.dropTextareaClass ? 'plain-area' : probe.textarea.controlClass;
  const readonly = state.readonlyDescription ? ' readonly' : '';
  const extra = state.extraTextarea ? `<textarea class="${esc(probe.textarea.controlClass)}"></textarea>` : '';
  const asInput = state.descriptionAsInput
    ? `<input id="description-input" class="${esc(probe.text.controlClass)}" type="text" value="${esc(value)}">`
    : `<textarea id="description-input" class="${esc(className)}" placeholder="${esc(probe.textarea.placeholder)}"${readonly}>${esc(value)}</textarea>`;
  return `<div class="${esc(probe.page.itemClass)}" data-field="description"><label>${esc(DESCRIPTION)}</label><span class="${esc(probe.page.childrenClass)}">${asInput}</span>${extra}</div>`;
}

function selectBox(id, label, value, state, controlClass) {
  const selectClass = controlClass || (state.dropAllowClear && id === 'nature'
    ? 'ant-select ant-select-enabled'
    : probe.select.controlClass);
  const trigger = state.dropSearch && id === 'nature' ? '' : `<input class="${esc(probe.select.triggerClass)}" type="text" value="">`;
  const extra = state.extraSelect && id === 'nature'
    ? `<div class="${esc(probe.select.controlClass)}"><span></span><input class="${esc(probe.select.triggerClass)}" type="text" value=""></div>` : '';
  const cascader = state.cascaderOnNature && id === 'nature'
    ? `<span class="${esc(probe.neighbors.residence.menuClass)}"></span>` : '';
  const hiddenPlaceholder = state.hiddenPlaceholder && id === 'nature'
    ? '<span hidden style="display:none">请选择工作性质</span>' : '';
  const mash = state.mash && id === 'nature' ? '<span>请选择工作性质</span>' : '';
  const noise = state.extraToken && id === 'nature' ? '<span>旁路</span>' : '';
  return `<div class="${esc(probe.page.itemClass)}" data-field="${id}"><label>${esc(label)}</label><span class="${esc(probe.page.childrenClass)}">${cascader}<div class="${esc(selectClass)}" id="${id}-select">${hiddenPlaceholder}${mash}<span id="${id}-value">${esc(value)}</span>${noise}${trigger}</div>${extra}</span></div>`;
}

function optionsFor(state) {
  if (state.confirmOption) return ['确定'];
  const rows = [...probe.select.optionsSample];
  if (state.duplicateOption) rows.push(state.duplicateOption);
  if (state.emptyMenu) return [];
  return rows;
}

function neighborText(id, label, value, placeholder, controlClass = probe.text.controlClass) {
  const ph = placeholder ? ` placeholder="${esc(placeholder)}"` : '';
  return `<div class="${esc(probe.page.itemClass)}" data-field="${id}"><label>${esc(label)}</label><span class="${esc(probe.page.childrenClass)}"><input id="${id}-input" class="${esc(controlClass)}" type="text" readonly value="${esc(value)}"${ph}></span></div>`;
}

function html(state) {
  const rootClass = state.dropRoot ? 'page-root' : probe.page.rootClass;
  const shell = state.elForm ? '<div class="el-form"></div>' : '';
  const duplicate = state.duplicateOrg
    ? textField(ORG, '', state).replace('data-field="organization"', 'data-field="organization-copy"') : '';
  const dropdownClass = state.badDropdown
    ? 'ant-select-dropdown ant-select-dropdown-placement-bottomLeft'
    : probe.select.dropdownClass;
  const buttons = [...probe.page.buttonLabels, ...FORBIDDEN.filter((label) => !probe.page.buttonLabels.includes(label))]
    .map((label) => `<button type="button">${esc(label)}</button>`).join('');
  const neighbor = probe.neighbors;
  return `<!doctype html><body>${shell}<div class="${esc(rootClass)}"><div class="${esc(probe.page.contentClass)}">${
    textField(ORG, state.organization ?? '', state)
  }${selectBox('nature', NATURE, state.nature ?? '', state)
  }${textField(POSITION, state.position ?? '', state)
  }${textareaField(state.description ?? '', state)
  }${neighborText('start', neighbor.start.label, neighbor.start.token, neighbor.start.placeholder, neighbor.start.controlClass)
  }${neighborText('end', neighbor.end.label, neighbor.end.token, neighbor.end.placeholder, neighbor.end.controlClass)
  }${selectBox('expect', neighbor.expectNature.label, state.expectNature ?? neighbor.expectNature.token, {})
  }${selectBox('school', neighbor.school.label, neighbor.school.token, {}, probe.select.controlClass)
  }${selectBox('cert', neighbor.cert.label, neighbor.cert.token, {}, probe.select.controlClass)
  }<div class="${esc(probe.page.itemClass)}"><label>${esc(neighbor.note.label)}</label><textarea id="note" class="${esc(neighbor.note.controlClass)}">${esc(neighbor.note.token)}</textarea></div><div class="${esc(probe.page.itemClass)}"><label>${esc(neighbor.majorNote.label)}</label><textarea id="major-note" class="${esc(neighbor.majorNote.controlClass)}">${esc(neighbor.majorNote.token)}</textarea></div><div class="${esc(probe.page.itemClass)}"><label>${esc(neighbor.certNote.label)}</label><textarea id="cert-note" class="${esc(neighbor.certNote.controlClass)}">${esc(neighbor.certNote.token)}</textarea></div><div class="${esc(probe.page.itemClass)}"><label>${esc(neighbor.address.label)}</label><input id="address-input" class="${esc(neighbor.address.controlClass)}" type="text" value="${esc(neighbor.address.token)}"></div><div class="${esc(probe.page.itemClass)}"><label>${esc(neighbor.name.label)}</label><input id="name-input" class="${esc(neighbor.name.controlClass)}" type="text" value="${esc(neighbor.name.token)}"></div><div class="${esc(probe.page.itemClass)}"><label>${esc(neighbor.residence.label)}</label><span class="${esc(probe.page.childrenClass)}"><span class="${esc(neighbor.residence.menuClass)}"><div class="${esc(neighbor.residence.controlClass)}" id="residence-select"><span id="residence-value">${esc(neighbor.residence.token)}</span></div></span></span></div><div class="${esc(neighbor.photo.itemClass)}"><label>${esc(neighbor.photo.label)}</label><input id="photo" type="file"></div><div class="${esc(neighbor.portrait.itemClass)}"><label>${esc(neighbor.portrait.label)}</label><input id="portrait" type="file"></div>${duplicate}${buttons}</div></div><div class="${esc(dropdownClass)}" id="select-menu" hidden><ul id="select-options"></ul></div></body>`;
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
  const options = select.id === 'nature-select' ? optionsFor(state) : [probe.neighbors.expectNature.token];
  const list = document.getElementById('select-options');
  list.replaceChildren();
  for (const text of options) {
    const li = document.createElement('li');
    if (state.confirmOption && select.id === 'nature-select') {
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
    open: 0, option: 0, escape: 0, forbidden: 0, button: 0, file: 0, textInput: 0, focus: 0,
    openClass: '', triggerClass: ''
  };
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (button) {
      stats.button += 1;
      if (FORBIDDEN.includes(button.textContent.trim())) stats.forbidden += 1;
    }
    if (event.target.matches?.('input[type="file"]')) stats.file += 1;
  }, true);
  for (const input of document.querySelectorAll('input.ant-input, textarea.ant-input, #organization-input, #description-input')) {
    input.addEventListener('input', () => { stats.textInput += 1; });
    input.addEventListener('focus', () => { stats.focus += 1; });
  }
  for (const select of document.querySelectorAll('.ant-select')) {
    select.addEventListener('click', (event) => {
      if (document.getElementById('select-menu').contains(event.target)) return;
      stats.open += 1;
      if (event.target.classList?.contains(probe.select.triggerClass)) stats.triggerClass = probe.select.triggerClass;
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
    select.querySelector('[id$="-value"]').textContent = li.textContent.trim();
    if (!state.keepOpen) closeWidgets(document);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    stats.escape += 1;
    if (state.ignoreEscape) return;
    closeWidgets(document);
  });
  if (state.busy) {
    const select = document.getElementById('nature-select');
    select.classList.add('ant-select-open', 'ant-select-focused');
    paintMenu(document, select, state);
  }
  return stats;
}

function patch(window, state) {
  window.Element.prototype.getClientRects = function () {
    for (let node = this; node?.nodeType === 1; node = node.parentElement) {
      if (node.hidden || node.style.display === 'none') return [];
    }
    if (state.zeroRectTrigger && this.classList?.contains(probe.select.triggerClass)) return [];
    if (state.zeroRectSelect && this.id === 'nature-select') return [];
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
  return { dom, window, document, stats, api: window.ResumeHotjobPbWork };
}

function unchanged(document, stats) {
  const neighbor = probe.neighbors;
  assert.equal(document.getElementById('start-input').value, neighbor.start.token);
  assert.equal(document.getElementById('end-input').value, neighbor.end.token);
  assert.equal(document.getElementById('start-input').readOnly, true);
  assert.equal(document.getElementById('expect-value').textContent, neighbor.expectNature.token);
  assert.equal(document.getElementById('school-value').textContent, neighbor.school.token);
  assert.equal(document.getElementById('cert-value').textContent, neighbor.cert.token);
  assert.equal(document.getElementById('note').value, neighbor.note.token);
  assert.equal(document.getElementById('major-note').value, neighbor.majorNote.token);
  assert.equal(document.getElementById('cert-note').value, neighbor.certNote.token);
  assert.equal(document.getElementById('address-input').value, neighbor.address.token);
  assert.equal(document.getElementById('name-input').value, neighbor.name.token);
  assert.equal(document.getElementById('residence-value').textContent, neighbor.residence.token);
  assert.equal(document.getElementById('photo').files.length, 0);
  assert.equal(document.getElementById('portrait').files.length, 0);
  assert.equal(stats.forbidden, 0);
  assert.equal(stats.button, 0);
  assert.equal(stats.file, 0);
}

test('source stays on the probed pb classes and does not claim support', () => {
  assert.match(source, /ResumeHotjobPbWork/);
  assert.match(source, /liveSupportClaimed:\s*false/);
  assert.match(source, /supportClaimed:\s*false/);
  assert.match(source, /neverSave:\s*true/);
  assert.doesNotMatch(source, /liveSupportClaimed:\s*true/);
  assert.doesNotMatch(source, /supportClaimed:\s*true/);
  assert.doesNotMatch(source, /已支持/);
  assert.doesNotMatch(source, /hotjob-mc-basic|ResumeHotjobMc|ResumeHotjobPbBasic|ResumeHotjobPbRegion|mc\/deliver|cms-region|engine\.js/);
  assert.doesNotMatch(source, /textContent\s*=/);
  assert.doesNotMatch(source, /\.value\s*=[^=]/);
  assert.doesNotMatch(source, /\.checked\s*=/);
  assert.doesNotMatch(source, /innerHTML/);
  assert.doesNotMatch(source, /ant-cascader-menus|form-cell|ant-select-selection--single|ant-radio-wrapper|ant-select-dropdown-menu-item|ant-select-selection-selected-value/);
  assert.equal(manifest.includes('hotjob-pb-work'), false);
  assert.equal(engine.includes('hotjob-pb-work'), false);
  assert.equal(basicSource.includes('hotjob-pb-work'), false);
  assert.equal(regionSource.includes('hotjob-pb-work'), false);
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
    ORG.label,
    POSITION.label,
    DESCRIPTION,
    NATURE
  ]) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  }
});

test('fixture html uses only the probe class list, labels, and the captured nature token', () => {
  const built = html({});
  for (const token of [
    probe.page.rootClass, probe.page.contentClass, probe.page.childrenClass,
    ...classes(probe.page.itemClass), probe.text.controlClass, probe.textarea.controlTag,
    ...classes(probe.select.controlClass), probe.select.triggerClass,
    ...classes(probe.select.dropdownClass), probe.neighbors.start.controlClass,
    probe.neighbors.residence.menuClass, probe.neighbors.photo.itemClass,
    probe.neighbors.portrait.itemClass
  ]) assert.match(built, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  for (const field of probe.text.fields) assert.match(built, new RegExp(`>${field.label}<`));
  assert.match(built, new RegExp(`>${DESCRIPTION}<`));
  assert.match(built, new RegExp(`>${NATURE}<`));
  assert.deepEqual(probe.select.optionsSample, [probe.select.valueSample]);
  assert.equal(built.includes(`>${probe.select.valueSample}<`), false);
  for (const label of probe.page.buttonLabels) assert.match(built, new RegExp(`>${label}<`));
  assert.doesNotMatch(built, /ant-radio-wrapper|ant-select-selection--single|ant-cascader-menus|ant-select-dropdown-menu-item|ant-select-selection-selected-value/);
  assert.equal(JSON.stringify(probe).includes('中信证券'), false);
  assert.equal(built.includes('中信证券'), false);
});

test('inspect matches the four probed fields and does not claim support', async () => {
  const h = await boot({ nature: '实习', organization: '合成企业甲' });
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
    assert.equal(view.fields.length, 4);
    assert.equal(view.fields.map((field) => field.label).join('|'), [ORG.label, NATURE, POSITION.label, DESCRIPTION].join('|'));
    assert.equal(view.fields.every((field) => field.supported === false), true);
    assert.equal(view.fields.every((field) => field.reason === 'structure_matched'), true);
    assert.equal(view.fields.find((field) => field.label === NATURE).kind, 'select');
    assert.equal(view.fields.find((field) => field.label === NATURE).value, '实习');
    assert.equal(view.fields.find((field) => field.label === DESCRIPTION).kind, 'textarea');
    assert.equal(view.fields.find((field) => field.label === ORG.label).value, '合成企业甲');
    assert.equal(view.fields.map((field) => field.label).includes(probe.neighbors.expectNature.label), false);
    assert.equal(view.fields.map((field) => field.label).includes(probe.neighbors.note.label), false);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('empty text, textarea, and the flat select read back', async () => {
  const h = await boot({ zeroRectTrigger: true });
  try {
    const org = await h.api.fillField(ORG.label, '  合成企业甲  ');
    const nature = await h.api.fillField(NATURE, ' 实习 ');
    const position = await h.api.fillField(POSITION.label, PROFILE[POSITION.label]);
    const description = await h.api.fillField(DESCRIPTION, ' 第一句。\n第二句。 ');
    assert.equal(org.ok, true, JSON.stringify(org));
    assert.equal(org.reason, 'readback_matched');
    assert.equal(org.after, '合成企业甲');
    assert.equal(org.opened, false);
    assert.equal(org.liveSupportClaimed, false);
    assert.equal(org.supportClaimed, false);
    assert.equal(org.complete, false);
    assert.equal(org.saved, false);
    assert.equal(org.skippedSave, true);
    assert.equal(org.neverSave, true);
    assert.equal(org.softwareClickedSave, false);
    assert.equal(nature.reason, 'readback_matched');
    assert.equal(nature.after, '实习');
    assert.equal(nature.opened, true);
    assert.equal(nature.canceled, false);
    assert.equal(nature.stillOpen, 0);
    assert.equal(position.after, '合成职位');
    assert.equal(description.reason, 'readback_matched');
    assert.equal(description.after, ' 第一句。\n第二句。 ');
    assert.equal(h.stats.triggerClass, probe.select.triggerClass);
    assert.match(h.stats.openClass, /ant-select-open/);
    assert.match(h.stats.openClass, /ant-select-focused/);
    assert.match(h.stats.openClass, /ant-select-enabled/);
    assert.equal(h.document.getElementById('organization-input').value, '合成企业甲');
    assert.equal(h.document.getElementById('position-input').value, '合成职位');
    assert.equal(h.document.getElementById('description-input').value, ' 第一句。\n第二句。 ');
    assert.equal(h.document.getElementById('nature-value').textContent, '实习');
    assert.equal(h.document.querySelectorAll('.ant-select-open').length, 0);
    assert.equal(h.document.getElementById('select-menu').hidden, true);
    assert.equal(h.stats.option, 1);
    assert.equal(h.stats.textInput, 3);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('fillFields reads back all four and leaves neighbors untouched', async () => {
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
    assert.equal(h.document.getElementById('organization-input').value, '合成企业甲');
    assert.equal(h.document.getElementById('nature-value').textContent, '实习');
    assert.equal(h.document.getElementById('description-input').value, '合成工作描述甲');
    assert.equal(h.stats.option, 1);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('preexisting same values do not focus, reopen, or paint', async () => {
  const h = await boot({
    organization: '合成 企业甲',
    position: '合成职位',
    description: '合成 工作描述甲',
    nature: '实习',
    hiddenPlaceholder: true
  });
  try {
    const org = await h.api.fillField(ORG.label, '合成企业甲');
    const position = await h.api.fillField(POSITION.label, ' 合成职位 ');
    const description = await h.api.fillField(DESCRIPTION, '合成 工作描述甲');
    const nature = await h.api.fillField(NATURE, ' 实习 ');
    assert.equal(org.reason, 'preexisting_same_value');
    assert.equal(org.status, 'verified');
    assert.equal(org.ok, true);
    assert.equal(org.opened, false);
    assert.equal(position.reason, 'preexisting_same_value');
    assert.equal(description.reason, 'preexisting_same_value');
    assert.equal(nature.reason, 'preexisting_same_value');
    assert.equal(nature.status, 'verified');
    assert.equal(nature.opened, false);
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.option, 0);
    assert.equal(h.stats.textInput, 0);
    assert.equal(h.stats.focus, 0);
    assert.equal(h.document.getElementById('organization-input').value, '合成 企业甲');
    assert.equal(h.document.getElementById('description-input').value, '合成 工作描述甲');
    assert.equal(h.document.getElementById('nature-value').textContent, '实习');
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a visible placeholder plus the selected token still counts as preexisting', async () => {
  const h = await boot({ nature: '实习', mash: true, organization: '已有企业' });
  try {
    const nature = await h.api.fillField(NATURE, '实习');
    const org = await h.api.fillField(ORG.label, '合成企业甲');
    assert.equal(nature.reason, 'preexisting_same_value', JSON.stringify(nature));
    assert.equal(nature.ok, true);
    assert.equal(nature.opened, false);
    assert.equal(org.reason, 'existing_value');
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.textInput, 0);
    assert.equal(h.document.getElementById('nature-value').textContent, '实习');
    assert.equal(h.document.getElementById('organization-input').value, '已有企业');
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a different existing value is kept and nothing is opened or painted', async () => {
  const h = await boot({
    organization: '已有企业',
    position: '已有职位',
    description: '已有描述',
    nature: '在职'
  });
  try {
    const org = await h.api.fillField(ORG.label, '合成企业甲');
    const position = await h.api.fillField(POSITION.label, '合成职位');
    const description = await h.api.fillField(DESCRIPTION, '合成工作描述甲');
    const nature = await h.api.fillField(NATURE, '实习');
    assert.equal(org.reason, 'existing_value');
    assert.equal(org.status, 'skipped');
    assert.equal(org.ok, false);
    assert.equal(position.reason, 'existing_value');
    assert.equal(description.reason, 'existing_value');
    assert.equal(nature.reason, 'existing_value');
    assert.equal(nature.ok, false);
    assert.equal(nature.opened, false);
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.option, 0);
    assert.equal(h.stats.textInput, 0);
    assert.equal(h.document.getElementById('organization-input').value, '已有企业');
    assert.equal(h.document.getElementById('description-input').value, '已有描述');
    assert.equal(h.document.getElementById('nature-value').textContent, '在职');
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('empty values, short labels, and out-of-scope labels fail closed', async () => {
  const h = await boot({});
  try {
    for (const value of ['', '   ', null, 1]) {
      const row = await h.api.fillField(ORG.label, value);
      assert.equal(row.reason, 'missing_profile_value', String(value));
      assert.equal(row.ok, false);
    }
    const blankDescription = await h.api.fillField(DESCRIPTION, ' \n ');
    assert.equal(blankDescription.reason, 'missing_profile_value');
    const short = await h.api.fillField('企业', '合成企业甲');
    assert.equal(short.reason, 'label_not_allowed');
    const expectNature = await h.api.fillField(probe.neighbors.expectNature.label, '实习');
    assert.equal(expectNature.reason, 'label_not_allowed');
    for (const label of [
      probe.neighbors.start.label,
      probe.neighbors.end.label,
      probe.neighbors.note.label,
      probe.neighbors.majorNote.label,
      probe.neighbors.address.label,
      probe.neighbors.name.label,
      probe.neighbors.school.label,
      probe.neighbors.cert.label,
      probe.neighbors.certNote.label,
      probe.neighbors.residence.label,
      probe.neighbors.photo.label,
      probe.neighbors.portrait.label,
      '籍贯',
      '期望面试地点（供参考，实际安排将根据笔试通过名单确定）',
      '毕业院校',
      '期望年薪',
      '专业排名',
      '城市',
      '专业名称',
      '性别',
      '到岗时间',
      '如应聘研究发展中心行业研究类岗位请勾选（建议仅勾选3~5项）'
    ]) {
      const row = await h.api.fillField(label, '合成企业甲');
      assert.equal(row.reason, 'label_not_allowed', label);
    }
    const none = await h.api.fillFields(null);
    assert.equal(none.ok, false);
    assert.equal(none.fields.every((field) => field.reason === 'missing_profile_value'), true);
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.textInput, 0);
    assert.equal(h.document.getElementById('organization-input').value, '');
    assert.equal(h.document.getElementById('description-input').value, '');
    assert.equal(h.document.getElementById('nature-value').textContent, '');
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('Escape closes 工作性质 and does not change the value; text and textarea do not click', async () => {
  const h = await boot({ nature: '', organization: '已有企业' });
  try {
    const canceled = await h.api.cancelField(NATURE);
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
    const text = await h.api.cancelField(ORG.label);
    const area = await h.api.cancelField(DESCRIPTION);
    assert.equal(text.reason, 'cancel_not_applicable');
    assert.equal(area.reason, 'cancel_not_applicable');
    assert.equal(h.stats.textInput, 0);
    assert.equal(h.document.getElementById('organization-input').value, '已有企业');
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a menu that ignores Escape fails closed and does not keep a painted value', async () => {
  const h = await boot({ ignoreEscape: true });
  try {
    const canceled = await h.api.cancelField(NATURE);
    assert.equal(canceled.ok, false);
    assert.equal(canceled.reason, 'menu_cleanup_failed');
    assert.equal(canceled.stillOpen, 1);
    assert.equal(canceled.after, '');
    assert.equal(h.stats.option, 0);
    const missing = await h.api.fillField(ORG.label, '合成企业甲');
    assert.equal(missing.ok, false);
    assert.equal(missing.reason, 'control_busy');
    assert.equal(h.document.getElementById('organization-input').value, '');
    assert.equal(h.document.getElementById('nature-value').textContent, '');
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('missing and duplicate options fail closed before a write', async () => {
  const missing = await boot({});
  try {
    const nature = await missing.api.fillField(NATURE, '全职');
    assert.equal(nature.reason, 'option_not_found', JSON.stringify(nature));
    assert.equal(nature.opened, true);
    assert.equal(nature.canceled, true);
    assert.equal(nature.after, '');
    assert.equal(nature.stillOpen, 0);
    assert.ok(missing.stats.escape >= 1);
    assert.equal(missing.stats.option, 0);
    assert.equal(missing.document.getElementById('nature-value').textContent, '');
    assert.equal(missing.document.getElementById('expect-value').textContent, '全职');
    unchanged(missing.document, missing.stats);
  } finally { missing.dom.window.close(); }

  const ambiguous = await boot({ duplicateOption: '实习' });
  try {
    const row = await ambiguous.api.fillField(NATURE, '实习');
    assert.equal(row.reason, 'ambiguous_option');
    assert.equal(row.after, '');
    assert.equal(ambiguous.stats.option, 0);
    assert.equal(ambiguous.document.getElementById('select-menu').hidden, true);
    unchanged(ambiguous.document, ambiguous.stats);
  } finally { ambiguous.dom.window.close(); }
});

test('two visible display tokens and a confirm button fail closed', async () => {
  const noisy = await boot({ extraToken: true, nature: '实习' });
  try {
    const view = noisy.api.inspect();
    assert.equal(view.ok, false);
    assert.equal(view.fields.find((field) => field.label === NATURE).reason, 'control_not_supported');
    const row = await noisy.api.fillField(NATURE, '实习');
    assert.equal(row.reason, 'control_not_supported');
    assert.equal(row.opened, false);
    assert.equal(noisy.stats.open, 0);
    assert.equal(noisy.document.getElementById('nature-value').textContent, '实习');
    unchanged(noisy.document, noisy.stats);
  } finally { noisy.dom.window.close(); }

  const confirm = await boot({ confirmOption: true });
  try {
    const row = await confirm.api.fillField(NATURE, '确定');
    assert.equal(row.reason, 'never_save', JSON.stringify(row));
    assert.equal(row.ok, false);
    assert.equal(row.canceled, true);
    assert.equal(row.stillOpen, 0);
    assert.equal(confirm.stats.option, 0);
    assert.equal(confirm.stats.button, 0);
    assert.equal(confirm.stats.forbidden, 0);
    assert.equal(confirm.document.getElementById('nature-value').textContent, '');
    assert.equal(confirm.document.getElementById('select-menu').hidden, true);
  } finally { confirm.dom.window.close(); }
});

test('a starred label still matches and an ambiguous display is not overwritten', async () => {
  const h = await boot({ starLabels: true });
  try {
    const row = await h.api.fillField(ORG.label, '合成企业甲');
    assert.equal(row.reason, 'readback_matched', JSON.stringify(row));
    assert.equal(h.document.getElementById('organization-input').value, '合成企业甲');
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('missing, duplicate, and drifted controls fail closed', async () => {
  const cases = [
    [{ dropAntInput: true }, ORG.label, '合成企业甲'],
    [{ readonlyOrg: true }, ORG.label, '合成企业甲'],
    [{ calendarOnOrg: true }, ORG.label, '合成企业甲'],
    [{ extraTextInput: true }, ORG.label, '合成企业甲'],
    [{ hiddenOrg: true }, ORG.label, '合成企业甲'],
    [{ typeNumber: true }, ORG.label, '合成企业甲'],
    [{ dropAntRow: true }, ORG.label, '合成企业甲'],
    [{ duplicateOrg: true }, ORG.label, '合成企业甲'],
    [{ textareaOnOrg: true }, ORG.label, '合成企业甲'],
    [{ orgAsTextarea: true }, ORG.label, '合成企业甲'],
    [{ fileOnOrg: true }, ORG.label, '合成企业甲'],
    [{ dropTextareaClass: true }, DESCRIPTION, '合成工作描述甲'],
    [{ readonlyDescription: true }, DESCRIPTION, '合成工作描述甲'],
    [{ extraTextarea: true }, DESCRIPTION, '合成工作描述甲'],
    [{ descriptionAsInput: true }, DESCRIPTION, '合成工作描述甲'],
    [{ dropSearch: true }, NATURE, '实习'],
    [{ dropAllowClear: true }, NATURE, '实习'],
    [{ extraSelect: true }, NATURE, '实习'],
    [{ cascaderOnNature: true }, NATURE, '实习'],
    [{ zeroRectSelect: true }, NATURE, '实习'],
    [{ badDropdown: true }, NATURE, '实习'],
    [{ emptyMenu: true }, NATURE, '实习'],
    [{ busy: true }, NATURE, '实习'],
    [{ dropRoot: true }, ORG.label, '合成企业甲'],
    [{ elForm: true }, ORG.label, '合成企业甲'],
    [{ url: 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/mc/deliver/operationResumer' }, ORG.label, '合成企业甲'],
    [{ url: 'https://gszq.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html' }, POSITION.label, '合成职位']
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
    } finally { h.dom.window.close(); }
  }
});

test('a hidden page fails closed before a click or write', async () => {
  const h = await boot({});
  try {
    Object.defineProperty(h.document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    const row = await h.api.fillField(ORG.label, '合成企业甲');
    const select = await h.api.fillField(NATURE, '实习');
    const area = await h.api.fillField(DESCRIPTION, '合成工作描述甲');
    assert.equal(row.reason, 'fill_interrupted_page_hidden');
    assert.equal(select.reason, 'fill_interrupted_page_hidden');
    assert.equal(area.reason, 'fill_interrupted_page_hidden');
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.textInput, 0);
    assert.equal(h.stats.focus, 0);
    assert.equal(row.liveSupportClaimed, false);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('work description preserves authored Unicode, spacing, and browser line endings', async () => {
  const h = await boot();
  try {
    const authored = '  Ａ\u200b  first\tline\r\nsecond\rthird  ';
    const expected = '  Ａ\u200b  first\tline\nsecond\nthird  ';
    const row = await h.api.fillField(DESCRIPTION, authored);
    assert.equal(row.ok, true, JSON.stringify(row));
    assert.equal(row.reason, 'readback_matched');
    assert.equal(row.expected, expected);
    assert.equal(row.after, expected);
    assert.equal(h.document.getElementById('description-input').value, expected);
    assert.equal(h.api.inspect().fields.find((field) => field.label === DESCRIPTION).value, expected);
    const repeated = await h.api.fillField(DESCRIPTION, authored);
    assert.equal(repeated.reason, 'preexisting_same_value');
    assert.equal(repeated.before, expected);
    assert.equal(h.stats.textInput, 1);
    assert.equal(h.stats.focus, 1);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('work description keeps existing whitespace and distinct prose without false verification', async () => {
  for (const [existing, requested] of [
    ['Project A\nProject B', 'Project AProject B'],
    ['Project  A', 'Project A'],
    ['Ａ', 'A'],
    [' \n\t ', 'New description']
  ]) {
    const h = await boot({ description: existing });
    try {
      const row = await h.api.fillField(DESCRIPTION, requested);
      assert.equal(row.ok, false, JSON.stringify(row));
      assert.equal(row.status, 'skipped');
      assert.equal(row.reason, 'existing_value');
      assert.equal(row.before, existing);
      assert.equal(row.after, existing);
      assert.equal(h.document.getElementById('description-input').value, existing);
      assert.equal(h.stats.textInput, 0);
      assert.equal(h.stats.focus, 0);
      assert.equal(h.stats.open, 0);
      unchanged(h.document, h.stats);
    } finally { h.dom.window.close(); }
  }
});

test('work text and prose outside the single resume root fail before focus or writes', async () => {
  for (const [label, id] of [[ORG.label, 'organization-input'], [DESCRIPTION, 'description-input']]) {
    for (const duplicateRoot of [false, true]) {
      const h = await boot();
      try {
        if (duplicateRoot) {
          h.document.body.append(h.document.querySelector(`.${probe.page.rootClass}`).cloneNode(false));
        } else {
          h.document.body.append(h.document.getElementById(id).closest('.ant-row.ant-form-item'));
        }
        const row = await h.api.fillField(label, 'Authored value');
        assert.equal(row.ok, false, JSON.stringify(row));
        assert.equal(row.reason, duplicateRoot ? 'wrong_page' : 'control_not_supported');
        assert.equal(h.document.getElementById(id).value, '');
        assert.equal(h.stats.focus, 0);
        assert.equal(h.stats.textInput, 0);
        unchanged(h.document, h.stats);
      } finally { h.dom.window.close(); }
    }
  }
});

test('focus cannot move or replace a work control before its write', async () => {
  for (const [label, id] of [[ORG.label, 'organization-input'], [DESCRIPTION, 'description-input']]) {
    for (const replace of [false, true]) {
      const h = await boot();
      try {
        const original = h.document.getElementById(id);
        const replacement = original.cloneNode(true);
        const events = [];
        for (const type of ['input', 'change', 'blur']) original.addEventListener(type, () => events.push(type));
        original.addEventListener('focus', () => {
          if (replace) original.replaceWith(replacement);
          else h.document.body.append(original.closest('.ant-row.ant-form-item'));
        }, { once: true });
        const row = await h.api.fillField(label, 'Authored value');
        assert.equal(row.ok, false, JSON.stringify(row));
        assert.equal(row.reason, 'control_not_supported');
        assert.equal(original.value, '');
        assert.equal(replacement.value, '');
        assert.deepEqual(events, []);
        assert.equal(h.stats.textInput, 0);
        unchanged(h.document, h.stats);
      } finally { h.dom.window.close(); }
    }
  }
});

test('a focus-populated work control is kept without overwriting its value', async () => {
  for (const [label, id] of [[ORG.label, 'organization-input'], [DESCRIPTION, 'description-input']]) {
    const h = await boot();
    try {
      const input = h.document.getElementById(id);
      input.addEventListener('focus', () => { input.value = 'Value supplied during focus'; }, { once: true });
      const row = await h.api.fillField(label, 'Authored value');
      assert.equal(row.ok, false, JSON.stringify(row));
      assert.equal(row.reason, 'existing_value');
      assert.equal(input.value, 'Value supplied during focus');
      assert.equal(h.stats.textInput, 0);
      unchanged(h.document, h.stats);
    } finally { h.dom.window.close(); }
  }
});

test('work input events stop when ownership changes and readback cannot verify a moved control', async () => {
  for (const [label, id] of [[ORG.label, 'organization-input'], [DESCRIPTION, 'description-input']]) {
    for (const driftEvent of ['input', 'blur']) {
      const h = await boot();
      try {
        const input = h.document.getElementById(id);
        const events = [];
        for (const type of ['input', 'change', 'blur']) input.addEventListener(type, () => events.push(type));
        input.addEventListener(driftEvent, () => h.document.body.append(input.closest('.ant-row.ant-form-item')), { once: true });
        const row = await h.api.fillField(label, 'Authored value');
        assert.equal(row.ok, false, JSON.stringify(row));
        assert.equal(row.reason, 'control_not_supported');
        assert.equal(input.value, 'Authored value');
        assert.deepEqual(events, driftEvent === 'input' ? ['input'] : ['input', 'change', 'blur']);
        assert.equal(h.stats.textInput, 1);
        unchanged(h.document, h.stats);
      } finally { h.dom.window.close(); }
    }
  }
});
