import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { ensureVisible, runSections } from '../scripts/live/lib/gth-full-orchestrator.mjs';
import { SECTIONS, requestsFor } from '../scripts/live/lib/gth-full-sections.mjs';
import { EVIDENCE_NAME, RUNTIME_FILES, evidenceExitCode, runGthFullResumeLive } from '../scripts/live/gth-full-resume-live.mjs';
import { expectedAnswers } from '../scripts/live/gth-other-skills-live.mjs';
import { expectedReadback } from '../scripts/live/gth-intent-live.mjs';

const PAGE = 'https://hr.gtht.com/resume/edit/';
const TITLES = ['基本信息', '教育经历', '求职意向', '工作经验', '职业技能与特长', '附件简历', '其他信息'];

// The orchestration driver uses the same editor shell as the existing GTH
// runner tests. The product writers themselves are covered by their tests;
// these tests exercise lifecycle ordering against actual connected DOM nodes.
function fixture(options = {}) {
  const dom = new JSDOM('<!doctype html><body></body>', { url: PAGE, pretendToBeVisual: true, runScripts: 'outside-only' });
  const { document } = dom.window;
  const calls = [];
  const clicks = [];
  const requests = [];
  let visible = options.visible !== false;
  let frontCalls = 0;
  let active = null;
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visible ? 'visible' : 'hidden' });
  for (const title of TITLES) {
    const section = document.createElement('section');
    section.className = 'r-section';
    section.innerHTML = '<div class="title_"><a class="h-e-btn" href="javascript:;">编辑</a></div>';
    section.querySelector('.title_').prepend(document.createTextNode(title));
    document.body.append(section);
  }
  const nodeFor = (section) => document.querySelectorAll('.r-section')[section.sectionIndex];
  const values = { ...expectedAnswers(), ...expectedReadback() };
  const driver = {
    async state() {
      const formCount = document.querySelectorAll('.r-section form').length;
      return { href: PAGE, hrefOk: true, readyState: 'complete', titlesOk: true,
        visible: document.visibilityState === 'visible', formCount, editorFormCount: formCount };
    },
    async bringToFront() {
      frontCalls += 1;
      if (options.frontRecovers !== false) visible = true;
    },
    async open(section) {
      calls.push(`open:${section.id}`);
      assert.equal(document.querySelectorAll('.r-section form').length, 0, 'next editor opened before prior form was removed');
      active = section.id;
      const node = nodeFor(section);
      node.querySelector('a.h-e-btn').remove();
      const form = document.createElement('form');
      form.className = 'el-form sec-form';
      for (const question of section.questions) {
        const item = document.createElement('div');
        item.className = 'el-form-item';
        const label = document.createElement('label');
        label.className = 'el-form-item__label';
        label.textContent = question;
        const input = document.createElement(question === '职业技能与特长' ? 'textarea' : 'input');
        if (input.tagName === 'INPUT') input.type = 'text';
        item.append(label, input);
        form.append(item);
      }
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = '取消';
      form.append(cancel);
      node.append(form);
      clicks.push({ sectionIndex: section.sectionIndex, allowed: true, label: '编辑', kind: 'edit' });
      if (options.openThrows === section.id) throw new Error('open_failed_after_form_appeared');
      return { ok: true, openedByUs: true };
    },
    async fill(section) {
      calls.push(`fill:${section.id}`);
      assert.equal(active, section.id);
      assert.ok(nodeFor(section).querySelector('.el-form-item'));
      if (options.fillThrows === section.id) throw new Error('section_fill_failed');
      for (const item of nodeFor(section).querySelectorAll('.el-form-item')) {
        const question = item.querySelector('label').textContent;
        item.querySelector('input,textarea').value = values[question] || '';
      }
      if (options.badRequest === section.id) requests.push({ method: 'POST', url: 'https://hr.gtht.com/api/log', allowed: false, blocked: true, sectionIndex: section.sectionIndex });
      if (options.badClick === section.id) clicks.push({ label: '保存', allowed: false, reason: 'refusing_forbidden_click', sectionIndex: section.sectionIndex });
      return [{ ok: true, fields: section.questions.map((question) => ({ question, status: 'verified', reason: 'readback_matched' })) }];
    },
    async read(section) {
      calls.push(`read:${section.id}`);
      return { ok: true, readback: [...nodeFor(section).querySelectorAll('.el-form-item')].map((item) => ({
        q: item.querySelector('label').textContent, value: item.querySelector('input,textarea').value, reason: null
      })), extraLabels: [] };
    },
    async cancel(section) {
      calls.push(`cancel:${section.id}`);
      const node = nodeFor(section);
      const form = node.querySelector('form');
      if (form) {
        clicks.push({ sectionIndex: section.sectionIndex, allowed: true, label: '取消', kind: 'cancel' });
        if (options.cancelLeavesForm === section.id) form.style.display = 'none';
        else form.remove();
      }
      if (!node.querySelector('a.h-e-btn')) {
        const edit = document.createElement('a');
        edit.className = 'h-e-btn';
        edit.href = 'javascript:;';
        edit.textContent = '编辑';
        node.querySelector('.title_').append(edit);
      }
      active = null;
      // Deliberately claims success even when the hidden form remains. The
      // orchestrator must check the DOM state independently of this response.
      return { ok: true, closed: true };
    },
    async evidence() { return { clicks: [...clicks], requests: [...requests] }; }
  };
  return { dom, document, driver, calls, frontCalls: () => frontCalls };
}

test('full runner orders all six sections on the same DOM and cancels each before opening the next', async (t) => {
  const f = fixture();
  t.after(() => f.dom.window.close());
  const runs = await runSections(f.driver);
  assert.deepEqual(runs.map((run) => run.id), ['basic', 'education', 'work', 'skills', 'other', 'intent']);
  assert.deepEqual(f.calls, SECTIONS.flatMap((section) => ['open', 'fill', 'read', 'cancel'].map((action) => `${action}:${section.id}`)));
  assert.equal(f.document.querySelectorAll('form').length, 0);
  assert.ok(runs.every((run) => run.cancel?.closed === true));
  assert.ok(runs.every((run) => run.fields.length >= SECTIONS.find((section) => section.id === run.id).questions.length));
});

test('one section throwing still cancels its editor and attempts every later section', async (t) => {
  const f = fixture({ fillThrows: 'education' });
  t.after(() => f.dom.window.close());
  const runs = await runSections(f.driver);
  const failed = runs.find((run) => run.id === 'education');
  assert.equal(failed.status, 'failed');
  assert.ok(failed.fields.every((field) => field.status === 'failed'));
  assert.equal(failed.cancel.closed, true);
  assert.ok(f.calls.indexOf('cancel:education') < f.calls.indexOf('open:work'));
  assert.ok(f.calls.includes('fill:intent'));
  assert.equal(runs.find((run) => run.id === 'skills').status, 'verified');
  assert.equal(runs.find((run) => run.id === 'other').status, 'verified');
});

test('a writer failure after matching field readbacks still fails the section and continues', async (t) => {
  const f = fixture();
  t.after(() => f.dom.window.close());
  const fill = f.driver.fill;
  f.driver.fill = async section => {
    const results = await fill(section);
    if (section.id === 'skills') Object.assign(results[0], { ok: false, reason: 'profile_binding_changed' });
    return results;
  };
  const runs = await runSections(f.driver, { sections: SECTIONS.filter(section => ['skills', 'other'].includes(section.id)) });
  assert.equal(runs[0].fields[0].status, 'verified');
  assert.equal(runs[0].status, 'failed');
  assert.equal(runs[0].reason, 'profile_binding_changed');
  assert.equal(runs[0].cancel.closed, true);
  assert.equal(runs[1].status, 'verified');
});

test('a throwing cancel still discards and verifies the editor before later sections', async (t) => {
  const f = fixture();
  t.after(() => f.dom.window.close());
  const cancel = f.driver.cancel;
  f.driver.cancel = async section => {
    if (section.id === 'skills') throw Object.assign(new Error('cancel_failed'), { reason: 'cancel_failed' });
    return cancel(section);
  };
  f.driver.forceClose = async section => {
    f.document.querySelectorAll('.r-section')[section.sectionIndex].querySelectorAll('form').forEach(form => form.remove());
  };
  const runs = await runSections(f.driver, { sections: SECTIONS.filter(section => ['skills', 'other'].includes(section.id)) });
  assert.equal(runs[0].cancel.closed, true);
  assert.equal(runs[0].cancel.forced, true);
  assert.equal(runs[1].status, 'verified');
  assert.equal(f.document.querySelectorAll('form').length, 0);
});

test('an open failure after a form appears still reaches cancel cleanup', async (t) => {
  const f = fixture({ openThrows: 'skills' });
  t.after(() => f.dom.window.close());
  const sections = SECTIONS.filter((section) => ['skills', 'other'].includes(section.id));
  const runs = await runSections(f.driver, { sections });
  assert.equal(runs[0].status, 'failed');
  assert.ok(f.calls.includes('cancel:skills'));
  assert.ok(f.calls.includes('fill:other'));
  assert.equal(f.document.querySelectorAll('form').length, 0);
});

test('cancel verification rejects a hidden connected form despite a successful cancel response', async (t) => {
  const f = fixture({ cancelLeavesForm: 'skills' });
  t.after(() => f.dom.window.close());
  const sections = SECTIONS.filter((section) => ['skills', 'other', 'intent'].includes(section.id));
  const runs = await runSections(f.driver, { sections });
  assert.equal(runs.length, 3);
  assert.equal(runs[0].status, 'failed');
  assert.equal(runs[0].cancel.closed, false);
  assert.ok(!f.calls.includes('open:other'));
  assert.ok(!f.calls.includes('open:intent'));
  assert.ok(runs.slice(1).every((run) => run.status === 'failed' && run.fields.every((field) => field.status === 'failed')));
});

test('hidden page is brought to front and checked once before continuing', async (t) => {
  const f = fixture({ visible: false });
  t.after(() => f.dom.window.close());
  await ensureVisible(f.driver);
  assert.equal(f.frontCalls(), 1);
  assert.equal((await f.driver.state()).visible, true);
  await ensureVisible(f.driver);
  assert.equal(f.frontCalls(), 1, 'visible page must not be retried');
});

test('hidden page after one bringToFront attempt fails with page_hidden', async (t) => {
  const f = fixture({ visible: false, frontRecovers: false });
  t.after(() => f.dom.window.close());
  await assert.rejects(ensureVisible(f.driver), (error) => error.reason === 'page_hidden');
  assert.equal(f.frontCalls(), 1);
});

test('a disallowed non-GET fails its section while later sections still run', async (t) => {
  const f = fixture({ badRequest: 'skills' });
  t.after(() => f.dom.window.close());
  const sections = SECTIONS.filter((section) => ['skills', 'other'].includes(section.id));
  const runs = await runSections(f.driver, { sections });
  assert.equal(runs[0].status, 'failed');
  assert.ok(runs[0].requests.some((request) => request.allowed === false));
  assert.equal(runs[1].status, 'verified');
  assert.ok(f.calls.includes('fill:other'));
});

test('physical removal after a stuck editor lets the next section bind and fill', async (t) => {
  const f = fixture({ cancelLeavesForm: 'basic', fillThrows: 'basic' });
  t.after(() => f.dom.window.close());
  const binds = [];
  f.driver.bindWriters = async (section) => { binds.push(section.id); };
  f.driver.forceClose = async (section) => {
    f.document.querySelectorAll('.r-section')[section.sectionIndex].querySelectorAll('form').forEach(node => node.remove());
    f.document.querySelectorAll('.el-picker-panel,.el-select-dropdown').forEach(node => node.remove());
  };
  const sections = [SECTIONS[0], SECTIONS.find((section) => section.id === 'education'), SECTIONS.find((section) => section.id === 'skills')];
  const runs = await runSections(f.driver, { sections });
  assert.deepEqual(binds, ['basic', 'education', 'skills']);
  assert.equal(runs[0].status, 'failed');
  assert.equal(runs[0].cancel.forced, true);
  assert.equal(runs[0].cancel.closed, true);
  assert.equal(runs[1].open.ok, true);
  assert.ok(f.calls.includes('fill:education'));
  assert.equal(runs[2].status, 'verified');
  assert.ok(f.calls.indexOf('cancel:basic') < f.calls.indexOf('open:education'));
  assert.ok(f.calls.indexOf('cancel:education') < f.calls.indexOf('open:skills'));
  assert.equal(f.document.querySelectorAll('form').length, 0);
});

test('a blocked forbidden click fails its section without stopping later section cleanup', async (t) => {
  const f = fixture({ badClick: 'skills' });
  t.after(() => f.dom.window.close());
  const sections = SECTIONS.filter((section) => ['skills', 'other'].includes(section.id));
  const runs = await runSections(f.driver, { sections });
  assert.equal(runs[0].status, 'failed');
  assert.ok(runs[0].clicks.some((click) => click.allowed === false));
  assert.equal(runs[1].status, 'verified');
  assert.equal(f.document.querySelectorAll('form').length, 0);
});

test('forced basic closure cannot verify restoration even with matching workStart readback', async t => {
  const f = fixture({ cancelLeavesForm: 'basic' });
  t.after(() => f.dom.window.close());
  const basic = { ...SECTIONS[0], questions: ['参加工作时间'] };
  const read = f.driver.read;
  f.driver.read = async section => section.id === 'basic'
    ? { ok: true, readback: [{ q: '参加工作时间', value: '2022-01', reason: null }] }
    : read(section);
  f.driver.forceClose = async section => {
    f.document.querySelectorAll('.r-section')[section.sectionIndex].querySelectorAll('form').forEach(form => form.remove());
  };
  const runs = await runSections(f.driver, { sections: [basic, SECTIONS.find(section => section.id === 'skills')] });
  assert.equal(runs[0].fields[0].status, 'verified');
  assert.equal(runs[0].cancel.closed, true);
  assert.equal(runs[0].cancel.restorationVerified, false);
  assert.equal(runs[0].reason, 'cancel_not_verified');
  assert.equal(runs[0].status, 'failed');
  assert.equal(runs[1].status, 'verified');
  assert.ok(f.calls.includes('fill:skills'));
});

test('combined work trial carries both confirmed months and the requested subordinate count', () => {
  const section = SECTIONS.find((item) => item.id === 'work');
  const [{ request }] = requestsFor(section);
  const row = request.profile.experience[0];
  assert.equal(row.startDate, '2020-03');
  assert.equal(row.endDate, '2024-08');
  assert.equal(row.subordinateCount, '5');
  for (const key of ['startDate', 'endDate', 'subordinateCount']) {
    assert.ok(request.profile.confirmedFields.includes(`experience.0.${key}`));
  }
});

test('unavailable target still writes one combined evidence file with every planned section and field', async (t) => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gth-full-evidence-'));
  t.after(() => fs.rmSync(outDir, { recursive: true, force: true }));
  let attachCount = 0;
  const evidence = await runGthFullResumeLive({
    env: { PORT: '9239', OUTDIR: outDir },
    tipSha: '703b62c',
    async getJson(port, endpoint) {
      assert.equal(port, 9239);
      assert.equal(endpoint, '/json/list');
      return [];
    },
    async connectCdp() { attachCount += 1; throw new Error('unexpected_attach'); }
  });
  assert.equal(attachCount, 0);
  assert.deepEqual(fs.readdirSync(outDir), [EVIDENCE_NAME]);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(outDir, EVIDENCE_NAME), 'utf8')), evidence);
  assert.equal(evidence.neverSave, true);
  assert.equal(evidence.liveSupportClaimed, false);
  assert.deepEqual(evidence.sections.map((section) => section.id), SECTIONS.map((section) => section.id));
  assert.equal(evidence.fields.length, SECTIONS.reduce((count, section) => count + section.questions.length, 0));
  assert.ok(evidence.fields.every((field) => field.status === 'failed'));
  assert.notEqual(evidenceExitCode(evidence), 0);
});

test('initial basic editor is usable, while a preexisting editor in another section is refused', async (t) => {
  const f = fixture();
  t.after(() => f.dom.window.close());
  const basic = SECTIONS[0];
  await f.driver.open(basic);
  f.calls.length = 0;
  const originalState = f.driver.state;
  f.driver.state = async () => ({ ...(await originalState()), basicInitialEditor: !!f.document.querySelectorAll('.r-section')[0].querySelector('form') });
  const originalOpen = f.driver.open;
  f.driver.open = async (section) => {
    if (section.id !== 'basic') return originalOpen(section);
    f.calls.push('open:basic');
    return { ok: true, alreadyOpen: true, openedByUs: false };
  };
  const runs = await runSections(f.driver, { sections: SECTIONS.slice(0, 2) });
  assert.equal(runs[0].open.alreadyOpen, true);
  assert.equal(runs[0].cancel.closed, true);
  assert.ok(f.calls.includes('fill:basic'));
  assert.ok(f.calls.includes('fill:education'));

  const foreign = fixture();
  t.after(() => foreign.dom.window.close());
  await foreign.driver.open(SECTIONS.find((section) => section.id === 'work'));
  foreign.calls.length = 0;
  const blocked = await runSections(foreign.driver, { sections: [basic] });
  assert.equal(blocked[0].reason, 'previous_editor_still_open');
  assert.equal(foreign.calls.length, 0);
  assert.equal(foreign.document.querySelectorAll('form').length, 1);
});

test('CDP runner evaluates the real page guard on one tab, intercepts requests, and writes one combined artifact', async (t) => {
  const f = fixture();
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gth-full-cdp-'));
  t.after(() => { f.dom.window.close(); fs.rmSync(outDir, { recursive: true, force: true }); });
  const { window } = f.dom;
  window.Element.prototype.getClientRects = () => [{ width: 8, height: 8 }];
  Object.defineProperty(window.document, 'readyState', { configurable: true, get: () => 'complete' });
  const originalClick = window.HTMLElement.prototype.click;
  const originalDispatch = window.EventTarget.prototype.dispatchEvent;
  const originalSubmit = window.HTMLFormElement.prototype.submit;
  for (const section of SECTIONS) {
    const node = window.document.querySelectorAll('.r-section')[section.sectionIndex];
    node.querySelector('a.h-e-btn').addEventListener('click', (event) => {
      event.preventDefault();
      // GTH creates its editor in reaction to 编辑. Keep that event behavior in
      // jsdom, with the same form/label/input shell as the per-section tests.
      void f.driver.open(section).then(() => {
        node.querySelector('button').addEventListener('click', () => { void f.driver.cancel(section); });
      });
    });
  }
  const commands = [];
  const productCalls = [];
  let attachCount = 0;
  let closed = false;
  let eventSink;
  const session = {
    async send(method, params, options = {}) {
      commands.push({ method, params, step: options.step });
      if (method !== 'Runtime.evaluate') return {};
      if (options.step?.startsWith('inject_')) {
        // Product writing is tested independently. Replacing only the injected
        // writer keeps real page open/read/cancel, shim and transport code here.
        for (const section of SECTIONS) {
          const trial = async () => {
            productCalls.push(section.id);
            // Current education fullTrial owns row opening rather than the
            // generic page.open used by the other product writers.
            if (section.id === 'education') await f.driver.open(section);
            if (section.id === 'work') {
              // A rejected bridge call must reach the combined artifact and
              // its own fill, even when later sections make no month calls.
              await window.chrome.runtime.sendMessage({ type: 'GTH_MONTH_MODEL_ACCEPT', answer: '2020-03' });
            }
            if (section.id === 'skills') {
              eventSink({ method: 'Fetch.requestPaused', params: { requestId: 'lookup', request: {
                method: 'POST', url: 'https://hr.gtht.com/interface/js/type/getsalaryunit.json?private=discard'
              } } });
              eventSink({ method: 'Fetch.requestPaused', params: { requestId: 'forbidden', request: {
                method: 'HEAD', url: 'https://hr.gtht.com/api/log?private=discard'
              } } });
            }
            return (await f.driver.fill(section))[0];
          };
          window[section.globalName] = { trial, fullTrial: trial };
        }
        return { result: { value: { ok: true } } };
      }
      try {
        const value = await window.eval(params.expression);
        return { result: { value } };
      } catch (error) {
        return { exceptionDetails: { text: error.message } };
      }
    },
    close() { closed = true; }
  };
  const evidence = await runGthFullResumeLive({
    env: { PORT: '9239', OUTDIR: outDir }, tipSha: '703b62c',
    async getJson() { return [{ type: 'page', id: 'same-tab', url: PAGE, webSocketDebuggerUrl: 'ws://127.0.0.1:9239/devtools/page/same-tab' }]; },
    async connectCdp(url, options) {
      attachCount += 1;
      assert.equal(url, 'ws://127.0.0.1:9239/devtools/page/same-tab');
      eventSink = options.onEvent;
      return session;
    }
  });
  assert.equal(attachCount, 1);
  assert.equal(evidence.targetId, 'same-tab');
  assert.deepEqual([...new Set(productCalls)], SECTIONS.map((section) => section.id));
  assert.ok(commands.findIndex((command) => command.method === 'Fetch.enable') < commands.findIndex((command) => command.step === 'open'));
  assert.ok(commands.some((command) => command.method === 'Fetch.continueRequest' && command.params.requestId === 'lookup'));
  assert.ok(commands.some((command) => command.method === 'Fetch.failRequest' && command.params.requestId === 'forbidden'));
  assert.equal(evidence.sections.find((section) => section.id === 'skills').status, 'failed');
  assert.ok(evidence.sections.find((section) => section.id === 'skills').requests.some((request) => request.method === 'HEAD' && request.allowed === false));
  assert.equal(evidenceExitCode(evidence), 3);
  assert.ok(evidence.requests.every((request) => !request.url.includes('?')));
  assert.deepEqual(JSON.parse(JSON.stringify(evidence.monthModels)), [{
    question: null, endpoint: null, answer: '2020-03', result: 'bad-answer', panelConnected: false, value: null
  }]);
  assert.deepEqual(evidence.sections.find(section => section.id === 'work').fills[0].monthModels, evidence.monthModels);
  assert.deepEqual(Array.from(evidence.sections.find(section => section.id === 'skills').fills[0].monthModels), []);
  assert.equal(evidence.liveSupportClaimed, false);
  assert.equal(window.document.querySelectorAll('form').length, 0);
  assert.equal(window.HTMLElement.prototype.click, originalClick);
  assert.equal(window.EventTarget.prototype.dispatchEvent, originalDispatch);
  assert.equal(window.HTMLFormElement.prototype.submit, originalSubmit);
  assert.equal(window.chrome, undefined);
  assert.equal(window.__gthFullResumeMonthModels, undefined);
  assert.ok(commands.some((command) => command.method === 'Fetch.disable'));
  assert.equal(closed, true);
  assert.deepEqual(fs.readdirSync(outDir), [EVIDENCE_NAME]);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(outDir, EVIDENCE_NAME), 'utf8')), JSON.parse(JSON.stringify(evidence)));
});

test('full runner runtime file list includes its import graph and shipped writers', () => {
  const root = new URL('../', import.meta.url);
  const seen = new Set();
  function walk(relative) {
    if (seen.has(relative)) return;
    seen.add(relative);
    const source = fs.readFileSync(new URL(relative, root), 'utf8');
    for (const match of source.matchAll(/(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/gu)) {
      if (!match[1].startsWith('.')) continue;
      walk(path.posix.normalize(path.posix.join(path.posix.dirname(relative), match[1])));
    }
  }
  walk('scripts/live/gth-full-resume-live.mjs');
  for (const relative of RUNTIME_FILES.filter(relative => relative.startsWith('src/content/'))) seen.add(relative);
  assert.deepEqual([...seen].sort(), [...RUNTIME_FILES].sort());
});

test('combined runner uses the real education row writer and typed page readback before continuing', async t => {
  const f = fixture();
  const { window } = f.dom;
  const doc = window.document;
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gth-full-real-education-'));
  t.after(() => { f.dom.window.close(); fs.rmSync(outDir, { recursive: true, force: true }); });
  Object.defineProperty(doc, 'readyState', { configurable: true, get: () => 'complete' });
  window.Element.prototype.getClientRects = function () {
    for (let node = this; node; node = node.parentElement) {
      if (node.style.display === 'none' || node.hidden) return [];
    }
    return this.isConnected ? [{ width: 8, height: 8 }] : [];
  };
  window.fetch = async () => ({ ok: true });
  const observed = { rowEdits: 0, cancels: 0, saves: 0, months: [] };
  const section = doc.querySelectorAll('.r-section')[1];
  section.querySelector('.title_ a').textContent = '添加';
  section.insertAdjacentHTML('beforeend', '<div class="sec-context"><div class="sec-detail"><a href="javascript:;" id="edu-row-edit"><i class="el-icon-edit-outline"></i>编辑</a><span>合成教育记录</span></div></div>');
  const textItem = (q, control) => `<div class="el-form-item"><label class="el-form-item__label">${q}</label><div class="el-form-item__content">${control}</div></div>`;
  const month = id => `<div class="el-date-editor el-date-editor--month"><span class="el-input__prefix"><i class="el-input__icon el-icon-date" id="${id}-icon"></i></span><input type="text" readonly id="${id}"></div>`;
  // Existing education-live fixture contracts, not captured live DOM. The
  // category already matches so this test does not duplicate category tests.
  doc.getElementById('edu-row-edit').addEventListener('click', event => {
    observed.rowEdits += 1;
    event.currentTarget.closest('.sec-detail').remove();
    const plain = ['毕业学校', '专业名称', '在校活动/职务', '在校成绩排名', '专业描述', '绩点', '学校所在地'];
    section.insertAdjacentHTML('beforeend', `<form class="el-form sec-form" id="real-edu-form">${plain.map(q => textItem(q,
      ['在校活动/职务', '专业描述'].includes(q) ? '<textarea></textarea>' : '<input type="text">')).join('')}
      ${textItem('是否统招', '<div class="el-radio-group"><label class="el-radio"><input style="display:none" type="radio" name="admissions"><span class="el-radio__label">是</span></label><label class="el-radio"><input style="display:none" type="radio" name="admissions"><span class="el-radio__label">否</span></label></div>')}
      ${textItem('学历', '<div class="el-select"><input type="text" readonly class="el-input__inner" id="edu-degree"></div>')}
      ${textItem('在校时间', month('edu-start') + month('edu-end'))}
      ${textItem('专业类别', '<div class="cascader-wrap"><div class="input-l pointer"><input type="text" readonly value="金融学"></div><div class="popover plugin-dialog-wrap" style="display:none"><input class="search-input" type="text"></div></div>')}
      <button type="button" id="edu-cancel">取消</button><button type="button" id="edu-save">保存</button></form>`);
    doc.body.insertAdjacentHTML('beforeend', `<div class="el-select-dropdown" id="edu-degree-panel" style="display:none"><ul><li class="el-select-dropdown__item">本科</li></ul></div>
      <div class="el-picker-panel el-date-picker" id="edu-month-panel" style="display:none"><div class="el-date-picker__header"><button type="button" class="el-icon-d-arrow-left"></button><span class="el-date-picker__header-label">2024 年</span><button type="button" class="el-icon-d-arrow-right"></button></div><table class="el-month-table"><tbody><tr>${['一','二','三','四','五','六','七','八','九','十','十一','十二'].map((label, index) => `<td data-month="${index + 1}"><a class="cell">${label}月</a></td>`).join('')}</tr></tbody></table></div>`);
    const degreePanel = doc.getElementById('edu-degree-panel');
    const monthPanel = doc.getElementById('edu-month-panel');
    const degree = doc.getElementById('edu-degree');
    degree.addEventListener('click', () => { degreePanel.style.display = degreePanel.style.display === 'none' ? '' : 'none'; });
    degreePanel.querySelector('li').addEventListener('click', () => { degree.value = '本科'; degreePanel.style.display = 'none'; });
    let selected;
    let year = 2024;
    for (const id of ['edu-start', 'edu-end']) {
      doc.getElementById(`${id}-icon`).addEventListener('click', () => { selected = doc.getElementById(id); monthPanel.style.display = ''; });
      doc.getElementById(id).addEventListener('keydown', event => { if (event.key === 'Escape') monthPanel.style.display = 'none'; });
    }
    for (const [selector, delta] of [['.el-icon-d-arrow-left', -1], ['.el-icon-d-arrow-right', 1]]) {
      monthPanel.querySelector(selector).addEventListener('click', () => { year += delta; monthPanel.querySelector('span').textContent = `${year} 年`; });
    }
    monthPanel.querySelectorAll('td').forEach(cell => cell.addEventListener('click', () => {
      selected.value = `${year}-${cell.dataset.month.padStart(2, '0')}`;
      observed.months.push(selected.value);
      monthPanel.style.display = 'none';
    }));
    doc.getElementById('edu-save').addEventListener('click', () => { observed.saves += 1; });
    doc.getElementById('edu-cancel').addEventListener('click', () => {
      observed.cancels += 1;
      doc.getElementById('real-edu-form').remove();
      // Leave the hidden teleported nodes to the shared discard cleanup.
    });
  });
  for (const item of SECTIONS.filter(item => item.id !== 'education')) {
    const node = doc.querySelectorAll('.r-section')[item.sectionIndex];
    node.querySelector('a').addEventListener('click', () => {
      void f.driver.open(item).then(() => node.querySelector('button').addEventListener('click', () => { void f.driver.cancel(item); }));
    });
  }
  const productCalls = [];
  const session = {
    async send(method, params, options = {}) {
      if (method !== 'Runtime.evaluate') return {};
      if (options.step?.startsWith('inject_') && options.step !== 'inject_gth-education.js') {
        for (const item of SECTIONS.filter(item => item.id !== 'education')) window[item.globalName] = { async trial() {
          productCalls.push(item.id);
          return (await f.driver.fill(item))[0];
        } };
        return { result: { value: { ok: true } } };
      }
      try { return { result: { value: await window.eval(params.expression) } }; }
      catch (error) { return { exceptionDetails: { text: error.message } }; }
    },
    close() {}
  };
  const evidence = await runGthFullResumeLive({
    env: { PORT: '9239', OUTDIR: outDir }, tipSha: '0e1b2b79',
    async getJson() { return [{ type: 'page', id: 'same-tab', url: PAGE, webSocketDebuggerUrl: 'ws://127.0.0.1:9239/devtools/page/same-tab' }]; },
    async connectCdp() { return session; }
  });
  const education = evidence.sections.find(item => item.id === 'education');
  assert.equal(education.open.writerOpensEditor, true);
  assert.equal(education.open.titleEditCount, 0);
  assert.equal(education.status, 'verified', JSON.stringify(education));
  assert.equal(education.fields.find(row => row.q === '毕业学校').value, '复旦大学');
  assert.equal(education.fields.find(row => row.q === '是否统招').value, '是');
  assert.equal(education.fields.find(row => row.q === '在校时间').value, '2020-09 至 2024-06');
  assert.equal(education.fields.find(row => row.q === '专业类别').value, '金融学');
  assert.equal(education.cancel.closed, true);
  assert.deepEqual(observed, { rowEdits: 1, cancels: 1, saves: 0, months: ['2020-09', '2024-06'] });
  assert.ok(productCalls.indexOf('work') > productCalls.indexOf('basic'));
  assert.ok(productCalls.includes('intent'));
  assert.ok(education.clicks.every(click => click.allowed));
  assert.equal(evidence.neverSave, true);
  assert.equal(evidence.liveSupportClaimed, false);
  assert.equal(doc.querySelectorAll('form,.el-picker-panel,.el-select-dropdown').length, 0);
});
