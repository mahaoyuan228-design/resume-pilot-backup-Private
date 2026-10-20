// Fixture census of GTH custom picker levels. The opened 求职意向 editor keeps
// .eo-cascader-panel menus in the DOM while display:none. L1 is every
// li.branch.has-child. L2 is only li.branch rows already rendered. Never Save.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { readGthOptionLists } from '../scripts/gth-option-reader.mjs';
import { probeIntentEditor } from '../scripts/probe-gth-intent.mjs';
import {
  ARRIVAL_WITH_PLACEHOLDER,
  intentFormHtml,
  pickerModel
} from './fixtures/gth-intent-census-dom.mjs';

const PAGE = 'https://hr.gtht.com/resume/edit/';
const readerSource = readFileSync(new URL('../scripts/gth-option-reader.mjs', import.meta.url), 'utf8');
const intentSource = readFileSync(new URL('../scripts/probe-gth-intent.mjs', import.meta.url), 'utf8');
const sectionSource = readFileSync(new URL('../scripts/probe-gth-section.mjs', import.meta.url), 'utf8');
const PICKERS = ['期望工作地区', '期望从事职位类别', '现从事行业', '现从事职位类别'];

function norm(value) {
  return String(value ?? '').replace(/[\s\u00a0]+/gu, ' ').trim();
}

function mount(formHtml) {
  const html = `<!DOCTYPE html><body>
    <section class="r-section" id="basic"><div class="title_">基本信息</div>
      <form id="basic-form" class="el-form sec-form"><div class="el-form-item"><label class="el-form-item__label">姓名</label><input value="STATIC_FORM_VALUE_DO_NOT_RECORD"></div></form>
    </section>
    <section class="r-section" id="intent"><div class="title_">求职意向<a class="h-e-btn" href="javascript:;" style="display:none">编辑</a></div>${formHtml}</section>
  </body>`;
  const dom = new JSDOM(html, { url: PAGE, pretendToBeVisual: true });
  const { window } = dom;
  const { document } = window;
  window.Element.prototype.getClientRects = () => [{ width: 8, height: 8, top: 0, left: 0, bottom: 8, right: 8 }];
  const clicks = { trigger: 0, branch: 0, checkbox: 0, confirm: 0, option: 0, save: 0, cancel: 0, escape: 0 };
  document.addEventListener('click', (event) => {
    const node = event.target;
    if (node.classList?.contains('el-input__inner')) clicks.trigger += 1;
    if (node.closest?.('li.branch')) clicks.branch += 1;
    if (node.closest?.('input[type="checkbox"]')) clicks.checkbox += 1;
    if (node.closest?.('a.confirm')) clicks.confirm += 1;
    if (node.closest?.('.el-select-dropdown__item, .el-cascader-node')) clicks.option += 1;
    const name = norm(node.closest?.('a, button')?.textContent);
    if (name.includes('保存')) clicks.save += 1;
    if (name === '取消' && !node.closest('.plugin-dialog-wrap')) {
      clicks.cancel += 1;
      const form = node.closest('form');
      if (form) form.style.display = 'none';
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') clicks.escape += 1;
  });
  return { document, clicks };
}

function itemByLabel(document, label) {
  return [...document.querySelectorAll('.el-form-item')].find((item) => {
    const labels = [...item.querySelectorAll('.el-form-item__label')].filter((node) => node.closest('.el-form-item') === item);
    return labels.length === 1 && norm(labels[0].textContent) === label;
  });
}

function levelTexts(read, level) {
  return read.levels.find((row) => row.level === level).options.map((option) => option.text);
}

test('the shared reader is what both probes call, and it never clicks', () => {
  assert.equal((readerSource.match(/\.click\s*\(/g) || []).length, 0);
  assert.match(readerSource, /li\.branch/);
  assert.match(readerSource, /has-child/);
  assert.match(readerSource, /simple-tree-wrapper/);
  assert.match(readerSource, /eo-cascader-menu/);
  assert.match(intentSource, /readGthOptionLists/);
  assert.match(sectionSource, /readGthOptionLists/);
  assert.match(intentSource, /gth-option-reader\.mjs/);
  assert.match(sectionSource, /gth-option-reader\.mjs/);
});

test('hidden eo-cascader panels yield every L1 branch and only rendered L2 branches', () => {
  const { document, clicks } = mount(intentFormHtml());
  for (const label of PICKERS) {
    const item = itemByLabel(document, label);
    const panel = item.querySelector('.eo-cascader-panel');
    assert.equal(panel.parentElement.style.display, 'none');
    const read = readGthOptionLists(item);
    const model = pickerModel(label);
    assert.ok(model.l1.length > 0, label);
    assert.deepEqual(levelTexts(read, 1), model.l1.map((row) => row.x), label);
    assert.deepEqual(levelTexts(read, 2), model.l2.map((row) => row.x), label);
    assert.equal(read.levels[0].options.every((option) => option.level === 1 && option.classes.includes('branch')), true);
    assert.ok(read.levels[0].options.some((option) => option.classes.includes('has-child')));
    assert.equal(read.levels[1].options.every((option) => option.level === 2 && option.classes.includes('branch')), true);
    assert.equal(panel.parentElement.style.display, 'none');
  }
  const arrival = readGthOptionLists(itemByLabel(document, '到岗日期'));
  assert.deepEqual(arrival.selectOptions.map((option) => option.text), [...ARRIVAL_WITH_PLACEHOLDER]);
  assert.equal(arrival.selectOptions.every((option) => option.level === null), true);
  assert.deepEqual(clicks, { trigger: 0, branch: 0, checkbox: 0, confirm: 0, option: 0, save: 0, cancel: 0, escape: 0 });
});

test('an empty already-rendered L2 menu is reported empty and L1 is still complete', () => {
  const { document, clicks } = mount(intentFormHtml({
    pickers: { 期望工作地区: { emptyL2: true } }
  }));
  const item = itemByLabel(document, '期望工作地区');
  const read = readGthOptionLists(item);
  const model = pickerModel('期望工作地区');
  assert.deepEqual(levelTexts(read, 1), model.l1.map((row) => row.x));
  assert.deepEqual(levelTexts(read, 2), []);
  assert.equal(clicks.branch, 0);
  assert.equal(clicks.trigger, 0);
});

test('probe-gth-intent --open-options reads the four hidden pickers without clicking branches', async () => {
  const { document, clicks } = mount(intentFormHtml());
  const result = await probeIntentEditor(document, { openOptions: true });
  assert.equal(result.ok, true);
  assert.equal(result.reason, null);
  assert.equal(result.optionsOpened, true);
  assert.equal(result.editorLeftOpen, false);
  assert.equal(result.supported, false);
  assert.equal(result.liveSupportClaimed, false);
  assert.deepEqual(result.clickedLabels, ['取消']);
  assert.equal(clicks.trigger, 0);
  assert.equal(clicks.branch, 0);
  assert.equal(clicks.checkbox, 0);
  assert.equal(clicks.confirm, 0);
  assert.equal(clicks.option, 0);
  assert.equal(clicks.save, 0);
  assert.equal(clicks.cancel, 1);
  assert.equal(JSON.stringify(result).includes('STATIC_FORM_VALUE_DO_NOT_RECORD'), false);
  for (const label of PICKERS) {
    const row = result.optionReads.find((item) => item.label === label);
    const model = pickerModel(label);
    assert.ok(row, label);
    assert.equal(row.renderedInPlace, true);
    assert.equal(row.optionsClicked, false);
    assert.deepEqual(row.levels.find((level) => level.level === 1).options.map((option) => option.text), model.l1.map((entry) => entry.x));
    assert.deepEqual(row.levels.find((level) => level.level === 2).options.map((option) => option.text), model.l2.map((entry) => entry.x));
    assert.ok(row.options.length > 0, label);
  }
  const arrival = result.optionReads.find((item) => item.label === '到岗日期');
  assert.deepEqual(arrival.options.map((option) => option.text), [...ARRIVAL_WITH_PLACEHOLDER]);
});
