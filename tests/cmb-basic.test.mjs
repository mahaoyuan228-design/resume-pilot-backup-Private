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
  CMB_GENDER_LABEL,
  CMB_GENDER_VALUES,
  CMB_HEIGHT_LABEL,
  CMB_HEIGHT_VALUE_RE,
  isCmbHeightLabel,
  numericCmbHeight,
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

test('gender plan is optional and allowlists 男/女 only', () => {
  assert.equal(CMB_GENDER_LABEL, '性别');
  assert.deepEqual([...CMB_GENDER_VALUES], ['男', '女']);
  const base = {
    fullName: '测试甲',
    phone: '13800138000',
    email: 'cmb.user@example.com',
    confirmedFields: ['fullName', 'phone', 'email']
  };
  const absent = planCmbBasicFromProfile(base);
  assert.equal(absent.ok, true);
  assert.equal(absent.values.gender, '');
  assert.equal(absent.fields.some((row) => row.label === '性别'), false);
  assert.equal(absent.blockers.length, 0);

  const ready = planCmbBasicFromProfile({
    ...base,
    gender: ' 女 ',
    confirmedFields: [...base.confirmedFields, 'gender']
  });
  assert.equal(ready.ok, true);
  assert.equal(ready.values.gender, '女');
  assert.equal(ready.fields.find((row) => row.label === '性别')?.ready, true);

  const unconfirmed = planCmbBasicFromProfile({ ...base, gender: '男' });
  assert.equal(unconfirmed.ok, true);
  assert.equal(unconfirmed.values.gender, '');
  assert.equal(unconfirmed.blockers.find((row) => row.label === '性别')?.reason, 'profile_fact_unconfirmed');

  const invalid = planCmbBasicFromProfile({
    ...base,
    gender: '未知',
    confirmedFields: [...base.confirmedFields, 'gender']
  });
  assert.equal(invalid.ok, true);
  assert.equal(invalid.values.gender, '');
  assert.equal(invalid.blockers.find((row) => row.label === '性别')?.reason, 'invalid_profile_value');
});

test('gender fixture is synthetic and scoped away from the neighbor radio group', () => {
  assert.match(fixture, /data-dom="synthetic-public-css-candidate"/);
  assert.match(fixture, /SYNTHETIC gender radio/);
  assert.match(fixture, /class="ant-radio-wrapper"/);
  assert.match(fixture, /class="ant-radio"/);
  assert.match(fixture, /name="cmb-synthetic-gender"/);
  assert.match(fixture, /name="cmb-synthetic-worked"/);
  assert.match(fixture, />性别</);
  assert.match(fixture, />男</);
  assert.match(fixture, />女</);
  assert.match(fixture, /data-synthetic-neighbor="true"/);
  assert.match(fixture, /Live radio DOM was not harvested/);
  assert.match(source, /GENDER_LABEL = '性别'/);
  assert.match(source, /RADIO_WRAP_SEL = '\.ant-radio-wrapper'/);
  assert.match(source, /RADIO_MARK_SEL = '\.ant-radio'/);
  assert.match(source, /fillGender/);
  assert.match(source, /radio_structure_changed/);
  assert.doesNotMatch(source, /出生日期|政治面貌|婚姻状况|民族/);
  assert.match(harness, /--only 性别/);
  assert.match(harness, /live_gender_radio_unharvested/);
  assert.match(harness, /formFillClaimed: false/);
});

test('synthetic harness gender radio readback 男/女 without touching the neighbor', { timeout: 120000 }, () => {
  const run = spawnSync(process.execPath, ['scripts/auto-cmb-basic.mjs', '--only', '性别'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 110000
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const payload = JSON.parse(readFileSync(resolve(root, 'dist/auto-runs/cmb-gender-radio-latest.json'), 'utf8'));
  assert.equal(payload.ok, true);
  assert.equal(payload.saved, false);
  assert.equal(payload.skippedSave, true);
  assert.equal(payload.liveEdge, false);
  assert.equal(payload.formFillClaimed, false);
  assert.equal(payload.liveRadioDomHarvested, false);
  assert.equal(payload.reason, 'synthetic_gender_radio_pass');
  assert.equal(payload.label, '性别');
  assert.equal(payload.female?.after, '女');
  assert.equal(payload.male?.before, '女');
  assert.equal(payload.male?.after, '男');
  assert.equal(payload.fillBasic?.results?.length, 4);
  assert.equal(payload.fillBasic.results.find((row) => row.label === '性别')?.after, '女');
  assert.equal(payload.fillBasic.results.filter((row) => row.label !== '性别').length, 3);
  assert.ok(payload.fillBasic.results.every((row) => row.ok));
  assert.deepEqual(payload.neighbor?.workedChecked, ['否']);
  assert.deepEqual(payload.neighbor?.genderChecked, ['女']);
  assert.equal(payload.neighbor?.weight, '60');
  assert.equal(payload.neighbor?.saveDisabled, true);
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

test('height plan is optional numeric centimeters and rejects a CM suffix', () => {
  assert.equal(CMB_HEIGHT_LABEL, '身高');
  assert.equal(CMB_HEIGHT_VALUE_RE.test('175'), true);
  assert.equal(CMB_HEIGHT_VALUE_RE.test('175CM'), false);
  assert.equal(isCmbHeightLabel('身高'), true);
  assert.equal(isCmbHeightLabel('身高 CM'), true);
  assert.equal(isCmbHeightLabel('身高CM'), true);
  assert.equal(isCmbHeightLabel('身高（CM）'), true);
  assert.equal(isCmbHeightLabel('*身高 CM：'), true);
  assert.equal(isCmbHeightLabel('体重'), false);
  assert.equal(isCmbHeightLabel('体重 KG'), false);
  assert.equal(isCmbHeightLabel('身高体重'), false);
  assert.equal(numericCmbHeight(' 182 '), '182');
  assert.equal(numericCmbHeight('180.5'), '180.5');
  assert.equal(numericCmbHeight('175CM'), '');
  assert.equal(numericCmbHeight('175 CM'), '');
  assert.equal(numericCmbHeight(''), '');

  const base = {
    fullName: '测试甲',
    phone: '13800138000',
    email: 'cmb.user@example.com',
    confirmedFields: ['fullName', 'phone', 'email']
  };
  const absent = planCmbBasicFromProfile(base);
  assert.equal(absent.ok, true);
  assert.equal(absent.values.height, '');
  assert.equal(absent.fields.some((row) => row.label === '身高'), false);

  const ready = planCmbBasicFromProfile({
    ...base,
    height: ' 175 ',
    confirmedFields: [...base.confirmedFields, 'height']
  });
  assert.equal(ready.ok, true);
  assert.equal(ready.values.height, '175');
  assert.equal(ready.values.gender, '');
  assert.equal(ready.fields.find((row) => row.label === '身高')?.ready, true);

  const unconfirmed = planCmbBasicFromProfile({ ...base, height: '175' });
  assert.equal(unconfirmed.ok, true);
  assert.equal(unconfirmed.values.height, '');
  assert.equal(unconfirmed.blockers.find((row) => row.label === '身高')?.reason, 'profile_fact_unconfirmed');

  const invalid = planCmbBasicFromProfile({
    ...base,
    height: '175CM',
    confirmedFields: [...base.confirmedFields, 'height']
  });
  assert.equal(invalid.ok, true);
  assert.equal(invalid.values.height, '');
  assert.equal(invalid.blockers.find((row) => row.label === '身高')?.reason, 'invalid_profile_value');
});

test('height fixture is synthetic text and does not ship other second-slice fields', () => {
  assert.match(fixture, /SYNTHETIC height text/);
  assert.match(fixture, /data-field="身高"/);
  assert.match(fixture, />身高 CM</);
  assert.match(fixture, /name="height"/);
  assert.match(fixture, /data-unit="CM"/);
  assert.match(fixture, /Live height DOM was not harvested/);
  assert.match(fixture, /value="60"/);
  assert.match(source, /HEIGHT_LABEL = '身高'/);
  assert.match(source, /HEIGHT_VALUE_RE/);
  assert.match(source, /fillHeight/);
  assert.match(source, /Never write a CM suffix into the value/);
  assert.match(source, /input\.ant-input/);
  assert.doesNotMatch(source, /出生日期|政治面貌|婚姻状况|民族/);
  assert.doesNotMatch(source, /birthDate|political|ethnicity|marital/);
  assert.match(harness, /--only 身高/);
  assert.match(harness, /live_height_text_unharvested/);
  assert.match(harness, /formFillClaimed: false/);
  assert.doesNotMatch(source, /click\(.*保存|保存.*\.click/);
});

test('synthetic harness height readback is numeric and --live refuses', { timeout: 120000 }, () => {
  const live = spawnSync(process.execPath, ['scripts/auto-cmb-basic.mjs', '--only', '身高', '--live'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 20000
  });
  assert.equal(live.status, 3, live.stderr || live.stdout);
  const refused = JSON.parse(live.stdout);
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, 'live_height_text_unharvested');
  assert.equal(refused.saved, false);
  assert.equal(refused.skippedSave, true);
  assert.equal(refused.formFillClaimed, false);
  assert.equal(refused.liveHeightDomHarvested, false);
  assert.equal(refused.liveEdge, false);

  const run = spawnSync(process.execPath, ['scripts/auto-cmb-basic.mjs', '--only', '身高'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 110000
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const payload = JSON.parse(readFileSync(resolve(root, 'dist/auto-runs/cmb-height-text-latest.json'), 'utf8'));
  assert.equal(payload.ok, true);
  assert.equal(payload.saved, false);
  assert.equal(payload.skippedSave, true);
  assert.equal(payload.liveEdge, false);
  assert.equal(payload.formFillClaimed, false);
  assert.equal(payload.liveHeightDomHarvested, false);
  assert.equal(payload.reason, 'synthetic_height_text_pass');
  assert.equal(payload.label, '身高');
  assert.equal(payload.invalid?.reason, 'invalid_profile_value');
  assert.equal(payload.explicitInvalid?.reason, 'invalid_height');
  assert.equal(payload.explicitInvalid?.writeAttempted, false);
  assert.equal(payload.afterReject?.height, '');
  assert.equal(payload.afterReject?.weight, '60');
  assert.equal(payload.first?.after, '175');
  assert.equal(payload.second?.before, '175');
  assert.equal(payload.second?.after, '182');
  assert.equal(payload.decimal?.after, '180.5');
  assert.equal(payload.fillBasic?.results?.length, 4);
  assert.equal(payload.fillBasic.results.find((row) => row.label === '身高')?.after, '175');
  assert.equal(/cm/iu.test(payload.fillBasic.results.find((row) => row.label === '身高')?.after || ''), false);
  assert.equal(payload.fillBasic.results.some((row) => row.label === '性别'), false);
  assert.ok(payload.fillBasic.results.every((row) => row.ok));
  assert.deepEqual(payload.neighbor?.genderChecked, []);
  assert.deepEqual(payload.neighbor?.workedChecked, ['否']);
  assert.equal(payload.neighbor?.weight, '60');
  assert.equal(payload.neighbor?.height, '175');
  assert.equal(payload.neighbor?.heightHasUnit, false);
  assert.equal(payload.neighbor?.heightSuffix, 'CM');
  assert.equal(payload.neighbor?.saveDisabled, true);
});
