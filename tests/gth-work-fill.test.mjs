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
import { acceptGthMonthInPage, assessGthWorkOpenFill, shippedGthWorkOpenFill } from '../src/background/gth-open-fills.mjs';
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

function runMonthAccept(doc, answer) {
  const view = doc.defaultView;
  const sandbox = {
    document: doc,
    getComputedStyle: view.getComputedStyle.bind(view),
  };
  vm.createContext(sandbox);
  const source = `(${acceptGthMonthInPage.toString()})(${JSON.stringify({ answer })})`;
  return vm.runInContext(source, sandbox);
}

function boot(html, options = {}) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, {
    url: PAGE,
    pretendToBeVisual: true,
  });
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
  const bridge = { calls: 0, answers: [], seen: [] };
  const chrome = {
    runtime: {
      id: 'synthetic-extension',
      getManifest: () => ({ background: { service_worker: 'src/background/worker.mjs' } }),
      sendMessage: async (message) => {
        if (message?.type === 'RESUME_PROFILE_BINDING_CHECK' || message?.type === 'RESUME_PAID_VERIFY') return { allowed: true };
        if (message?.type === 'GTH_MONTH_MODEL_ACCEPT') {
          bridge.calls += 1;
          bridge.answers.push(message.answer);
          const markedInput = window.document.querySelector('[data-gth-month-role="input"]');
          const markedPanel = window.document.querySelector('[data-gth-month-role="panel"]');
          bridge.seen.push({
            answer: message.answer,
            value: markedInput ? markedInput.value : '',
            panelOpen: !!markedPanel && markedPanel.style.display !== 'none' && markedPanel.style.visibility !== 'hidden',
            panelConnected: !!markedPanel?.isConnected,
          });
          if (options.monthBridge === false) return { ok: false, result: 'unavailable' };
          const forced = options.bridgeStop && options.bridgeStop[message.answer];
          if (typeof forced === 'string') return { ok: false, result: forced };
          try {
            const result = runMonthAccept(window.document, message.answer);
            const code = result?.result || 'unavailable';
            return { ok: code === 'picked' || code === 'emitted', result: code };
          } catch {
            return { ok: false, result: 'threw' };
          }
        }
        return { allowed: false };
      },
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
  return { dom, clicks, context, listeners, bridge };
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
  const show = (id) => {
    active = document.getElementById(id);
    if (!panel.isConnected) document.body.appendChild(panel);
    panel.style.display = 'block';
    stats.open += 1;
  };
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

function raceMonthItem(options = {}) {
  const anchor = (name) => options.deepCell
    ? `<div><div><a class="cell">${name}</a></div></div>`
    : `<a class="cell">${name}</a>`;
  const cells = MONTH_NAMES.map((name) => `<td><div>${anchor(name)}</div></td>`).join('');
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
    huskRemainedAfterStart: false, quietAtEndClick: null, quietAtEndOpen: [], monthPanelNodesAtEndClick: [],
    quietAfterEndShow: [], endOpenClicks: 0, endCellClicks: 0, endChangeCommits: 0, opensBesideHusk: 0, didReattachQuiet: false,
    typedChanges: 0, typedClears: 0, tableCommits: 0, anchorWalkMisses: 0, vuePicks: 0, vueEmits: 0,
    domPaints: 0, paintCloses: 0, panelRemoved: 0, emptyCloses: 0,
    pendingHuskRevealed: false, huskDismissIgnored: 0,
    panels: {},
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
      model: '',
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
    editor.generation = (editor.generation || 0) + 1;
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
    own.generation = (own.generation || 0) + 1;
    const generation = own.generation;
    const husks = [...document.querySelectorAll('.el-picker-panel')].filter((node) => node !== own.panel && node.isConnected);
    own.openedBesideHusk = husks.length > 0;
    if (own.openedBesideHusk) stats.opensBesideHusk += 1;
    if (!own.panel.isConnected) document.body.appendChild(own.panel);
    // A committed start panel stays hidden. Only an explicit dual-open shows both.
    // Real Element-UI does not paint the start panel again when the end editor opens.
    const resurrect = id === 'end-date' && options.forceDualOnEnd === true;
    if (resurrect) {
      if (!other.panel.isConnected) document.body.appendChild(other.panel);
      other.panel.style.display = 'block';
      other.panel.style.visibility = 'visible';
      for (const name of RACE_ANIM) other.panel.classList.remove(name);
    }
    // Removing the start husk, then opening end, puts that quiet sibling back.
    // Once is the live recreate. Every open is a husk that will not stay gone.
    // a.cell on an open that saw the sibling does not commit.
    if (id === 'end-date' && !options.forceDualOnEnd) {
      const startPanel = editors['start-date'].panel;
      const every = options.reattachQuietEveryEndShow === true;
      const once = options.reattachQuietOnce !== false && !stats.didReattachQuiet;
      if (!startPanel.isConnected && (every || once)) {
        document.body.appendChild(startPanel);
        startPanel.style.display = 'none';
        startPanel.style.visibility = 'hidden';
        for (const name of RACE_ANIM) startPanel.classList.remove(name);
        own.openedBesideHusk = true;
        stats.opensBesideHusk += 1;
        if (!every) stats.didReattachQuiet = true;
      }
    }
    own.closed = false;
    own.ready = false;
    own.panel.style.display = 'block';
    own.panel.style.visibility = 'hidden';
    for (const name of RACE_ANIM) own.panel.classList.add(name);
    stats.open += 1;
    if (id === 'end-date') stats.quietAfterEndShow.push(quietHuskCount());
    const view = document.defaultView;
    view.setTimeout(() => {
      if (own.generation !== generation) return;
      own.panel.style.visibility = 'visible';
    }, 80);
    // Live keeps el-zoom-in-top-enter-to after enter-active drops. A click in that
    // window must not count as a commit.
    view.setTimeout(() => {
      if (own.generation !== generation) return;
      own.panel.classList.remove('el-zoom-in-top-enter', 'el-zoom-in-top-enter-active');
    }, 160);
    view.setTimeout(() => {
      if (own.generation !== generation) return;
      own.panel.classList.remove('el-zoom-in-top-enter-to');
      own.ready = true;
    }, 280);
  };
  const quietHuskCount = () => [...document.querySelectorAll('.el-picker-panel')].filter((node) => {
    if (!node.isConnected) return false;
    if (RACE_ANIM.some((name) => node.classList.contains(name))) return false;
    return node.style.display === 'none' || node.style.visibility === 'hidden' || node.hasAttribute('hidden');
  }).length;
  document.getElementById('start-date-icon').addEventListener('click', () => show('start-date'));
  const connectedMonthPanels = () => [...document.querySelectorAll('.el-picker-panel')].filter((node) => node.isConnected);
  document.getElementById('end-date-icon').addEventListener('click', () => {
    stats.endOpenClicks += 1;
    stats.monthPanelNodesAtEndClick.push(connectedMonthPanels().length);
    stats.quietAtEndOpen.push(quietHuskCount());
    show('end-date');
  });
  const revertTyped = (editor) => {
    if (!options.closeClearsTyped || editor.input.id !== 'end-date') return;
    const model = editor.model || '';
    if (editor.input.value !== model) stats.typedClears += 1;
    editor.input.value = model;
  };
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    stats.escapes += 1;
    for (const editor of Object.values(editors)) {
      if (editor.huskSticky) {
        stats.huskDismissIgnored += 1;
        continue;
      }
      editor.closed = true;
      revertTyped(editor);
      hide(editor);
    }
  });
  if (options.closeClearsTyped) {
    editors['end-date'].input.addEventListener('blur', () => revertTyped(editors['end-date']));
  }
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
        // A quiet start husk stays on body and does not block this cell.
        const others = [...document.querySelectorAll('.el-picker-panel')].filter((panel) => panel !== editor.panel && panel.isConnected);
        if (editor.input.id === 'end-date') {
          stats.quietAtEndClick = others.length;
          stats.endCellClicks += 1;
          // Live R6: the cell click unloads the panel and leaves input.value empty.
          // The writer must still ask the page-world bridge.
          if (options.closeEmpty) {
            hide(editor);
            editor.closed = true;
            stats.emptyCloses += 1;
            if (options.removePanelOnEmpty) {
              editor.panel.remove();
              stats.panelRemoved += 1;
            }
            if (options.pendingStartHusk) {
              const start = editors['start-date'];
              start.panel.style.display = 'block';
              start.panel.style.visibility = 'visible';
              for (const name of RACE_ANIM) start.panel.classList.remove(name);
              start.huskSticky = options.stickyPendingHusk !== false;
              stats.pendingHuskRevealed = start.panel.isConnected && start.panel.style.display === 'block';
            }
            if (options.dualPendingOnEmpty) {
              const extra = document.createElement('div');
              extra.className = 'el-picker-panel el-date-picker el-popper';
              extra.id = 'dual-month-panel';
              extra.style.display = 'block';
              extra.style.visibility = 'visible';
              extra.innerHTML = '<div class="el-date-picker__header"><span class="el-date-picker__header-label">2024 年</span></div><table class="el-month-table"></table>';
              document.body.appendChild(extra);
            }
            return;
          }
          // Live R4: the cell click paints input.value and leaves the panel open.
          // The Element-UI model stays empty, so panel close restores it.
          if (options.clickPaintsDom) {
            const month = MONTH_NAMES.indexOf(cell.textContent.replace(/\s+/gu, '')) + 1;
            const current = Number(editor.year.textContent.match(/\d{4}/u)[0]);
            editor.input.value = `${current}-${String(month).padStart(2, '0')}`;
            stats.domPaints += 1;
            // Live end month: the cell paints input.value and the panel is often
            // already not pending (hidden, or removed) before the accept gate.
            if (options.closeOnPaint) {
              hide(editor);
              editor.closed = true;
              stats.paintCloses += 1;
              if (options.removePanelOnPaint) {
                editor.panel.remove();
                stats.panelRemoved += 1;
              }
            }
            return;
          }
          // Live end panel: the anchor click does not write. A TD target can.
          // input+change is not the model; close restores model and clears the rest.
          if (options.endCellNoop || (options.closeClearsTyped && !options.tablePick)) return;
        }
        if (options.tablePick) return;
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
        editor.model = `${current}-${String(month).padStart(2, '0')}`;
        editor.input.value = editor.model;
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
  const endEditor = editors['end-date'];
  endEditor.input.addEventListener('input', () => { endEditor.changeArmed = true; });
  endEditor.input.addEventListener('change', () => {
    if (!options.endCellNoop || !endEditor.changeArmed) return;
    endEditor.changeArmed = false;
    const text = endEditor.input.value;
    if (text && text === endEditor.committedValue) return;
    if (!/^(19|20)\d{2}-(0[1-9]|1[0-2])$/u.test(text)) {
      endEditor.input.value = '';
      return;
    }
    endEditor.model = text;
    endEditor.committedValue = text;
    stats.endChangeCommits += 1;
    endEditor.committed = true;
    stats.commits += 1;
    hide(endEditor);
    endEditor.closed = true;
  });
  if (options.closeClearsTyped) {
    endEditor.input.addEventListener('input', () => { endEditor.typedArmed = true; });
    endEditor.input.addEventListener('change', () => {
      if (!endEditor.typedArmed) return;
      endEditor.typedArmed = false;
      if ((endEditor.model || '') === endEditor.input.value) return;
      stats.typedChanges += 1;
    });
  }
  if (options.tablePick) {
    for (const editor of Object.values(editors)) {
      editor.panel.querySelector('.el-month-table').addEventListener('click', (event) => {
        let target = event.target;
        if (target.tagName === 'A') target = target.parentNode?.parentNode;
        if (target?.tagName === 'DIV') target = target.parentNode;
        if (!target || target.tagName !== 'TD' || !editor.panel.contains(target)) {
          stats.anchorWalkMisses += 1;
          return;
        }
        if (target.classList.contains('disabled')) return;
        const month = MONTH_NAMES.indexOf(target.textContent.replace(/\s+/gu, '')) + 1;
        if (month < 1) return;
        const current = Number(editor.year.textContent.match(/\d{4}/u)[0]);
        editor.model = `${current}-${String(month).padStart(2, '0')}`;
        editor.input.value = editor.model;
        stats.tableCommits += 1;
        hide(editor);
        editor.committed = true;
        stats.commits += 1;
      });
    }
  }
  if (options.acceptVue) {
    endEditor.panel.__vue__ = {
      selectionMode: 'month',
      get year() { return Number(endEditor.year.textContent.match(/\d{4}/u)[0]); },
      get date() { return new Date(this.year, 0, 1); },
      handleMonthPick(monthIndex) {
        const value = `${this.year}-${String(monthIndex + 1).padStart(2, '0')}`;
        endEditor.model = value;
        endEditor.input.value = value;
        stats.vuePicks += 1;
        hide(endEditor);
        endEditor.committed = true;
        stats.commits += 1;
      },
      $children: [],
    };
  }
  if (options.acceptEditorPick) {
    const picker = {
      selectionMode: 'month',
      get year() { return Number(endEditor.year.textContent.match(/\d{4}/u)[0]); },
      get date() { return new Date(this.year, 0, 1); },
      handleMonthPick(monthIndex) {
        const value = `${this.year}-${String(monthIndex + 1).padStart(2, '0')}`;
        endEditor.model = value;
        endEditor.input.value = value;
        stats.vuePicks += 1;
        hide(endEditor);
        endEditor.committed = true;
        stats.commits += 1;
      },
      $children: [],
    };
    endEditor.input.closest('.el-date-editor').__vue__ = { picker, $children: [] };
  }
  if (options.acceptEmit) {
    endEditor.input.closest('.el-date-editor').__vue__ = {
      userInput: null,
      parseString(text) {
        const match = /^(\d{4})-(\d{2})$/u.exec(String(text || ''));
        if (!match) return null;
        return new Date(Number(match[1]), Number(match[2]) - 1, 1);
      },
      emitInput(date) {
        const time = date && typeof date.getTime === 'function' ? date.getTime() : NaN;
        if (typeof time !== 'number' || Number.isNaN(time)) return;
        const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        endEditor.model = value;
        endEditor.input.value = value;
        stats.vueEmits += 1;
        hide(endEditor);
        endEditor.committed = true;
        stats.commits += 1;
      },
    };
  }
  return stats;
}

function bootRace(options = {}) {
  const html = shell(formWrap(workFields({
    dates: raceMonthItem(options), industrySingle: true, industryCounter: '(0/1)',
  })));
  const booted = boot(html, { monthBridge: options.monthBridge !== false, bridgeStop: options.bridgeStop });
  const doc = booted.dom.window.document;
  wireCascader(doc, 'job', { leaves: JOB_LEAVES, reveal: true });
  wireCascader(doc, 'industry', { leaves: INDUSTRY_LEAVES, reveal: true, single: true });
  return { ...booted, doc, months: wireRaceMonth(doc, options) };
}

test('任职时间 commits the end month while the start panel husk stays connected', async () => {
  for (const [startDate, endDate] of [['2023-01', '2024-06'], ['2022-03', '2023-12']]) {
    const { doc, clicks, context, months } = bootRace();
    const result = await context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate, endDate })));
    assert.equal(result.ok, true, JSON.stringify({ startDate, endDate, reason: result.reason, step: result.selectorStep, opens: months.endOpenClicks, quietAfter: months.quietAfterEndShow, panels: months.monthPanelNodesAtEndClick }));
    assert.equal(`${doc.getElementById('start-date').value} | ${doc.getElementById('end-date').value}`, `${startDate} | ${endDate}`);
    assert.equal(result.fields.find((field) => field.question === '任职时间').reason, 'readback_matched');
    assert.equal(result.liveSupportClaimed, false);
    assert.equal(result.coverage.find((field) => field.question === '薪资').reason, 'control_not_supported');
    assert.equal(months.earlyClicks, 0);
    assert.equal(months.drift, 0);
    assert.equal(months.dualClicks, 0);
    assert.equal(months.huskBlocks, 0);
    assert.equal(months.huskRemainedAfterStart, true);
    assert.equal(months.endOpenClicks, 1);
    assert.deepEqual(months.monthPanelNodesAtEndClick, [1]);
    assert.deepEqual(months.quietAtEndOpen, [1]);
    assert.deepEqual(months.quietAfterEndShow, [1]);
    assert.equal(months.endCellClicks, 1);
    assert.equal(months.endChangeCommits, 0);
    assert.equal(months.opensBesideHusk, 1);
    assert.equal(months.quietAtEndClick, 1);
    assert.equal(months.commits, 2);
    assert.ok(months.escapes >= 2);
    assert.equal(months.panels.start.isConnected, true);
    assert.equal(months.panels.start.parentElement, doc.body);
    assert.equal(months.panels.start.style.display, 'none');
    assert.equal(doc.getElementById('end-date-panel').parentElement, doc.body);
    assert.equal(months.panels.start.closest('.el-date-editor'), null);
    assert.equal(doc.getElementById('end-date-panel').closest('.el-date-editor'), null);
    assert.equal(doc.getElementById('end-date-panel').style.display, 'none');
    assert.equal(doc.getElementById('salary').value, '');
    flags(result);
    assert.equal(forbidden(clicks).length, 0);
  }
});

test('任职时间 writes the end month through input change when the cell click does not', async () => {
  for (const [startDate, endDate] of [['2023-01', '2024-06'], ['2022-03', '2023-12']]) {
    const { doc, clicks, context, months } = bootRace({ endCellNoop: true });
    const result = await context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate, endDate })));
    assert.equal(result.ok, true, JSON.stringify({ startDate, endDate, reason: result.reason, step: result.selectorStep, commits: months.endChangeCommits, cells: months.endCellClicks }));
    assert.equal(`${doc.getElementById('start-date').value} | ${doc.getElementById('end-date').value}`, `${startDate} | ${endDate}`);
    assert.equal(doc.getElementById('start-date').value, startDate);
    assert.equal(result.fields.find((field) => field.question === '任职时间').reason, 'readback_matched');
    assert.equal(result.liveSupportClaimed, false);
    assert.equal(months.endCellClicks, 1);
    assert.equal(months.endChangeCommits, 1);
    assert.equal(months.endOpenClicks, 1);
    assert.equal(months.quietAtEndClick, 1);
    assert.equal(months.commits, 2);
    assert.equal(months.dualClicks, 0);
    assert.equal(months.panels.start.isConnected, true);
    assert.equal(months.panels.start.style.display, 'none');
    assert.equal(doc.getElementById('salary').value, '');
    flags(result);
    assert.equal(forbidden(clicks).length, 0);
  }
});

test('任职时间 keeps the end month when only a TD target commits and close clears typed text', async () => {
  for (const [startDate, endDate] of [['2023-01', '2024-06'], ['2022-03', '2023-12']]) {
    const { doc, clicks, context, months } = bootRace({ deepCell: true, tablePick: true, closeClearsTyped: true });
    const result = await context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate, endDate })));
    assert.equal(result.ok, true, JSON.stringify({ startDate, endDate, reason: result.reason, step: result.selectorStep, tables: months.tableCommits, clears: months.typedClears }));
    assert.equal(`${doc.getElementById('start-date').value} | ${doc.getElementById('end-date').value}`, `${startDate} | ${endDate}`);
    assert.equal(result.fields.find((field) => field.question === '任职时间').reason, 'readback_matched');
    assert.equal(result.liveSupportClaimed, false);
    assert.equal(months.tableCommits, 2);
    assert.equal(months.anchorWalkMisses, 2);
    assert.equal(months.endCellClicks, 1);
    assert.equal(months.endChangeCommits, 0);
    assert.equal(months.typedChanges, 0);
    assert.equal(months.typedClears, 0);
    assert.equal(months.vuePicks, 0);
    assert.equal(months.panels.start.isConnected, true);
    assert.equal(months.panels.start.style.display, 'none');
    assert.equal(doc.getElementById('salary').value, '');
    flags(result);
    assert.equal(forbidden(clicks).length, 0);
  }
});

test('任职时间 keeps the end month after panel close when the mounted picker accepts it', async () => {
  for (const [startDate, endDate] of [['2023-01', '2024-06'], ['2022-03', '2023-12']]) {
    const { doc, clicks, context, months } = bootRace({ closeClearsTyped: true, acceptVue: true });
    const result = await context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate, endDate })));
    assert.equal(result.ok, true, JSON.stringify({ startDate, endDate, reason: result.reason, step: result.selectorStep, picks: months.vuePicks, clears: months.typedClears, typed: months.typedChanges }));
    assert.equal(`${doc.getElementById('start-date').value} | ${doc.getElementById('end-date').value}`, `${startDate} | ${endDate}`);
    assert.equal(result.fields.find((field) => field.question === '任职时间').reason, 'readback_matched');
    assert.equal(result.liveSupportClaimed, false);
    assert.equal(months.vuePicks, 1);
    assert.equal(months.vueEmits, 0);
    assert.equal(months.endChangeCommits, 0);
    assert.equal(months.typedChanges, 0);
    assert.equal(months.typedClears, 0);
    assert.equal(months.tableCommits, 0);
    assert.equal(months.quietAtEndClick, 1);
    assert.equal(months.panels.start.isConnected, true);
    assert.equal(doc.getElementById('salary').value, '');
    flags(result);
    assert.equal(forbidden(clicks).length, 0);
  }
  const emitted = bootRace({ closeClearsTyped: true, acceptEmit: true });
  const emittedResult = await emitted.context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate: '2022-03', endDate: '2023-12' })));
  assert.equal(emittedResult.ok, true, JSON.stringify({ reason: emittedResult.reason, step: emittedResult.selectorStep, emits: emitted.months.vueEmits }));
  assert.equal(`${emitted.doc.getElementById('start-date').value} | ${emitted.doc.getElementById('end-date').value}`, '2022-03 | 2023-12');
  assert.equal(emitted.months.vueEmits, 1);
  assert.equal(emitted.months.vuePicks, 0);
  assert.equal(emitted.months.typedClears, 0);
  assert.equal(emittedResult.liveSupportClaimed, false);
  assert.equal(forbidden(emitted.clicks).length, 0);
});

test('任职时间 fails closed when the page-world bridge is down even if the picker is mounted', async () => {
  const { doc, clicks, context, months } = bootRace({ closeClearsTyped: true, acceptVue: true, monthBridge: false });
  const result = await context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate: '2023-01', endDate: '2024-06' })));
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'readback_mismatch');
  assert.equal(result.selectorStep, 'month_option');
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(`${doc.getElementById('start-date').value} | ${doc.getElementById('end-date').value}`, '2023-01 | ');
  assert.equal(months.vuePicks, 0);
  assert.equal(months.vueEmits, 0);
  assert.ok(months.typedChanges >= 1);
  assert.ok(months.typedClears >= 1);
  assert.equal(months.panels.start.isConnected, true);
  assert.equal(doc.getElementById('salary').value, '');
  flags(result);
  assert.equal(forbidden(clicks).length, 0);
});

test('month accept runs in the page world without an inserted script', () => {
  assert.equal(core.includes("createElement('script')"), false);
  assert.equal(core.includes('__vue__'), false);
  assert.match(core, /GTH_MONTH_MODEL_ACCEPT/);
  assert.match(workSource, /no inserted script/);
  const worker = readFileSync(new URL('../src/background/worker.mjs', import.meta.url), 'utf8');
  const guard = readFileSync(new URL('../src/license/guard-worker.mjs', import.meta.url), 'utf8');
  assert.match(worker, /registerGthMonthModelBridge/);
  assert.match(guard, /registerGthMonthModelBridge/);
  const dom = new JSDOM('<!DOCTYPE html><body><input id="end" data-gth-month-role="input" data-gth-month-answer="2024-06"><div class="el-picker-panel" id="panel" data-gth-month-role="panel"><span class="el-date-picker__header-label">2026 年</span></div></body>');
  const doc = dom.window.document;
  const input = doc.getElementById('end');
  const panel = doc.getElementById('panel');
  let picks = 0;
  panel.__vue__ = {
    selectionMode: 'month',
    year: 2026,
    handleMonthPick() { picks += 1; },
    $children: [],
  };
  const mismatch = runMonthAccept(doc, '2024-06');
  assert.equal(mismatch.result, 'bad-year');
  assert.equal(picks, 0);
  panel.querySelector('.el-date-picker__header-label').textContent = '2024 年';
  panel.__vue__.year = 2024;
  panel.__vue__.handleMonthPick = function handleMonthPick() {
    picks += 1;
    input.value = '2024-06';
  };
  const picked = runMonthAccept(doc, '2024-06');
  assert.equal(picked.result, 'picked');
  assert.equal(picked.ok, true);
  assert.equal(picks, 1);
  const second = doc.createElement('div');
  second.className = 'el-picker-panel';
  second.style.display = 'block';
  doc.body.appendChild(second);
  const dual = runMonthAccept(doc, '2024-06');
  assert.equal(dual.result, 'dual');
  assert.equal(picks, 1);

  const gone = new JSDOM('<!DOCTYPE html><body><div class="el-date-editor" id="editor"><input id="end" data-gth-month-role="input" data-gth-month-answer="2024-06" value="2024-06"></div></body>');
  const goneDoc = gone.window.document;
  const goneInput = goneDoc.getElementById('end');
  const missing = runMonthAccept(goneDoc, '2024-06');
  assert.equal(missing.result, 'no-vue');
  const shownOther = goneDoc.createElement('div');
  shownOther.className = 'el-picker-panel';
  shownOther.style.display = 'block';
  goneDoc.body.appendChild(shownOther);
  const huskShell = runMonthAccept(goneDoc, '2024-06');
  assert.equal(huskShell.result, 'no-vue');
  const monthHusk = goneDoc.createElement('div');
  monthHusk.className = 'el-picker-panel el-date-picker';
  monthHusk.style.display = 'block';
  monthHusk.innerHTML = '<span class="el-date-picker__header-label">2023 年</span><table class="el-month-table"></table>';
  goneDoc.body.appendChild(monthHusk);
  const oneHusk = runMonthAccept(goneDoc, '2024-06');
  assert.equal(oneHusk.result, 'no-vue');
  let editorPicks = 0;
  goneDoc.getElementById('editor').__vue__ = {
    picker: {
      selectionMode: 'month',
      year: 2024,
      handleMonthPick() {
        editorPicks += 1;
        goneInput.value = '2024-06';
      },
      $children: [],
    },
  };
  const editorPicked = runMonthAccept(goneDoc, '2024-06');
  assert.equal(editorPicked.result, 'picked');
  assert.equal(editorPicked.ok, true);
  assert.equal(editorPicks, 1);
  const secondActive = goneDoc.createElement('div');
  secondActive.className = 'el-picker-panel el-date-picker';
  secondActive.style.display = 'block';
  secondActive.innerHTML = '<span class="el-date-picker__header-label">2022 年</span><table class="el-month-table"></table>';
  goneDoc.body.appendChild(secondActive);
  const realDual = runMonthAccept(goneDoc, '2024-06');
  assert.equal(realDual.result, 'dual');
  assert.equal(editorPicks, 1);
  secondActive.style.display = 'none';
  goneDoc.getElementById('editor').__vue__ = {
    userInput: 'stale',
    parseString(text) {
      const match = /^(\d{4})-(\d{2})$/u.exec(String(text || ''));
      if (!match) return null;
      return new Date(Number(match[1]), Number(match[2]) - 1, 1);
    },
    emitInput(date) {
      goneInput.value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      this.userInput = null;
    },
  };
  const editorEmitted = runMonthAccept(goneDoc, '2024-06');
  assert.equal(editorEmitted.result, 'emitted');
  assert.equal(editorEmitted.ok, true);
  assert.equal(goneDoc.getElementById('editor').__vue__.userInput, null);
  assert.equal(goneInput.value, '2024-06');
  secondActive.style.display = 'block';
  goneDoc.getElementById('editor').__vue__.userInput = 'stale';
  const emitBlocked = runMonthAccept(goneDoc, '2024-06');
  assert.equal(emitBlocked.result, 'dual');
  assert.equal(goneDoc.getElementById('editor').__vue__.userInput, 'stale');
  assert.equal(goneInput.value, '2024-06');
});

test('任职时间 fails closed when panel close clears a typed end month', async () => {
  const { doc, clicks, context, months } = bootRace({ closeClearsTyped: true });
  const result = await context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate: '2023-01', endDate: '2024-06' })));
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'readback_mismatch');
  assert.equal(result.selectorStep, 'month_option');
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.fields.find((field) => field.question === '任职时间').reason, 'readback_mismatch');
  assert.equal(doc.getElementById('start-date').value, '2023-01');
  assert.equal(doc.getElementById('end-date').value, '');
  assert.notEqual(`${doc.getElementById('start-date').value} | ${doc.getElementById('end-date').value}`, '2023-01 | 2024-06');
  assert.ok(months.typedChanges >= 1);
  assert.ok(months.typedClears >= 1);
  assert.equal(months.vuePicks, 0);
  assert.equal(months.vueEmits, 0);
  assert.equal(months.tableCommits, 0);
  assert.equal(months.endChangeCommits, 0);
  assert.equal(result.fields.find((field) => field.question === '公司名称').reason, 'not_run');
  assert.equal(doc.getElementById('salary').value, '');
  assert.equal(months.panels.start.isConnected, true);
  flags(result);
  assert.equal(forbidden(clicks).length, 0);
});

test('任职时间 keeps a painted end month only when the open panel bridge accepts the model', async () => {
  const endSeen = (bridge, endDate) => bridge.seen.filter((row) => row.answer === endDate);
  for (const [startDate, endDate] of [['2023-01', '2024-06'], ['2022-03', '2023-12']]) {
    const { doc, clicks, context, months, bridge } = bootRace({
      clickPaintsDom: true, closeClearsTyped: true, acceptVue: true,
    });
    const result = await context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate, endDate })));
    const seen = endSeen(bridge, endDate);
    assert.equal(result.ok, true, JSON.stringify({
      startDate, endDate, reason: result.reason, step: result.selectorStep,
      picks: months.vuePicks, paints: months.domPaints, clears: months.typedClears, seen,
    }));
    assert.equal(`${doc.getElementById('start-date').value} | ${doc.getElementById('end-date').value}`, `${startDate} | ${endDate}`);
    assert.equal(result.fields.find((field) => field.question === '任职时间').reason, 'readback_matched');
    assert.equal(result.liveSupportClaimed, false);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].value, endDate);
    assert.equal(seen[0].panelOpen, true);
    assert.equal(months.domPaints, 1);
    assert.equal(months.vuePicks, 1);
    assert.equal(months.vueEmits, 0);
    assert.equal(months.endChangeCommits, 0);
    assert.equal(months.typedChanges, 0);
    assert.equal(months.typedClears, 0);
    assert.equal(months.tableCommits, 0);
    assert.equal(months.endCellClicks, 1);
    assert.equal(doc.getElementById('salary').value, '');
    flags(result);
    assert.equal(forbidden(clicks).length, 0);
  }

  const emitted = bootRace({ clickPaintsDom: true, closeClearsTyped: true, acceptEmit: true });
  const emittedResult = await emitted.context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate: '2022-03', endDate: '2023-12' })));
  const emittedSeen = endSeen(emitted.bridge, '2023-12');
  assert.equal(emittedResult.ok, true, JSON.stringify({ reason: emittedResult.reason, step: emittedResult.selectorStep, emits: emitted.months.vueEmits }));
  assert.equal(`${emitted.doc.getElementById('start-date').value} | ${emitted.doc.getElementById('end-date').value}`, '2022-03 | 2023-12');
  assert.equal(emittedSeen.length, 1);
  assert.equal(emittedSeen[0].panelOpen, true);
  assert.equal(emittedSeen[0].value, '2023-12');
  assert.equal(emitted.months.vueEmits, 1);
  assert.equal(emitted.months.vuePicks, 0);
  assert.equal(emitted.months.domPaints, 1);
  assert.equal(emitted.months.typedClears, 0);
  assert.equal(emittedResult.liveSupportClaimed, false);
  assert.equal(forbidden(emitted.clicks).length, 0);

  const bare = bootRace({ clickPaintsDom: true, closeClearsTyped: true });
  const bareResult = await bare.context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate: '2023-01', endDate: '2024-06' })));
  const bareSeen = endSeen(bare.bridge, '2024-06');
  assert.equal(bareResult.ok, false);
  assert.equal(bareResult.reason, 'readback_mismatch');
  assert.equal(bareResult.selectorStep, 'month_option');
  assert.equal(bareResult.fields.find((field) => field.question === '任职时间').reason, 'readback_mismatch');
  assert.equal(bare.doc.getElementById('start-date').value, '2023-01');
  assert.equal(bare.doc.getElementById('end-date').value, '');
  assert.equal(bareSeen.length, 1);
  assert.equal(bareSeen[0].value, '2024-06');
  assert.equal(bareSeen[0].panelOpen, true);
  assert.equal(bare.months.domPaints, 1);
  assert.equal(bare.months.vuePicks, 0);
  assert.equal(bare.months.vueEmits, 0);
  assert.equal(bare.months.typedChanges, 0);
  assert.equal(bare.months.endChangeCommits, 0);
  assert.ok(bare.months.typedClears >= 1);
  assert.equal(bareResult.fields.find((field) => field.question === '公司名称').reason, 'not_run');
  assert.equal(bare.doc.getElementById('salary').value, '');
  flags(bareResult);
  assert.equal(forbidden(bare.clicks).length, 0);

  const down = bootRace({ clickPaintsDom: true, closeClearsTyped: true, acceptVue: true, monthBridge: false });
  const downResult = await down.context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate: '2023-01', endDate: '2024-06' })));
  const downSeen = endSeen(down.bridge, '2024-06');
  assert.equal(downResult.ok, false);
  assert.equal(downResult.reason, 'readback_mismatch');
  assert.equal(downResult.selectorStep, 'month_option');
  assert.equal(down.doc.getElementById('start-date').value, '2023-01');
  assert.equal(down.doc.getElementById('end-date').value, '');
  assert.equal(downSeen.length, 1);
  assert.equal(downSeen[0].panelOpen, true);
  assert.equal(downSeen[0].value, '2024-06');
  assert.equal(down.months.vuePicks, 0);
  assert.equal(down.months.domPaints, 1);
  assert.equal(down.months.typedChanges, 0);
  assert.ok(down.months.typedClears >= 1);
  assert.equal(downResult.liveSupportClaimed, false);
  assert.equal(down.doc.getElementById('salary').value, '');
  flags(downResult);
  assert.equal(forbidden(down.clicks).length, 0);

  for (const code of ['dual', 'bad-year', 'mismatch']) {
    const stopped = bootRace({ clickPaintsDom: true, bridgeStop: { '2024-06': code } });
    const stoppedResult = await stopped.context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate: '2023-01', endDate: '2024-06' })));
    const stoppedSeen = endSeen(stopped.bridge, '2024-06');
    assert.equal(stoppedResult.ok, false, code);
    assert.equal(stoppedResult.reason, 'readback_mismatch', code);
    assert.equal(stoppedResult.selectorStep, 'month_option', code);
    assert.equal(stoppedResult.fields.find((field) => field.question === '任职时间').reason, 'readback_mismatch', code);
    assert.equal(stopped.doc.getElementById('start-date').value, '2023-01', code);
    assert.equal(stopped.doc.getElementById('end-date').value, '2024-06', code);
    assert.equal(stoppedSeen.length, 1, code);
    assert.equal(stoppedSeen[0].panelOpen, true, code);
    assert.equal(stoppedSeen[0].value, '2024-06', code);
    assert.equal(stopped.months.vuePicks, 0, code);
    assert.equal(stopped.months.domPaints, 1, code);
    assert.equal(stoppedResult.fields.find((field) => field.question === '公司名称').reason, 'not_run', code);
    assert.equal(stopped.doc.getElementById('salary').value, '', code);
    flags(stoppedResult);
    assert.equal(forbidden(stopped.clicks).length, 0, code);
  }
});

test('任职时间 accepts a painted end month after the cell click closes the panel', async () => {
  const endSeen = (bridge, endDate) => bridge.seen.filter((row) => row.answer === endDate);
  for (const [startDate, endDate] of [['2023-01', '2024-06'], ['2022-03', '2023-12']]) {
    const { doc, clicks, context, months, bridge } = bootRace({
      clickPaintsDom: true, closeOnPaint: true, closeClearsTyped: true, acceptVue: true,
    });
    const result = await context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate, endDate })));
    const seen = endSeen(bridge, endDate);
    assert.equal(result.ok, true, JSON.stringify({
      startDate, endDate, reason: result.reason, step: result.selectorStep,
      picks: months.vuePicks, paints: months.domPaints, closes: months.paintCloses, seen,
    }));
    assert.equal(`${doc.getElementById('start-date').value} | ${doc.getElementById('end-date').value}`, `${startDate} | ${endDate}`);
    assert.equal(result.fields.find((field) => field.question === '任职时间').reason, 'readback_matched');
    assert.equal(result.liveSupportClaimed, false);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].value, endDate);
    assert.equal(seen[0].panelOpen, false);
    assert.equal(seen[0].panelConnected, true);
    assert.equal(months.domPaints, 1);
    assert.equal(months.paintCloses, 1);
    assert.equal(months.panelRemoved, 0);
    assert.equal(months.vuePicks, 1);
    assert.equal(months.vueEmits, 0);
    assert.equal(months.endChangeCommits, 0);
    assert.equal(months.typedChanges, 0);
    assert.equal(months.typedClears, 0);
    assert.equal(months.tableCommits, 0);
    assert.equal(months.endCellClicks, 1);
    assert.equal(doc.getElementById('salary').value, '');
    flags(result);
    assert.equal(forbidden(clicks).length, 0);
  }

  const emitted = bootRace({
    clickPaintsDom: true, closeOnPaint: true, closeClearsTyped: true, acceptEmit: true,
  });
  const emittedResult = await emitted.context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate: '2022-03', endDate: '2023-12' })));
  const emittedSeen = endSeen(emitted.bridge, '2023-12');
  assert.equal(emittedResult.ok, true, JSON.stringify({ reason: emittedResult.reason, step: emittedResult.selectorStep, emits: emitted.months.vueEmits }));
  assert.equal(`${emitted.doc.getElementById('start-date').value} | ${emitted.doc.getElementById('end-date').value}`, '2022-03 | 2023-12');
  assert.equal(emittedSeen.length, 1);
  assert.equal(emittedSeen[0].panelOpen, false);
  assert.equal(emittedSeen[0].panelConnected, true);
  assert.equal(emittedSeen[0].value, '2023-12');
  assert.equal(emitted.months.vueEmits, 1);
  assert.equal(emitted.months.vuePicks, 0);
  assert.equal(emitted.months.paintCloses, 1);
  assert.equal(emitted.months.typedClears, 0);
  assert.equal(emittedResult.liveSupportClaimed, false);
  assert.equal(forbidden(emitted.clicks).length, 0);

  const removed = bootRace({
    clickPaintsDom: true, closeOnPaint: true, removePanelOnPaint: true, closeClearsTyped: true, acceptEditorPick: true,
  });
  const removedResult = await removed.context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate: '2023-01', endDate: '2024-06' })));
  const removedSeen = endSeen(removed.bridge, '2024-06');
  assert.equal(removedResult.ok, true, JSON.stringify({ reason: removedResult.reason, step: removedResult.selectorStep, picks: removed.months.vuePicks, seen: removedSeen }));
  assert.equal(`${removed.doc.getElementById('start-date').value} | ${removed.doc.getElementById('end-date').value}`, '2023-01 | 2024-06');
  assert.equal(removedSeen.length, 1);
  assert.equal(removedSeen[0].panelConnected, false);
  assert.equal(removedSeen[0].panelOpen, false);
  assert.equal(removedSeen[0].value, '2024-06');
  assert.equal(removed.months.vuePicks, 1);
  assert.equal(removed.months.panelRemoved, 1);
  assert.equal(removed.months.typedClears, 0);
  assert.equal(removedResult.liveSupportClaimed, false);
  assert.equal(forbidden(removed.clicks).length, 0);

  const removedEmit = bootRace({
    clickPaintsDom: true, closeOnPaint: true, removePanelOnPaint: true, closeClearsTyped: true, acceptEmit: true,
  });
  const removedEmitResult = await removedEmit.context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate: '2022-03', endDate: '2023-12' })));
  const removedEmitSeen = endSeen(removedEmit.bridge, '2023-12');
  assert.equal(removedEmitResult.ok, true, JSON.stringify({ reason: removedEmitResult.reason, step: removedEmitResult.selectorStep, emits: removedEmit.months.vueEmits }));
  assert.equal(`${removedEmit.doc.getElementById('start-date').value} | ${removedEmit.doc.getElementById('end-date').value}`, '2022-03 | 2023-12');
  assert.equal(removedEmitSeen.length, 1);
  assert.equal(removedEmitSeen[0].panelConnected, false);
  assert.equal(removedEmit.months.vueEmits, 1);
  assert.equal(removedEmit.months.vuePicks, 0);
  assert.equal(removedEmit.months.panelRemoved, 1);
  assert.equal(removedEmitResult.liveSupportClaimed, false);

  const bare = bootRace({ clickPaintsDom: true, closeOnPaint: true, closeClearsTyped: true });
  const bareResult = await bare.context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate: '2023-01', endDate: '2024-06' })));
  const bareSeen = endSeen(bare.bridge, '2024-06');
  assert.equal(bareResult.ok, false);
  assert.equal(bareResult.reason, 'readback_mismatch');
  assert.equal(bareResult.selectorStep, 'month_option');
  assert.equal(bareResult.fields.find((field) => field.question === '任职时间').reason, 'readback_mismatch');
  assert.equal(bare.doc.getElementById('start-date').value, '2023-01');
  assert.equal(bare.doc.getElementById('end-date').value, '');
  assert.equal(bareSeen.length, 1);
  assert.equal(bareSeen[0].value, '2024-06');
  assert.equal(bareSeen[0].panelOpen, false);
  assert.equal(bareSeen[0].panelConnected, true);
  assert.equal(bare.months.domPaints, 1);
  assert.equal(bare.months.paintCloses, 1);
  assert.equal(bare.months.vuePicks, 0);
  assert.equal(bare.months.vueEmits, 0);
  assert.equal(bare.months.typedChanges, 0);
  assert.equal(bare.months.endChangeCommits, 0);
  assert.ok(bare.months.typedClears >= 1);
  assert.equal(bareResult.fields.find((field) => field.question === '公司名称').reason, 'not_run');
  assert.equal(bare.doc.getElementById('salary').value, '');
  flags(bareResult);
  assert.equal(forbidden(bare.clicks).length, 0);

  const goneBare = bootRace({
    clickPaintsDom: true, closeOnPaint: true, removePanelOnPaint: true, closeClearsTyped: true,
  });
  const goneBareResult = await goneBare.context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate: '2023-01', endDate: '2024-06' })));
  const goneBareSeen = endSeen(goneBare.bridge, '2024-06');
  assert.equal(goneBareResult.ok, false);
  assert.equal(goneBareResult.reason, 'readback_mismatch');
  assert.equal(goneBareResult.selectorStep, 'month_option');
  assert.equal(goneBare.doc.getElementById('start-date').value, '2023-01');
  assert.equal(goneBare.doc.getElementById('end-date').value, '');
  assert.equal(goneBareSeen.length, 1);
  assert.equal(goneBareSeen[0].panelConnected, false);
  assert.equal(goneBareSeen[0].value, '2024-06');
  assert.equal(goneBare.months.vuePicks, 0);
  assert.equal(goneBare.months.vueEmits, 0);
  assert.equal(goneBare.months.panelRemoved, 1);
  assert.ok(goneBare.months.typedClears >= 1);
  assert.equal(goneBareResult.liveSupportClaimed, false);
  assert.equal(goneBare.doc.getElementById('salary').value, '');
  flags(goneBareResult);
  assert.equal(forbidden(goneBare.clicks).length, 0);

  const down = bootRace({
    clickPaintsDom: true, closeOnPaint: true, closeClearsTyped: true, acceptVue: true, monthBridge: false,
  });
  const downResult = await down.context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate: '2023-01', endDate: '2024-06' })));
  const downSeen = endSeen(down.bridge, '2024-06');
  assert.equal(downResult.ok, false);
  assert.equal(downResult.reason, 'readback_mismatch');
  assert.equal(downResult.selectorStep, 'month_option');
  assert.equal(down.doc.getElementById('start-date').value, '2023-01');
  assert.equal(down.doc.getElementById('end-date').value, '');
  assert.equal(downSeen.length, 1);
  assert.equal(downSeen[0].panelOpen, false);
  assert.equal(downSeen[0].panelConnected, true);
  assert.equal(downSeen[0].value, '2024-06');
  assert.equal(down.months.vuePicks, 0);
  assert.equal(down.months.domPaints, 1);
  assert.equal(down.months.paintCloses, 1);
  assert.equal(down.months.typedChanges, 0);
  assert.ok(down.months.typedClears >= 1);
  assert.equal(downResult.liveSupportClaimed, false);
  assert.equal(down.doc.getElementById('salary').value, '');
  flags(downResult);
  assert.equal(forbidden(down.clicks).length, 0);

  for (const code of ['dual', 'bad-year', 'mismatch']) {
    const stopped = bootRace({
      clickPaintsDom: true, closeOnPaint: true, closeClearsTyped: true, bridgeStop: { '2024-06': code },
    });
    const stoppedResult = await stopped.context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate: '2023-01', endDate: '2024-06' })));
    const stoppedSeen = endSeen(stopped.bridge, '2024-06');
    assert.equal(stoppedResult.ok, false, code);
    assert.equal(stoppedResult.reason, 'readback_mismatch', code);
    assert.equal(stoppedResult.selectorStep, 'month_option', code);
    assert.equal(stoppedResult.fields.find((field) => field.question === '任职时间').reason, 'readback_mismatch', code);
    assert.equal(stopped.doc.getElementById('start-date').value, '2023-01', code);
    assert.equal(stopped.doc.getElementById('end-date').value, '', code);
    assert.equal(stoppedSeen.length, 1, code);
    assert.equal(stoppedSeen[0].panelOpen, false, code);
    assert.equal(stoppedSeen[0].panelConnected, true, code);
    assert.equal(stoppedSeen[0].value, '2024-06', code);
    assert.equal(stopped.months.vuePicks, 0, code);
    assert.equal(stopped.months.domPaints, 1, code);
    assert.equal(stopped.months.paintCloses, 1, code);
    assert.ok(stopped.months.typedClears >= 1, code);
    assert.equal(stoppedResult.fields.find((field) => field.question === '公司名称').reason, 'not_run', code);
    assert.equal(stopped.doc.getElementById('salary').value, '', code);
    assert.equal(stoppedResult.liveSupportClaimed, false, code);
    flags(stoppedResult);
    assert.equal(forbidden(stopped.clicks).length, 0, code);
  }
});

test('任职时间 calls the month bridge when the cell click removes the panel and the input stays empty', async () => {
  const endSeen = (bridge, endDate) => bridge.seen.filter((row) => row.answer === endDate);
  for (const [startDate, endDate, mode] of [['2023-01', '2024-06', 'pick'], ['2022-03', '2023-12', 'emit']]) {
    const { doc, clicks, context, months, bridge } = bootRace({
      closeEmpty: true, removePanelOnEmpty: true, closeClearsTyped: true,
      acceptEditorPick: mode === 'pick', acceptEmit: mode === 'emit',
    });
    const result = await context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate, endDate })));
    const seen = endSeen(bridge, endDate);
    assert.equal(result.ok, true, JSON.stringify({
      startDate, endDate, mode, reason: result.reason, step: result.selectorStep,
      picks: months.vuePicks, emits: months.vueEmits, seen,
    }));
    assert.equal(`${doc.getElementById('start-date').value} | ${doc.getElementById('end-date').value}`, `${startDate} | ${endDate}`);
    assert.equal(result.fields.find((field) => field.question === '任职时间').reason, 'readback_matched');
    assert.equal(result.liveSupportClaimed, false);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].value, '');
    assert.equal(seen[0].panelConnected, false);
    assert.equal(seen[0].panelOpen, false);
    assert.equal(months.domPaints, 0);
    assert.equal(months.emptyCloses, 1);
    assert.equal(months.panelRemoved, 1);
    assert.equal(months.vuePicks, mode === 'pick' ? 1 : 0);
    assert.equal(months.vueEmits, mode === 'emit' ? 1 : 0);
    assert.equal(months.endChangeCommits, 0);
    assert.equal(months.typedChanges, 0);
    assert.equal(months.typedClears, 0);
    assert.equal(months.endCellClicks, 1);
    assert.equal(doc.getElementById('salary').value, '');
    flags(result);
    assert.equal(forbidden(clicks).length, 0);
  }

  const bare = bootRace({ closeEmpty: true, removePanelOnEmpty: true, closeClearsTyped: true });
  const bareResult = await bare.context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate: '2023-01', endDate: '2024-06' })));
  const bareSeen = endSeen(bare.bridge, '2024-06');
  assert.equal(bareResult.ok, false);
  assert.equal(bareResult.reason, 'readback_mismatch');
  assert.equal(bareResult.selectorStep, 'month_option');
  assert.equal(bareResult.fields.find((field) => field.question === '任职时间').reason, 'readback_mismatch');
  assert.equal(bare.doc.getElementById('start-date').value, '2023-01');
  assert.equal(bare.doc.getElementById('end-date').value, '');
  assert.equal(bareSeen.length, 1);
  assert.equal(bareSeen[0].value, '');
  assert.equal(bareSeen[0].panelConnected, false);
  assert.equal(bare.months.vuePicks, 0);
  assert.equal(bare.months.vueEmits, 0);
  assert.equal(bare.months.domPaints, 0);
  assert.equal(bare.months.panelRemoved, 1);
  assert.ok(bare.months.typedClears >= 1);
  assert.equal(bareResult.fields.find((field) => field.question === '公司名称').reason, 'not_run');
  assert.equal(bare.doc.getElementById('salary').value, '');
  assert.equal(bareResult.liveSupportClaimed, false);
  flags(bareResult);
  assert.equal(forbidden(bare.clicks).length, 0);

  const down = bootRace({
    closeEmpty: true, removePanelOnEmpty: true, closeClearsTyped: true, acceptEditorPick: true, monthBridge: false,
  });
  const downResult = await down.context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate: '2023-01', endDate: '2024-06' })));
  const downSeen = endSeen(down.bridge, '2024-06');
  assert.equal(downResult.ok, false);
  assert.equal(downResult.reason, 'readback_mismatch');
  assert.equal(downResult.selectorStep, 'month_option');
  assert.equal(down.doc.getElementById('start-date').value, '2023-01');
  assert.equal(down.doc.getElementById('end-date').value, '');
  assert.equal(downSeen.length, 1);
  assert.equal(downSeen[0].value, '');
  assert.equal(downSeen[0].panelConnected, false);
  assert.equal(down.months.vuePicks, 0);
  assert.equal(down.months.domPaints, 0);
  assert.equal(down.months.panelRemoved, 1);
  assert.ok(down.months.typedClears >= 1);
  assert.equal(downResult.liveSupportClaimed, false);
  assert.equal(down.doc.getElementById('salary').value, '');
  flags(downResult);
  assert.equal(forbidden(down.clicks).length, 0);

  for (const code of ['dual', 'bad-year', 'mismatch']) {
    const stopped = bootRace({
      closeEmpty: true, removePanelOnEmpty: true, closeClearsTyped: true, bridgeStop: { '2024-06': code },
    });
    const stoppedResult = await stopped.context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate: '2023-01', endDate: '2024-06' })));
    const stoppedSeen = endSeen(stopped.bridge, '2024-06');
    assert.equal(stoppedResult.ok, false, code);
    assert.equal(stoppedResult.reason, 'readback_mismatch', code);
    assert.equal(stoppedResult.selectorStep, 'month_option', code);
    assert.equal(stoppedResult.fields.find((field) => field.question === '任职时间').reason, 'readback_mismatch', code);
    assert.equal(stopped.doc.getElementById('start-date').value, '2023-01', code);
    assert.equal(stopped.doc.getElementById('end-date').value, '', code);
    assert.equal(stoppedSeen.length, 1, code);
    assert.equal(stoppedSeen[0].value, '', code);
    assert.equal(stoppedSeen[0].panelConnected, false, code);
    assert.equal(stopped.months.vuePicks, 0, code);
    assert.equal(stopped.months.domPaints, 0, code);
    assert.equal(stopped.months.panelRemoved, 1, code);
    assert.equal(stoppedResult.fields.find((field) => field.question === '公司名称').reason, 'not_run', code);
    assert.equal(stopped.doc.getElementById('salary').value, '', code);
    assert.equal(stoppedResult.liveSupportClaimed, false, code);
    flags(stoppedResult);
    assert.equal(forbidden(stopped.clicks).length, 0, code);
  }
});

test('任职时间 calls the month bridge when a connected start husk stays pending after the end panel is removed', async () => {
  const endSeen = (bridge, endDate) => bridge.seen.filter((row) => row.answer === endDate);
  const huskOptions = { closeEmpty: true, removePanelOnEmpty: true, closeClearsTyped: true, pendingStartHusk: true };
  for (const [startDate, endDate, mode] of [['2023-01', '2024-06', 'pick'], ['2022-03', '2023-12', 'emit']]) {
    const { doc, clicks, context, months, bridge } = bootRace({
      ...huskOptions,
      acceptEditorPick: mode === 'pick',
      acceptEmit: mode === 'emit',
    });
    const result = await context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate, endDate })));
    const seen = endSeen(bridge, endDate);
    assert.equal(result.ok, true, JSON.stringify({
      startDate, endDate, mode, reason: result.reason, step: result.selectorStep,
      picks: months.vuePicks, emits: months.vueEmits, seen, husk: months.pendingHuskRevealed,
    }));
    assert.equal(`${doc.getElementById('start-date').value} | ${doc.getElementById('end-date').value}`, `${startDate} | ${endDate}`);
    assert.equal(result.fields.find((field) => field.question === '任职时间').reason, 'readback_matched');
    assert.equal(result.liveSupportClaimed, false);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].value, '');
    assert.equal(seen[0].panelConnected, false);
    assert.equal(seen[0].panelOpen, false);
    assert.equal(months.pendingHuskRevealed, true);
    assert.ok(months.huskDismissIgnored >= 1);
    assert.equal(months.panels.start.isConnected, true);
    assert.equal(months.panels.start.style.display, 'block');
    assert.equal(months.panels.end.isConnected, false);
    assert.equal(months.emptyCloses, 1);
    assert.equal(months.panelRemoved, 1);
    assert.equal(months.vuePicks, mode === 'pick' ? 1 : 0);
    assert.equal(months.vueEmits, mode === 'emit' ? 1 : 0);
    assert.equal(months.typedChanges, 0);
    assert.equal(months.typedClears, 0);
    assert.equal(doc.getElementById('salary').value, '');
    flags(result);
    assert.equal(forbidden(clicks).length, 0);
  }

  const bare = bootRace(huskOptions);
  const bareResult = await bare.context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate: '2023-01', endDate: '2024-06' })));
  const bareSeen = endSeen(bare.bridge, '2024-06');
  assert.equal(bareResult.ok, false);
  assert.equal(bareResult.reason, 'readback_mismatch');
  assert.equal(bareResult.selectorStep, 'month_option');
  assert.equal(bareResult.fields.find((field) => field.question === '任职时间').reason, 'readback_mismatch');
  assert.equal(bare.doc.getElementById('start-date').value, '2023-01');
  assert.equal(bare.doc.getElementById('end-date').value, '');
  assert.equal(bareSeen.length, 1);
  assert.equal(bareSeen[0].value, '');
  assert.equal(bareSeen[0].panelConnected, false);
  assert.equal(bare.months.vuePicks, 0);
  assert.equal(bare.months.vueEmits, 0);
  assert.equal(bare.months.pendingHuskRevealed, true);
  assert.equal(bare.months.panels.start.isConnected, true);
  assert.ok(bare.months.typedClears >= 1);
  assert.equal(bareResult.fields.find((field) => field.question === '公司名称').reason, 'not_run');
  assert.equal(bare.doc.getElementById('salary').value, '');
  assert.equal(bareResult.liveSupportClaimed, false);
  flags(bareResult);
  assert.equal(forbidden(bare.clicks).length, 0);

  const down = bootRace({ ...huskOptions, acceptEditorPick: true, monthBridge: false });
  const downResult = await down.context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate: '2023-01', endDate: '2024-06' })));
  const downSeen = endSeen(down.bridge, '2024-06');
  assert.equal(downResult.ok, false);
  assert.equal(downResult.reason, 'readback_mismatch');
  assert.equal(downResult.selectorStep, 'month_option');
  assert.equal(down.doc.getElementById('start-date').value, '2023-01');
  assert.equal(down.doc.getElementById('end-date').value, '');
  assert.equal(downSeen.length, 1);
  assert.equal(downSeen[0].value, '');
  assert.equal(downSeen[0].panelConnected, false);
  assert.equal(down.months.vuePicks, 0);
  assert.equal(down.months.pendingHuskRevealed, true);
  assert.equal(down.months.panels.start.isConnected, true);
  assert.ok(down.months.typedClears >= 1);
  assert.equal(downResult.liveSupportClaimed, false);
  assert.equal(down.doc.getElementById('salary').value, '');
  flags(downResult);
  assert.equal(forbidden(down.clicks).length, 0);

  const realDual = bootRace({ ...huskOptions, acceptEditorPick: true, dualPendingOnEmpty: true });
  const realDualResult = await realDual.context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate: '2023-01', endDate: '2024-06' })));
  const realDualSeen = endSeen(realDual.bridge, '2024-06');
  assert.equal(realDualResult.ok, false);
  assert.equal(realDualResult.reason, 'control_not_supported');
  assert.equal(realDualResult.selectorStep, 'month_option');
  assert.equal(realDual.doc.getElementById('start-date').value, '2023-01');
  assert.equal(realDual.doc.getElementById('end-date').value, '');
  assert.equal(realDualSeen.length, 1);
  assert.equal(realDualSeen[0].panelConnected, false);
  assert.equal(realDual.months.vuePicks, 0);
  assert.equal(realDual.months.vueEmits, 0);
  assert.equal(realDual.months.pendingHuskRevealed, true);
  assert.equal(realDual.months.panels.start.isConnected, true);
  assert.equal(realDualResult.fields.find((field) => field.question === '公司名称').reason, 'not_run');
  assert.equal(realDual.doc.getElementById('salary').value, '');
  assert.equal(realDualResult.liveSupportClaimed, false);
  flags(realDualResult);
  assert.equal(forbidden(realDual.clicks).length, 0);

  for (const code of ['dual', 'bad-year', 'mismatch']) {
    const stopped = bootRace({ ...huskOptions, bridgeStop: { '2024-06': code } });
    const stoppedResult = await stopped.context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate: '2023-01', endDate: '2024-06' })));
    const stoppedSeen = endSeen(stopped.bridge, '2024-06');
    assert.equal(stoppedResult.ok, false, code);
    assert.equal(stoppedResult.reason, 'readback_mismatch', code);
    assert.equal(stoppedResult.selectorStep, 'month_option', code);
    assert.equal(stoppedResult.fields.find((field) => field.question === '任职时间').reason, 'readback_mismatch', code);
    assert.equal(stopped.doc.getElementById('start-date').value, '2023-01', code);
    assert.equal(stopped.doc.getElementById('end-date').value, '', code);
    assert.equal(stoppedSeen.length, 1, code);
    assert.equal(stoppedSeen[0].value, '', code);
    assert.equal(stoppedSeen[0].panelConnected, false, code);
    assert.equal(stopped.months.vuePicks, 0, code);
    assert.equal(stopped.months.pendingHuskRevealed, true, code);
    assert.equal(stopped.months.panels.start.isConnected, true, code);
    assert.equal(stoppedResult.fields.find((field) => field.question === '公司名称').reason, 'not_run', code);
    assert.equal(stopped.doc.getElementById('salary').value, '', code);
    assert.equal(stoppedResult.liveSupportClaimed, false, code);
    flags(stoppedResult);
    assert.equal(forbidden(stopped.clicks).length, 0, code);
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
  assert.equal(stickyResult.ok, true, JSON.stringify({ reason: stickyResult.reason, step: stickyResult.selectorStep }));
  assert.equal(`${sticky.doc.getElementById('start-date').value} | ${sticky.doc.getElementById('end-date').value}`, '2023-01 | 2024-06');
  assert.equal(sticky.months.commits, 2);
  assert.equal(sticky.months.endCellClicks, 1);
  assert.equal(sticky.months.huskRemainedAfterStart, true);
  assert.equal(sticky.months.panels.start.isConnected, true);
  assert.equal(sticky.months.endOpenClicks, 1);
  assert.equal(sticky.doc.getElementById('salary').value, '');
  assert.equal(forbidden(sticky.clicks).length, 0);

  const again = bootRace({ reattachQuietEveryEndShow: true });
  const againResult = await again.context.ResumeGthWorkOpen.trial(request(workProfile({ ...ROW, startDate: '2023-01', endDate: '2024-06' })));
  assert.equal(againResult.ok, true, JSON.stringify({ reason: againResult.reason, step: againResult.selectorStep }));
  assert.equal(`${again.doc.getElementById('start-date').value} | ${again.doc.getElementById('end-date').value}`, '2023-01 | 2024-06');
  assert.equal(again.months.commits, 2);
  assert.equal(again.months.endCellClicks, 1);
  assert.equal(again.months.endOpenClicks, 1);
  assert.equal(again.months.quietAtEndClick, 1);
  assert.equal(again.months.panels.start.isConnected, true);
  assert.equal(again.doc.getElementById('salary').value, '');
  assert.equal(forbidden(again.clicks).length, 0);
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
