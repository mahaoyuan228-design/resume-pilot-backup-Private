// Offline Never-Save trials for the hotjob pb industry checkbox
// 如应聘研究发展中心行业研究类岗位请勾选（建议仅勾选3~5项）.
// Markup uses tests/fixtures/hotjob-pb-industry-probe-dom.json for page
// structure only. The probe did not open options and did not record display
// captions. Checkbox captions below are synthetic locate-contract tokens.
// A green run is not a live support claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../src/content/hotjob-pb-industry.js', import.meta.url), 'utf8');
const basicSource = readFileSync(new URL('../src/content/hotjob-pb-basic.js', import.meta.url), 'utf8');
const regionSource = readFileSync(new URL('../src/content/hotjob-pb-region.js', import.meta.url), 'utf8');
const eduSource = readFileSync(new URL('../src/content/hotjob-pb-edu-intent.js', import.meta.url), 'utf8');
const eduHistorySource = readFileSync(new URL('../src/content/hotjob-pb-edu-history.js', import.meta.url), 'utf8');
const workSource = readFileSync(new URL('../src/content/hotjob-pb-work.js', import.meta.url), 'utf8');
const certsSource = readFileSync(new URL('../src/content/hotjob-pb-certs.js', import.meta.url), 'utf8');
const intentSource = readFileSync(new URL('../src/content/hotjob-pb-intent-location.js', import.meta.url), 'utf8');
const salarySource = readFileSync(new URL('../src/content/hotjob-pb-intent-salary.js', import.meta.url), 'utf8');
const contactSource = readFileSync(new URL('../src/content/hotjob-pb-contact-eval.js', import.meta.url), 'utf8');
const manifest = readFileSync(new URL('../manifest.json', import.meta.url), 'utf8');
const engine = readFileSync(new URL('../src/content/engine.js', import.meta.url), 'utf8');
const popup = readFileSync(new URL('../src/popup/popup.js', import.meta.url), 'utf8');
const cmsBasic = readFileSync(new URL('../src/background/cms-basic-auto.mjs', import.meta.url), 'utf8');
const cmsEdu = readFileSync(new URL('../src/background/cms-education-task-runner.mjs', import.meta.url), 'utf8');
const cmsChecks = readFileSync(new URL('../src/content/cms-checkboxes.js', import.meta.url), 'utf8');
const mcSource = readFileSync(new URL('../src/content/hotjob-mc-basic.js', import.meta.url), 'utf8');
const mcRunner = readFileSync(new URL('../src/background/hotjob-mc-basic-auto.mjs', import.meta.url), 'utf8');
const templates = readFileSync(new URL('../src/profile/site-question-templates.js', import.meta.url), 'utf8');
const probe = JSON.parse(readFileSync(new URL('../tests/fixtures/hotjob-pb-industry-probe-dom.json', import.meta.url), 'utf8'));

const PAGE = `https://${probe.page.hostname}${probe.page.samplePath}`;
const LABEL = probe.checkbox.label;
const FORBIDDEN = probe.page.forbiddenButtons;
const MODULE = 'hotjob-pb-industry';
const SYN = ['SYN_1', 'SYN_2', 'SYN_3', 'SYN_4', 'SYN_5', 'SYN_6', 'SYN_7', 'SYN_8'];
const THREE = SYN.slice(0, 3);
const choiceStart = templates.indexOf('RESEARCH_CHOICES');
const choiceBlock = templates.slice(choiceStart, templates.indexOf(']);', choiceStart));
const CHOICES = [...choiceBlock.matchAll(/'([^']+)'/gu)].map((match) => match[1]);
const plain = (value) => Array.from(value ?? []);

function esc(value) {
  return String(value).replace(/[&<>"]/gu, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function optionBox(text, state) {
  const checked = (state.checked || []).includes(text) ? ' checked' : '';
  const disabled = state.disableFirst && text === SYN[0] ? ' disabled' : '';
  const hidden = state.hideFirst && text === SYN[0] ? ' hidden' : '';
  const type = state.optionRadio ? 'radio' : (state.dropType ? '' : probe.checkbox.inputType);
  const typeAttr = type ? ` type="${esc(type)}"` : '';
  const control = state.dropCheckboxClass ? 'plain-box' : probe.checkbox.controlClass;
  const input = `<input data-caption="${esc(text)}" class="${esc(control)}"${typeAttr}${checked}${disabled}${hidden}>`;
  if (state.bare) return input;
  if (state.saveButton && text === FORBIDDEN[0]) return `<button type="button">${esc(text)}${input}</button>`;
  return `<label><span>${input}</span><span>${esc(text)}</span></label>`;
}

function optionsHtml(state) {
  const count = state.oneOption ? 1 : SYN.length;
  const rows = [];
  for (let index = 0; index < count; index += 1) {
    let text = SYN[index];
    if (state.duplicateText && index === 1) text = SYN[0];
    if (state.saveButton && index === 0) text = FORBIDDEN[0];
    rows.push(optionBox(text, state));
  }
  return rows.join('');
}

function noise(state) {
  const bits = [];
  if (state.strayText) bits.push(`<input class="${esc(probe.stray.textClass)}" type="text" value="KEEP">`);
  if (state.strayRadio) bits.push(`<input class="${esc(probe.neighbors.obey.controlClass)}" type="${esc(probe.neighbors.obey.inputType)}">`);
  if (state.straySelect) bits.push(`<div class="${esc(probe.neighbors.residence.controlClass)}"></div>`);
  if (state.strayNativeSelect) bits.push('<select></select>');
  if (state.strayPlainCheckbox) bits.push('<input type="checkbox">');
  if (state.strayCalendar) bits.push(`<input class="${esc(probe.stray.calendarClass)}" type="text" readonly>`);
  if (state.strayFile) bits.push('<input type="file">');
  return bits.join('');
}

function industryRow(state, id = 'industry') {
  const itemClass = state.dropAntRow ? 'ant-form-item' : probe.page.itemClass;
  const hidden = state.hiddenRow ? ' hidden' : '';
  if (state.wrapAll) {
    return `<div class="${esc(itemClass)}" data-field="${id}"${hidden}><label>${esc(`${LABEL}*`)}${optionsHtml(state)}</label></div>`;
  }
  const labelHtml = state.missingLabel ? '' : `<label>${esc(state.rawLabel != null ? state.rawLabel : `${LABEL}*`)}</label>`;
  const same = state.sameCaption ? `<label>${esc(`${LABEL}*`)}</label>` : '';
  const extra = state.disagreeLabel ? `<label>${esc(probe.neighbors.name.label)}</label>` : '';
  return `<div class="${esc(itemClass)}" data-field="${id}"${hidden}>${labelHtml}${same}${extra}<span id="${id}-options" class="${esc(probe.page.childrenClass)}">${noise(state)}${optionsHtml(state)}</span></div>`;
}

function row(key, label, inner) {
  return `<div class="${esc(probe.page.itemClass)}" data-field="${esc(key)}"><label>${esc(label)}*</label><span class="${esc(probe.page.childrenClass)}">${inner}</span></div>`;
}

function html(state) {
  const neighbor = probe.neighbors;
  const rootClass = state.dropRoot ? 'page-root' : probe.page.rootClass;
  const shell = state.elForm ? '<div class="el-form"></div>' : '';
  const obey = neighbor.obey.options.map((text) => `<label><span><input class="${esc(neighbor.obey.controlClass)}" type="${esc(neighbor.obey.inputType)}" name="pb-obey"></span><span>${esc(text)}</span></label>`).join('');
  const leaf = state.openCascader ? `<span id="cascader-leaf">${esc(neighbor.residence.token)}</span>` : '';
  const selectClass = state.busy ? probe.menu.openClass : neighbor.residence.controlClass;
  const buttons = [...probe.page.buttonLabels, ...FORBIDDEN.filter((label) => !probe.page.buttonLabels.includes(label))]
    .map((label) => `<button type="button">${esc(label)}</button>`).join('');
  const copy = state.duplicateRow ? industryRow(state, 'industry-copy') : '';
  return `<!doctype html><body>${shell}<div class="${esc(rootClass)}"><div class="${esc(probe.page.contentClass)}">${
    industryRow(state)
  }${copy}${row('name', neighbor.name.label, `<input id="name-input" class="${esc(neighbor.name.controlClass)}" type="${esc(neighbor.name.inputType)}" value="${esc(neighbor.name.token)}">`)
  }${row('residence', neighbor.residence.label, `<span class="${esc(neighbor.residence.menuClass)}">${leaf}<div class="${esc(selectClass)}" id="residence-select"><span id="residence-value">${esc(neighbor.residence.token)}</span></div></span>`)
  }${row('obey', neighbor.obey.label, obey)
  }${`<div class="${esc(neighbor.photo.itemClass)}"><label>${esc(neighbor.photo.label)}*</label><input id="photo" type="file"></div>`
  }${buttons}</div></div><div class="${esc(probe.menu.dropdownClass)}" id="select-menu" hidden></div></body>`;
}

function hide(node, hidden) {
  if (!node) return;
  node.hidden = hidden;
  node.style.display = hidden ? 'none' : '';
}

function wire(document, state) {
  const stats = { checkbox: 0, radio: 0, file: 0, button: 0, forbidden: 0, escape: 0, captions: [] };
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (button) {
      stats.button += 1;
      if (FORBIDDEN.includes((button.textContent || '').replace(/\s+/gu, ''))) stats.forbidden += 1;
    }
    if (event.target.matches?.('input[type="file"]')) stats.file += 1;
    if (event.target.matches?.('input.ant-radio-input, input[type="radio"]')) stats.radio += 1;
    if (event.target.matches?.('input.ant-checkbox-input, input[type="checkbox"]')) {
      stats.checkbox += 1;
      stats.captions.push(event.target.getAttribute('data-caption'));
    }
    if (state.freezeCheck && event.target.matches?.('input.ant-checkbox-input')) event.preventDefault();
  }, true);
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    stats.escape += 1;
    if (state.ignoreEscape) return;
    const select = document.getElementById('residence-select');
    select?.classList.remove('ant-select-open', 'ant-select-focused');
    hide(document.getElementById('select-menu'), true);
    document.getElementById('cascader-leaf')?.remove();
  });
  if (state.busy) hide(document.getElementById('select-menu'), false);
  if (state.readonlyFirst) {
    const box = document.querySelector('[data-field="industry"] input');
    if (box) box.readOnly = true;
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
  return { dom, window, document, stats, api: window.ResumeHotjobPbIndustry };
}

function checkedCaptions(document) {
  return [...document.querySelectorAll('[data-field="industry"] input[data-caption]')]
    .filter((node) => node.checked)
    .map((node) => node.getAttribute('data-caption'));
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
  assert.equal(document.getElementById('name-input').value, probe.neighbors.name.token);
  assert.equal(document.getElementById('residence-value').textContent, probe.neighbors.residence.token);
  assert.equal([...document.querySelectorAll('input[name="pb-obey"]')].some((node) => node.checked), false);
  assert.equal(document.getElementById('photo').files.length, 0);
  assert.equal(stats.forbidden, 0);
  assert.equal(stats.file, 0);
  assert.equal(stats.radio, 0);
  assert.equal(stats.button, 0);
}

test('source stays unregistered and does not claim support', () => {
  assert.match(source, /ResumeHotjobPbIndustry/);
  assert.match(source, /liveSupportClaimed:\s*false/);
  assert.match(source, /supportClaimed:\s*false/);
  assert.match(source, /neverSave:\s*true/);
  assert.match(source, /leftUnsaved:\s*true/);
  assert.match(source, /preexisting_same_value/);
  assert.match(source, /suggested_count/);
  assert.match(source, /ambiguous_label/);
  assert.match(source, /SUGGESTED_MIN = 3/);
  assert.match(source, /SUGGESTED_MAX = 5/);
  assert.match(source, /保存\|提交\|投递\|删除\|下一步\|返回\|确定/);
  assert.doesNotMatch(source, /liveSupportClaimed:\s*true/);
  assert.doesNotMatch(source, /supportClaimed:\s*true/);
  assert.doesNotMatch(source, /已支持/);
  assert.doesNotMatch(source, /hotjob-mc-basic|ResumeHotjobMc|ResumeHotjobPbBasic|ResumeHotjobPbRegion|ResumeHotjobPbWork|ResumeHotjobPbEdu|ResumeHotjobPbIntent|ResumeHotjobPbCerts|ResumeHotjobPbContact|mc\/deliver|cms-region|engine\.js|cms-checkboxes/);
  assert.doesNotMatch(source, /textContent\s*=/);
  assert.doesNotMatch(source, /\.value\s*=[^=]/);
  assert.doesNotMatch(source, /\.checked\s*=/);
  assert.doesNotMatch(source, /innerHTML/);
  assert.doesNotMatch(source, /\bexport\s/);
  assert.doesNotMatch(source, /111601|111905/);
  assert.doesNotMatch(source, /=== 32|!== 32/);
  assert.doesNotMatch(source, /虚构行业/);
  for (const token of [LABEL, 'input.ant-checkbox-input', 'ant-row', 'ant-form-item', probe.page.rootClass, 'Escape']) {
    assert.equal(source.includes(token), true, token);
  }
  assert.equal(CHOICES.length, 32);
  for (const name of CHOICES) {
    assert.equal(source.includes(name), false, name);
    assert.equal(JSON.stringify(probe).includes(name), false, name);
  }
  for (const token of SYN) {
    assert.equal(source.includes(token), false, token);
    assert.equal(JSON.stringify(probe).includes(token), false, token);
  }
  const outsiders = [
    manifest, engine, popup, basicSource, regionSource, eduSource, eduHistorySource,
    workSource, certsSource, intentSource, salarySource, contactSource, cmsBasic,
    cmsEdu, cmsChecks, mcSource, mcRunner
  ];
  for (const file of outsiders) {
    assert.equal(file.includes(MODULE), false);
    assert.equal(file.includes('ResumeHotjobPbIndustry'), false);
  }
});

test('fixture keeps structure tokens and does not store option captions', () => {
  assert.equal(probe.checkbox.optionsOpened, false);
  assert.deepEqual(probe.checkbox.optionCaptions, []);
  assert.equal(probe.checkbox.valueSample, '0/111601/111905');
  assert.equal(probe.checkbox.controlClass, 'ant-checkbox-input');
  assert.equal(probe.checkbox.inputType, 'checkbox');
  assert.equal(probe.checkbox.suggested.min, 3);
  assert.equal(probe.checkbox.suggested.max, 5);
  assert.equal(probe.checkbox.suggested.forceWhenPreexistingMatches, undefined);
  const built = html({ checked: THREE });
  assert.match(built, new RegExp(LABEL.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  assert.match(built, new RegExp(probe.checkbox.controlClass));
  assert.match(built, new RegExp(probe.page.rootClass));
  assert.doesNotMatch(built, /111601|111905/);
  for (const name of CHOICES) assert.equal(built.includes(name), false, name);
});

test('inspect matches the one checkbox row and does not claim support', async () => {
  const h = await boot({ checked: ['SYN_2', 'SYN_1'] });
  try {
    const view = h.api.inspect();
    assert.equal(h.api.liveSupportClaimed, false);
    assert.equal(h.api.supportClaimed, false);
    assert.equal(h.api.neverSave, true);
    assert.equal(h.api.leftUnsaved, true);
    assert.equal(h.window.ResumeHotjobPbBasic, undefined);
    assert.equal(h.window.ResumeHotjobPbIntentLocation, undefined);
    assertNeverSaved(view);
    assert.equal(view.ok, true);
    assert.equal(view.reason, 'structure_matched');
    assert.equal(view.fields.length, 1);
    assert.equal(view.fields[0].label, LABEL);
    assert.equal(view.fields[0].kind, 'checkbox');
    assert.equal(view.fields[0].supported, false);
    assert.equal(view.fields[0].reason, 'structure_matched');
    assert.deepEqual(plain(view.fields[0].value), ['SYN_1', 'SYN_2']);
    assert.equal(h.stats.checkbox, 0);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('an empty group checks a unique 3-caption list and leaves it unsaved', async () => {
  const h = await boot({});
  try {
    const row = await h.api.fillField(` ${LABEL}*： `, [' SYN_3 ', 'SYN_1', 'SYN_2']);
    assert.equal(row.ok, true, JSON.stringify(row));
    assert.equal(row.status, 'verified');
    assert.equal(row.reason, 'readback_matched');
    assert.deepEqual(plain(row.before), []);
    assert.deepEqual(plain(row.after), THREE);
    assert.deepEqual(plain(row.expected), ['SYN_3', 'SYN_1', 'SYN_2']);
    assert.equal(row.clickedOptions, 3);
    assert.equal(row.opened, false);
    assert.equal(row.stillOpen, 0);
    assertNeverSaved(row);
    assert.deepEqual(h.stats.captions, ['SYN_3', 'SYN_1', 'SYN_2']);
    assert.deepEqual(checkedCaptions(h.document), THREE);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('fillFields accepts a JSON caption list of 4 or 5 and does not click save', async () => {
  const four = await boot({});
  try {
    const filled = await four.api.fillFields({ [LABEL]: JSON.stringify(['SYN_4', 'SYN_2', 'SYN_1', 'SYN_3']) });
    assert.equal(filled.ok, true, JSON.stringify(filled.fields));
    assertNeverSaved(filled);
    assert.equal(filled.fields[0].reason, 'readback_matched');
    assert.equal(filled.fields[0].clickedOptions, 4);
    assert.deepEqual(checkedCaptions(four.document), ['SYN_1', 'SYN_2', 'SYN_3', 'SYN_4']);
    assert.equal(four.stats.checkbox, 4);
    unchanged(four.document, four.stats);
  } finally { four.dom.window.close(); }

  const five = await boot({});
  try {
    const row = await five.api.fillField(LABEL, SYN.slice(0, 5));
    assert.equal(row.reason, 'readback_matched', JSON.stringify(row));
    assert.equal(row.clickedOptions, 5);
    assert.deepEqual(checkedCaptions(five.document), SYN.slice(0, 5));
    unchanged(five.document, five.stats);
  } finally { five.dom.window.close(); }
});

test('a preexisting checked set verifies without toggling, including outside 3~5', async () => {
  const pair = await boot({ checked: ['SYN_2', 'SYN_1'] });
  try {
    const row = await pair.api.fillField(LABEL, ['SYN_1', 'SYN_2']);
    assert.equal(row.ok, true, JSON.stringify(row));
    assert.equal(row.status, 'verified');
    assert.equal(row.reason, 'preexisting_same_value');
    assert.deepEqual(plain(row.before), ['SYN_1', 'SYN_2']);
    assert.deepEqual(plain(row.after), ['SYN_1', 'SYN_2']);
    assert.deepEqual(plain(row.expected), ['SYN_1', 'SYN_2']);
    assert.equal(row.clickedOptions, 0);
    assert.equal(row.opened, false);
    assertNeverSaved(row);
    assert.equal(pair.stats.checkbox, 0);
    assert.deepEqual(checkedCaptions(pair.document), ['SYN_1', 'SYN_2']);
    unchanged(pair.document, pair.stats);
  } finally { pair.dom.window.close(); }

  const six = SYN.slice(0, 6);
  const wide = await boot({ checked: [...six].reverse() });
  try {
    const row = await wide.api.fillField(LABEL, six);
    assert.equal(row.reason, 'preexisting_same_value', JSON.stringify(row));
    assert.equal(row.clickedOptions, 0);
    assert.equal(wide.stats.checkbox, 0);
    assert.deepEqual(checkedCaptions(wide.document), six);
    unchanged(wide.document, wide.stats);
  } finally { wide.dom.window.close(); }

  const same = await boot({ sameCaption: true, checked: THREE });
  try {
    const row = await same.api.fillField(LABEL.replace('（', '(').replace('）', ')'), [...THREE].reverse());
    assert.equal(row.reason, 'preexisting_same_value', JSON.stringify(row));
    assert.equal(same.stats.checkbox, 0);
    unchanged(same.document, same.stats);
  } finally { same.dom.window.close(); }
});

test('a different preexisting set is kept and counts outside 3~5 do not get checked', async () => {
  const h = await boot({ checked: ['SYN_1', 'SYN_2', 'SYN_4'] });
  try {
    const different = await h.api.fillField(LABEL, THREE);
    const partial = await h.api.fillField(LABEL, ['SYN_1', 'SYN_2', 'SYN_4', 'SYN_5']);
    assert.equal(different.reason, 'existing_value');
    assert.equal(different.status, 'skipped');
    assert.equal(different.ok, false);
    assert.equal(different.clickedOptions, 0);
    assert.equal(partial.reason, 'existing_value');
    assert.equal(partial.clickedOptions, 0);
    assertNeverSaved(different);
    assert.deepEqual(checkedCaptions(h.document), ['SYN_1', 'SYN_2', 'SYN_4']);
    assert.equal(h.stats.checkbox, 0);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }

  for (const value of [SYN.slice(0, 1), SYN.slice(0, 2), SYN.slice(0, 6), SYN]) {
    const empty = await boot({});
    try {
      const row = await empty.api.fillField(LABEL, value);
      assert.equal(row.reason, 'suggested_count', JSON.stringify(value));
      assert.equal(row.ok, false);
      assert.equal(row.clickedOptions, 0);
      assert.deepEqual(checkedCaptions(empty.document), []);
      assert.equal(empty.stats.checkbox, 0);
      unchanged(empty.document, empty.stats);
    } finally { empty.dom.window.close(); }
  }
});

test('empty, non-list, internal codes, and unknown captions fail closed', async () => {
  const h = await boot({});
  try {
    for (const value of ['', '   ', null, [], undefined]) {
      const row = await h.api.fillField(LABEL, value);
      assert.equal(row.reason, 'missing_profile_value', JSON.stringify(value));
      assert.equal(row.clickedOptions, 0);
      assertNeverSaved(row);
    }
    for (const value of [1, { caption: SYN[0] }, 'SYN_1', probe.checkbox.valueSample, ...probe.checkbox.valueSample.split('/'), '[', '["SYN_1",]']) {
      const row = await h.api.fillField(LABEL, value);
      assert.equal(row.reason, 'profile_not_list', JSON.stringify(value));
      assert.equal(row.clickedOptions, 0);
    }
    const duplicate = await h.api.fillField(LABEL, ['SYN_1', ' SYN_1 ', 'SYN_2']);
    const blank = await h.api.fillField(LABEL, ['SYN_1', ' ', 'SYN_2']);
    const typed = await h.api.fillField(LABEL, ['SYN_1', 2, 'SYN_2']);
    const missing = await h.api.fillField(LABEL, ['SYN_1', 'SYN_2', 'NO_SUCH_CAPTION']);
    assert.equal(duplicate.reason, 'profile_not_unique');
    assert.equal(blank.reason, 'profile_not_list');
    assert.equal(typed.reason, 'profile_not_list');
    assert.equal(missing.reason, 'option_not_found');
    assert.equal(missing.clickedOptions, 0);
    for (const label of [probe.neighbors.name.label, probe.neighbors.residence.label, probe.neighbors.obey.label, probe.neighbors.photo.label, '期望工作地点', `${LABEL}其它`]) {
      const row = await h.api.fillField(label, THREE);
      assert.equal(row.reason, 'label_not_allowed', label);
    }
    const none = await h.api.fillFields(null);
    assert.equal(none.ok, false);
    assertNeverSaved(none);
    assert.equal(none.fields[0].reason, 'missing_profile_value');
    assert.equal(h.stats.checkbox, 0);
    assert.deepEqual(checkedCaptions(h.document), []);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('Escape leaves checks unsaved and an open menu blocks the fill', async () => {
  const h = await boot({ checked: THREE });
  try {
    const canceled = await h.api.cancelField(` ${LABEL} `);
    assert.equal(canceled.ok, true, JSON.stringify(canceled));
    assert.equal(canceled.reason, 'left_unsaved');
    assert.equal(canceled.canceled, true);
    assert.equal(canceled.stillOpen, 0);
    assert.deepEqual(plain(canceled.before), THREE);
    assert.deepEqual(plain(canceled.after), THREE);
    assertNeverSaved(canceled);
    assert.ok(h.stats.escape >= 1);
    assert.equal(h.stats.checkbox, 0);
    assert.deepEqual(checkedCaptions(h.document), THREE);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }

  const busy = await boot({ busy: true, openCascader: true });
  try {
    const row = await busy.api.fillField(LABEL, THREE);
    assert.equal(row.reason, 'control_busy', JSON.stringify(row));
    assert.equal(row.clickedOptions, 0);
    assert.equal(row.stillOpen, 1);
    assert.equal(busy.stats.checkbox, 0);
    assert.equal(busy.document.getElementById('select-menu').hidden, false);
    unchanged(busy.document, busy.stats);
  } finally { busy.dom.window.close(); }

  const stuck = await boot({ busy: true, openCascader: true, ignoreEscape: true, checked: ['SYN_8'] });
  try {
    const canceled = await stuck.api.cancelField(LABEL);
    assert.equal(canceled.ok, false);
    assert.equal(canceled.reason, 'menu_cleanup_failed');
    assert.equal(canceled.stillOpen, 1);
    assert.deepEqual(plain(canceled.after), ['SYN_8']);
    assert.equal(stuck.stats.checkbox, 0);
    unchanged(stuck.document, stuck.stats);
  } finally { stuck.dom.window.close(); }
});

test('a forbidden button caption is not clicked', async () => {
  const h = await boot({ saveButton: true });
  try {
    const row = await h.api.fillField(LABEL, [FORBIDDEN[0], 'SYN_2', 'SYN_3']);
    assert.equal(row.reason, 'never_save', JSON.stringify(row));
    assert.equal(row.ok, false);
    assert.equal(row.canceled, true);
    assert.equal(row.clickedOptions, 0);
    assertNeverSaved(row);
    assert.equal(h.stats.checkbox, 0);
    assert.equal(h.stats.button, 0);
    assert.equal(h.stats.forbidden, 0);
    assert.deepEqual(checkedCaptions(h.document), []);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a click that does not stick fails closed', async () => {
  const h = await boot({ freezeCheck: true });
  try {
    const row = await h.api.fillField(LABEL, THREE);
    assert.equal(row.reason, 'readback_mismatch', JSON.stringify(row));
    assert.equal(row.ok, false);
    assert.equal(row.clickedOptions, 1);
    assertNeverSaved(row);
    assert.deepEqual(checkedCaptions(h.document), []);
    assert.equal(h.stats.forbidden, 0);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('drift, ambiguous labels, and the wrong page fail closed without a toggle', async () => {
  const cases = [
    [{ dropAntRow: true }, 'control_not_supported'],
    [{ duplicateRow: true }, 'ambiguous_label'],
    [{ disagreeLabel: true }, 'control_not_supported'],
    [{ disableFirst: true }, 'control_not_supported'],
    [{ hideFirst: true }, 'control_not_supported'],
    [{ readonlyFirst: true }, 'control_not_supported'],
    [{ bare: true }, 'control_not_supported'],
    [{ oneOption: true }, 'control_not_supported'],
    [{ duplicateText: true }, 'control_not_supported'],
    [{ dropCheckboxClass: true }, 'control_not_supported'],
    [{ optionRadio: true }, 'control_not_supported'],
    [{ dropType: true }, 'control_not_supported'],
    [{ strayText: true }, 'control_not_supported'],
    [{ strayRadio: true }, 'control_not_supported'],
    [{ straySelect: true }, 'control_not_supported'],
    [{ strayNativeSelect: true }, 'control_not_supported'],
    [{ strayPlainCheckbox: true }, 'control_not_supported'],
    [{ strayCalendar: true }, 'control_not_supported'],
    [{ strayFile: true }, 'control_not_supported'],
    [{ wrapAll: true }, 'control_not_supported'],
    [{ missingLabel: true }, 'control_not_supported'],
    [{ hiddenRow: true }, 'control_not_supported'],
    [{ dropRoot: true }, 'wrong_page'],
    [{ elForm: true }, 'wrong_page'],
    [{ url: 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/mc/deliver/operationResumer' }, 'wrong_page'],
    [{ url: 'https://gszq.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html' }, 'wrong_page'],
    [{ url: 'http://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html' }, 'wrong_page'],
    [{ url: 'https://wecruit.hotjob.cn/pb/resumeOperation.html' }, 'wrong_page']
  ];
  for (const [state, reason] of cases) {
    const h = await boot(state);
    try {
      const row = await h.api.fillField(LABEL, THREE);
      assert.equal(row.reason, reason, JSON.stringify({ state, row }));
      assert.equal(row.ok, false);
      assert.equal(row.clickedOptions, 0);
      assert.equal(row.supportClaimed, false);
      assert.equal(row.liveSupportClaimed, false);
      assert.equal(h.stats.checkbox, 0, JSON.stringify(state));
      assert.equal(h.stats.forbidden, 0, JSON.stringify(state));
      if (!state.dropRoot && !state.elForm && !state.url) unchanged(h.document, h.stats);
    } finally { h.dom.window.close(); }
  }
});

test('a hidden page fails closed before a click', async () => {
  const h = await boot({});
  try {
    Object.defineProperty(h.document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    const row = await h.api.fillField(LABEL, THREE);
    const canceled = await h.api.cancelField(LABEL);
    assert.equal(row.reason, 'fill_interrupted_page_hidden');
    assert.equal(canceled.reason, 'left_unsaved');
    assert.equal(row.clickedOptions, 0);
    assert.equal(h.stats.checkbox, 0);
    assertNeverSaved(row);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});
