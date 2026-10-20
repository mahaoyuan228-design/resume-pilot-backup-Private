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
  intentFormHtml,
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
