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
    Event: window.Event, getComputedStyle: window.getComputedStyle.bind(window),
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

function unsupportedItems() {
  return `<div class="el-form-item"><label class="el-form-item__label">在校时间</label><div class="el-form-item__content"><div class="el-date-editor"><input type="text" readonly value=""></div><div class="el-date-editor"><input type="text" readonly value=""></div></div></div>
    <div class="el-form-item"><label class="el-form-item__label">专业类别</label><div class="el-form-item__content"><div class="input-l pointer"><input class="el-input__inner" readonly type="text" value=""></div></div></div>`;
}

function educationFields({ school = '', major = '', rank = '', degree = '', radio = '', activities = '', description = '', gpa = '', location = '' } = {}) {
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
    unsupportedItems(),
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
  assert.equal(result.coverage.find((field) => field.question === '专业类别').reason, 'control_not_supported');
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
    ...row, startDate: '2018-09',
  }), { profileIndex: 0 }));
  assert.equal(blocked.ok, false);
  assert.equal(blocked.writeStarted, false);
  assert.equal(blocked.reason, 'control_not_supported');
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
