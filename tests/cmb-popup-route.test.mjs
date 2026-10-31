/**
 * Popup route keeps the CMB editor writer; other current pages use the generic engine.
 * CMB fill outcomes keep their readback and Never-Save guards.
 * 招行 is not claimed supported.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import {
  CMB_BASIC_SCRIPT,
  cmbBasicInjectFiles,
  isCmb,
  isCmbResumeEditPage
} from '../src/content/cmb-profile-map.mjs';
import { assessCmbFillReport, cmbPopupOutcome, isCmbTabUrl,
  sealCmbRequestedFill } from '../src/background/cmb-basic-auto.mjs';

const root = resolve(import.meta.dirname, '..');
const popup = readFileSync(resolve(root, 'src/popup/popup.js'), 'utf8');
const PAGE = 'https://career.cmbchina.com/center/resume';

test('isCmb recognizes career.cmbchina.com and refuses CMS, GTH, and lookalike hosts', () => {
  assert.equal(isCmb(PAGE), true);
  assert.equal(isCmb(`${PAGE}?from=mail`), true);
  assert.equal(isCmb('https://Career.Cmbchina.com/login'), true);
  assert.equal(isCmbResumeEditPage(PAGE), true);
  assert.equal(isCmbResumeEditPage(`${PAGE}/`), true);
  assert.equal(isCmbResumeEditPage('https://career.cmbchina.com/login?redirect=%2Fcenter%2Fresume'), false);
  for (const bad of [
    'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html',
    'https://hr.gtht.com/resume/edit/',
    'https://careers.citics.com/my/jl',
    'https://career.cmbc.com.cn/',
    'http://career.cmbchina.com/center/resume',
    'https://user:pass@career.cmbchina.com/center/resume',
    'https://cmb-recruitment-mobile.paas.cmbchina.com/',
    'not a url'
  ]) {
    assert.equal(isCmb(bad), false, bad);
    assert.equal(isCmbResumeEditPage(bad), false, bad);
    assert.equal(cmbBasicInjectFiles(bad), null, bad);
  }
  assert.deepEqual(cmbBasicInjectFiles(PAGE), [CMB_BASIC_SCRIPT]);
  assert.deepEqual(cmbBasicInjectFiles('https://career.cmbchina.com/login'), ['src/content/cmb-basic.js']);
});

test('popup routes a CMB tab to cmb-basic and does not widen the CMS resume match', () => {
  assert.match(popup, /import \{isCmb,cmbBasicInjectFiles\} from "\.\.\/content\/cmb-profile-map\.mjs"/);
  assert.match(popup, /if \(isCmb\(tab\.url\) && isCmbResumeEditPage\(tab\.url\)\)\s+return sendCmb\(type, tab, selectedOwnerToken\)/);
  assert.match(popup, /type: "CMB_BASIC_FILL"/);
  assert.match(popup, /type: "CMB_BASIC_PROBE"/);
  assert.match(popup, /cmbBasicInjectFiles\(tab\.url\)/);
  assert.match(popup, /cmbPopupOutcome\(response, filling \? "fill" : "inspect"\)/);
  assert.doesNotMatch(popup, /已支持/);
  const cms = popup.slice(popup.indexOf('function isCmsResumePage'), popup.indexOf('function isCmsPhotoResumePage'));
  assert.match(cms, /hostname === "wecruit\.hotjob\.cn"/);
  assert.match(cms, /resumeOperation\\?\.html/);
  assert.doesNotMatch(cms, /cmbchina/);
  const send = popup.slice(popup.indexOf('async function send(type)'), popup.indexOf('function renderValidationGaps'));
  const cmbAt = send.indexOf('isCmb(tab.url)');
  const engineAt = send.indexOf('src/content/engine.js');
  assert.ok(cmbAt > 0 && engineAt > cmbAt);
  const sendCmb = popup.slice(popup.indexOf('async function sendCmb'), popup.indexOf('async function send(type)'));
  assert.match(sendCmb, /cmbBasicInjectFiles/);
  assert.doesNotMatch(sendCmb, /engine\.js/);
  assert.doesNotMatch(sendCmb, /cms-session\.js/);
  assert.doesNotMatch(sendCmb, /\.click\s*\(/);
  assert.doesNotMatch(sendCmb, /已支持/);
});

test('popup fill fails closed when the body is unsettled or reports a save', () => {
  const okBody = {
    ok: true,
    siteId: 'cmb',
    skippedSave: true,
    saved: false,
    writeAttempted: true,
    href: PAGE,
    title: '简历',
    results: [{ label: '姓名', ok: true, reason: 'matched', before: '', after: '甲', expected: '甲', path: 'fullName' }]
  };
  const done = cmbPopupOutcome(okBody, 'fill');
  assert.equal(done.ok, true);
  assert.equal(done.view.siteId, 'cmb');
  assert.equal(done.view.cmbBasic, true);
  assert.equal(done.view.liveSupportClaimed, false);
  assert.equal(done.view.saved, false);
  assert.equal(done.view.skippedSave, true);
  assert.equal(done.view.softwareClickedSave, false);
  assert.equal(done.view.fields[0].status, 'verified');
  assert.equal(done.view.fields[0].reason, 'readback_matched');
  assert.equal(done.view.fields[0].path, 'fullName');

  const same = cmbPopupOutcome({
    ...okBody,
    results: [{ label: '邮箱', ok: true, reason: 'matched', before: 'a@b.c', after: 'a@b.c', expected: 'a@b.c' }]
  }, 'fill');
  assert.equal(same.view.fields[0].reason, 'preexisting_same_value');
  assert.equal(same.view.fields[0].path, 'email');

  const unsettled = cmbPopupOutcome({ ...okBody, results: [], writeAttempted: false }, 'fill');
  assert.equal(unsettled.ok, false);
  assert.equal(unsettled.reason, 'cmb_basic_status_unsettled');
  assert.equal(unsettled.fillNotStarted, false);
  assert.equal(assessCmbFillReport({ ...okBody, results: [] }).state, 'failed');

  const saved = cmbPopupOutcome({ ...okBody, softwareClickedSave: true }, 'fill');
  assert.equal(saved.ok, false);
  assert.equal(saved.reason, 'cmb_save_policy_violation');
  assert.equal(saved.fillNotStarted, false);

  const before = cmbPopupOutcome({
    ok: false,
    siteId: 'cmb',
    skippedSave: true,
    saved: false,
    writeAttempted: false,
    reason: 'profile_fields_unavailable',
    results: []
  }, 'fill');
  assert.equal(before.ok, false);
  assert.equal(before.reason, 'profile_fields_unavailable');
  assert.equal(before.fillNotStarted, true);

  const foreign = cmbPopupOutcome({ ...okBody, siteId: 'cms' }, 'fill');
  assert.equal(foreign.ok, false);
  assert.equal(foreign.reason, 'cmb_site_isolation');
  assert.equal(cmbPopupOutcome(null, 'fill').reason, 'cmb_fill_empty_response');
  assert.equal(cmbPopupOutcome(null, 'fill').fillNotStarted, true);

  const hinted = cmbPopupOutcome({
    ...okBody,
    birthDateHint: { reason: 'datepicker_hint_only', saved: false, skippedSave: true, writeAttempted: false }
  }, 'fill');
  assert.equal(hinted.ok, false);
  assert.equal(hinted.reason, 'datepicker_hint_only');
  assert.equal(hinted.fillNotStarted, false);
  assert.equal(assessCmbFillReport({
    ...okBody,
    birthDateHint: { reason: 'datepicker_hint_only' }
  }).state, 'failed');

  const ambiguous = cmbPopupOutcome({
    ...okBody,
    ok: true,
    writeAttempted: false,
    results: [{ label: '姓名', ok: true, reason: 'item_ambiguous', path: 'fullName' }]
  }, 'fill');
  assert.equal(ambiguous.ok, false);
  assert.equal(ambiguous.reason, 'item_ambiguous');
  assert.equal(ambiguous.fillNotStarted, false);

  const explicitHint = cmbPopupOutcome({
    ok: false,
    siteId: 'cmb',
    skippedSave: true,
    saved: false,
    writeAttempted: false,
    reason: 'datepicker_hint_only',
    results: []
  }, 'fill');
  assert.equal(explicitHint.ok, false);
  assert.equal(explicitHint.fillNotStarted, false);

  const radio = cmbPopupOutcome({
    ...okBody,
    ok: false,
    reason: 'radio_readback_ambiguous',
    results: [{ label: '性别', ok: false, reason: 'radio_readback_ambiguous', path: 'gender' }]
  }, 'fill');
  assert.equal(radio.ok, false);
  assert.equal(radio.reason, 'radio_readback_ambiguous');
  assert.equal(radio.fillNotStarted, false);
  assert.equal(radio.view, undefined);
});

test('popup probe lists the resume contract and asks for help off the edit page', () => {
  const probe = cmbPopupOutcome({
    ok: true,
    siteId: 'cmb',
    href: PAGE,
    title: '简历',
    onCmbResumeEdit: true,
    saved: false,
    skippedSave: true,
    reason: 'labels_ready',
    labels: [
      { label: '姓名', found: true, hasTextControl: true },
      { label: '手机号', found: false, hasTextControl: false }
    ]
  }, 'inspect');
  assert.equal(probe.ok, true);
  assert.equal(probe.view.fields[0].reason, 'ready');
  assert.equal(probe.view.fields[0].path, 'fullName');
  assert.equal(probe.view.fields[1].status, 'failed');
  assert.equal(probe.view.fields[1].reason, 'item_not_found');
  assert.equal(probe.view.liveSupportClaimed, false);
  assert.equal(probe.fillNotStarted, true);

  const login = cmbPopupOutcome({
    ok: false,
    siteId: 'cmb',
    href: 'https://career.cmbchina.com/login',
    onCmbResumeEdit: false,
    saved: false,
    skippedSave: true,
    reason: 'wrong_page',
    labels: []
  }, 'inspect');
  assert.equal(login.ok, false);
  assert.equal(login.reason, 'wrong_page');
  assert.equal(login.helpNeeded, true);

  const cmsPage = cmbPopupOutcome({
    ok: true,
    siteId: 'cms',
    href: 'https://wecruit.hotjob.cn/SU1/pb/resumeOperation.html',
    saved: false,
    skippedSave: true
  }, 'inspect');
  assert.equal(cmsPage.ok, false);
  assert.equal(cmsPage.reason, 'cmb_site_isolation');
});

for (const [url, status, type = 'RESUME_FILL'] of [
  ['https://career.cmbchina.com/login', 'wrong_page'],
  ['https://hr.gtht.com/resume/edit/', 'form_not_ready'],
  ['https://ats.example.test/resume/edit', 'login_required'],
  ['https://career.cmbchina.com/login', 'wrong_page', 'RESUME_INSPECT'],
  ['https://hr.gtht.com/resume/edit/', 'form_not_ready', 'RESUME_INSPECT']
]) {
  test(`popup ${type} scans the current page and returns the ${status} advisory with fields`, async () => {
    const route = popup.slice(popup.indexOf('async function send(type)'), popup.indexOf('\nfunction renderValidationGaps('));
    const tab = { id: 1, url };
    const binding = { epoch: 'offline-binding' };
    const profile = { fullName: 'Offline Applicant', confirmedFields: ['fullName'] };
    const formReadiness = { status, reason: 'offline_page_hint', advisory: true, liveSupportClaimed: false };
    const fields = [{ id: 'name', status: 'verified', before: '', after: profile.fullName, reason: 'readback_matched' }];
    const calls = { permission: 0, script: [], message: [], receipt: [] };
    const send = runInNewContext(`(${route.trim()})`, {
      attachmentReady: Promise.resolve(), getTab: async () => tab,
      requireHostPermission: async () => { calls.permission++; },
      popupFileOwner: { ensure: async () => 'owner', assert: async () => binding },
      isGthSite: value => new URL(value).hostname === 'hr.gtht.com',
      isCmb, isCmbResumeEditPage,
      inspectGth: () => assert.fail('fill must reach the current-page engine'),
      sendCmb: () => assert.fail('a non-editor URL must reach the current-page engine'),
      authorizationScope: value => new URL(value).origin,
      loadProfile: async () => profile, attachmentInput: { files: [] }, cachedAttachment: null,
      isCmsResumePage: () => false, isCmsPhotoResumePage: () => false,
      SCRIPT_TIMEOUT_MS: 100, FILL_TIMEOUT_MS: 100, INSPECT_TIMEOUT_MS: 100,
      boundedChromeCall: work => work(), assertProfileBinding: async () => {},
      withProfileBinding: async (_local, _binding, work) => work(),
      dispatchBoundSource: async (_local, _binding, work) => work(),
      pendingReviewFor: async () => null, beginRecentRequest: async () => {},
      pendingFillReviewKey: () => 'pending', showRecentResult: () => {},
      replacePendingReview: async () => {}, clearLegacyPendingReview: async () => {},
      rememberResult: async (...args) => { calls.receipt.push(args); }, fillOutcomeUncertain: false,
      chrome: {
        storage: { local: { get: async () => ({ resumeTrustedOrigins: [new URL(url).origin] }), set: async () => {} } },
        scripting: { executeScript: async request => { calls.script.push(request); } },
        tabs: { sendMessage: async (id, message) => {
          assert.equal(id, tab.id); calls.message.push(message);
          return { ok: true, data: { fields, formReadiness, neverSave: true, liveSupportClaimed: false } };
        } }
      }
    });
    const result = await send(type);
    assert.equal(calls.permission, 1);
    assert.equal(calls.script.length, 1);
    assert.ok(calls.script[0].files.includes('src/content/engine.js'));
    assert.equal(calls.message.length, 1);
    assert.equal(calls.message[0].type, type);
    assert.equal(calls.message[0].profile, profile);
    assert.equal(result.formReadiness, formReadiness);
    assert.equal(result.fields, fields);
    assert.equal(result.neverSave, true);
    assert.equal(result.liveSupportClaimed, false);
    if (type === 'RESUME_FILL') assert.equal(calls.receipt[0][3], fields);
    else assert.equal(calls.receipt.length, 0);
  });
}

test('popup renders readiness as an advisory after scanning', () => {
  const source = popup.slice(popup.indexOf('function formReadinessHint('), popup.indexOf('async function sendCmb('));
  const hint = runInNewContext(`(${source.trim()})`);
  assert.equal(hint(undefined), '');
  assert.equal(hint({ status: 'ready' }), '');
  for (const status of ['login_required', 'wrong_page', 'form_not_ready', 'form_unrecognized', 'page_invalid', 'manual']) {
    assert.match(hint({ status }), /已继续扫描当前页面/);
  }
  assert.match(popup, /formReadinessHint\(data\.formReadiness\)/);
});

test('popup and auto reject Never-Save attempts even when only a result row reports them', () => {
  const body = { ok: true, siteId: 'cmb', href: PAGE, skippedSave: true,
    writeAttempted: false, results: [{ label: '学历', path: 'educationLevel', ok: true, reason: 'matched' }] };
  for (const key of ['softwareClickedSave', 'softwareClickedSubmit', 'softwareClickedDelete',
    'softwareClickedNext', 'softwareClickedDeliver', 'saveAttempted', 'submitAttempted',
    'deleteAttempted', 'nextAttempted', 'deliverAttempted', 'savedOnSite', 'submitted', 'delivered', 'saved']) {
    for (const report of [{ ...body, [key]: true },
      { ...body, results: [{ ...body.results[0], [key]: true }] }]) {
      const assessed = assessCmbFillReport(report);
      assert.equal(assessed.reason, 'cmb_save_policy_violation', key);
      assert.equal(assessed[key], true, key);
      assert.equal(assessed.skippedSave, false, key);
      assert.equal(cmbPopupOutcome(report, 'fill').fillNotStarted, false, key);
      assert.equal(cmbPopupOutcome(report, 'inspect').ok, false, key);
    }
  }
});

test('probe does not turn explicit failure, foreign URL, or support claim into a ready view', () => {
  const ready = { ok: true, siteId: 'cmb', href: PAGE, skippedSave: true,
    onCmbResumeEdit: true, labels: [] };
  assert.equal(cmbPopupOutcome({ ...ready, ok: false, reason: 'item_ambiguous' }).reason, 'item_ambiguous');
  assert.equal(cmbPopupOutcome({ ...ready, href: 'https://career.cmbchina.com/login' }).reason, 'wrong_page');
  assert.equal(cmbPopupOutcome({ ...ready, href: 'https://wecruit.hotjob.cn/SU1/pb/resumeOperation.html' }).reason, 'wrong_page');
  assert.equal(cmbPopupOutcome({ ...ready, liveSupportClaimed: true }).reason, 'cmb_live_support_unverified');
  assert.equal(cmbPopupOutcome({ ...ready, onCmbResumeEdit: false }).ok, false);
  const fill = { ...ready, results: [{ ok: true, label: '姓名', reason: 'matched' }], writeAttempted: false };
  assert.equal(cmbPopupOutcome({ ...fill, href: 'https://career.cmbchina.com/login' }, 'fill').fillNotStarted, false);
  assert.equal(cmbPopupOutcome({ ...fill, liveSupportClaimed: true }, 'fill').ok, false);
  for (const href of ['https://user:pass@career.cmbchina.com/center/resume',
    'https://career.cmbchina.com:444/center/resume']) assert.equal(isCmbTabUrl(href), false, href);
});

test('family row 0 result cannot suppress the requested row 1 blocker with the same label', () => {
  const report = { ok: true, siteId: 'cmb', skippedSave: true,
    results: [{ label: '关系类型', path: 'relationshipType', ok: true, reason: 'matched' }] };
  const sealed = sealCmbRequestedFill(report, { blockers: [{ label: '关系类型',
    path: 'relationshipTypeRow1', reason: 'profile_fact_unconfirmed' }] });
  assert.equal(sealed.results.length, 2);
  assert.equal(sealed.results[1].path, 'relationshipTypeRow1');
  assert.equal(sealed.results[1].ok, false);
  assert.equal(cmbPopupOutcome(sealed, 'fill').ok, false);
});

test('missing-control blockers and failed readbacks keep popup review pending even without a write claim', () => {
  const body = { ok: true, siteId: 'cmb', href: PAGE, skippedSave: true, writeAttempted: false,
    results: [{ label: '学历', path: 'educationLevel', ok: true, reason: 'matched' }] };
  const missing = cmbPopupOutcome({ ...body, blockers: [{ path: 'rankingMajor', reason: 'DOM_CONTROL_MISSING' }] }, 'fill');
  assert.equal(missing.reason, 'DOM_CONTROL_MISSING');
  assert.equal(missing.fillNotStarted, false);
  const mismatch = cmbPopupOutcome({ ...body, ok: false, reason: 'select_readback_mismatch',
    results: [{ label: '学历', path: 'educationLevel', ok: false, reason: 'select_readback_mismatch' }] }, 'fill');
  assert.equal(mismatch.fillNotStarted, false);
});

test('a completed fill requires the evidenced page and rejects explicit wrong-page flags', () => {
  const body = { ok: true, siteId: 'cmb', href: PAGE, skippedSave: true,
    results: [{ label: '学历', path: 'educationLevel', ok: true, reason: 'matched' }] };
  for (const extra of [{ href: undefined }, { href: null }, { href: 42 },
    { onCmbResumeEdit: false }, { reason: 'wrong_page' }]) {
    const outcome = cmbPopupOutcome({ ...body, ...extra }, 'fill');
    assert.equal(outcome.reason, 'wrong_page');
    assert.equal(outcome.fillNotStarted, false);
  }
});

test('sealing preserves original blocker policy evidence and nested support claims stay failed', () => {
  const report = { ok: true, siteId: 'cmb', href: PAGE, skippedSave: true,
    results: [{ label: '学历', path: 'educationLevel', ok: true, reason: 'matched' }],
    blockers: [{ path: 'birthDate', saveAttempted: true, reason: 'datepicker_hint_only' }] };
  const sealed = sealCmbRequestedFill(report, { blockers: [{ path: 'relationshipTypeRow1',
    label: '关系类型', reason: 'profile_fact_unconfirmed' }] });
  assert.equal(sealed.blockers.length, 2);
  assert.equal(assessCmbFillReport(sealed).saveAttempted, true);
  assert.equal(cmbPopupOutcome(sealed, 'fill').reason, 'cmb_save_policy_violation');
  for (const key of ['results', 'blockers']) {
    const nested = { ...report, blockers: [], [key]: [{ ...report.results[0], liveSupportClaimed: true }] };
    assert.equal(cmbPopupOutcome(nested, 'fill').reason, 'cmb_live_support_unverified');
    assert.equal(cmbPopupOutcome(nested, 'inspect').reason, 'cmb_live_support_unverified');
  }
});
