import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const scripts = ['controls/resume-form.js', 'feishu-atsx-basic.js']
  .map(file => readFileSync(new URL(`../src/content/${file}`, import.meta.url), 'utf8'));
const values = { allowExplicitValues: true, fullName: '离线甲', mobile: '13800138000', email: 'offline@example.test' };
const fields = ['姓名', '手机号码', '邮箱'].map((label, i) => `<div class="atsx-form-item"><label class="atsx-form-item-label">${label}</label><input id="field-${i}" class="atsx-input"></div>`).join('');

function boot(t, html = '<div id="editor">saas-career loading</div>') {
  const dom = new JSDOM(`<!doctype html><body>${html}<input id="neighbor" value="KEEP"><button type="button">保存</button>`, {
    url: 'http://127.0.0.1/offline', pretendToBeVisual: true, runScripts: 'outside-only'
  });
  t.after(() => dom.window.close());
  const { window } = dom, { document } = window;
  let clicks = 0, writes = 0;
  document.addEventListener('click', () => { clicks++; }, true);
  document.addEventListener('input', () => { writes++; }, true);
  for (const source of scripts) window.eval(source);
  return { window, document, api: window.ResumeFeishuAtsxBasic,
    counts: () => ({ clicks, writes }), options: { synthetic: true, readinessTimeoutMs: 120 } };
}

test('ATSX waits for actual editable controls before filling a delayed shell', async t => {
  const f = boot(t);
  f.window.setTimeout(() => { f.document.getElementById('editor').innerHTML = fields; }, 30);
  const result = await f.api.fillBasic(values, { ...f.options, readinessTimeoutMs: 500 });
  assert.equal(result.ok, true);
  assert.equal(result.formReadiness.ok, true);
  assert.equal(result.writeAttempted, true);
  assert.deepEqual([0, 1, 2].map(i => f.document.getElementById(`field-${i}`).value), [values.fullName, values.mobile, values.email]);
  assert.equal(f.document.getElementById('neighbor').value, 'KEEP');
  assert.equal(f.counts().clicks, 0);
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.skippedSave, true);
});

for (const html of ['<div id="editor">saas-career loading</div>', fields.replace(/<input[^>]+>/gu, '')]) {
  test('ATSX shell or labels without controls ends manual with no writes', async t => {
    const f = boot(t, html);
    const before = f.document.body.innerHTML;
    const result = await f.api.fillBasic(values, f.options);
    assert.equal(result.ok, false);
    assert.equal(result.status, 'manual');
    assert.equal(result.reason, 'form_not_ready');
    assert.equal(result.writeAttempted, false);
    assert.equal(result.formReadiness.ok, false);
    assert.equal(result.liveSupportClaimed, false);
    assert.equal(result.saved, false);
    assert.equal(result.skippedSave, true);
    assert.deepEqual(f.counts(), { clicks: 0, writes: 0 });
    assert.equal(f.document.body.innerHTML, before);
    const probe = await f.api.probeLabels({ ...f.options, readinessTimeoutMs: 0 });
    assert.equal(probe.ok, false, 'portal fingerprint alone cannot claim readiness');
    assert.equal(probe.status, 'manual');
  });
}

test('ATSX hydration wait never activates a resume entry action', async t => {
  const f = boot(t, '<div id="editor">saas-career loading</div><button type="button">编辑简历</button>');
  f.document.querySelector('button').addEventListener('click', () => { f.document.getElementById('editor').innerHTML = fields; });
  const result = await f.api.fillBasic(values, f.options);
  assert.equal(result.ok, false);
  assert.equal(result.writeAttempted, false);
  assert.deepEqual(f.counts(), { clicks: 0, writes: 0 });
});

test('ATSX visible controls marked busy cannot receive premature writes', async t => {
  const f = boot(t, `<div id="editor" aria-busy="true">${fields}</div>`);
  let premature = 0;
  f.document.addEventListener('input', () => {
    if (f.document.getElementById('editor').getAttribute('aria-busy') === 'true') premature++;
  });
  f.window.setTimeout(() => { f.document.getElementById('editor').removeAttribute('aria-busy'); }, 60);
  const result = await f.api.fillBasic(values, { ...f.options, readinessTimeoutMs: 500 });
  assert.equal(result.ok, true);
  assert.equal(premature, 0);
});

test('ATSX busy controls that never hydrate end manual without writes', async t => {
  const f = boot(t, `<div id="editor" aria-busy="true">${fields}</div>`);
  const result = await f.api.fillBasic(values, f.options);
  assert.equal(result.ok, false);
  assert.equal(result.status, 'manual');
  assert.equal(result.writeAttempted, false);
  assert.deepEqual(f.counts(), { clicks: 0, writes: 0 });
});
