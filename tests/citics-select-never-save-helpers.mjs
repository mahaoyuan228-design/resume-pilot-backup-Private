// Offline DOM model of the existing Ant Design Vue 1 fixture selectors.
// Empty means an empty *existing* selected-value node. No placeholder DOM is
// inferred: a missing readback node must still fail closed on the real page.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../src/content/citics-basic.js', import.meta.url), 'utf8');
const esc = (text) => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
export const labels = ['婚姻状况', '政治面貌', '户口类型', '证件类型', '民族'];

export function bootSelect(label, settings = {}) {
  // Captions are deliberately synthetic, not a harvested live dictionary.
  const captions = settings.captions || ['SYN_TARGET', 'SYN_OTHER'];
  const row = (caption, control) => `<div class="ant-form-item"><div class="ant-form-item-label"><label>${esc(caption)}</label></div>${control}</div>`;
  const readback = settings.missingReadback ? '' : `<div class="ant-select-selection-selected-value">${esc(settings.before || '')}</div>`;
  const active = `<div class="ant-select${settings.disabled ? ' ant-select-disabled' : ''}" id="active"><div class="ant-select-selection" role="combobox" aria-controls="menu">${readback}</div></div>`;
  const html = row(label, active) + row('姓', '<input class="ant-input" value="SYN_NAME">')
    + row('证件号码', '<input class="ant-input" value="SYN_ID">')
    + row('性别', '<label class="ant-radio-wrapper"><input type="radio" checked>男</label><label class="ant-radio-wrapper"><input type="radio">女</label>')
    + row(label === '民族' ? '证件类型' : '民族', '<div class="ant-select"><div class="ant-select-selection"><div class="ant-select-selection-selected-value">SYN_NEIGHBOR</div></div></div>')
    + `<div class="ant-select-dropdown ant-select-dropdown-hidden" id="menu" style="display:none">${captions.map((caption) => `<div class="ant-select-dropdown-menu-item" role="option">${esc(caption)}</div>`).join('')}</div>`
    + ['保存', '提交', '暂存', '下一步', '投递', '删除'].map((caption) => `<button>${caption}</button>`).join('');
  const dom = new JSDOM(html, { url: settings.url || 'https://careers.citics.com/my/jl', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const document = window.document;
  window.Element.prototype.getClientRects = function () {
    return this.closest('[hidden], [style*="display:none"], .ant-select-dropdown-hidden') ? [] : [{ width: 160, height: 24 }];
  };
  window.Element.prototype.getBoundingClientRect = function () { return { width: 160, height: this.matches('.yidun_popup') ? 120 : 24 }; };
  window.HTMLElement.prototype.scrollIntoView = () => {};
  const stats = { opened: 0, options: 0, commits: 0 };
  const menu = document.getElementById('menu');
  const hide = () => { menu.style.display = 'none'; menu.classList.add('ant-select-dropdown-hidden'); };
  const selection = document.querySelector('#active .ant-select-selection');
  selection.addEventListener('mousedown', () => {
    stats.opened += 1;
    menu.style.display = 'block'; menu.classList.remove('ant-select-dropdown-hidden');
    if (settings.race) document.querySelector('#active .ant-select-selection-selected-value').textContent = 'SYN_RACE';
    if (settings.search) menu.insertAdjacentHTML('afterbegin', '<input class="ant-select-search__field">');
    if (settings.onOpen) settings.onOpen(window);
  });
  selection.addEventListener('keydown', (event) => { if (event.key === 'Escape') hide(); });
  document.body.addEventListener('mousedown', (event) => { if (event.target === document.body) hide(); });
  for (const option of menu.querySelectorAll('[role=option]')) option.addEventListener('click', () => {
    stats.options += 1;
    if (!settings.freeze) document.querySelector('#active .ant-select-selection-selected-value').textContent = option.textContent;
    if (settings.mutateNeighbor) document.querySelector('input.ant-input').value = 'SYN_CHANGED';
    hide();
  });
  document.addEventListener('click', (event) => { if (event.target.closest('button, a, [type=submit]')) stats.commits += 1; }, true);
  window.eval(source);
  return { dom, window, document, stats, api: window.ResumeCiticsBasic };
}

export function assertFlags(result) {
  for (const key of ['liveSupportClaimed', 'supportClaimed', 'saved', 'softwareClickedSave', 'softwareClickedSubmit', 'softwareClickedNext', 'softwareClickedDeliver', 'softwareClickedDelete']) assert.equal(result[key], false, key);
  for (const key of ['neverSave', 'skippedSave', 'leftUnsaved']) assert.equal(result[key], true, key);
}

function preserved(h) {
  assert.equal(h.document.querySelector('input.ant-input').value, 'SYN_NAME');
  assert.equal(h.document.querySelectorAll('input.ant-input')[1].value, 'SYN_ID');
  assert.equal(h.document.querySelector('input[type=radio]').checked, true);
  assert.equal(h.document.querySelector('.ant-select:not(#active) .ant-select-selection-selected-value').textContent, 'SYN_NEIGHBOR');
  assert.equal(h.stats.commits, 0);
}

export function registerSelectTests(label) {
  test(`${label}: empty evidenced readback fills exact runtime caption and preserves neighbors`, async () => {
    const h = bootSelect(label);
    try {
      const result = await h.api.fillSelect(label, ' SYN_TARGET ');
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.reason, 'readback_matched');
      assert.equal(result.before, ''); assert.equal(result.after, 'SYN_TARGET');
      assert.equal(result.writeAttempted, true); assert.equal(result.neighborsUnchanged, true);
      assertFlags(result); preserved(h);
    } finally { h.dom.window.close(); }
  });

  test(`${label}: occupied values survive force, alternate and restore options`, async () => {
    const h = bootSelect(label, { before: 'SYN_OCCUPIED' });
    try {
      for (const options of [{}, { force: true }, { pickAlternate: true }, { restore: true }]) {
        const result = await h.api.fillSelect(label, 'SYN_TARGET', options);
        assert.equal(result.reason, 'existing_value'); assert.equal(result.after, 'SYN_OCCUPIED');
        assert.equal(result.writeAttempted, false); assertFlags(result);
      }
      const same = await h.api.fillSelect(label, 'SYN_OCCUPIED');
      assert.equal(same.reason, 'preexisting_same_value'); assert.equal(same.ok, true);
      assert.equal(h.stats.opened, 0); assert.equal(h.stats.options, 0); preserved(h);
    } finally { h.dom.window.close(); }
  });

  test(`${label}: missing/ambiguous/disabled/readback failures never report a successful fill`, async () => {
    for (const [settings, expected] of [
      [{ missingReadback: true }, 'select_readback_missing'],
      [{ disabled: true }, 'select_structure_unexpected'],
      [{ captions: ['SYN_OTHER'] }, 'select_option_missing'],
      [{ captions: ['SYN_TARGET', 'SYN_TARGET'] }, 'select_option_not_unique'],
      [{ race: true }, 'control_changed'],
      [{ freeze: true }, 'select_readback_mismatch'],
      [{ search: true }, 'select_search_heavy'],
      [{ onOpen: (window) => window.document.querySelectorAll('#menu [role=option]').forEach((node) => { node.className = 'weird-option'; }) }, 'select_option_selector_missing'],
      [{ captions: Array.from({ length: 25 }, (_, i) => `SYN_${i}`) }, 'select_search_heavy']
    ]) {
      const h = bootSelect(label, settings);
      try {
        const result = await h.api.fillSelect(label, 'SYN_TARGET');
        assert.equal(result.ok, false); assert.equal(result.reason, expected, JSON.stringify(result));
        assertFlags(result); preserved(h);
        if (!settings.freeze) assert.equal(h.stats.options, 0);
      } finally { h.dom.window.close(); }
    }
  });

  test(`${label}: neighbor side effects are detected`, async () => {
    const h = bootSelect(label, { mutateNeighbor: true });
    try {
      const result = await h.api.fillSelect(label, 'SYN_TARGET');
      assert.equal(result.ok, false); assert.equal(result.reason, 'neighbor_changed');
      assert.equal(result.neighborsUnchanged, false); assertFlags(result); assert.equal(h.stats.commits, 0);
    } finally { h.dom.window.close(); }
  });

  test(`${label}: late ambiguous structures and mousedown occupancy stop before option click`, async () => {
    for (const onOpen of [
      (window) => { const row = window.document.getElementById('active').closest('.ant-form-item'); row.after(row.cloneNode(true)); },
      (window) => { const select = window.document.getElementById('active'); select.after(select.cloneNode(true)); },
      (window) => { window.document.querySelector('#menu [role=option]').addEventListener('mousedown', () => {
        window.document.querySelector('#active .ant-select-selection-selected-value').textContent = 'SYN_RACE';
      }); }
    ]) {
      const h = bootSelect(label, { onOpen });
      try {
        const result = await h.api.fillSelect(label, 'SYN_TARGET');
        assert.ok(['control_changed', 'neighbor_changed'].includes(result.reason), result.reason);
        assert.equal(result.clickedOption, false);
        assert.equal(h.stats.options, 0); assert.equal(h.stats.commits, 0); assertFlags(result);
      } finally { h.dom.window.close(); }
    }
  });

  test(`${label}: forbidden captions, wrong pages, invalid values and restore stay closed`, async () => {
    for (const caption of ['保存', '提交', '下一步', '投递', '删除', 'Save', 'Submit', 'Next', 'Delete']) {
      const h = bootSelect(label, { captions: [caption] });
      try {
        const result = await h.api.fillSelect(label, caption);
        assert.equal(result.reason, 'commit_or_yidun_target'); assert.equal(h.stats.options, 0);
        assert.equal(h.document.getElementById('menu').style.display, 'none');
        assertFlags(result); preserved(h);
      } finally { h.dom.window.close(); }
    }
    const h = bootSelect(label);
    try {
      for (const value of ['', null, undefined]) {
        const result = await h.api.fillSelect(label, value, { pickAlternate: true });
        assert.equal(result.reason, 'expected_required'); assert.equal(result.writeAttempted, false); assertFlags(result);
      }
      for (const value of [1, {}, []]) assert.equal((await h.api.fillSelect(label, value)).reason, 'invalid_profile_value');
      for (const name of ['constructor', '__proto__', 'toString']) assert.equal((await h.api.fillSelect(name, 'SYN_TARGET')).reason, 'label_not_allowed');
      assert.equal((await h.api.fillSelect(label, 'SYN_TARGET', { restore: true })).reason, 'restore_not_allowed');
      assert.equal(h.stats.options, 0);
    } finally { h.dom.window.close(); }
    const wrong = bootSelect(label, { url: 'https://example.com/my/jl' });
    try {
      assert.equal((await wrong.api.fillSelect(label, 'SYN_TARGET', { synthetic: true })).reason, 'wrong_page');
      assert.equal(wrong.stats.opened, 0);
    } finally { wrong.dom.window.close(); }
  });

  test(`${label}: hidden pages, visible Yidun and concurrent fills are gated`, async () => {
    for (const kind of ['hidden', 'yidun']) {
      const h = bootSelect(label);
      try {
        if (kind === 'hidden') Object.defineProperty(h.document, 'visibilityState', { value: 'hidden', configurable: true });
        else h.document.body.insertAdjacentHTML('afterbegin', '<div class="yidun_popup"></div>');
        const result = await h.api.fillSelect(label, 'SYN_TARGET');
        assert.equal(result.reason, kind === 'hidden' ? 'page_hidden' : 'yidun_visible');
        assert.equal(h.stats.opened, 0); assertFlags(result);
      } finally { h.dom.window.close(); }
    }
    const h = bootSelect(label);
    try {
      const first = h.api.fillSelect(label, 'SYN_TARGET');
      const second = await h.api.fillSelect(label, 'SYN_OTHER');
      assert.equal(second.reason, 'control_busy'); assertFlags(second);
      assert.equal((await first).after, 'SYN_TARGET'); assert.equal(h.stats.options, 1); preserved(h);
    } finally { h.dom.window.close(); }
  });
}
