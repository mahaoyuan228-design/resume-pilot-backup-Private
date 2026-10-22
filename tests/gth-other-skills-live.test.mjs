/**
 * Pure pieces of the GTH other/skills never-save live runner.
 * The CDP attach is exercised with a fake session. No Edge is required.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { assessGthOtherFill, assessGthSkillsFill } from '../src/background/gth-open-fills.mjs';
import {
  BASE_TIP,
  LIVE_BINDING,
  LIVE_FILES,
  OTHER_DESCRIPTION,
  OTHER_TITLE,
  SKILLS_TEXT,
  buildEvidence,
  buildFieldRows,
  buildPageExpression,
  clicksAreDiscardOnly,
  decideCancel,
  decideOpen,
  evidenceExitCode,
  fixedLiveProfiles,
  isSaveLikeRequest,
  partitionTraffic,
  plannedFieldRows,
  readOutDir,
  readPort,
  runGthOtherSkillsLive
} from '../scripts/live/gth-other-skills-live.mjs';

const source = fs.readFileSync(new URL('../scripts/live/gth-other-skills-live.mjs', import.meta.url), 'utf8');
const core = fs.readFileSync(new URL('../src/content/gth-open-fill.js', import.meta.url), 'utf8');
const skillsSource = fs.readFileSync(new URL('../src/content/gth-skills.js', import.meta.url), 'utf8');
const otherSource = fs.readFileSync(new URL('../src/content/gth-other.js', import.meta.url), 'utf8');
const PAGE = 'https://hr.gtht.com/resume/edit/';
const TITLES = ['基本信息', '教育经历', '求职意向', '工作经验', '职业技能与特长', '附件简历', '其他信息'];

function closedEditorSnapshot(extra = {}) {
  return {
    hrefOk: true,
    readyState: 'complete',
    visible: true,
    titlesOk: true,
    foreignFormCount: 0,
    formCount: 0,
    secFormCount: 0,
    editLinkCount: 1,
    editLinkPresentCount: 1,
    editWouldNavigate: false,
    ...extra
  };
}

test('field rows keep readback and fail closed when the control is unknown', () => {
  const matched = buildFieldRows({
    questions: ['职业技能与特长'],
    fillFields: [{ question: '职业技能与特长', status: 'verified', reason: 'readback_matched' }],
    readback: [{ q: '职业技能与特长', value: SKILLS_TEXT, reason: null }],
    expected: { 职业技能与特长: SKILLS_TEXT }
  });
  assert.deepEqual(matched, [{
    q: '职业技能与特长',
    status: 'verified',
    reason: 'readback_matched',
    value: SKILLS_TEXT
  }]);

  const mismatch = buildFieldRows({
    questions: ['标题', '描述'],
    fillFields: [
      { question: '标题', status: 'verified', reason: 'readback_matched' },
      { question: '描述', status: 'verified', reason: 'readback_reapplied' }
    ],
    readback: [
      { q: '标题', value: '别的标题', reason: null },
      { q: '描述', value: OTHER_DESCRIPTION, reason: null }
    ],
    expected: { 标题: OTHER_TITLE, 描述: OTHER_DESCRIPTION },
    extraLabels: ['证书']
  });
  assert.deepEqual(mismatch, [
    { q: '标题', status: 'failed', reason: 'readback_mismatch', value: '别的标题' },
    { q: '描述', status: 'verified', reason: 'readback_reapplied', value: OTHER_DESCRIPTION },
    { q: '证书', status: 'failed', reason: 'control_not_supported', value: null }
  ]);

  const missing = buildFieldRows({
    questions: ['描述'],
    fillFields: [{ question: '描述', status: 'verified', reason: 'readback_matched' }],
    readback: [{ q: '描述', value: null, reason: 'control_not_supported' }],
    expected: { 描述: OTHER_DESCRIPTION }
  });
  assert.deepEqual(missing, [{
    q: '描述',
    status: 'failed',
    reason: 'control_not_supported',
    value: null
  }]);
});

test('save-like detection flags resume writes and ignores GET and dictionary lookups', () => {
  assert.equal(isSaveLikeRequest('POST', 'https://hr.gtht.com/api/resume/edit.json'), true);
  assert.equal(isSaveLikeRequest('POST', 'https://hr.gtht.com/api/resume/save.json?token=secret'), true);
  assert.equal(isSaveLikeRequest('PUT', 'https://hr.gtht.com/profile/submit'), true);
  assert.equal(isSaveLikeRequest('DELETE', 'https://hr.gtht.com/api/resume/edit.json'), true);
  assert.equal(isSaveLikeRequest('POST', 'https://hr.gtht.com/api/resume/getsalaryunit.json'), false);
  assert.equal(isSaveLikeRequest('GET', 'https://hr.gtht.com/api/resume/edit.json'), false);
  assert.equal(isSaveLikeRequest('POST', 'https://hr.gtht.com/api/log'), false);

  const traffic = partitionTraffic([
    { method: 'GET', url: 'https://hr.gtht.com/api/resume/edit.json?x=1', via: 'cdp' },
    { method: 'POST', url: 'https://hr.gtht.com/api/resume/edit.json?token=secret', via: 'xhr' },
    { method: 'POST', url: 'https://hr.gtht.com/api/resume/edit.json?token=secret', via: 'xhr' },
    { method: 'POST', url: 'https://hr.gtht.com/api/resume/getsalaryunit.json', via: 'fetch' },
    { method: 'HEAD', url: 'https://hr.gtht.com/api/resume/save.json' }
  ]);
  assert.equal(traffic.nonGet.length, 2);
  assert.deepEqual(traffic.saveLikePost, [{
    method: 'POST',
    url: 'https://hr.gtht.com/api/resume/edit.json',
    via: 'xhr'
  }]);
  assert.equal(traffic.nonGet.some((row) => row.url.includes('token')), false);
});

test('open and cancel decisions use the shipped controls and refuse save clicks', () => {
  assert.equal(decideOpen(closedEditorSnapshot()).action, 'click_edit');
  assert.deepEqual(decideOpen(closedEditorSnapshot({ editLinkCount: 0, editLinkPresentCount: 0 })), {
    action: 'stop',
    reason: 'control_not_supported',
    detail: 'edit_not_found'
  });
  assert.equal(decideOpen(closedEditorSnapshot({ editLinkCount: 2 })).detail, 'edit_not_unique');
  assert.equal(decideOpen(closedEditorSnapshot({ editWouldNavigate: true })).detail, 'edit_would_navigate');
  assert.equal(decideOpen(closedEditorSnapshot({
    formCount: 1,
    secFormCount: 1,
    editLinkCount: 0,
    editLinkPresentCount: 0
  })).action, 'already_open');
  assert.equal(decideOpen(closedEditorSnapshot({
    formCount: 1,
    secFormCount: 1,
    editLinkCount: 0,
    editLinkPresentCount: 1
  })).detail, 'edit_link_still_present');
  assert.equal(decideOpen(closedEditorSnapshot({ foreignFormCount: 1 })).reason, 'other_section_editor_open');
  assert.equal(decideOpen(closedEditorSnapshot({ hrefOk: false })).reason, 'wrong_page');
  assert.equal(decideOpen(closedEditorSnapshot({ visible: false })).reason, 'page_hidden');

  assert.equal(decideCancel({ cancelCount: 1, cancelText: '取消', cancelType: 'button' }).action, 'click_cancel');
  for (const cancelText of ['保存', '提交', '投递', '删除', '确定', '取消保存']) {
    assert.equal(decideCancel({ cancelCount: 1, cancelText, cancelType: 'button' }).reason, 'control_not_supported', cancelText);
  }
  assert.equal(decideCancel({ cancelCount: 1, cancelText: '取消', cancelType: 'submit' }).detail, 'cancel_not_button');
  assert.equal(decideCancel({ cancelCount: 0, cancelText: '', cancelType: '' }).detail, 'cancel_not_found');
  assert.equal(decideCancel({ cancelCount: 2, cancelText: '取消', cancelType: 'button' }).detail, 'cancel_not_unique');
  assert.equal(clicksAreDiscardOnly([{ label: '编辑' }, { label: '取消' }]), true);
  assert.equal(clicksAreDiscardOnly([{ label: '编辑' }, { label: '保存' }]), false);
});

test('evidence stays never-save and does not claim live support', () => {
  const evidence = buildEvidence({
    tipSha: BASE_TIP,
    fields: plannedFieldRows('not_run'),
    saveLikePost: [{ method: 'POST', url: 'https://hr.gtht.com/api/resume/save.json', via: 'cdp' }],
    finalDetails: { liveSupportClaimed: true, neverSave: false, reason: 'save_like_post', cancelsOk: true }
  });
  assert.equal(evidence.tipSha, BASE_TIP);
  assert.equal(evidence.neverSave, true);
  assert.equal(evidence.liveSupportClaimed, false);
  assert.equal(evidence.finalDetails.liveSupportClaimed, false);
  assert.equal(evidence.finalDetails.neverSave, true);
  assert.equal(evidence.fields.length, 3);
  assert.equal(evidenceExitCode(evidence), 3);
  assert.equal(readPort({}), 9239);
  assert.equal(readPort({ PORT: '9240' }), 9240);
  assert.throws(() => readPort({ PORT: '0' }), /bad port/);
  assert.equal(path.isAbsolute(readOutDir({})), true);
});

test('the fixed profile is confirmed fact text for the shipped questions', () => {
  const profiles = fixedLiveProfiles();
  assert.equal(profiles.skills.customAnswers.职业技能与特长, SKILLS_TEXT);
  assert.match(SKILLS_TEXT, /Python/);
  assert.match(SKILLS_TEXT, /数据分析/);
  assert.equal(profiles.other.customAnswers.标题, OTHER_TITLE);
  assert.equal(profiles.other.customAnswers.描述, OTHER_DESCRIPTION);
  assert.match(OTHER_DESCRIPTION, /。/);
  for (const profile of [profiles.skills, profiles.other]) {
    const blob = JSON.stringify(profile);
    assert.doesNotMatch(blob, /placeholder|测试|TODO|示例|xxx|TEST/iu);
    for (const fact of profile.customFacts) {
      assert.equal(fact.sitePageUrl, PAGE);
      assert.equal(fact.rowContext, 'none');
      assert.equal(fact.answer, profile.customAnswers[fact.question]);
      assert.equal(profile.confirmedFields.includes(`customAnswers.${fact.question}`), true);
    }
  }
  assert.equal(LIVE_BINDING.profileHash.length, 64);
  assert.deepEqual(LIVE_FILES, [
    'src/content/gth-open-fill.js',
    'src/content/gth-skills.js',
    'src/content/gth-other.js'
  ]);
});

test('the page expression only names shipped selectors and does not click save', () => {
  const expression = buildPageExpression();
  assert.match(expression, /\.title_ a\.h-e-btn/);
  assert.match(expression, /form\.el-form\.sec-form/);
  assert.match(expression, /\.el-form-item__label/);
  assert.match(expression, /decideOpen/);
  assert.match(expression, /decideCancel/);
  assert.doesNotMatch(source, /perform\([^)]*['"]保存['"]/);
  assert.doesNotMatch(source, /perform\([^)]*['"]提交['"]/);
  assert.doesNotMatch(source, /perform\([^)]*['"]投递['"]/);
  assert.doesNotMatch(source, /perform\([^)]*['"]删除['"]/);
  assert.doesNotMatch(source, /perform\([^)]*['"]确定['"]/);
  assert.doesNotMatch(source, /liveSupportClaimed\s*[:=]\s*true/);
  assert.match(source, /src\/content\/gth-open-fill\.js/);
  assert.match(source, /src\/content\/gth-skills\.js/);
  assert.match(source, /src\/content\/gth-other\.js/);
});

function resumeTarget() {
  return {
    type: 'page',
    id: 'tab-1',
    url: PAGE,
    title: '简历编辑',
    webSocketDebuggerUrl: 'ws://127.0.0.1:9239/devtools/page/tab-1'
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
      if (value instanceof Error) return { exceptionDetails: { text: value.message } };
      return { result: { type: 'object', value: value ?? { ok: true } } };
    },
    close() {
      steps.push('close');
    }
  };
}

function verifiedFill(question, reason = 'readback_matched') {
  return {
    ok: true,
    reason: null,
    writeStarted: true,
    liveSupportClaimed: false,
    softwareClickedSave: false,
    softwareClickedSubmit: false,
    softwareClickedDelete: false,
    fields: [{ question, status: 'verified', reason }]
  };
}

function happyAnswers() {
  return {
    page_guard: { href: PAGE, title: '简历编辑', readyState: 'complete', password: false },
    chrome_shim: { ok: true, installed: true, preexisting: false },
    install_live: { ok: true },
    'inject_gth-open-fill': { ok: true },
    'inject_gth-skills': { ok: true },
    'inject_gth-other': { ok: true },
    inject_check: { engine: true, skills: true, other: true },
    open_skills: { ok: true, action: 'click_edit', openedByUs: true, alreadyOpen: false },
    fill_skills: verifiedFill('职业技能与特长'),
    read_skills: { ok: true, readback: [{ q: '职业技能与特长', value: SKILLS_TEXT, reason: null }], extraLabels: [], unlabeled: 0 },
    cancel_skills: { ok: true, closed: true, reason: null },
    open_other: { ok: true, action: 'click_edit', openedByUs: true, alreadyOpen: false },
    fill_other: {
      ok: true,
      reason: null,
      writeStarted: true,
      liveSupportClaimed: false,
      softwareClickedSave: false,
      softwareClickedSubmit: false,
      softwareClickedDelete: false,
      fields: [
        { question: '标题', status: 'verified', reason: 'readback_matched' },
        { question: '描述', status: 'verified', reason: 'readback_matched' }
      ]
    },
    read_other: {
      ok: true,
      readback: [
        { q: '标题', value: OTHER_TITLE, reason: null },
        { q: '描述', value: OTHER_DESCRIPTION, reason: null }
      ],
      extraLabels: [],
      unlabeled: 0
    },
    cancel_other: { ok: true, closed: true, reason: null },
    read_posts: [],
    read_clicks: [
      { type: 'click', label: '编辑' },
      { type: 'click', label: '取消' },
      { type: 'click', label: '编辑' },
      { type: 'click', label: '取消' }
    ]
  };
}

async function runFake(answers, { getJson } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gth-live-'));
  const session = fakeSession(answers);
  const evidence = await runGthOtherSkillsLive({
    port: 9239,
    outDir: dir,
    tipSha: '32c9bf2abcdef',
    stepTimeoutMs: 1000,
    getJson: getJson || (async () => [resumeTarget()]),
    connectCdp: async () => session
  });
  return { dir, session, evidence };
}

test('a fake CDP run injects the shipped files, records readback, and cancels', async () => {
  const { evidence, session } = await runFake(happyAnswers());
  assert.equal(evidence.neverSave, true);
  assert.equal(evidence.liveSupportClaimed, false);
  assert.equal(evidence.tipSha, '32c9bf2abcdef');
  assert.deepEqual(evidence.saveLikePost, []);
  assert.deepEqual(evidence.fields.map((row) => row.q), ['职业技能与特长', '标题', '描述']);
  assert.equal(evidence.fields.every((row) => row.status === 'verified'), true);
  assert.equal(evidence.fields[0].value, SKILLS_TEXT);
  assert.equal(evidence.finalDetails.exitCode, 0);
  assert.equal(evidence.finalDetails.cancelsOk, true);
  assert.equal(session.steps.includes('inject_gth-open-fill'), true);
  assert.equal(session.steps.includes('inject_gth-skills'), true);
  assert.equal(session.steps.includes('inject_gth-other'), true);
  assert.ok(session.steps.indexOf('inject_gth-open-fill') < session.steps.indexOf('inject_gth-skills'));
  assert.ok(session.steps.indexOf('inject_gth-skills') < session.steps.indexOf('inject_gth-other'));
  assert.equal(session.steps.includes('fill_skills'), true);
  assert.equal(session.steps.includes('cancel_other'), true);
  const file = JSON.parse(fs.readFileSync(evidence.finalDetails.path, 'utf8'));
  assert.equal(file.liveSupportClaimed, false);
  assert.equal(file.neverSave, true);
  assert.equal(file.finalDetails.baseTip, '32c9bf2');
});

test('a save-like POST is flagged and an unknown edit control skips the fill', async () => {
  const saving = happyAnswers();
  saving.read_posts = [{ method: 'POST', url: 'https://hr.gtht.com/api/resume/edit.json?token=secret', via: 'xhr' }];
  const saved = await runFake(saving);
  assert.equal(saved.evidence.finalDetails.exitCode, 3);
  assert.equal(saved.evidence.neverSave, true);
  assert.equal(saved.evidence.liveSupportClaimed, false);
  assert.equal(saved.evidence.saveLikePost.length, 1);
  assert.equal(saved.evidence.saveLikePost[0].url, 'https://hr.gtht.com/api/resume/edit.json');

  const blocked = happyAnswers();
  blocked.open_skills = { ok: false, action: 'stop', reason: 'control_not_supported', detail: 'edit_not_found', openedByUs: false };
  blocked.open_other = { ok: false, action: 'stop', reason: 'control_not_supported', detail: 'edit_not_found', openedByUs: false };
  const stopped = await runFake(blocked);
  assert.equal(stopped.session.steps.includes('fill_skills'), false);
  assert.equal(stopped.session.steps.includes('cancel_skills'), false);
  assert.equal(stopped.session.steps.includes('fill_other'), false);
  assert.equal(stopped.evidence.fields.every((row) => row.reason === 'control_not_supported'), true);
  assert.equal(stopped.evidence.finalDetails.exitCode, 2);
  assert.equal(stopped.evidence.liveSupportClaimed, false);
});

test('CDP unreachable and a missing tab still write never-save evidence', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gth-live-down-'));
  let connected = false;
  const down = await runGthOtherSkillsLive({
    port: 9239,
    outDir: dir,
    tipSha: BASE_TIP,
    stepTimeoutMs: 1000,
    getJson: async () => { throw new Error('connect ECONNREFUSED'); },
    connectCdp: async () => { connected = true; throw new Error('no socket'); }
  });
  assert.equal(connected, false);
  assert.equal(down.finalDetails.reason, 'cdp_unreachable');
  assert.equal(down.finalDetails.exitCode, 1);
  assert.equal(down.neverSave, true);
  assert.equal(down.liveSupportClaimed, false);
  assert.deepEqual(down.saveLikePost, []);
  assert.equal(down.fields.every((row) => row.status === 'failed' && row.reason === 'cdp_unreachable'), true);

  const missing = await runGthOtherSkillsLive({
    port: 9239,
    outDir: dir,
    tipSha: BASE_TIP,
    stepTimeoutMs: 1000,
    getJson: async () => [{ type: 'page', id: 'other', url: 'https://example.com/', webSocketDebuggerUrl: 'ws://127.0.0.1:9239/devtools/page/x' }],
    connectCdp: async () => { connected = true; throw new Error('no socket'); }
  });
  assert.equal(connected, false);
  assert.equal(missing.finalDetails.reason, 'tab_not_found');
  assert.equal(missing.finalDetails.exitCode, 2);
  assert.equal(missing.fields.every((row) => row.reason === 'tab_not_found'), true);
});

test('help text names the PowerShell command', () => {
  const help = spawnSync(process.execPath, ['scripts/live/gth-other-skills-live.mjs', '--help'], {
    cwd: path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'),
    encoding: 'utf8'
  });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /\$env:PORT='9239'/);
  assert.match(help.stdout, /node scripts\/live\/gth-other-skills-live\.mjs/);
});

function shell(name, body) {
  return TITLES.map((title) => {
    if (title !== name) return `<section class="r-section"><div class="title_">${title}</div></section>`;
    return `<section class="r-section"><div class="title_">${title}</div>${body}</section>`;
  }).join('');
}

function formWrap(inner) {
  return `<form class="el-form sec-form">${inner}<button type="button">取消</button><button type="button">保存</button></form>`;
}

function textItem(label, { tag = 'input', value = '', id = '' } = {}) {
  const control = tag === 'textarea'
    ? `<textarea id="${id}">${value}</textarea>`
    : `<input type="text" id="${id}" value="${value}">`;
  return `<div class="el-form-item"><label class="el-form-item__label">${label}</label><div class="el-form-item__content">${control}</div></div>`;
}

function boot(html) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, { url: PAGE, pretendToBeVisual: true });
  const { window } = dom;
  window.Element.prototype.getClientRects = () => [{ width: 8, height: 8, top: 0, left: 0, bottom: 8, right: 8 }];
  Object.defineProperty(window.document, 'readyState', { configurable: true, get: () => 'complete' });
  const clicks = [];
  const original = window.HTMLElement.prototype.click;
  window.HTMLElement.prototype.click = function clicked() {
    clicks.push(String(this.textContent || '').replace(/\s+/gu, ' ').trim());
    return original.call(this);
  };
  const chrome = {
    runtime: {
      id: 'synthetic-extension',
      getManifest: () => ({ background: { service_worker: 'src/background/worker.mjs' } }),
      sendMessage: async (message) => (message?.type === 'RESUME_PROFILE_BINDING_CHECK' ? { allowed: true } : { allowed: false }),
      onMessage: { addListener() {}, removeListener() {} }
    }
  };
  const context = vm.createContext({
    chrome,
    document: window.document,
    location: window.location,
    performance: window.performance,
    HTMLInputElement: window.HTMLInputElement,
    HTMLTextAreaElement: window.HTMLTextAreaElement,
    Event: window.Event,
    KeyboardEvent: window.KeyboardEvent,
    getComputedStyle: window.getComputedStyle.bind(window),
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window)
  });
  vm.runInContext(core, context);
  vm.runInContext(skillsSource, context);
  vm.runInContext(otherSource, context);
  return { dom, clicks, context };
}

test('the page script opens with the shipped 编辑 link and discards with 取消', async () => {
  const html = TITLES.map((title) => {
    if (title !== '职业技能与特长') return `<section class="r-section"><div class="title_">${title}</div></section>`;
    return `<section class="r-section" id="skills-section"><div class="title_">${title}<a class="h-e-btn" id="edit" href="javascript:;">编辑</a></div><div id="slot"></div></section>`;
  }).join('');
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, { url: PAGE, pretendToBeVisual: true, runScripts: 'dangerously' });
  const { window } = dom;
  window.Element.prototype.getClientRects = () => [{ width: 8, height: 8, top: 0, left: 0, bottom: 8, right: 8 }];
  Object.defineProperty(window.document, 'readyState', { configurable: true, get: () => 'complete' });
  window.document.getElementById('edit').addEventListener('click', () => {
    window.document.getElementById('edit').remove();
    window.document.getElementById('slot').innerHTML = formWrap(textItem('职业技能与特长', { tag: 'textarea', id: 'skills' }));
    window.document.querySelector('#skills-section button').addEventListener('click', () => {
      window.document.querySelector('#skills-section form').remove();
    });
  });
  const script = window.document.createElement('script');
  script.textContent = buildPageExpression();
  window.document.body.appendChild(script);
  const api = window.__gthOtherSkillsLive;
  const opened = await api.open(4);
  assert.equal(opened.ok, true);
  assert.equal(opened.openedByUs, true);
  window.document.getElementById('skills').value = SKILLS_TEXT;
  const read = api.read(4, ['职业技能与特长', '未知题目']);
  assert.equal(read.readback[0].value, SKILLS_TEXT);
  assert.equal(read.readback[1].reason, 'control_not_supported');
  const closed = await api.cancel(4);
  assert.equal(closed.closed, true);
  assert.deepEqual(Array.from(api.clicks(), (click) => String(click.label)), ['编辑', '取消']);
  assert.equal(window.document.querySelector('#skills-section form'), null);
});

test('the fixed profile fills the shipped editors and does not click 保存 or 取消', async () => {
  const profiles = fixedLiveProfiles();
  const skills = boot(shell('职业技能与特长', formWrap(textItem('职业技能与特长', { tag: 'textarea', id: 'skills', value: '旧技能' }))));
  const skillsResult = await skills.context.ResumeGthSkills.trial({
    requestId: 'live-skills-0001',
    profileBinding: LIVE_BINDING,
    replaceExisting: true,
    profile: profiles.skills
  });
  assert.equal(skills.dom.window.document.getElementById('skills').value, SKILLS_TEXT);
  assert.equal(skillsResult.fields[0].status, 'verified');
  assert.equal(skillsResult.fields[0].reason, 'readback_reapplied');
  assert.equal(skillsResult.liveSupportClaimed, false);
  assert.equal(assessGthSkillsFill(skillsResult).ok, true);
  assert.deepEqual(skills.clicks, []);

  const other = boot(shell('其他信息', formWrap(`${textItem('标题', { id: 'title' })}${textItem('描述', { tag: 'textarea', id: 'desc' })}`)));
  const otherResult = await other.context.ResumeGthOther.trial({
    requestId: 'live-other-0001',
    profileBinding: LIVE_BINDING,
    replaceExisting: true,
    profile: profiles.other
  });
  assert.equal(other.dom.window.document.getElementById('title').value, OTHER_TITLE);
  assert.equal(other.dom.window.document.getElementById('desc').value, OTHER_DESCRIPTION);
  assert.equal(otherResult.ok, true);
  assert.equal(otherResult.liveSupportClaimed, false);
  assert.equal(assessGthOtherFill(otherResult).ok, true);
  assert.deepEqual(other.clicks, []);
});
