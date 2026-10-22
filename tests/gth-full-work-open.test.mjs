import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { buildPageExpression } from '../scripts/live/lib/gth-full-page.mjs';
import { SECTION_TITLES } from '../scripts/live/gth-intent-live.mjs';
import { chromeShimExpression, requestsFor, SECTIONS } from '../scripts/live/lib/gth-full-sections.mjs';

const PAGE = 'https://hr.gtht.com/resume/edit/';
const item = '<div class="el-form-item"><label class="el-form-item__label">职位名称</label><div class="el-form-item__content"><input value="分析师"></div></div>';
const editAnchor = '<a href="javascript:;"><i class="el-icon-edit-outline"></i></a>';
const deleteAnchor = '<a class="eduexp-opt-icon" url="/api/resume/delete.json"><i class="el-icon-delete"></i></a>';

function boot({ records = 1, recordEdits = true, titleAction = '添加', delayedItems = false, editorItems = item } = {}) {
  // The record/title affordances come from probe-gth-section's existing work
  // fixture. ResumeGthWorkOpen accepts the same form.el-form.sec-form shell.
  const dom = new JSDOM('<!doctype html><body></body>', {
    url: PAGE, pretendToBeVisual: true, runScripts: 'outside-only'
  });
  const { window } = dom;
  const doc = window.document;
  window.Element.prototype.getClientRects = () => [{ width: 8, height: 8 }];
  Object.defineProperty(doc, 'readyState', { configurable: true, value: 'complete' });
  const opened = [];
  const dangerous = [];
  for (const title of SECTION_TITLES) {
    const section = doc.createElement('section');
    section.className = 'r-section';
    section.innerHTML = '<div class="title_"></div>';
    section.querySelector('.title_').textContent = title;
    doc.body.append(section);
  }
  const sections = [...doc.querySelectorAll('.r-section')];
  const section = sections[3];
  if (titleAction) section.querySelector('.title_').insertAdjacentHTML('beforeend',
    '<a class="h-e-btn" href="javascript:;">' + titleAction + '</a>');
  section.insertAdjacentHTML('beforeend', '<div class="sec-context">' + Array.from({ length: records }, (_, index) =>
    '<div class="sec-detail" data-entry="' + index + '">' + (recordEdits ? editAnchor : '') + deleteAnchor + '</div>'
  ).join('') + '</div>');
  const entries = [...section.querySelectorAll('.sec-context > .sec-detail')];
  const recordLinks = entries.map(entry => entry.querySelector('a:not(.eduexp-opt-icon)'));
  const titleLink = section.querySelector('.title_ a');
  for (const node of section.querySelectorAll('.eduexp-opt-icon')) node.addEventListener('click', () => dangerous.push('delete'));
  function wire(node, entryIndex) {
    if (!node) return;
    node.addEventListener('click', event => {
      event.preventDefault();
      opened.push(entryIndex);
      const form = doc.createElement('form');
      form.className = 'el-form sec-form';
      form.innerHTML = (delayedItems ? '' : editorItems)
        + '<button type="button">取消</button><button type="button">保存</button>';
      // The probe's opened-work fixture removes the title affordance. Record
      // edit links can stay connected, hidden with the record being edited.
      titleLink?.remove();
      if (entryIndex != null) entries[entryIndex].style.display = 'none';
      section.append(form);
      if (delayedItems) window.setTimeout(() => form.insertAdjacentHTML('afterbegin', editorItems), 10);
      form.querySelector('button').addEventListener('click', () => {
        form.remove();
        entries.forEach(entry => { entry.style.display = ''; });
        if (titleLink) section.querySelector('.title_').append(titleLink);
      });
      form.querySelectorAll('button')[1].addEventListener('click', () => dangerous.push('save'));
    });
  }
  recordLinks.forEach(wire);
  wire(titleLink, null);
  window.eval(buildPageExpression({ waitTimeoutMs: 100, pollMs: 1 }));
  return { dom, window, doc, sections, section, entries, recordLinks, titleLink, opened, dangerous, api: window.__gthFullLive };
}

test('full work trial opens the first existing record without a title 编辑 and waits for its items', async () => {
  const f = boot({ records: 2, delayedItems: true });
  try {
    assert.equal(f.section.querySelector('.title_').textContent, '工作经验添加');
    const result = await f.api.open(3);
    assert.equal(result.ok, true);
    assert.equal(result.opener, 'record_edit');
    assert.equal(result.entryIndex, 0);
    assert.equal(result.entryCount, 2);
    assert.deepEqual(f.opened, [0]);
    assert.ok(f.section.querySelector('form .el-form-item'));
    assert.equal(f.api.read(3, ['职位名称']).readback[0].value, '分析师');
    const cancel = await f.api.cancel(3);
    assert.equal(cancel.closed, true);
    assert.equal(cancel.forced, false);
    assert.equal(f.api.state().editorFormCount, 0);
    assert.equal(f.section.querySelectorAll('.sec-context > .sec-detail').length, 2);
    assert.equal(f.entries.every(entry => entry.style.display === ''), true);
    assert.deepEqual(Array.from(f.api.clicks(), row => row.kind), ['edit', 'cancel']);
    assert.equal(f.api.clicks().every(row => row.allowed), true);
    assert.deepEqual(f.dangerous, []);
    assert.deepEqual(Array.from(f.api.requests()), []);
  } finally { f.api.restore(); f.dom.window.close(); }
});

test('the record opener reaches the shipped work writer, reads both months and written subordinate count, then cancels', async () => {
  const work = SECTIONS.find(section => section.id === 'work');
  const supplied = requestsFor(work)[0].request;
  // This editor's 薪资 control is a plain input, not the probe hybrid. The
  // harness digits stay off this request so a present salary fact does not
  // fail-close the other fields.
  assert.equal(supplied.profile.experience[0].salary, '12000');
  const profile = structuredClone(supplied.profile);
  delete profile.experience[0].salary;
  profile.confirmedFields = profile.confirmedFields.filter((path) => path !== 'experience.0.salary');
  const request = { ...supplied, profile };
  const row = request.profile.experience[0];
  const plain = (q, value = '', tag = 'input') => '<div class="el-form-item"><label class="el-form-item__label">'
    + q + '</label><div class="el-form-item__content">' + (tag === 'textarea'
      ? '<textarea>' + value + '</textarea>' : '<input type="text" value="' + value + '">') + '</div></div>';
  // Matching month/cascader controls use the existing work-fill fixture shape.
  // Text fields start empty so this regression must run the real writer.
  const month = value => '<div class="el-date-editor el-date-editor--month"><span class="el-input__prefix">'
    + '<i class="el-input__icon el-icon-date"></i></span><input class="el-input__inner" readonly type="text" value="' + value + '"></div>';
  const cascader = (q, value) => '<div class="el-form-item"><label class="el-form-item__label">' + q
    + '</label><div class="el-form-item__content cascader-wrap"><div class="input-l pointer">'
    + '<div class="input-l pointer el-input"><input class="el-input__inner" readonly type="text" value="' + value + '"></div></div>'
    + '<div class="dialog-wrap plugin-dialog-wrap popover blue" style="display:none"><div class="selected-view-outer">'
    + '<ul class="selected-view-data"><li><p>' + value + '</p><i></i></li></ul><div class="selected-counter"><p>(1/5)</p></div></div>'
    + '<div class="search-outer"><input class="search-input" placeholder="请输入关键字"></div>'
    + '<div class="eo-cascader-panel"><div class="eo-cascader-menu simple-tree-outer"><ul class="simple-tree-wrapper"></ul></div></div>'
    + '<div class="pop-foot"><a class="confirm pop-btn">确定</a><a class="cancel pop-btn">取消</a></div></div></div></div>';
  const editorItems = [
    plain('职位名称'), cascader('职位类别', '银行'), plain('公司名称', row.organization),
    '<div class="el-form-item"><label class="el-form-item__label">任职时间</label><div class="el-form-item__content">'
      + month(row.startDate) + month(row.endDate) + '</div></div>',
    plain('工作地区', row.workArea), plain('职责与业绩', row.description, 'textarea'),
    cascader('公司所属行业', '证券/投资/基金/信托'), plain('公司介绍', row.companyIntro, 'textarea'),
    plain('所属部门', row.department), plain('汇报对象', row.reportTo), plain('下属人数'),
    plain('薪资'), plain('离职原因', row.leaveReason, 'textarea')
  ].join('');
  const f = boot({ editorItems, delayedItems: true });
  try {
    f.window.eval(chromeShimExpression());
    for (const file of ['gth-open-fill.js', 'gth-work-fill.js']) {
      f.window.eval(readFileSync(new URL('../src/content/' + file, import.meta.url), 'utf8'));
    }
    assert.equal((await f.api.open(3)).ok, true);
    const fill = await f.window.ResumeGthWorkOpen.trial(request);
    assert.equal(fill.ok, true, JSON.stringify(fill));
    assert.equal(fill.writeStarted, true);
    assert.equal(fill.liveSupportClaimed, false);
    assert.equal(fill.softwareClickedSave, false);
    assert.equal(fill.softwareClickedSubmit, false);
    assert.equal(fill.softwareClickedDelete, false);
    assert.equal(fill.fields.find(field => field.question === '职位名称').reason, 'readback_matched');
    assert.equal(fill.fields.find(field => field.question === '下属人数').reason, 'readback_matched');
    const read = f.api.read(3, work.questions);
    assert.equal(read.readback.find(field => field.q === '职位名称').value, row.position);
    assert.equal(read.readback.find(field => field.q === '下属人数').value, '5');
    const dates = read.readback.find(field => field.q === '任职时间');
    assert.equal(dates.startMonth, '2020-03');
    assert.equal(dates.endMonth, '2024-08');
    assert.equal((await f.api.cancel(3)).closed, true);
    assert.equal(f.api.state().editorFormCount, 0);
    assert.equal(f.section.querySelectorAll('.sec-context > .sec-detail').length, 1);
    assert.equal(f.api.clicks().every(click => click.allowed), true);
    assert.deepEqual(f.dangerous, []);
  } finally {
    f.window.__gthFullResumeChromeRestore?.();
    f.api.restore();
    f.dom.window.close();
  }
});

test('an empty work card uses its unique 添加 or 新增 and discards without creating a record', async () => {
  for (const titleAction of ['添加', '新增']) {
    const f = boot({ records: 0, titleAction });
    try {
      const result = await f.api.open(3);
      assert.equal(result.ok, true, titleAction);
      assert.equal(result.action, 'click_add');
      assert.equal(result.opener, 'title_add');
      assert.equal((await f.api.cancel(3)).closed, true);
      assert.equal(f.section.querySelectorAll('.sec-context > .sec-detail').length, 0);
      assert.deepEqual(Array.from(f.api.clicks(), row => row.kind), ['add', 'cancel']);
      assert.deepEqual(f.dangerous, []);
    } finally { f.api.restore(); f.dom.window.close(); }
  }
});

test('work retains the section probe single-record title 编辑 fallback', async () => {
  const f = boot({ recordEdits: false, titleAction: '编辑' });
  try {
    const result = await f.api.open(3);
    assert.equal(result.ok, true);
    assert.equal(result.opener, 'title_edit');
    assert.deepEqual(f.opened, [null]);
    assert.equal((await f.api.cancel(3)).closed, true);
    assert.equal(f.section.querySelectorAll('.sec-context > .sec-detail').length, 1);
  } finally { f.api.restore(); f.dom.window.close(); }
});

test('missing, hidden, duplicate, disabled, navigating and delete-shaped work edits fail before clicking', async () => {
  const mutations = [
    f => f.recordLinks[0].remove(),
    f => { f.recordLinks[0].style.display = 'none'; },
    f => f.entries[0].insertAdjacentHTML('beforeend', editAnchor),
    f => f.recordLinks[0].setAttribute('disabled', ''),
    f => f.entries[0].setAttribute('aria-disabled', 'true'),
    f => f.recordLinks[0].classList.add('is-disabled'),
    f => f.recordLinks[0].setAttribute('formaction', '/save'),
    f => f.recordLinks[0].setAttribute('href', '/resume/edit/other'),
    f => f.recordLinks[0].setAttribute('aria-label', '保存'),
    f => f.recordLinks[0].classList.add('eduexp-opt-icon'),
    f => f.recordLinks[0].insertAdjacentHTML('beforeend', '<i class="el-icon-delete"></i>'),
    f => f.recordLinks[0].setAttribute('url', '/api/resume/delete.json'),
    f => {
      const foreign = f.doc.createElement('form');
      f.section.replaceWith(foreign);
      foreign.append(f.section);
    },
    f => { f.recordLinks[0].textContent = '确定'; }
  ];
  for (const mutate of mutations) {
    const f = boot();
    try {
      mutate(f);
      const result = await f.api.open(3);
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'control_not_supported');
      assert.deepEqual(f.opened, []);
      assert.equal(f.api.clicks().length, 0);
      assert.equal(f.api.state().editorFormCount, 0);
      assert.deepEqual(f.dangerous, []);
    } finally { f.api.restore(); f.dom.window.close(); }
  }
});

test('work opener does not fall through to another record or a title action', async () => {
  for (const mutate of [
    f => f.recordLinks[0].remove(),
    f => { f.recordLinks[0].style.display = 'none'; },
    f => f.recordLinks[0].setAttribute('href', '/elsewhere')
  ]) {
    const f = boot({ records: 2, titleAction: '编辑' });
    try {
      mutate(f);
      assert.equal((await f.api.open(3)).ok, false);
      assert.deepEqual(f.opened, []);
      assert.equal(f.api.clicks().length, 0);
    } finally { f.api.restore(); f.dom.window.close(); }
  }
});

test('work retains page readiness, exact section order, visibility and foreign-editor checks', async () => {
  for (const [mutate, reason] of [
    [f => Object.defineProperty(f.doc, 'visibilityState', { value: 'hidden' }), 'page_hidden'],
    [f => Object.defineProperty(f.doc, 'readyState', { value: 'loading' }), 'page_not_ready'],
    [f => { f.sections[2].querySelector('.title_').textContent = '其它分区'; }, 'section_structure_changed'],
    [f => f.sections[0].insertAdjacentHTML('beforeend', '<form class="el-form sec-form"></form>'), 'other_section_editor_open']
  ]) {
    const f = boot();
    try {
      mutate(f);
      assert.equal((await f.api.open(3)).reason, reason);
      assert.equal(f.api.clicks().length, 0);
      assert.deepEqual(f.opened, []);
    } finally { f.api.restore(); f.dom.window.close(); }
  }
});

test('the work guard permits only the selected opener while the work card has no editor', async () => {
  const f = boot({ records: 2 });
  try {
    assert.equal(f.api.activate(3).ok, true);
    for (const control of [f.titleLink, f.recordLinks[1], f.section.querySelector('.eduexp-opt-icon')]) {
      assert.throws(() => control.click(), /refusing_forbidden_click/);
    }
    assert.deepEqual(f.opened, []);
    assert.deepEqual(f.dangerous, []);
    assert.equal((await f.api.open(3)).ok, true);
    assert.throws(() => f.recordLinks[1].click(), /refusing_forbidden_click/);
    assert.throws(() => f.section.querySelectorAll('form button')[1].click(), /refusing_forbidden_click/);
    assert.equal((await f.api.cancel(3)).closed, true);
    assert.deepEqual(f.opened, [0]);
    assert.deepEqual(f.dangerous, []);
  } finally { f.api.restore(); f.dom.window.close(); }
});
