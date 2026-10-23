/**
 * Decision logic for the CMS 自我评价 never-save runner.
 * jsdom covers the live DOM shape and the shipped engine write. No Edge.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import {
  BASE_TIP,
  EVIDENCE_NAME,
  FIXTURE_TEXT,
  LIVE_BINDING,
  LIVE_FILES,
  PLACEHOLDER,
  POWERSHELL,
  QUESTION,
  READBACK_WAIT_MS,
  RUNTIME_FILES,
  SECTION_NAME,
  SIGNATURE,
  assessReadback,
  buildEvidence,
  buildPageExpression,
  classifyCmsTabUrl,
  decideClicks,
  decideInspect,
  decideProductFill,
  evidenceExitCode,
  locateSelfEval,
  normalizeCmsLabel,
  partitionTraffic,
  readOutDir,
  readPort,
  readReactSignals,
  restorePlan,
  runCmsSelfEvalLive,
  selectCmsResumeTarget,
  selfEvalProfile,
  signalsMatch
} from '../scripts/live/cms-self-eval-live.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(new URL('../scripts/live/cms-self-eval-live.mjs', import.meta.url), 'utf8');
const LIVE_URL = 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html?recruitType=1&resumeId=fixture&tid=fixture&lang=1';
const ORIGINAL = '甲'.repeat(159);

function resumeTarget(url = LIVE_URL, id = 'tab-1') {
  return {
    type: 'page',
    id,
    url,
    title: '简历操作',
    webSocketDebuggerUrl: `ws://127.0.0.1:9239/devtools/page/${id}`
  };
}

function patchWindow(window) {
  window.Element.prototype.getClientRects = () => [{ width: 8, height: 8, top: 0, left: 0, bottom: 8, right: 8 }];
  Object.defineProperty(window.document, 'readyState', { configurable: true, get: () => 'complete' });
  Object.defineProperty(window.document, 'visibilityState', { configurable: true, get: () => 'visible' });
}

function domFor(html, url = LIVE_URL) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, {
    url,
    pretendToBeVisual: true,
    runScripts: 'dangerously'
  });
  patchWindow(dom.window);
  return dom;
}

function probeHtml({ extraEval = '', heading = '<div class="tit"><p>自我评价</p>必填</div>', placeholder = PLACEHOLDER } = {}) {
  return `<form id="resume-form">
    <section class="form-cell"><div class="tit-wrap"><div class="tit">个人基本信息必填</div></div></section>
    <section class="form-cell" id="self-section">
      <div class="tit-wrap">${heading}</div>
      <i class="anchor-title">自我评价</i>
      <div class="ant-row ant-form-item">
        <div class="ant-col ant-form-item-label"><label>评价内容*</label></div>
        <div class="ant-form-item-control"><textarea id="eval" class="ant-input" placeholder="${placeholder}"></textarea></div>
      </div>
      ${extraEval}
    </section>
    <section class="form-cell"><div class="tit-wrap"><div class="tit">教育经历必填</div></div>
      <div class="ant-form-item">
        <div class="ant-form-item-label"><label>专业描述</label></div>
        <textarea id="major" class="ant-input" placeholder="请填写专业描述">keep-me</textarea>
      </div>
    </section>
    <button id="save" type="button">保存</button>
    <button id="submit" type="submit">提交</button>
    <button id="deliver" type="button">投递</button>
  </form>`;
}

test('label normalization matches the shipped matcher and the fixture is exact', () => {
  const dom = domFor('<div></div>');
  const script = dom.window.document.createElement('script');
  script.textContent = fs.readFileSync(path.join(repoRoot, 'src/core/matcher.js'), 'utf8');
  dom.window.document.body.append(script);
  for (const label of ['评价内容*', '评价内容', '自我评价必填', '评价内容（必填）', '个人基本信息必填']) {
    assert.equal(normalizeCmsLabel(label), dom.window.ResumeMatcher.normalize(label));
  }
  assert.equal(normalizeCmsLabel('评价内容*'), QUESTION);
  assert.equal(QUESTION, '评价内容');
  assert.equal(SECTION_NAME, '自我评价必填');
  assert.equal(PLACEHOLDER, '请填写评价内容');
  assert.deepEqual(SIGNATURE, ['个人基本信息必填', '自我评价必填', '教育经历必填']);
  assert.equal(FIXTURE_TEXT, '熟悉 Python 与数据分析，能把业务问题整理成可复核的结论。');
  assert.equal(READBACK_WAIT_MS, 500);
  assert.equal(LIVE_BINDING.profileHash.length, 64);
  const profile = selfEvalProfile(FIXTURE_TEXT);
  assert.deepEqual(profile.confirmedFields, ['selfEvaluation']);
  assert.deepEqual(profile.education, []);
  assert.equal(profile.selfEvaluation, FIXTURE_TEXT);
});

test('locate accepts the probed heading and the census heading, and stops on a changed control', () => {
  const probed = domFor(probeHtml());
  probed.window.document.getElementById('eval').value = ORIGINAL;
  const found = locateSelfEval(probed.window.document);
  assert.equal(found.ok, true);
  assert.equal(found.anchorSeen, true);
  assert.equal(found.original, ORIGINAL);
  assert.equal(found.textarea.id, 'eval');

  const census = domFor(probeHtml({ heading: '<div class="tit">自我评价必填</div>' }));
  const censusFound = locateSelfEval(census.window.document);
  assert.equal(censusFound.ok, true);
  assert.equal(censusFound.anchorSeen, true);

  const duplicate = domFor(probeHtml({
    extraEval: '<div class="ant-form-item"><div class="ant-form-item-label"><label>评价内容*</label></div><textarea class="ant-input" placeholder="请填写评价内容"></textarea></div>'
  }));
  assert.equal(locateSelfEval(duplicate.window.document).detail, 'textarea_not_unique');

  const renamed = domFor(probeHtml({ heading: '<div class="tit"><p>自我评价</p></div>' }));
  assert.equal(locateSelfEval(renamed.window.document).reason, 'section_structure_changed');

  const placeholder = domFor(probeHtml({ placeholder: '请填写其他内容' }));
  assert.equal(locateSelfEval(placeholder.window.document).detail, 'placeholder_changed');

  const locked = domFor(probeHtml());
  locked.window.document.getElementById('eval').readOnly = true;
  assert.equal(locateSelfEval(locked.window.document).detail, 'not_editable');
});

test('inspect, readback, and restore decisions follow the shipped binding', () => {
  assert.equal(decideInspect({
    path: 'selfEvaluation',
    key: 'selfEvaluation',
    kind: 'textarea',
    labels: ['评价内容*'],
    reason: 'existing_value',
    currentValue: ORIGINAL
  }, ORIGINAL).action, 'fill');
  assert.equal(decideInspect({
    path: 'selfEvaluation',
    key: 'selfEvaluation',
    kind: 'textarea',
    labels: ['专业描述'],
    reason: 'ready',
    currentValue: ''
  }, '').detail, 'label_not_evaluation');
  assert.equal(decideInspect({
    path: 'phone',
    key: 'phone',
    kind: 'textarea',
    labels: ['评价内容*'],
    reason: 'ready',
    currentValue: ''
  }, '').detail, 'binding_missing');
  assert.equal(decideProductFill({ path: 'selfEvaluation', status: 'verified', reason: 'readback_matched' }).ok, true);
  assert.equal(decideProductFill({ path: 'selfEvaluation', status: 'skipped', reason: 'existing_value' }).ok, false);
  assert.equal(decideProductFill({ path: 'selfEvaluation', status: 'verified', reason: 'preexisting_same_value' }).ok, false);

  const signals = [{ via: 'value_tracker', value: FIXTURE_TEXT }, { via: 'memoized_props', value: FIXTURE_TEXT }];
  assert.deepEqual(assessReadback({
    dom: FIXTURE_TEXT,
    signals,
    expected: FIXTURE_TEXT,
    waitedMs: 500,
    blurred: true
  }), { ok: true, reason: 'readback_matched' });
  assert.equal(assessReadback({
    dom: FIXTURE_TEXT,
    signals,
    expected: FIXTURE_TEXT,
    waitedMs: 499,
    blurred: true
  }).reason, 'react_wait_not_met');
  assert.equal(assessReadback({
    dom: FIXTURE_TEXT,
    signals: [],
    expected: FIXTURE_TEXT,
    waitedMs: 500,
    blurred: true
  }).reason, 'react_state_not_observed');
  assert.equal(assessReadback({
    dom: FIXTURE_TEXT,
    signals: [{ via: 'value_tracker', value: ORIGINAL }],
    expected: FIXTURE_TEXT,
    waitedMs: 500,
    blurred: true
  }).reason, 'react_state_mismatch');
  assert.equal(assessReadback({
    dom: ORIGINAL,
    signals,
    expected: FIXTURE_TEXT,
    waitedMs: 500,
    blurred: true
  }).reason, 'readback_mismatch');
  assert.equal(restorePlan(ORIGINAL).action, 'product_fill');
  assert.equal(restorePlan('').action, 'native_events');
  assert.equal(restorePlan('   ').action, 'native_events');
  assert.equal(decideClicks([]).ok, true);
  assert.equal(decideClicks([{ type: 'click', label: '保存' }]).reason, 'refusing_forbidden_click');
  assert.equal(decideClicks([{ type: 'click', label: '编辑' }]).reason, 'click_not_allowed');
  assert.equal(signalsMatch(signals, FIXTURE_TEXT), true);
  assert.equal(signalsMatch([], FIXTURE_TEXT), false);
});

test('tab selection stays on the baseline resume page and every non-GET fails', () => {
  assert.equal(classifyCmsTabUrl(LIVE_URL).ok, true);
  assert.equal(classifyCmsTabUrl(`${LIVE_URL}#section`).ok, true);
  assert.equal(classifyCmsTabUrl('https://wecruit.hotjob.cn/SU661f37091eb8053acd6cdf3d/pb/resumeOperation.html').ok, false);
  assert.equal(classifyCmsTabUrl('https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/mc/deliver/operationResumer').ok, false);
  assert.equal(classifyCmsTabUrl('http://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html').ok, false);
  assert.equal(selectCmsResumeTarget([
    resumeTarget(),
    { type: 'page', url: 'https://example.com/', webSocketDebuggerUrl: 'ws://127.0.0.1:9239/devtools/page/other' }
  ]).action, 'attach');
  assert.equal(selectCmsResumeTarget([resumeTarget(LIVE_URL, 'a'), resumeTarget(LIVE_URL, 'b')]).reason, 'tab_ambiguous');
  assert.equal(selectCmsResumeTarget([{ type: 'page', url: 'https://example.com/' }]).reason, 'tab_not_found');

  const traffic = partitionTraffic([
    { method: 'GET', url: `${LIVE_URL}&token=secret`, via: 'fetch' },
    { method: 'HEAD', url: 'https://wecruit.hotjob.cn/wecruit/resume/save?token=secret', via: 'xhr' },
    { method: 'POST', url: 'https://wecruit.hotjob.cn/wecruit/resume/save?resumeId=abc', via: 'xhr' },
    { method: 'POST', url: 'https://wecruit.hotjob.cn/wecruit/resume/save?resumeId=abc', via: 'xhr' },
    { method: 'OPTIONS', url: 'https://wecruit.hotjob.cn/wecruit/resume/save', via: 'fetch' }
  ]);
  assert.equal(traffic.nonGet.length, 3);
  assert.deepEqual(traffic.saveLikePost, traffic.nonGet);
  assert.equal(JSON.stringify(traffic).includes('secret'), false);
  assert.equal(JSON.stringify(traffic).includes('resumeId'), false);
  assert.equal(traffic.nonGet.some((row) => row.method === 'POST' && row.url === 'https://wecruit.hotjob.cn/wecruit/resume/save'), true);
});

test('evidence exit codes stay never-save and do not claim live support', () => {
  const success = buildEvidence({
    tipSha: 'abc1234',
    fields: [{ q: QUESTION, status: 'verified', reason: 'readback_matched', value: FIXTURE_TEXT }],
    nonGet: [],
    finalDetails: { restored: true, pageLeftAsFound: true, clickCount: 0, reason: null }
  });
  success.finalDetails.exitCode = evidenceExitCode(success);
  assert.equal(success.finalDetails.exitCode, 0);
  assert.equal(success.neverSave, true);
  assert.equal(success.liveSupportClaimed, false);
  assert.equal(success.fields[0].value, FIXTURE_TEXT);

  const posted = buildEvidence({
    tipSha: BASE_TIP,
    fields: [{ q: QUESTION, status: 'verified', reason: 'readback_matched', value: FIXTURE_TEXT }],
    nonGet: [{ method: 'POST', url: 'https://wecruit.hotjob.cn/wecruit/resume/save', via: 'xhr' }],
    finalDetails: { restored: true, pageLeftAsFound: true, clickCount: 0, reason: 'non_get_request' }
  });
  assert.equal(evidenceExitCode(posted), 3);
  assert.equal(posted.saveLikePost.length, 1);

  const clicked = buildEvidence({
    tipSha: BASE_TIP,
    fields: [{ q: QUESTION, status: 'failed', reason: 'refusing_forbidden_click', value: null }],
    nonGet: [],
    finalDetails: { restored: true, pageLeftAsFound: true, clickCount: 1, reason: 'refusing_forbidden_click', bannedClick: true }
  });
  assert.equal(evidenceExitCode(clicked), 3);
  assert.equal(evidenceExitCode(buildEvidence({
    tipSha: BASE_TIP,
    fields: [{ q: QUESTION, status: 'failed', reason: 'cdp_unreachable', value: null }],
    finalDetails: { reason: 'cdp_unreachable', clickCount: 0 }
  })), 1);
  assert.equal(evidenceExitCode(buildEvidence({
    tipSha: BASE_TIP,
    fields: [{ q: QUESTION, status: 'failed', reason: 'tab_not_found', value: null }],
    finalDetails: { reason: 'tab_not_found', clickCount: 0 }
  })), 2);
  assert.equal(readPort({ PORT: '9239' }), 9239);
  assert.equal(readOutDir({ OUTDIR: 'out' }, '/tmp/cms'), path.resolve('/tmp/cms', 'out'));
  assert.throws(() => readPort({ PORT: '0' }), /bad port/);
});

test('jsdom installs a non-dispatching click guard and blocks non-GET without clicking', async () => {
  const dom = domFor(probeHtml());
  const { window } = dom;
  let saveClicks = 0;
  let gets = 0;
  window.document.getElementById('save').addEventListener('click', () => { saveClicks += 1; });
  window.fetch = async (url, init = {}) => {
    gets += 1;
    return { ok: true, url: String(url), method: String(init.method || 'GET') };
  };
  window.navigator.sendBeacon = () => true;
  const originalClick = window.HTMLElement.prototype.click;
  const script = window.document.createElement('script');
  script.textContent = buildPageExpression();
  window.document.body.append(script);
  const api = window.__cmsSelfEvalLive;
  assert.notEqual(window.HTMLElement.prototype.click, originalClick);
  assert.match(String(window.HTMLElement.prototype.click), /clicks\.push/);
  assert.doesNotMatch(String(window.HTMLElement.prototype.click), /originalClick|dispatchEvent/);
  assert.equal(saveClicks, 0);
  assert.equal(api.clicks().length, 0);
  await assert.rejects(window.fetch('https://wecruit.hotjob.cn/wecruit/resume/save?token=secret', { method: 'POST' }));
  const xhr = new window.XMLHttpRequest();
  xhr.open('PUT', 'https://wecruit.hotjob.cn/wecruit/resume/save?resumeId=abc');
  xhr.send('{}');
  assert.equal(window.navigator.sendBeacon('https://wecruit.hotjob.cn/collect?x=1', '{}'), false);
  await window.fetch('https://wecruit.hotjob.cn/wecruit/isLogin/SU629dbc0c0dcad452299bc0f7', { method: 'GET' });
  const posts = api.posts();
  assert.equal(posts.length, 3);
  assert.equal(JSON.stringify(posts).includes('secret'), false);
  assert.equal(JSON.stringify(posts).includes('resumeId'), false);
  assert.equal(gets, 1);
  const stopped = await api.run();
  assert.equal(stopped.ok, false);
  assert.equal(stopped.reason, 'engine_listener_missing');
  assert.equal(stopped.fillCalls.length, 0);
  api.restore();
  assert.equal(window.HTMLElement.prototype.click, originalClick);
});

test('a changed section stops before any product write', async () => {
  const dom = domFor(probeHtml({ heading: '<div class="tit"><p>自我评价</p></div>' }));
  dom.window.document.getElementById('eval').value = ORIGINAL;
  const script = dom.window.document.createElement('script');
  script.textContent = buildPageExpression();
  dom.window.document.body.append(script);
  const stopped = await dom.window.__cmsSelfEvalLive.run();
  assert.equal(stopped.reason, 'section_structure_changed');
  assert.equal(stopped.pageLeftAsFound, true);
  assert.equal(stopped.fillCalls.length, 0);
  assert.equal(dom.window.document.getElementById('eval').value, ORIGINAL);
});

test('shipped engine fill writes the fixture and restores the original without clicks', async () => {
  const dom = domFor(probeHtml());
  const { window } = dom;
  const textarea = window.document.getElementById('eval');
  const major = window.document.getElementById('major');
  textarea.value = ORIGINAL;
  const props = { value: ORIGINAL };
  const fiber = { memoizedProps: props, memoizedState: null, return: null };
  textarea.__reactFiber$eval = fiber;
  let tracked = ORIGINAL;
  textarea._valueTracker = {
    getValue: () => tracked,
    setValue: (value) => { tracked = String(value ?? ''); }
  };
  let evalInputs = 0;
  let majorInputs = 0;
  textarea.addEventListener('input', () => {
    evalInputs += 1;
    const desc = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
    const live = desc.get.call(textarea);
    tracked = live;
    props.value = live;
  });
  major.addEventListener('input', () => { majorInputs += 1; });
  let saveClicks = 0;
  let submitEvents = 0;
  window.document.getElementById('save').addEventListener('click', () => { saveClicks += 1; });
  window.document.getElementById('resume-form').addEventListener('submit', (event) => {
    event.preventDefault();
    submitEvents += 1;
  });
  let gets = 0;
  window.fetch = async () => {
    gets += 1;
    return { ok: true, json: async () => ({ state: 200 }) };
  };
  const listeners = new Set();
  window.chrome = {
    runtime: {
      id: 'cms-self-eval-live-test',
      getManifest: () => ({ background: { service_worker: 'src/background/worker.mjs' } }),
      sendMessage: async (message) => (message?.type === 'RESUME_PROFILE_BINDING_CHECK' ? { allowed: true } : { allowed: false }),
      onMessage: {
        addListener(fn) { listeners.add(fn); },
        removeListener(fn) { listeners.delete(fn); },
        hasListener(fn) { return listeners.has(fn); },
        hasListeners() { return listeners.size > 0; }
      }
    }
  };
  for (const rel of ['src/core/matcher.js', 'src/content/cms-session.js', 'src/content/engine.js']) {
    const script = window.document.createElement('script');
    script.textContent = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
    window.document.body.append(script);
  }
  const install = window.document.createElement('script');
  install.textContent = buildPageExpression();
  window.document.body.append(install);
  const seen = [];
  const blanks = [];
  const raw = window.__resumeQuickFillEngineListener;
  window.__resumeQuickFillEngineListener = function wrapped(message, sender, sendResponse) {
    if (message?.type === 'RESUME_FILL') {
      const desc = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
      blanks.push(desc.get.call(textarea));
      seen.push(message.profile?.selfEvaluation);
    }
    return raw.call(this, message, sender, sendResponse);
  };
  const result = await window.__cmsSelfEvalLive.run();
  assert.equal(result.ok, true, JSON.stringify({ reason: result.reason, detail: result.detail, readback: result.readback, restore: result.restore, productReason: result.productReason }));
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.readbackValue, FIXTURE_TEXT);
  assert.equal(result.productReason, 'readback_matched');
  assert.equal(result.restore.via, 'product');
  assert.equal(result.pageLeftAsFound, true);
  assert.equal(result.anchorSeen, true);
  assert.equal(result.originalLength, 159);
  assert.equal(result.waitedMs, 500);
  assert.equal(result.blurred, true);
  assert.ok(result.reactVia.includes('value_tracker'));
  assert.ok(result.reactVia.includes('memoized_props'));
  assert.deepEqual(seen, [FIXTURE_TEXT, ORIGINAL]);
  assert.deepEqual(blanks, ['', '']);
  assert.equal(textarea.value, ORIGINAL);
  assert.equal(props.value, ORIGINAL);
  assert.equal(tracked, ORIGINAL);
  assert.equal(readReactSignals(textarea).every((row) => row.value === ORIGINAL), true);
  assert.equal(major.value, 'keep-me');
  assert.equal(majorInputs, 0);
  assert.equal(evalInputs, 2);
  assert.equal(saveClicks, 0);
  assert.equal(submitEvents, 0);
  assert.equal(window.__cmsSelfEvalLive.clicks().length, 0);
  assert.equal(gets, 1);
  assert.equal(JSON.stringify(result).includes('甲'), false);
  assert.equal(JSON.stringify(window.__cmsSelfEvalLive.posts()), '[]');
});

function happyOutcome() {
  return {
    ok: true,
    reason: null,
    liveSupportClaimed: false,
    originalLength: 159,
    readbackValue: FIXTURE_TEXT,
    readback: { ok: true, reason: 'readback_matched' },
    restore: { ok: true, via: 'product', reason: 'restored' },
    otherChanged: false,
    unexpectedWrites: [],
    clickCount: 0,
    clicks: [],
    anchorSeen: true,
    fillCalls: [
      { index: 0, length: FIXTURE_TEXT.length },
      { index: 1, length: 159 }
    ],
    productReason: 'readback_matched',
    reactVia: ['value_tracker', 'memoized_props'],
    blurred: true,
    waitedMs: 500,
    pageLeftAsFound: true
  };
}

function fakeSession(answers) {
  const steps = [];
  return {
    steps,
    async send(method, params, options = {}) {
      steps.push(options.step || method);
      if (method !== 'Runtime.evaluate') return {};
      const value = answers[options.step];
      if (value instanceof Error) {
        const error = new Error(value.message);
        error.reason = 'eval_failed';
        throw error;
      }
      return { result: { value } };
    },
    close() { steps.push('close'); }
  };
}

async function runFake(answers, { getJson, connectCdp } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-self-eval-'));
  const session = fakeSession(answers);
  const evidence = await runCmsSelfEvalLive({
    port: 9239,
    outDir: dir,
    tipSha: BASE_TIP,
    stepTimeoutMs: 1000,
    repoRoot,
    getJson: getJson || (async () => [resumeTarget()]),
    connectCdp: connectCdp || (async () => session)
  });
  return { dir, session, evidence };
}

function happyAnswers(extra = {}) {
  return {
    page_guard: {
      href: LIVE_URL,
      title: '简历操作',
      readyState: 'complete',
      visible: 'visible',
      password: false
    },
    chrome_shim: { ok: true, installed: true },
    install_live: { ok: true },
    inject_matcher: { ok: true },
    'inject_cms-session': { ok: true },
    inject_engine: { ok: true },
    inject_check: { matcher: true, session: true, engine: true },
    self_eval_run: happyOutcome(),
    read_posts: [],
    read_clicks: [],
    ...extra
  };
}

test('a fake CDP run injects the shipped engine and writes never-save evidence', async () => {
  const { evidence, session } = await runFake(happyAnswers());
  assert.equal(evidence.neverSave, true);
  assert.equal(evidence.liveSupportClaimed, false);
  assert.equal(evidence.tipSha, BASE_TIP);
  assert.equal(evidence.finalDetails.exitCode, 0);
  assert.equal(evidence.finalDetails.baseTip, BASE_TIP);
  assert.equal(evidence.finalDetails.pageLeftAsFound, true);
  assert.equal(evidence.finalDetails.restoreVia, 'product');
  assert.deepEqual(evidence.saveLikePost, []);
  assert.deepEqual(evidence.fields, [{
    q: QUESTION,
    status: 'verified',
    reason: 'readback_matched',
    value: FIXTURE_TEXT
  }]);
  assert.deepEqual(session.steps.filter((step) => step.startsWith('inject_')), [
    'inject_matcher',
    'inject_cms-session',
    'inject_engine',
    'inject_check'
  ]);
  assert.equal(session.steps.includes('self_eval_run'), true);
  assert.equal(JSON.stringify(evidence).includes('resumeId'), false);
  const file = JSON.parse(fs.readFileSync(evidence.finalDetails.path, 'utf8'));
  assert.equal(file.liveSupportClaimed, false);
  assert.equal(file.neverSave, true);
  assert.equal(path.basename(evidence.finalDetails.path), EVIDENCE_NAME);
});

test('a non-GET and a forbidden click fail the run', async () => {
  const posted = await runFake(happyAnswers({
    read_posts: [{ method: 'POST', url: 'https://wecruit.hotjob.cn/wecruit/resume/save?token=secret', via: 'xhr' }]
  }));
  assert.equal(posted.evidence.finalDetails.exitCode, 3);
  assert.equal(posted.evidence.finalDetails.reason, 'non_get_request');
  assert.equal(posted.evidence.nonGet.length, 1);
  assert.equal(posted.evidence.saveLikePost[0].url, 'https://wecruit.hotjob.cn/wecruit/resume/save');
  assert.equal(JSON.stringify(posted.evidence).includes('token'), false);

  const clicked = await runFake(happyAnswers({
    read_clicks: [{ type: 'click', label: '保存' }]
  }));
  assert.equal(clicked.evidence.finalDetails.exitCode, 3);
  assert.equal(clicked.evidence.finalDetails.reason, 'refusing_forbidden_click');
  assert.equal(clicked.evidence.fields[0].status, 'failed');
  assert.equal(clicked.evidence.liveSupportClaimed, false);
});

test('CDP failures and a missing baseline tab still write never-save evidence', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-self-eval-down-'));
  let connected = false;
  const down = await runCmsSelfEvalLive({
    port: 9239,
    outDir: dir,
    tipSha: BASE_TIP,
    stepTimeoutMs: 1000,
    repoRoot,
    getJson: async () => { throw new Error('connect ECONNREFUSED'); },
    connectCdp: async () => { connected = true; throw new Error('no socket'); }
  });
  assert.equal(connected, false);
  assert.equal(down.finalDetails.reason, 'cdp_unreachable');
  assert.equal(down.finalDetails.exitCode, 1);
  assert.equal(down.neverSave, true);
  assert.equal(down.liveSupportClaimed, false);
  assert.deepEqual(down.saveLikePost, []);

  const missing = await runCmsSelfEvalLive({
    port: 9239,
    outDir: dir,
    tipSha: BASE_TIP,
    stepTimeoutMs: 1000,
    repoRoot,
    getJson: async () => [{ type: 'page', id: 'other', url: 'https://example.com/', webSocketDebuggerUrl: 'ws://127.0.0.1:9239/devtools/page/x' }],
    connectCdp: async () => { connected = true; throw new Error('no socket'); }
  });
  assert.equal(connected, false);
  assert.equal(missing.finalDetails.reason, 'tab_not_found');
  assert.equal(missing.finalDetails.exitCode, 2);

  const login = await runFake(happyAnswers({
    page_guard: {
      href: LIVE_URL,
      title: '登录',
      readyState: 'complete',
      visible: 'visible',
      password: true
    }
  }));
  assert.equal(login.evidence.finalDetails.reason, 'needs_login');
  assert.equal(login.session.steps.includes('self_eval_run'), false);
  assert.equal(login.evidence.finalDetails.exitCode, 2);
});

test('the import graph is the runner plus the shipped CMS fill files', () => {
  const seen = new Set();
  function walk(rel) {
    if (seen.has(rel)) return;
    seen.add(rel);
    const text = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
    for (const match of text.matchAll(/from '(\.[^']+)'/gu)) {
      const resolved = path.normalize(path.join(path.dirname(rel), match[1])).split(path.sep).join('/');
      walk(resolved);
    }
  }
  walk('scripts/live/cms-self-eval-live.mjs');
  for (const rel of LIVE_FILES) seen.add(rel);
  assert.deepEqual([...seen].sort(), [...RUNTIME_FILES].sort());
  for (const rel of RUNTIME_FILES) assert.equal(fs.existsSync(path.join(repoRoot, rel)), true, rel);
  assert.deepEqual(LIVE_FILES, [
    'src/core/matcher.js',
    'src/content/cms-session.js',
    'src/content/engine.js'
  ]);
});

test('help prints the PowerShell command and the runner does not claim support or click', () => {
  const help = spawnSync(process.execPath, ['scripts/live/cms-self-eval-live.mjs', '--help'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
  assert.equal(help.status, 0);
  assert.equal(help.stdout.includes(POWERSHELL), true);
  assert.match(help.stdout, /\$env:PORT='9239'/);
  assert.match(help.stdout, /\$env:OUTDIR='.'/);
  assert.match(help.stdout, /node scripts\/live\/cms-self-eval-live\.mjs/);
  assert.match(source, /RESUME_FILL/);
  assert.match(source, /__resumeQuickFillEngineListener/);
  assert.match(source, /selfEvaluation/);
  assert.doesNotMatch(source, /\.click\(/);
  assert.doesNotMatch(source, /liveSupportClaimed\s*[:=]\s*true/);
  assert.doesNotMatch(source, /BEGIN PRIVATE KEY/);
  assert.equal(source.includes('SU661f37091eb8053acd6cdf3d'), false);
});
