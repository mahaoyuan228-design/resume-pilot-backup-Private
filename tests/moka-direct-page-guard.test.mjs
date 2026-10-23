// Reuse the provisional fixture to check the direct entrypoint's host boundary.
// These offline URL variations do not establish live Moka form support.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const fixture = readFileSync(new URL('./fixtures/moka-basic-form.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../src/content/moka-basic.js', import.meta.url), 'utf8');
const value = 'DIRECT-GUARD-NAME';

function boot(t, url) {
  const dom = new JSDOM(fixture, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const { window } = dom;
  const { document } = window;
  const actions = { click: 0, submit: 0, submitCall: 0, requestSubmit: 0 };
  for (const button of document.querySelectorAll('button')) button.disabled = false;
  for (const kind of ['click', 'submit']) document.addEventListener(kind, (event) => {
    actions[kind] += 1;
    event.preventDefault();
  }, true);
  window.HTMLFormElement.prototype.submit = () => { actions.submitCall += 1; };
  window.HTMLFormElement.prototype.requestSubmit = () => { actions.requestSubmit += 1; };
  const controls = [...document.querySelectorAll('input[name]')];
  const before = controls.map((control) => control.value);
  const events = [];
  for (const kind of ['focus', 'input', 'change', 'blur']) document.addEventListener(kind, (event) => {
    events.push([kind, event.target.name]);
  }, true);
  window.eval(source);
  let lookups = 0;
  const querySelectorAll = document.querySelectorAll.bind(document);
  document.querySelectorAll = (...args) => {
    lookups += 1;
    return querySelectorAll(...args);
  };
  return { api: window.ResumeMokaBasic, controls, before, events, actions, lookups: () => lookups };
}

function neverSave(ctx, result) {
  assert.equal(result.saved, false);
  assert.equal(result.skippedSave, true);
  assert.equal(result.neverSave, true);
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.supportClaimed, false);
  assert.deepEqual(ctx.actions, { click: 0, submit: 0, submitCall: 0, requestSubmit: 0 });
}

for (const [name, url, options] of [
  ['unrelated host', 'https://example.com/fixture', undefined],
  ['synthetic option on unrelated host', 'https://example.com/fixture', { synthetic: true }],
  ['another paid ATS host', 'https://gffunds.jobs.feishu.cn/fixture', { synthetic: true }],
  ['Moka hostname suffix spoof', 'https://app.mokahr.com.example.com/fixture', { synthetic: true }],
  ['unsupported protocol', 'ftp://app.mokahr.com/fixture', undefined],
  ['localhost without synthetic option', 'http://localhost/fixture', undefined],
  ['localhost with synthetic disabled', 'http://localhost/fixture', { synthetic: false }],
  ['loopback without synthetic option', 'http://127.0.0.1/fixture', undefined]
]) {
  test(`Moka direct fill refuses ${name} before inspecting form controls`, async (t) => {
    const ctx = boot(t, url);
    const result = await ctx.api.fillText('姓名', value, options);
    neverSave(ctx, result);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'wrong_page');
    assert.equal(result.writeAttempted, false);
    assert.equal(ctx.lookups(), 0, 'wrong-page refusal must precede classification and neighbor reads');
    assert.deepEqual(ctx.events, [], 'wrong-page controls receive no focus, write, or cleanup events');
    assert.deepEqual(ctx.controls.map((control) => control.value), ctx.before);
  });
}

for (const [name, url, options] of [
  ['known Moka host', 'https://app.mokahr.com/campus-recruitment/ti/143986', undefined],
  ['explicit localhost fixture', 'http://localhost/fixture', { synthetic: true }],
  ['explicit loopback fixture', 'http://127.0.0.1/fixture', { synthetic: true }]
]) {
  test(`Moka direct fill retains ${name} behavior`, async (t) => {
    const ctx = boot(t, url);
    const result = await ctx.api.fillText('姓名', value, options);
    neverSave(ctx, result);
    assert.equal(result.ok, true);
    assert.equal(result.reason, 'matched');
    assert.equal(result.writeAttempted, true);
    assert.equal(ctx.controls[0].value, value);
    assert.deepEqual(ctx.controls.slice(1).map((control) => control.value), ctx.before.slice(1));
    assert.ok(ctx.events.some(([kind, name]) => kind === 'input' && name === 'fullName'));
    assert.ok(ctx.events.every(([, name]) => name === 'fullName'));
    assert.equal(result.neighborsPreserved, true);
  });
}
