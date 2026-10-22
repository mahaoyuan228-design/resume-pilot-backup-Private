import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { buildPageExpression } from '../scripts/live/lib/gth-full-page.mjs';
import { SECTION_TITLES } from '../scripts/live/gth-intent-live.mjs';
import { buildFieldRows, chromeShimExpression, requestsFor, SECTIONS } from '../scripts/live/lib/gth-full-sections.mjs';
import { evidenceExitCode } from '../scripts/live/gth-full-resume-live.mjs';

const work = SECTIONS.find(section => section.id === 'work');
const request = requestsFor(work)[0].request;
const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const source = ['gth-open-fill.js', 'gth-work-fill.js'].map(file =>
  readFileSync(new URL('../src/content/' + file, import.meta.url), 'utf8'));
const plain = (q, id, tag = 'input') => `<div class="el-form-item"><label class="el-form-item__label">${q}</label>
  <div class="el-form-item__content"><div class="input-l el-input">${tag === 'textarea'
    ? `<textarea id="${id}"></textarea>` : `<input type="text" id="${id}">`}</div></div></div>`;

// These are the existing tests/gth-work-fill.test.mjs cascader and month
// structures. No-layout checkboxes and hidden footer are offline scenarios;
// neither the fixture nor the reported empty click label identifies live DOM.
function cascader(q, id, l1, single) {
  const hidden = single ? ' style="display:none"' : '';
  return `<div class="el-form-item"><label class="el-form-item__label">${q}</label>
    <div class="el-form-item__content cascader-wrap">
      <div class="input-l pointer" id="${id}-trigger"><div class="input-l pointer el-input"><input class="el-input__inner" id="${id}" readonly type="text"></div></div>
      <div class="dialog-wrap plugin-dialog-wrap popover blue" id="${id}-panel" style="display:none">
        <div class="selected-view-outer"${hidden}><ul class="selected-view-data"></ul><div class="selected-counter"><p>(0/5)</p></div></div>
        <div class="search-outer"><input class="search-input" placeholder="请输入关键字"></div>
        <div class="eo-cascader-panel"><div class="eo-cascader-menu simple-tree-outer"><ul class="simple-tree-wrapper"><li class="branch has-child"><span>${l1}</span></li></ul></div></div>
        <div class="pop-foot plugin-dialog-pop-foot"${hidden}><a class="confirm pop-btn">确定</a><a class="cancel pop-btn">取消</a></div>
      </div>
    </div></div>`;
}
function dates() {
  const editor = id => `<div class="el-date-editor date-hl el-input el-input--prefix el-input--suffix el-date-editor--month">
    <span class="el-input__prefix"><i class="el-input__icon el-icon-date" id="${id}-icon"></i></span><input class="el-input__inner" id="${id}" readonly type="text"></div>`;
  return `<div class="el-form-item"><label class="el-form-item__label">任职时间</label><div class="el-form-item__content">
    ${editor('start-date')}${editor('end-date')}
    <div class="el-picker-panel el-date-picker" id="month-panel" style="display:none"><div class="el-date-picker__header">
      <i class="el-icon-d-arrow-left"></i><span class="el-date-picker__header-label">2024 年</span><i class="el-icon-d-arrow-right"></i></div>
      <table class="el-month-table"><tbody><tr>${MONTHS.map(name => `<td><div><a class="cell">${name}</a></div></td>`).join('')}</tr></tbody></table></div>
    </div></div>`;
}
function fields(single, industrySingle = false) {
  return [plain('职位名称', 'position'), cascader('职位类别', 'job', '金融/保险', single), plain('公司名称', 'organization'), dates(),
    plain('工作地区', 'area'), plain('职责与业绩', 'description', 'textarea'), cascader('公司所属行业', 'industry', '金融', industrySingle),
    plain('公司介绍', 'intro', 'textarea'), plain('所属部门', 'department'), plain('汇报对象', 'report'), plain('下属人数', 'reports'),
    plain('薪资', 'salary'), plain('离职原因', 'leave', 'textarea')].join('');
}
function wireCascader(doc, id, leaf, { single = false, reveal = true } = {}) {
  const trigger = doc.getElementById(id + '-trigger');
  const panel = doc.getElementById(id + '-panel');
  const input = doc.getElementById(id);
  const root = panel.querySelector('.eo-cascader-panel');
  const stats = { open: 0, level1: 0, checkbox: 0, single: 0, confirm: 0, cancel: 0 };
  trigger.addEventListener('click', () => { stats.open++; panel.style.display = 'block'; });
  root.addEventListener('click', event => {
    const menus = [...root.children];
    if (menus[0].contains(event.target)) {
      stats.level1++;
      if (!reveal || menus.length !== 1) return;
      const menu = doc.createElement('div');
      menu.className = 'eo-cascader-menu simple-tree-outer';
      menu.innerHTML = `<ul class="simple-tree-wrapper"><li class="branch"><label><input type="checkbox">${leaf}</label></li></ul>`;
      root.append(menu);
      return;
    }
    if (!menus[1]?.contains(event.target)) return;
    // Match work-fill's existing single-select fixture: the row/label click
    // commits and hides the panel before the label forwards to its input.
    if (single) {
      const row = event.target.closest('li.branch');
      if (!row || !menus[1].contains(row) || row.classList.contains('has-child')) return;
      const text = (row.querySelector('label') || row.querySelector(':scope > span'))?.textContent.trim();
      if (!text) return;
      stats.single++;
      panel.querySelector('.selected-view-data').innerHTML = `<li><p>${text}</p><i></i></li>`;
      input.value = text;
      panel.style.display = 'none';
      return;
    }
    const checkbox = event.target.closest('input[type="checkbox"]');
    if (checkbox?.checked) {
      stats.checkbox++;
      panel.querySelector('.selected-view-data').innerHTML = `<li><p>${leaf}</p><i></i></li>`;
    }
  });
  panel.querySelector('a.confirm').addEventListener('click', () => {
    stats.confirm++;
    const chips = panel.querySelectorAll('.selected-view-data > li > p');
    if (chips.length === 1) input.value = chips[0].textContent;
    panel.style.display = 'none';
  });
  panel.querySelector('a.cancel').addEventListener('click', () => {
    stats.cancel++;
    root.children[1]?.remove();
    panel.style.display = 'none';
  });
  return stats;
}
function wireMonths(doc) {
  const panel = doc.getElementById('month-panel');
  doc.body.append(panel);
  const year = panel.querySelector('.el-date-picker__header-label');
  let active;
  const stats = { open: 0, cells: 0 };
  for (const id of ['start-date', 'end-date']) doc.getElementById(id + '-icon').addEventListener('click', () => {
    active = doc.getElementById(id); panel.style.display = 'block'; stats.open++;
  });
  for (const [selector, delta] of [['.el-icon-d-arrow-left', -1], ['.el-icon-d-arrow-right', 1]]) {
    panel.querySelector(selector).addEventListener('click', () => { year.textContent = `${Number(year.textContent.match(/\d{4}/u)[0]) + delta} 年`; });
  }
  for (const cell of panel.querySelectorAll('td')) cell.addEventListener('click', () => {
    const month = MONTHS.indexOf(cell.textContent.trim()) + 1;
    active.value = `${year.textContent.match(/\d{4}/u)[0]}-${String(month).padStart(2, '0')}`;
    panel.style.display = 'none'; stats.cells++;
  });
  doc.addEventListener('keydown', event => { if (event.key === 'Escape') panel.style.display = 'none'; });
  return stats;
}
async function boot({ single = false, reveal = true, industrySingle = false } = {}) {
  const dom = new JSDOM(`<!doctype html><head><style>input[type="checkbox"] { display:none }</style></head><body>${SECTION_TITLES.map(title =>
    `<section class="r-section"><div class="title_">${title}${title === '工作经验' ? '<a class="h-e-btn" href="javascript:;">添加</a>' : ''}</div><div class="sec-context"></div></section>`).join('')}</body>`,
  { url: 'https://hr.gtht.com/resume/edit/', pretendToBeVisual: true, runScripts: 'outside-only' });
  const { window } = dom;
  const doc = window.document;
  window.Element.prototype.getClientRects = function () { return this.matches('input[type="checkbox"]') ? [] : [{ width: 8, height: 8 }]; };
  Object.defineProperty(doc, 'readyState', { configurable: true, value: 'complete' });
  const sections = [...doc.querySelectorAll('.r-section')];
  const section = sections[3];
  const add = section.querySelector('a.h-e-btn');
  const stats = { dangerous: [], added: 0 };
  add.addEventListener('click', () => {
    stats.added++;
    add.remove();
    const form = doc.createElement('form');
    form.className = 'el-form sec-form';
    form.innerHTML = fields(single, industrySingle) + '<button type="button" id="editor-cancel">取消</button><button type="button" id="editor-save">保存</button>';
    section.append(form);
    stats.job = wireCascader(doc, 'job', '银行', { single, reveal });
    stats.industry = wireCascader(doc, 'industry', '证券/投资/基金/信托', { single: industrySingle });
    stats.months = wireMonths(doc);
    form.querySelector('#editor-cancel').addEventListener('click', () => { form.remove(); section.querySelector('.title_').append(add); });
    form.querySelector('#editor-save').addEventListener('click', () => stats.dangerous.push('save'));
  });
  window.eval(buildPageExpression({ waitTimeoutMs: 100, pollMs: 1 }));
  const api = window.__gthFullLive;
  const opened = await api.open(3);
  assert.equal(opened.ok, true);
  assert.equal(opened.opener, 'title_add');
  assert.equal(opened.action, 'click_add');
  assert.equal(opened.entryCount, 0);
  window.eval(chromeShimExpression());
  source.forEach(code => window.eval(code));
  return { dom, window, doc, sections, section, form: section.querySelector('form'), stats, api,
    close() { window.__gthFullResumeChromeRestore?.(); api.restore(); dom.window.close(); } };
}
function revealLeaf(f, id = 'job') {
  f.doc.getElementById(id + '-trigger').click();
  f.doc.getElementById(id + '-panel').querySelector('.branch.has-child > span').click();
  return f.doc.getElementById(id + '-panel').querySelector('input[type="checkbox"]');
}

test('title_add empty work card fills blank no-layout cascaders with the shipped writer, then discards', async () => {
  const f = await boot();
  try {
    const fill = await f.window.ResumeGthWorkOpen.trial(request);
    assert.equal(fill.ok, true, JSON.stringify(fill));
    assert.equal(fill.liveSupportClaimed, false);
    assert.equal(fill.softwareClickedSave, false);
    assert.equal(fill.softwareClickedSubmit, false);
    assert.equal(fill.softwareClickedDelete, false);
    assert.equal(fill.fields.length, 12);
    assert.equal(fill.fields.every(row => row.status === 'verified'), true);
    assert.equal(f.stats.job.checkbox, 1);
    assert.equal(f.stats.industry.checkbox, 1);
    assert.equal(f.stats.job.confirm, 1);
    assert.equal(f.stats.industry.confirm, 1);
    assert.equal(f.stats.months.open, 2);
    assert.equal(f.stats.months.cells, 2);
    assert.equal(f.doc.getElementById('salary').value, '');
    assert.equal(fill.coverage.find(row => row.question === '薪资').reason, 'control_not_supported');
    const rows = buildFieldRows(work, [{ fill }], f.api.read(3, work.questions));
    assert.equal(rows.filter(row => row.q !== '薪资').every(row => row.status === 'verified'), true, JSON.stringify(rows));
    assert.equal(rows.find(row => row.q === '任职时间').startMonth, '2020-03');
    assert.equal(rows.find(row => row.q === '任职时间').endMonth, '2024-08');
    assert.equal(rows.find(row => row.q === '下属人数').value, '5');
    assert.equal(rows.find(row => row.q === '薪资').status, 'failed');
    const cancel = await f.api.cancel(3);
    assert.equal(cancel.closed, true);
    assert.equal(cancel.forced, false);
    assert.equal(f.api.state().editorFormCount, 0);
    assert.equal(f.section.querySelectorAll('.sec-context > .sec-detail').length, 0);
    assert.equal(f.api.clicks().every(row => row.allowed), true, JSON.stringify(f.api.clicks()));
    assert.deepEqual(f.stats.dangerous, []);
    assert.deepEqual(Array.from(f.api.requests()), []);
    assert.equal(evidenceExitCode({ clicks: f.api.clicks(), requests: f.api.requests(), sections: [{ status: 'failed', fields: rows }] }), 2);
  } finally { f.close(); }
});

test('shipped work cascader abort may discard its hidden footer without a forbidden click', async () => {
  const f = await boot({ single: true, reveal: false });
  try {
    const fill = await f.window.ResumeGthWorkOpen.trial(request);
    assert.equal(fill.ok, false);
    assert.equal(fill.reason, 'picker_level2_menu_missing');
    assert.equal(f.stats.job.cancel, 1);
    assert.equal(f.doc.getElementById('job-panel').style.display, 'none');
    assert.equal(f.api.clicks().every(row => row.allowed), true, JSON.stringify(f.api.clicks()));
    assert.equal((await f.api.cancel(3)).closed, true);
    assert.deepEqual(f.stats.dangerous, []);
    assert.equal(evidenceExitCode({ clicks: f.api.clicks(), requests: f.api.requests(), sections: [] }), 2);
  } finally { f.close(); }
});

test('single-select industry label commits before its forwarded native checkbox click without a false forbidden audit', async () => {
  const f = await boot({ industrySingle: true });
  try {
    const fill = await f.window.ResumeGthWorkOpen.trial(request);
    assert.equal(fill.ok, true, JSON.stringify(fill));
    assert.equal(fill.fields.find(row => row.question === '公司所属行业').status, 'verified');
    assert.equal(f.stats.industry.single >= 1, true);
    assert.equal(f.stats.industry.confirm, 0);
    assert.equal(f.doc.getElementById('industry').value, '证券/投资/基金/信托');
    assert.equal(f.doc.getElementById('industry-panel').style.display, 'none');
    assert.equal(f.api.clicks().every(row => row.allowed), true, JSON.stringify(f.api.clicks()));
    // Any later explicit click on that now-hidden checkbox is still unknown;
    // only the label's synchronous native forwarding belongs to the action.
    const checkbox = f.doc.getElementById('industry-panel').querySelector('input[type="checkbox"]');
    assert.throws(() => checkbox.click(), /refusing_forbidden_click/);
    assert.throws(() => checkbox.dispatchEvent(new f.window.MouseEvent('click', { bubbles: true, cancelable: true })), /refusing_forbidden_click/);
    assert.equal((await f.api.cancel(3)).closed, true);
    assert.equal(f.section.querySelectorAll('.sec-context > .sec-detail').length, 0);
    assert.deepEqual(f.stats.dangerous, []);
  } finally { f.close(); }
});

test('work no-layout checkbox and hidden footer exceptions retain strict ownership and action checks', async () => {
  const mutations = [
    (f, node) => node.setAttribute('form', 'foreign'),
    (f, node) => node.parentElement.append(node.cloneNode()),
    (f, node) => { node.disabled = true; },
    (f, node) => node.closest('li').setAttribute('aria-disabled', 'true'),
    (f, node) => { node.closest('label').hidden = true; },
    (f, node) => { node.closest('.plugin-dialog-wrap').hidden = true; },
    (f, node) => { node.closest('.el-form-item').querySelector('.el-form-item__label').textContent = '工作地区'; },
    (f, node) => { f.sections[2].append(node.closest('.el-form-item')); },
    (f, node) => { f.doc.body.append(node.closest('.plugin-dialog-wrap')); },
    (f, node) => { f.form.append(node.closest('.plugin-dialog-wrap').cloneNode(true)); },
    (f, node) => { f.form.append(node.closest('.el-form-item').cloneNode(true)); },
    (f, node) => { const a = f.doc.createElement('a'); a.href = '/resume/save'; node.replaceWith(a); a.append(node); },
    (f, node) => { const button = f.doc.createElement('button'); button.type = 'submit'; node.replaceWith(button); button.append(node); }
  ];
  for (const mutate of mutations) {
    const f = await boot();
    try {
      const node = revealLeaf(f);
      mutate(f, node);
      assert.throws(() => node.click(), /refusing_forbidden_click/);
      assert.equal(f.stats.job.checkbox, 0);
      assert.deepEqual(f.stats.dangerous, []);
    } finally { f.close(); }
  }
  for (const mutate of [
    (f, node) => { node.href = '/resume/save'; },
    (f, node) => { node.setAttribute('aria-disabled', 'true'); },
    (f, node) => { node.closest('.plugin-dialog-wrap').hidden = true; },
    (f, node) => { f.doc.body.append(node.closest('.plugin-dialog-wrap')); },
    (f, node) => { f.form.append(node.closest('.plugin-dialog-wrap').cloneNode(true)); },
    (f, node) => { node.closest('.el-form-item').querySelector('.el-form-item__label').textContent = '其他题目'; },
    (f, node) => { const button = f.doc.createElement('button'); button.type = 'submit'; node.replaceWith(button); button.append(node); }
  ]) {
    const f = await boot({ single: true });
    try {
      f.doc.getElementById('job-trigger').click();
      const node = f.doc.getElementById('job-panel').querySelector('a.cancel');
      mutate(f, node);
      assert.throws(() => node.click(), /refusing_forbidden_click/);
      assert.equal(f.stats.job.cancel, 0);
      assert.deepEqual(f.stats.dangerous, []);
    } finally { f.close(); }
  }
  const f = await boot();
  try {
    const unknown = f.doc.createElement('div');
    f.form.append(unknown);
    assert.throws(() => unknown.click(), /refusing_forbidden_click/);
    assert.throws(() => f.doc.getElementById('editor-save').click(), /refusing_forbidden_click/);
    assert.deepEqual(f.stats.dangerous, []);
  } finally { f.close(); }
});

function escapeMonth(f, input = f.doc.getElementById('start-date')) {
  input.dispatchEvent(new f.window.KeyboardEvent('keydown', {
    key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true
  }));
}
function rootMouse(f, type) {
  return f.doc.documentElement.dispatchEvent(new f.window.MouseEvent(type, { bubbles: true, cancelable: true }));
}

test('work month dismissal permits the writer Escape and HTML mouse sequence once, while bare root stays blocked', async () => {
  const f = await boot();
  try {
    assert.throws(() => f.doc.documentElement.click(), /refusing_forbidden_click/);
    escapeMonth(f);
    rootMouse(f, 'mousedown');
    rootMouse(f, 'mouseup');
    assert.doesNotThrow(() => rootMouse(f, 'click'));
    assert.equal(f.api.clicks().at(-1).allowed, true);
    assert.throws(() => rootMouse(f, 'click'), /refusing_forbidden_click/);
    assert.deepEqual(f.stats.dangerous, []);
  } finally { f.close(); }
});

test('month dismissal sequence cannot borrow a wrong, hidden, ambiguous or foreign work field', async () => {
  const mutations = [
    f => f.doc.getElementById('position'),
    f => { const input = f.doc.getElementById('start-date'); input.hidden = true; return input; },
    f => { const input = f.doc.getElementById('start-date'); input.readOnly = false; return input; },
    f => { const input = f.doc.getElementById('start-date'); input.setAttribute('form', 'foreign'); return input; },
    f => { const input = f.doc.getElementById('start-date'); input.parentElement.insertAdjacentHTML('beforeend', '<input type="hidden">'); return input; },
    f => {
      const input = f.doc.getElementById('start-date');
      f.doc.getElementById('end-date').closest('.el-date-editor').remove();
      const nested = f.doc.createElement('div');
      nested.className = 'el-date-editor el-date-editor--month';
      input.replaceWith(nested);
      nested.append(input);
      return input;
    },
    f => { const input = f.doc.getElementById('start-date'); f.form.append(input.closest('.el-form-item').cloneNode(true)); return input; },
    f => { f.sections[2].append(f.form); assert.equal(f.api.activate(2).ok, true); return f.doc.getElementById('start-date'); }
  ];
  for (const mutate of mutations) {
    const f = await boot();
    try {
      escapeMonth(f, mutate(f));
      rootMouse(f, 'mousedown');
      rootMouse(f, 'mouseup');
      assert.throws(() => rootMouse(f, 'click'), /refusing_forbidden_click/);
      assert.deepEqual(f.stats.dangerous, []);
    } finally { f.close(); }
  }
  const f = await boot();
  try {
    escapeMonth(f);
    rootMouse(f, 'mousedown');
    assert.throws(() => rootMouse(f, 'click'), /refusing_forbidden_click/);
  } finally { f.close(); }
  for (const attempt of [
    f => f.doc.documentElement.click(),
    f => { rootMouse(f, 'mouseup'); rootMouse(f, 'mousedown'); return rootMouse(f, 'click'); },
    f => { rootMouse(f, 'mousedown'); rootMouse(f, 'mouseup'); return f.doc.getElementById('editor-save').click(); }
  ]) {
    const f = await boot();
    try {
      escapeMonth(f);
      assert.throws(() => attempt(f), /refusing_forbidden_click/);
      assert.deepEqual(f.stats.dangerous, []);
    } finally { f.close(); }
  }
});
