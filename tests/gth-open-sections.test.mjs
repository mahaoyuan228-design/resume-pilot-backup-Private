/**
 * Open-editor GTH fills for 职业技能与特长, 其他信息, and 教育经历.
 * Fixtures follow the 2026-10-20 18:26–18:30 UTC+8 editor: one sec-form,
 * title 编辑 link absent, buttons 取消/保存 never clicked.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { assessGthEducationOpenFill, assessGthOtherFill, assessGthSkillsFill } from '../src/background/gth-open-fills.mjs';

const core = readFileSync(new URL('../src/content/gth-open-fill.js', import.meta.url), 'utf8');
const skillsSource = readFileSync(new URL('../src/content/gth-skills.js', import.meta.url), 'utf8');
const otherSource = readFileSync(new URL('../src/content/gth-other.js', import.meta.url), 'utf8');
const educationSource = readFileSync(new URL('../src/content/gth-education-fill.js', import.meta.url), 'utf8');
const PAGE = 'https://hr.gtht.com/resume/edit/';
const TITLES = ['基本信息', '教育经历', '求职意向', '工作经验', '职业技能与特长', '附件简历', '其他信息'];
const DEGREES = ['请选择', '初中', '高中', '中技', '中专', '大专', '本科', '硕士', 'MBA', '博士', '其他'];
const binding = { version: 1, epoch: '00000000-0000-4000-8000-000000000001', profileHash: 'a'.repeat(64) };

function customProfile(section, answers) {
  return {
    customAnswers: answers,
    confirmedFields: Object.keys(answers).map((question) => `customAnswers.${question}`),
    customFacts: Object.entries(answers).map(([question, answer]) => ({
      question, answer, sitePageUrl: PAGE, sectionName: section, rowContext: 'none',
    })),
  };
}

function educationProfile(row, index = 0) {
  const keys = Object.keys(row);
  return {
    education: [row],
    confirmedFields: keys.map((key) => `education.${index}.${key}`),
  };
}

function request(profile, extra = {}) {
  return { requestId: '1234567890-open', profileBinding: binding, replaceExisting: false, profile, ...extra };
}

const FORBIDDEN = new Set(['保存', '提交', '投递', '删除', '取消', '编辑']);

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
  vm.runInContext(skillsSource, context);
  vm.runInContext(otherSource, context);
  vm.runInContext(educationSource, context);
  return { dom, clicks, context, listeners };
}

function forbiddenClicks(clicks) {
  return clicks.filter((node) => {
    const text = String(node.textContent || '').replace(/[\s\u00a0]+/gu, ' ').trim();
    return FORBIDDEN.has(text) || node.matches?.('a.eduexp-opt-icon, .el-icon-delete, button')
      || !!node.closest?.('a.eduexp-opt-icon, .el-icon-delete, button');
  });
}

function shell(name, body, { edit = false, foreign = false, extra = '' } = {}) {
  return TITLES.map((title) => {
    if (title === name) {
      const link = edit ? '<a class="h-e-btn" id="edit" href="javascript:;">编辑</a>' : '';
      return `<section class="r-section"><div class="title_">${title}${link}</div>${body}${extra}</section>`;
    }
    if (foreign && title === '基本信息') {
      return `<section class="r-section"><div class="title_">${title}</div><form class="el-form sec-form" id="foreign"></form></section>`;
    }
    return `<section class="r-section"><div class="title_">${title}</div></section>`;
  }).join('');
}

function formWrap(inner, id = 'editor') {
  return `<form class="el-form sec-form" id="${id}">${inner}
    <button type="button" id="${id}-cancel">取消</button>
    <button type="button" id="${id}-save">保存</button>
  </form>
  <a class="eduexp-opt-icon" id="${id}-delete" href="javascript:;"><i class="el-icon-delete">删除</i></a>`;
}

function textItem(label, { tag = 'input', value = '', max = '', placeholder = '', id = '' } = {}) {
  const attrs = `${id ? ` id="${id}"` : ''}${value ? ` value="${value}"` : ''}${max ? ` maxlength="${max}"` : ''}${placeholder ? ` placeholder="${placeholder}"` : ''}`;
  const control = tag === 'textarea'
    ? `<textarea${attrs}>${value}</textarea>`
    : `<input type="text"${attrs}>`;
  return `<div class="el-form-item"><label class="el-form-item__label">${label}</label><div class="el-form-item__content">${control}</div></div>`;
}

function degreeMenu(id = 'degree-menu') {
  return `<div class="el-select-dropdown el-popper" id="${id}" style="display:none"><ul class="el-select-dropdown__list">${
    DEGREES.map((text) => `<li class="el-select-dropdown__item">${text}</li>`).join('')
  }</ul></div>`;
}

function degreeItem(value = '') {
  return `<div class="el-form-item" id="degree-item"><label class="el-form-item__label">学历</label><div class="el-form-item__content"><div class="el-select select-l"><div class="el-input"><input class="el-input__inner" id="degree" readonly type="text" value="${value}"></div>${degreeMenu()}</div></div></div>`;
}

function radioItem(checked = '') {
  const box = (text) => `<label class="el-radio"><span class="el-radio__input"><input type="radio" name="unified" value="${text}"${checked === text ? ' checked' : ''}></span><span class="el-radio__label">${text}</span></label>`;
  return `<div class="el-form-item"><label class="el-form-item__label">是否统招</label><div class="el-form-item__content"><div class="el-radio-group">${box('是')}${box('否')}</div></div></div>`;
}

function unknownDateItem() {
  return `<div class="el-form-item"><label class="el-form-item__label">在校时间</label><div class="el-form-item__content"><div class="el-date-editor"><input type="text" readonly value=""></div><div class="el-date-editor"><input type="text" readonly value=""></div></div></div>`;
}

function stubCategoryItem() {
  return `<div class="el-form-item"><label class="el-form-item__label">专业类别</label><div class="el-form-item__content"><div class="input-l pointer"><input class="el-input__inner" readonly type="text" value=""></div></div></div>`;
}

function unsupportedItems() {
  return `${unknownDateItem()}${stubCategoryItem()}`;
}

function educationFields({ school = '', major = '', rank = '', degree = '', radio = '', activities = '', description = '', gpa = '', location = '', dates = '', category = '' } = {}) {
  return [
    textItem('毕业学校', { value: school, id: 'school' }),
    textItem('专业名称', { value: major, id: 'major' }),
    textItem('在校活动/职务', { tag: 'textarea', value: activities, id: 'activities' }),
    textItem('在校成绩排名', { value: rank, id: 'rank', placeholder: '格式：排名/班级人数' }),
    textItem('专业描述', { tag: 'textarea', value: description, id: 'description' }),
    textItem('绩点', { value: gpa, id: 'gpa' }),
    textItem('学校所在地', { value: location, id: 'location' }),
    degreeItem(degree),
    radioItem(radio),
    dates || unknownDateItem(),
    category || stubCategoryItem(),
  ].join('');
}

function wireDegree(document, { body = false } = {}) {
  const input = document.getElementById('degree');
  const menu = document.getElementById('degree-menu');
  if (body) document.body.appendChild(menu);
  input.addEventListener('click', () => {
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  });
  for (const option of menu.querySelectorAll('li')) {
    option.addEventListener('click', () => {
      input.value = option.textContent.trim();
      menu.style.display = 'none';
    });
  }
}

function wireRadio(document) {
  for (const label of document.querySelectorAll('label.el-radio')) {
    label.addEventListener('click', () => {
      for (const box of document.querySelectorAll('input[type="radio"]')) box.checked = false;
      label.querySelector('input').checked = true;
    });
  }
}

function assertNeverForbidden(clicks) {
  assert.equal(forbiddenClicks(clicks).length, 0);
}

test('reinjecting the open-fill scripts replaces the previous listener', async () => {
  const html = shell('职业技能与特长', formWrap(textItem('职业技能与特长', { tag: 'textarea', max: '4000', id: 'skills' })));
  const { clicks, context, listeners } = boot(html);
  const before = listeners.size;
  vm.runInContext(core, context);
  vm.runInContext(skillsSource, context);
  vm.runInContext(otherSource, context);
  vm.runInContext(educationSource, context);
  assert.equal(listeners.size, before);
  const profile = customProfile('职业技能与特长', { 职业技能与特长: 'Python' });
  const message = { type: 'GTH_SKILLS_FILL', ...request(profile) };
  const replies = [];
  for (const listener of listeners) {
    listener(message, { id: 'synthetic-extension' }, (payload) => replies.push(payload));
  }
  const deadline = Date.now() + 2000;
  while (replies.length < 1 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(replies.length, 1);
  assert.equal(replies[0].ok, true);
  assert.equal(replies[0].fields[0].reason, 'readback_matched');
  assertNeverForbidden(clicks);
});

test('skills writes the textarea, dispatches input and change, and never clicks save or delete', async () => {
  const html = shell('职业技能与特长', formWrap(textItem('职业技能与特长', { tag: 'textarea', max: '4000', id: 'skills' })));
  const { dom, clicks, context } = boot(html);
  const area = dom.window.document.getElementById('skills');
  const events = [];
  area.addEventListener('input', () => events.push('input'));
  area.addEventListener('change', () => events.push('change'));
  const profile = customProfile('职业技能与特长', { 职业技能与特长: 'Python\nSQL' });
  const result = await context.ResumeGthSkills.trial(request(profile));
  assert.equal(area.value, 'Python\nSQL');
  assert.deepEqual(events, ['input', 'change']);
  assert.equal(result.ok, true);
  assert.equal(result.writeStarted, true);
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.complete, false);
  assert.equal(result.fields[0].status, 'verified');
  assert.equal(result.fields[0].reason, 'readback_matched');
  assert.equal(assessGthSkillsFill(result).ok, true);
  assertNeverForbidden(clicks);
});

test('skills same-value does not write, and an over-long value fails closed', async () => {
  const same = boot(shell('职业技能与特长', formWrap(textItem('职业技能与特长', { tag: 'textarea', value: 'Python', max: '4000', id: 'skills' }))));
  const kept = await same.context.ResumeGthSkills.trial(request(customProfile('职业技能与特长', { 职业技能与特长: 'Python' })));
  assert.equal(same.dom.window.document.getElementById('skills').value, 'Python');
  assert.equal(kept.writeStarted, false);
  assert.equal(kept.fields[0].reason, 'preexisting_same_value');
  assertNeverForbidden(same.clicks);

  const long = boot(shell('职业技能与特长', formWrap(textItem('职业技能与特长', { tag: 'textarea', max: '4000', id: 'skills' }))));
  const blocked = await long.context.ResumeGthSkills.trial(request(customProfile('职业技能与特长', { 职业技能与特长: 'x'.repeat(4001) })));
  assert.equal(long.dom.window.document.getElementById('skills').value, '');
  assert.equal(blocked.ok, false);
  assert.equal(blocked.writeStarted, false);
  assert.equal(blocked.reason, 'value_too_long');
  assert.equal(blocked.fields[0].reason, 'value_too_long');
  assert.equal(assessGthSkillsFill(blocked).ok, false);
  assertNeverForbidden(long.clicks);
});

test('skills missing label, duplicate label, and two open forms fail closed before write', async () => {
  const missing = boot(shell('职业技能与特长', formWrap('<div class="el-form-item"><textarea id="skills"></textarea></div>')));
  const missingResult = await missing.context.ResumeGthSkills.trial(request(customProfile('职业技能与特长', { 职业技能与特长: 'Python' })));
  assert.equal(missing.dom.window.document.getElementById('skills').value, '');
  assert.equal(missingResult.reason, 'label_missing');
  assert.equal(missingResult.fields[0].reason, 'label_missing');
  assert.equal(missingResult.writeStarted, false);
  assertNeverForbidden(missing.clicks);

  const duplicate = boot(shell('职业技能与特长', formWrap(`${textItem('职业技能与特长', { tag: 'textarea', id: 'skills' })}${textItem('职业技能与特长', { tag: 'textarea', id: 'skills-2' })}`)));
  const duplicateResult = await duplicate.context.ResumeGthSkills.trial(request(customProfile('职业技能与特长', { 职业技能与特长: 'Python' })));
  assert.equal(duplicateResult.reason, 'label_ambiguous');
  assert.equal(duplicate.dom.window.document.getElementById('skills').value, '');
  assertNeverForbidden(duplicate.clicks);

  const two = boot(shell('职业技能与特长', `${formWrap(textItem('职业技能与特长', { tag: 'textarea', id: 'skills' }))}${formWrap(textItem('职业技能与特长', { tag: 'textarea', id: 'skills-b' }), 'editor-b')}`));
  const twoResult = await two.context.ResumeGthSkills.trial(request(customProfile('职业技能与特长', { 职业技能与特长: 'Python' })));
  assert.equal(twoResult.reason, 'editor_not_unique');
  assert.equal(twoResult.writeStarted, false);
  assert.equal(twoResult.fields[0].reason, 'not_run');
  assert.equal(two.dom.window.document.getElementById('skills').value, '');
  assertNeverForbidden(two.clicks);
});

test('other info writes 标题 and 描述 and leaves a different existing value untouched', async () => {
  const html = shell('其他信息', formWrap(`${textItem('标题', { id: 'title' })}${textItem('描述', { tag: 'textarea', id: 'desc' })}`));
  const { dom, clicks, context } = boot(html);
  const profile = customProfile('其他信息', { 标题: '开源贡献', 描述: '维护过一个小工具' });
  const result = await context.ResumeGthOther.trial(request(profile));
  assert.equal(dom.window.document.getElementById('title').value, '开源贡献');
  assert.equal(dom.window.document.getElementById('desc').value, '维护过一个小工具');
  assert.equal(result.ok, true);
  assert.deepEqual([...result.fields.map((row) => row.question)], ['标题', '描述']);
  assert.equal(assessGthOtherFill(result).ok, true);
  assertNeverForbidden(clicks);

  const kept = boot(shell('其他信息', formWrap(`${textItem('标题', { id: 'title', value: '旧标题' })}${textItem('描述', { tag: 'textarea', id: 'desc' })}`)));
  const blocked = await kept.context.ResumeGthOther.trial(request(profile));
  assert.equal(kept.dom.window.document.getElementById('title').value, '旧标题');
  assert.equal(kept.dom.window.document.getElementById('desc').value, '');
  assert.equal(blocked.writeStarted, false);
  assert.equal(blocked.fields.find((row) => row.question === '标题').reason, 'existing_value');
  assert.equal(blocked.fields.find((row) => row.question === '描述').reason, 'blocked_by_unsettled_field');
  assertNeverForbidden(kept.clicks);
});

test('education open editor writes plain fields, radio, and el-select, including a body dropdown', async () => {
  const row = {
    school: '示例大学', major: '计算机', campusActivities: '社团', gradeRank: '1/40',
    majorDescription: '系统', gpa: '3.8', schoolLocation: '上海', degree: '本科', unifiedAdmissions: '是',
  };
  const html = shell('教育经历', formWrap(educationFields()));
  const { dom, clicks, context } = boot(html);
  wireDegree(dom.window.document);
  wireRadio(dom.window.document);
  const result = await context.ResumeGthEducationOpen.trial(request(educationProfile(row), { profileIndex: 0 }));
  const doc = dom.window.document;
  assert.equal(doc.getElementById('school').value, '示例大学');
  assert.equal(doc.getElementById('major').value, '计算机');
  assert.equal(doc.getElementById('rank').value, '1/40');
  assert.equal(doc.getElementById('degree').value, '本科');
  assert.equal(doc.querySelector('input[value="是"]').checked, true);
  assert.equal(result.ok, true);
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.fields.some((field) => field.question === '在校时间'), false);
  assert.equal(result.coverage.find((field) => field.question === '在校时间').reason, 'control_not_supported');
  assert.equal(result.coverage.find((field) => field.question === '专业类别').reason, 'not_run');
  assert.equal(assessGthEducationOpenFill(result).ok, true);
  assertNeverForbidden(clicks);

  const body = boot(shell('教育经历', formWrap(educationFields())));
  wireDegree(body.dom.window.document, { body: true });
  wireRadio(body.dom.window.document);
  assert.equal(body.dom.window.document.body.contains(body.dom.window.document.getElementById('degree-menu')), true);
  const moved = await body.context.ResumeGthEducationOpen.trial(request(educationProfile({ ...row, degree: '硕士' }), { profileIndex: 0 }));
  assert.equal(body.dom.window.document.getElementById('degree').value, '硕士');
  assert.equal(moved.fields.find((field) => field.question === '学历').reason, 'readback_matched');
  assertNeverForbidden(body.clicks);
});

test('education same-value select does not open, rank is not reformatted, and unsupported values fail closed', async () => {
  const row = { school: '示例大学', major: '计算机', gradeRank: '第1名', degree: '本科', unifiedAdmissions: '是' };
  const html = shell('教育经历', formWrap(educationFields({ school: '示例大学', major: '计算机', rank: '第1名', degree: '本科', radio: '是' })));
  const same = boot(html);
  wireDegree(same.dom.window.document);
  wireRadio(same.dom.window.document);
  let opened = 0;
  same.dom.window.document.getElementById('degree').addEventListener('click', () => { opened += 1; });
  const result = await same.context.ResumeGthEducationOpen.trial(request(educationProfile(row), { profileIndex: 0 }));
  assert.equal(result.ok, true);
  assert.equal(result.writeStarted, false);
  assert.equal(opened, 0);
  assert.equal(same.dom.window.document.getElementById('rank').value, '第1名');
  assert.equal(result.fields.every((field) => field.reason === 'preexisting_same_value'), true);
  assertNeverForbidden(same.clicks);

  const dated = boot(shell('教育经历', formWrap(educationFields())));
  wireDegree(dated.dom.window.document);
  wireRadio(dated.dom.window.document);
  const blocked = await dated.context.ResumeGthEducationOpen.trial(request(educationProfile({
    ...row, startDate: '2018-09', endDate: '2022-06',
  }), { profileIndex: 0 }));
  assert.equal(blocked.ok, false);
  assert.equal(blocked.writeStarted, false);
  assert.equal(blocked.reason, 'control_not_supported');
  assert.equal(blocked.selectorStep, 'month_range_structure_unknown');
  assert.equal(dated.dom.window.document.getElementById('school').value, '');
  assert.equal(blocked.fields.find((field) => field.question === '在校时间').reason, 'control_not_supported');
  assert.equal(blocked.fields.find((field) => field.question === '毕业学校').reason, 'blocked_by_unsettled_field');
  assertNeverForbidden(dated.clicks);
});

test('education replaceExisting rewrites text, and a title edit link or second form does not get clicked', async () => {
  const row = { school: '新学校', major: '物理', degree: '硕士', unifiedAdmissions: '否' };
  const html = shell('教育经历', formWrap(educationFields({ school: '旧学校', major: '物理', degree: '硕士', radio: '否' })));
  const { dom, clicks, context } = boot(html);
  wireDegree(dom.window.document);
  wireRadio(dom.window.document);
  const result = await context.ResumeGthEducationOpen.trial(request(educationProfile(row), { profileIndex: 0, replaceExisting: true }));
  assert.equal(dom.window.document.getElementById('school').value, '新学校');
  assert.equal(result.fields.find((field) => field.question === '毕业学校').reason, 'readback_reapplied');
  assert.equal(result.ok, true);
  assertNeverForbidden(clicks);

  const edit = boot(shell('教育经历', formWrap(educationFields()), { edit: true }));
  const editResult = await edit.context.ResumeGthEducationOpen.trial(request(educationProfile(row), { profileIndex: 0 }));
  assert.equal(editResult.reason, 'editor_structure_changed');
  assert.equal(editResult.writeStarted, false);
  assert.equal(edit.clicks.filter((node) => node.id === 'edit').length, 0);
  assertNeverForbidden(edit.clicks);
});

const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

function monthRangeItem(start = '', end = '') {
  const editor = (id, value) => `<div class="el-date-editor date-hl el-input el-input--prefix el-input--suffix el-date-editor--month">
    <span class="el-input__prefix"><i class="el-input__icon el-icon-date" id="${id}-icon"></i></span>
    <input class="el-input__inner" id="${id}" readonly type="text" value="${value}">
  </div>`;
  const cells = MONTH_NAMES.map((name) => `<td><div><a class="cell">${name}</a></div></td>`).join('');
  return `<div class="el-form-item" id="dates-item"><label class="el-form-item__label">在校时间</label><div class="el-form-item__content">
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

function wireMonthRange(document) {
  const panel = document.getElementById('month-panel');
  document.body.appendChild(panel);
  const year = document.getElementById('month-year');
  let active = null;
  const stats = { open: 0, cells: 0, years: 0 };
  const show = (id) => {
    active = document.getElementById(id);
    if (!panel.isConnected) document.body.appendChild(panel);
    panel.style.display = 'block';
    stats.open += 1;
  };
  document.getElementById('start-date-icon').addEventListener('click', () => show('start-date'));
  document.getElementById('end-date-icon').addEventListener('click', () => show('end-date'));
  const shift = (delta) => {
    const current = Number(year.textContent.match(/\d{4}/u)[0]);
    year.textContent = `${current + delta} 年`;
    stats.years += 1;
  };
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
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') panel.style.display = 'none';
  });
  return stats;
}

function armRangeRequiredError(document, { message, sticky = false } = {}) {
  const item = document.getElementById('dates-item');
  const start = document.getElementById('start-date');
  const end = document.getElementById('end-date');
  const content = item.querySelector('.el-form-item__content');
  const phases = [];
  const shownError = () => {
    const node = content.querySelector('.el-form-item__error');
    if (!node) return '';
    const style = document.defaultView.getComputedStyle(node);
    const shown = node.getClientRects().length > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    return shown ? node.textContent : '';
  };
  const apply = () => {
    const startFilled = start.value.trim() !== '';
    const endFilled = end.value.trim() !== '';
    const show = startFilled && (sticky || !endFilled);
    let error = content.querySelector('.el-form-item__error');
    if (show) {
      item.classList.add('is-required', 'is-error');
      if (!error) {
        error = document.createElement('div');
        error.className = 'el-form-item__error';
        content.appendChild(error);
      }
      error.textContent = message;
    } else if (startFilled && endFilled) {
      item.classList.remove('is-error');
      error?.remove();
    }
    phases.push({ start: start.value, end: end.value, classes: item.className, text: shownError() });
  };
  start.addEventListener('input', apply);
  start.addEventListener('change', apply);
  end.addEventListener('input', apply);
  end.addEventListener('change', apply);
  return phases;
}

function sawHalfRangeError(phases, message) {
  return phases.some((row) => row.start !== '' && row.end === ''
    && row.classes.includes('is-required') && row.classes.includes('is-error') && row.text === message);
}

function categoryItem({ value = '', panel = 'path', confirm = true, trigger = 'input' } = {}) {
  const rows = panel === 'single'
    ? '<li class="branch"><span>金融学</span></li><li class="branch"><span>法学</span></li>'
    : '<li class="branch has-child"><span>经济学</span></li><li class="branch"><span>法学</span></li>';
  const foot = confirm
    ? '<a class="confirm pop-btn" id="major-confirm">确定</a><a class="cancel pop-btn" id="major-cancel">取消</a>'
    : '<div class="pop-foot" style="display:none"><a class="confirm pop-btn" id="major-confirm">确定</a><a class="cancel pop-btn" id="major-cancel">取消</a></div>';
  const dialog = panel === 'none' ? '' : `<div class="dialog-wrap plugin-dialog-wrap" id="major-panel" style="display:none"><div class="eo-cascader-panel" id="major-cascader"><div class="eo-cascader-menu simple-tree-outer" id="major-l1"><ul class="simple-tree-wrapper">${rows}</ul></div></div>${foot}</div>`;
  const control = trigger === 'div'
    ? `<div class="input-l pointer" id="major-trigger"><input class="el-input__inner" id="major-value" readonly type="text" value="${value}"></div>`
    : `<input id="major-trigger" class="input-l pointer el-input" readonly type="text" value="${value}">`;
  return `<div class="el-form-item" id="major-item"><label class="el-form-item__label">专业类别</label><div class="el-form-item__content">${control}${dialog}</div></div>`;
}

function wireCategory(document, { revealL2 = true, closeOnLeaf = false } = {}) {
  const trigger = document.getElementById('major-trigger');
  const panel = document.getElementById('major-panel');
  const valueNode = document.getElementById('major-value') || trigger;
  const stats = { open: 0, level1: 0, level2: 0, confirm: 0, cancel: 0 };
  if (!trigger || !panel) return stats;
  let pending = '';
  trigger.addEventListener('click', () => {
    stats.open += 1;
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });
  const armLeaf = (row) => {
    row.addEventListener('click', () => {
      stats.level2 += 1;
      pending = row.querySelector('span')?.textContent.trim() || '';
      if (closeOnLeaf) {
        valueNode.value = pending;
        panel.style.display = 'none';
      }
    });
  };
  panel.querySelector('#major-l1').addEventListener('click', (event) => {
    const parent = event.target.closest('li.branch.has-child');
    if (!parent || !panel.querySelector('#major-l1').contains(parent)) return;
    stats.level1 += 1;
    if (!revealL2 || panel.querySelector('#major-l2')) return;
    const text = parent.querySelector(':scope > span')?.textContent.trim();
    const menu = document.createElement('div');
    menu.className = 'eo-cascader-menu simple-tree-outer';
    menu.id = 'major-l2';
    menu.innerHTML = `<ul class="simple-tree-wrapper"><li class="branch"><span>${text === '经济学' ? '金融学' : ''}</span></li></ul>`;
    panel.querySelector('#major-cascader').appendChild(menu);
    armLeaf(menu.querySelector('li.branch'));
  });
  for (const leaf of panel.querySelectorAll('#major-l1 li.branch:not(.has-child)')) armLeaf(leaf);
  panel.querySelector('#major-confirm')?.addEventListener('click', () => {
    stats.confirm += 1;
    if (pending) valueNode.value = pending;
    panel.style.display = 'none';
  });
  panel.querySelector('#major-cancel')?.addEventListener('click', () => {
    stats.cancel += 1;
    panel.querySelector('#major-l2')?.remove();
    panel.style.display = 'none';
  });
  return stats;
}

function assertNeverSave(clicks) {
  const bad = clicks.filter((node) => {
    const text = String(node.textContent || '').replace(/[\s\u00a0]+/gu, ' ').trim();
    if (node.closest?.('.plugin-dialog-wrap, .el-picker-panel')) return false;
    if (node.matches?.('a.eduexp-opt-icon, .el-icon-delete') || node.closest?.('a.eduexp-opt-icon, .el-icon-delete')) return true;
    if (node.matches?.('button') || node.closest?.('button')) return true;
    return ['保存', '提交', '投递', '删除', '取消', '编辑'].includes(text);
  });
  assert.equal(bad.length, 0);
}

test('在校时间 fills the live dual month editors and 专业类别 confirms an exact path', async () => {
  const row = {
    school: '示例大学', major: '计算机', degree: '本科', unifiedAdmissions: '是',
    startDate: '2025-03', endDate: '2026-07', majorCategory: '经济学||金融学',
  };
  const html = shell('教育经历', formWrap(educationFields({ dates: monthRangeItem(), category: categoryItem() })));
  const { dom, clicks, context } = boot(html);
  const doc = dom.window.document;
  wireDegree(doc);
  wireRadio(doc);
  const months = wireMonthRange(doc);
  const picker = wireCategory(doc);
  const events = [];
  for (const id of ['start-date', 'end-date', 'major-trigger']) {
    const node = doc.getElementById(id);
    node.addEventListener('input', () => events.push(`${id}:input`));
    node.addEventListener('change', () => events.push(`${id}:change`));
  }
  const result = await context.ResumeGthEducationOpen.trial(request(educationProfile(row), { profileIndex: 0 }));
  assert.equal(result.ok, true);
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.complete, false);
  assert.equal(doc.getElementById('start-date').value, '2025-03');
  assert.equal(doc.getElementById('end-date').value, '2026-07');
  assert.equal(doc.getElementById('major-trigger').value, '金融学');
  assert.equal(doc.getElementById('school').value, '示例大学');
  assert.equal(result.fields.find((field) => field.question === '在校时间').reason, 'readback_matched');
  assert.equal(result.fields.find((field) => field.question === '专业类别').reason, 'readback_matched');
  assert.equal(result.fields.find((field) => field.question === '专业类别').supported, true);
  assert.equal(months.open, 2);
  assert.equal(months.cells, 2);
  assert.equal(doc.getElementById('month-panel').parentElement, doc.body);
  assert.equal(doc.getElementById('month-panel').closest('.el-date-editor'), null);
  assert.equal(picker.confirm, 1);
  assert.equal(picker.cancel, 0);
  assert.deepEqual(events, ['start-date:input', 'start-date:change', 'end-date:input', 'end-date:change', 'major-trigger:input', 'major-trigger:change']);
  assert.equal(assessGthEducationOpenFill(result).ok, true);
  assertNeverSave(clicks);
  assert.equal(clicks.filter((node) => node.id === 'editor-save' || node.id === 'editor-delete').length, 0);
});

test('在校时间 continues through the required range error that appears before the end month', async () => {
  const row = {
    school: '示例大学', major: '计算机', degree: '本科', unifiedAdmissions: '是',
    startDate: '2025-03', endDate: '2026-07', majorCategory: '经济学||金融学',
  };
  const html = shell('教育经历', formWrap(educationFields({ dates: monthRangeItem(), category: categoryItem() })));
  const { dom, clicks, context } = boot(html);
  const doc = dom.window.document;
  wireDegree(doc);
  wireRadio(doc);
  const months = wireMonthRange(doc);
  const picker = wireCategory(doc);
  const phases = armRangeRequiredError(doc, { message: '请选择在校时间' });
  const result = await context.ResumeGthEducationOpen.trial(request(educationProfile(row), { profileIndex: 0 }));
  assert.equal(result.ok, true, JSON.stringify({ reason: result.reason, step: result.selectorStep }));
  assert.equal(`${doc.getElementById('start-date').value} | ${doc.getElementById('end-date').value}`, '2025-03 | 2026-07');
  assert.equal(result.fields.find((field) => field.question === '在校时间').reason, 'readback_matched');
  assert.equal(sawHalfRangeError(phases, '请选择在校时间'), true);
  assert.equal(doc.getElementById('dates-item').classList.contains('is-error'), false);
  assert.equal(doc.querySelector('#dates-item .el-form-item__error'), null);
  assert.equal(months.open, 2);
  assert.equal(months.cells, 2);
  assert.equal(doc.getElementById('school').value, '示例大学');
  assert.equal(doc.getElementById('major-trigger').value, '金融学');
  assert.equal(picker.confirm, 1);
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.complete, false);
  assert.equal(assessGthEducationOpenFill(result).ok, true);
  assertNeverSave(clicks);
});

test('在校时间 fails closed when the range error remains after both months', async () => {
  const row = {
    school: '示例大学', major: '计算机', degree: '本科', unifiedAdmissions: '是',
    startDate: '2025-03', endDate: '2026-07', majorCategory: '经济学||金融学',
  };
  const html = shell('教育经历', formWrap(educationFields({ dates: monthRangeItem(), category: categoryItem() })));
  const { dom, clicks, context } = boot(html);
  const doc = dom.window.document;
  wireDegree(doc);
  wireRadio(doc);
  const months = wireMonthRange(doc);
  wireCategory(doc);
  const phases = armRangeRequiredError(doc, { message: '请选择在校时间', sticky: true });
  const result = await context.ResumeGthEducationOpen.trial(request(educationProfile(row), { profileIndex: 0 }));
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'readback_mismatch');
  assert.equal(result.fields.find((field) => field.question === '在校时间').status, 'failed');
  assert.equal(result.fields.find((field) => field.question === '在校时间').reason, 'readback_mismatch');
  assert.equal(`${doc.getElementById('start-date').value} | ${doc.getElementById('end-date').value}`, '2025-03 | 2026-07');
  assert.equal(sawHalfRangeError(phases, '请选择在校时间'), true);
  assert.equal(doc.getElementById('dates-item').classList.contains('is-error'), true);
  assert.equal(doc.getElementById('dates-item').classList.contains('is-required'), true);
  assert.equal(doc.querySelector('#dates-item .el-form-item__error').textContent, '请选择在校时间');
  assert.equal(months.open, 2);
  assert.equal(months.cells, 2);
  assert.equal(result.fields.find((field) => field.question === '毕业学校').reason, 'not_run');
  assert.equal(doc.getElementById('school').value, '');
  assert.equal(result.fields.find((field) => field.question === '专业类别').reason, 'not_run');
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.complete, false);
  assertNeverSave(clicks);
});

test('在校时间 and 专业类别 keep a matching value without opening', async () => {
  const row = {
    school: '示例大学', major: '计算机', degree: '本科', unifiedAdmissions: '是',
    startDate: '2025-03', endDate: '2026-07', majorCategory: '经济学||金融学',
  };
  const html = shell('教育经历', formWrap(educationFields({
    school: '示例大学', major: '计算机', degree: '本科', radio: '是',
    dates: monthRangeItem('2025-03', '2026-07'),
    category: categoryItem({ value: '金融学' }),
  })));
  const same = boot(html);
  wireDegree(same.dom.window.document);
  wireRadio(same.dom.window.document);
  const months = wireMonthRange(same.dom.window.document);
  const picker = wireCategory(same.dom.window.document);
  const result = await same.context.ResumeGthEducationOpen.trial(request(educationProfile(row), { profileIndex: 0 }));
  assert.equal(result.ok, true);
  assert.equal(result.writeStarted, false);
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(months.open, 0);
  assert.equal(picker.open, 0);
  assert.equal(result.fields.find((field) => field.question === '在校时间').reason, 'preexisting_same_value');
  assert.equal(result.fields.find((field) => field.question === '专业类别').reason, 'preexisting_same_value');
  assert.equal(same.dom.window.document.getElementById('editor-save').textContent, '保存');
  assertNeverSave(same.clicks);
});

test('在校时间 and 专业类别 stay control_not_supported when the opened structure is not the live one', async () => {
  const dated = boot(shell('教育经历', formWrap(educationFields({
    dates: monthRangeItem().replace('el-picker-panel el-date-picker', 'el-dialog'),
  }))));
  wireDegree(dated.dom.window.document);
  wireRadio(dated.dom.window.document);
  wireMonthRange(dated.dom.window.document);
  const monthBlocked = await dated.context.ResumeGthEducationOpen.trial(request(educationProfile({
    school: '示例大学', major: '计算机', degree: '本科', unifiedAdmissions: '是',
    startDate: '2025-03', endDate: '2026-07',
  }), { profileIndex: 0 }));
  assert.equal(monthBlocked.ok, false);
  assert.equal(monthBlocked.reason, 'control_not_supported');
  assert.equal(monthBlocked.selectorStep, 'month_panel_structure_unknown');
  assert.equal(monthBlocked.writeStarted, false);
  assert.equal(dated.dom.window.document.getElementById('school').value, '');
  assert.equal(dated.dom.window.document.getElementById('start-date').value, '');
  assertNeverSave(dated.clicks);

  const plain = boot(shell('教育经历', formWrap(educationFields({
    category: '<div class="el-form-item"><label class="el-form-item__label">专业类别</label><div class="el-form-item__content"><input id="major-trigger" type="text" value=""></div></div>',
  }))));
  wireDegree(plain.dom.window.document);
  wireRadio(plain.dom.window.document);
  const categoryBlocked = await plain.context.ResumeGthEducationOpen.trial(request(educationProfile({
    school: '示例大学', major: '计算机', degree: '本科', unifiedAdmissions: '是', majorCategory: '金融学',
  }), { profileIndex: 0 }));
  assert.equal(categoryBlocked.ok, false);
  assert.equal(categoryBlocked.writeStarted, false);
  assert.equal(categoryBlocked.reason, 'control_not_supported');
  assert.equal(categoryBlocked.selectorStep, 'picker_trigger_structure_unknown');
  assert.equal(plain.dom.window.document.getElementById('school').value, '');
  assert.equal(plain.dom.window.document.getElementById('major-trigger').value, '');
  assertNeverForbidden(plain.clicks);
});

test('专业类别 single-select level-2 closes without 确定, and a missing level cancels', async () => {
  const row = {
    school: '示例大学', major: '计算机', degree: '本科', unifiedAdmissions: '是',
    majorCategory: '经济学||金融学',
  };
  const html = shell('教育经历', formWrap(educationFields({ category: categoryItem({ confirm: false }) })));
  const { dom, clicks, context } = boot(html);
  wireDegree(dom.window.document);
  wireRadio(dom.window.document);
  const picker = wireCategory(dom.window.document, { closeOnLeaf: true });
  const result = await context.ResumeGthEducationOpen.trial(request(educationProfile(row), { profileIndex: 0 }));
  assert.equal(result.ok, true);
  assert.equal(dom.window.document.getElementById('major-trigger').value, '金融学');
  assert.equal(picker.confirm, 0);
  assert.equal(picker.level1, 1);
  assert.equal(result.fields.find((field) => field.question === '专业类别').reason, 'readback_matched');
  assertNeverSave(clicks);

  const missing = boot(shell('教育经历', formWrap(educationFields({ category: categoryItem() }))));
  wireDegree(missing.dom.window.document);
  wireRadio(missing.dom.window.document);
  const failed = wireCategory(missing.dom.window.document, { revealL2: false });
  const blocked = await missing.context.ResumeGthEducationOpen.trial(request(educationProfile(row), { profileIndex: 0 }));
  assert.equal(blocked.ok, false);
  assert.equal(blocked.writeStarted, false);
  assert.equal(blocked.fields.find((field) => field.question === '专业类别').reason, 'picker_level2_menu_missing');
  assert.equal(failed.cancel, 1);
  assert.equal(missing.dom.window.document.getElementById('major-panel').style.display, 'none');
  assert.equal(missing.dom.window.document.getElementById('school').value, '');
  assert.equal(missing.clicks.filter((node) => node.id === 'editor-cancel' || node.id === 'editor-save').length, 0);
  assertNeverSave(missing.clicks);
});

test('专业类别 replaceExisting rewrites the leaf and a single-level leaf uses 确定', async () => {
  const replaced = boot(shell('教育经历', formWrap(educationFields({
    school: '示例大学', major: '计算机', degree: '本科', radio: '是',
    category: categoryItem({ value: '法学' }),
  }))));
  wireDegree(replaced.dom.window.document);
  wireRadio(replaced.dom.window.document);
  wireCategory(replaced.dom.window.document);
  const result = await replaced.context.ResumeGthEducationOpen.trial(request(educationProfile({
    school: '示例大学', major: '计算机', degree: '本科', unifiedAdmissions: '是', majorCategory: '经济学||金融学',
  }), { profileIndex: 0, replaceExisting: true }));
  assert.equal(replaced.dom.window.document.getElementById('major-trigger').value, '金融学');
  assert.equal(result.fields.find((field) => field.question === '专业类别').reason, 'readback_reapplied');
  assert.equal(result.ok, true);
  assertNeverSave(replaced.clicks);

  const single = boot(shell('教育经历', formWrap(educationFields({ category: categoryItem({ panel: 'single' }) }))));
  wireDegree(single.dom.window.document);
  wireRadio(single.dom.window.document);
  const stats = wireCategory(single.dom.window.document);
  const picked = await single.context.ResumeGthEducationOpen.trial(request(educationProfile({
    school: '示例大学', major: '计算机', degree: '本科', unifiedAdmissions: '是', majorCategory: '金融学',
  }), { profileIndex: 0 }));
  assert.equal(single.dom.window.document.getElementById('major-trigger').value, '金融学');
  assert.equal(stats.confirm, 1);
  assert.equal(stats.level1, 0);
  assert.equal(picked.fields.find((field) => field.question === '专业类别').reason, 'readback_matched');
  assert.equal(picked.liveSupportClaimed, false);
  assertNeverSave(single.clicks);

  const wrapped = boot(shell('教育经历', formWrap(educationFields({ category: categoryItem({ panel: 'single', trigger: 'div' }) }))));
  wireDegree(wrapped.dom.window.document);
  wireRadio(wrapped.dom.window.document);
  wireCategory(wrapped.dom.window.document);
  const divPicked = await wrapped.context.ResumeGthEducationOpen.trial(request(educationProfile({
    school: '示例大学', major: '计算机', degree: '本科', unifiedAdmissions: '是', majorCategory: '法学',
  }), { profileIndex: 0 }));
  assert.equal(wrapped.dom.window.document.getElementById('major-value').value, '法学');
  assert.equal(divPicked.fields.find((field) => field.question === '专业类别').reason, 'readback_matched');
  assert.equal(divPicked.liveSupportClaimed, false);
  assertNeverSave(wrapped.clicks);
});
