/**
 * Popup route: career.cmbchina.com injects cmb-basic and never the CMS engine.
 * Fill outcomes use the same fail-closed rules as CMB_BASIC_AUTO.
 * 招行 is not claimed supported.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CMB_BASIC_SCRIPT,
  cmbBasicInjectFiles,
  isCmb,
  isCmbResumeEditPage
} from '../src/content/cmb-profile-map.mjs';
import { assessCmbFillReport, cmbPopupOutcome } from '../src/background/cmb-basic-auto.mjs';

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
  assert.match(popup, /if \(isCmb\(tab\.url\)\) return sendCmb\(type, tab, selectedOwnerToken\)/);
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
