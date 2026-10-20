/**
 * Shipped GTH intent fill. DOM doubles use only the plain-text salary shape
 * from the shipped salary trial, plus closed-card question names. Cascader
 * option clicks are not implemented. Never Save.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { assessGthIntentFill } from '../src/background/gth-intent-auto.mjs';

const source = readFileSync(new URL('../src/content/gth-intent.js', import.meta.url), 'utf8');
const popup = readFileSync(new URL('../src/popup/popup.js', import.meta.url), 'utf8');
const PAGE = 'https://hr.gtht.com/resume/edit/';
const QUESTIONS = ['期望从事职位类别', '期望薪资', '现从事行业', '现从事职位类别', '现薪资'];
const TITLES = ['基本信息', '教育经历', '求职意向', '工作经验', '职业技能与特长', '附件简历', '其他信息'];
const binding = {
  version: 1,
  epoch: '00000000-0000-4000-8000-000000000001',
  profileHash: 'a'.repeat(64),
};

function profile(salary = '300000') {
  const answers = {
    期望从事职位类别: '投资银行',
    期望薪资: salary,
    现从事行业: '证券',
    现从事职位类别: '研究员',
    现薪资: '200000',
  };
  return {
    customAnswers: answers,
    confirmedFields: QUESTIONS.map((question) => `customAnswers.${question}`),
    customFacts: QUESTIONS.map((question) => ({
      question,
      answer: answers[question],
      sitePageUrl: PAGE,
      sectionName: '求职意向',
      rowContext: 'none',
    })),
  };
}

function request(extra = {}, salary = '300000') {
  return {
    requestId: '1234567890-intent',
    profileBinding: binding,
    replaceExisting: false,
    profile: profile(salary),
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

function page({ salary = '', salaryHtml = '', foreign = '', formOpen = true } = {}) {
  const salaryControl = salaryHtml || `<input id="salary" type="text" value="${salary}">`;
  const form = formOpen ? `<form id="intent-form">
      <div class="el-form-item" id="salary-item">
        <label class="el-form-item__label">期望薪资</label>
        ${salaryControl}
      </div>
      <div class="el-form-item">
        <label class="el-form-item__label">旁边原值</label>
        <input id="other" type="text" value="keep-me">
      </div>
      <button id="save" type="button">保存</button>
      <button id="cancel" type="button">取消</button>
    </form>` : '';
  const sections = TITLES.map((title) => {
    if (title === '基本信息') {
      return `<section class="r-section"><div class="title_">${title}</div>${foreign}</section>`;
    }
    if (title === '求职意向') {
      return `<section class="r-section" id="intent"><div class="title_">${title}<a class="h-e-btn" id="edit" href="javascript:;">编辑</a></div>${form}</section>`;
    }
    return `<section class="r-section"><div class="title_">${title}</div></section>`;
  }).join('');
  const dom = new JSDOM(`<!DOCTYPE html><body>${sections}</body>`, { url: PAGE, pretendToBeVisual: true });
  const clicks = { save: 0, cancel: 0, edit: 0 };
  dom.window.document.getElementById('save')?.addEventListener('click', () => { clicks.save += 1; });
  dom.window.document.getElementById('cancel')?.addEventListener('click', () => { clicks.cancel += 1; });
  dom.window.document.getElementById('edit')?.addEventListener('click', () => { clicks.edit += 1; });
  return { dom, clicks, api: install(dom) };
}

test('intent content does not revive the test hook or cascader option clicks', () => {
  assert.equal(source.includes('GTH_INTENT_TEST'), false);
  assert.equal(source.includes('dialog-search-wrap'), false);
  assert.equal(source.includes('simple-tree'), false);
  assert.equal(source.includes('pop-btn'), false);
  assert.equal(source.includes("status:'skipped'"), false);
  assert.match(source, /message\?\.type !== 'GTH_INTENT_FILL'/);
  assert.match(source, /kind:'unsupported'/);
  assert.match(source, /control_not_supported/);
  assert.match(source, /overwriteProgressOk/);
  assert.match(source, /sectionForms = sections => \[\.\.\.sections\[SECTION_INDEX\]\.querySelectorAll\('form'\)\]/);
  assert.doesNotMatch(source, /textContent\) === '保存'|textContent\)==='保存'/);
  const fn = popup.slice(popup.indexOf('async function performGthIntentTrial'), popup.indexOf('const gthEducationErrors'));
  assert.ok(fn.includes('confirmedGthIntent'));
  assert.ok(fn.indexOf('confirmedGthIntent') < fn.indexOf('src/content/gth-intent.js'));
  assert.ok(fn.indexOf("throw new Error(gthIntentGapsZh(profile))") < fn.indexOf('src/content/gth-intent.js'));
  assert.equal(fn.includes('GTH_INTENT_TEST'), false);
  assert.equal(fn.includes('不在当前交付包'), false);
  const fields = [
    ['期望从事职位类别', 'unsupported', 'probe-gth-edit.json closed-card label only'],
    ['期望薪资', 'text', 'engine.js gthSalaryTrial plain text'],
    ['现从事行业', 'unsupported', 'probe-gth-edit.json closed-card label only'],
    ['现从事职位类别', 'unsupported', 'probe-gth-edit.json closed-card label only'],
    ['现薪资', 'unsupported', 'salary trial does not name this control'],
  ];
  for (const [question, kind, evidence] of fields) {
    assert.match(source, new RegExp(`question:'${question}', kind:'${kind}'`));
    assert.match(source, new RegExp(evidence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('empty plain-text 期望薪资 is read back and unsupported siblings stay failed', async () => {
  const { dom, clicks, api } = page();
  const result = await api.trial(request());
  assert.equal(dom.window.document.getElementById('salary').value, '300000');
  assert.equal(dom.window.document.getElementById('other').value, 'keep-me');
  assert.equal(clicks.save, 0);
  assert.equal(clicks.cancel, 0);
  assert.equal(result.writeStarted, true);
  assert.equal(result.ok, false);
  assert.equal(result.supportedComplete, false);
  assert.equal(result.operableComplete, false);
  assert.equal(result.complete, false);
  assert.equal(result.softwareClickedSave, false);
  assert.equal(result.softwareClickedSubmit, false);
  assert.equal(result.softwareClickedDelete, false);
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.reason, 'control_not_supported');
  assert.equal(result.fields.length, 5);
  assert.deepEqual(Array.from(result.fields, (row) => String(row.question)), QUESTIONS);
  assert.equal(result.fields.every((row) => row.status !== 'skipped'), true);
  for (const question of ['期望从事职位类别', '现从事行业', '现从事职位类别', '现薪资']) {
    const row = result.fields.find((item) => item.question === question);
    assert.equal(row.status, 'failed');
    assert.equal(row.reason, 'control_not_supported');
    assert.equal(row.supported, false);
  }
  const salary = result.fields.find((row) => row.question === '期望薪资');
  assert.equal(salary.status, 'verified');
  assert.equal(salary.reason, 'readback_matched');
  const assessed = assessGthIntentFill(result);
  assert.equal(assessed.ok, false);
  assert.equal(assessed.state, 'unknown');
  assert.notEqual(assessed.state, 'completed');
  assert.equal(assessed.reason, 'control_not_supported');
});

test('different existing 期望薪资 is kept unless replaceExisting is set', async () => {
  const kept = page({ salary: '100000' });
  const blocked = await kept.api.trial(request());
  assert.equal(kept.dom.window.document.getElementById('salary').value, '100000');
  assert.equal(kept.clicks.save, 0);
  assert.equal(blocked.writeStarted, false);
  assert.equal(blocked.fields.find((row) => row.question === '期望薪资').status, 'failed');
  assert.equal(blocked.fields.find((row) => row.question === '期望薪资').reason, 'existing_value');
  assert.equal(assessGthIntentFill(blocked).state, 'stopped_before_write');

  const replaced = page({ salary: '100000' });
  const written = await replaced.api.trial(request({ replaceExisting: true }));
  assert.equal(replaced.dom.window.document.getElementById('salary').value, '300000');
  assert.equal(replaced.dom.window.document.getElementById('other').value, 'keep-me');
  assert.equal(replaced.clicks.save, 0);
  assert.equal(written.writeStarted, true);
  assert.equal(written.fields.find((row) => row.question === '期望薪资').reason, 'readback_reapplied');
  assert.equal(written.supportedComplete, false);
});

test('the same plain-text value is verified without another write', async () => {
  const { dom, clicks, api } = page({ salary: '300000' });
  const result = await api.trial(request());
  assert.equal(dom.window.document.getElementById('salary').value, '300000');
  assert.equal(clicks.save, 0);
  assert.equal(result.writeStarted, false);
  assert.equal(result.fields.find((row) => row.question === '期望薪资').reason, 'preexisting_same_value');
  assert.equal(result.ok, false);
  assert.equal(result.supportedComplete, false);
});

test('two 期望薪资 targets and a cascader-shaped control fail before write', async () => {
  const doubled = page({
    salaryHtml: `<input id="salary" type="text" value=""><input id="salary-2" type="text" value="untouched">`,
  });
  const ambiguous = await doubled.api.trial(request());
  assert.equal(doubled.dom.window.document.getElementById('salary').value, '');
  assert.equal(doubled.dom.window.document.getElementById('salary-2').value, 'untouched');
  assert.equal(doubled.clicks.save, 0);
  assert.equal(ambiguous.writeStarted, false);
  assert.equal(ambiguous.reason, 'intent_target_not_plain_text');
  assert.equal(ambiguous.fields.find((row) => row.question === '期望从事职位类别').reason, 'control_not_supported');

  const widget = page({
    salaryHtml: '<div class="cascader-wrap"><input id="salary" type="text" readonly value=""></div>',
  });
  const refused = await widget.api.trial(request());
  assert.equal(widget.dom.window.document.getElementById('salary').value, '');
  assert.equal(widget.clicks.save, 0);
  assert.equal(refused.writeStarted, false);
  assert.equal(refused.reason, 'intent_target_not_plain_text');
  assert.equal(refused.supportedComplete, false);
});

test('a second label for 期望薪资 is not a unique target', async () => {
  const { dom, clicks, api } = page({
    salaryHtml: `</div><div class="el-form-item"><label class="el-form-item__label">期望薪资</label><input id="salary" type="text" value="stays">`,
  });
  const result = await api.trial(request());
  assert.equal(clicks.save, 0);
  assert.equal(result.writeStarted, false);
  assert.equal(result.reason, 'intent_target_not_unique');
  assert.equal(dom.window.document.getElementById('salary').value, 'stays');
});

test('another section editor blocks intent fill and is not saved', async () => {
  const { clicks, api, dom } = page({ foreign: '<form id="foreign"><input id="foreign-value" type="text" value="other-section"><button type="button" id="foreign-save">保存</button></form>' });
  dom.window.document.getElementById('foreign-save').addEventListener('click', () => { clicks.save += 1; });
  const result = await api.trial(request());
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'other_section_editor_open');
  assert.equal(result.writeStarted, false);
  assert.equal(clicks.save, 0);
  assert.equal(clicks.edit, 0);
  assert.equal(dom.window.document.getElementById('foreign-value').value, 'other-section');
});

test('a closed editor is opened from the unique 编辑 link and cancelled when nothing was written', async () => {
  const { dom, clicks, api } = page({ formOpen: false, salary: '300000' });
  const intent = dom.window.document.getElementById('intent');
  const form = dom.window.document.createElement('form');
  form.innerHTML = `<div class="el-form-item"><label class="el-form-item__label">期望薪资</label><input id="salary" type="text" value="300000"></div>
    <button id="save" type="button">保存</button><button id="cancel" type="button">取消</button>`;
  dom.window.document.getElementById('edit').addEventListener('click', () => {
    if (!form.isConnected) intent.appendChild(form);
  });
  form.querySelector('#save').addEventListener('click', () => { clicks.save += 1; });
  form.querySelector('#cancel').addEventListener('click', () => {
    clicks.cancel += 1;
    form.remove();
  });
  const result = await api.trial(request());
  assert.equal(clicks.edit, 1);
  assert.equal(clicks.save, 0);
  assert.equal(clicks.cancel, 1);
  assert.equal(result.writeStarted, false);
  assert.equal(result.editorLeftOpen, false);
  assert.equal(result.fields.find((row) => row.question === '期望薪资').reason, 'preexisting_same_value');
  assert.equal(result.ok, false);
});

test('unsettled answers do not touch the page', async () => {
  const { clicks, api } = page();
  const bare = request();
  bare.profile = { customAnswers: { 期望薪资: '300000' }, confirmedFields: [], customFacts: [] };
  const result = await api.trial(bare);
  assert.equal(clicks.edit, 0);
  assert.equal(clicks.save, 0);
  assert.equal(result.writeStarted, false);
  assert.equal(result.ok, false);
  assert.equal(result.fields.every((row) => row.status === 'failed'), true);
  assert.equal(result.fields.some((row) => row.status === 'skipped'), false);
  assert.equal(assessGthIntentFill(result).state, 'stopped_before_write');
});
