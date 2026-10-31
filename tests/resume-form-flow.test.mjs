import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../src/content/controls/resume-form.js', import.meta.url), 'utf8');
function fixture(t, html) {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, {
    url: 'http://127.0.0.1/offline-resume', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  t.after(() => dom.window.close());
  dom.window.eval(source);
  return { window: dom.window, document: dom.window.document, flow: dom.window.ResumeFormFlow };
}

test('unverified create entry stays manual without invoking its POST handler', async t => {
  const f = fixture(t, '<p>还没有简历</p><button type="button">创建简历</button><input id="neighbor" value="KEEP">');
  let clicks = 0, requests = 0;
  f.window.fetch = () => { requests++; throw Error('unexpected_network'); };
  f.document.querySelector('button').addEventListener('click', () => {
    clicks++;
    f.window.fetch('/resume', { method: 'POST' });
  });
  const before = f.document.body.innerHTML;
  const result = await f.flow.ensure({ ready: () => false, allowEntry: true, timeoutMs: 250 });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'manual');
  assert.equal(result.entryAttempted, false);
  assert.equal(result.entryPlan.status, 'manual');
  assert.equal(result.transitions.length, 0);
  assert.equal(clicks, 0);
  assert.equal(requests, 0);
  assert.equal(f.document.body.innerHTML, before);
  assert.equal(f.document.querySelector('#neighbor').value, 'KEEP');
  assert.equal(result.writeAttempted, false);
  assert.equal(result.liveSupportClaimed, false);
});

test('summary edit stays manual without invoking its PUT handler or accepting summary text', async t => {
  const f = fixture(t, '<section>简历摘要</section><button type="button">编辑简历</button>');
  let clicks = 0, requests = 0;
  f.window.fetch = () => { requests++; throw Error('unexpected_network'); };
  f.document.querySelector('button').addEventListener('click', () => {
    clicks++;
    f.window.fetch('/resume', { method: 'PUT' });
  });
  const before = f.document.body.innerHTML;
  const result = await f.flow.ensure({ ready: () => !!f.document.querySelector('#editor'), allowEntry: true, timeoutMs: 250 });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'manual');
  assert.equal(result.entryAttempted, false);
  assert.equal(clicks, 0);
  assert.equal(requests, 0);
  assert.equal(f.document.querySelector('#editor'), null);
  assert.equal(f.document.body.innerHTML, before);
});

test('readiness waits for independently hydrated writable controls and settles before success', async t => {
  const f = fixture(t, '<section>简历摘要</section>');
  f.window.setTimeout(() => {
    const input = f.document.createElement('input'); input.id = 'editor'; f.document.body.append(input);
  }, 55);
  let readyReads = 0;
  const result = await f.flow.ensure({ ready: () => {
    if (f.document.querySelector('#editor')) readyReads++;
    return !!f.document.querySelector('#editor');
  }, timeoutMs: 300 });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'ready');
  assert.equal(result.entryAttempted, false);
  assert.ok(readyReads >= 2);
  assert.equal(f.document.querySelector('#editor').value, '');
});

test('read-only readiness and persistent shells never click or claim form readiness', async t => {
  const f = fixture(t, '<button type="button">编辑简历</button>');
  let clicks = 0;
  f.document.querySelector('button').addEventListener('click', () => clicks++);
  const readonly = await f.flow.ensure({ ready: () => false, timeoutMs: 20 });
  assert.equal(readonly.status, 'unsupported');
  assert.equal(readonly.reason, 'form_not_ready');
  assert.equal(clicks, 0);
  const writable = await f.flow.ensure({ ready: () => false, allowEntry: true, timeoutMs: 80 });
  assert.equal(writable.ok, false);
  assert.equal(writable.status, 'manual');
  assert.equal(writable.entryAttempted, false);
  assert.equal(clicks, 0);
});

for (const [name, html, expected] of [
  ['ambiguous', '<button type="button">编辑简历</button><button type="button">编辑简历</button>', 'entry_ambiguous'],
  ['submit', '<form><button>创建简历</button></form>', 'navigation_submit_manual'],
  ['disabled', '<button type="button" disabled>创建简历</button>', 'navigation_disabled'],
  ['cross-origin', '<a href="https://example.invalid/resume/edit">编辑简历</a>', 'navigation_link_manual'],
  ['full-document', '<a href="/resume/edit">编辑简历</a>', 'navigation_link_manual'],
  ['download', '<a href="#resume" download>编辑简历</a>', 'navigation_link_manual'],
]) {
  test(`${name} entry fails closed without a click`, async t => {
    const f = fixture(t, html); let clicks = 0;
    f.document.addEventListener('click', () => clicks++);
    const result = await f.flow.ensure({ ready: () => false, allowEntry: true, timeoutMs: 20 });
    assert.equal(result.status, 'manual');
    assert.equal(result.reason, expected);
    assert.equal(result.entryAttempted, false);
    assert.equal(clicks, 0);
  });
}

test('hidden and forbidden actions are never treated as resume entry controls', async t => {
  const f = fixture(t, '<div hidden><button type="button">编辑简历</button></div><button type="button">保存并创建简历</button><button type="button">提交</button>');
  let clicks = 0; f.document.addEventListener('click', () => clicks++);
  assert.equal(f.flow.inspect().entryCount, 0);
  const result = await f.flow.ensure({ ready: () => false, allowEntry: true, timeoutMs: 10 });
  assert.equal(result.ok, false);
  assert.equal(clicks, 0);
});

test('binding check is revalidated before entry and blocks effects when it fails', async t => {
  const f = fixture(t, '<button type="button">编辑简历</button>'); let checks = 0, clicks = 0;
  f.document.addEventListener('click', () => clicks++);
  await assert.rejects(f.flow.ensure({ ready: () => false, allowEntry: true, timeoutMs: 50,
    check: () => { if (++checks === 2) throw Error('profile_binding_changed'); } }), /profile_binding_changed/);
  assert.equal(clicks, 0);
});

test('transient readiness must settle before success', async t => {
  const f = fixture(t, ''); let calls = 0;
  const result = await f.flow.ensure({ ready: () => ++calls === 1, timeoutMs: 50 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'form_not_ready');
});

test('general engine scans a readonly summary without entering edit despite unrelated header inputs', async t => {
  const f = fixture(t, '<header><input id="search" type="search" value="KEEP_SEARCH"><input id="unlabelled" value="KEEP_HEADER"></header><section><label>姓名<input readonly value="摘要姓名"></label><button type="button">编辑简历</button></section>');
  f.window.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  let listener, edits = 0, requests = 0;
  f.window.fetch = () => { requests++; throw Error('unexpected_network'); };
  f.window.chrome = { runtime: { id: 'offline-extension', onMessage: {
    addListener(fn) { listener = fn; }, hasListeners: () => false,
  }, sendMessage: async message => message.type === 'RESUME_PROFILE_BINDING_CHECK' ? { allowed: true } : {} } };
  f.document.querySelector('button').addEventListener('click', () => {
    edits++;
    f.window.fetch('/resume', { method: 'PUT' });
    f.document.querySelector('section').innerHTML = '<form><label>姓名<input id="fullName"></label><label>手机号码<input id="phone" type="tel"></label><label>邮箱<input id="email" type="email"></label></form>';
  });
  const before = f.document.body.innerHTML;
  f.window.eval(readFileSync(new URL('../src/core/matcher.js', import.meta.url), 'utf8'));
  f.window.eval(readFileSync(new URL('../src/content/engine.js', import.meta.url), 'utf8'));
  const result = await new Promise(resolve => listener({ type: 'RESUME_FILL', profile: {
    fullName: '离线示例', phone: '13800000000', email: 'offline@example.test',
    confirmedFields: ['fullName', 'phone', 'email'],
  }, profileBinding: { version: 1 } }, { id: 'offline-extension' }, resolve));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.data.formReadiness.status, 'form_not_ready');
  assert.equal(result.data.advisoryHints[0].reason, 'form_read_only');
  assert.equal(edits, 0);
  assert.equal(requests, 0);
  assert.equal(f.document.querySelector('#fullName'), null);
  assert.equal(f.document.body.innerHTML, before);
  assert.equal(f.document.querySelector('#search').value, 'KEEP_SEARCH');
  assert.equal(f.document.querySelector('#unlabelled').value, 'KEEP_HEADER');
});

for (const [name, file, api] of [
  ['Hotjob', 'hotjob-mc-basic.js', 'ResumeHotjobMcBasic'],
  ['Beisen', 'beisen-2022-basic.js', 'ResumeBeisen2022Basic'],
]) {
  test(`${name} entry revalidates profile binding before returning its manual plan`, async t => {
    const f = fixture(t, '<p>还没有简历</p><button type="button">创建简历</button>');
    let checks = 0, createClicks = 0;
    const binding = { version: 1, epoch: 'offline-binding', profileHash: 'synthetic-hash' };
    f.window.chrome = { runtime: { onMessage: { addListener() {} },
      sendMessage: async message => {
        assert.deepEqual(message.profileBinding, binding);
        return { allowed: ++checks < 2 };
      } } };
    f.document.querySelector('button').addEventListener('click', () => {
      createClicks++;
    });
    f.window.eval(readFileSync(new URL(`../src/content/${file}`, import.meta.url), 'utf8'));
    await assert.rejects(f.window[api].prepareForm({ synthetic: true, readinessTimeoutMs: 200, profileBinding: binding }), /profile_binding_changed/);
    assert.equal(checks, 2);
    assert.equal(createClicks, 0);
  });
}
