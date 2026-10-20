/**
 * Open-editor GTH 工作经验 fill. Caller opens the editor.
 * 任职时间 reuses the education month-range writer.
 * 职位类别 / 公司所属行业 use the intent cascader (exact 一级||二级, L2 after L1).
 * 薪资 stays control_not_supported. Never Save. liveSupportClaimed stays false.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { assessGthWorkOpenFill, shippedGthWorkOpenFill } from '../src/background/gth-open-fills.mjs';
import { normalizeProfile } from '../src/profile/store.js';
import { sourceSnapshot } from '../src/profile/cms-internship-plan.mjs';

const core = readFileSync(new URL('../src/content/gth-open-fill.js', import.meta.url), 'utf8');
const workSource = readFileSync(new URL('../src/content/gth-work-fill.js', import.meta.url), 'utf8');
const PAGE = 'https://hr.gtht.com/resume/edit/';
const TITLES = ['基本信息', '教育经历', '求职意向', '工作经验', '职业技能与特长', '附件简历', '其他信息'];
const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const binding = { version: 1, epoch: '00000000-0000-4000-8000-000000000001', profileHash: 'a'.repeat(64) };

function workProfile(row, index = 0, extraConfirmed = []) {
  const keys = Object.keys(row).filter((key) => row[key]);
  return {
    experience: [row],
    confirmedFields: [...keys.map((key) => `experience.${index}.${key}`), ...extraConfirmed],
  };
}

function request(profile, extra = {}) {
  return { requestId: '1234567890-work', profileBinding: binding, replaceExisting: false, profileIndex: 0, profile, ...extra };
}

function boot(html) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, { url: PAGE, pretendToBeVisual: true });
  const { window } = dom;
  window.Element.prototype.getClientRects = () => [{ width: 8, height: 8, top: 0, left: 0, bottom: 8, right: 8 }];
  Object.defineProperty(window.document, 'readyState', { configurable: true, get: () => 'complete' });
  const clicks = [];
  const original = window.HTMLElement.prototype.click;
  window.HTMLElement.prototype.click = function clicked() {
    clicks.push(this);
    return original.call(this);
  };
  const listeners = new Set();
  const chrome = {
    runtime: {
      id: 'synthetic-extension',
      getManifest: () => ({ background: { service_worker: 'src/background/worker.mjs' } }),
      sendMessage: async (message) => (message?.type === 'RESUME_PROFILE_BINDING_CHECK' ? { allowed: true } : { allowed: false }),
      onMessage: {
        addListener(listener) { listeners.add(listener); },
        removeListener(listener) { listeners.delete(listener); },
      },
    },
  };
  const context = vm.createContext({
    chrome, document: window.document, location: window.location, performance: window.performance,
    HTMLInputElement: window.HTMLInputElement, HTMLTextAreaElement: window.HTMLTextAreaElement,
    Event: window.Event, KeyboardEvent: window.KeyboardEvent, getComputedStyle: window.getComputedStyle.bind(window),
    setTimeout: window.setTimeout.bind(window), clearTimeout: window.clearTimeout.bind(window),
  });
  vm.runInContext(core, context);
  vm.runInContext(workSource, context);
  return { dom, clicks, context, listeners };
}

function shell(body, { edit = false, foreign = false } = {}) {
  return TITLES.map((title) => {
    if (title === '工作经验') {
      const link = edit ? '<a class="h-e-btn" id="edit" href="javascript:;">编辑</a>' : '';
      return `<section class="r-section"><div class="title_">${title}${link}</div>${body}</section>`;
    }
    if (foreign && title === '基本信息') {
      return `<section class="r-section"><div class="title_">${title}</div><form class="el-form sec-form" id="foreign"></form></section>`;
    }
    return `<section class="r-section"><div class="title_">${title}</div></section>`;
  }).join('');
}

function formWrap(inner) {
  return `<form class="el-form sec-form" id="editor">${inner}
    <button type="button" id="editor-cancel">取消</button>
    <button type="button" id="editor-save">保存</button>
  </form>
  <a class="eduexp-opt-icon" id="editor-delete" href="javascript:;"><i class="el-icon-delete">删除</i></a>`;
}

function textItem(label, { tag = 'input', value = '', id = '' } = {}) {
  const attrs = `${id ? ` id="${id}"` : ''}${value ? ` value="${value}"` : ''}`;
  const control = tag === 'textarea' ? `<textarea${attrs}>${value}</textarea>` : `<input type="text"${attrs}>`;
  return `<div class="el-form-item"><label class="el-form-item__label">${label}</label><div class="el-form-item__content"><div class="input-l el-input">${control}</div></div></div>`;
}

function monthRangeItem(start = '', end = '') {
  const editor = (id, value) => `<div class="el-date-editor date-hl el-input el-input--prefix el-input--suffix el-date-editor--month">
    <span class="el-input__prefix"><i class="el-input__icon el-icon-date" id="${id}-icon"></i></span>
    <input class="el-input__inner" id="${id}" readonly type="text" value="${value}">
  </div>`;
  const cells = MONTH_NAMES.map((name) => `<td><div><a class="cell">${name}</a></div></td>`).join('');
  return `<div class="el-form-item" id="dates-item"><label class="el-form-item__label">任职时间</label><div class="el-form-item__content">
    ${editor('start-date', start)}${editor('end-date', end)}
    <div class="el-picker-panel el-date-picker" id="month-panel" style="display:none">
      <div class="el-date-picker__header">
        <i class="el-icon-d-arrow-left" id="month-prev"></i>
        <span class="el-date-picker__header-label" id="month-year">2024 年</span>
        <i class="el-icon-d-arrow-right" id="month-next"></i>
      </div>
      <table class="el-month-table"><tbody><tr>${cells}</tr></tbody></table>
    </div>
  </div></div>`;
}

function cascaderItem(label, { id, l1, value = '', single = false, counter = '(0/5)' }) {
  const rows = l1.map((text) => `<li class="branch has-child"><span>${text}</span></li>`).join('');
  const hidden = single ? ' style="display:none"' : '';
  const chip = value ? `<li uid="1"><p>${value}</p><i></i></li>` : '';
  return `<div class="el-form-item"><label class="el-form-item__label">${label}</label>
    <div class="el-form-item__content cascader-wrap">
      <div class="input-l pointer" id="${id}-trigger">
        <div class="input-l pointer el-input"><input class="el-input__inner" id="${id}" readonly type="text" value="${value}"></div>
      </div>
      <div class="dialog-wrap plugin-dialog-wrap popover blue" id="${id}-panel" style="display:none">
        <div class="selected-view-outer"${hidden}><ul class="selected-view-data">${chip}</ul><div class="selected-counter"><p>${counter}</p></div></div>
        <div class="search-outer"><input class="search-input" placeholder="请输入关键字"></div>
        <div class="eo-cascader-panel" id="${id}-cascader"><div class="eo-cascader-menu simple-tree-outer"><ul class="simple-tree-wrapper">${rows}</ul></div></div>
        <div class="pop-foot plugin-dialog-pop-foot"${hidden}><a class="confirm pop-btn" id="${id}-confirm">确定</a><a class="cancel pop-btn" id="${id}-cancel">取消</a></div>
      </div>
    </div>
  </div>`;
}

function salaryItem(value = '') {
  return `<div class="el-form-item"><label class="el-form-item__label">薪资</label><div class="el-form-item__content"><div class="el-input select-l"><input id="salary" type="text" value="${value}"></div></div></div>`;
}

function workFields(options = {}) {
  return [
    textItem('职位名称', { id: 'position', value: options.position || '' }),
    cascaderItem('职位类别', { id: 'job', l1: ['金融/保险', 'IT/产品/运营'], value: options.job || '', counter: options.jobCounter || '(0/5)' }),
    textItem('公司名称', { id: 'organization', value: options.organization || '' }),
    options.dates || monthRangeItem(options.start || '', options.end || ''),
    textItem('工作地区', { id: 'area', value: options.area || '' }),
    textItem('职责与业绩', { tag: 'textarea', id: 'description', value: options.description || '' }),
    cascaderItem('公司所属行业', { id: 'industry', l1: ['金融', 'IT/互联网'], value: options.industry || '', single: options.industrySingle === true, counter: options.industryCounter || '(0/5)' }),
    textItem('公司介绍', { tag: 'textarea', id: 'intro', value: options.intro || '' }),
    textItem('所属部门', { id: 'department', value: options.department || '' }),
    textItem('汇报对象', { id: 'report', value: options.report || '' }),
    textItem('下属人数', { id: 'reports', value: options.reports || '' }),
    salaryItem(options.salary || ''),
    textItem('离职原因', { tag: 'textarea', id: 'leave', value: options.leave || '' }),
  ].join('');
}

const ROW = {
  position: '分析师', organization: '示例证券', description: '负责研究',
  jobCategory: '金融/保险||银行', industry: '金融||证券/投资/基金/信托',
  startDate: '2020-03', endDate: '2024-08',
  workArea: '上海', companyIntro: '证券公司', department: '研究部', reportTo: '总监',
  subordinateCount: '2', leaveReason: '个人发展',
};

function wireMonthRange(document) {
  const panel = document.getElementById('month-panel');
  document.body.appendChild(panel);
  const year = document.getElementById('month-year');
  let active = null;
  const stats = { open: 0, cells: 0 };
  const show = (id) => { active = document.getElementById(id); panel.style.display = 'block'; stats.open += 1; };
  document.getElementById('start-date-icon').addEventListener('click', () => show('start-date'));
  document.getElementById('end-date-icon').addEventListener('click', () => show('end-date'));
  const shift = (delta) => { year.textContent = `${Number(year.textContent.match(/\d{4}/u)[0]) + delta} 年`; };
  document.getElementById('month-prev').addEventListener('click', () => shift(-1));
  document.getElementById('month-next').addEventListener('click', () => shift(1));
  for (const cell of panel.querySelectorAll('td')) {
    cell.addEventListener('click', () => {
      const month = MONTH_NAMES.indexOf(cell.textContent.replace(/\s+/gu, '')) + 1;
      const current = Number(year.textContent.match(/\d{4}/u)[0]);
      if (active) active.value = `${current}-${String(month).padStart(2, '0')}`;
      panel.style.display = 'none';
      stats.cells += 1;
    });
  }
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') panel.style.display = 'none'; });
  return stats;
}

function wireCascader(document, id, { leaves, single = false, reveal = true }) {
  const trigger = document.getElementById(`${id}-trigger`);
  const panel = document.getElementById(`${id}-panel`);
  const input = document.getElementById(id);
  const cascader = document.getElementById(`${id}-cascader`);
  const stats = { open: 0, level1: 0, confirm: 0, cancel: 0, remove: 0 };
  trigger.addEventListener('click', () => { stats.open += 1; panel.style.display = 'block'; });
  cascader.addEventListener('click', (event) => {
    const menus = [...cascader.querySelectorAll(':scope > .eo-cascader-menu.simple-tree-outer')];
    if (menus[0]?.contains(event.target)) {
      const li = event.target.closest('li.branch.has-child');
      if (!li || !menus[0].contains(li) || cascader.querySelector('[data-l2]')) return;
      stats.level1 += 1;
      if (!reveal) return;
      const text = li.querySelector(':scope > span')?.textContent.trim();
      const menu = document.createElement('div');
      menu.className = 'eo-cascader-menu simple-tree-outer';
      menu.dataset.l2 = '1';
      menu.innerHTML = `<ul class="simple-tree-wrapper">${(leaves[text] || []).map((leaf) => `<li class="branch"><label><input type="checkbox">${leaf}</label></li>`).join('')}</ul>`;
      cascader.appendChild(menu);
      return;
    }
    const l2 = cascader.querySelector('[data-l2]');
    if (!l2?.contains(event.target)) return;
    if (single) {
      const li = event.target.closest('li.branch');
      if (!li || !l2.contains(li) || li.classList.contains('has-child')) return;
      const text = (li.querySelector('label') || li.querySelector(':scope > span'))?.textContent.trim();
      if (!text) return;
      panel.querySelector('.selected-view-data').innerHTML = `<li><p>${text}</p><i></i></li>`;
      input.value = text;
      panel.style.display = 'none';
      return;
    }
    const box = event.target.closest('input[type="checkbox"]');
    if (!box?.checked) return;
    const text = box.closest('label')?.textContent.trim();
    const li = document.createElement('li');
    li.innerHTML = `<p>${text}</p><i></i>`;
    panel.querySelector('.selected-view-data').appendChild(li);
  });
  panel.querySelector(`#${id}-confirm`)?.addEventListener('click', () => {
    stats.confirm += 1;
    const chips = [...panel.querySelectorAll('.selected-view-data > li p')].map((node) => node.textContent.trim());
    if (chips.length === 1) input.value = chips[0];
    panel.style.display = 'none';
  });
  panel.querySelector(`#${id}-cancel`)?.addEventListener('click', () => {
    stats.cancel += 1;
    cascader.querySelector('[data-l2]')?.remove();
    panel.style.display = 'none';
  });
  panel.querySelector('.selected-view-data').addEventListener('click', (event) => {
    const icon = event.target.closest('i');
    const li = icon?.closest('li');
    if (!icon || !li || li.parentElement !== panel.querySelector('.selected-view-data')) return;
    stats.remove += 1;
    li.remove();
    const counter = panel.querySelector('.selected-counter > p');
    const match = counter?.textContent.match(/^\((\d+)\/(\d+)\)$/u);
    if (match) counter.textContent = `(${Math.max(0, Number(match[1]) - 1)}/${match[2]})`;
  });
  return stats;
}

const JOB_LEAVES = { '金融/保险': ['银行', '投资/证券/基金'], 'IT/产品/运营': ['产品经理'] };
const INDUSTRY_LEAVES = { 金融: ['证券/投资/基金/信托', '银行'], 'IT/互联网': ['互联网'] };

function wire(document, { revealJob = true, revealIndustry = true, industrySingle = false } = {}) {
  return {
    months: wireMonthRange(document),
    job: wireCascader(document, 'job', { leaves: JOB_LEAVES, reveal: revealJob }),
    industry: wireCascader(document, 'industry', { leaves: INDUSTRY_LEAVES, reveal: revealIndustry, single: industrySingle }),
  };
}

function forbidden(clicks) {
  return clicks.filter((node) => {
    const text = String(node.textContent || '').replace(/[\s\u00a0]+/gu, ' ').trim();
    if (node.closest?.('.plugin-dialog-wrap, .el-picker-panel')) return false;
    if (node.matches?.('a.eduexp-opt-icon, .el-icon-delete') || node.closest?.('a.eduexp-opt-icon, .el-icon-delete')) return true;
    if (node.matches?.('button') || node.closest?.('button')) return true;
    return ['保存', '提交', '投递', '删除', '取消', '编辑'].includes(text);
  });
}

function flags(result) {
  assert.equal(result.complete, false);
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.scope, 'gth_work_open');
  assert.equal(result.editorLeftOpen, true);
  assert.equal(result.softwareClickedSave, false);
  assert.equal(result.softwareClickedSubmit, false);
  assert.equal(result.softwareClickedDelete, false);
  assert.equal(result.savedOnSite, null);
  assert.equal(result.submitted, null);
}

test('empty work editor fills exact labels and leaves 薪资 untouched', async () => {
  const html = shell(formWrap(workFields({ industrySingle: true, industryCounter: '(0/1)' })));
  const { dom, clicks, context } = boot(html);
  const doc = dom.window.document;
  const stats = wire(doc, { industrySingle: true });
  const events = [];
  for (const id of ['position', 'organization', 'description', 'start-date', 'end-date', 'job', 'industry', 'area']) {
    const node = doc.getElementById(id);
    node.addEventListener('input', () => events.push(`${id}:input`));
    node.addEventListener('change', () => events.push(`${id}:change`));
  }
  const result = await context.ResumeGthWorkOpen.trial(request(workProfile(ROW)));
  assert.equal(result.ok, true);
  assert.equal(result.writeStarted, true);
  assert.equal(result.profileIndex, 0);
  flags(result);
  assert.equal(doc.getElementById('position').value, '分析师');
  assert.equal(doc.getElementById('organization').value, '示例证券');
  assert.equal(doc.getElementById('description').value, '负责研究');
  assert.equal(doc.getElementById('start-date').value, '2020-03');
  assert.equal(doc.getElementById('end-date').value, '2024-08');
  assert.equal(doc.getElementById('job').value, '银行');
  assert.equal(doc.getElementById('industry').value, '证券/投资/基金/信托');
  assert.equal(doc.getElementById('area').value, '上海');
  assert.equal(doc.getElementById('salary').value, '');
  assert.equal(result.fields.some((field) => field.question === '薪资'), false);
  assert.equal(result.coverage.find((field) => field.question === '薪资').reason, 'control_not_supported');
  assert.equal(result.fields.find((field) => field.question === '职位类别').reason, 'readback_matched');
  assert.equal(result.fields.find((field) => field.question === '任职时间').path, 'experience.0.startDate');
  assert.equal(stats.months.open, 2);
  assert.equal(stats.job.level1, 1);
  assert.equal(stats.job.confirm, 1);
  assert.equal(stats.industry.confirm, 0);
  assert.equal(stats.job.cancel, 0);
  assert.ok(events.includes('start-date:input') && events.includes('job:change') && events.includes('position:input'));
  assert.equal(assessGthWorkOpenFill(result).ok, true);
  assert.equal(assessGthWorkOpenFill(result).outcome, 'verified');
  assert.equal(forbidden(clicks).length, 0);
  assert.equal(clicks.filter((node) => node.id === 'editor-save' || node.id === 'editor-delete').length, 0);
});

test('matching values stay put and do not open the month panel or cascader', async () => {
  const html = shell(formWrap(workFields({
    position: '分析师', organization: '示例证券', description: '负责研究',
    job: '银行', industry: '证券/投资/基金/信托', start: '2020-03', end: '2024-08',
    area: '上海', intro: '证券公司', department: '研究部', report: '总监', reports: '2', leave: '个人发展',
    jobCounter: '(1/5)', industryCounter: '(1/1)', industrySingle: true,
  })));
  const { dom, clicks, context } = boot(html);
  const stats = wire(dom.window.document, { industrySingle: true });
  const result = await context.ResumeGthWorkOpen.trial(request(workProfile(ROW)));
  assert.equal(result.ok, true);
  assert.equal(result.writeStarted, false);
  flags(result);
  assert.equal(stats.months.open, 0);
  assert.equal(stats.job.open, 0);
  assert.equal(stats.industry.open, 0);
  assert.equal(result.fields.every((field) => field.reason === 'preexisting_same_value'), true);
  assert.equal(assessGthWorkOpenFill(result).outcome, 'verified_preexisting');
  assert.equal(forbidden(clicks).length, 0);
});

test('replaceExisting rewrites a different position and job leaf', async () => {
  const html = shell(formWrap(workFields({
    position: '旧职位', organization: '示例证券', description: '负责研究',
    job: '投资/证券/基金', industry: '证券/投资/基金/信托', start: '2020-03', end: '2024-08',
    area: '上海', intro: '证券公司', department: '研究部', report: '总监', reports: '2', leave: '个人发展',
    jobCounter: '(1/5)', industryCounter: '(1/1)', industrySingle: true,
  })));
  const { dom, clicks, context } = boot(html);
  wire(dom.window.document, { industrySingle: true });
  const result = await context.ResumeGthWorkOpen.trial(request(workProfile(ROW), { replaceExisting: true }));
  assert.equal(result.ok, true);
  assert.equal(dom.window.document.getElementById('position').value, '分析师');
  assert.equal(dom.window.document.getElementById('job').value, '银行');
  assert.equal(result.fields.find((field) => field.question === '职位名称').reason, 'readback_reapplied');
  assert.equal(result.fields.find((field) => field.question === '职位类别').reason, 'readback_reapplied');
  assert.equal(forbidden(clicks).length, 0);
});

test('an existing value without replaceExisting fails before any write', async () => {
  const html = shell(formWrap(workFields({ position: '旧职位' })));
  const { dom, clicks, context } = boot(html);
  wire(dom.window.document);
  const result = await context.ResumeGthWorkOpen.trial(request(workProfile(ROW)));
  assert.equal(result.ok, false);
  assert.equal(result.writeStarted, false);
  assert.equal(result.reason, 'existing_value');
  assert.equal(dom.window.document.getElementById('position').value, '旧职位');
  assert.equal(dom.window.document.getElementById('job').value, '');
  assert.equal(forbidden(clicks).length, 0);
});

test('a missing level-2 menu cancels and leaves later fields not_run', async () => {
  const html = shell(formWrap(workFields()));
  const { dom, clicks, context } = boot(html);
  const stats = wire(dom.window.document, { revealJob: false });
  const result = await context.ResumeGthWorkOpen.trial(request(workProfile(ROW)));
  assert.equal(result.ok, false);
  assert.equal(result.writeStarted, false);
  assert.equal(result.fields.find((field) => field.question === '职位类别').reason, 'picker_level2_menu_missing');
  assert.equal(result.fields.find((field) => field.question === '任职时间').reason, 'not_run');
  assert.equal(result.fields.find((field) => field.question === '职位名称').reason, 'not_run');
  assert.equal(dom.window.document.getElementById('position').value, '');
  assert.equal(dom.window.document.getElementById('job-panel').style.display, 'none');
  assert.equal(stats.job.cancel, 1);
  assert.equal(stats.months.open, 0);
  assert.equal(forbidden(clicks).length, 0);
});

test('a cascader that is not the intent shell is control_not_supported', async () => {
  const html = shell(formWrap(workFields().replace(
    cascaderItem('职位类别', { id: 'job', l1: ['金融/保险'] }),
    '<div class="el-form-item"><label class="el-form-item__label">职位类别</label><div class="el-form-item__content cascader-wrap"><input id="job" readonly type="text" value=""></div></div>',
  )));
  const { dom, clicks, context } = boot(html);
  const result = await context.ResumeGthWorkOpen.trial(request(workProfile(ROW)));
  assert.equal(result.ok, false);
  assert.equal(result.writeStarted, false);
  assert.equal(result.reason, 'control_not_supported');
  assert.equal(result.selectorStep, 'cascader_structure_unknown');
  assert.equal(dom.window.document.getElementById('position').value, '');
  assert.equal(forbidden(clicks).length, 0);
});

test('a present 薪资 fact fails closed before writing other fields', async () => {
  const html = shell(formWrap(workFields({ salary: '20000' })));
  const { dom, context } = boot(html);
  const result = await context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, salary: '20000' })));
  assert.equal(result.ok, false);
  assert.equal(result.writeStarted, false);
  assert.equal(result.reason, 'control_not_supported');
  assert.equal(result.fields.find((field) => field.question === '薪资').reason, 'control_not_supported');
  assert.equal(result.fields.find((field) => field.question === '薪资').supported, false);
  assert.equal(dom.window.document.getElementById('position').value, '');
  assert.equal(dom.window.document.getElementById('salary').value, '20000');
  assert.equal(assessGthWorkOpenFill(result).ok, false);
});

test('the writer requires one open 工作经验 form and does not click 编辑', async () => {
  const closed = boot(shell('<div class="sec-context"></div>'));
  const missing = await closed.context.ResumeGthWorkOpen.trial(request(workProfile(ROW)));
  assert.equal(missing.reason, 'editor_not_open');
  assert.equal(missing.writeStarted, false);

  const doubled = boot(shell(`${formWrap(workFields())}<form class="el-form sec-form" id="second"></form>`));
  const ambiguous = await doubled.context.ResumeGthWorkOpen.trial(request(workProfile(ROW)));
  assert.equal(ambiguous.reason, 'editor_not_unique');

  const titled = boot(shell(formWrap(workFields()), { edit: true }));
  const edited = await titled.context.ResumeGthWorkOpen.trial(request(workProfile(ROW)));
  assert.equal(edited.reason, 'editor_structure_changed');
  assert.equal(titled.clicks.filter((node) => node.id === 'edit').length, 0);

  const other = boot(shell(formWrap(workFields()), { foreign: true }));
  const blocked = await other.context.ResumeGthWorkOpen.trial(request(workProfile(ROW)));
  assert.equal(blocked.reason, 'other_section_editor_open');
});

test('unconfirmed, day-precision, and missing required facts fail before write', async () => {
  const html = shell(formWrap(workFields()));
  const unconfirmed = boot(html);
  const dropped = workProfile(ROW);
  dropped.confirmedFields = dropped.confirmedFields.filter((path) => path !== 'experience.0.jobCategory');
  const pending = await unconfirmed.context.ResumeGthWorkOpen.trial(request(dropped));
  assert.equal(pending.reason, 'profile_fact_unconfirmed');
  assert.equal(pending.writeStarted, false);

  const dated = boot(html);
  const day = await dated.context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate: '2020-03-01' })));
  assert.equal(day.reason, 'invalid_profile_value');
  assert.equal(day.writeStarted, false);

  const blank = boot(html);
  const { position, ...rest } = ROW;
  const missing = await blank.context.ResumeGthWorkOpen.trial(request(workProfile(rest)));
  assert.equal(missing.reason, 'missing_profile_value');
  assert.equal(missing.fields.find((field) => field.question === '职位名称').reason, 'missing_profile_value');
});

test('dispatch injects the work scripts and sends GTH_WORK_FILL', async () => {
  const sent = [];
  const api = {
    scripting: { async executeScript({ files }) { sent.push(files); } },
    tabs: { async sendMessage(_id, message) { sent.push(message); return { ok: true }; } },
  };
  await shippedGthWorkOpenFill({
    api, tab: { id: 3 }, requestId: '1234567890-work', binding, profile: { experience: [] }, profileIndex: 0, replaceExisting: false,
  });
  assert.deepEqual(sent[0], ['src/content/gth-open-fill.js', 'src/content/gth-work-fill.js']);
  assert.equal(sent[1].type, 'GTH_WORK_FILL');
  assert.equal(sent[1].replaceExisting, false);
  assert.equal(sent[1].profileIndex, 0);
});

const RACE_ANIM = ['el-zoom-in-top-enter', 'el-zoom-in-top-enter-active', 'el-zoom-in-top-enter-to'];

function raceMonthItem() {
  const cells = MONTH_NAMES.map((name) => `<td><div><a class="cell">${name}</a></div></td>`).join('');
  const editor = (id) => `<div class="el-date-editor date-hl el-input el-input--prefix el-input--suffix el-date-editor--month" id="${id}-editor">
    <span class="el-input__prefix"><i class="el-input__icon el-icon-date" id="${id}-icon"></i></span>
    <input class="el-input__inner" id="${id}" readonly type="text" value="">
  </div>`;
  const panel = (id) => `<div class="el-picker-panel el-date-picker el-popper" id="${id}-panel" style="display:none">
      <div class="el-date-picker__header">
        <i class="el-icon-d-arrow-left"></i>
        <span class="el-date-picker__header-label">2026 年</span>
        <i class="el-icon-d-arrow-right"></i>
      </div>
      <table class="el-month-table"><tbody><tr>${cells}</tr></tbody></table>
    </div>`;
  return `<div class="el-form-item" id="dates-item"><label class="el-form-item__label">任职时间</label><div class="el-form-item__content">${editor('start-date')}${editor('end-date')}</div></div>${panel('start-date')}${panel('end-date')}`;
}

function wireRaceMonth(document, options = {}) {
  const stats = {
    open: 0, earlyClicks: 0, drift: 0, commits: 0, dualClicks: 0, escapes: 0, huskBlocks: 0,
    huskRemainedAfterStart: false, quietAtEndClick: null, endCellClicks: 0, opensBesideHusk: 0, panels: {},
  };
  const editors = Object.fromEntries(['start-date', 'end-date'].map((id) => {
    const panel = document.getElementById(`${id}-panel`);
    // Live work add form creates each panel on open and leaves it on body.
    // The end panel is not in the document until the end editor is opened.
    panel.remove();
    return [id, {
      input: document.getElementById(id),
      panel,
      year: panel.querySelector('.el-date-picker__header-label'),
      closed: true,
      ready: false,
      committed: false,
      openedBesideHusk: false,
    }];
  }));
  stats.panels = { start: editors['start-date'].panel, end: editors['end-date'].panel };
  if (options.stickyHusk) {
    const start = editors['start-date'];
    const observer = new document.defaultView.MutationObserver(() => {
      if (!start.committed || start.panel.isConnected) return;
      document.body.appendChild(start.panel);
      start.panel.style.display = 'none';
      start.panel.style.visibility = 'hidden';
      for (const name of RACE_ANIM) start.panel.classList.remove(name);
    });
    observer.observe(document.body, { childList: true });
  }
  const hide = (editor) => {
    editor.ready = false;
    editor.panel.style.display = 'none';
    editor.panel.style.visibility = '';
    for (const name of RACE_ANIM) editor.panel.classList.remove(name);
  };
  const paint = (editor) => {
    const year = Number(editor.year.textContent.match(/\d{4}/u)[0]);
    [...editor.panel.querySelectorAll('td')].forEach((cell, index) => {
      const month = index + 1;
      cell.classList.toggle('disabled', year > 2026 || (year === 2026 && month >= 11));
      cell.classList.toggle('today', year === 2026 && month === 10);
    });
  };
  for (const editor of Object.values(editors)) paint(editor);
  const show = (id) => {
    const own = editors[id];
    const other = editors[id === 'start-date' ? 'end-date' : 'start-date'];
    const husks = [...document.querySelectorAll('.el-picker-panel')].filter((node) => node !== own.panel && node.isConnected);
    own.openedBesideHusk = husks.length > 0;
    if (own.openedBesideHusk) stats.opensBesideHusk += 1;
    if (!own.panel.isConnected) document.body.appendChild(own.panel);
    const resurrect = (id === 'end-date' && options.forceDualOnEnd)
      || (!other.closed && other.panel.style.display === 'none' && other.panel.isConnected);
    if (resurrect) {
      if (!other.panel.isConnected) document.body.appendChild(other.panel);
      other.panel.style.display = 'block';
      other.panel.style.visibility = 'visible';
      for (const name of RACE_ANIM) other.panel.classList.remove(name);
    }
    own.closed = false;
    own.ready = false;
    own.panel.style.display = 'block';
    own.panel.style.visibility = 'hidden';
    for (const name of RACE_ANIM) own.panel.classList.add(name);
    stats.open += 1;
    const view = document.defaultView;
    view.setTimeout(() => { own.panel.style.visibility = 'visible'; }, 80);
    // Live keeps el-zoom-in-top-enter-to after enter-active drops. A click in that
    // window must not count as a commit.
    view.setTimeout(() => {
      own.panel.classList.remove('el-zoom-in-top-enter', 'el-zoom-in-top-enter-active');
    }, 160);
    view.setTimeout(() => {
      own.panel.classList.remove('el-zoom-in-top-enter-to');
      own.ready = true;
    }, 280);
  };
  document.getElementById('start-date-icon').addEventListener('click', () => show('start-date'));
  document.getElementById('end-date-icon').addEventListener('click', () => show('end-date'));
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    stats.escapes += 1;
    for (const editor of Object.values(editors)) {
      editor.closed = true;
      hide(editor);
    }
  });
  for (const editor of Object.values(editors)) {
    const shift = (delta) => {
      const early = !editor.ready || RACE_ANIM.some((name) => editor.panel.classList.contains(name));
      let step = delta;
      if (early || options.decade) {
        step = delta < 0 ? -10 : 10;
        stats.drift += 1;
        if (early) stats.earlyClicks += 1;
      }
      const current = Number(editor.year.textContent.match(/\d{4}/u)[0]);
      editor.year.textContent = `${current + step} 年`;
      paint(editor);
    };
    editor.panel.querySelector('.el-icon-d-arrow-left').addEventListener('click', () => shift(-1));
    editor.panel.querySelector('.el-icon-d-arrow-right').addEventListener('click', () => shift(1));
    for (const cell of editor.panel.querySelectorAll('td')) {
      cell.querySelector('a.cell').addEventListener('click', () => {
        const early = !editor.ready || RACE_ANIM.some((name) => editor.panel.classList.contains(name));
        if (early) {
          stats.earlyClicks += 1;
          return;
        }
        if (cell.classList.contains('disabled')) return;
        // Live work add form: after start commit the panel stays on body, not pending.
        // Opening the other editor while that husk is connected poisons the panel:
        // a later a.cell does not commit even if the husk was detached after open.
        // A quiet husk still connected at the click does not commit either.
        const others = [...document.querySelectorAll('.el-picker-panel')].filter((panel) => panel !== editor.panel && panel.isConnected);
        if (editor.input.id === 'end-date') {
          stats.quietAtEndClick = others.length;
          stats.endCellClicks += 1;
        }
        if (editor.openedBesideHusk || others.length) {
          stats.huskBlocks += 1;
          return;
        }
        const open = [...document.querySelectorAll('.el-picker-panel')].filter((panel) => panel.style.display !== 'none');
        if (open.length > 1) {
          stats.dualClicks += 1;
          editors['start-date'].input.value = '1946-06';
          return;
        }
        if (options.badCommit) {
          editor.input.value = '1946-06';
          hide(editor);
          editor.committed = true;
          stats.commits += 1;
          return;
        }
        const month = MONTH_NAMES.indexOf(cell.textContent.replace(/\s+/gu, '')) + 1;
        const current = Number(editor.year.textContent.match(/\d{4}/u)[0]);
        editor.input.value = `${current}-${String(month).padStart(2, '0')}`;
        hide(editor);
        editor.closed = false;
        editor.committed = true;
        if (stats.commits === 0) {
          stats.huskRemainedAfterStart = editor.panel.isConnected
            && editor.panel.parentElement === document.body
            && editor.panel.style.display === 'none';
        }
        stats.commits += 1;
      });
    }
  }
  return stats;
}

function bootRace(options = {}) {
  const html = shell(formWrap(workFields({
    dates: raceMonthItem(), industrySingle: true, industryCounter: '(0/1)',
  })));
  const booted = boot(html);
  const doc = booted.dom.window.document;
  wireCascader(doc, 'job', { leaves: JOB_LEAVES, reveal: true });
  wireCascader(doc, 'industry', { leaves: INDUSTRY_LEAVES, reveal: true, single: true });
  return { ...booted, doc, months: wireRaceMonth(doc, options) };
}

test('任职时间 waits out enter animation and commits the end month with zero quiet husks', async () => {
  for (const [startDate, endDate] of [['2023-01', '2024-06'], ['2022-03', '2023-12']]) {
    const { doc, clicks, context, months } = bootRace();
    const result = await context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate, endDate })));
    assert.equal(result.ok, true, JSON.stringify({ startDate, endDate, reason: result.reason, step: result.selectorStep }));
    assert.equal(`${doc.getElementById('start-date').value} | ${doc.getElementById('end-date').value}`, `${startDate} | ${endDate}`);
    assert.equal(result.fields.find((field) => field.question === '任职时间').reason, 'readback_matched');
    assert.equal(result.liveSupportClaimed, false);
    assert.equal(result.coverage.find((field) => field.question === '薪资').reason, 'control_not_supported');
    assert.equal(months.earlyClicks, 0);
    assert.equal(months.drift, 0);
    assert.equal(months.dualClicks, 0);
    assert.equal(months.huskBlocks, 0);
    assert.equal(months.huskRemainedAfterStart, true);
    assert.equal(months.endCellClicks, 1);
    assert.equal(months.opensBesideHusk, 1);
    assert.equal(months.quietAtEndClick, 0);
    assert.equal(months.commits, 2);
    assert.ok(months.escapes >= 2);
    assert.equal(doc.getElementById('start-date-panel'), null);
    assert.equal(months.panels.start.isConnected, false);
    assert.equal(doc.getElementById('end-date-panel').parentElement, doc.body);
    assert.equal(months.panels.start.closest('.el-date-editor'), null);
    assert.equal(doc.getElementById('end-date-panel').closest('.el-date-editor'), null);
    assert.equal(doc.getElementById('end-date-panel').style.display, 'none');
    assert.equal(doc.getElementById('salary').value, '');
    flags(result);
    assert.equal(forbidden(clicks).length, 0);
  }
});

test('a leftover start panel or a decade year step fails closed without an empty end success', async () => {
  const dual = bootRace({ forceDualOnEnd: true });
  const dualResult = await dual.context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate: '2023-01', endDate: '2024-06' })));
  assert.equal(dualResult.ok, false);
  assert.equal(dualResult.reason, 'control_not_supported');
  assert.equal(dualResult.selectorStep, 'month_panel_structure_unknown');
  assert.equal(dualResult.fields.find((field) => field.question === '任职时间').reason, 'control_not_supported');
  assert.equal(dual.doc.getElementById('start-date').value, '2023-01');
  assert.equal(dual.doc.getElementById('end-date').value, '');
  assert.notEqual(`${dual.doc.getElementById('start-date').value} | ${dual.doc.getElementById('end-date').value}`, '2023-01 | 2024-06');
  assert.equal(dual.months.dualClicks, 0);
  assert.equal(dual.months.endCellClicks, 0);
  assert.equal(dual.doc.getElementById('salary').value, '');
  assert.equal(forbidden(dual.clicks).length, 0);

  const drift = bootRace({ decade: true });
  const driftResult = await drift.context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate: '2023-01', endDate: '2024-06' })));
  assert.equal(driftResult.ok, false);
  assert.equal(driftResult.reason, 'control_not_supported');
  assert.equal(driftResult.selectorStep, 'month_panel_structure_unknown');
  assert.equal(drift.doc.getElementById('start-date').value, '');
  assert.equal(drift.doc.getElementById('end-date').value, '');
  assert.equal(drift.months.commits, 0);
  assert.equal(drift.months.endCellClicks, 0);
  assert.equal(forbidden(drift.clicks).length, 0);

  const lied = bootRace({ badCommit: true });
  const liedResult = await lied.context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate: '2023-01', endDate: '2024-06' })));
  assert.equal(liedResult.ok, false);
  assert.equal(liedResult.reason, 'readback_mismatch');
  assert.equal(liedResult.selectorStep, 'month_option');
  assert.equal(liedResult.fields.find((field) => field.question === '任职时间').status, 'failed');
  assert.equal(liedResult.fields.find((field) => field.question === '任职时间').reason, 'readback_mismatch');
  assert.equal(lied.doc.getElementById('end-date').value, '');
  assert.equal(lied.months.endCellClicks, 0);
  assert.notEqual(lied.doc.getElementById('start-date').value, '2023-01');
  assert.equal(liedResult.fields.find((field) => field.question === '公司名称').reason, 'not_run');
  assert.equal(forbidden(lied.clicks).length, 0);

  const sticky = bootRace({ stickyHusk: true });
  const stickyResult = await sticky.context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate: '2023-01', endDate: '2024-06' })));
  assert.equal(stickyResult.ok, false);
  assert.equal(stickyResult.reason, 'control_not_supported');
  assert.equal(stickyResult.selectorStep, 'month_panel_structure_unknown');
  assert.equal(sticky.doc.getElementById('start-date').value, '2023-01');
  assert.equal(sticky.doc.getElementById('end-date').value, '');
  assert.notEqual(`${sticky.doc.getElementById('start-date').value} | ${sticky.doc.getElementById('end-date').value}`, '2023-01 | 2024-06');
  assert.equal(sticky.months.commits, 1);
  assert.equal(sticky.months.endCellClicks, 0);
  assert.equal(sticky.months.huskRemainedAfterStart, true);
  assert.equal(sticky.doc.getElementById('salary').value, '');
  assert.equal(forbidden(sticky.clicks).length, 0);
});

test('empty work extras do not change an internship source hash', async () => {
  const base = { type: 'internship', organization: '甲', position: '乙', startDate: '2020-01-02', endDate: '2020-06-01', description: '实习' };
  const left = await sourceSnapshot({ experience: [base], confirmedFields: [] }, 0);
  const right = await sourceSnapshot({ experience: [{ ...base, jobCategory: '', industry: '  ' }], confirmedFields: [] }, 0);
  assert.equal(left.hash, right.hash);
  const kept = normalizeProfile({ experience: [{ ...base, jobCategory: '金融/保险||银行' }] });
  assert.equal(kept.experience[0].jobCategory, '金融/保险||银行');
  assert.equal(Object.hasOwn(normalizeProfile({ experience: [base] }).experience[0], 'jobCategory'), false);
});
