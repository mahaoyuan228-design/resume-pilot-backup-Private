// Offline Never-Save trials for hotjob pb 现居住地 / 籍贯 / 期望面试地点.
// Markup is built from tests/fixtures/hotjob-pb-region-probe-dom.json (2026-10-23
// probe classes and menu text only). A green run is not a live support claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const root = new URL('..', import.meta.url);
const source = readFileSync(new URL('../src/content/hotjob-pb-region.js', import.meta.url), 'utf8');
const probe = JSON.parse(readFileSync(new URL('../tests/fixtures/hotjob-pb-region-probe-dom.json', import.meta.url), 'utf8'));
const PAGE = `https://${probe.page.hostname}${probe.page.samplePath}`;
const RESIDENCE = probe.cascader.labels[0];
const ORIGIN = probe.cascader.labels[1];
const INTERVIEW = probe.select.label;
const INTENT = probe.outOfScopeCascader.label;
const FORBIDDEN = probe.page.forbiddenButtons;

function esc(value) {
  return String(value).replace(/[&<>"]/gu, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function classes(value) {
  return String(value).split(/\s+/u).filter(Boolean);
}

function menu(options, duplicate) {
  const rows = [...options];
  if (duplicate) rows.push(duplicate);
  return `<ul hidden>${rows.map((text) => `<li>${esc(text)}</li>`).join('')}</ul>`;
}

function cascaderBody(id, value, state) {
  const live = probe.cascader.livePair;
  if (state.ambiguousValue && id === 'residence') {
    return `<span class="${esc(live.selectedValueClass)}">北京市</span><span class="${esc(live.selectedValueClass)}">上海市</span>`;
  }
  if (state.cascaderMash && (id === 'residence' || id === 'origin')) {
    const prompt = `${live.placeholderPrefix}${id === 'origin' ? ORIGIN : RESIDENCE}`;
    return `<span class="${esc(live.placeholderClass)}">${esc(prompt)}</span><span class="${esc(live.selectedValueClass)}" id="${id}-value">${esc(value)}</span>`;
  }
  return `<span id="${id}-value">${esc(value)}</span>`;
}

function twinMarkup(id, value, state) {
  const live = probe.cascader.livePair;
  const text = state.twinDrift && id === 'residence' ? '上海市' : value;
  const className = [
    probe.cascader.controlClass,
    state.twinDisabled && id === 'residence' ? 'ant-select-disabled' : '',
    state.twinAllowClear && id === 'residence' ? 'ant-select-allow-clear' : ''
  ].filter(Boolean).join(' ');
  const hidden = state.twinHidden && id === 'residence' ? ' hidden' : '';
  const body = state.cascaderMash
    ? `<span class="${esc(live.placeholderClass)}">${esc(live.placeholderPrefix + (id === 'origin' ? ORIGIN : RESIDENCE))}</span><span class="${esc(live.selectedValueClass)}">${esc(text)}</span>`
    : `<span>${esc(text)}</span>`;
  return `<div class="${esc(className)}"${hidden}>${body}</div>`;
}

function cascaderField(label, value, options, state, id) {
  const itemClass = state.dropAntRow && id === 'residence' ? 'ant-form-item' : probe.page.itemClass;
  const wrapClass = state.dropWrap && id === 'residence' ? '' : probe.cascader.menuClass;
  const selectClass = [
    probe.cascader.controlClass,
    state.allowClearOnCascader && id === 'residence' ? 'ant-select-allow-clear' : ''
  ].filter(Boolean).join(' ');
  const paired = (id === 'residence' || id === 'origin') && state.twinSelect
    || (id === 'residence' && (state.twinDrift || state.twinDisabled || state.twinAllowClear || state.twinHidden));
  const extra = [
    state.extraSelect && id === 'residence' ? `<div class="${esc(probe.cascader.controlClass)}"><span></span></div>` : '',
    paired ? twinMarkup(id, value, state) : '',
    state.tripleSelect && id === 'residence'
      ? `<div class="${esc(probe.cascader.controlClass)}"><span>${esc(probe.cascader.livePair.sameDisplay)}</span></div><div class="${esc(probe.cascader.controlClass)}"><span>${esc(probe.cascader.livePair.sameDisplay)}</span></div>`
      : ''
  ].join('');
  const labelHtml = `<label>${esc(label)}*</label>`;
  return `<div class="${esc(itemClass)}" data-field="${id}">${labelHtml}<span class="${esc(probe.page.childrenClass)}"><span class="${esc(wrapClass)}"><div class="${esc(selectClass)}" id="${id}-select">${cascaderBody(id, value, state)}</div>${extra}${menu(options, id === 'residence' ? state.duplicateOption : '')}</span></span></div>`;
}

function interviewValue(value, state) {
  const live = probe.select.liveReadback;
  if (state.placeholderMash === 'class') {
    return `<div class="${esc(live.faceClass)}" role="${esc(live.faceRole)}"><span class="${esc(live.placeholderClass)}">${esc(live.placeholderPrefix + INTERVIEW)}</span><span class="${esc(live.selectedValueClass)}" id="interview-value">${esc(value)}</span></div>`;
  }
  const shown = state.placeholderMash === 'text' ? `${live.placeholderPrefix}${INTERVIEW}${value}` : value;
  const inner = `<span id="interview-value">${esc(shown)}</span>`;
  return state.closedSearch ? `<div class="${esc(live.faceClass)}" role="${esc(live.faceRole)}">${inner}</div>` : inner;
}

function interviewField(value, state) {
  const selectClass = state.dropAllowClear
    ? probe.cascader.controlClass
    : probe.select.controlClass;
  const trigger = state.dropSearch ? '' : `<input class="${esc(probe.select.triggerClass)}" type="text" value="">`;
  const dropdownClass = state.badDropdown
    ? 'ant-select-dropdown ant-select-dropdown-placement-bottomLeft'
    : probe.select.dropdownClass;
  return `<div class="${esc(probe.page.itemClass)}" data-field="interview"><label>${esc(INTERVIEW)}*</label><span class="${esc(probe.page.childrenClass)}"><div class="${esc(selectClass)}" id="interview-select">${interviewValue(value, state)}${trigger}</div></span></div><div class="${esc(dropdownClass)}" id="interview-menu" hidden><ul>${probe.select.optionsSample.map((text) => `<li>${esc(text)}</li>`).join('')}</ul></div>`;
}

function html(state) {
  const rootClass = state.dropRoot ? 'page-root' : probe.page.rootClass;
  const shell = state.elForm ? '<div class="el-form"></div>' : '';
  const duplicate = state.duplicateResidence
    ? `<div class="${esc(probe.page.itemClass)}"><label>${esc(RESIDENCE)}*</label><span class="${esc(probe.cascader.menuClass)}"><div class="${esc(probe.cascader.controlClass)}"><span>北京市</span></div></span></div>`
    : '';
  const buttons = [...probe.page.buttonLabels, ...FORBIDDEN.filter((label) => !probe.page.buttonLabels.includes(label))]
    .map((label) => `<button type="button">${esc(label)}</button>`).join('');
  return `<!doctype html><body>${shell}<div class="${esc(rootClass)}"><div class="${esc(probe.page.contentClass)}">${
    cascaderField(RESIDENCE, state.residence ?? '', probe.cascader.optionsSample, state, 'residence')
  }${cascaderField(ORIGIN, state.origin ?? '', probe.cascader.optionsSample, state, 'origin')
  }${interviewField(state.interview ?? '', state)
  }${cascaderField(INTENT, state.intent ?? probe.outOfScopeCascader.valueSample, probe.cascader.optionsSample, state, 'intent')
  }<div class="${esc(probe.page.itemClass)}"><label>${esc(probe.neighbor.label)}*</label><input id="address" class="${esc(probe.neighbor.controlClass)}" value="${esc(probe.neighbor.token)}"></div><div class="${esc(probe.page.itemClass)}"><label>照片*</label><input id="photo" type="file"></div>${duplicate}${buttons}</div></div></body>`;
}

function hide(node, hidden) {
  node.hidden = hidden;
  node.style.display = hidden ? 'none' : '';
}

function closeWidgets(document) {
  for (const select of document.querySelectorAll('.ant-select')) {
    select.classList.remove('ant-select-open', 'ant-select-focused');
  }
  for (const menu of document.querySelectorAll('.cascader-plugins-wrap ul, #interview-menu')) hide(menu, true);
}

function wire(document, state) {
  const stats = { open: 0, option: 0, escape: 0, forbidden: 0, file: 0, openClass: '', triggerClass: '', faceClass: '' };
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (button && FORBIDDEN.includes(button.textContent.trim())) stats.forbidden += 1;
    if (event.target.matches?.('input[type="file"]')) stats.file += 1;
  }, true);
  for (const select of document.querySelectorAll('.ant-select')) {
    const wrap = select.closest('.cascader-plugins-wrap');
    const menu = wrap?.querySelector('ul') || null;
    select.addEventListener('click', (event) => {
      if (menu && menu.contains(event.target)) return;
      stats.open += 1;
      if (event.target.classList?.contains(probe.select.triggerClass)) stats.triggerClass = probe.select.triggerClass;
      if (event.target.closest?.(`.${probe.select.liveReadback.faceClass}`)) stats.faceClass = probe.select.liveReadback.faceClass;
      select.classList.add(...classes(probe.cascader.openClass));
      stats.openClass = select.className;
      if (menu) hide(menu, false);
      if (select.id === 'interview-select') hide(document.getElementById('interview-menu'), false);
    });
    menu?.addEventListener('click', (event) => {
      const li = event.target.closest('li');
      if (!li || !menu.contains(li)) return;
      stats.option += 1;
      const slot = select.querySelector('.ant-select-selection-selected-value, [id$="-value"]') || select.querySelector('span');
      slot.textContent = li.textContent.trim();
      closeWidgets(document);
    });
  }
  document.getElementById('interview-menu')?.addEventListener('click', (event) => {
    const li = event.target.closest('li');
    if (!li) return;
    stats.option += 1;
    document.getElementById('interview-value').textContent = li.textContent.trim();
    closeWidgets(document);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    stats.escape += 1;
    if (state.ignoreEscape) return;
    closeWidgets(document);
  });
  if (state.busy) {
    document.getElementById('interview-select').classList.add('ant-select-open', 'ant-select-focused');
    hide(document.getElementById('interview-menu'), false);
  }
  return stats;
}

function patch(window, state = {}) {
  window.Element.prototype.getClientRects = function () {
    if (state.closedSearch && this.classList?.contains(probe.select.triggerClass)) return [];
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
  return { dom, window, document, stats, api: window.ResumeHotjobPbRegion };
}

function unchanged(document, stats) {
  assert.equal(document.getElementById('address').value, probe.neighbor.token);
  assert.equal(document.getElementById('intent-value').textContent, probe.outOfScopeCascader.valueSample);
  assert.equal(document.getElementById('photo').files.length, 0);
  assert.equal(stats.forbidden, 0);
  assert.equal(stats.file, 0);
}

test('source stays on the probed pb classes and does not claim support', () => {
  assert.match(source, /ResumeHotjobPbRegion/);
  assert.match(source, /liveSupportClaimed:\s*false/);
  assert.doesNotMatch(source, /liveSupportClaimed:\s*true/);
  assert.doesNotMatch(source, /已支持/);
  assert.doesNotMatch(source, /hotjob-mc-basic|ResumeHotjobMc|mc\/deliver/);
  assert.doesNotMatch(source, /textContent\s*=/);
  assert.doesNotMatch(source, /\.value\s*=/);
  assert.doesNotMatch(source, /innerHTML/);
  assert.doesNotMatch(source, /ant-cascader-menus|form-cell|ant-select-selection--single/);
  for (const token of [
    ...classes(probe.page.itemClass),
    ...classes(probe.cascader.controlClass),
    ...classes(probe.cascader.openClass),
    probe.cascader.menuClass,
    ...classes(probe.select.controlClass),
    probe.select.triggerClass,
    ...classes(probe.select.dropdownClass),
    probe.page.rootClass,
    probe.cascader.livePair.selectedValueClass,
    probe.cascader.livePair.placeholderClass,
    probe.cascader.livePair.placeholderPrefix,
    probe.select.liveReadback.faceClass,
    '[role="combobox"]',
    '.ant-select-selector',
    '.ant-select-selection-item'
  ]) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  }
});

test('fixture html uses only the probe class list and menu text', () => {
  const built = html({});
  for (const token of [
    probe.page.rootClass, probe.page.contentClass, probe.page.childrenClass,
    ...classes(probe.page.itemClass), ...classes(probe.cascader.controlClass),
    probe.cascader.menuClass, ...classes(probe.select.controlClass),
    probe.select.triggerClass, ...classes(probe.select.dropdownClass),
    probe.neighbor.controlClass
  ]) assert.match(built, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  for (const option of probe.cascader.optionsSample) assert.match(built, new RegExp(`>${option}<`));
  for (const option of probe.select.optionsSample) assert.match(built, new RegExp(`>${option}<`));
  for (const label of probe.page.buttonLabels) assert.match(built, new RegExp(`>${label}<`));
  assert.doesNotMatch(built, /ant-cascader-menus|ant-select-selection--single|form-cell/);
});

test('inspect matches the three probed fields and does not claim support', async () => {
  const h = await boot({ residence: probe.cascader.valueSample, origin: probe.cascader.valueSample, interview: probe.select.valueSample });
  try {
    const view = h.api.inspect();
    assert.equal(h.api.liveSupportClaimed, false);
    assert.equal(view.liveSupportClaimed, false);
    assert.equal(view.complete, false);
    assert.equal(view.fields.length, 3);
    assert.equal(view.fields.every((field) => field.supported === false), true);
    assert.equal(view.fields.find((field) => field.label === RESIDENCE).reason, 'structure_matched');
    assert.equal(view.fields.find((field) => field.label === RESIDENCE).value, '北京市');
    assert.equal(view.fields.find((field) => field.label === ORIGIN).reason, 'structure_matched');
    assert.equal(view.fields.find((field) => field.label === INTERVIEW).reason, 'structure_matched');
    assert.equal(view.fields.find((field) => field.label === INTERVIEW).value, '北京');
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('empty cascader and interview select read back the clicked probe option', async () => {
  const h = await boot({});
  try {
    const residence = await h.api.fillField(RESIDENCE, '上海市');
    const origin = await h.api.fillField(ORIGIN, '天津市');
    const interview = await h.api.fillField(INTERVIEW, '北京');
    assert.equal(residence.ok, true, JSON.stringify(residence));
    assert.equal(residence.status, 'verified');
    assert.equal(residence.reason, 'readback_matched');
    assert.equal(residence.after, '上海市');
    assert.equal(residence.opened, true);
    assert.equal(residence.liveSupportClaimed, false);
    assert.equal(residence.complete, false);
    assert.equal(residence.saved, false);
    assert.equal(residence.skippedSave, true);
    assert.equal(origin.reason, 'readback_matched');
    assert.equal(origin.after, '天津市');
    assert.equal(interview.reason, 'readback_matched');
    assert.equal(interview.after, '北京');
    assert.equal(h.stats.triggerClass, probe.select.triggerClass);
    assert.match(h.stats.openClass, /ant-select-open/);
    assert.match(h.stats.openClass, /ant-select-focused/);
    assert.match(h.stats.openClass, /ant-select-enabled/);
    assert.equal(h.document.getElementById('residence-value').textContent, '上海市');
    assert.equal(h.document.getElementById('origin-value').textContent, '天津市');
    assert.equal(h.document.getElementById('interview-value').textContent, '北京');
    assert.equal(h.document.querySelectorAll('.ant-select-open').length, 0);
    assert.equal(h.document.getElementById('interview-menu').hidden, true);
    assert.equal(h.stats.option, 3);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('fillFields reads back all three and leaves neighbors untouched', async () => {
  const h = await boot({});
  try {
    const filled = await h.api.fillFields({ [RESIDENCE]: '上海市', [ORIGIN]: '天津市', [INTERVIEW]: '北京' });
    assert.equal(filled.ok, true, JSON.stringify(filled.fields));
    assert.equal(filled.liveSupportClaimed, false);
    assert.equal(filled.complete, false);
    assert.equal(filled.saved, false);
    assert.equal(filled.fields.map((field) => field.reason).join(','), 'readback_matched,readback_matched,readback_matched');
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('preexisting 北京市 / 北京 does not open a menu or paint', async () => {
  const h = await boot({
    residence: probe.cascader.valueSample,
    origin: probe.cascader.valueSample,
    interview: probe.select.valueSample
  });
  try {
    const residence = await h.api.fillField(RESIDENCE, '北京市');
    const interview = await h.api.fillField(INTERVIEW, '北京');
    assert.equal(residence.reason, 'preexisting_same_value');
    assert.equal(residence.status, 'verified');
    assert.equal(residence.opened, false);
    assert.equal(interview.reason, 'preexisting_same_value');
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.option, 0);
    assert.equal(h.document.getElementById('residence-value').textContent, '北京市');
    assert.equal(h.document.getElementById('interview-value').textContent, '北京');
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a different existing value is kept and the menu stays closed', async () => {
  const h = await boot({ residence: '北京市' });
  try {
    const residence = await h.api.fillField(RESIDENCE, '上海市');
    assert.equal(residence.reason, 'existing_value');
    assert.equal(residence.status, 'skipped');
    assert.equal(residence.ok, false);
    assert.equal(h.stats.open, 0);
    assert.equal(h.document.getElementById('residence-value').textContent, '北京市');
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('empty values and out-of-scope labels fail closed without opening', async () => {
  const h = await boot({});
  try {
    for (const value of ['', '   ', null]) {
      const row = await h.api.fillField(RESIDENCE, value);
      assert.equal(row.reason, 'missing_profile_value', String(value));
      assert.equal(row.ok, false);
    }
    const intent = await h.api.fillField(INTENT, '上海市');
    assert.equal(intent.reason, 'label_not_allowed');
    assert.equal(h.stats.open, 0);
    assert.equal(h.document.getElementById('intent-value').textContent, '北京');
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('Escape closes the probed menu and does not change the value', async () => {
  const h = await boot({ residence: '' });
  try {
    const canceled = await h.api.cancelField(RESIDENCE);
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
    assert.equal(h.document.querySelector('.cascader-plugins-wrap ul').hidden, true);
    assert.equal(h.document.querySelectorAll('.ant-select-open').length, 0);
    const interview = await h.api.cancelField(INTERVIEW);
    assert.equal(interview.reason, 'menu_closed');
    assert.equal(interview.after, '');
    assert.equal(h.document.getElementById('interview-menu').hidden, true);
    unchanged(h.document, h.stats);
  } finally { h.dom.window.close(); }
});

test('a menu that ignores Escape fails closed and does not keep a painted value', async () => {
  const h = await boot({ ignoreEscape: true });
  try {
    const canceled = await h.api.cancelField(ORIGIN);
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
    const row = await missing.api.fillField(RESIDENCE, '广东省');
    assert.equal(row.reason, 'option_not_found', JSON.stringify(row));
    assert.equal(row.after, '');
    assert.equal(row.stillOpen, 0);
    assert.ok(missing.stats.escape >= 1);
    assert.equal(missing.stats.option, 0);
    unchanged(missing.document, missing.stats);
  } finally { missing.dom.window.close(); }

  const ambiguous = await boot({ duplicateOption: '上海市' });
  try {
    const row = await ambiguous.api.fillField(RESIDENCE, '上海市');
    assert.equal(row.reason, 'ambiguous_option');
    assert.equal(row.after, '');
    assert.equal(ambiguous.stats.option, 0);
  } finally { ambiguous.dom.window.close(); }

  const cases = [
    [{ dropWrap: true }, RESIDENCE],
    [{ extraSelect: true }, RESIDENCE],
    [{ allowClearOnCascader: true }, RESIDENCE],
    [{ dropAntRow: true }, RESIDENCE],
    [{ duplicateResidence: true }, RESIDENCE],
    [{ dropSearch: true }, INTERVIEW],
    [{ dropAllowClear: true }, INTERVIEW],
    [{ badDropdown: true }, INTERVIEW],
    [{ busy: true }, INTERVIEW],
    [{ twinDrift: true }, RESIDENCE],
    [{ twinDisabled: true }, RESIDENCE],
    [{ twinAllowClear: true }, RESIDENCE],
    [{ twinHidden: true }, RESIDENCE],
    [{ tripleSelect: true }, RESIDENCE],
    [{ ambiguousValue: true }, RESIDENCE],
    [{ dropRoot: true }, RESIDENCE],
    [{ elForm: true }, RESIDENCE],
    [{ url: 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/mc/deliver/operationResumer' }, RESIDENCE],
    [{ url: 'https://gszq.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html' }, RESIDENCE]
  ];
  for (const [state, label] of cases) {
    const h = await boot(state);
    try {
      const row = await h.api.fillField(label, label === INTERVIEW ? '北京' : '上海市');
      assert.notEqual(row.reason, 'readback_matched', JSON.stringify(state));
      assert.equal(row.ok, false, JSON.stringify({ state, row }));
      assert.ok(['control_not_supported', 'control_busy', 'wrong_page'].includes(row.reason), JSON.stringify({ state, row }));
      assert.equal(h.stats.option, 0, JSON.stringify(state));
      assert.equal(h.stats.forbidden, 0, JSON.stringify(state));
      if (!state.dropRoot && !state.elForm && !state.url && !state.duplicateResidence && label === RESIDENCE) {
        assert.equal(h.document.getElementById('residence-value')?.textContent ?? '', '');
      }
    } finally { h.dom.window.close(); }
  }
});

test('two cascader selects that display the same value match without opening', async () => {
  const plain = await boot({
    twinSelect: true,
    residence: probe.cascader.livePair.sameDisplay,
    origin: probe.cascader.livePair.sameDisplay,
    interview: probe.select.valueSample
  });
  try {
    const view = plain.api.inspect();
    assert.equal(view.liveSupportClaimed, false);
    assert.equal(view.fields.find((field) => field.label === RESIDENCE).reason, 'structure_matched');
    assert.equal(view.fields.find((field) => field.label === RESIDENCE).supported, false);
    assert.equal(view.fields.find((field) => field.label === RESIDENCE).value, '北京市');
    assert.equal(view.fields.find((field) => field.label === ORIGIN).value, '北京市');
    const filled = await plain.api.fillFields({
      [RESIDENCE]: '北京市',
      [ORIGIN]: '北京市',
      [INTERVIEW]: '北京'
    });
    assert.equal(filled.ok, true, JSON.stringify(filled.fields));
    assert.equal(filled.fields.every((field) => field.reason === 'preexisting_same_value'), true);
    assert.equal(filled.fields.every((field) => field.opened === false), true);
    assert.equal(filled.liveSupportClaimed, false);
    assert.equal(filled.saved, false);
    assert.equal(filled.complete, false);
    assert.equal(plain.stats.open, 0);
    assert.equal(plain.stats.option, 0);
    unchanged(plain.document, plain.stats);
  } finally { plain.dom.window.close(); }

  const mashed = await boot({
    twinSelect: true,
    cascaderMash: true,
    placeholderMash: 'class',
    residence: '北京市',
    origin: '北京市',
    interview: '北京'
  });
  try {
    const residence = await mashed.api.fillField(RESIDENCE, '北京市');
    const origin = await mashed.api.fillField(ORIGIN, '北京市');
    const interview = await mashed.api.fillField(INTERVIEW, '北京');
    assert.equal(residence.reason, 'preexisting_same_value', JSON.stringify(residence));
    assert.equal(residence.before, '北京市');
    assert.equal(residence.opened, false);
    assert.equal(origin.before, '北京市');
    assert.equal(origin.reason, 'preexisting_same_value');
    assert.equal(interview.reason, 'preexisting_same_value', JSON.stringify(interview));
    assert.equal(interview.before, '北京');
    assert.equal(interview.opened, false);
    assert.equal(mashed.stats.open, 0);
    assert.equal(mashed.api.inspect().fields.find((field) => field.label === INTERVIEW).value, '北京');
    assert.notEqual(interview.before, `请选择${INTERVIEW}北京`);
    unchanged(mashed.document, mashed.stats);
  } finally { mashed.dom.window.close(); }
});

test('a placeholder mash reads the selected city and a closed search field clicks the visible face', async () => {
  const text = await boot({ placeholderMash: 'text', interview: '北京' });
  try {
    const interview = await text.api.fillField(INTERVIEW, '北京');
    assert.equal(interview.reason, 'preexisting_same_value', JSON.stringify(interview));
    assert.equal(interview.before, '北京');
    assert.equal(interview.opened, false);
    assert.equal(text.stats.open, 0);
    assert.equal(text.document.getElementById('interview-value').textContent.includes('请选择'), true);
  } finally { text.dom.window.close(); }

  const painted = await boot({ cascaderMash: true });
  try {
    const residence = await painted.api.fillField(RESIDENCE, '上海市');
    assert.equal(residence.reason, 'readback_matched', JSON.stringify(residence));
    assert.equal(residence.after, '上海市');
    assert.equal(residence.opened, true);
    assert.equal(residence.stillOpen, 0);
    assert.equal(painted.document.querySelector('#residence-select .ant-select-selection-selected-value').textContent, '上海市');
    assert.equal(painted.document.querySelector('#residence-select .ant-select-selection__placeholder').textContent, `${probe.cascader.livePair.placeholderPrefix}${RESIDENCE}`);
    unchanged(painted.document, painted.stats);
  } finally { painted.dom.window.close(); }

  const closed = await boot({ closedSearch: true });
  try {
    const interview = await closed.api.fillField(INTERVIEW, '北京');
    assert.equal(interview.reason, 'readback_matched', JSON.stringify(interview));
    assert.equal(interview.after, '北京');
    assert.equal(interview.stillOpen, 0);
    assert.equal(interview.liveSupportClaimed, false);
    assert.equal(closed.stats.open, 1);
    assert.equal(closed.stats.option, 1);
    assert.equal(closed.stats.triggerClass, '');
    assert.equal(closed.stats.faceClass, probe.select.liveReadback.faceClass);
    assert.equal(closed.document.getElementById('interview-menu').hidden, true);
    unchanged(closed.document, closed.stats);
  } finally { closed.dom.window.close(); }

  const emptyPair = await boot({ twinSelect: true });
  try {
    const residence = await emptyPair.api.fillField(RESIDENCE, '上海市');
    assert.equal(residence.reason, 'control_not_supported', JSON.stringify(residence));
    assert.equal(residence.opened, false);
    assert.equal(emptyPair.stats.open, 0);
    assert.equal(emptyPair.stats.option, 0);
  } finally { emptyPair.dom.window.close(); }

  const drifted = await boot({ twinSelect: true, twinDrift: true, residence: '北京市', origin: '北京市' });
  try {
    const residence = await drifted.api.fillField(RESIDENCE, '北京市');
    const origin = await drifted.api.fillField(ORIGIN, '北京市');
    assert.equal(residence.reason, 'control_not_supported', JSON.stringify(residence));
    assert.equal(residence.opened, false);
    assert.equal(origin.reason, 'preexisting_same_value');
    assert.equal(drifted.stats.open, 0);
    assert.equal(drifted.stats.option, 0);
    assert.equal(drifted.document.getElementById('residence-value').textContent, '北京市');
  } finally { drifted.dom.window.close(); }
});

test('a hidden page fails closed before a click', async () => {
  const h = await boot({});
  try {
    Object.defineProperty(h.document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    const row = await h.api.fillField(RESIDENCE, '上海市');
    assert.equal(row.reason, 'fill_interrupted_page_hidden');
    assert.equal(h.stats.open, 0);
    assert.equal(row.liveSupportClaimed, false);
  } finally { h.dom.window.close(); }
});

test('hidden, mixed, outside-wrap, and outside-root controls fail before a click', async () => {
  const cases = [
    ['hidden residence', RESIDENCE, (document) => { document.getElementById('residence-select').hidden = true; }],
    ['hidden interview', INTERVIEW, (document) => { document.getElementById('interview-select').hidden = true; }],
    ['mixed residence input', RESIDENCE, (document) => {
      document.querySelector('[data-field="residence"]').append(document.getElementById('address').cloneNode(true));
    }],
    ['mixed interview input', INTERVIEW, (document) => {
      document.querySelector('[data-field="interview"]').append(document.getElementById('address').cloneNode(true));
    }],
    ['outside-wrap select', RESIDENCE, (document) => {
      document.querySelector('[data-field="residence"]').append(document.getElementById('residence-select').cloneNode(true));
    }],
    ['outside-root residence', RESIDENCE, (document) => { document.body.append(document.querySelector('[data-field="residence"]')); }],
    ['outside-root interview', INTERVIEW, (document) => { document.body.append(document.querySelector('[data-field="interview"]')); }],
    ['duplicate root', RESIDENCE, (document) => {
      document.body.append(document.querySelector(`.${probe.page.rootClass}`).cloneNode(false));
    }]
  ];
  for (const [name, label, mutate] of cases) {
    const h = await boot();
    try {
      mutate(h.document);
      const row = await h.api.fillField(label, label === INTERVIEW ? probe.select.valueSample : probe.cascader.valueSample);
      assert.equal(row.ok, false, JSON.stringify({ name, row }));
      assert.ok(['control_not_supported', 'wrong_page'].includes(row.reason), JSON.stringify({ name, row }));
      assert.equal(row.liveSupportClaimed, false);
      assert.equal(h.stats.open, 0, name);
      assert.equal(h.stats.option, 0, name);
      assert.equal(h.document.getElementById('residence-value').textContent, '', name);
      assert.equal(h.document.getElementById('interview-value').textContent, '', name);
      unchanged(h.document, h.stats);
    } finally { h.dom.window.close(); }
  }
});

test('actionable region options are never clicked and Escape closes their menu', async () => {
  for (const label of [RESIDENCE, INTERVIEW]) {
    for (const kind of ['forbidden button', 'submit button', 'link']) {
      const h = await boot();
      try {
        const menu = label === INTERVIEW
          ? h.document.getElementById('interview-menu')
          : h.document.querySelector('[data-field="residence"] ul');
        const capturedValue = label === INTERVIEW ? probe.select.valueSample : probe.cascader.valueSample;
        const li = [...menu.querySelectorAll('li')].find((node) => node.textContent === capturedValue);
        const action = h.document.createElement(kind === 'link' ? 'a' : 'button');
        action.textContent = kind === 'forbidden button' ? FORBIDDEN[0]
          : capturedValue;
        if (kind === 'link') action.href = '#';
        else action.type = kind === 'submit button' ? 'submit' : 'button';
        li.replaceChildren(action);
        let actionClicks = 0;
        action.addEventListener('click', (event) => { actionClicks += 1; event.preventDefault(); });
        const row = await h.api.fillField(label, action.textContent);
        assert.equal(row.reason, 'never_save', JSON.stringify({ label, kind, row }));
        assert.equal(row.ok, false);
        assert.equal(row.opened, true);
        assert.equal(row.canceled, true);
        assert.equal(row.stillOpen, 0);
        assert.equal(actionClicks, 0);
        assert.equal(h.stats.option, 0);
        assert.equal(h.stats.forbidden, 0);
        assert.ok(h.stats.escape > 0);
        assert.equal(h.document.querySelectorAll('.ant-select-open').length, 0);
        assert.equal(menu.hidden, true);
        unchanged(h.document, h.stats);
      } finally { h.dom.window.close(); }
    }
  }
});

test('region rows moved, hidden, disabled, or replaced during open are not selected', async () => {
  for (const label of [RESIDENCE, INTERVIEW]) {
    for (const drift of ['moved', 'hidden', 'disabled', 'replaced', 'root replaced']) {
      const h = await boot();
      try {
        const id = label === INTERVIEW ? 'interview' : 'residence';
        const item = h.document.querySelector(`[data-field="${id}"]`);
        const select = h.document.getElementById(`${id}-select`);
        select.addEventListener('click', () => {
          if (drift === 'moved') h.document.body.append(item);
          if (drift === 'hidden') select.hidden = true;
          if (drift === 'disabled') select.classList.add('ant-select-disabled');
          if (drift === 'replaced') item.replaceWith(item.cloneNode(true));
          if (drift === 'root replaced') {
            const root = h.document.querySelector(`.${probe.page.rootClass}`);
            const replacement = root.cloneNode(false);
            root.replaceWith(replacement);
            replacement.append(...root.childNodes);
          }
        }, { once: true });
        const row = await h.api.fillField(label, label === INTERVIEW ? probe.select.valueSample : probe.cascader.valueSample);
        assert.equal(row.ok, false, JSON.stringify({ label, drift, row }));
        assert.equal(row.reason, 'control_not_supported');
        assert.equal(row.opened, true);
        assert.equal(row.canceled, true);
        assert.equal(row.stillOpen, 0);
        assert.equal(h.stats.option, 0);
        assert.ok(h.stats.escape > 0);
        assert.equal(h.document.querySelectorAll('.ant-select-open').length, 0);
        assert.equal(select.querySelector('[id$="-value"]').textContent, '');
        unchanged(h.document, h.stats);
      } finally { h.dom.window.close(); }
    }
  }
});

test('a region row moved after selection is never reported as verified', async () => {
  for (const label of [RESIDENCE, INTERVIEW]) {
    const h = await boot();
    try {
      const id = label === INTERVIEW ? 'interview' : 'residence';
      const item = h.document.querySelector(`[data-field="${id}"]`);
      const menu = label === INTERVIEW
        ? h.document.getElementById('interview-menu')
        : item.querySelector('ul');
      menu.addEventListener('click', () => { h.document.body.append(item); }, { once: true });
      const row = await h.api.fillField(label, label === INTERVIEW ? probe.select.valueSample : probe.cascader.valueSample);
      assert.equal(row.ok, false, JSON.stringify({ label, row }));
      assert.equal(row.status, 'failed');
      assert.equal(row.reason, 'control_not_supported');
      assert.equal(row.canceled, true);
      assert.equal(row.stillOpen, 0);
      assert.equal(row.liveSupportClaimed, false);
      assert.equal(h.stats.option, 1);
      assert.ok(h.stats.escape > 0);
      unchanged(h.document, h.stats);
    } finally { h.dom.window.close(); }
  }
});

test('region readback revalidates ownership after Escape cleanup', async () => {
  for (const label of [RESIDENCE, INTERVIEW]) {
    const h = await boot();
    try {
      const id = label === INTERVIEW ? 'interview' : 'residence';
      const item = h.document.querySelector(`[data-field="${id}"]`);
      const select = h.document.getElementById(`${id}-select`);
      const menu = label === INTERVIEW
        ? h.document.getElementById('interview-menu')
        : item.querySelector('ul');
      menu.addEventListener('click', () => {
        select.classList.add(...classes(probe.cascader.openClass));
        hide(menu, false);
      }, { once: true });
      h.document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') h.document.body.append(item);
      });
      const row = await h.api.fillField(label, label === INTERVIEW ? probe.select.valueSample : probe.cascader.valueSample);
      assert.equal(row.ok, false, JSON.stringify({ label, row }));
      assert.equal(row.status, 'failed');
      assert.equal(row.reason, 'control_not_supported');
      assert.equal(row.canceled, true);
      assert.equal(row.stillOpen, 0);
      assert.equal(row.liveSupportClaimed, false);
      assert.equal(h.stats.option, 1);
      assert.ok(h.stats.escape > 0);
      assert.equal(menu.hidden, true);
      unchanged(h.document, h.stats);
    } finally { h.dom.window.close(); }
  }
});

test('region options moved out of the menu during the open await are never clicked', async () => {
  for (const label of [RESIDENCE, INTERVIEW]) {
    const h = await boot();
    try {
      const id = label === INTERVIEW ? 'interview' : 'residence';
      const select = h.document.getElementById(`${id}-select`);
      const menu = label === INTERVIEW
        ? h.document.getElementById('interview-menu')
        : h.document.querySelector('[data-field="residence"] ul');
      const value = label === INTERVIEW ? probe.select.valueSample : probe.cascader.valueSample;
      const option = [...menu.querySelectorAll('li')].find((node) => node.textContent === value);
      let movedOptionClicks = 0;
      option.addEventListener('click', () => { movedOptionClicks += 1; });
      select.addEventListener('click', () => {
        h.window.queueMicrotask(() => { h.document.body.append(option); });
      }, { once: true });
      const row = await h.api.fillField(label, value);
      assert.equal(row.ok, false, JSON.stringify({ label, row }));
      assert.equal(movedOptionClicks, 0, label);
      assert.equal(h.stats.option, 0);
      assert.equal(row.canceled, true);
      assert.equal(row.stillOpen, 0);
      assert.ok(h.stats.escape > 0);
      assert.equal(h.document.getElementById(`${id}-value`).textContent, '');
      unchanged(h.document, h.stats);
    } finally { h.dom.window.close(); }
  }
});
