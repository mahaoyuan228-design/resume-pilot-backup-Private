import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { ensureVisible, runSections } from '../scripts/live/lib/gth-full-orchestrator.mjs';
import { SECTIONS, requestsFor } from '../scripts/live/lib/gth-full-sections.mjs';
import { EVIDENCE_NAME, evidenceExitCode, runGthFullResumeLive } from '../scripts/live/gth-full-resume-live.mjs';
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
          window[section.globalName] = { async trial() {
            productCalls.push(section.id);
            if (section.id === 'skills') {
              eventSink({ method: 'Fetch.requestPaused', params: { requestId: 'lookup', request: {
                method: 'POST', url: 'https://hr.gtht.com/interface/js/type/getsalaryunit.json?private=discard'
              } } });
              eventSink({ method: 'Fetch.requestPaused', params: { requestId: 'forbidden', request: {
                method: 'HEAD', url: 'https://hr.gtht.com/api/log?private=discard'
              } } });
            }
            return (await f.driver.fill(section))[0];
          } };
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
  assert.equal(evidence.liveSupportClaimed, false);
  assert.equal(window.document.querySelectorAll('form').length, 0);
  assert.equal(window.HTMLElement.prototype.click, originalClick);
  assert.equal(window.EventTarget.prototype.dispatchEvent, originalDispatch);
  assert.equal(window.HTMLFormElement.prototype.submit, originalSubmit);
  assert.equal(window.chrome, undefined);
  assert.ok(commands.some((command) => command.method === 'Fetch.disable'));
  assert.equal(closed, true);
  assert.deepEqual(fs.readdirSync(outDir), [EVIDENCE_NAME]);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(outDir, EVIDENCE_NAME), 'utf8')), JSON.parse(JSON.stringify(evidence)));
});
