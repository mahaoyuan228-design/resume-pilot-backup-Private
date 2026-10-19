/**
 * Moka first-slice: profile map + selector/fill contract (offline).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  MOKA_SITE_ID,
  MOKA_TEXT_LABELS,
  planMokaBasicFromProfile,
  normalizeMokaLabelText,
  isMokaHost
} from '../src/content/moka-profile-map.mjs';

const root = resolve('.');
const source = readFileSync(resolve(root, 'src/content/moka-basic.js'), 'utf8');
const fixture = readFileSync(resolve(root, 'tests/fixtures/moka-basic-form.html'), 'utf8');
const harness = readFileSync(resolve(root, 'scripts/auto-moka-basic.mjs'), 'utf8');

test('siteId and labels stay isolated from CMS/GTH/citics/feishu', () => {
  assert.equal(MOKA_SITE_ID, 'moka');
  assert.deepEqual([...MOKA_TEXT_LABELS], ['姓名', '手机号码', '邮箱']);
  assert.match(source, /siteId: 'moka'|SITE_ID = 'moka'/);
  assert.match(source, /ResumeMokaBasic/);
  assert.doesNotMatch(source, /cms-|gth-|careers\.citics|ResumeCitics|ResumeFeishu|ResumeBeisen/);
  assert.match(source, /skippedSave:\s*true/);
  assert.doesNotMatch(source, /click\(.*保存|保存.*\.click/);
  assert.doesNotMatch(source, /\.sd-|ITEM_SEL = '\.(?:campus-apply|apply-form)/);
  assert.doesNotMatch(source, /性别|证件|学历/);
  assert.match(source, /field_ambiguous/);
  assert.match(source, /form_not_ready/);
});

test('fixture carries provisional moka-form-item selectors + public portal chrome', () => {
  assert.match(fixture, /class="moka-form-item"/);
  assert.match(fixture, /moka-form-item-label/);
  assert.match(fixture, /class="moka-input"/);
  assert.match(fixture, />姓名</);
  assert.match(fixture, />手机号码</);
  assert.match(fixture, />邮箱</);
  // Public portal chrome from TI campus SSR (not login-walled form invent)
  assert.match(fixture, /id="app"/);
  assert.match(fixture, /id="init-data"/);
  assert.match(fixture, /moka-version|20261012-1723-f0ef3-release/);
  assert.match(fixture, /static-ats\.mokahr\.com|recruitment-web-client/);
  assert.match(fixture, /provisional/i);
  assert.match(fixture, /login-walled|登录墙/i);
  // Documented public CSS hints stay fixture notes only (not content selectors yet)
  assert.match(fixture, /apply-form__field|campus-apply__/);
  assert.match(source, /ITEM_SEL = '\.moka-form-item'/);
  assert.match(source, /moka-input/);
  assert.doesNotMatch(source, /ITEM_SEL = '\.(?:campus-apply|apply-form)/);
});

test('host matcher covers *.mokahr.com Moka tenants', () => {
  assert.equal(isMokaHost('app.mokahr.com'), true);
  assert.equal(isMokaHost('static-ats.mokahr.com'), true);
  assert.equal(isMokaHost('public-cdn.mokahr.com'), true);
  assert.equal(isMokaHost('wecruit.hotjob.cn'), false);
  assert.equal(isMokaHost('gffunds.jobs.feishu.cn'), false);
  assert.equal(isMokaHost('careers.citics.com'), false);
  assert.equal(isMokaHost('junlebaoruye.zhiye.com'), false);
});

test('normalizeMokaLabelText strips trailing colon/star', () => {
  assert.equal(normalizeMokaLabelText('姓名：'), '姓名');
  assert.equal(normalizeMokaLabelText('*手机号码'), '手机号码');
});

test('plan fail-closed when profile missing or unconfirmed', () => {
  assert.equal(planMokaBasicFromProfile(null).ok, false);
  const plan = planMokaBasicFromProfile({
    fullName: '测试甲',
    phone: '13800138000',
    email: 'a@example.com',
    confirmedFields: ['fullName']
  });
  assert.equal(plan.ok, false);
  assert.equal(plan.reason, 'profile_fields_unavailable');
  assert.equal(plan.blockers.find((row) => row.label === '手机号码')?.reason, 'profile_fact_unconfirmed');
});

test('plan ready maps fullName/phone/email to Moka labels', () => {
  const plan = planMokaBasicFromProfile({
    fullName: '测试甲',
    phone: '13800138000',
    email: 'moka.user@example.com',
    confirmedFields: ['fullName', 'phone', 'email']
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.values.fullName, '测试甲');
  assert.equal(plan.values.mobile, '13800138000');
  assert.equal(plan.values.email, 'moka.user@example.com');
});

test('harness defaults MODE readiness, CDP_PORT 9237, never Save', () => {
  assert.match(harness, /MODE.*readiness|modeFromEnv/);
  assert.match(harness, /CDP_PORT \|\| '9237'/);
  assert.match(harness, /skippedSave:\s*true/);
  assert.match(harness, /live_fill_refused_login_wall/);
  assert.match(harness, /app\.mokahr\.com/);
});

test('synthetic harness fill-without-save readback for 3 basic fields', { timeout: 120000 }, () => {
  const run = spawnSync(process.execPath, ['scripts/auto-moka-basic.mjs', '--synthetic'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 90000,
    env: { ...process.env, MODE: 'fill' }
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const evidence = JSON.parse(
    readFileSync(resolve(root, 'dist/auto-runs/moka-basic-fill-latest.json'), 'utf8')
  );
  assert.equal(evidence.siteId, 'moka');
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

test('ambiguous or missing provisional fields fail closed and never save', { timeout: 120000 }, () => {
  const run = spawnSync(process.execPath, [
    'scripts/auto-moka-basic.mjs',
    '--synthetic',
    '--case',
    'ambiguous'
  ], {
    cwd: root,
    encoding: 'utf8',
    timeout: 90000,
    env: { ...process.env, MODE: 'fill' }
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const evidence = JSON.parse(
    readFileSync(resolve(root, 'dist/auto-runs/moka-basic-ambiguous-latest.json'), 'utf8')
  );
  assert.equal(evidence.siteId, 'moka');
  assert.equal(evidence.ok, true);
  assert.equal(evidence.reason, 'ambiguous_fail_closed');
  assert.equal(evidence.saved, false);
  assert.equal(evidence.skippedSave, true);
  assert.equal(evidence.formFillClaimed, false);
  assert.equal(evidence.liveEdge, false);
  assert.equal(evidence.fill?.ok, false);
  assert.equal(evidence.fill?.reason, 'form_not_ready');
  assert.equal(evidence.fill?.writeAttempted, false);
  const reasons = Object.fromEntries((evidence.fill?.results || []).map((row) => [row.label, row.reason]));
  assert.equal(reasons['姓名'], 'field_ambiguous');
  assert.equal(reasons['邮箱'], 'item_not_found');
  assert.equal(reasons['手机号码'], 'skipped_form_not_ready');
  assert.equal(evidence.unchanged, true);
  assert.equal(evidence.neverSave?.clicks, 0);
  const ambiguous = readFileSync(resolve(root, 'tests/fixtures/moka-basic-ambiguous.html'), 'utf8');
  assert.match(ambiguous, /class="moka-form-item"/);
  assert.doesNotMatch(ambiguous, /\.sd-|apply-form__|campus-apply__/);
});

test('synthetic readiness finds three labels', { timeout: 120000 }, () => {
  const run = spawnSync(process.execPath, ['scripts/auto-moka-basic.mjs', '--synthetic'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 90000,
    env: { ...process.env, MODE: 'readiness' }
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const evidence = JSON.parse(
    readFileSync(resolve(root, 'dist/auto-runs/moka-basic-readiness-latest.json'), 'utf8')
  );
  assert.equal(evidence.siteId, 'moka');
  assert.equal(evidence.ok, true);
  assert.equal(evidence.probe?.foundCount, 3);
});
