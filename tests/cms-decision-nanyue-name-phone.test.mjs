/**
 * cmsDecision name/phone/major gates proven on 南粤 (2026-10-19).
 * No live DOM. Never Save. Acceptance stays 85%.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const M = require('../src/core/matcher.js');

class El {
  constructor(tag, { className = '', text = '', children = [] } = {}) {
    this.tagName = String(tag || 'div').toUpperCase();
    this.classList = new Set(className.split(/\s+/u).filter(Boolean));
    this.textContent = text;
    this.children = children;
    this.parent = null;
    this.disabled = false;
    this.type = '';
    for (const child of children) child.parent = this;
  }
  getAttribute(name) { return this.attributes?.[name] ?? null; }
  closest(selector) {
    let cur = this;
    while (cur) {
      if (selector === '[hidden],[aria-hidden="true"]') {
        if (cur.getAttribute('hidden') != null || cur.getAttribute('aria-hidden') === 'true') return cur;
      } else if (matches(cur, selector)) return cur;
      cur = cur.parent;
    }
    return null;
  }
  matches(selector) { return matches(this, selector); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) { return queryAll(this, selector); }
  getClientRects() { return [{}]; }
}

class InputEl extends El {
  constructor(opts) {
    super('input', opts);
    this.type = 'text';
  }
}

function matches(node, selector) {
  if (selector === 'input') return node.tagName === 'INPUT';
  if (selector === 'label') return node.tagName === 'LABEL';
  if (selector === 'textarea') return node.tagName === 'TEXTAREA';
  if (selector.startsWith('.')) return selector.split('.').filter(Boolean).every((name) => node.classList.has(name));
  return false;
}

function descendants(node, acc = []) {
  for (const child of node.children) {
    acc.push(child);
    descendants(child, acc);
  }
  return acc;
}

function queryAll(root, selector) {
  const sel = selector.trim();
  if (sel.startsWith(':scope > ')) {
    const rest = sel.slice(':scope > '.length);
    if (!rest.includes(' ')) return root.children.filter((child) => matches(child, rest));
    const [childSel, descSel] = rest.split(/\s+/u);
    return root.children.filter((child) => matches(child, childSel))
      .flatMap((child) => descendants(child).filter((node) => matches(node, descSel)));
  }
  if (sel.includes(' > ')) {
    const [left, right] = sel.split(' > ');
    return descendants(root).filter((node) => matches(node, left))
      .flatMap((node) => node.children.filter((child) => matches(child, right)));
  }
  return descendants(root).filter((node) => matches(node, sel));
}

function el(tag, opts) { return new El(tag, opts); }

function field(question) {
  const control = new InputEl();
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
      if (depth === 0) return src.slice(start, i + 1);
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
  const code = ['antSelectControl', 'formItemQuestion', 'visible', 'labelTexts', 'cmsDecision', 'markDuplicateTargets']
    .map((name) => extractFunction(src, name)).join('\n');
  globalThis.HTMLInputElement = InputEl;
  globalThis.HTMLTextAreaElement = class HTMLTextAreaElement extends El {};
  globalThis.getComputedStyle = () => ({ display: 'block', visibility: 'visible' });
  globalThis.document = { getElementById() { return null; } };
  const RESERVED_TYPES = new Set(['hidden', 'password', 'search', 'submit', 'reset', 'button', 'image', 'checkbox']);
  const CMS_EDUCATION_SELECT_KEYS = { 学校: 'school', 学历: 'degree' };
  const cmsSchoolSearchControl = () => false;
  return new Function('M', 'RESERVED_TYPES', 'CMS_EDUCATION_SELECT_KEYS', 'cmsSchoolSearchControl',
    `${code}\nreturn { cmsDecision, markDuplicateTargets };`)(M, RESERVED_TYPES, CMS_EDUCATION_SELECT_KEYS, cmsSchoolSearchControl);
}

const { cmsDecision, markDuplicateTargets } = loadCmsFns();

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
