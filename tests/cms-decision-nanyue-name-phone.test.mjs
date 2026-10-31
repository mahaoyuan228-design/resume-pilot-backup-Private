/**
 * CMS name/phone/major gates and offline education 学历 identity regressions.
 * No live DOM. Never Save. Acceptance stays 85%.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const M = require('../src/core/matcher.js');
const dom = new JSDOM('<!doctype html><body></body>');
const fixtureDocument = dom.window.document;
dom.window.Element.prototype.getClientRects = () => [{}];
test.after(() => dom.window.close());

function el(tag, { className = '', text = '', children = [] } = {}) {
  const node = fixtureDocument.createElement(tag);
  node.className = className;
  node.textContent = text;
  node.append(...children);
  return node;
}

function field(question) {
  const control = el('input');
  const item = el('div', {
    className: 'ant-form-item',
    children: [
      el('div', { className: 'ant-form-item-label', children: [el('label', { text: question })] }),
      control
    ]
  });
  return { item, control };
}

function section(name, questions) {
  const fields = questions.map(field);
  const rows = fields.map(({ item }) => el('div', { className: 'form-cell-inner', children: [item] }));
  const element = el('section', {
    className: 'form-cell',
    children: [
      el('div', { className: 'tit-wrap', children: [el('div', { className: 'tit', text: name })] }),
      el('div', { className: 'form-cell-right', children: rows })
    ]
  });
  return { element, name, controls: fields.map((row) => row.control) };
}

function extractFunction(src, name) {
  const token = `function ${name}(`;
  const start = src.indexOf(token);
  assert.ok(start > 0, name);
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(src.slice(start - 6, start) === 'async ' ? start - 6 : start, i + 1);
    }
  }
  throw new Error(`unclosed ${name}`);
}

function educationRow(questions) {
  const fields = questions.map(field);
  const row = el('div', { className: 'form-cell-inner', children: fields.map((item) => item.item) });
  const element = el('section', {
    className: 'form-cell',
    children: [
      el('div', { className: 'tit-wrap', children: [el('div', { className: 'tit', text: '教育经历必填' })] }),
      el('div', { className: 'form-cell-right', children: [row] })
    ]
  });
  return { element, name: '教育经历必填', controls: fields.map((item) => item.control), questions };
}

function loadCmsFns() {
  const src = fs.readFileSync(path.join(root, 'src/content/engine.js'), 'utf8');
  const code = ['antSelectControl', 'formItemQuestion', 'visible', ...labelFunctions, 'cmsDecision', 'markDuplicateTargets']
    .map((name) => extractFunction(src, name)).join('\n');
  globalThis.HTMLInputElement = dom.window.HTMLInputElement;
  globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
  globalThis.HTMLSelectElement = dom.window.HTMLSelectElement;
  globalThis.Node = dom.window.Node;
  globalThis.getComputedStyle = () => ({ display: 'block', visibility: 'visible' });
  globalThis.document = fixtureDocument;
  const RESERVED_TYPES = new Set(['hidden', 'password', 'search', 'submit', 'reset', 'button', 'image', 'checkbox']);
  const CMS_EDUCATION_SELECT_KEYS = { 学校: 'school', 学历: 'degree' };
  const cmsSchoolSearchControl = () => false;
  return new Function('M', 'RESERVED_TYPES', 'CMS_EDUCATION_SELECT_KEYS', 'cmsSchoolSearchControl',
    `${labelConstants(src)}\nconst atsControlTargets = new Map(), atsControlPeers = new Set();\n${code}\nreturn { cmsDecision, markDuplicateTargets };`)(M, RESERVED_TYPES, CMS_EDUCATION_SELECT_KEYS, cmsSchoolSearchControl);
}

// Run the actual shared label resolver against DOM nodes so selector support,
// clone/removal behavior and ownership checks stay identical to the engine.
const labelFunctions = ['treeQueryControl', 'answerWidget', 'questionOwnsControl', 'cleanQuestion', 'questionText', 'generalSection', 'labelTexts'];
function labelConstants(src) {
  return ['FORM_ITEM_SELECTOR', 'ITEM_QUESTION_SELECTOR', 'SECTION_SELECTOR', 'ANSWER_WIDGET_SELECTOR', 'ANSWER_TEXT_SELECTOR']
    .map(name => {
      const declaration = src.match(new RegExp(`^  const ${name} = [\\s\\S]+?;$`, 'm'))?.[0];
      assert.ok(declaration, name);
      return declaration;
    }).join('\n');
}

const { cmsDecision, markDuplicateTargets } = loadCmsFns();

// Abstract unit doubles reuse the existing Ant v3/row shape above. They are
// not a captured employer DOM; unrelated adapters are disabled. Exercise the
// production collect -> fill loop so an unbound field can still fail by ID.
function selectPage({ rows = 1, dedicated = false, duplicateId = '' } = {}) {
  const makeSelect = () => el('div', {
    className: 'ant-select ant-select-selection ant-select-selection--single',
    children: [el('span', { className: 'ant-select-selection-selected-value', text: '本科' }), el('input')]
  });
  const makeRow = () => {
    const control = makeSelect();
    control.id = duplicateId;
    const item = field('学历*').item;
    item.children[1].replaceWith(control);
    return { control, row: el('div', { className: 'form-cell-inner', children: [item] }) };
  };
  const basicRow = makeRow();
  const educationRows = Array.from({ length: rows }, makeRow);
  const makeSection = (name, items) => {
    const element = el('section', { className: 'form-cell', children: [
      el('div', { className: 'form-cell-right', children: items.map(item => item.row) })
    ] });
    element.section = { name, element };
    return element;
  };
  const basic = makeSection('个人基本信息必填', [basicRow]);
  const education = makeSection('教育经历必填', educationRows);
  education.dedicated = dedicated;
  const form = el('form', { children: [basic, education] });
  fixtureDocument.body.replaceChildren(form);
  const controls = [basicRow.control, ...educationRows.map(item => item.control)];
  const doc = {
    body: form, title: 'offline unit double',
    querySelectorAll: selector => selector === 'input,select,textarea' ? []
      : selector === '.ant-form-item .ant-select-selection--single' ? controls : []
  };
  const sectionOf = control => control.closest('.form-cell')?.section;
  const specOf = control => sectionOf(control)?.name === '个人基本信息必填'
    ? { alias: '__cms_basic_education_level', sectionName: '个人基本信息必填', rowContext: 'single' } : null;
  const disabled = () => false;
  const src = fs.readFileSync(path.join(root, 'src/content/engine.js'), 'utf8');
  const names = ['collect', 'singleEducationContext', 'formItemQuestion', ...labelFunctions, 'fieldId', 'profileValue', 'cmsAntV3Answer', 'logicalEntryKey',
    'entrySignature', 'entryScope', 'publicEntry', 'meaningfulCurrent', 'exactOptionText', 'settleUnresolvedEntry', 'fillOwnedContent'];
  const deps = {
    M, cmsDecision, markDuplicateTargets, atsControlTargets: new Map(), atsControlPeers: new Set(),
    loginFormScopes: () => new Set(), loginAdvisoryHints: () => [],
    currentFormReadiness: () => ({ advisory: false, blocking: false }),
    proseControl: () => false, // This scaffold contains only Ant select displays.
    richtextControl: () => false,
    MANUAL_CONTROL_SELECTOR: '[data-captcha]', manualControlReason: disabled, // No challenge surfaces in this isolated select scaffold.
    visible: () => true, cmsAntV3InnerSearch: disabled, cmsRegionControl: disabled,
    cmsCheckboxControl: disabled, namedSection: () => null, cmsSection: sectionOf,
    cmsDedicatedRecordKind: control => control.closest('.form-cell')?.dedicated ? 'education' : null,
    sectionDecision: () => ({}), repeatContext: () => null, antDegreeControl: disabled,
    cmbAntV4Control: disabled, cmsAntV3Control: control => controls.includes(control),
    cmsSchoolSearchControl: disabled, cmsBirthDateControl: disabled, cmsEducationDateControl: disabled,
    cmsScopedAcademicSelectSpec: specOf, cmsScopedSimpleInputSpec: () => null,
    cmsAssignmentRadioControl: disabled, cmsCustomSingleSelect: disabled,
    cmsBasicAddressBinding: () => null, // Unrelated address binding is outside this isolated select scaffold.
    cmsScopedAcademicAnswer: profile => ({ path: 'customAnswers.__cms_basic_education_level',
      value: profile.customAnswers.__cms_basic_education_level }),
    cmsMappedOptionAnswer: (_profile, fact) => fact,
    customQuestionScope: control => ({ sectionName: sectionOf(control).name,
      rowContext: sectionOf(control).name === '个人基本信息必填' || rows === 1 ? 'single' : 'multiple' }),
    controlConstraint: () => null, antSelectControl: disabled,
    CMS_DEDICATED_RECORD_QUESTIONS: { education: new Set(['学历']) },
    REPEAT_KEYS: { education: { collection: 'education', degree: 'degree' } },
    CMS_PHOTO_PAGE: 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html',
    location: { href: 'https://offline.invalid/', origin: 'https://offline.invalid', pathname: '/' },
    document: doc, requireVisibleFillPage() {}, ensureRepeatRows: async () => [],
    fillCmsPhotos: async () => [], currentValidationGaps: () => null, cmsUncollectedQuestions: () => [],
    // Any attempt to fill a widget, save, submit, or otherwise write is an error.
    setBoundNativeValue: async () => { throw Error('unexpected_write'); }
  };
  const api = new Function(...Object.keys(deps), labelConstants(src) + '\n' + names.map(name => extractFunction(src, name)).join('\n')
    + '\nreturn { collect, fillOwnedContent };')(...Object.values(deps));
  const profile = { customAnswers: { __cms_basic_education_level: '硕士研究生' },
    education: [{ degree: '硕士研究生' }], confirmedFields: ['education.0.degree'] };
  return { ...api, profile, controls };
}

async function fillOffline(page) {
  globalThis.HTMLSelectElement = dom.window.HTMLSelectElement;
  globalThis.ResumeProfileWriteContext = { async check(write = true) {
    assert.equal(write, false, 'Never Save / no field writes in these readback cases');
  } };
  try { return await page.fillOwnedContent(page.profile); }
  finally { delete globalThis.ResumeProfileWriteContext; }
}

test('basic 学历 already bound: one education 学历 keeps education.0.degree', async () => {
  const page = selectPage();
  globalThis.HTMLSelectElement = dom.window.HTMLSelectElement;
  const entries = page.collect(page.profile);
  assert.equal(entries[0].path, 'customAnswers.__cms_basic_education_level');
  assert.equal(entries[1].path, 'education.0.degree');
  const result = await fillOffline(page);
  assert.deepEqual(result.fields.map(field => [field.path, field.status, field.reason]), [
    ['customAnswers.__cms_basic_education_level', 'skipped', 'existing_value'],
    ['education.0.degree', 'skipped', 'existing_value']
  ]);
});

for (const dedicated of [false, true]) {
  test(`repeated unnamed education 学历 yields without duplicate_target (dedicated=${dedicated})`, async () => {
    const page = selectPage({ rows: 2, dedicated });
    const result = await fillOffline(page);
    for (const field of result.fields.slice(1)) {
      assert.equal(field.path, undefined);
      assert.equal(field.reason, dedicated ? 'cms_record_requires_explicit_binding' : 'ambiguous_repeat_group');
      assert.equal(field.status, 'skipped');
    }
    assert.equal(result.fields.length, 3);
  });
}

test('explicit duplicate DOM IDs and confirmed paths still fail closed', async () => {
  const page = selectPage({ rows: 2, duplicateId: 'real-duplicate' });
  const result = await fillOffline(page);
  assert.equal(result.fields[1].id, 'real-duplicate');
  assert.equal(result.fields[1].status, 'failed');
  assert.equal(result.fields[1].reason, 'duplicate_target');
  const entries = markDuplicateTargets([
    { path: 'education.0.degree', reason: 'ready' },
    { path: 'education.0.degree', reason: 'ready' }
  ]);
  assert.equal(entries.every(entry => entry.reason === 'duplicate_target'), true);
});

for (const reason of ['missing_profile_value', 'unconfirmed_profile_value']) {
  test(`education 学历 never borrows the basic alias when ${reason}`, async () => {
    const page = selectPage();
    if (reason === 'missing_profile_value') page.profile.education = [];
    else page.profile.confirmedFields = [];
    const result = await fillOffline(page);
    assert.equal(result.fields[1].path, 'education.0.degree');
    assert.equal(result.fields[1].reason, reason);
    assert.equal(result.fields[1].status, 'skipped');
  });
}

function educationMajorEntry(control, section) {
  const decision = cmsDecision(control, 'major', section);
  if (decision.reason) return { reason: decision.reason, path: undefined };
  const index = decision.context?.kind === 'education' ? decision.context.index : null;
  return index === null
    ? { reason: 'ready', path: 'major' }
    : { reason: 'ready', path: `education.${index}.major` };
}

test('fullName binds only inside 个人基本信息必填', () => {
  const basic = section('个人基本信息必填', ['姓名']);
  const family = section('家庭关系必填', ['姓名']);
  assert.deepEqual(cmsDecision(basic.controls[0], 'fullName', basic), {});
  assert.deepEqual(cmsDecision(family.controls[0], 'fullName', family), { reason: 'section_requires_mapping' });
});

test('移动电话 wins over 联系电话 only when both are in 个人基本信息必填', () => {
  const both = section('个人基本信息必填', ['移动电话', '联系电话']);
  assert.deepEqual(cmsDecision(both.controls[0], 'phone', both), {});
  assert.deepEqual(cmsDecision(both.controls[1], 'phone', both), { reason: 'section_requires_mapping' });
  const landlineOnly = section('个人基本信息必填', ['联系电话']);
  assert.deepEqual(cmsDecision(landlineOnly.controls[0], 'phone', landlineOnly), {});
});

test('basic 专业 and 专业名称 stay unmapped; education accepts both', () => {
  for (const question of ['专业', '专业名称']) {
    const basic = section('个人基本信息必填', [question]);
    assert.deepEqual(cmsDecision(basic.controls[0], 'major', basic), { reason: 'section_requires_mapping' });
    const education = section('教育经历必填', [question]);
    assert.deepEqual(cmsDecision(education.controls[0], 'major', education), {
      context: { kind: 'education', index: 0 }
    });
  }
});

test('one education row does not bind both 专业 and 专业名称 to education.0.major', () => {
  assert.equal(M.classify(['专业']).key, 'major');
  assert.equal(M.classify(['专业名称']).key, 'major');
  const collided = markDuplicateTargets([
    { reason: 'ready', path: 'education.0.major' },
    { reason: 'ready', path: 'education.0.major' }
  ]);
  assert.equal(collided[0].reason, 'duplicate_target');
  assert.equal(collided[1].reason, 'duplicate_target');

  const education = educationRow(['专业', '专业名称']);
  const entries = education.controls.map((control) => educationMajorEntry(control, education));
  const resolved = markDuplicateTargets(entries.map((entry) => ({ ...entry })));
  assert.deepEqual(entries[0], { reason: 'section_requires_mapping', path: undefined });
  assert.deepEqual(entries[1], { reason: 'ready', path: 'education.0.major' });
  assert.equal(resolved.some((entry) => entry.reason === 'duplicate_target'), false);
  assert.equal(resolved.filter((entry) => entry.reason === 'ready' && entry.path === 'education.0.major').length, 1);
});
