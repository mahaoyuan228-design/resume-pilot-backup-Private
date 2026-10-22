/**
 * Synthetic offline interactions for the shipped education writer. Markup is
 * based on its existing selectors and the work/intent unit fixtures, not a new
 * live DOM capture. These tests never connect to a browser or claim live support.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../src/content/gth-education.js', import.meta.url), 'utf8');
const TITLES = ['基本信息', '教育经历', '求职意向', '工作经验', '职业技能与特长', '附件简历', '其他信息'];
const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const BINDING = { version: 1, epoch: '00000000-0000-4000-8000-000000000001', profileHash: 'a'.repeat(64) };

const item = (label, content, id = '') => `<div class="el-form-item" id="${id}"><label class="el-form-item__label">${label}</label><div class="el-form-item__content">${content}</div></div>`;
const month = (id, value) => `<div class="el-date-editor el-date-editor--month"><span class="el-input__prefix"><i class="el-input__icon el-icon-date" id="${id}-icon"></i></span><input id="${id}" type="text" readonly value="${value || ''}"></div>`;

function fixture(options = {}) {
  const category = `<div class="cascader-wrap"><div class="input-l pointer" id="category-trigger"><input type="text" readonly id="category" value="${options.category || ''}"></div>
    <div class="popover plugin-dialog-wrap" id="category-popup" style="display:none">
      <input class="search-input" type="text">
      <ul class="selected-view-data"></ul>
      <div class="dialog-search-wrap"><div class="eo-cascader-menu simple-tree-outer"><ul class="simple-tree-wrapper"></ul></div></div>
      <a class="pop-btn confirm" id="category-confirm" href="${options.confirmHref || 'javascript:;'}">${options.confirmText || '确定'}</a>
    </div></div>`;
  const fields = [
    ...[['毕业学校', 'school'], ['专业名称', 'major'], ['在校成绩排名', 'rank'], ['绩点', 'gpa'], ['学校所在地', 'location']]
      .map(([label, id]) => item(label, `<input type="text" id="${id}">`)),
    item('在校活动/职务', '<textarea id="activities"></textarea>'),
    item('专业描述', '<textarea id="description"></textarea>'),
    item('学历', `<div class="el-select"><input type="text" id="degree" value="${options.degree || ''}" ${options.lockedDegree ? 'disabled readonly' : ''}></div>`),
    item('是否统招', '<div class="el-radio-group"><label class="el-radio"><input type="radio" name="unified" value="是"><span class="el-radio__label">是</span></label><label class="el-radio"><input type="radio" name="unified" value="否"><span class="el-radio__label">否</span></label></div>'),
    item('在校时间', month('start', options.start) + month('end', options.end), 'dates'),
    item('专业类别', options.unknownCategory ? '<div class="unknown-category"></div>' : category)
  ].join('');
  const html = TITLES.map(title => `<section class="r-section"><div class="title_">${title}</div>${title === '教育经历' ? `<form id="education" data-resume-gth-education-record-index="0">${fields}<button type="button" id="cancel">取消</button><button type="button" id="save">保存</button></form><div class="sec-context"></div>` : ''}</section>`).join('');
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, {
    url: 'https://hr.gtht.com/resume/edit/', pretendToBeVisual: true, runScripts: 'dangerously'
  });
  const { window } = dom;
  const { document } = window;
  window.Element.prototype.getClientRects = function () {
    for (let node = this; node?.nodeType === 1; node = node.parentElement) {
      if (node.style.display === 'none' || node.style.visibility === 'hidden') return [];
    }
    return [{ width: 8, height: 8 }];
  };
  Object.defineProperty(document, 'readyState', { get: () => 'complete' });
  Object.defineProperty(document, 'visibilityState', { get: () => 'visible' });
  window.chrome = { runtime: {
    sendMessage: async message => ({ allowed: message.type === 'RESUME_PROFILE_BINDING_CHECK' }),
    onMessage: { addListener() {}, removeListener() {} }
  } };
  const clicks = [];
  const originalClick = window.HTMLElement.prototype.click;
  window.HTMLElement.prototype.click = function () { clicks.push(this); return originalClick.call(this); };
  let saveCount = 0;
  document.getElementById('save').addEventListener('click', () => { saveCount += 1; });
  document.getElementById('cancel').addEventListener('click', () => document.getElementById('education').remove());

  document.body.insertAdjacentHTML('beforeend', '<div class="el-select-dropdown" id="degree-popup" style="display:none"><ul><li class="el-select-dropdown__item">本科</li><li class="el-select-dropdown__item">硕士</li></ul></div>');
  const degreePopup = document.getElementById('degree-popup');
  if (options.duplicateDegree) degreePopup.querySelector('ul').insertAdjacentHTML('beforeend', '<li class="el-select-dropdown__item">本科</li>');
  document.getElementById('degree').addEventListener('click', () => { degreePopup.style.display = degreePopup.style.display === 'none' ? 'block' : 'none'; });
  for (const choice of degreePopup.querySelectorAll('li')) choice.addEventListener('click', () => {
    document.getElementById('degree').value = choice.textContent;
    degreePopup.style.display = 'none';
  });

  document.body.insertAdjacentHTML('beforeend', `<div class="el-picker-panel el-date-picker" id="month-popup" style="display:none"><div class="el-date-picker__header"><i class="el-icon-d-arrow-left"></i><span class="el-date-picker__header-label">2024 年</span><i class="el-icon-d-arrow-right"></i></div><table class="el-month-table"><tbody><tr>${MONTHS.map(name => `<td><div><a class="cell">${name}</a></div></td>`).join('')}</tr></tbody></table></div>`);
  const monthPopup = document.getElementById('month-popup');
  const year = monthPopup.querySelector('.el-date-picker__header-label');
  const monthPicks = [];
  let activeMonth;
  for (const id of ['start', 'end']) {
    document.getElementById(`${id}-icon`).addEventListener('click', () => {
      activeMonth = document.getElementById(id);
      monthPopup.style.display = 'block';
    });
  }
  for (const [selector, step] of [['.el-icon-d-arrow-left', -1], ['.el-icon-d-arrow-right', 1]]) {
    monthPopup.querySelector(selector).addEventListener('click', () => { year.textContent = `${Number(year.textContent.match(/\d{4}/u)[0]) + step} 年`; });
  }
  for (const [index, cell] of [...monthPopup.querySelectorAll('td')].entries()) {
    cell.addEventListener('click', () => {
      activeMonth.value = `${year.textContent.match(/\d{4}/u)[0]}-${String(index + 1).padStart(2, '0')}`;
      monthPicks.push(activeMonth.id);
      monthPopup.style.display = 'none';
      if (options.requiredDatePair) {
        const dates = document.getElementById('dates');
        dates.querySelector('.el-form-item__error')?.remove();
        const incomplete = !document.getElementById('start').value || !document.getElementById('end').value;
        dates.classList.toggle('is-error', incomplete);
        if (incomplete) dates.insertAdjacentHTML('beforeend', '<div class="el-form-item__error">请选择在校时间</div>');
      }
    });
  }
  document.addEventListener('keydown', event => { if (event.key === 'Escape') monthPopup.style.display = 'none'; });

  if (!options.unknownCategory) {
    const popup = document.getElementById('category-popup');
    const selected = popup.querySelector('.selected-view-data');
    document.getElementById('category-trigger').addEventListener('click', () => { popup.style.display = popup.style.display === 'none' ? 'block' : 'none'; });
    popup.querySelector('.search-input').addEventListener('input', () => {
      const rows = popup.querySelector('.simple-tree-wrapper');
      rows.innerHTML = '<li class="branch"><label><input type="checkbox" uid="finance"><span uid="finance">金融学</span></label></li>';
      rows.querySelector('input').addEventListener('click', () => {
        selected.innerHTML = `<li uid="${options.wrongSelectedUid ? 'different-leaf' : 'finance'}">金融学</li>`;
        if (options.categorySingle) {
          document.getElementById('category').value = '金融学';
          popup.style.display = 'none';
        }
      });
    });
    document.getElementById('category-confirm').addEventListener('click', event => {
      event.preventDefault();
      document.getElementById('category').value = '金融学';
      popup.style.display = 'none';
    });
  }
  window.eval(source);
  return { dom, window, document, clicks, monthPicks, saveCount: () => saveCount,
    run: (values, extra = {}) => window.ResumeGthEducationTextTrial.fullTrial({
      requestId: 'offline-education-complex', targetMode: 'existing', rowIndex: 0,
      profileIndex: 0, replaceExisting: true, profileBinding: BINDING,
      educationCandidates: [{ profileIndex: 0, ...values,
        confirmedPaths: Object.keys(values).map(key => `education.0.${key}`) }], ...extra
    }) };
}

test('complex education uses select, radio, month cells and category leaf with exact readback', async t => {
  const page = fixture({ requiredDatePair: true }); t.after(() => page.dom.window.close());
  const result = await page.run({ degree: '本科', unifiedAdmissions: '是', startDate: '2020-09', endDate: '2024-06', majorCategory: '金融学' });
  assert.equal(result.ok, true, result.reason);
  for (const question of ['学历', '是否统招', '在校时间（开始）', '在校时间（结束）', '专业类别']) {
    assert.equal(result.fields.find(row => row.question === question)?.status, 'verified', question);
  }
  assert.equal(page.document.getElementById('degree').value, '本科');
  assert.equal(page.document.querySelector('input[value="是"]').checked, true);
  assert.equal(page.document.getElementById('start').value, '2020-09');
  assert.equal(page.document.getElementById('end').value, '2024-06');
  assert.equal(page.document.getElementById('category').value, '金融学');
  assert.deepEqual(page.monthPicks, ['start', 'end']);
  assert.equal(result.softwareClickedSave, false);
  assert.equal(page.saveCount(), 0);
});

test('moving an existing date range later picks the end before the start', async t => {
  const page = fixture({ start: '2016-09', end: '2020-06' }); t.after(() => page.dom.window.close());
  const result = await page.run({ startDate: '2021-09', endDate: '2024-06' });
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(page.monthPicks, ['end', 'start']);
});

test('unconfirmed date half is skipped and cannot become a verified range', async t => {
  const page = fixture(); t.after(() => page.dom.window.close());
  const result = await page.run({ startDate: '2020-09' });
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(page.monthPicks, []);
  assert.equal(result.fields.find(row => row.question === '在校时间（开始）').reason, 'incomplete_date_pair');
});

test('locked degree conflict stops before any applicant value is written', async t => {
  const page = fixture({ lockedDegree: true, degree: '硕士' }); t.after(() => page.dom.window.close());
  const result = await page.run({ school: '复旦大学', degree: '本科', unifiedAdmissions: '是' });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'locked_degree_conflict');
  assert.equal(result.writeStarted, false);
  assert.equal(page.document.getElementById('school').value, '');
  assert.equal(page.clicks.length, 0);
});

test('duplicate degree option fails closed without choosing either duplicate', async t => {
  const page = fixture({ duplicateDegree: true }); t.after(() => page.dom.window.close());
  const result = await page.run({ degree: '本科' });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'education_option_ambiguous');
  assert.equal(page.document.getElementById('degree').value, '');
  assert.equal(page.clicks.some(node => node.matches('.el-select-dropdown__item')), false);
});

test('unknown category shape records a skip without a synthetic selection', async t => {
  const page = fixture({ unknownCategory: true }); t.after(() => page.dom.window.close());
  const result = await page.run({ majorCategory: '金融学', unifiedAdmissions: '是' });
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.fields.find(row => row.question === '专业类别').reason, 'education_category_structure_changed');
  assert.equal(result.fields.find(row => row.question === '是否统招').status, 'verified');
  assert.equal(page.saveCount(), 0);
});

for (const [name, options] of [
  ['a mismatched selected UID', { wrongSelectedUid: true }],
  ['a save-labelled confirmation anchor', { confirmText: '保存' }],
  ['a navigable confirmation anchor', { confirmHref: '/resume/save/' }]
]) {
  test(`category refuses ${name}`, async t => {
    const page = fixture(options); t.after(() => page.dom.window.close());
    const result = await page.run({ majorCategory: '金融学' });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'education_category_selection_unknown');
    assert.equal(page.document.getElementById('category').value, '');
    assert.equal(page.clicks.some(node => node.id === 'category-confirm'), false);
    assert.equal(page.saveCount(), 0);
  });
}
