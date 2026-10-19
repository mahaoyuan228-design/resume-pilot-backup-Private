/**
 * CMB (招商银行) first-slice: profile map + selector/fill contract (offline).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  CMB_SITE_ID,
  CMB_TEXT_LABELS,
  planCmbBasicFromProfile,
  normalizeCmbLabelText,
  isCmbHost,
  isCmbResumeEditPath
} from '../src/content/cmb-profile-map.mjs';

const root = resolve('.');
const source = readFileSync(resolve(root, 'src/content/cmb-basic.js'), 'utf8');
const fixture = readFileSync(resolve(root, 'tests/fixtures/cmb-basic-form.html'), 'utf8');
const harness = readFileSync(resolve(root, 'scripts/auto-cmb-basic.mjs'), 'utf8');

test('siteId and labels stay isolated from CMS/GTH/citics/feishu', () => {
  assert.equal(CMB_SITE_ID, 'cmb');
  assert.deepEqual([...CMB_TEXT_LABELS], ['姓名', '手机号', '邮箱']);
  assert.match(source, /SITE_ID = 'cmb'/);
  assert.match(source, /ResumeCmbBasic/);
  assert.doesNotMatch(source, /cms-|gth-|careers\.citics|ResumeCitics|ResumeFeishu|atsx-form/);
  assert.match(source, /skippedSave:\s*true/);
  assert.doesNotMatch(source, /click\(.*保存|保存.*\.click/);
});

test('fixture carries CSS-confirmed ant-form-item selectors + public shell chrome', () => {
  assert.match(fixture, /class="ant-form-item"/);
  assert.match(fixture, /ant-form-item-label/);
  assert.match(fixture, /ant-form-item-control/);
  assert.match(fixture, /class="ant-input"/);
  assert.match(fixture, />姓名</);
  assert.match(fixture, />手机号</);
  assert.match(fixture, />邮箱</);
  assert.match(fixture, /id="root"/);
  assert.match(fixture, /main\.d37c8446\.js/);
  assert.match(fixture, /main\.02cda64a\.css/);
  assert.match(fixture, /CSS-confirmed|css-confirmed/i);
  assert.match(source, /\.ant-form-item/);
  assert.match(source, /ant-input/);
});

test('host matcher is career.cmbchina.com only (not securities hotjob)', () => {
  assert.equal(isCmbHost('career.cmbchina.com'), true);
  assert.equal(isCmbHost('Career.Cmbchina.com'), true);
  assert.equal(isCmbHost('wecruit.hotjob.cn'), false);
  assert.equal(isCmbHost('careers.citics.com'), false);
  assert.equal(isCmbHost('career.cmbc.com.cn'), false);
  assert.equal(isCmbResumeEditPath('/center/resume'), true);
  assert.equal(isCmbResumeEditPath('/login'), false);
});

test('normalizeCmbLabelText strips trailing colon/star', () => {
  assert.equal(normalizeCmbLabelText('姓名：'), '姓名');
  assert.equal(normalizeCmbLabelText('*手机号'), '手机号');
});

test('plan fail-closed when profile missing or unconfirmed', () => {
  assert.equal(planCmbBasicFromProfile(null).ok, false);
  const plan = planCmbBasicFromProfile({
    fullName: '测试甲',
    phone: '13800138000',
    email: 'a@example.com',
    confirmedFields: ['fullName']
  });
  assert.equal(plan.ok, false);
  assert.equal(plan.reason, 'profile_fields_unavailable');
  assert.equal(plan.blockers.find((row) => row.label === '手机号')?.reason, 'profile_fact_unconfirmed');
});

test('plan ready maps fullName/phone/email to CMB labels', () => {
  const plan = planCmbBasicFromProfile({
    fullName: '测试甲',
    phone: '13800138000',
    email: 'cmb.user@example.com',
    confirmedFields: ['fullName', 'phone', 'email']
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.values.fullName, '测试甲');
  assert.equal(plan.values.mobile, '13800138000');
  assert.equal(plan.values.email, 'cmb.user@example.com');
});

test('harness defaults MODE readiness, CDP_PORT 9237, never Save', () => {
  assert.match(harness, /MODE.*readiness|modeFromEnv/);
  assert.match(harness, /CDP_PORT \|\| '9237'/);
  assert.match(harness, /skippedSave:\s*true/);
  assert.match(harness, /live_fill_refused_login_wall/);
  assert.match(harness, /career\.cmbchina\.com/);
  assert.match(harness, /extension_path_not_wired_yet/);
});

test('synthetic harness fill-without-save readback for 3 basic fields', { timeout: 120000 }, () => {
  const run = spawnSync(process.execPath, ['scripts/auto-cmb-basic.mjs', '--synthetic'], {
    cwd: root,
    env: { ...process.env, MODE: 'fill' },
    encoding: 'utf8',
    timeout: 110000
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const latest = readFileSync(resolve(root, 'dist/auto-runs/cmb-basic-fill-latest.json'), 'utf8');
  const payload = JSON.parse(latest);
  assert.equal(payload.ok, true);
  assert.equal(payload.saved, false);
  assert.equal(payload.skippedSave, true);
  assert.equal(payload.reason, 'synthetic_fill_pass');
  assert.equal(payload.fill?.results?.length, 3);
  assert.ok(payload.fill.results.every((row) => row.ok));
  assert.equal(payload.neighbor?.value, '60');
});
