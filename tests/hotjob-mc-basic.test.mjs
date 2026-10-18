/**
 * hotjob-mc first slice: 中联 operationResumer text fields (offline).
 * CMS basic must refuse the mc shell (exit 4). Not customer-ready. Never Save.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  HOTJOB_MC_SITE_ID,
  HOTJOB_MC_TEXT_LABELS,
  planHotjobMcBasicFromProfile,
  normalizeHotjobMcLabelText,
  isHotjobMcResumeUrl
} from '../src/content/hotjob-mc-profile-map.mjs';
import { ZHONGLIAN_MC_PAGE, HOTJOB_TENANTS } from '../scripts/lib/cms-page-target.mjs';

const root = resolve('.');
const source = readFileSync(resolve(root, 'src/content/hotjob-mc-basic.js'), 'utf8');
const fixture = readFileSync(resolve(root, 'tests/fixtures/hotjob-mc-basic-form.html'), 'utf8');
const harness = readFileSync(resolve(root, 'scripts/auto-hotjob-mc-basic.mjs'), 'utf8');
const tenantCmd = readFileSync(resolve(root, 'scripts/run-hotjob-tenant.cmd'), 'utf8');
const ZL = 'https://wecruit.hotjob.cn/SU661f37091eb8053acd6cdf3d/mc/operationResumer';

test('siteId and labels stay on the mc shell and off Save', () => {
  assert.equal(HOTJOB_MC_SITE_ID, 'hotjob-mc');
  assert.deepEqual([...HOTJOB_MC_TEXT_LABELS], ['姓名', '移动电话', '电子邮箱']);
  assert.equal(HOTJOB_TENANTS.zhonglian.shell, 'mc');
  assert.equal(ZHONGLIAN_MC_PAGE, ZL);
  assert.match(source, /SITE_ID = 'hotjob-mc'/);
  assert.match(source, /ResumeHotjobMcBasic/);
  assert.match(source, /\.my-list-item/);
  assert.match(source, /\.header-title/);
  assert.match(source, /\.am-input-control input/);
  assert.match(source, /skippedSave:\s*true/);
  assert.match(source, /liveSupportClaimed:\s*false/);
  assert.doesNotMatch(source, /cms-|gth-|careers\.citics|ResumeCitics|ResumeFeishu/);
  assert.doesNotMatch(source, /click\(.*保存|保存.*\.click/);
});

test('fixture uses the live operationResumer selectors', () => {
  assert.match(fixture, /class="my-list-item"/);
  assert.match(fixture, /class="header-title"/);
  assert.match(fixture, /class="am-input-control"/);
  assert.match(fixture, />姓名</);
  assert.match(fixture, />移动电话</);
  assert.match(fixture, />电子邮箱</);
  assert.match(fixture, /operationResumer/);
});

test('resume URL matcher accepts 中联 operationResumer and refuses pb', () => {
  assert.equal(isHotjobMcResumeUrl(ZL), true);
  assert.equal(isHotjobMcResumeUrl(`${ZL}?from=campus`), true);
  assert.equal(isHotjobMcResumeUrl('https://wecruit.hotjob.cn/SU661f37091eb8053acd6cdf3d/pb/resumeOperation.html'), false);
  assert.equal(isHotjobMcResumeUrl('https://wecruit.hotjob.cn/SU661f37091eb8053acd6cdf3d/mc/index'), false);
  assert.equal(isHotjobMcResumeUrl('https://gffunds.jobs.feishu.cn/'), false);
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

test('plan ready maps fullName/phone/email onto mc labels', () => {
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
  assert.equal(plan.fields[1].label, '移动电话');
  assert.equal(plan.fields[2].label, '电子邮箱');
});

test('harness defaults and trial extension id', () => {
  assert.match(harness, /MODE.*readiness|modeFromEnv/);
  assert.match(harness, /CDP_PORT \|\| '9237'/);
  assert.match(harness, /skippedSave:\s*true/);
  assert.match(harness, /liveSupportClaimed:\s*false/);
  assert.match(harness, /hhembhoojafdefnkonmgoejfedgloanc/);
  assert.doesNotMatch(harness, /hdekmacbpblppkbpamgocbanjafigfej/);
  assert.match(harness, /operationResumer/);
  assert.match(tenantCmd, /goto :mc/);
  assert.match(tenantCmd, /auto-hotjob-mc-basic\.mjs --live/);
  assert.match(tenantCmd, /hhembhoojafdefnkonmgoejfedgloanc/);
  assert.match(tenantCmd, /SU661f37091eb8053acd6cdf3d\/mc\/operationResumer/);
});

test('synthetic harness fill-without-save readback for 3 basic fields', { timeout: 120000 }, () => {
  const run = spawnSync(process.execPath, ['scripts/auto-hotjob-mc-basic.mjs', '--synthetic'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 90000,
    env: { ...process.env, MODE: 'fill' }
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const evidence = JSON.parse(readFileSync(resolve(root, 'dist/auto-runs/hotjob-mc-basic-fill-latest.json'), 'utf8'));
  assert.equal(evidence.siteId, 'hotjob-mc');
  assert.equal(evidence.ok, true);
  assert.equal(evidence.saved, false);
  assert.equal(evidence.skippedSave, true);
  assert.equal(evidence.liveSupportClaimed, false);
  assert.equal(evidence.liveEdge, false);
  assert.equal(evidence.trialExtId, 'hhembhoojafdefnkonmgoejfedgloanc');
  assert.equal(evidence.fill?.results?.length, 3);
  assert.deepEqual(evidence.fill.results.map((row) => row.label), ['姓名', '移动电话', '电子邮箱']);
  assert.ok(evidence.fill.results.every((row) => row.ok === true && row.after === row.expected));
  assert.equal(evidence.neighbor?.value, '0');
  assert.equal(evidence.neighbor?.saveDisabled, true);
});

test('synthetic readiness finds three labels', { timeout: 120000 }, () => {
  const run = spawnSync(process.execPath, ['scripts/auto-hotjob-mc-basic.mjs', '--synthetic'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 90000,
    env: { ...process.env, MODE: 'readiness' }
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const evidence = JSON.parse(readFileSync(resolve(root, 'dist/auto-runs/hotjob-mc-basic-readiness-latest.json'), 'utf8'));
  assert.equal(evidence.siteId, 'hotjob-mc');
  assert.equal(evidence.ok, true);
  assert.equal(evidence.probe?.foundCount, 3);
  assert.equal(evidence.saved, false);
  assert.equal(evidence.liveSupportClaimed, false);
});
