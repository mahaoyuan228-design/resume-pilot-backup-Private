import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { buildPageExpression } from '../scripts/live/lib/gth-full-page.mjs';
import { evidenceExitCode } from '../scripts/live/gth-full-resume-live.mjs';
import { SECTION_TITLES, liveFillRequestFor } from '../scripts/live/gth-intent-live.mjs';
import { intentFormHtml, wireIntentForm } from './fixtures/gth-intent-census-dom.mjs';

const source = readFileSync(new URL('../src/content/gth-intent.js', import.meta.url), 'utf8');

async function boot() {
  // The census supplies control structure. Hiding only the native checkbox
  // simulates a no-layout leaf; its open-state CSS is not live evidence.
  const dom = new JSDOM(`<!doctype html><head><style>input[type="checkbox"] { display:none }</style></head><body>${SECTION_TITLES.map((title, index) =>
    `<section class="r-section"><div class="title_">${title}${index === 2 ? '<a class="h-e-btn" href="javascript:;">编辑</a>' : ''}</div></section>`
  ).join('')}</body>`, { url: 'https://hr.gtht.com/resume/edit/', pretendToBeVisual: true, runScripts: 'outside-only' });
  const { window } = dom;
  window.Element.prototype.getClientRects = () => [{ width: 8, height: 8 }];
  Object.defineProperty(window.document, 'readyState', { configurable: true, value: 'complete' });
  window.chrome = { runtime: {
    id: 'synthetic-extension',
    getManifest: () => ({ background: { service_worker: 'src/background/worker.mjs' } }),
    sendMessage: async message => ({ allowed: message?.type === 'RESUME_PROFILE_BINDING_CHECK' }),
    onMessage: { addListener() {}, removeListener() {} }
  } };
  const sections = [...window.document.querySelectorAll('.r-section')];
  let stats;
  sections[2].querySelector('a.h-e-btn').addEventListener('click', event => {
    event.currentTarget.remove();
    sections[2].insertAdjacentHTML('beforeend', intentFormHtml());
    const form = sections[2].querySelector('form');
    stats = wireIntentForm(form, { pickers: { 期望工作地区: {
      onOpen({ panel }) {
        // The existing 2026-10-22 fixture writes the joined L1+L2 chip after
        // the native checkbox click; no new option or picker DOM is invented.
        panel.querySelector(':scope > .eo-cascader-panel').addEventListener('click', event => {
          if (!event.target.matches('input[type="checkbox"]')) return;
          for (const text of panel.querySelectorAll('.selected-view-data > li p')) {
            if (text.textContent.trim() === '大兴区') text.textContent = '北京大兴区';
          }
        });
      }
    } } });
    form.querySelector('#intent-cancel').addEventListener('click', () => form.remove());
  });
  window.eval(buildPageExpression({ waitTimeoutMs: 80, pollMs: 1 }));
  window.eval(source);
  const api = window.__gthFullLive;
  assert.equal((await api.open(2)).ok, true);
  const form = sections[2].querySelector('form');
  const item = [...form.querySelectorAll('.el-form-item')].find(node => node.querySelector('.el-form-item__label')?.textContent === '期望工作地区');
  const panel = item.querySelector('.dialog-wrap.plugin-dialog-wrap.popover.blue');
  const checkbox = [...panel.querySelectorAll('input[type="checkbox"]')].find(node => node.parentElement.textContent.trim() === '大兴区');
  return { dom, window, sections, api, form, item, panel, checkbox, stats };
}

test('full page guard lets the shipped intent writer click its hidden native region checkbox and discard', async () => {
  const p = await boot();
  try {
    assert.equal(p.window.getComputedStyle(p.checkbox).display, 'none');
    const filled = await p.window.ResumeGthIntent.trial(liveFillRequestFor('期望工作地区', 0));
    assert.equal(filled.fields.find(row => row.question === '期望工作地区')?.status, 'verified',
      JSON.stringify({ reason: filled.reason, clicks: p.api.clicks() }));
    assert.equal(filled.liveSupportClaimed, false);
    assert.equal(filled.softwareClickedSave, false);
    assert.equal(filled.softwareClickedSubmit, false);
    assert.equal(filled.softwareClickedDelete, false);
    assert.equal(p.api.read(2, ['期望工作地区']).readback[0].value, '北京大兴区');
    assert.equal(p.stats.remove, 1);
    assert.equal(p.stats.checkbox, 1);
    assert.equal(p.stats.confirm, 1);
    assert.equal(p.stats.save, 0);
    assert.equal(p.api.clicks().every(row => row.allowed), true);
    assert.equal(p.api.clicks().some(row => row.label === '' && row.kind === 'picker_option'), true);
    assert.equal(evidenceExitCode({ clicks: p.api.clicks(), requests: p.api.requests(), sections: [] }), 2);
    assert.equal((await p.api.cancel(2)).closed, true);
    assert.equal(p.api.state().editorFormCount, 0);
    assert.equal(p.stats.formCancel, 1);
  } finally { p.api.restore(); p.dom.window.close(); }
});

test('the same owned native checkbox admits a dispatched click', async () => {
  const p = await boot();
  try {
    p.item.querySelector('.cascader-wrap > .input-l.pointer').click();
    assert.equal(p.checkbox.dispatchEvent(new p.window.MouseEvent('click', { bubbles: true, cancelable: true })), true);
    assert.equal(p.checkbox.checked, true);
    assert.equal(p.stats.checkbox, 1);
    assert.equal(p.api.clicks().at(-1).allowed, true);
    assert.equal(p.api.clicks().at(-1).kind, 'picker_option');
    assert.equal((await p.api.cancel(2)).closed, true);
    assert.equal(p.stats.save, 0);
  } finally { p.api.restore(); p.dom.window.close(); }
});

test('region checkbox ownership and visibility exceptions never permit forbidden actions', async () => {
  const p = await boot();
  try {
    p.item.querySelector('.cascader-wrap > .input-l.pointer').click();
    let changes = 0;
    p.checkbox.addEventListener('change', () => { changes += 1; });
    const refuse = (node, dispatched = false) => {
      const before = p.api.clicks().length;
      assert.throws(() => dispatched
        ? node.dispatchEvent(new p.window.MouseEvent('click', { bubbles: true, cancelable: true }))
        : node.click(), /refusing_forbidden_click/);
      assert.equal(p.api.clicks().length, before + 1);
      assert.equal(p.api.clicks().at(-1).allowed, false);
      assert.equal(changes, 0);
      assert.equal(p.checkbox.checked, false);
    };
    for (const attr of ['disabled', 'formaction', 'form']) {
      p.checkbox.setAttribute(attr, attr === 'form' ? 'foreign-form' : '');
      refuse(p.checkbox);
      p.checkbox.removeAttribute(attr);
    }
    const foreign = p.window.document.createElement('form');
    foreign.id = 'foreign-form';
    p.window.document.body.append(foreign);
    p.checkbox.setAttribute('form', foreign.id);
    assert.equal(p.checkbox.form, foreign);
    refuse(p.checkbox, true);
    p.checkbox.removeAttribute('form');
    foreign.remove();
    p.checkbox.parentElement.setAttribute('aria-disabled', 'true');
    refuse(p.checkbox, true);
    p.checkbox.parentElement.removeAttribute('aria-disabled');
    for (const name of ['disabled', 'is-disabled']) {
      p.checkbox.parentElement.classList.add(name);
      refuse(p.checkbox);
      p.checkbox.parentElement.classList.remove(name);
    }
    const fieldset = p.window.document.createElement('fieldset');
    fieldset.disabled = true;
    p.checkbox.parentElement.replaceWith(fieldset);
    const label = p.window.document.createElement('label');
    label.append(p.checkbox, p.window.document.createTextNode('大兴区'));
    fieldset.append(label);
    refuse(p.checkbox);
    fieldset.replaceWith(label);
    for (const node of [p.checkbox.parentElement, p.checkbox.closest('li'), p.panel]) {
      node.hidden = true;
      refuse(p.checkbox);
      node.hidden = false;
    }
    const copy = p.checkbox.cloneNode();
    p.checkbox.parentElement.append(copy);
    refuse(p.checkbox);
    copy.remove();
    p.checkbox.closest('li').classList.add('has-child');
    refuse(p.checkbox);
    p.checkbox.closest('li').classList.remove('has-child');
    p.item.querySelector('.el-form-item__label').textContent = '其他题目';
    refuse(p.checkbox);
    p.item.querySelector('.el-form-item__label').textContent = '期望工作地区';
    p.sections[3].append(p.form);
    refuse(p.checkbox);
    assert.equal(p.api.activate(3).ok, true);
    refuse(p.checkbox, true);
    p.sections[2].append(p.form);
    assert.equal(p.api.activate(2).ok, true);
    const duplicate = p.item.cloneNode(true);
    p.form.append(duplicate);
    refuse(p.checkbox);
    duplicate.remove();
    p.window.document.body.append(p.panel);
    refuse(p.checkbox);
    p.item.querySelector('.cascader-wrap').append(p.panel);
    const panelCopy = p.panel.cloneNode(true);
    p.form.append(panelCopy);
    refuse(p.checkbox);
    panelCopy.remove();
    const button = p.window.document.createElement('button');
    button.type = 'submit';
    p.checkbox.replaceWith(button);
    button.append(p.checkbox);
    refuse(p.checkbox, true);
    button.replaceWith(p.checkbox);
    const anchor = p.window.document.createElement('a');
    anchor.href = '/resume/save';
    p.checkbox.replaceWith(anchor);
    anchor.append(p.checkbox);
    refuse(p.checkbox);
    anchor.replaceWith(p.checkbox);
    refuse(p.form.querySelector('#intent-save'));
    p.panel.insertAdjacentHTML('beforeend', '<div class="pop-foot"><button type="submit">确定</button><a href="/resume/save">保存</a></div>');
    refuse(p.panel.querySelector('button[type="submit"]'));
    refuse(p.panel.querySelector('a[href]'));
    assert.equal(p.stats.checkbox, 0);
    assert.equal(p.stats.save, 0);
    assert.equal(evidenceExitCode({ clicks: p.api.clicks(), requests: p.api.requests(), sections: [] }), 3);
    assert.equal((await p.api.cancel(2)).closed, true);
  } finally { p.api.restore(); p.dom.window.close(); }
});
