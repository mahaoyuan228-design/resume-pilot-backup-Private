/**
 * Hotjob mc (antd-mobile H5) first-slice: profile map + selector/fill contract (offline).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  HOTJOB_MC_SITE_ID,
  HOTJOB_MC_TEXT_LABELS,
  HOTJOB_MC_SELECT_LABELS,
  HOTJOB_MC_SELECT_SPECS,
  planHotjobMcBasicFromProfile,
  normalizeHotjobMcLabelText,
  isHotjobMcHost,
  isHotjobMcPath
} from '../src/content/hotjob-mc-profile-map.mjs';

const root = resolve('.');
const source = readFileSync(resolve(root, 'src/content/hotjob-mc-basic.js'), 'utf8');
const fixture = readFileSync(resolve(root, 'tests/fixtures/hotjob-mc-basic-form.html'), 'utf8');
const harness = readFileSync(resolve(root, 'scripts/auto-hotjob-mc-basic.mjs'), 'utf8');
const tenantCmd = readFileSync(resolve(root, 'scripts/run-hotjob-tenant.cmd'), 'utf8');

test('siteId and labels match live 中联 mc (姓名/移动电话/电子邮箱)', () => {
  assert.equal(HOTJOB_MC_SITE_ID, 'hotjob-mc');
  assert.deepEqual([...HOTJOB_MC_TEXT_LABELS], ['姓名', '移动电话', '电子邮箱']);
  assert.match(source, /SITE_ID = 'hotjob-mc'/);
  assert.match(source, /ResumeHotjobMcBasic/);
  assert.match(source, /移动电话/);
  assert.match(source, /电子邮箱/);
  assert.doesNotMatch(source, /cms_basic|ResumeCitics|feishu-atsx|ResumeMoka/);
  assert.match(source, /skippedSave:\s*true/);
  assert.doesNotMatch(source, /click\(.*下一步|下一步.*\.click|保存.*\.click/);
});

test('fixture mirrors live my-list-item / header-title / am-input-control', () => {
  assert.match(fixture, /class="my-list-item"/);
  assert.match(fixture, /class="header-title"/);
  assert.match(fixture, /am-input-control/);
  assert.match(fixture, /resume-info-title/);
  assert.match(fixture, />姓名</);
  assert.match(fixture, />移动电话</);
  assert.match(fixture, />电子邮箱</);
  assert.match(fixture, /请填写姓名/);
  assert.match(fixture, /NEIGHBOR_KEEP/);
  assert.match(source, /\.my-list-item/);
  assert.match(source, /\.header-title/);
  assert.match(source, /\.am-input-control/);
});

test('fixture + source wire 性别/证件类型 mc-select-popup (select-am-list-extra)', () => {
  assert.deepEqual([...HOTJOB_MC_SELECT_LABELS], ['性别', '证件类型']);
  assert.deepEqual([...HOTJOB_MC_SELECT_SPECS['性别'].alternates], ['男', '女']);
  assert.deepEqual([...HOTJOB_MC_SELECT_SPECS['证件类型'].alternates], [
    '居民身份证',
    '中国护照',
    '外国护照',
    '港澳居民来往内地通行证',
    '港澳居民居住证',
    '台湾居民居住证',
    '台湾居民来往大陆通行证'
  ]);
  assert.match(fixture, /select-am-list-extra/);
  assert.match(fixture, /am-modal mc-select-popup/);
  assert.match(fixture, /am-picker-popup-header-right/);
  assert.match(fixture, />性别</);
  assert.match(fixture, />证件类型</);
  assert.match(fixture, /居民身份证/);
  assert.match(fixture, /中国护照/);
  assert.match(source, /SELECT_SPECS/);
  assert.match(source, /fillSelect/);
  assert.match(source, /mc-select-popup/);
  assert.match(source, /select-am-list-extra/);
  assert.match(source, /label_not_allowed/);
  assert.match(source, /证件类型/);
  assert.doesNotMatch(source, /fillSelect\([^)]*国籍|fillSelect\([^)]*籍贯|fillSelect\([^)]*出生日期/);
  assert.doesNotMatch(source, /click\(.*下一步|下一步.*\.click/);
});

test('host/path matchers accept mc operationResumer only', () => {
  assert.equal(isHotjobMcHost('wecruit.hotjob.cn'), true);
  assert.equal(isHotjobMcHost('jobs.feishu.cn'), false);
  assert.equal(isHotjobMcPath('/SU661f37091eb8053acd6cdf3d/mc/deliver/operationResumer'), true);
  assert.equal(isHotjobMcPath('/SU661f37091eb8053acd6cdf3d/pb/resumeOperation.html'), false);
});

test('normalizeHotjobMcLabelText strips trailing colon/star', () => {
  assert.equal(normalizeHotjobMcLabelText('姓名：'), '姓名');
  assert.equal(normalizeHotjobMcLabelText('*移动电话'), '移动电话');
});

test('plan fail-closed when profile missing or unconfirmed', () => {
  assert.equal(planHotjobMcBasicFromProfile(null).ok, false);
  const plan = planHotjobMcBasicFromProfile({
    fullName: '测试甲',
    phone: '13800138000',
    email: 'a@example.com',
    confirmedFields: ['fullName']
  });
  assert.equal(plan.ok, false);
  assert.equal(plan.reason, 'profile_fields_unavailable');
  assert.equal(plan.blockers.find((row) => row.label === '移动电话')?.reason, 'profile_fact_unconfirmed');
});

test('plan ready maps fullName/phone/email to mc labels', () => {
  const plan = planHotjobMcBasicFromProfile({
    fullName: '测试甲',
    phone: '13800138000',
    email: 'mc.user@example.com',
    confirmedFields: ['fullName', 'phone', 'email']
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.values.fullName, '测试甲');
  assert.equal(plan.values.mobile, '13800138000');
  assert.equal(plan.values.email, 'mc.user@example.com');
});

test('harness defaults MODE readiness, CDP_PORT 9237, restore, never Save', () => {
  assert.match(harness, /MODE.*readiness|modeFromEnv/);
  assert.match(harness, /CDP_PORT \|\| '9237'/);
  assert.match(harness, /skippedSave:\s*true/);
  assert.match(harness, /restore/);
  assert.match(harness, /operationResumer/);
  assert.match(harness, /neverClickedNext/);
});

test('run-hotjob-tenant.cmd routes zhonglian to mc harness', () => {
  assert.match(tenantCmd, /auto-hotjob-mc-basic\.mjs/);
  assert.match(tenantCmd, /zhonglian/);
  assert.match(tenantCmd, /hhembhoojafdefnkonmgoejfedgloanc/);
});

test('synthetic harness fill-without-save + restore for 3 basic fields', { timeout: 120000 }, () => {
  const run = spawnSync(process.execPath, ['scripts/auto-hotjob-mc-basic.mjs', '--synthetic'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 90000,
    env: { ...process.env, MODE: 'fill' }
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const evidence = JSON.parse(
    readFileSync(resolve(root, 'dist/auto-runs/hotjob-mc-basic-fill-latest.json'), 'utf8')
  );
  assert.equal(evidence.siteId, 'hotjob-mc');
  assert.equal(evidence.ok, true);
  assert.equal(evidence.saved, false);
  assert.equal(evidence.skippedSave, true);
  assert.equal(evidence.liveEdge, false);
  assert.equal(evidence.fill?.results?.length, 3);
  assert.ok(evidence.fill.results.every((row) => row.ok === true));
  assert.equal(evidence.afterRestore?.neighbor, 'NEIGHBOR_KEEP');
  assert.equal(evidence.afterRestore?.name, '');
});

test('synthetic readiness finds three labels', { timeout: 120000 }, () => {
  const run = spawnSync(process.execPath, ['scripts/auto-hotjob-mc-basic.mjs', '--synthetic'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 90000,
    env: { ...process.env, MODE: 'readiness' }
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const evidence = JSON.parse(
    readFileSync(resolve(root, 'dist/auto-runs/hotjob-mc-basic-readiness-latest.json'), 'utf8')
  );
  assert.equal(evidence.siteId, 'hotjob-mc');
  assert.equal(evidence.ok, true);
  assert.equal(evidence.probe?.foundCount, 3);
});

test('harness --only rejects non-allowlist select label', () => {
  const run = spawnSync(process.execPath, ['scripts/auto-hotjob-mc-basic.mjs', '--only', '国籍', '--synthetic'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10000
  });
  assert.equal(run.status, 2);
  assert.match(run.stderr + run.stdout, /性别|证件类型/);
});

test('synthetic harness fillSelect 性别 fill-wo-save + restore', { timeout: 120000 }, () => {
  const run = spawnSync(process.execPath, ['scripts/auto-hotjob-mc-basic.mjs', '--only', '性别', '--synthetic'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 90000
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const evidence = JSON.parse(
    readFileSync(resolve(root, 'dist/auto-runs/hotjob-mc-select-性别-latest.json'), 'utf8')
  );
  assert.equal(evidence.siteId, 'hotjob-mc');
  assert.equal(evidence.label, '性别');
  assert.equal(evidence.ok, true);
  assert.equal(evidence.before, '男');
  assert.equal(evidence.after, '女');
  assert.equal(evidence.expected, '女');
  assert.equal(evidence.final, '男');
  assert.equal(evidence.restored, true);
  assert.equal(evidence.saved, false);
  assert.equal(evidence.skippedSave, true);
  assert.equal(evidence.liveEdge, false);
  assert.equal(evidence.commitClicks, 0);
  assert.equal(evidence.neighborsUnchanged, true);
  assert.equal(evidence.neighborValue, 'NEIGHBOR_KEEP');
});

test('synthetic harness fillSelect 证件类型 fill-wo-save + restore', { timeout: 120000 }, () => {
  const run = spawnSync(process.execPath, ['scripts/auto-hotjob-mc-basic.mjs', '--only', '证件类型', '--synthetic'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 90000
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const evidence = JSON.parse(
    readFileSync(resolve(root, 'dist/auto-runs/hotjob-mc-select-证件类型-latest.json'), 'utf8')
  );
  assert.equal(evidence.siteId, 'hotjob-mc');
  assert.equal(evidence.label, '证件类型');
  assert.equal(evidence.ok, true);
  assert.equal(evidence.before, '居民身份证');
  assert.equal(evidence.after, '中国护照');
  assert.equal(evidence.expected, '中国护照');
  assert.equal(evidence.final, '居民身份证');
  assert.equal(evidence.restored, true);
  assert.equal(evidence.saved, false);
  assert.equal(evidence.skippedSave, true);
  assert.equal(evidence.liveEdge, false);
  assert.equal(evidence.commitClicks, 0);
  assert.equal(evidence.neighborsUnchanged, true);
  assert.equal(evidence.neighborValue, 'NEIGHBOR_KEEP');
});
