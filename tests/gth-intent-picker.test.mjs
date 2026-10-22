/**
 * Census-backed 求职意向 fill. Option text and control shapes come from
 * tests/fixtures/gth-intent-census-20261020.json (opened editor, 2026-10-20).
 * Never Save. Does not claim the live site is supported.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { assessGthIntentFill } from '../src/background/gth-intent-auto.mjs';
import {
  ARRIVAL_WITH_PLACEHOLDER,
  cloneArrivalDropdownOnBody,
  intentFormHtml,
  moveArrivalDropdownToBody,
  pickerModel,
  wireIntentForm,
} from './fixtures/gth-intent-census-dom.mjs';

const source = readFileSync(new URL('../src/content/gth-intent.js', import.meta.url), 'utf8');
const PAGE = 'https://hr.gtht.com/resume/edit/';
const REQUIRED = ['期望从事职位类别', '期望薪资', '现从事行业', '现从事职位类别', '现薪资'];
const TITLES = ['基本信息', '教育经历', '求职意向', '工作经验', '职业技能与特长', '附件简历', '其他信息'];
const binding = {
  version: 1,
  epoch: '00000000-0000-4000-8000-000000000001',
  profileHash: 'a'.repeat(64),
};
const ANSWERS = {
  期望从事职位类别: '金融/保险||投资/证券/基金',
  期望薪资: '300000',
  现从事行业: '金融||证券/投资/基金/信托',
  现从事职位类别: '金融/保险||银行',
  现薪资: '200000',
};
const EMPTY = { trigger: '', chips: [], counter: '(0/5)' };

function answers(extra = {}) {
  return { ...ANSWERS, ...extra };
}

function profile(customAnswers, questions = REQUIRED) {
  return {
    customAnswers,
    confirmedFields: questions.map((question) => `customAnswers.${question}`),
    customFacts: questions.map((question) => ({
      question,
      answer: customAnswers[question],
      sitePageUrl: PAGE,
      sectionName: '求职意向',
      rowContext: 'none',
    })),
  };
}

function request(customAnswers = answers(), questions = Object.keys(customAnswers), extra = {}) {
  return {
    requestId: '1234567890-intent',
    profileBinding: binding,
    replaceExisting: false,
    profile: profile(customAnswers, questions),
    ...extra,
  };
}

function install(dom) {
  const { window } = dom;
  window.Element.prototype.getClientRects = () => [{ width: 8, height: 8, top: 0, left: 0, bottom: 8, right: 8 }];
  Object.defineProperty(window.document, 'readyState', { configurable: true, get: () => 'complete' });
  const chrome = {
    runtime: {
      id: 'synthetic-extension',
      getManifest: () => ({ background: { service_worker: 'src/background/worker.mjs' } }),
      sendMessage: async (message) => (message?.type === 'RESUME_PROFILE_BINDING_CHECK' ? { allowed: true } : { allowed: false }),
      onMessage: { addListener() {}, removeListener() {} },
    },
  };
  const context = vm.createContext({
    chrome,
    document: window.document,
    location: window.location,
    performance: window.performance,
    HTMLInputElement: window.HTMLInputElement,
    Event: window.Event,
    getComputedStyle: window.getComputedStyle.bind(window),
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
  });
  vm.runInContext(source, context);
  return context.ResumeGthIntent;
}

function mount(formOptions = {}, wire = {}) {
  const sections = TITLES.map((title) => {
    if (title !== '求职意向') return `<section class="r-section"><div class="title_">${title}</div></section>`;
    return `<section class="r-section" id="intent"><div class="title_">${title}<a class="h-e-btn" href="javascript:;">编辑</a></div>${intentFormHtml(formOptions)}</section>`;
  }).join('');
  const dom = new JSDOM(`<!DOCTYPE html><body>${sections}</body>`, { url: PAGE, pretendToBeVisual: true });
  const form = dom.window.document.getElementById('intent-form');
  const stats = wireIntentForm(form, wire);
  return { dom, form, stats, api: install(dom) };
}

function itemByLabel(form, label) {
  return [...form.querySelectorAll('.el-form-item')].find((node) => {
    const labels = [...node.querySelectorAll('.el-form-item__label')].filter((labelNode) => labelNode.closest('.el-form-item') === node);
    return labels.length === 1 && labels[0].textContent.trim() === label;
  });
}

function itemInput(form, label) {
  return itemByLabel(form, label).querySelector('input.el-input__inner');
}

function menuCount(form, label) {
  return itemByLabel(form, label).querySelectorAll('.eo-cascader-panel > .eo-cascader-menu.simple-tree-outer').length;
}

function leaveL1Only(form, label) {
  const menus = [...itemByLabel(form, label).querySelectorAll('.eo-cascader-panel > .eo-cascader-menu.simple-tree-outer')];
  menus.slice(1).forEach((menu) => menu.remove());
}

function clearPicker(form, label, counter = '(0/5)') {
  const item = itemByLabel(form, label);
  item.querySelector('.input-l.pointer input.el-input__inner').value = '';
  item.querySelector('.selected-view-data').replaceChildren();
  item.querySelector('.selected-counter > p').textContent = counter;
}

function flags(result) {
  assert.equal(result.complete, false);
  assert.equal(result.scope, 'gth_intent_five');
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.softwareClickedSave, false);
  assert.equal(result.softwareClickedSubmit, false);
  assert.equal(result.softwareClickedDelete, false);
  assert.equal(result.savedOnSite, null);
  assert.equal(result.submitted, null);
}

test('the census trees are the opened-editor evidence, including slash-grouped level-2 text', () => {
  const region = pickerModel('期望工作地区');
  const job = pickerModel('期望从事职位类别');
  const industry = pickerModel('现从事行业');
  const role = pickerModel('现从事职位类别');
  assert.equal(region.l1.length, 35);
  assert.equal(region.observedL1, '北京');
  assert.equal(region.trigger, '北京');
  assert.equal(region.observedL2.length, 17);
  assert.equal(region.observedL2[0], '北京');
  assert.ok(region.observedL2.includes('朝阳区'));
  assert.deepEqual(region.l1.filter((row) => !String(row.c).includes('has-child')).map((row) => row.x), ['香港', '澳门', '台湾']);
  assert.equal(job.l1.length, 14);
  assert.equal(job.observedL1, '金融/保险');
  assert.deepEqual(job.observedL2, ['银行', '投资/证券/基金', '保险', '担保/典当/拍卖']);
  assert.equal(industry.l1.length, 16);
  assert.equal(industry.observedL1, '金融');
  assert.deepEqual(industry.observedL2, ['银行', '保险', '证券/投资/基金/信托', '担保/典当/拍卖', '互联网金融']);
  assert.equal(role.l1.length, 14);
  assert.deepEqual(role.observedL2, job.observedL2);
  assert.deepEqual(ARRIVAL_WITH_PLACEHOLDER, ['请选择', '一周内', '一个月内', '一个月以上', '即时', '面议']);
});

test('empty census pickers and salaries fill the five and never save', async () => {
  const { form, stats, api } = mount({
    pickers: {
      期望工作地区: EMPTY,
      期望从事职位类别: EMPTY,
      现从事行业: EMPTY,
      现从事职位类别: EMPTY,
    },
    salaries: { 期望薪资: '', 现薪资: '' },
  });
  const result = await api.trial(request());
  assert.equal(result.ok, true);
  assert.equal(result.reason, null);
  assert.equal(result.writeStarted, true);
  assert.equal(result.supportedComplete, true);
  assert.equal(result.operableComplete, true);
  assert.equal(result.editorLeftOpen, true);
  flags(result);
  assert.deepEqual(Array.from(result.fields, (row) => row.question), REQUIRED);
  assert.equal(result.fields.every((row) => row.status === 'verified' && row.reason === 'readback_matched'), true);
  assert.equal(itemInput(form, '期望从事职位类别').value, '投资/证券/基金');
  assert.equal(itemInput(form, '现从事行业').value, '证券/投资/基金/信托');
  assert.equal(itemInput(form, '现从事职位类别').value, '银行');
  assert.equal(itemInput(form, '期望薪资').value, '300000');
  assert.equal(itemInput(form, '现薪资').value, '200000');
  assert.equal(itemInput(form, '到岗日期').value, '');
  assert.equal(stats.save, 0);
  assert.equal(stats.formCancel, 0);
  assert.equal(stats.panelCancel, 0);
  assert.equal(stats.confirm, 3);
  assert.equal(stats.checkbox, 3);
  assert.equal(stats.level1, 3);
  assert.equal(stats.option, 0);
  const assessed = assessGthIntentFill(result);
  assert.equal(assessed.ok, true);
  assert.equal(assessed.state, 'completed');
  assert.equal(assessed.outcome, 'verified');
});

test('a chip and trigger that already show the level-2 text are left unchanged', async () => {
  const { form, stats, api } = mount({
    pickers: {
      现从事职位类别: { trigger: '银行', chips: ['银行'], counter: '(1/5)' },
    },
    salaries: { 期望薪资: '300000', 现薪资: '200000' },
  });
  const result = await api.trial(request());
  assert.equal(result.ok, true);
  assert.equal(result.writeStarted, false);
  assert.equal(result.supportedComplete, true);
  assert.equal(result.editorLeftOpen, true);
  flags(result);
  assert.equal(result.fields.every((row) => row.status === 'verified' && row.reason === 'preexisting_same_value'), true);
  assert.equal(itemInput(form, '期望从事职位类别').value, '投资/证券/基金');
  assert.equal(itemInput(form, '现从事职位类别').value, '银行');
  assert.equal(itemInput(form, '期望薪资').value, '300000');
  assert.equal(stats.save, 0);
  assert.equal(stats.confirm, 0);
  assert.equal(stats.checkbox, 0);
  assert.equal(stats.level1, 0);
  assert.equal(stats.panelCancel, 0);
  assert.equal(stats.formCancel, 0);
  assert.equal(assessGthIntentFill(result).outcome, 'verified_preexisting');
});

test('a second 期望从事职位类别 label fails closed before any panel opens', async () => {
  const { stats, api } = mount({ duplicateLabel: '期望从事职位类别' });
  const result = await api.trial(request());
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'picker_label_ambiguous');
  assert.equal(result.writeStarted, false);
  assert.equal(result.supportedComplete, false);
  flags(result);
  assert.equal(stats.save, 0);
  assert.equal(stats.confirm, 0);
  assert.equal(stats.panelCancel, 0);
  assert.equal(stats.checkbox, 0);
  assert.equal(stats.level1, 0);
  assert.equal(assessGthIntentFill(result).state, 'stopped_before_write');
});

test('a second 期望薪资 label is not a unique plain-text target', async () => {
  const { form, stats, api } = mount({
    duplicateLabel: '期望薪资',
    salaries: { 期望薪资: 'stays', 现薪资: '200000' },
  });
  const result = await api.trial(request());
  assert.equal(result.reason, 'intent_target_not_unique');
  assert.equal(result.writeStarted, false);
  assert.equal(stats.save, 0);
  assert.equal(stats.panelCancel, 0);
  assert.equal(itemInput(form, '期望薪资').value, 'stays');
});

test('a cascader-wrapped 期望薪资 is not plain text', async () => {
  const { stats, api } = mount({
    salaryHtmlOverride: `<div class="el-form-item is-required"><label class="el-form-item__label">期望薪资</label><div class="el-form-item__content"><div class="cascader-wrap"><input id="salary" class="el-input__inner" type="text" readonly value="12000"></div></div></div>`,
  });
  const result = await api.trial(request());
  assert.equal(result.reason, 'intent_target_not_plain_text');
  assert.equal(result.writeStarted, false);
  assert.equal(stats.save, 0);
});

test('level-2 that was not loaded for another branch fails closed and cancels that panel', async () => {
  const { form, stats, api } = mount({
    pickers: {
      期望工作地区: EMPTY,
      期望从事职位类别: EMPTY,
      现从事行业: EMPTY,
      现从事职位类别: EMPTY,
    },
    salaries: { 期望薪资: '', 现薪资: '' },
  });
  const custom = answers({ 期望从事职位类别: '销售/客服||银行' });
  const result = await api.trial(request(custom));
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'picker_level2_missing');
  assert.equal(result.writeStarted, false);
  assert.equal(result.supportedComplete, false);
  flags(result);
  assert.equal(stats.level1, 1);
  assert.equal(stats.checkbox, 0);
  assert.equal(stats.confirm, 0);
  assert.equal(stats.panelCancel, 1);
  assert.equal(stats.save, 0);
  assert.equal(stats.formCancel, 0);
  assert.equal(itemInput(form, '期望薪资').value, '');
  assert.equal(itemInput(form, '期望从事职位类别').value, '');
  const panel = itemInput(form, '期望从事职位类别').closest('.el-form-item').querySelector('.dialog-wrap');
  assert.equal(panel.style.display, 'none');
  assert.equal(assessGthIntentFill(result).state, 'stopped_before_write');
});

test('a substring of a level-2 label is not a match', async () => {
  const { stats, api } = mount({
    pickers: { 期望从事职位类别: EMPTY, 现从事行业: EMPTY, 现从事职位类别: EMPTY },
    salaries: { 期望薪资: '', 现薪资: '' },
  });
  const custom = answers({ 期望从事职位类别: '金融/保险||投资' });
  const result = await api.trial(request(custom));
  assert.equal(result.reason, 'picker_level2_missing');
  assert.equal(result.writeStarted, false);
  assert.equal(stats.checkbox, 0);
  assert.equal(stats.confirm, 0);
  assert.equal(stats.panelCancel, 1);
  assert.equal(stats.save, 0);
});

test('a full selection counter refuses another checkbox and cancels the panel', async () => {
  const { stats, api } = mount({
    pickers: {
      期望从事职位类别: { trigger: '', chips: [], counter: '(5/5)' },
      现从事行业: EMPTY,
      现从事职位类别: EMPTY,
    },
    salaries: { 期望薪资: '', 现薪资: '' },
  });
  const result = await api.trial(request());
  assert.equal(result.reason, 'picker_selection_limit');
  assert.equal(result.writeStarted, false);
  assert.equal(stats.level1, 1);
  assert.equal(stats.checkbox, 0);
  assert.equal(stats.confirm, 0);
  assert.equal(stats.panelCancel, 1);
  assert.equal(stats.save, 0);
  assert.equal(assessGthIntentFill(result).reason, 'picker_selection_limit');
});

test('a confirm that does not write the level-2 text cancels and fails closed', async () => {
  const { form, stats, api } = mount({
    pickers: {
      期望从事职位类别: EMPTY,
      现从事行业: EMPTY,
      现从事职位类别: EMPTY,
    },
    salaries: { 期望薪资: '', 现薪资: '' },
  }, {
    pickers: {
      期望从事职位类别: {
        onConfirm({ input, panel }) {
          input.value = 'WRONG';
          panel.style.display = 'none';
        },
      },
    },
  });
  const result = await api.trial(request());
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'picker_readback_mismatch');
  assert.equal(result.writeStarted, true);
  assert.equal(result.supportedComplete, false);
  assert.equal(result.editorLeftOpen, true);
  flags(result);
  assert.equal(stats.checkbox, 1);
  assert.equal(stats.confirm, 1);
  assert.equal(stats.panelCancel, 1);
  assert.equal(stats.save, 0);
  assert.equal(stats.formCancel, 0);
  assert.equal(itemInput(form, '期望从事职位类别').value, 'WRONG');
  assert.equal(itemInput(form, '期望薪资').value, '');
  assert.equal(itemInput(form, '现薪资').value, '');
  assert.equal(assessGthIntentFill(result).state, 'unknown');
});

test('a foreign chip is not cleared and cancels as a selection conflict', async () => {
  const { form, stats, api } = mount({
    pickers: {
      现从事职位类别: { trigger: '投资/证券/基金', chips: ['投资/证券/基金'], counter: '(1/5)' },
    },
    salaries: { 期望薪资: '300000', 现薪资: '200000' },
  });
  const result = await api.trial(request());
  assert.equal(result.reason, 'picker_existing_selection_conflict');
  assert.equal(result.writeStarted, false);
  assert.equal(stats.checkbox, 0);
  assert.equal(stats.confirm, 0);
  assert.equal(stats.remove, 0);
  assert.equal(stats.panelCancel, 1);
  assert.equal(stats.save, 0);
  assert.equal(itemInput(form, '现从事职位类别').value, '投资/证券/基金');
  assert.equal(itemInput(form, '期望薪资').value, '300000');
  const chips = [...form.querySelectorAll('.el-form-item')].find((node) => node.querySelector('.el-form-item__label')?.textContent.trim() === '现从事职位类别');
  assert.deepEqual([...chips.querySelectorAll('.selected-view-data > li p')].map((node) => node.textContent.trim()), ['投资/证券/基金']);
});

test('到岗日期 uses the in-item el-select and reads the exact option back', async () => {
  const custom = answers({ 到岗日期: '一周内' });
  const { form, stats, api } = mount({
    pickers: { 现从事职位类别: { trigger: '银行', chips: ['银行'], counter: '(1/5)' } },
    salaries: { 期望薪资: '300000', 现薪资: '200000' },
    arrival: '',
  });
  const result = await api.trial(request(custom, [...REQUIRED, '到岗日期']));
  assert.equal(result.ok, true);
  assert.equal(result.writeStarted, true);
  assert.equal(result.supportedComplete, true);
  assert.equal(result.editorLeftOpen, true);
  flags(result);
  assert.deepEqual(Array.from(result.fields, (row) => row.question), [...REQUIRED, '到岗日期']);
  assert.equal(result.fields.find((row) => row.question === '到岗日期').reason, 'readback_matched');
  assert.equal(itemInput(form, '到岗日期').value, '一周内');
  assert.equal(stats.option, 1);
  assert.equal(stats.confirm, 0);
  assert.equal(stats.panelCancel, 0);
  assert.equal(stats.save, 0);
  assert.equal(assessGthIntentFill(result).ok, true);
});

test('请选择 is not a 到岗日期 answer and blocks every write', async () => {
  const custom = answers({ 到岗日期: '请选择' });
  const { stats, api } = mount({
    salaries: { 期望薪资: '', 现薪资: '' },
    pickers: { 期望从事职位类别: EMPTY, 现从事行业: EMPTY, 现从事职位类别: EMPTY },
  });
  const result = await api.trial(request(custom, [...REQUIRED, '到岗日期']));
  assert.equal(result.reason, 'invalid_profile_value');
  assert.equal(result.writeStarted, false);
  assert.equal(result.fields.find((row) => row.question === '到岗日期').reason, 'invalid_profile_value');
  assert.equal(stats.save, 0);
  assert.equal(stats.option, 0);
  assert.equal(stats.checkbox, 0);
  assert.equal(stats.confirm, 0);
});

test('an occupied salary blocks the fill, and replaceExisting writes both salary inputs', async () => {
  const kept = mount({
    pickers: { 现从事职位类别: { trigger: '银行', chips: ['银行'], counter: '(1/5)' } },
    salaries: { 期望薪资: '12000', 现薪资: '12000' },
  });
  const blocked = await kept.api.trial(request());
  assert.equal(blocked.reason, 'existing_value');
  assert.equal(blocked.writeStarted, false);
  assert.equal(kept.stats.save, 0);
  assert.equal(kept.stats.checkbox, 0);
  assert.equal(kept.stats.panelCancel, 0);
  assert.equal(itemInput(kept.form, '期望薪资').value, '12000');
  assert.equal(itemInput(kept.form, '现薪资').value, '12000');
  assert.equal(assessGthIntentFill(blocked).state, 'stopped_before_write');

  const replaced = mount({
    pickers: { 现从事职位类别: { trigger: '银行', chips: ['银行'], counter: '(1/5)' } },
    salaries: { 期望薪资: '12000', 现薪资: '12000' },
  });
  const result = await replaced.api.trial(request(answers(), REQUIRED, { replaceExisting: true }));
  assert.equal(result.ok, true);
  assert.equal(result.writeStarted, true);
  assert.equal(itemInput(replaced.form, '期望薪资').value, '300000');
  assert.equal(itemInput(replaced.form, '现薪资').value, '200000');
  assert.equal(result.fields.find((row) => row.question === '现薪资').reason, 'readback_reapplied');
  assert.equal(result.fields.find((row) => row.question === '期望薪资').reason, 'readback_reapplied');
  assert.equal(replaced.stats.save, 0);
  assert.equal(replaced.stats.confirm, 0);
  assert.equal(assessGthIntentFill(result).ok, true);
});

test('期望工作地区 fills 北京 then an exact district when that fact is present', async () => {
  const custom = answers({ 期望工作地区: '北京||朝阳区' });
  const { form, stats, api } = mount({
    pickers: {
      期望工作地区: EMPTY,
      期望从事职位类别: EMPTY,
      现从事行业: EMPTY,
      现从事职位类别: EMPTY,
    },
    salaries: { 期望薪资: '', 现薪资: '' },
  });
  const result = await api.trial(request(custom, [...REQUIRED, '期望工作地区']));
  assert.equal(result.ok, true);
  assert.equal(result.writeStarted, true);
  assert.deepEqual(Array.from(result.fields, (row) => row.question), [...REQUIRED, '期望工作地区']);
  assert.equal(itemInput(form, '期望工作地区').value, '朝阳区');
  assert.equal(stats.confirm, 4);
  assert.equal(stats.checkbox, 4);
  assert.equal(stats.save, 0);
  assert.equal(assessGthIntentFill(result).ok, true);
  assert.equal(result.liveSupportClaimed, false);
});

test('a level-1-only menu gains its level-2 menu after the exact level-1 click', async () => {
  const { form, stats, api } = mount({
    pickers: {
      期望工作地区: EMPTY,
      期望从事职位类别: { ...EMPTY, l1Only: true },
      现从事行业: { ...EMPTY, l1Only: true },
      现从事职位类别: { ...EMPTY, l1Only: true },
    },
    salaries: { 期望薪资: '', 现薪资: '' },
  });
  assert.equal(menuCount(form, '期望从事职位类别'), 1);
  assert.equal(menuCount(form, '现从事行业'), 1);
  assert.equal(menuCount(form, '现从事职位类别'), 1);
  const result = await api.trial(request());
  assert.equal(result.ok, true);
  assert.equal(result.writeStarted, true);
  assert.equal(result.reason, null);
  flags(result);
  assert.equal(itemInput(form, '期望从事职位类别').value, '投资/证券/基金');
  assert.equal(itemInput(form, '现从事行业').value, '证券/投资/基金/信托');
  assert.equal(itemInput(form, '现从事职位类别').value, '银行');
  assert.equal(menuCount(form, '期望从事职位类别'), 2);
  assert.equal(menuCount(form, '现从事行业'), 2);
  assert.equal(menuCount(form, '现从事职位类别'), 2);
  assert.equal(stats.level1, 3);
  assert.equal(stats.checkbox, 3);
  assert.equal(stats.confirm, 3);
  assert.equal(stats.panelCancel, 0);
  assert.equal(stats.save, 0);
  assert.equal(result.liveSupportClaimed, false);
});

test('a level-1 click that never reveals a level-2 menu cancels and fails closed', async () => {
  const { form, stats, api } = mount({
    pickers: {
      期望从事职位类别: { ...EMPTY, l1Only: true },
      现从事行业: EMPTY,
      现从事职位类别: EMPTY,
    },
    salaries: { 期望薪资: '', 现薪资: '' },
  }, {
    pickers: {
      期望从事职位类别: { onLevel1() {} },
    },
  });
  const result = await api.trial(request());
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'picker_level2_menu_missing');
  assert.equal(result.writeStarted, false);
  flags(result);
  assert.equal(result.pickerDiag.reason, 'picker_level2_menu_missing');
  assert.equal(result.pickerDiag.question, '期望从事职位类别');
  assert.equal(result.pickerDiag.confirmClicked, false);
  assert.equal(result.pickerDiag.confirmPresent, true);
  assert.equal(result.pickerDiag.steps.at(-1).step, 'abort');
  assert.equal(result.pickerDiag.steps.at(-1).panelFound, true);
  assert.ok(result.pickerDiag.steps.at(-1).levels.some((level) => level.level === 1 && level.options.some((option) => option.text === '金融/保险' && option.classes.includes('selected') && option.classes.includes('has-child'))));
  assert.equal(result.pickerDiag.steps.some((step) => step.clicked && step.clicked.text === '金融/保险' && step.clicked.level === 1), true);
  assert.equal(stats.level1, 1);
  assert.equal(stats.checkbox, 0);
  assert.equal(stats.confirm, 0);
  assert.equal(stats.panelCancel, 1);
  assert.equal(stats.save, 0);
  assert.equal(menuCount(form, '期望从事职位类别'), 1);
  const panel = itemByLabel(form, '期望从事职位类别').querySelector('.dialog-wrap');
  assert.equal(panel.style.display, 'none');
  assert.equal(itemInput(form, '期望从事职位类别').value, '');
  assert.equal(assessGthIntentFill(result).state, 'stopped_before_write');
  assert.equal(assessGthIntentFill(result).reason, 'picker_level2_menu_missing');
});

test('a full-width selection counter still allows a picker write', async () => {
  const wide = { trigger: '', chips: [], counter: '（0/5）' };
  const { form, stats, api } = mount({
    pickers: {
      期望工作地区: wide,
      期望从事职位类别: wide,
      现从事行业: wide,
      现从事职位类别: wide,
    },
    salaries: { 期望薪资: '', 现薪资: '' },
  });
  const result = await api.trial(request());
  assert.equal(result.ok, true);
  assert.equal(result.writeStarted, true);
  assert.equal(result.reason, null);
  flags(result);
  assert.equal(itemInput(form, '期望从事职位类别').value, '投资/证券/基金');
  assert.equal(itemInput(form, '现从事行业').value, '证券/投资/基金/信托');
  assert.equal(itemInput(form, '现从事职位类别').value, '银行');
  assert.equal(stats.confirm, 3);
  assert.equal(stats.checkbox, 3);
  assert.equal(stats.panelCancel, 0);
  assert.equal(stats.save, 0);
  assert.equal(result.fields.every((row) => row.reason === 'readback_matched'), true);
});

test('a full-width full counter refuses another checkbox and cancels the panel', async () => {
  const { stats, api } = mount({
    pickers: {
      期望从事职位类别: { trigger: '', chips: [], counter: '（5/5）' },
      现从事行业: EMPTY,
      现从事职位类别: EMPTY,
    },
    salaries: { 期望薪资: '', 现薪资: '' },
  });
  const result = await api.trial(request());
  assert.equal(result.reason, 'picker_selection_limit');
  assert.equal(result.writeStarted, false);
  assert.equal(stats.level1, 1);
  assert.equal(stats.checkbox, 0);
  assert.equal(stats.confirm, 0);
  assert.equal(stats.panelCancel, 1);
  assert.equal(stats.save, 0);
  assert.equal(assessGthIntentFill(result).reason, 'picker_selection_limit');
});

test('single-select industry and role apply on the level-2 click without 确定', async () => {
  const singleEmpty = { trigger: '', chips: [], single: true, counter: '（0/1）' };
  const { form, stats, api } = mount({
    pickers: {
      期望从事职位类别: EMPTY,
      现从事行业: singleEmpty,
      现从事职位类别: singleEmpty,
    },
    salaries: { 期望薪资: '', 现薪资: '' },
  });
  const industryFoot = itemByLabel(form, '现从事行业').querySelector('.pop-foot');
  const roleFoot = itemByLabel(form, '现从事职位类别').querySelector('.pop-foot');
  assert.equal(industryFoot.style.display, 'none');
  assert.equal(roleFoot.style.display, 'none');
  const result = await api.trial(request());
  assert.equal(result.ok, true);
  assert.equal(result.writeStarted, true);
  assert.equal(result.reason, null);
  flags(result);
  assert.equal(itemInput(form, '期望从事职位类别').value, '投资/证券/基金');
  assert.equal(itemInput(form, '现从事行业').value, '证券/投资/基金/信托');
  assert.equal(itemInput(form, '现从事职位类别').value, '银行');
  assert.equal(stats.confirm, 1);
  assert.equal(stats.checkbox, 1);
  assert.equal(stats.level2, 2);
  assert.equal(stats.level1, 3);
  assert.equal(stats.panelCancel, 0);
  assert.equal(stats.save, 0);
  assert.equal(itemByLabel(form, '现从事行业').querySelector('.dialog-wrap').style.display, 'none');
  assert.equal(itemByLabel(form, '现从事职位类别').querySelector('.dialog-wrap').style.display, 'none');
  assert.equal(result.fields.find((row) => row.question === '现从事行业').reason, 'readback_matched');
  assert.equal(result.fields.find((row) => row.question === '现从事职位类别').reason, 'readback_matched');
  assert.equal(result.liveSupportClaimed, false);
});

test('a different single-select chip is left in place', async () => {
  const { form, stats, api } = mount({
    pickers: {
      现从事行业: { trigger: '银行', chips: ['银行'], single: true, counter: '（1/1）' },
      现从事职位类别: { trigger: '银行', chips: ['银行'], single: true, counter: '（1/1）' },
    },
    salaries: { 期望薪资: '300000', 现薪资: '200000' },
  });
  const result = await api.trial(request());
  assert.equal(result.reason, 'picker_existing_selection_conflict');
  assert.equal(result.writeStarted, false);
  flags(result);
  assert.equal(stats.level1, 0);
  assert.equal(stats.level2, 0);
  assert.equal(stats.checkbox, 0);
  assert.equal(stats.confirm, 0);
  assert.equal(stats.panelCancel, 1);
  assert.equal(stats.save, 0);
  assert.equal(itemInput(form, '现从事行业').value, '银行');
  assert.deepEqual(
    [...itemByLabel(form, '现从事行业').querySelectorAll('.selected-view-data > li p')].map((node) => node.textContent.trim()),
    ['银行']
  );
  assert.equal(itemByLabel(form, '现从事行业').querySelector('.dialog-wrap').style.display, 'none');
});

test('an exact chip and trigger skip the panel, then a later level-1-only write still fills', async () => {
  const mounted = mount({
    pickers: {
      现从事职位类别: { trigger: '银行', chips: ['银行'], counter: '(1/5)' },
    },
    salaries: { 期望薪资: '300000', 现薪资: '200000' },
  });
  const first = await mounted.api.trial(request());
  assert.equal(first.ok, true);
  assert.equal(first.writeStarted, false);
  assert.equal(first.fields.every((row) => row.reason === 'preexisting_same_value'), true);
  assert.equal(mounted.stats.panelCancel, 0);
  assert.equal(mounted.stats.level1, 0);
  assert.equal(mounted.stats.confirm, 0);
  flags(first);
  for (const label of ['期望工作地区', '期望从事职位类别', '现从事行业', '现从事职位类别']) leaveL1Only(mounted.form, label);
  clearPicker(mounted.form, '期望从事职位类别');
  assert.equal(menuCount(mounted.form, '期望从事职位类别'), 1);
  assert.equal(menuCount(mounted.form, '现从事行业'), 1);
  const second = await mounted.api.trial(request());
  assert.equal(second.ok, true);
  assert.equal(second.writeStarted, true);
  flags(second);
  assert.equal(second.fields.find((row) => row.question === '期望从事职位类别').reason, 'readback_matched');
  assert.equal(second.fields.find((row) => row.question === '现从事行业').reason, 'preexisting_same_value');
  assert.equal(second.fields.find((row) => row.question === '现从事职位类别').reason, 'preexisting_same_value');
  assert.equal(second.fields.find((row) => row.question === '期望薪资').reason, 'preexisting_same_value');
  assert.equal(itemInput(mounted.form, '期望从事职位类别').value, '投资/证券/基金');
  assert.equal(menuCount(mounted.form, '期望从事职位类别'), 2);
  assert.equal(mounted.stats.confirm, 1);
  assert.equal(mounted.stats.checkbox, 1);
  assert.equal(mounted.stats.panelCancel, 0);
  assert.equal(mounted.stats.save, 0);
  assert.equal(second.liveSupportClaimed, false);
});

test('a same-value open and cancel leaves the picker writable in that editor', async () => {
  const mounted = mount({
    pickers: {
      现从事职位类别: { trigger: '银行', chips: [], counter: '(0/5)' },
    },
    salaries: { 期望薪资: '300000', 现薪资: '200000' },
  }, {
    pickers: {
      现从事职位类别: {
        onOpen({ panel }) {
          if (panel.dataset.revealed === '1') return;
          panel.dataset.revealed = '1';
          panel.querySelector('.selected-view-data').innerHTML = '<li><p>银行</p><i></i></li>';
          panel.querySelector('.selected-counter > p').textContent = '(1/5)';
        },
      },
    },
  });
  const first = await mounted.api.trial(request());
  assert.equal(first.ok, true);
  assert.equal(first.writeStarted, false);
  assert.equal(first.fields.find((row) => row.question === '现从事职位类别').reason, 'preexisting_same_value');
  assert.equal(mounted.stats.panelCancel, 1);
  assert.equal(mounted.stats.confirm, 0);
  assert.equal(mounted.stats.checkbox, 0);
  assert.equal(menuCount(mounted.form, '现从事职位类别'), 1);
  assert.equal(itemInput(mounted.form, '现从事职位类别').value, '银行');
  flags(first);
  clearPicker(mounted.form, '现从事职位类别');
  const second = await mounted.api.trial(request());
  assert.equal(second.ok, true);
  assert.equal(second.writeStarted, true);
  flags(second);
  assert.equal(second.fields.find((row) => row.question === '现从事职位类别').reason, 'readback_matched');
  assert.equal(second.fields.find((row) => row.question === '期望从事职位类别').reason, 'preexisting_same_value');
  assert.equal(itemInput(mounted.form, '现从事职位类别').value, '银行');
  assert.equal(menuCount(mounted.form, '现从事职位类别'), 2);
  assert.equal(mounted.stats.confirm, 1);
  assert.equal(mounted.stats.checkbox, 1);
  assert.equal(mounted.stats.save, 0);
  assert.equal(second.liveSupportClaimed, false);
});

function arrivalTexts(root) {
  return [...root.querySelectorAll('li.el-select-dropdown__item')].map((node) => node.textContent.trim());
}

const settledPickers = {
  pickers: { 现从事职位类别: { trigger: '银行', chips: ['银行'], counter: '(1/5)' } },
  salaries: { 期望薪资: '300000', 现薪资: '200000' },
};

test('到岗日期 same value survives the body-level dropdown left by the first open', async () => {
  const custom = answers({ 到岗日期: '一个月内' });
  const questions = [...REQUIRED, '到岗日期'];
  const mounted = mount({ ...settledPickers, arrival: '' }, { arrivalAppendToBody: true });
  const first = await mounted.api.trial(request(custom, questions));
  assert.equal(first.ok, true);
  assert.equal(first.writeStarted, true);
  flags(first);
  assert.equal(itemInput(mounted.form, '到岗日期').value, '一个月内');
  assert.equal(first.fields.find((row) => row.question === '到岗日期').reason, 'readback_matched');
  const menu = mounted.dom.window.document.body.querySelector(':scope > .el-select-dropdown.el-popper');
  assert.ok(menu);
  assert.equal(menu.parentElement, mounted.dom.window.document.body);
  assert.equal(menu.style.display, 'none');
  assert.equal(mounted.form.querySelector('.el-select-dropdown.el-popper'), null);
  assert.deepEqual(arrivalTexts(menu), ['请选择', '一周内', '一个月内', '一个月以上', '即时', '面议']);
  assert.equal(mounted.stats.option, 1);
  assert.equal(mounted.stats.save, 0);
  const second = await mounted.api.trial(request(custom, questions));
  assert.equal(second.ok, true);
  assert.equal(second.reason, null);
  assert.equal(second.writeStarted, false);
  flags(second);
  assert.equal(second.fields.find((row) => row.question === '到岗日期').reason, 'preexisting_same_value');
  assert.equal(second.fields.every((row) => row.status === 'verified'), true);
  assert.equal(itemInput(mounted.form, '到岗日期').value, '一个月内');
  assert.equal(mounted.stats.option, 1);
  assert.equal(mounted.stats.save, 0);
  assert.equal(second.liveSupportClaimed, false);
});

test('a body-level 到岗日期 dropdown fills a new value and can replace a different one', async () => {
  const custom = answers({ 到岗日期: '一个月内' });
  const questions = [...REQUIRED, '到岗日期'];
  const fresh = mount({ ...settledPickers, arrival: '' });
  const menu = moveArrivalDropdownToBody(fresh.form);
  assert.equal(menu.parentElement, fresh.dom.window.document.body);
  assert.equal(menu.style.display, 'none');
  assert.deepEqual(arrivalTexts(menu), ARRIVAL_WITH_PLACEHOLDER);
  const filled = await fresh.api.trial(request(custom, questions));
  assert.equal(filled.ok, true);
  assert.equal(filled.writeStarted, true);
  flags(filled);
  assert.equal(itemInput(fresh.form, '到岗日期').value, '一个月内');
  assert.equal(filled.fields.find((row) => row.question === '到岗日期').reason, 'readback_matched');
  assert.equal(fresh.stats.option, 1);
  assert.equal(fresh.stats.save, 0);
  assert.equal(menu.style.display, 'none');

  const occupied = mount({ ...settledPickers, arrival: '一周内' });
  moveArrivalDropdownToBody(occupied.form);
  const blocked = await occupied.api.trial(request(custom, questions));
  assert.equal(blocked.reason, 'existing_value');
  assert.equal(blocked.writeStarted, false);
  assert.equal(itemInput(occupied.form, '到岗日期').value, '一周内');
  assert.equal(occupied.stats.option, 0);
  assert.equal(occupied.stats.save, 0);
  const replaced = await occupied.api.trial(request(custom, questions, { replaceExisting: true }));
  assert.equal(replaced.ok, true);
  assert.equal(replaced.writeStarted, true);
  flags(replaced);
  assert.equal(itemInput(occupied.form, '到岗日期').value, '一个月内');
  assert.equal(replaced.fields.find((row) => row.question === '到岗日期').reason, 'readback_reapplied');
  assert.equal(occupied.stats.option, 1);
  assert.equal(occupied.stats.save, 0);
  assert.equal(replaced.liveSupportClaimed, false);
});

test('two body-level 到岗日期 dropdowns fail closed and leave later fields not_run', async () => {
  const custom = answers({ 到岗日期: '即时' });
  const mounted = mount({ ...settledPickers, arrival: '' });
  const { menu, copy } = cloneArrivalDropdownOnBody(mounted.form);
  assert.equal(menu.parentElement, mounted.dom.window.document.body);
  assert.equal(copy.parentElement, mounted.dom.window.document.body);
  assert.deepEqual(arrivalTexts(menu), ARRIVAL_WITH_PLACEHOLDER);
  assert.deepEqual(arrivalTexts(copy), ARRIVAL_WITH_PLACEHOLDER);
  const result = await mounted.api.trial(request(custom, [...REQUIRED, '到岗日期']));
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'select_structure_changed');
  assert.equal(result.writeStarted, false);
  flags(result);
  assert.equal(mounted.stats.option, 0);
  assert.equal(mounted.stats.save, 0);
  assert.equal(itemInput(mounted.form, '到岗日期').value, '');
  assert.equal(menu.style.display, 'none');
  assert.equal(copy.style.display, 'none');
  assert.equal(result.fields.find((row) => row.question === '期望从事职位类别').status, 'verified');
  assert.equal(result.fields.find((row) => row.question === '期望从事职位类别').reason, 'preexisting_same_value');
  assert.equal(result.fields.find((row) => row.question === '现从事行业').reason, 'preexisting_same_value');
  assert.equal(result.fields.find((row) => row.question === '现从事职位类别').reason, 'preexisting_same_value');
  assert.equal(result.fields.find((row) => row.question === '到岗日期').status, 'failed');
  assert.equal(result.fields.find((row) => row.question === '到岗日期').reason, 'select_structure_changed');
  assert.equal(result.fields.find((row) => row.question === '期望薪资').reason, 'not_run');
  assert.equal(result.fields.find((row) => row.question === '现薪资').reason, 'not_run');
  assert.equal(assessGthIntentFill(result).reason, 'select_structure_changed');
  assert.equal(assessGthIntentFill(result).state, 'stopped_before_write');
  assert.equal(result.liveSupportClaimed, false);
});

test('replaceExisting re-picks a single-select level-2 and fails closed when readback differs', async () => {
  const kept = mount({
    pickers: {
      现从事行业: { trigger: '银行', chips: ['银行'], single: true, counter: '（1/1）' },
    },
    salaries: { 期望薪资: '300000', 现薪资: '200000' },
  });
  const blocked = await kept.api.trial(request());
  assert.equal(blocked.reason, 'picker_existing_selection_conflict');
  assert.equal(blocked.writeStarted, false);
  assert.equal(kept.stats.level1, 0);
  assert.equal(kept.stats.level2, 0);
  assert.equal(kept.stats.remove, 0);
  assert.equal(kept.stats.panelCancel, 1);
  assert.equal(kept.stats.save, 0);
  assert.equal(itemInput(kept.form, '现从事行业').value, '银行');

  const replaced = mount({
    pickers: {
      现从事行业: { trigger: '银行', chips: ['银行'], single: true, counter: '（1/1）' },
      现从事职位类别: { trigger: '银行', chips: ['银行'], counter: '(1/5)' },
    },
    salaries: { 期望薪资: '300000', 现薪资: '200000' },
  });
  const industry = itemByLabel(replaced.form, '现从事行业');
  assert.equal(industry.querySelector('.pop-foot').style.display, 'none');
  assert.equal(industry.querySelector('.selected-counter > p').textContent, '（1/1）');
  assert.deepEqual(
    pickerModel('现从事职位类别').observedL2,
    ['银行', '投资/证券/基金', '保险', '担保/典当/拍卖']
  );
  const result = await replaced.api.trial(request(answers(), REQUIRED, { replaceExisting: true }));
  assert.equal(result.ok, true);
  assert.equal(result.writeStarted, true);
  flags(result);
  assert.equal(itemInput(replaced.form, '现从事行业').value, '证券/投资/基金/信托');
  assert.deepEqual(
    [...industry.querySelectorAll('.selected-view-data > li p')].map((node) => node.textContent.trim()),
    ['证券/投资/基金/信托']
  );
  assert.equal(industry.querySelector('.dialog-wrap').style.display, 'none');
  assert.equal(result.fields.find((row) => row.question === '现从事行业').reason, 'readback_reapplied');
  assert.equal(replaced.stats.level2, 1);
  assert.equal(replaced.stats.confirm, 0);
  assert.equal(replaced.stats.checkbox, 0);
  assert.equal(replaced.stats.panelCancel, 0);
  assert.equal(replaced.stats.remove, 0);
  assert.equal(replaced.stats.save, 0);

  const mismatch = mount({
    pickers: {
      现从事行业: { trigger: '银行', chips: ['银行'], single: true, counter: '（1/1）' },
    },
    salaries: { 期望薪资: '300000', 现薪资: '200000' },
  }, {
    pickers: {
      现从事行业: {
        onSingle({ input, panel, chips }) {
          input.value = '保险';
          chips.innerHTML = '<li uid="1313"><p>保险</p><i></i></li>';
          panel.style.display = 'none';
        },
      },
    },
  });
  const failed = await mismatch.api.trial(request(answers(), REQUIRED, { replaceExisting: true }));
  assert.equal(failed.ok, false);
  assert.equal(failed.reason, 'picker_replace_unverified');
  assert.equal(failed.writeStarted, true);
  flags(failed);
  assert.equal(itemInput(mismatch.form, '现从事行业').value, '保险');
  assert.equal(itemByLabel(mismatch.form, '现从事行业').querySelector('.dialog-wrap').style.display, 'none');
  assert.equal(mismatch.stats.panelCancel, 0);
  assert.equal(mismatch.stats.confirm, 0);
  assert.equal(mismatch.stats.save, 0);
  assert.equal(failed.fields.find((row) => row.question === '现从事行业').reason, 'picker_replace_unverified');
  assert.equal(failed.pickerDiag.reason, 'picker_replace_unverified');
  assert.equal(failed.pickerDiag.question, '现从事行业');
  assert.equal(failed.pickerDiag.inputBefore, '银行');
  assert.equal(failed.pickerDiag.inputAfter, '保险');
  assert.equal(failed.pickerDiag.confirmPresent, false);
  assert.equal(failed.pickerDiag.confirmClicked, false);
  assert.equal(failed.pickerDiag.siteValid, true);
  assert.equal(failed.pickerDiag.steps.some((step) => step.note === 'level1_already_selected' && step.clicked == null), true);
  assert.equal(failed.pickerDiag.steps.some((step) => step.panelFound === true && step.panelShown === true), true);
  const replaceAbort = failed.pickerDiag.steps.at(-1);
  assert.equal(replaceAbort.step, 'abort');
  assert.equal(replaceAbort.panelShown, false);
  assert.ok(replaceAbort.levels.some((level) => level.options.some((option) => option.text === '证券/投资/基金/信托' && option.classes.includes('branch'))));
  assert.equal(failed.fields.find((row) => row.question === '现从事职位类别').reason, 'not_run');
  assert.equal(failed.fields.find((row) => row.question === '期望薪资').reason, 'not_run');
  assert.equal(assessGthIntentFill(failed).state, 'unknown');
  assert.equal(assessGthIntentFill(failed).reason, 'picker_replace_unverified');
  assert.equal(failed.liveSupportClaimed, false);
});

test('replaceExisting removes multi-select chips, confirms the target, and cancels a broken chip', async () => {
  const replaced = mount({
    pickers: {
      期望从事职位类别: { trigger: '银行', chips: ['银行'], counter: '(1/5)' },
      现从事职位类别: { trigger: '银行', chips: ['银行'], counter: '(1/5)' },
    },
    salaries: { 期望薪资: '300000', 现薪资: '200000' },
  });
  const job = itemByLabel(replaced.form, '期望从事职位类别');
  assert.equal(job.querySelector('.pop-foot').style.display, '');
  assert.equal(job.querySelector('.selected-counter > p').textContent, '(1/5)');
  const result = await replaced.api.trial(request(answers(), REQUIRED, { replaceExisting: true }));
  assert.equal(result.ok, true);
  assert.equal(result.writeStarted, true);
  flags(result);
  assert.equal(itemInput(replaced.form, '期望从事职位类别').value, '投资/证券/基金');
  assert.deepEqual(
    [...job.querySelectorAll('.selected-view-data > li p')].map((node) => node.textContent.trim()),
    ['投资/证券/基金']
  );
  assert.equal(job.querySelector('.selected-view-data > li').getAttribute('uid'), '1313');
  assert.equal(job.querySelector('.dialog-wrap').style.display, 'none');
  assert.equal(result.fields.find((row) => row.question === '期望从事职位类别').reason, 'readback_reapplied');
  assert.equal(replaced.stats.remove, 1);
  assert.equal(replaced.stats.checkbox, 1);
  assert.equal(replaced.stats.confirm, 1);
  assert.equal(replaced.stats.panelCancel, 0);
  assert.equal(replaced.stats.save, 0);
  assert.equal(result.liveSupportClaimed, false);

  const broken = mount({
    pickers: {
      期望从事职位类别: { trigger: '银行', chips: ['银行'], counter: '(1/5)', chipMarkup: 'no-remove' },
    },
    salaries: { 期望薪资: '300000', 现薪资: '200000' },
  });
  const failed = await broken.api.trial(request(answers(), REQUIRED, { replaceExisting: true }));
  assert.equal(failed.ok, false);
  assert.equal(failed.reason, 'picker_structure_changed');
  assert.equal(failed.writeStarted, false);
  flags(failed);
  assert.equal(itemInput(broken.form, '期望从事职位类别').value, '银行');
  assert.equal(broken.stats.remove, 0);
  assert.equal(broken.stats.checkbox, 0);
  assert.equal(broken.stats.confirm, 0);
  assert.equal(broken.stats.level1, 0);
  assert.equal(broken.stats.panelCancel, 1);
  assert.equal(broken.stats.save, 0);
  assert.equal(itemByLabel(broken.form, '期望从事职位类别').querySelector('.dialog-wrap').style.display, 'none');
  assert.equal(failed.fields.find((row) => row.question === '期望从事职位类别').reason, 'picker_structure_changed');
  assert.equal(failed.fields.find((row) => row.question === '现从事行业').reason, 'not_run');
  assert.equal(assessGthIntentFill(failed).reason, 'picker_structure_changed');
  assert.equal(assessGthIntentFill(failed).state, 'stopped_before_write');
});

test('a stop after a verified field marks only the active field and leaves the rest not_run', async () => {
  const { api } = mount({
    pickers: {
      期望从事职位类别: { trigger: '投资/证券/基金', chips: ['投资/证券/基金'], counter: '(1/5)' },
      现从事行业: { ...EMPTY, l1Only: true },
      现从事职位类别: EMPTY,
    },
    salaries: { 期望薪资: '', 现薪资: '' },
  }, {
    pickers: { 现从事行业: { onLevel1() {} } },
  });
  const result = await api.trial(request());
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'picker_level2_menu_missing');
  assert.equal(result.writeStarted, false);
  flags(result);
  assert.equal(result.fields.find((row) => row.question === '期望从事职位类别').status, 'verified');
  assert.equal(result.fields.find((row) => row.question === '期望从事职位类别').reason, 'preexisting_same_value');
  assert.equal(result.fields.find((row) => row.question === '现从事行业').status, 'failed');
  assert.equal(result.fields.find((row) => row.question === '现从事行业').reason, 'picker_level2_menu_missing');
  for (const question of ['现从事职位类别', '期望薪资', '现薪资']) {
    const row = result.fields.find((item) => item.question === question);
    assert.equal(row.status, 'failed');
    assert.equal(row.reason, 'not_run');
  }
  assert.equal(assessGthIntentFill(result).reason, 'picker_level2_menu_missing');
  assert.equal(assessGthIntentFill(result).state, 'stopped_before_write');
  assert.equal(result.liveSupportClaimed, false);
});

const LIVE_PARTIAL = {
  期望工作地区: '北京||大兴区',
  期望薪资: '15000',
  到岗日期: '一个月内',
};
const LIVE_UNTOUCHED = ['期望从事职位类别', '现从事行业', '现从事职位类别', '现薪资'];

test('omitAbsent fills 到岗日期, 北京||大兴区, and 15000 without writing the other four', async () => {
  const region = pickerModel('期望工作地区');
  assert.equal(region.observedL1, '北京');
  assert.equal(region.l1.some((row) => row.x === '北京' && String(row.c).includes('has-child')), true);
  assert.ok(region.observedL2.includes('大兴区'));
  assert.deepEqual(ARRIVAL_WITH_PLACEHOLDER, ['请选择', '一周内', '一个月内', '一个月以上', '即时', '面议']);
  assert.equal(pickerModel('期望从事职位类别').trigger, '投资/证券/基金');
  assert.equal(pickerModel('现从事行业').trigger, '证券/投资/基金/信托');
  assert.equal(pickerModel('现从事职位类别').trigger, '投资/证券/基金');

  const kept = mount({
    salaries: { 期望薪资: '12000', 现薪资: '12000' },
    arrival: '',
  });
  const before = Object.fromEntries(LIVE_UNTOUCHED.map((label) => [label, itemInput(kept.form, label).value]));
  assert.equal(itemInput(kept.form, '期望工作地区').value, '北京');
  assert.equal(itemInput(kept.form, '期望薪资').value, '12000');
  assert.equal(itemInput(kept.form, '到岗日期').value, '');
  const blocked = await kept.api.trial(request(LIVE_PARTIAL));
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'missing_profile_value');
  assert.equal(blocked.writeStarted, false);
  assert.equal(blocked.liveSupportClaimed, false);
  assert.equal(kept.stats.save, 0);
  assert.equal(kept.stats.confirm, 0);
  assert.equal(kept.stats.option, 0);
  assert.equal(itemInput(kept.form, '期望薪资').value, '12000');
  assert.equal(itemInput(kept.form, '期望工作地区').value, '北京');
  assert.equal(itemInput(kept.form, '到岗日期').value, '');
  for (const label of LIVE_UNTOUCHED) assert.equal(itemInput(kept.form, label).value, before[label]);

  const typed = mount({
    salaries: { 期望薪资: '12000', 现薪资: '12000' },
    arrival: '',
  });
  const invalid = await typed.api.trial(request(LIVE_PARTIAL, Object.keys(LIVE_PARTIAL), { omitAbsent: 'true', replaceExisting: true }));
  assert.equal(invalid.reason, 'intent_request_invalid');
  assert.equal(invalid.writeStarted, false);
  assert.equal(typed.stats.save, 0);
  assert.equal(itemInput(typed.form, '期望薪资').value, '12000');

  const filled = mount({
    salaries: { 期望薪资: '12000', 现薪资: '12000' },
    arrival: '',
  });
  const untouched = Object.fromEntries(LIVE_UNTOUCHED.map((label) => [label, itemInput(filled.form, label).value]));
  const result = await filled.api.trial(request(LIVE_PARTIAL, Object.keys(LIVE_PARTIAL), { omitAbsent: true, replaceExisting: true }));
  assert.equal(result.ok, true);
  assert.equal(result.reason, null);
  assert.equal(result.writeStarted, true);
  assert.equal(result.complete, false);
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.softwareClickedSave, false);
  assert.equal(result.softwareClickedSubmit, false);
  assert.equal(result.softwareClickedDelete, false);
  assert.deepEqual(Array.from(result.fields, (row) => row.question), ['期望薪资', '期望工作地区', '到岗日期']);
  assert.equal(result.fields.find((row) => row.question === '期望工作地区').reason, 'readback_reapplied');
  assert.equal(result.fields.find((row) => row.question === '到岗日期').reason, 'readback_matched');
  assert.equal(result.fields.find((row) => row.question === '期望薪资').reason, 'readback_reapplied');
  assert.equal(itemInput(filled.form, '期望工作地区').value, '大兴区');
  assert.equal(itemInput(filled.form, '到岗日期').value, '一个月内');
  assert.equal(itemInput(filled.form, '期望薪资').value, '15000');
  for (const label of LIVE_UNTOUCHED) assert.equal(itemInput(filled.form, label).value, untouched[label]);
  assert.equal(filled.stats.save, 0);
  assert.equal(filled.stats.formCancel, 0);
  assert.equal(filled.stats.confirm, 1);
  assert.equal(filled.stats.option, 1);
  assert.equal(filled.stats.checkbox, 1);
  assert.equal(filled.stats.remove, 1);
  assert.equal(assessGthIntentFill(result).ok, false);
  assert.equal(source.includes("status:'skipped'"), false);
});

function regionRequest() {
  return request({ 期望工作地区: '北京||大兴区' }, ['期望工作地区'], { omitAbsent: true, replaceExisting: true });
}

test('replace leaves a selected level-1 alone and chooses level-2, including when 确定 commits late', async () => {
  const collapse = {
    onLevel1({ list }) {
      list?.closest('.eo-cascader-menu')?.remove();
    }
  };
  const confirmed = mount({
    salaries: { 期望薪资: '12000', 现薪资: '12000' },
    arrival: ''
  }, { pickers: { 期望工作地区: collapse } });
  const level1 = itemByLabel(confirmed.form, '期望工作地区').querySelector('li.branch.has-child.selected');
  assert.equal(level1.querySelector(':scope > span').textContent.trim(), '北京');
  assert.ok([...level1.classList].includes('currentClick'));
  assert.ok([...itemByLabel(confirmed.form, '期望工作地区').querySelectorAll('.eo-cascader-menu li')].some((row) => row.textContent.trim() === '大兴区'));
  const result = await confirmed.api.trial(regionRequest());
  assert.equal(result.ok, true);
  assert.equal(result.pickerDiag, undefined);
  assert.equal(itemInput(confirmed.form, '期望工作地区').value, '大兴区');
  assert.equal(confirmed.stats.level1, 0);
  assert.equal(confirmed.stats.checkbox, 1);
  assert.equal(confirmed.stats.confirm, 1);
  assert.equal(confirmed.stats.panelCancel, 0);
  assert.equal(confirmed.stats.save, 0);
  assert.equal(result.fields.find((row) => row.question === '期望工作地区').reason, 'readback_reapplied');
  assert.equal(result.liveSupportClaimed, false);

  const late = mount({
    salaries: { 期望薪资: '12000', 现薪资: '12000' },
    arrival: ''
  }, {
    pickers: {
      期望工作地区: {
        ...collapse,
        onConfirm({ input, panel }) {
          panel.style.display = 'none';
          input.ownerDocument.defaultView.setTimeout(() => { input.value = '大兴区'; }, 60);
        }
      }
    }
  });
  const delayed = await late.api.trial(regionRequest());
  assert.equal(delayed.ok, true);
  assert.equal(delayed.pickerDiag, undefined);
  assert.equal(itemInput(late.form, '期望工作地区').value, '大兴区');
  assert.equal(late.stats.level1, 0);
  assert.equal(late.stats.confirm, 1);
  assert.equal(late.stats.checkbox, 1);
  assert.equal(late.stats.panelCancel, 0);
  assert.equal(late.stats.save, 0);
  assert.equal(itemByLabel(late.form, '期望工作地区').querySelector('.pop-foot').style.display, '');
});

test('replace waits when a preselected level-1 panel closes on the level-2 click and has no 确定', async () => {
  const mounted = mount({
    pickers: {
      期望工作地区: { trigger: '北京', chips: ['北京'], single: true, counter: '（1/1）' }
    },
    salaries: { 期望薪资: '12000', 现薪资: '12000' },
    arrival: ''
  }, {
    pickers: {
      期望工作地区: {
        onLevel1({ list }) {
          list?.closest('.eo-cascader-menu')?.remove();
        },
        onSingle({ input, panel, text, chips }) {
          panel.style.display = 'none';
          input.ownerDocument.defaultView.setTimeout(() => {
            const li = input.ownerDocument.createElement('li');
            li.setAttribute('uid', '1313');
            const paragraph = input.ownerDocument.createElement('p');
            paragraph.textContent = text;
            li.append(paragraph, input.ownerDocument.createElement('i'));
            chips.replaceChildren(li);
            input.value = text;
          }, 60);
        }
      }
    }
  });
  const foot = itemByLabel(mounted.form, '期望工作地区').querySelector('.pop-foot');
  assert.equal(foot.style.display, 'none');
  const result = await mounted.api.trial(regionRequest());
  assert.equal(result.ok, true);
  assert.equal(result.pickerDiag, undefined);
  assert.equal(itemInput(mounted.form, '期望工作地区').value, '大兴区');
  assert.equal(mounted.stats.level1, 0);
  assert.equal(mounted.stats.level2, 1);
  assert.equal(mounted.stats.confirm, 0);
  assert.equal(mounted.stats.checkbox, 0);
  assert.equal(mounted.stats.panelCancel, 0);
  assert.equal(mounted.stats.save, 0);
  assert.equal(result.fields.find((row) => row.question === '期望工作地区').reason, 'readback_reapplied');
  assert.equal(result.softwareClickedSave, false);
  assert.equal(result.liveSupportClaimed, false);
});

function regionChipAfterCheck(text) {
  return {
    onOpen({ panel }) {
      panel.querySelector(':scope > .eo-cascader-panel').addEventListener('click', (event) => {
        if (!event.target.closest('input[type="checkbox"]')) return;
        for (const node of panel.querySelectorAll('.selected-view-data > li p')) {
          if (node.textContent.replace(/\s+/gu, ' ').trim() === '大兴区') node.textContent = text;
        }
      });
    }
  };
}

function regionChips(form) {
  return [...itemByLabel(form, '期望工作地区').querySelectorAll('.selected-view-data > li p')].map((node) => node.textContent.trim());
}

test('a multi-select panel verifies when the chip and input join level-1 and level-2', async () => {
  const fresh = mount({
    pickers: { 期望工作地区: EMPTY },
    salaries: { 期望薪资: '12000', 现薪资: '12000' },
    arrival: ''
  }, { pickers: { 期望工作地区: regionChipAfterCheck('北京大兴区') } });
  const result = await fresh.api.trial(request({ 期望工作地区: '北京||大兴区' }, ['期望工作地区'], { omitAbsent: true }));
  assert.equal(result.ok, true);
  assert.equal(result.reason, null);
  assert.equal(result.pickerDiag, undefined);
  flags(result);
  assert.equal(itemInput(fresh.form, '期望工作地区').value, '北京大兴区');
  assert.deepEqual(regionChips(fresh.form), ['北京大兴区']);
  assert.ok([...itemByLabel(fresh.form, '期望工作地区').querySelectorAll('.eo-cascader-menu label')].some((node) => node.textContent.trim() === '大兴区'));
  assert.equal(result.fields.find((row) => row.question === '期望工作地区').reason, 'readback_matched');
  assert.equal(fresh.stats.checkbox, 1);
  assert.equal(fresh.stats.confirm, 1);
  assert.equal(fresh.stats.panelCancel, 0);
  assert.equal(fresh.stats.save, 0);

  const replaced = mount({
    pickers: { 期望工作地区: { trigger: '北京', chips: ['北京'], counter: '(1/5)' } },
    salaries: { 期望薪资: '12000', 现薪资: '12000' },
    arrival: ''
  }, { pickers: { 期望工作地区: regionChipAfterCheck('北京大兴区') } });
  assert.equal(itemInput(replaced.form, '期望工作地区').value, '北京');
  assert.deepEqual(regionChips(replaced.form), ['北京']);
  const again = await replaced.api.trial(regionRequest());
  assert.equal(again.ok, true);
  assert.equal(again.pickerDiag, undefined);
  flags(again);
  assert.equal(itemInput(replaced.form, '期望工作地区').value, '北京大兴区');
  assert.deepEqual(regionChips(replaced.form), ['北京大兴区']);
  assert.equal(again.fields.find((row) => row.question === '期望工作地区').reason, 'readback_reapplied');
  assert.equal(replaced.stats.remove, 1);
  assert.equal(replaced.stats.level1, 0);
  assert.equal(replaced.stats.checkbox, 1);
  assert.equal(replaced.stats.confirm, 1);
  assert.equal(replaced.stats.panelCancel, 0);
  assert.equal(replaced.stats.save, 0);
});

test('a multi-select chip that is neither the level-2 text nor the joined text fails closed', async () => {
  const other = mount({
    pickers: { 期望工作地区: EMPTY },
    salaries: { 期望薪资: '12000', 现薪资: '12000' },
    arrival: ''
  }, { pickers: { 期望工作地区: regionChipAfterCheck('朝阳区') } });
  const result = await other.api.trial(request({ 期望工作地区: '北京||大兴区' }, ['期望工作地区'], { omitAbsent: true }));
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'picker_selection_not_applied');
  assert.equal(result.writeStarted, true);
  flags(result);
  assert.equal(itemInput(other.form, '期望工作地区').value, '');
  assert.deepEqual(regionChips(other.form), ['朝阳区']);
  assert.equal(other.stats.checkbox, 1);
  assert.equal(other.stats.confirm, 0);
  assert.equal(other.stats.panelCancel, 1);
  assert.equal(other.stats.save, 0);
  assert.equal(result.pickerDiag.reason, 'picker_selection_not_applied');
  assert.equal(result.pickerDiag.confirmClicked, false);
  const branch = result.pickerDiag.steps.find((step) => step.step === 'picker_branch');
  assert.equal(branch.note, 'multi max=5 chips=[]');
  const view = itemByLabel(other.form, '期望工作地区').querySelector('.selected-view-data, [class*=selected-view]');
  const html = String(view.outerHTML).replace(/\s+/gu, ' ').slice(0, 260);
  const dump = result.pickerDiag.steps.find((step) => step.step === 'picker_chips_dump');
  assert.equal(dump.note, `checked=true chips=${JSON.stringify(['朝阳区'])} html=${html}`);
  assert.ok(dump.note.length > 80);
  assert.ok(dump.note.length <= 400);
  assert.match(dump.note, /selected-view/);
  assert.equal(result.pickerDiag.steps.at(-1).step, 'abort');
  assert.equal(assessGthIntentFill(result).reason, 'picker_selection_not_applied');
});

test('a multi-select chip and input that stay the level-2 text still verify', async () => {
  const kept = mount({
    pickers: { 期望工作地区: { trigger: '大兴区', chips: ['大兴区'], counter: '(1/5)' } },
    salaries: { 期望薪资: '12000', 现薪资: '12000' },
    arrival: ''
  });
  const same = await kept.api.trial(request({ 期望工作地区: '北京||大兴区' }, ['期望工作地区'], { omitAbsent: true }));
  assert.equal(same.ok, true);
  assert.equal(same.writeStarted, false);
  flags(same);
  assert.equal(itemInput(kept.form, '期望工作地区').value, '大兴区');
  assert.deepEqual(regionChips(kept.form), ['大兴区']);
  assert.equal(same.fields.find((row) => row.question === '期望工作地区').reason, 'preexisting_same_value');
  assert.equal(kept.stats.checkbox, 0);
  assert.equal(kept.stats.confirm, 0);
  assert.equal(kept.stats.panelCancel, 0);
  assert.equal(kept.stats.remove, 0);
  assert.equal(kept.stats.save, 0);

  const filled = mount({
    pickers: { 期望工作地区: EMPTY },
    salaries: { 期望薪资: '12000', 现薪资: '12000' },
    arrival: ''
  });
  const result = await filled.api.trial(request({ 期望工作地区: '北京||大兴区' }, ['期望工作地区'], { omitAbsent: true }));
  assert.equal(result.ok, true);
  flags(result);
  assert.equal(itemInput(filled.form, '期望工作地区').value, '大兴区');
  assert.deepEqual(regionChips(filled.form), ['大兴区']);
  assert.equal(result.fields.find((row) => row.question === '期望工作地区').reason, 'readback_matched');
  assert.equal(filled.stats.checkbox, 1);
  assert.equal(filled.stats.confirm, 1);
  assert.equal(filled.stats.panelCancel, 0);
  assert.equal(filled.stats.save, 0);
  assert.equal(result.liveSupportClaimed, false);
});
