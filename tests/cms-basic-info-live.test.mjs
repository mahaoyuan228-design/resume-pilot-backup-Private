/**
 * Decision logic for the CMS 个人基本信息 never-save runner.
 * jsdom covers the live DOM shape and the shipped engine write. No Edge.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import {
  ANCHOR_NAME,
  BASE_TIP,
  EVIDENCE_NAME,
  FIELD_SPECS,
  LIVE_BINDING,
  LIVE_FILES,
  POWERSHELL,
  READBACK_WAIT_MS,
  RUNTIME_FILES,
  SECTION_NAME,
  SIGNATURE,
  assessReadback,
  basicInfoProfile,
  buildEvidence,
  buildPageExpression,
  classifyCmsTabUrl,
  decideClicks,
  decideInspect,
  decideProductFill,
  evidenceExitCode,
  fixtureProfile,
  locateBasicFields,
  normalizeCmsLabel,
  partitionTraffic,
  plannedFields,
  readOutDir,
  readPort,
  readReactSignals,
  restorePlan,
  runCmsBasicInfoLive,
  selectCmsResumeTarget,
  signalsMatch
} from '../scripts/live/cms-basic-info-live.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(new URL('../scripts/live/cms-basic-info-live.mjs', import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
const LIVE_URL = 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html?recruitType=1&resumeId=fixture&tid=fixture&lang=1';
const ORIGINALS = Object.freeze({
  fullName: '原姓名',
  phone: '13900001111',
  email: 'kept@example.test'
});
const FIELD_IDS = Object.freeze({ fullName: 'name', phone: 'phone', email: 'email' });

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

function fieldHtml(spec, id, placeholder = spec.placeholder) {
  return `<div class="ant-row ant-form-item">
    <div class="ant-col ant-form-item-label"><label>${spec.rawLabel}</label></div>
    <div class="ant-form-item-control"><input id="${id}" class="ant-input" type="text" placeholder="${placeholder}"></div>
  </div>`;
}

function probeHtml({
  heading = '<div class="tit"><p>个人基本信息</p>必填</div>',
  placeholders = {},
  duplicateName = false,
  educationHeading = '教育经历必填',
  attachmentHeading = ''
} = {}) {
  const duplicate = duplicateName ? fieldHtml(FIELD_SPECS[0], 'name-2') : '';
  const education = educationHeading ? `<section class="form-cell"><div class="tit-wrap"><div class="tit">${educationHeading}</div></div>
      <textarea id="major" class="ant-input" placeholder="请填写专业描述">keep-major</textarea>
    </section>` : '';
  const attachment = attachmentHeading ? `<section class="form-cell"><div class="tit-wrap"><div class="tit">${attachmentHeading}</div></div></section>` : '';
  return `<form id="resume-form">
    <section class="form-cell" id="basic-section">
      <div class="tit-wrap">${heading}</div>
      <i class="anchor-title">个人基本信息</i>
      <div class="form-cell-right"><div class="form-cell-inner">
        ${fieldHtml(FIELD_SPECS[0], 'name', placeholders.fullName)}
        ${duplicate}
        <div class="ant-row ant-form-item">
          <div class="ant-col ant-form-item-label"><label>性别*</label></div>
          <div class="ant-form-item-control">
            <label class="ant-radio-wrapper"><input id="gender-m" type="radio" checked>男</label>
            <label class="ant-radio-wrapper"><input id="gender-f" type="radio">女</label>
          </div>
        </div>
        <div class="ant-row ant-form-item" id="marital-item">
          <div class="ant-col ant-form-item-label"><label>婚姻状况*</label></div>
          <div class="ant-form-item-control">
            <div class="ant-select ant-select-enabled">
              <div id="marital" class="ant-select-selection ant-select-selection--single" role="combobox" aria-expanded="false"><span class="ant-select-selection-selected-value">未婚</span></div>
              <input type="text" role="combobox" style="display:none">
            </div>
          </div>
        </div>
        <div class="ant-row ant-form-item">
          <div class="ant-col ant-form-item-label"><label>证件号码*</label></div>
          <div class="ant-form-item-control"><input id="id-no" class="ant-input" type="text" placeholder="请填写证件号码" value="keep-id"></div>
        </div>
        ${fieldHtml(FIELD_SPECS[1], 'phone', placeholders.phone)}
        ${fieldHtml(FIELD_SPECS[2], 'email', placeholders.email)}
      </div></div>
    </section>
    <section class="form-cell"><div class="tit-wrap"><div class="tit">自我评价必填</div></div>
      <div class="ant-form-item">
        <div class="ant-form-item-label"><label>评价内容*</label></div>
        <textarea id="eval" class="ant-input" placeholder="请填写评价内容">keep-eval</textarea>
      </div>
    </section>
    ${education}
    ${attachment}
    <button id="save" type="button">保存</button>
    <button id="submit" type="submit">提交</button>
    <button id="deliver" type="button">投递</button>
  </form>`;
}

function installChrome(window) {
  const listeners = new Set();
  window.chrome = {
    runtime: {
      id: 'cms-basic-info-live-test',
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
}

function injectProduct(window) {
  for (const rel of LIVE_FILES) {
    const script = window.document.createElement('script');
    script.textContent = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
    window.document.body.append(script);
  }
}

function installLive(window) {
  const script = window.document.createElement('script');
  script.textContent = buildPageExpression();
  window.document.body.append(script);
}

test('label normalization matches the shipped matcher and the basic fixtures are exact', () => {
  const dom = domFor('<div></div>');
  const script = dom.window.document.createElement('script');
  script.textContent = fs.readFileSync(path.join(repoRoot, 'src/core/matcher.js'), 'utf8');
  dom.window.document.body.append(script);
  const matcher = dom.window.ResumeMatcher;
  for (const spec of FIELD_SPECS) {
    assert.equal(normalizeCmsLabel(spec.rawLabel), matcher.normalize(spec.rawLabel));
    assert.equal(normalizeCmsLabel(spec.rawLabel), spec.q);
    assert.equal(matcher.classify([spec.rawLabel]).key, spec.key);
  }
  assert.equal(SECTION_NAME, '个人基本信息必填');
  assert.equal(ANCHOR_NAME, '个人基本信息');
  assert.deepEqual(SIGNATURE, ['个人基本信息必填', '自我评价必填']);
  assert.equal(SIGNATURE.includes('个人基本信息必填'), true);
  assert.equal(SIGNATURE.includes('附件信息选填'), false);
  assert.equal(SIGNATURE.filter((name) => name === SECTION_NAME).length, 1);
  assert.deepEqual(FIELD_SPECS.map((spec) => spec.path), ['fullName', 'phone', 'email']);
  assert.equal(FIELD_SPECS[0].fixture, '试用甲');
  assert.equal(FIELD_SPECS[1].fixture, '13800138000');
  assert.equal(FIELD_SPECS[2].fixture, 'cms-basic@example.test');
  assert.equal(READBACK_WAIT_MS, 500);
  assert.equal(LIVE_BINDING.profileHash.length, 64);
  const profile = fixtureProfile();
  assert.deepEqual(profile.confirmedFields, ['fullName', 'phone', 'email']);
  assert.equal(profile.fullName, '试用甲');
  assert.equal(profile.phone, '13800138000');
  assert.equal(profile.email, 'cms-basic@example.test');
  assert.deepEqual(profile.education, []);
  assert.deepEqual(basicInfoProfile({ fullName: '试用甲' }).confirmedFields, ['fullName']);
  assert.equal(Object.hasOwn(basicInfoProfile({ fullName: '试用甲' }), 'phone'), false);
});

test('locate accepts the probed heading and stops on a changed control', () => {
  const probed = domFor(probeHtml());
  for (const spec of FIELD_SPECS) probed.window.document.getElementById(FIELD_IDS[spec.path]).value = ORIGINALS[spec.path];
  const found = locateBasicFields(probed.window.document);
  assert.equal(found.ok, true);
  assert.equal(found.anchorSeen, true);
  assert.deepEqual(found.fields.map((row) => row.spec.path), ['fullName', 'phone', 'email']);
  assert.equal(found.fields[0].original, ORIGINALS.fullName);
  assert.equal(found.fields[0].input.id, 'name');

  const census = domFor(probeHtml({ heading: '<div class="tit">个人基本信息必填</div>' }));
  assert.equal(locateBasicFields(census.window.document).ok, true);

  const duplicate = domFor(probeHtml({ duplicateName: true }));
  assert.equal(locateBasicFields(duplicate.window.document).detail, 'input_not_unique');

  const renamed = domFor(probeHtml({ heading: '<div class="tit"><p>个人基本信息</p></div>' }));
  assert.equal(locateBasicFields(renamed.window.document).reason, 'section_structure_changed');

  const placeholder = domFor(probeHtml({ placeholders: { email: '请填写其他邮箱' } }));
  assert.equal(locateBasicFields(placeholder.window.document).detail, 'placeholder_changed');

  const locked = domFor(probeHtml());
  locked.window.document.getElementById('phone').readOnly = true;
  assert.equal(locateBasicFields(locked.window.document).detail, 'not_editable');

  const withoutAttachment = domFor(probeHtml({ educationHeading: '', attachmentHeading: '' }));
  assert.equal(probeHtml({ educationHeading: '', attachmentHeading: '' }).includes('附件信息选填'), false);
  assert.equal(probeHtml({ educationHeading: '', attachmentHeading: '' }).includes('教育经历必填'), false);
  const open = locateBasicFields(withoutAttachment.window.document);
  assert.equal(open.ok, true, JSON.stringify({ reason: open.reason, detail: open.detail }));
  assert.deepEqual(open.fields.map((row) => row.spec.path), ['fullName', 'phone', 'email']);

  const missingBasic = locateBasicFields(domFor(probeHtml({ heading: '<div class="tit">附件信息选填</div>' })).window.document);
  assert.equal(missingBasic.ok, false);
  assert.equal(missingBasic.reason, 'section_structure_changed');
  assert.equal(missingBasic.detail, 'signature');
});

test('inspect, readback, and restore decisions follow the shipped binding', () => {
  const name = FIELD_SPECS[0];
  assert.equal(decideInspect({
    path: 'fullName',
    key: 'fullName',
    kind: 'input',
    labels: ['姓名*'],
    reason: 'existing_value',
    currentValue: ORIGINALS.fullName
  }, ORIGINALS.fullName, name).action, 'fill');
  assert.equal(decideInspect({
    path: 'phone',
    key: 'phone',
    kind: 'input',
    labels: ['联系电话*'],
    reason: 'ready',
    currentValue: ''
  }, '', FIELD_SPECS[1]).detail, 'label_not_basic');
  assert.equal(decideInspect({
    path: 'selfEvaluation',
    key: 'selfEvaluation',
    kind: 'input',
    labels: [name.rawLabel],
    reason: 'ready',
    currentValue: ''
  }, '', name).detail, 'binding_missing');
  assert.equal(decideInspect({
    path: 'fullName',
    key: 'fullName',
    kind: 'textarea',
    labels: [name.rawLabel],
    reason: 'ready',
    currentValue: ''
  }, '', name).detail, 'not_input');
  assert.equal(decideProductFill(FIELD_SPECS.map((spec) => ({
    path: spec.path,
    status: 'verified',
    reason: 'readback_matched'
  }))).ok, true);
  assert.equal(decideProductFill([
    { path: 'fullName', status: 'verified', reason: 'readback_matched' },
    { path: 'phone', status: 'skipped', reason: 'existing_value' },
    { path: 'email', status: 'verified', reason: 'readback_matched' }
  ]).ok, false);
  assert.equal(decideProductFill(FIELD_SPECS.map((spec) => ({
    path: spec.path,
    status: 'verified',
    reason: 'preexisting_same_value'
  }))).ok, false);

  const signals = [{ via: 'value_tracker', value: name.fixture }, { via: 'memoized_props', value: name.fixture }];
  assert.deepEqual(assessReadback({
    dom: name.fixture,
    signals,
    expected: name.fixture,
    waitedMs: 500,
    blurred: true
  }), { ok: true, reason: 'readback_matched' });
  assert.equal(assessReadback({
    dom: name.fixture,
    signals,
    expected: name.fixture,
    waitedMs: 499,
    blurred: true
  }).reason, 'react_wait_not_met');
  assert.equal(assessReadback({
    dom: name.fixture,
    signals: [],
    expected: name.fixture,
    waitedMs: 500,
    blurred: true
  }).reason, 'react_state_not_observed');
  assert.equal(restorePlan(ORIGINALS.fullName, 'fullName').action, 'product_fill');
  assert.equal(restorePlan(ORIGINALS.phone, 'phone').action, 'product_fill');
  assert.equal(restorePlan(ORIGINALS.email, 'email').action, 'product_fill');
  assert.equal(restorePlan('', 'fullName').action, 'native_events');
  assert.equal(restorePlan('   ', 'email').action, 'native_events');
  assert.equal(restorePlan('12345', 'phone').reason, 'product_rejects_invalid_phone');
  assert.equal(restorePlan('not-an-email', 'email').reason, 'product_rejects_invalid_email');
  assert.equal(decideClicks([]).ok, true);
  assert.equal(decideClicks([{ type: 'click', label: '保存' }]).reason, 'refusing_forbidden_click');
  assert.equal(decideClicks([{ type: 'click', label: '编辑' }]).reason, 'click_not_allowed');
  assert.equal(signalsMatch(signals, name.fixture), true);
  assert.equal(signalsMatch([], name.fixture), false);
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
  const verified = FIELD_SPECS.map((spec) => ({ q: spec.q, status: 'verified', reason: 'readback_matched', value: spec.fixture }));
  const success = buildEvidence({
    tipSha: 'abc1234',
    fields: verified,
    nonGet: [],
    finalDetails: { restored: true, pageLeftAsFound: true, clickCount: 0, reason: null }
  });
  success.finalDetails.exitCode = evidenceExitCode(success);
  assert.equal(success.finalDetails.exitCode, 0);
  assert.equal(success.neverSave, true);
  assert.equal(success.liveSupportClaimed, false);
  assert.equal(success.fields[0].value, '试用甲');
  assert.equal(success.fields.length, 3);

  const posted = buildEvidence({
    tipSha: BASE_TIP,
    fields: verified,
    nonGet: [{ method: 'POST', url: 'https://wecruit.hotjob.cn/wecruit/resume/save', via: 'xhr' }],
    finalDetails: { restored: true, pageLeftAsFound: true, clickCount: 0, reason: 'non_get_request' }
  });
  assert.equal(evidenceExitCode(posted), 3);
  assert.equal(posted.saveLikePost.length, 1);

  const clicked = buildEvidence({
    tipSha: BASE_TIP,
    fields: plannedFields('refusing_forbidden_click'),
    nonGet: [],
    finalDetails: { restored: true, pageLeftAsFound: true, clickCount: 1, reason: 'refusing_forbidden_click', bannedClick: true }
  });
  assert.equal(evidenceExitCode(clicked), 3);
  assert.equal(evidenceExitCode(buildEvidence({
    tipSha: BASE_TIP,
    fields: plannedFields('cdp_unreachable'),
    finalDetails: { reason: 'cdp_unreachable', clickCount: 0 }
  })), 1);
  assert.equal(evidenceExitCode(buildEvidence({
    tipSha: BASE_TIP,
    fields: plannedFields('tab_not_found'),
    finalDetails: { reason: 'tab_not_found', clickCount: 0 }
  })), 2);
  assert.equal(evidenceExitCode(buildEvidence({
    tipSha: BASE_TIP,
    fields: plannedFields('site_session_expired'),
    finalDetails: { reason: 'site_session_expired', clickCount: 0, pageLeftAsFound: true }
  })), 2);
  assert.equal(readPort({ PORT: '9239' }), 9239);
  assert.equal(readOutDir({ OUTDIR: 'out' }, '/tmp/cms'), path.resolve('/tmp/cms', 'out'));
  assert.throws(() => readPort({ PORT: '0' }), /bad port/);
});

test('jsdom guards swallow button clicks and block non-GET', async () => {
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
  installLive(window);
  const api = window.__cmsBasicInfoLive;
  window.document.getElementById('save').click();
  window.document.getElementById('deliver').click();
  assert.equal(saveClicks, 0);
  assert.equal(decideClicks(api.clicks()).reason, 'refusing_forbidden_click');
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
  assert.equal(stopped.reason, 'refusing_forbidden_click');
  assert.equal(stopped.fillCalls.length, 0);
  api.restore();
});

test('a non-GET before the trial fails closed and leaves the inputs unchanged', async () => {
  const dom = domFor(probeHtml());
  const { window } = dom;
  for (const spec of FIELD_SPECS) window.document.getElementById(FIELD_IDS[spec.path]).value = ORIGINALS[spec.path];
  window.fetch = async () => ({ ok: true, json: async () => ({ state: 200 }) });
  installLive(window);
  await assert.rejects(window.fetch('https://wecruit.hotjob.cn/wecruit/resume/save?token=secret', { method: 'POST' }));
  const stopped = await window.__cmsBasicInfoLive.run();
  assert.equal(stopped.ok, false);
  assert.equal(stopped.reason, 'non_get_request');
  assert.equal(stopped.fillCalls.length, 0);
  assert.equal(stopped.pageLeftAsFound, true);
  for (const spec of FIELD_SPECS) {
    assert.equal(window.document.getElementById(FIELD_IDS[spec.path]).value, ORIGINALS[spec.path]);
  }
  assert.equal(JSON.stringify(window.__cmsBasicInfoLive.posts()).includes('secret'), false);
});

test('a changed section stops before any product write', async () => {
  const dom = domFor(probeHtml({ heading: '<div class="tit"><p>个人基本信息</p></div>' }));
  for (const spec of FIELD_SPECS) dom.window.document.getElementById(FIELD_IDS[spec.path]).value = ORIGINALS[spec.path];
  installLive(dom.window);
  const stopped = await dom.window.__cmsBasicInfoLive.run();
  assert.equal(stopped.reason, 'section_structure_changed');
  assert.equal(stopped.detail, 'signature');
  assert.equal(stopped.pageLeftAsFound, true);
  assert.equal(stopped.fillCalls.length, 0);
  assert.equal(dom.window.document.getElementById('name').value, ORIGINALS.fullName);
});

test('a missing 个人基本信息必填 heading stops before any product write', async () => {
  const html = probeHtml({ heading: '<div class="tit">附件信息选填</div>' });
  assert.equal(html.includes('个人基本信息必填'), false);
  const dom = domFor(html);
  for (const spec of FIELD_SPECS) dom.window.document.getElementById(FIELD_IDS[spec.path]).value = ORIGINALS[spec.path];
  installLive(dom.window);
  const stopped = await dom.window.__cmsBasicInfoLive.run();
  assert.equal(stopped.ok, false);
  assert.equal(stopped.reason, 'section_structure_changed');
  assert.equal(stopped.detail, 'signature');
  assert.equal(stopped.liveSupportClaimed, false);
  assert.equal(stopped.pageLeftAsFound, true);
  assert.equal(stopped.fillCalls.length, 0);
  assert.equal(dom.window.__cmsBasicInfoLive.clicks().length, 0);
  assert.equal(dom.window.document.getElementById('name').value, ORIGINALS.fullName);
});

test('an unauthenticated CMS session fails closed before any write', async () => {
  const dom = domFor(probeHtml());
  const { window } = dom;
  for (const spec of FIELD_SPECS) window.document.getElementById(FIELD_IDS[spec.path]).value = ORIGINALS[spec.path];
  let gets = 0;
  window.fetch = async () => {
    gets += 1;
    return { ok: true, json: async () => ({ state: 809 }) };
  };
  installChrome(window);
  injectProduct(window);
  installLive(window);
  const stopped = await window.__cmsBasicInfoLive.run();
  assert.equal(stopped.ok, false, JSON.stringify({ reason: stopped.reason, detail: stopped.detail }));
  assert.equal(stopped.reason, 'site_session_expired');
  assert.equal(stopped.liveSupportClaimed, false);
  assert.equal(stopped.fillCalls.length, 0);
  assert.equal(stopped.pageLeftAsFound, true);
  assert.equal(gets, 1);
  for (const spec of FIELD_SPECS) {
    assert.equal(window.document.getElementById(FIELD_IDS[spec.path]).value, ORIGINALS[spec.path]);
  }
  assert.equal(window.document.getElementById('id-no').value, 'keep-id');
  assert.equal(window.document.getElementById('marital').textContent.includes('未婚'), true);
  assert.equal(window.__cmsBasicInfoLive.clicks().length, 0);
});

test('shipped engine fill writes the three basic fixtures and restores the originals without clicks', async () => {
  assert.equal(probeHtml().includes('附件信息选填'), false);
  const dom = domFor(probeHtml());
  const { window } = dom;
  const inputs = Object.fromEntries(FIELD_SPECS.map((spec) => [spec.path, window.document.getElementById(FIELD_IDS[spec.path])]));
  const props = {};
  const tracked = {};
  const inputCounts = {};
  for (const spec of FIELD_SPECS) {
    const input = inputs[spec.path];
    input.value = ORIGINALS[spec.path];
    props[spec.path] = { value: ORIGINALS[spec.path] };
    input[`__reactFiber$${spec.path}`] = { memoizedProps: props[spec.path], memoizedState: null, return: null };
    tracked[spec.path] = ORIGINALS[spec.path];
    input._valueTracker = {
      getValue: () => tracked[spec.path],
      setValue: (value) => { tracked[spec.path] = String(value ?? ''); }
    };
    inputCounts[spec.path] = 0;
    input.addEventListener('input', () => {
      inputCounts[spec.path] += 1;
      const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      const live = desc.get.call(input);
      tracked[spec.path] = live;
      props[spec.path].value = live;
    });
  }
  let idInputs = 0;
  let evalInputs = 0;
  let majorInputs = 0;
  window.document.getElementById('id-no').addEventListener('input', () => { idInputs += 1; });
  window.document.getElementById('eval').addEventListener('input', () => { evalInputs += 1; });
  window.document.getElementById('major').addEventListener('input', () => { majorInputs += 1; });
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
  installChrome(window);
  injectProduct(window);
  installLive(window);
  const seen = [];
  const blanks = [];
  const raw = window.__resumeQuickFillEngineListener;
  window.__resumeQuickFillEngineListener = function wrapped(message, sender, sendResponse) {
    if (message?.type === 'RESUME_FILL') {
      const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      blanks.push(FIELD_SPECS.map((spec) => desc.get.call(inputs[spec.path])));
      seen.push(message.profile);
    }
    return raw.call(this, message, sender, sendResponse);
  };
  const result = await window.__cmsBasicInfoLive.run();
  assert.equal(result.ok, true, JSON.stringify({
    reason: result.reason,
    detail: result.detail,
    readbacks: result.readbacks,
    restore: result.restore,
    productReason: result.productReason,
    unexpectedWrites: result.unexpectedWrites
  }));
  const plain = (value) => JSON.parse(JSON.stringify(value));
  assert.equal(result.liveSupportClaimed, false);
  assert.deepEqual(plain(result.readbacks.map((row) => row.value)), FIELD_SPECS.map((spec) => spec.fixture));
  assert.equal(result.productReason, 'readback_matched');
  assert.equal(result.restore.via, 'product');
  assert.equal(result.pageLeftAsFound, true);
  assert.equal(result.anchorSeen, true);
  assert.deepEqual(plain(result.originalLengths), {
    fullName: ORIGINALS.fullName.length,
    phone: ORIGINALS.phone.length,
    email: ORIGINALS.email.length
  });
  assert.equal(result.waitedMs, 500);
  assert.equal(result.blurred, true);
  for (const spec of FIELD_SPECS) {
    assert.ok(result.reactVia[spec.path].includes('value_tracker'));
    assert.ok(result.reactVia[spec.path].includes('memoized_props'));
    assert.equal(inputs[spec.path].value, ORIGINALS[spec.path]);
    assert.equal(props[spec.path].value, ORIGINALS[spec.path]);
    assert.equal(tracked[spec.path], ORIGINALS[spec.path]);
    assert.equal(readReactSignals(inputs[spec.path]).every((row) => row.value === ORIGINALS[spec.path]), true);
    assert.equal(inputCounts[spec.path], 2);
  }
  assert.deepEqual(plain(result.fillCalls.map((call) => call.lengths)), [
    [{ path: 'fullName', length: FIELD_SPECS[0].fixture.length }],
    [{ path: 'phone', length: FIELD_SPECS[1].fixture.length }],
    [{ path: 'email', length: FIELD_SPECS[2].fixture.length }],
    FIELD_SPECS.map((spec) => ({ path: spec.path, length: ORIGINALS[spec.path].length }))
  ]);
  assert.deepEqual(plain(seen.map((profile) => ({
    confirmedFields: profile.confirmedFields,
    fullName: profile.fullName ?? null,
    phone: profile.phone ?? null,
    email: profile.email ?? null
  }))), [
    { confirmedFields: ['fullName'], fullName: FIELD_SPECS[0].fixture, phone: null, email: null },
    { confirmedFields: ['phone'], fullName: null, phone: FIELD_SPECS[1].fixture, email: null },
    { confirmedFields: ['email'], fullName: null, phone: null, email: FIELD_SPECS[2].fixture },
    {
      confirmedFields: ['fullName', 'phone', 'email'],
      fullName: ORIGINALS.fullName,
      phone: ORIGINALS.phone,
      email: ORIGINALS.email
    }
  ]);
  assert.deepEqual(plain(blanks), [
    ['', ORIGINALS.phone, ORIGINALS.email],
    [FIELD_SPECS[0].fixture, '', ORIGINALS.email],
    [FIELD_SPECS[0].fixture, FIELD_SPECS[1].fixture, ''],
    ['', '', '']
  ]);
  assert.equal(window.document.getElementById('id-no').value, 'keep-id');
  assert.equal(window.document.getElementById('eval').value, 'keep-eval');
  assert.equal(window.document.getElementById('major').value, 'keep-major');
  assert.equal(window.document.getElementById('gender-m').checked, true);
  assert.equal(window.document.getElementById('gender-f').checked, false);
  assert.equal(window.document.getElementById('marital').textContent.includes('未婚'), true);
  assert.equal(window.document.getElementById('marital').getAttribute('aria-expanded'), 'false');
  assert.equal(idInputs, 0);
  assert.equal(evalInputs, 0);
  assert.equal(majorInputs, 0);
  assert.equal(saveClicks, 0);
  assert.equal(submitEvents, 0);
  assert.equal(window.__cmsBasicInfoLive.clicks().length, 0);
  assert.equal(gets, 1);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes(ORIGINALS.fullName), false);
  assert.equal(serialized.includes(ORIGINALS.phone), false);
  assert.equal(serialized.includes(ORIGINALS.email), false);
  assert.equal(JSON.stringify(window.__cmsBasicInfoLive.posts()), '[]');
});

function happyOutcome() {
  return {
    ok: true,
    reason: null,
    liveSupportClaimed: false,
    originalLengths: { fullName: 3, phone: 11, email: 17 },
    readbacks: FIELD_SPECS.map((spec) => ({
      path: spec.path,
      ok: true,
      reason: 'readback_matched',
      value: spec.fixture
    })),
    restore: { ok: true, via: 'product', reason: 'restored' },
    otherChanged: false,
    unexpectedWrites: [],
    clickCount: 0,
    clicks: [],
    anchorSeen: true,
    fillCalls: [
      ...FIELD_SPECS.map((spec, index) => ({
        index,
        lengths: [{ path: spec.path, length: spec.fixture.length }]
      })),
      {
        index: FIELD_SPECS.length,
        lengths: FIELD_SPECS.map((spec) => ({ path: spec.path, length: ORIGINALS[spec.path].length }))
      }
    ],
    productReason: 'readback_matched',
    reactVia: Object.fromEntries(FIELD_SPECS.map((spec) => [spec.path, ['value_tracker', 'memoized_props']])),
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-basic-info-'));
  const session = fakeSession(answers);
  const evidence = await runCmsBasicInfoLive({
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
    clear_engine_install: { ok: true, clearedOwned: false },
    install_live: { ok: true },
    inject_matcher: { ok: true },
    'inject_cms-session': { ok: true },
    inject_engine: { ok: true },
    inject_check: { matcher: true, session: true, engine: true },
    basic_info_run: happyOutcome(),
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
  assert.deepEqual(evidence.fields, FIELD_SPECS.map((spec) => ({
    q: spec.q,
    status: 'verified',
    reason: 'readback_matched',
    value: spec.fixture
  })));
  assert.deepEqual(session.steps.filter((step) => step.startsWith('inject_')), [
    'inject_matcher',
    'inject_cms-session',
    'inject_engine',
    'inject_check'
  ]);
  const shimAt = session.steps.indexOf('chrome_shim');
  const clearAt = session.steps.indexOf('clear_engine_install');
  const installAt = session.steps.indexOf('install_live');
  const matcherAt = session.steps.indexOf('inject_matcher');
  assert.ok(shimAt >= 0 && clearAt > shimAt && installAt > clearAt && matcherAt > installAt);
  assert.deepEqual(
    evidence.finalDetails.steps.filter((step) => ['chrome_shim', 'clear_engine_install', 'install_live', 'inject_matcher', 'inject_cms-session', 'inject_engine'].includes(step)),
    ['chrome_shim', 'clear_engine_install', 'install_live', 'inject_matcher', 'inject_cms-session', 'inject_engine']
  );
  assert.equal(session.steps.includes('basic_info_run'), true);
  assert.equal(JSON.stringify(evidence).includes('resumeId'), false);
  const file = JSON.parse(fs.readFileSync(evidence.finalDetails.path, 'utf8'));
  assert.equal(file.liveSupportClaimed, false);
  assert.equal(file.neverSave, true);
  assert.equal(file.finalDetails.fatalDetail, null);
  assert.equal(path.basename(evidence.finalDetails.path), EVIDENCE_NAME);
});

test('a stale engine install is cleared before inject and a clear failure skips the tip files', async () => {
  const clearAt = source.indexOf("step: 'clear_engine_install'");
  const installAt = source.indexOf("step: 'install_live'");
  assert.ok(clearAt > 0 && installAt > clearAt);
  assert.match(source, /chrome\.runtime\.onMessage\.removeListener\(owned\)/);
  assert.match(source, /delete globalThis\.__resumeQuickFillInstalled/);
  assert.match(source, /delete globalThis\.__resumeQuickFillEngineListener/);
  assert.match(source, /delete globalThis\.__resumeQuickFillEngineRevision/);
  assert.match(source, /delete globalThis\.ResumeQuickFillGthInspect/);
  assert.match(source, /else if \(!reason\) \{\s*for \(const rel of LIVE_FILES\)/);

  const failed = await runFake(happyAnswers({
    clear_engine_install: { ok: false }
  }));
  assert.equal(failed.evidence.finalDetails.reason, 'inject_failed');
  assert.equal(failed.evidence.finalDetails.fatalDetail, 'clear_engine_install');
  assert.equal(failed.evidence.finalDetails.exitCode, 2);
  assert.equal(failed.evidence.neverSave, true);
  assert.equal(failed.evidence.liveSupportClaimed, false);
  assert.equal(failed.session.steps.includes('clear_engine_install'), true);
  assert.equal(failed.session.steps.includes('install_live'), false);
  assert.equal(failed.session.steps.includes('inject_matcher'), false);
  assert.equal(failed.session.steps.includes('inject_cms-session'), false);
  assert.equal(failed.session.steps.includes('inject_engine'), false);
  assert.equal(failed.session.steps.includes('basic_info_run'), false);
  assert.equal(failed.evidence.finalDetails.steps.includes('clear_engine_install'), true);
  assert.equal(failed.evidence.finalDetails.steps.includes('install_live'), false);
  assert.equal(failed.evidence.fields.every((field) => field.status === 'failed' && field.reason === 'inject_failed'), true);

  const expression = source.match(/step: 'clear_engine_install' \}\);\n {10}steps\.push\('clear_engine_install'\)/);
  const body = source.slice(source.indexOf('const cleared = await evaluate'), source.indexOf("step: 'clear_engine_install'"));
  const iife = body.match(/\(\(\) => \{[\s\S]*\}\)\(\)/u);
  assert.ok(expression);
  assert.ok(iife, 'clear expression iife');
  const owned = function staleListener() {};
  const removed = [];
  const sandbox = {
    __resumeQuickFillInstalled: true,
    __resumeQuickFillEngineListener: owned,
    __resumeQuickFillEngineRevision: 6,
    ResumeQuickFillGthInspect() {},
    chrome: {
      runtime: {
        onMessage: {
          removeListener(fn) { removed.push(fn); }
        }
      }
    }
  };
  const result = vm.runInNewContext(iife[0], sandbox);
  assert.equal(result.ok, true);
  assert.equal(result.clearedOwned, true);
  assert.deepEqual(removed, [owned]);
  assert.equal(Object.hasOwn(sandbox, '__resumeQuickFillInstalled'), false);
  assert.equal(Object.hasOwn(sandbox, '__resumeQuickFillEngineListener'), false);
  assert.equal(Object.hasOwn(sandbox, '__resumeQuickFillEngineRevision'), false);
  assert.equal(Object.hasOwn(sandbox, 'ResumeQuickFillGthInspect'), false);

  const thrown = {
    __resumeQuickFillInstalled: true,
    __resumeQuickFillEngineListener: owned,
    __resumeQuickFillEngineRevision: 6,
    ResumeQuickFillGthInspect() {},
    chrome: {
      runtime: {
        onMessage: {
          removeListener() { throw new Error('already gone'); }
        }
      }
    }
  };
  const afterThrow = vm.runInNewContext(iife[0], thrown);
  assert.equal(afterThrow.ok, true);
  assert.equal(afterThrow.clearedOwned, true);
  assert.equal(Object.hasOwn(thrown, '__resumeQuickFillInstalled'), false);
  assert.equal(Object.hasOwn(thrown, '__resumeQuickFillEngineRevision'), false);
});

function stoppedOutcome(reason, detail) {
  return {
    ok: false,
    reason,
    detail,
    liveSupportClaimed: false,
    originalLengths: null,
    readbacks: [],
    restore: { ok: false, via: 'not_needed', reason: 'not_run' },
    otherChanged: false,
    unexpectedWrites: [],
    clickCount: 0,
    clicks: [],
    anchorSeen: false,
    fillCalls: [],
    productReason: null,
    reactVia: {},
    blurred: false,
    waitedMs: 0,
    pageLeftAsFound: true
  };
}

test('a locate failure copies signature or input_not_found into fatalDetail', async () => {
  const signature = await runFake(happyAnswers({
    basic_info_run: stoppedOutcome('section_structure_changed', 'signature')
  }));
  assert.equal(signature.evidence.finalDetails.reason, 'section_structure_changed');
  assert.equal(signature.evidence.finalDetails.fatalDetail, 'signature');
  assert.equal(signature.evidence.finalDetails.exitCode, 2);
  assert.equal(signature.evidence.neverSave, true);
  assert.equal(signature.evidence.liveSupportClaimed, false);
  assert.deepEqual(signature.evidence.nonGet, []);
  assert.deepEqual(signature.evidence.finalDetails.clicks, []);
  assert.equal(signature.evidence.finalDetails.clickCount, 0);
  assert.equal(signature.evidence.finalDetails.pageLeftAsFound, true);

  const missing = await runFake(happyAnswers({
    basic_info_run: stoppedOutcome('control_not_supported', 'input_not_found')
  }));
  assert.equal(missing.evidence.finalDetails.reason, 'control_not_supported');
  assert.equal(missing.evidence.finalDetails.fatalDetail, 'input_not_found');
  assert.equal(missing.evidence.finalDetails.exitCode, 2);
  assert.equal(missing.evidence.neverSave, true);
  assert.equal(missing.evidence.liveSupportClaimed, false);
  assert.deepEqual(missing.evidence.nonGet, []);
  assert.equal(missing.evidence.finalDetails.clickCount, 0);
  assert.equal(missing.evidence.fields.every((field) => field.status === 'failed'), true);
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
  assert.equal(clicked.evidence.fields.every((field) => field.status === 'failed'), true);
  assert.equal(clicked.evidence.liveSupportClaimed, false);
});

test('CDP failures and a missing baseline tab still write never-save evidence', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-basic-info-down-'));
  let connected = false;
  const down = await runCmsBasicInfoLive({
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

  const missing = await runCmsBasicInfoLive({
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
  assert.equal(login.session.steps.includes('basic_info_run'), false);
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
  walk('scripts/live/cms-basic-info-live.mjs');
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
  const help = spawnSync(process.execPath, ['scripts/live/cms-basic-info-live.mjs', '--help'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
  assert.equal(help.status, 0);
  assert.equal(help.stdout.includes(POWERSHELL), true);
  assert.match(help.stdout, /\$env:PORT='9239'/);
  assert.match(help.stdout, /\$env:OUTDIR='.'/);
  assert.match(help.stdout, /node scripts\/live\/cms-basic-info-live\.mjs/);
  assert.match(source, /RESUME_FILL/);
  assert.match(source, /productFill\(\{ \[row\.spec\.path\]: options\.fixtures\[row\.spec\.path\] \}\)/);
  assert.doesNotMatch(source, /productFill\(options\.fixtures\)/);
  assert.match(source, /__resumeQuickFillEngineListener/);
  assert.match(source, /fullName/);
  assert.match(source, /ResumeCmsSession/);
  assert.doesNotMatch(source, /\.click\(/);
  assert.doesNotMatch(source, /liveSupportClaimed\s*[:=]\s*true/);
  assert.doesNotMatch(source, /BEGIN PRIVATE KEY/);
  assert.equal(source.includes('SU661f37091eb8053acd6cdf3d'), false);
  assert.equal(source.includes('cms-region.js'), true);
  assert.equal(source.includes("from '../content/cms-region.js'"), false);
  assert.equal(source.includes("from '../../src/content/cms-region.js'"), false);
});
