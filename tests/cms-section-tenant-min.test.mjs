/**
 * cmsSection heading gate:
 * - baseline 招商 still requires 个人基本信息必填 + 自我评价必填 + 教育经历必填
 * - same-shell tenant (南粤) may omit 自我评价必填 when the other two headings are present
 * No live DOM. Never Save.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function node({ tag = 'div', className = '', text = '', children = [] } = {}) {
  const self = {
    tag,
    classList: new Set(className.split(/\s+/u).filter(Boolean)),
    textContent: text,
    children,
    parent: null,
    closest(selector) {
      let cur = self;
      while (cur) {
        if (selector === '.form-cell' && cur.classList.has('form-cell')) return cur;
        if (selector === 'form' && cur.tag === 'form') return cur;
        cur = cur.parent;
      }
      return null;
    },
    querySelector(selector) {
      if (selector !== ':scope > .tit-wrap .tit') return null;
      const wrap = self.children.find((child) => child.classList.has('tit-wrap'));
      return wrap?.children.find((child) => child.classList.has('tit')) || null;
    },
    querySelectorAll(selector) {
      if (selector !== '.form-cell > .tit-wrap .tit') return [];
      const cells = [];
      const walk = (item) => {
        if (item.classList.has('form-cell')) cells.push(item);
        for (const child of item.children) walk(child);
      };
      walk(self);
      return cells.map((cell) => cell.querySelector(':scope > .tit-wrap .tit')).filter(Boolean);
    }
  };
  for (const child of children) child.parent = self;
  return self;
}

function page(titles) {
  const controls = titles.map(() => node({ tag: 'input' }));
  const sections = titles.map((title, index) => node({
    className: 'form-cell',
    children: [
      node({ className: 'tit-wrap', children: [node({ className: 'tit', text: title })] }),
      node({ className: 'ant-form-item', children: [controls[index]] })
    ]
  }));
  node({ tag: 'form', children: sections });
  return controls;
}

function loadCmsSection() {
  const src = fs.readFileSync(path.join(root, 'src/content/engine.js'), 'utf8');
  const start = src.indexOf('function cmsSection(control) {');
  const end = src.indexOf('function cmsDedicatedRecordKind(control) {');
  assert.ok(start > 0 && end > start, 'cmsSection source slice');
  const M = {
    normalize(value) {
      return String(value ?? '')
        .replace(/\(必填\)|（必填）|\(选填\)|（选填）/g, '')
        .replace(/[＊*：:！!？?，,。.\s\u00a0]/g, '')
        .trim()
        .toLocaleLowerCase();
    }
  };
  return new Function('M', 'document', `${src.slice(start, end)}\nreturn cmsSection;`)(M, {});
}

const cmsSection = loadCmsSection();

test('cmsSection keeps the baseline three-heading signature', () => {
  const [basic] = page(['个人基本信息必填', '自我评价必填', '教育经历必填']);
  assert.equal(cmsSection(basic)?.name, '个人基本信息必填');
});

test('cmsSection accepts 南粤 tenantMin without 自我评价必填', () => {
  const [basic, education] = page(['个人基本信息必填', '教育经历必填']);
  assert.equal(cmsSection(basic)?.name, '个人基本信息必填');
  assert.equal(cmsSection(education)?.name, '教育经历必填');
});

test('cmsSection still returns null when 教育经历必填 is missing', () => {
  const [basic] = page(['个人基本信息必填', '自我评价必填']);
  assert.equal(cmsSection(basic), null);
});

test('cmsSection still returns null on a single basic heading', () => {
  const [basic] = page(['个人基本信息必填']);
  assert.equal(cmsSection(basic), null);
});
