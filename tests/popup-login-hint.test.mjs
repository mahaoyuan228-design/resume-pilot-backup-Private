import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../src/popup/popup.js', import.meta.url), 'utf8');
const reasonsStart = source.indexOf('const reasons = {');
const reasonsSource = source.slice(reasonsStart, source.indexOf('\n};', reasonsStart) + 3);
const hintSource = source.slice(source.indexOf('function formReadinessHint('), source.indexOf('async function sendCmb('));
const renderSource = source.slice(source.indexOf('async function render(data,'), source.indexOf('\nfunction sectionForPath('));

function popup(t) {
  const dom = new JSDOM('<!doctype html><body></body>');
  t.after(() => dom.window.close());
  const { document } = dom.window;
  const elements = Object.fromEntries(['list', 'draftList', 'drafts', 'draftButton', 'draftNote', 'draftIntro', 'summary']
    .map(name => [name, document.createElement('div')]));
  const messages = [];
  const render = runInNewContext(`${reasonsSource}\n${hintSource}\n(${renderSource.trim()})`, {
    document, elements, busy: false, MAX_CUSTOM_FACTS: 50,
    activeTab: { id: 1, url: 'https://fixture.example.test/resume' },
    previewQuestions: [], lastInspection: null,
    loadProfile: async () => ({ email: 'synthetic@example.test', confirmedFields: ['email'] }),
    chrome: { storage: { local: { get: async () => ({}) } } },
    questionPreview: () => ({ questions: [], candidates: [] }),
    renderValidationGaps() {}, renderAftercare() {}, appendFieldMemoryControl() {},
    setMessage: (...args) => messages.push(args),
  });
  return { render, elements, messages };
}

const loginField = { id: 'login-phone', labels: ['手机号码'], status: 'skipped',
  semanticStatus: 'manual', reason: 'login_form_detected' };
const resumeField = { id: 'resume-email', labels: ['邮箱'], path: 'email', status: 'verified', reason: 'readback_matched' };

test('login advisory appears in the summary while independent resume results remain visible', async t => {
  const h = popup(t);
  await h.render({ url: 'https://fixture.example.test/resume', fields: [loginField, resumeField],
    formReadiness: { status: 'ready' }, advisoryHints: [{ reason: 'login_form_detected', advisory: true, blocking: false }] }, true);
  assert.equal(h.elements.summary.textContent, '本次新填并读回 1 · 页面原有同值 0 · 失败 0 · 待处理 1 · 请先登录');
  const rows = [...h.elements.list.children];
  assert.equal(rows.length, 2);
  assert.equal(rows[0].querySelector('.field-status').textContent, '手动 · 请先登录');
  assert.equal(rows[1].querySelector('.field-status').textContent, '本次新填并读回一致');
  assert.equal(rows[1].querySelector('.field-detail').textContent, '资料：email');
  assert.match(h.messages.at(-1)[0], /本次新填并读回 1 项/);
});

test('login hint renders even when the protected region exposes no fillable fields', async t => {
  const h = popup(t);
  await h.render({ fields: [], advisoryHints: [null, { reason: 'login_form_detected' }] });
  assert.equal(h.elements.summary.textContent, '可填写 0 · 待处理 0 · 请先登录');
});

test('ordinary resume rendering keeps its counts and readiness advisory without a login hint', async t => {
  const h = popup(t);
  await h.render({ fields: [resumeField], formReadiness: { status: 'manual' }, advisoryHints: [{ reason: 'other_advisory' }] }, true);
  assert.match(h.elements.summary.textContent, /^本次新填并读回 1 · 页面原有同值 0 · 失败 0 · 待处理 0/);
  assert.match(h.elements.summary.textContent, /已继续扫描当前页面/);
  assert.doesNotMatch(h.elements.summary.textContent, /请先登录/);
  assert.equal(h.elements.list.children.length, 1);
});
