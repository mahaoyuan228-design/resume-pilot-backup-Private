/**
 * Feishu ATSX first-slice: profile map + selector/fill contract (offline).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  FEISHU_ATSX_SITE_ID,
  FEISHU_ATSX_TEXT_LABELS,
  planFeishuAtsxBasicFromProfile,
  normalizeFeishuAtsxLabelText,
  isFeishuAtsxHost
} from '../src/content/feishu-atsx-profile-map.mjs';

const root = resolve('.');
const source = readFileSync(resolve(root, 'src/content/feishu-atsx-basic.js'), 'utf8');
const fixture = readFileSync(resolve(root, 'tests/fixtures/feishu-atsx-basic-form.html'), 'utf8');
const harness = readFileSync(resolve(root, 'scripts/auto-feishu-atsx-basic.mjs'), 'utf8');

test('siteId and labels stay isolated from CMS/GTH/citics', () => {
  assert.equal(FEISHU_ATSX_SITE_ID, 'feishu-atsx');
  assert.deepEqual([...FEISHU_ATSX_TEXT_LABELS], ['姓名', '手机号码', '邮箱']);
  assert.match(source, /siteId: 'feishu-atsx'|SITE_ID = 'feishu-atsx'/);
  assert.match(source, /ResumeFeishuAtsxBasic/);
  assert.doesNotMatch(source, /cms-|gth-|careers\.citics|ResumeCitics/);
  assert.match(source, /skippedSave:\s*true/);
  assert.doesNotMatch(source, /click\(.*保存|保存.*\.click/);
});

test('fixture carries JS-confirmed atsx-form-item selectors + public portal chrome', () => {
  assert.match(fixture, /class="atsx-form-item"/);
  assert.match(fixture, /atsx-form-item-label/);
  assert.match(fixture, /atsx-form-item-control/);
  assert.match(fixture, /class="atsx-input"/);
  assert.match(fixture, />姓名</);
  assert.match(fixture, />手机号码</);
  assert.match(fixture, />邮箱</);
  // Public portal chrome from saas-career pc bundle (not login-walled form invent)
  assert.match(fixture, /id="bd"/);
  assert.match(fixture, /portal-pc/);
  assert.match(fixture, /topbar-navigation-list/);
  assert.match(fixture, /saas-career|atsx-throne|feishucdn/);
  assert.match(fixture, /JS-confirmed|js-confirmed|8825\.0e3d5ab8|pc\.4481de59/i);
  assert.match(source, /\.atsx-form-item/);
  assert.match(source, /atsx-input/);
});

test('host matcher covers jobs.feishu.cn tenants and bytedance ATSX', () => {
  assert.equal(isFeishuAtsxHost('gffunds.jobs.feishu.cn'), true);
  assert.equal(isFeishuAtsxHost('jobs.bytedance.com'), true);
  assert.equal(isFeishuAtsxHost('xiaomi.jobs.f.mioffice.cn'), true);
  assert.equal(isFeishuAtsxHost('jobs.f.mioffice.cn'), true);
  assert.equal(isFeishuAtsxHost('jobs.f.mioffice.cn.evil.com'), false);
  assert.equal(isFeishuAtsxHost('wecruit.hotjob.cn'), false);
  assert.equal(isFeishuAtsxHost('careers.citics.com'), false);
});

test('normalizeFeishuAtsxLabelText strips trailing colon/star', () => {
  assert.equal(normalizeFeishuAtsxLabelText('姓名：'), '姓名');
  assert.equal(normalizeFeishuAtsxLabelText('*手机号码'), '手机号码');
});

test('plan fail-closed when profile missing or unconfirmed', () => {
  assert.equal(planFeishuAtsxBasicFromProfile(null).ok, false);
  const plan = planFeishuAtsxBasicFromProfile({
    fullName: '测试甲',
    phone: '13800138000',
    email: 'a@example.com',
    confirmedFields: ['fullName']
  });
  assert.equal(plan.ok, false);
  assert.equal(plan.reason, 'profile_fields_unavailable');
  assert.equal(plan.blockers.find((row) => row.label === '手机号码')?.reason, 'profile_fact_unconfirmed');
});

test('plan ready maps fullName/phone/email to ATSX labels', () => {
  const plan = planFeishuAtsxBasicFromProfile({
    fullName: '测试甲',
    phone: '13800138000',
    email: 'atsx.user@example.com',
    confirmedFields: ['fullName', 'phone', 'email']
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.values.fullName, '测试甲');
  assert.equal(plan.values.mobile, '13800138000');
  assert.equal(plan.values.email, 'atsx.user@example.com');
});

test('harness defaults MODE readiness, CDP_PORT 9237, never Save', () => {
  assert.match(harness, /MODE.*readiness|modeFromEnv/);
  assert.match(harness, /CDP_PORT \|\| '9237'/);
  assert.match(harness, /skippedSave:\s*true/);
  assert.match(harness, /live_fill_refused_login_wall/);
  assert.match(harness, /gffunds\.jobs\.feishu\.cn/);
});

test('synthetic harness fill-without-save readback for 3 basic fields', { timeout: 120000 }, () => {
  const run = spawnSync(process.execPath, ['scripts/auto-feishu-atsx-basic.mjs', '--synthetic'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 90000,
    env: { ...process.env, MODE: 'fill' }
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const evidence = JSON.parse(
    readFileSync(resolve(root, 'dist/auto-runs/feishu-atsx-basic-fill-latest.json'), 'utf8')
  );
  assert.equal(evidence.siteId, 'feishu-atsx');
  assert.equal(evidence.ok, true);
  assert.equal(evidence.saved, false);
  assert.equal(evidence.skippedSave, true);
  assert.equal(evidence.liveEdge, false);
  assert.equal(evidence.fill?.results?.length, 3);
  assert.ok(evidence.fill.results.every((row) => row.ok === true));
  assert.equal(evidence.neighbor?.value, '0');
});

test('synthetic readiness finds three labels', { timeout: 120000 }, () => {
  const run = spawnSync(process.execPath, ['scripts/auto-feishu-atsx-basic.mjs', '--synthetic'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 90000,
    env: { ...process.env, MODE: 'readiness' }
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const evidence = JSON.parse(
    readFileSync(resolve(root, 'dist/auto-runs/feishu-atsx-basic-readiness-latest.json'), 'utf8')
  );
  assert.equal(evidence.siteId, 'feishu-atsx');
  assert.equal(evidence.ok, true);
  assert.equal(evidence.probe?.foundCount, 3);
});
