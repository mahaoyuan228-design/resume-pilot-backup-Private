/**
 * Beisen-2022 first-slice: profile map + selector/fill contract (offline).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import {
  BEISEN_2022_SITE_ID,
  BEISEN_2022_TEXT_LABELS,
  planBeisen2022BasicFromProfile,
  normalizeBeisen2022LabelText,
  isBeisen2022Host
} from '../src/content/beisen-2022-profile-map.mjs';

const root = resolve('.');
const source = readFileSync(resolve(root, 'src/content/beisen-2022-basic.js'), 'utf8');
const fixture = readFileSync(resolve(root, 'tests/fixtures/beisen-2022-basic-form.html'), 'utf8');
const harness = readFileSync(resolve(root, 'scripts/auto-beisen-2022-basic.mjs'), 'utf8');

test('siteId and labels stay isolated from CMS/GTH/citics/feishu', () => {
  assert.equal(BEISEN_2022_SITE_ID, 'beisen-2022');
  assert.deepEqual([...BEISEN_2022_TEXT_LABELS], ['姓名', '手机号码', '邮箱']);
  assert.match(source, /siteId: 'beisen-2022'|SITE_ID = 'beisen-2022'/);
  assert.match(source, /ResumeBeisen2022Basic/);
  assert.doesNotMatch(source, /cms-|gth-|careers\.citics|ResumeCitics|ResumeFeishu/);
  assert.match(source, /skippedSave:\s*true/);
  assert.doesNotMatch(source, /click\(.*保存|保存.*\.click/);
  assert.doesNotMatch(source, /phoenix-input|phoenix-select/);
  assert.doesNotMatch(source, /性别|证件|学历/);
  assert.match(source, /field_ambiguous/);
  assert.match(source, /form_not_ready/);
});

test('fixture carries provisional bs-form-item selectors + public portal chrome', () => {
  assert.match(fixture, /class="bs-form-item"/);
  assert.match(fixture, /bs-form-item-label/);
  assert.match(fixture, /class="bs-input"/);
  assert.match(fixture, />姓名</);
  assert.match(fixture, />手机号码</);
  assert.match(fixture, />邮箱</);
  // Public portal chrome from ux-recruitment-portal-2022 SSR (not login-walled form invent)
  assert.match(fixture, /id="bsMain"/);
  assert.match(fixture, /view-main|class="views"/);
  assert.match(fixture, /ux-recruitment-portal-2022|pc-e2be192404257687c4d1|bstatics/);
  assert.match(fixture, /provisional/i);
  assert.match(fixture, /login-walled|登录墙/i);
  assert.match(source, /\.bs-form-item/);
  assert.match(source, /bs-input/);
});

test('host matcher covers *.zhiye.com Beisen-2022 tenants', () => {
  assert.equal(isBeisen2022Host('junlebaoruye.zhiye.com'), true);
  assert.equal(isBeisen2022Host('invt.zhiye.com'), true);
  assert.equal(isBeisen2022Host('jssoft.zhiye.com'), true);
  assert.equal(isBeisen2022Host('wecruit.hotjob.cn'), false);
  assert.equal(isBeisen2022Host('gffunds.jobs.feishu.cn'), false);
  assert.equal(isBeisen2022Host('careers.citics.com'), false);
});

test('normalizeBeisen2022LabelText strips trailing colon/star', () => {
  assert.equal(normalizeBeisen2022LabelText('姓名：'), '姓名');
  assert.equal(normalizeBeisen2022LabelText('*手机号码'), '手机号码');
});

test('plan fail-closed when profile missing or unconfirmed', () => {
  assert.equal(planBeisen2022BasicFromProfile(null).ok, false);
  const plan = planBeisen2022BasicFromProfile({
    fullName: '测试甲',
    phone: '13800138000',
    email: 'a@example.com',
    confirmedFields: ['fullName']
  });
  assert.equal(plan.ok, false);
  assert.equal(plan.reason, 'profile_fields_unavailable');
  assert.equal(plan.blockers.find((row) => row.label === '手机号码')?.reason, 'profile_fact_unconfirmed');
});

test('plan ready maps fullName/phone/email to Beisen-2022 labels', () => {
  const plan = planBeisen2022BasicFromProfile({
    fullName: '测试甲',
    phone: '13800138000',
    email: 'beisen.user@example.com',
    confirmedFields: ['fullName', 'phone', 'email']
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.values.fullName, '测试甲');
  assert.equal(plan.values.mobile, '13800138000');
  assert.equal(plan.values.email, 'beisen.user@example.com');
});

test('harness defaults MODE readiness, CDP_PORT 9237, never Save', () => {
  assert.match(harness, /MODE.*readiness|modeFromEnv/);
  assert.match(harness, /CDP_PORT \|\| '9237'/);
  assert.match(harness, /skippedSave:\s*true/);
  assert.match(harness, /live_fill_refused_login_wall/);
  assert.match(harness, /junlebaoruye\.zhiye\.com/);
});

test('synthetic harness fill-without-save readback for 3 basic fields', { timeout: 120000 }, () => {
  const run = spawnSync(process.execPath, ['scripts/auto-beisen-2022-basic.mjs', '--synthetic'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 90000,
    env: { ...process.env, MODE: 'fill' }
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const evidence = JSON.parse(
    readFileSync(resolve(root, 'dist/auto-runs/beisen-2022-basic-fill-latest.json'), 'utf8')
  );
  assert.equal(evidence.siteId, 'beisen-2022');
  assert.equal(evidence.ok, true);
  assert.equal(evidence.saved, false);
  assert.equal(evidence.skippedSave, true);
  assert.equal(evidence.liveEdge, false);
  assert.equal(evidence.fill?.results?.length, 3);
  assert.ok(evidence.fill.results.every((row) => row.ok === true));
  assert.equal(evidence.neighbor?.value, '0');
  assert.equal(evidence.neverSave?.clicks, 0);
  assert.deepEqual(evidence.neverSave?.labels, []);
});

test('ambiguous fields stay manual while the current editable field fills and reads back', async t => {
  const html = readFileSync(resolve(root, 'tests/fixtures/beisen-2022-basic-ambiguous.html'), 'utf8');
  const dom = new JSDOM(html, { url: 'https://fixture.example.test/resume', pretendToBeVisual: true, runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const { window } = dom, { document } = window;
  let clicks = 0;
  document.addEventListener('click', () => clicks++, true);
  document.querySelector('[name="mobile"]').value = '';
  window.ResumeFormFlow = { ensure: async () => ({ ok: false, status: 'manual', reason: 'form_not_ready', entryAttempted: false, writeAttempted: false }) };
  window.eval(source);
  const result = await window.ResumeBeisen2022Basic.fillBasic({ allowExplicitValues: true, fullName: 'SYNTHETIC_NAME', mobile: '13800138000', email: 'synthetic@example.test' });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'manual');
  assert.equal(result.advisoryHints[0].reason, 'wrong_page');
  assert.equal(result.writeAttempted, true);
  assert.equal(result.results[0].status, 'manual');
  assert.equal(result.results[0].reason, 'field_ambiguous');
  assert.equal(result.results[1].ok, true);
  assert.equal(result.results[1].before, '');
  assert.equal(result.results[1].after, '13800138000');
  assert.equal(document.querySelector('[name="mobile"]').value, '13800138000');
  assert.equal(document.querySelector('[name="fullName-a"]').value, 'KEEP-A');
  assert.equal(result.results[2].status, 'manual');
  assert.equal(result.saved, false);
  assert.equal(result.skippedSave, true);
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(clicks, 0);
});

test('synthetic readiness finds three labels', { timeout: 120000 }, () => {
  const run = spawnSync(process.execPath, ['scripts/auto-beisen-2022-basic.mjs', '--synthetic'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 90000,
    env: { ...process.env, MODE: 'readiness' }
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const evidence = JSON.parse(
    readFileSync(resolve(root, 'dist/auto-runs/beisen-2022-basic-readiness-latest.json'), 'utf8')
  );
  assert.equal(evidence.siteId, 'beisen-2022');
  assert.equal(evidence.ok, true);
  assert.equal(evidence.probe?.foundCount, 3);
});
