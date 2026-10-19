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
  CMB_WEIGHT_LABEL,
  CMB_WEIGHT_VALUE_RE,
  CMB_FORMAL_WORK_LABEL,
  CMB_FORMAL_WORK_VALUES,
  CMB_BIRTHDATE_HINT,
  CMB_EDUCATION_LEVEL_LIST_ID,
  CMB_EDUCATION_LEVEL_OPTIONS,
  CMB_EDUCATION_LEVEL_SELECT_ID,
  CMB_RELATIONSHIP_TYPE_LIST_ID,
  CMB_RELATIONSHIP_TYPE_OPTIONS,
  CMB_RELATIONSHIP_TYPE_ROW1_LIST_ID,
  CMB_RELATIONSHIP_TYPE_ROW1_SELECT_ID,
  CMB_RELATIONSHIP_TYPE_SELECT_ID,
  CMB_AWARD_LEVEL_LIST_ID,
  CMB_AWARD_LEVEL_OPTIONS,
  CMB_AWARD_LEVEL_SELECT_ID,
  CMB_ETHNICITY_OPTIONS,
  CMB_ID_CARD_TYPE_LIST_ID,
  CMB_ID_CARD_TYPE_OPTIONS,
  CMB_ID_CARD_TYPE_SELECT_ID,
  CMB_MARITAL_OPTIONS,
  CMB_POLITICS_OPTIONS,
  isCmbHeightLabel,
  isCmbEducationLevelLabel,
  isCmbRelationshipLabel,
  isCmbAwardLevelLabel,
  isCmbIdCardTypeLabel,
  isCmbWeightLabel,
  isCmbMaritalLabel,
  numericCmbHeight,
  numericCmbWeight,
  resolveCmbCodedOption,
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

test('weight plan is optional numeric kilograms and rejects a KG suffix', () => {
  assert.equal(CMB_WEIGHT_LABEL, '体重');
  assert.equal(CMB_WEIGHT_VALUE_RE.test('60'), true);
  assert.equal(CMB_WEIGHT_VALUE_RE.test('60kg'), false);
  assert.equal(CMB_WEIGHT_VALUE_RE.test('60KG'), false);
  assert.equal(isCmbWeightLabel('体重'), true);
  assert.equal(isCmbWeightLabel('体重 KG'), true);
  assert.equal(isCmbWeightLabel('体重KG'), true);
  assert.equal(isCmbWeightLabel('体重（KG）'), true);
  assert.equal(isCmbWeightLabel('*体重 KG：'), true);
  assert.equal(isCmbWeightLabel('身高'), false);
  assert.equal(isCmbWeightLabel('身高 CM'), false);
  assert.equal(isCmbWeightLabel('身高体重'), false);
  assert.equal(isCmbHeightLabel('体重 KG'), false);
  assert.equal(numericCmbWeight(' 60 '), '60');
  assert.equal(numericCmbWeight('62.5'), '62.5');
  assert.equal(numericCmbWeight('60kg'), '');
  assert.equal(numericCmbWeight('60KG'), '');
  assert.equal(numericCmbWeight('60 kg'), '');
  assert.equal(numericCmbWeight(''), '');

  const base = {
    fullName: '测试甲',
    phone: '13800138000',
    email: 'cmb.user@example.com',
    confirmedFields: ['fullName', 'phone', 'email']
  };
  const absent = planCmbBasicFromProfile(base);
  assert.equal(absent.ok, true);
  assert.equal(absent.values.weight, '');
  assert.equal(absent.values.height, '');
  assert.equal(absent.fields.some((row) => row.label === '体重'), false);

  const ready = planCmbBasicFromProfile({
    ...base,
    weight: ' 60 ',
    confirmedFields: [...base.confirmedFields, 'weight']
  });
  assert.equal(ready.ok, true);
  assert.equal(ready.values.weight, '60');
  assert.equal(ready.values.height, '');
  assert.equal(ready.values.gender, '');
  assert.equal(ready.fields.find((row) => row.label === '体重')?.ready, true);

  const unconfirmed = planCmbBasicFromProfile({ ...base, weight: '60' });
  assert.equal(unconfirmed.ok, true);
  assert.equal(unconfirmed.values.weight, '');
  assert.equal(unconfirmed.blockers.find((row) => row.label === '体重')?.reason, 'profile_fact_unconfirmed');

  const invalidLower = planCmbBasicFromProfile({
    ...base,
    weight: '60kg',
    confirmedFields: [...base.confirmedFields, 'weight']
  });
  assert.equal(invalidLower.ok, true);
  assert.equal(invalidLower.values.weight, '');
  assert.equal(invalidLower.blockers.find((row) => row.label === '体重')?.reason, 'invalid_profile_value');

  const invalidUpper = planCmbBasicFromProfile({
    ...base,
    weight: '60KG',
    confirmedFields: [...base.confirmedFields, 'weight']
  });
  assert.equal(invalidUpper.ok, true);
  assert.equal(invalidUpper.values.weight, '');
  assert.equal(invalidUpper.blockers.find((row) => row.label === '体重')?.reason, 'invalid_profile_value');
});

test('weight fixture is synthetic text and does not ship other second-slice fields', () => {
  assert.match(fixture, /SYNTHETIC weight text/);
  assert.match(fixture, /data-field="体重"/);
  assert.match(fixture, />体重 KG</);
  assert.match(fixture, /name="weight"/);
  assert.match(fixture, /data-unit="KG"/);
  assert.match(fixture, /value="60"/);
  assert.match(fixture, /Live weight DOM was not harvested/);
  assert.match(source, /WEIGHT_LABEL = '体重'/);
  assert.match(source, /WEIGHT_VALUE_RE/);
  assert.match(source, /fillWeight/);
  assert.match(source, /Never write a KG suffix into the value/);
  assert.match(source, /input\.ant-input/);
  assert.match(harness, /--only 体重/);
  assert.match(harness, /live_weight_text_unharvested/);
  assert.match(harness, /formFillClaimed: false/);
  assert.doesNotMatch(source, /click\(.*保存|保存.*\.click/);
});

test('synthetic harness weight readback is numeric and --live refuses', { timeout: 120000 }, () => {
  const live = spawnSync(process.execPath, ['scripts/auto-cmb-basic.mjs', '--only', '体重', '--live'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 20000
  });
  assert.equal(live.status, 3, live.stderr || live.stdout);
  const refused = JSON.parse(live.stdout);
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, 'live_weight_text_unharvested');
  assert.equal(refused.saved, false);
  assert.equal(refused.skippedSave, true);
  assert.equal(refused.formFillClaimed, false);
  assert.equal(refused.liveWeightDomHarvested, false);
  assert.equal(refused.liveEdge, false);

  const run = spawnSync(process.execPath, ['scripts/auto-cmb-basic.mjs', '--only', '体重'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 110000
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const payload = JSON.parse(readFileSync(resolve(root, 'dist/auto-runs/cmb-weight-text-latest.json'), 'utf8'));
  assert.equal(payload.ok, true);
  assert.equal(payload.saved, false);
  assert.equal(payload.skippedSave, true);
  assert.equal(payload.liveEdge, false);
  assert.equal(payload.formFillClaimed, false);
  assert.equal(payload.liveWeightDomHarvested, false);
  assert.equal(payload.reason, 'synthetic_weight_text_pass');
  assert.equal(payload.label, '体重');
  assert.equal(payload.invalid?.reason, 'invalid_profile_value');
  assert.equal(payload.invalidUpper?.reason, 'invalid_profile_value');
  assert.equal(payload.explicitInvalid?.reason, 'invalid_weight');
  assert.equal(payload.explicitInvalid?.writeAttempted, false);
  assert.equal(payload.afterReject?.weight, '60');
  assert.equal(payload.afterReject?.height, '');
  assert.deepEqual(payload.afterReject?.genderChecked, []);
  assert.equal(payload.afterReject?.saveDisabled, true);
  assert.equal(payload.first?.before, '60');
  assert.equal(payload.first?.after, '70');
  assert.equal(payload.second?.before, '70');
  assert.equal(payload.second?.after, '65');
  assert.equal(payload.decimal?.after, '62.5');
  assert.equal(payload.fillBasic?.results?.length, 4);
  assert.equal(payload.fillBasic.results.find((row) => row.label === '体重')?.after, '58');
  assert.equal(/kg/iu.test(payload.fillBasic.results.find((row) => row.label === '体重')?.after || ''), false);
  assert.equal(payload.fillBasic.results.some((row) => row.label === '性别'), false);
  assert.equal(payload.fillBasic.results.some((row) => row.label === '身高'), false);
  assert.ok(payload.fillBasic.results.every((row) => row.ok));
  assert.deepEqual(payload.neighbor?.genderChecked, []);
  assert.deepEqual(payload.neighbor?.workedChecked, ['否']);
  assert.equal(payload.neighbor?.height, '');
  assert.equal(payload.neighbor?.heightHasUnit, false);
  assert.equal(payload.neighbor?.heightSuffix, 'CM');
  assert.equal(payload.neighbor?.weight, '58');
  assert.equal(payload.neighbor?.weightHasUnit, false);
  assert.equal(payload.neighbor?.weightSuffix, 'KG');
  assert.equal(payload.neighbor?.saveDisabled, true);
});

test('formal-work plan is optional and allowlists 是/否 only', () => {
  assert.equal(CMB_FORMAL_WORK_LABEL, '是否参加过正式工作');
  assert.deepEqual([...CMB_FORMAL_WORK_VALUES], ['是', '否']);
  const base = {
    fullName: '测试甲',
    phone: '13800138000',
    email: 'cmb.user@example.com',
    confirmedFields: ['fullName', 'phone', 'email']
  };
  const absent = planCmbBasicFromProfile(base);
  assert.equal(absent.ok, true);
  assert.equal(absent.values.formalWork, '');
  assert.equal(absent.values.gender, '');
  assert.equal(absent.values.height, '');
  assert.equal(absent.values.weight, '');
  assert.equal(absent.fields.some((row) => row.label === '是否参加过正式工作'), false);
  assert.equal(absent.blockers.length, 0);

  const ready = planCmbBasicFromProfile({
    ...base,
    formalWork: ' 是 ',
    confirmedFields: [...base.confirmedFields, 'formalWork']
  });
  assert.equal(ready.ok, true);
  assert.equal(ready.values.formalWork, '是');
  assert.equal(ready.values.gender, '');
  assert.equal(ready.fields.find((row) => row.label === '是否参加过正式工作')?.ready, true);

  const readyNo = planCmbBasicFromProfile({
    ...base,
    formalWork: '否',
    confirmedFields: [...base.confirmedFields, 'formalWork']
  });
  assert.equal(readyNo.ok, true);
  assert.equal(readyNo.values.formalWork, '否');

  const unconfirmed = planCmbBasicFromProfile({ ...base, formalWork: '是' });
  assert.equal(unconfirmed.ok, true);
  assert.equal(unconfirmed.values.formalWork, '');
  assert.equal(unconfirmed.blockers.find((row) => row.label === '是否参加过正式工作')?.reason, 'profile_fact_unconfirmed');

  const invalid = planCmbBasicFromProfile({
    ...base,
    formalWork: '未知',
    confirmedFields: [...base.confirmedFields, 'formalWork']
  });
  assert.equal(invalid.ok, true);
  assert.equal(invalid.values.formalWork, '');
  assert.equal(invalid.blockers.find((row) => row.label === '是否参加过正式工作')?.reason, 'invalid_profile_value');
});

test('formal-work fixture is synthetic radio scoped to its own form item', () => {
  assert.match(fixture, /SYNTHETIC formal-work radio/);
  assert.match(fixture, /data-field="是否参加过正式工作"/);
  assert.match(fixture, /name="cmb-synthetic-worked"/);
  assert.match(fixture, /name="cmb-synthetic-gender"/);
  assert.match(fixture, />是</);
  assert.match(fixture, />否</);
  assert.match(fixture, /value="否" checked/);
  assert.match(fixture, /data-synthetic-neighbor="true"/);
  assert.match(fixture, /Live formal-work radio DOM was not harvested/);
  assert.match(fixture, /Field-map options only: 是 \/ 否/);
  assert.match(source, /FORMAL_WORK_LABEL = '是否参加过正式工作'/);
  assert.match(source, /FORMAL_WORK_VALUES = \['是', '否'\]/);
  assert.match(source, /findItem\(FORMAL_WORK_LABEL\)/);
  assert.match(source, /fillFormalWork/);
  assert.match(source, /radio_structure_changed/);
  assert.match(harness, /--only 是否参加过正式工作/);
  assert.match(harness, /live_formal_work_radio_unharvested/);
  assert.match(harness, /formFillClaimed: false/);
  assert.doesNotMatch(source, /click\(.*保存|保存.*\.click/);
});

test('synthetic harness formal-work radio selects 是/否 and --live refuses', { timeout: 120000 }, () => {
  const live = spawnSync(process.execPath, ['scripts/auto-cmb-basic.mjs', '--only', '是否参加过正式工作', '--live'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 20000
  });
  assert.equal(live.status, 3, live.stderr || live.stdout);
  const refused = JSON.parse(live.stdout);
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, 'live_formal_work_radio_unharvested');
  assert.equal(refused.saved, false);
  assert.equal(refused.skippedSave, true);
  assert.equal(refused.formFillClaimed, false);
  assert.equal(refused.liveRadioDomHarvested, false);
  assert.equal(refused.liveEdge, false);
  assert.equal(refused.label, '是否参加过正式工作');

  const run = spawnSync(process.execPath, ['scripts/auto-cmb-basic.mjs', '--only', '是否参加过正式工作'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 110000
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const payload = JSON.parse(readFileSync(resolve(root, 'dist/auto-runs/cmb-formal-work-radio-latest.json'), 'utf8'));
  assert.equal(payload.ok, true);
  assert.equal(payload.saved, false);
  assert.equal(payload.skippedSave, true);
  assert.equal(payload.liveEdge, false);
  assert.equal(payload.formFillClaimed, false);
  assert.equal(payload.liveRadioDomHarvested, false);
  assert.equal(payload.reason, 'synthetic_formal_work_radio_pass');
  assert.equal(payload.label, '是否参加过正式工作');
  assert.equal(payload.invalid?.reason, 'invalid_profile_value');
  assert.equal(payload.explicitInvalid?.reason, 'invalid_formal_work');
  assert.equal(payload.explicitInvalid?.writeAttempted, false);
  assert.deepEqual(payload.afterReject?.workedChecked, ['否']);
  assert.deepEqual(payload.afterReject?.genderChecked, []);
  assert.equal(payload.afterReject?.height, '');
  assert.equal(payload.afterReject?.weight, '60');
  assert.equal(payload.afterReject?.saveDisabled, true);
  assert.equal(payload.yes?.before, '否');
  assert.equal(payload.yes?.after, '是');
  assert.equal(payload.no?.before, '是');
  assert.equal(payload.no?.after, '否');
  assert.equal(payload.fillBasic?.results?.length, 4);
  assert.equal(payload.fillBasic.results.find((row) => row.label === '是否参加过正式工作')?.after, '是');
  assert.equal(payload.fillBasic.results.some((row) => row.label === '性别'), false);
  assert.equal(payload.fillBasic.results.some((row) => row.label === '身高'), false);
  assert.equal(payload.fillBasic.results.some((row) => row.label === '体重'), false);
  assert.ok(payload.fillBasic.results.every((row) => row.ok));
  assert.deepEqual(payload.neighbor?.workedChecked, ['是']);
  assert.deepEqual(payload.neighbor?.genderChecked, []);
  assert.equal(payload.neighbor?.height, '');
  assert.equal(payload.neighbor?.heightSuffix, 'CM');
  assert.equal(payload.neighbor?.weight, '60');
  assert.equal(payload.neighbor?.weightSuffix, 'KG');
  assert.equal(payload.neighbor?.saveDisabled, true);
});

test('harvested gated dicts match the live evidence and are not invented', () => {
  const harvest = JSON.parse(readFileSync(resolve(root, 'dist/site-probes/cmb-live-gated-harvest-20261019.json'), 'utf8'));
  assert.equal(harvest.neverSave, true);
  assert.equal(harvest.url, 'https://career.cmbchina.com/center/resume');
  assert.equal(harvest.fields.maritalStatus.optionCount, 4);
  assert.equal(harvest.fields.politics.optionCount, 13);
  assert.equal(harvest.fields.ethnicity.optionCount, 57);
  assert.equal(harvest.fields.birthDate.kindGuess, 'DatePicker');
  assert.equal(harvest.fields.birthDate.input.readOnly, true);
  assert.equal(harvest.fields.birthDate.input.placeholder, '请选择日期');
  assert.match(harvest.notes.join('\n'), /Do NOT claim live fill/);

  const pairs = (field) => field.options.map((row) => ({ text: row.text, code: row.code }));
  assert.deepEqual([...CMB_MARITAL_OPTIONS], pairs(harvest.fields.maritalStatus));
  assert.deepEqual([...CMB_POLITICS_OPTIONS], pairs(harvest.fields.politics));
  assert.deepEqual([...CMB_ETHNICITY_OPTIONS], pairs(harvest.fields.ethnicity));
  assert.equal(CMB_MARITAL_OPTIONS.some((row) => row.text === '请选择'), false);
  assert.equal(resolveCmbCodedOption(CMB_MARITAL_OPTIONS, 'MS007')?.text, '已育');
  assert.equal(resolveCmbCodedOption(CMB_POLITICS_OPTIONS, '党员'), null);
  assert.equal(resolveCmbCodedOption(CMB_ETHNICITY_OPTIONS, '汉族')?.code, 'NA0017');
  assert.equal(resolveCmbCodedOption(CMB_ETHNICITY_OPTIONS, '其他')?.code, 'NA0056');
  assert.equal(CMB_BIRTHDATE_HINT.kind, 'DatePicker');
  assert.equal(CMB_BIRTHDATE_HINT.syntheticDom, false);
  assert.equal(CMB_BIRTHDATE_HINT.selectId, 'resume_basicInfo_birthday');

  const embedded = source.match(/const GATED_DICTS = JSON\.parse\('(.*)'\);/);
  assert.ok(embedded);
  const parsed = JSON.parse(embedded[1]);
  assert.deepEqual(parsed.maritalStatus, [...CMB_MARITAL_OPTIONS]);
  assert.deepEqual(parsed.politics, [...CMB_POLITICS_OPTIONS]);
  assert.deepEqual(parsed.ethnicity, [...CMB_ETHNICITY_OPTIONS]);
  assert.deepEqual(parsed.idCardType, [...CMB_ID_CARD_TYPE_OPTIONS]);
  assert.deepEqual(parsed.educationLevel, [...CMB_EDUCATION_LEVEL_OPTIONS]);
  assert.deepEqual(parsed.relationshipType, [...CMB_RELATIONSHIP_TYPE_OPTIONS]);
  assert.deepEqual(parsed.awardLevel, [...CMB_AWARD_LEVEL_OPTIONS]);

  assert.match(fixture, /id="resume_basicInfo_maritalStatus"/);
  assert.match(fixture, /id="resume_basicInfo_politicalAffinity"/);
  assert.match(fixture, /id="resume_basicInfo_nation"/);
  assert.match(fixture, /data-show-search="true"/);
  assert.match(fixture, /data-code="MS001"/);
  assert.match(fixture, /data-code="NA0056"/);
  assert.equal((fixture.match(/data-code="MS/g) || []).length, 4);
  assert.equal((fixture.match(/data-code="PA/g) || []).length, 13);
  assert.equal((fixture.match(/data-code="NA/g) || []).length, 57);
  assert.doesNotMatch(fixture, /resume_basicInfo_birthday/);
  assert.doesNotMatch(fixture, /type="date"/);
  assert.match(source, /fillMaritalStatus/);
  assert.match(source, /fillPolitics/);
  assert.match(source, /fillEthnicity/);
  assert.match(source, /datepicker_hint_only/);
  assert.match(source, /birthDateHint/);
  assert.doesNotMatch(source, /click\(.*保存|保存.*\.click/);
  assert.match(harness, /live_marital_select_fill_unclaimed/);
  assert.match(harness, /datepicker_hint_only/);
  assert.equal(isCmbMaritalLabel('婚姻状况（可选）'), true);
  assert.equal(isCmbMaritalLabel('国籍'), false);
});

test('gated select plan maps harvested text or code and does not fill birth date', () => {
  const base = {
    fullName: '测试甲',
    phone: '13800138000',
    email: 'cmb.user@example.com',
    confirmedFields: ['fullName', 'phone', 'email']
  };
  const absent = planCmbBasicFromProfile(base);
  assert.equal(absent.values.maritalStatus, '');
  assert.equal(absent.values.politics, '');
  assert.equal(absent.values.ethnicity, '');
  assert.equal(absent.values.idCardType, '');
  assert.equal(absent.values.educationLevel, '');
  assert.equal(absent.values.relationshipType, '');
  assert.equal(absent.values.relationshipTypeRow1, '');
  assert.equal(absent.values.awardLevel, '');
  assert.equal(absent.fields.some((row) => row.path === 'birthDate'), false);

  const ready = planCmbBasicFromProfile({
    ...base,
    maritalStatus: ' MS002 ',
    politics: '群众',
    ethnicity: 'NA0018',
    confirmedFields: [...base.confirmedFields, 'maritalStatus', 'politics', 'ethnicity']
  });
  assert.equal(ready.ok, true);
  assert.equal(ready.values.maritalStatus, '已婚');
  assert.equal(ready.values.politics, '群众');
  assert.equal(ready.values.ethnicity, '回族');
  assert.equal(ready.fields.find((row) => row.path === 'maritalStatus')?.code, 'MS002');

  const unconfirmed = planCmbBasicFromProfile({ ...base, ethnicity: '汉族' });
  assert.equal(unconfirmed.values.ethnicity, '');
  assert.equal(unconfirmed.blockers.find((row) => row.path === 'ethnicity')?.reason, 'profile_fact_unconfirmed');

  const invalid = planCmbBasicFromProfile({
    ...base,
    politics: '团员',
    confirmedFields: [...base.confirmedFields, 'politics']
  });
  assert.equal(invalid.ok, true);
  assert.equal(invalid.values.politics, '');
  assert.equal(invalid.blockers.find((row) => row.path === 'politics')?.reason, 'invalid_profile_value');

  const birth = planCmbBasicFromProfile({
    ...base,
    birthDate: '1990-01-02',
    confirmedFields: [...base.confirmedFields, 'birthDate']
  });
  assert.equal(birth.ok, true);
  assert.equal(birth.values.birthDate, undefined);
  assert.equal(birth.blockers.find((row) => row.path === 'birthDate')?.reason, 'datepicker_hint_only');
  assert.equal(birth.blockers.find((row) => row.path === 'birthDate')?.kind, 'DatePicker');

  const idReady = planCmbBasicFromProfile({
    ...base,
    idCardType: ' ID0011 ',
    confirmedFields: [...base.confirmedFields, 'idCardType']
  });
  assert.equal(idReady.ok, true);
  assert.equal(idReady.values.idCardType, '台胞证');
  assert.equal(idReady.fields.find((row) => row.path === 'idCardType')?.code, 'ID0011');
  const idInvalid = planCmbBasicFromProfile({
    ...base,
    idCardType: '护照',
    confirmedFields: [...base.confirmedFields, 'idCardType']
  });
  assert.equal(idInvalid.values.idCardType, '');
  assert.equal(idInvalid.blockers.find((row) => row.path === 'idCardType')?.reason, 'invalid_profile_value');
});

test('IdCardType options match the dictmap and the select uses the harvested DOM id', () => {
  const full = JSON.parse(readFileSync(resolve(root, 'dist/site-probes/cmb-dictmap-full-20261019.json'), 'utf8'));
  const dom = JSON.parse(readFileSync(resolve(root, 'dist/site-probes/cmb-harvest-idCardType-dom-20261019.json'), 'utf8'));
  assert.equal(full.neverSave, true);
  assert.equal(dom.neverSave, true);
  assert.equal(dom.field.scoped.inputId, 'resume_basicInfo_idCardType');
  assert.equal(dom.field.scoped.listId, 'resume_basicInfo_idCardType_list');
  assert.equal(dom.field.scoped.label, '证件类型');
  assert.equal(dom.field.scoped.selectClass.includes('ant-select-show-search'), false);
  assert.equal(dom.field.allLabels.find((row) => row.text === '证件号')?.forId, 'resume_basicInfo_idCard');
  const rows = full.dicts.IdCardType.filter((row) => row.name !== '请选择');
  assert.equal(rows.length, 15);
  assert.deepEqual(
    [...CMB_ID_CARD_TYPE_OPTIONS],
    rows.map((row) => ({ text: row.name, code: row.code }))
  );
  assert.equal(CMB_ID_CARD_TYPE_SELECT_ID, 'resume_basicInfo_idCardType');
  assert.equal(CMB_ID_CARD_TYPE_LIST_ID, 'resume_basicInfo_idCardType_list');
  assert.equal(resolveCmbCodedOption(CMB_ID_CARD_TYPE_OPTIONS, 'ID001')?.text, '身份证');
  assert.equal(resolveCmbCodedOption(CMB_ID_CARD_TYPE_OPTIONS, '台胞证')?.code, 'ID0011');
  assert.equal(resolveCmbCodedOption(CMB_ID_CARD_TYPE_OPTIONS, '非公务赴台证')?.code, 'ID0010');
  assert.equal(resolveCmbCodedOption(CMB_ID_CARD_TYPE_OPTIONS, '请选择'), null);
  assert.equal(resolveCmbCodedOption(CMB_ID_CARD_TYPE_OPTIONS, '护照'), null);
  assert.equal(resolveCmbCodedOption(CMB_ID_CARD_TYPE_OPTIONS, '签证'), null);
  assert.equal(resolveCmbCodedOption(CMB_ID_CARD_TYPE_OPTIONS, '因私护照')?.code, 'ID005');
  assert.match(fixture, /id="resume_basicInfo_idCardType"/);
  assert.match(fixture, /id="resume_basicInfo_idCardType_list"/);
  const idCardOpen = fixture.match(/<div class="([^"]*)" id="resume_basicInfo_idCardType">/);
  assert.ok(idCardOpen);
  assert.equal(idCardOpen[1].includes('ant-select-show-search'), false);
  assert.equal(idCardOpen[1].includes('ant-select-show-arrow'), true);
  assert.equal(idCardOpen[1].includes('ant-select-allow-clear'), true);
  assert.match(fixture, /id="resume_basicInfo_idCard"/);
  assert.doesNotMatch(fixture, /cmb-synthetic-idCardType/);
  assert.doesNotMatch(fixture, /id="resume_basicInfo_idCardType"[^>]*show-search/);
  assert.equal((fixture.match(/data-code="ID/g) || []).length, 15);
  assert.match(source, /fillIdCardType/);
  assert.match(source, /resume_basicInfo_idCardType/);
  assert.match(source, /invalid_id_card_type/);
  assert.doesNotMatch(source, /selectIdStatus: 'provisional'/);
  assert.doesNotMatch(source, /cmb-synthetic-idCardType/);
  assert.match(harness, /live_id_card_type_select_fill_unclaimed/);
  assert.doesNotMatch(harness, /live_id_card_type_dom_unharvested/);
  assert.equal(isCmbIdCardTypeLabel('证件类型'), true);
  assert.equal(isCmbIdCardTypeLabel('证件号'), false);
  const store = readFileSync(resolve(root, 'src/profile/store.js'), 'utf8');
  assert.doesNotMatch(store, /idCardType/);
  for (const key of ['EnglishLevel', 'Education', 'RelationshipType', 'InterviewCity', 'AwardsLevel', 'RankingMajor', 'ChannelType']) {
    assert.ok(Array.isArray(full.dicts[key]) && full.dicts[key].length > 0, key);
  }
});

function assertGatedSelectKnife(label, liveReason, passReason, latestName, text, code) {
  const live = spawnSync(process.execPath, ['scripts/auto-cmb-basic.mjs', '--only', label, '--live'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 20000
  });
  assert.equal(live.status, 3, live.stderr || live.stdout);
  const refused = JSON.parse(live.stdout);
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, liveReason);
  assert.equal(refused.saved, false);
  assert.equal(refused.skippedSave, true);
  assert.equal(refused.formFillClaimed, false);
  assert.equal(refused.liveSelectFillClaimed, false);
  assert.equal(refused.optionListHarvested, true);
  assert.equal(refused.liveEdge, false);

  const run = spawnSync(process.execPath, ['scripts/auto-cmb-basic.mjs', '--only', label], {
    cwd: root,
    encoding: 'utf8',
    timeout: 110000
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const payload = JSON.parse(readFileSync(resolve(root, `dist/auto-runs/${latestName}`), 'utf8'));
  assert.equal(payload.ok, true);
  assert.equal(payload.reason, passReason);
  assert.equal(payload.saved, false);
  assert.equal(payload.skippedSave, true);
  assert.equal(payload.liveEdge, false);
  assert.equal(payload.formFillClaimed, false);
  assert.equal(payload.liveSelectFillClaimed, false);
  assert.equal(payload.label, label === '婚姻状况' ? '婚姻状况' : label);
  assert.equal(payload.byCode?.after, text);
  assert.equal(payload.byCode?.afterCode, code);
  assert.equal(payload.explicitInvalid?.writeAttempted, false);
  assert.equal(payload.neighbor?.weight, '60');
  assert.equal(payload.neighbor?.saveDisabled, true);
  assert.equal(payload.neighbor?.birthdayNode, false);
  assert.equal(payload.neighbor?.ethnicity?.search, '');
  assert.deepEqual(payload.neighbor?.workedChecked, ['否']);
  assert.equal(payload.planReady?.blockers?.some((row) => row.reason === 'datepicker_hint_only'), true);
  assert.ok(payload.fillBasic?.results?.every((row) => row.ok));
}

test('synthetic harness marital select maps text and code and --live refuses', { timeout: 120000 }, () => {
  assertGatedSelectKnife(
    '婚姻状况',
    'live_marital_select_fill_unclaimed',
    'synthetic_marital_select_pass',
    'cmb-marital-select-latest.json',
    '已婚',
    'MS002'
  );
});

test('synthetic harness politics select maps text and code and --live refuses', { timeout: 120000 }, () => {
  assertGatedSelectKnife(
    '政治面貌',
    'live_politics_select_fill_unclaimed',
    'synthetic_politics_select_pass',
    'cmb-politics-select-latest.json',
    '中国共产党党员',
    'PA001'
  );
});

test('synthetic harness ethnicity select maps text and code and --live refuses', { timeout: 120000 }, () => {
  assertGatedSelectKnife(
    '民族',
    'live_ethnicity_select_fill_unclaimed',
    'synthetic_ethnicity_select_pass',
    'cmb-ethnicity-select-latest.json',
    '回族',
    'NA0018'
  );
});

test('synthetic harness id card type select maps text and code and --live still refuses the click', { timeout: 120000 }, () => {
  assertGatedSelectKnife(
    '证件类型',
    'live_id_card_type_select_fill_unclaimed',
    'synthetic_idCard_select_pass',
    'cmb-idCard-select-latest.json',
    '台胞证',
    'ID0011'
  );
  const payload = JSON.parse(readFileSync(resolve(root, 'dist/auto-runs/cmb-idCard-select-latest.json'), 'utf8'));
  assert.equal(payload.optionListHarvested, true);
  assert.equal(payload.liveSelectFillClaimed, false);
  assert.equal(payload.formFillClaimed, false);
  assert.equal(payload.fixture, 'synthetic-harvested-options');
  assert.equal(payload.neighbor?.idNumber, '');
  assert.equal(payload.byText?.after, '身份证');
  assert.equal(payload.byText?.afterCode, 'ID001');
  const live = spawnSync(process.execPath, ['scripts/auto-cmb-basic.mjs', '--only', '证件类型', '--live'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 20000
  });
  assert.equal(live.status, 3, live.stderr || live.stdout);
  const refused = JSON.parse(live.stdout);
  assert.equal(refused.reason, 'live_id_card_type_select_fill_unclaimed');
  assert.equal(refused.optionListHarvested, true);
  assert.equal(refused.liveSelectFillClaimed, false);
  assert.equal(refused.formFillClaimed, false);
  assert.equal(refused.selectIdStatus, undefined);
});

test('Education options drop ED000 and use the harvested row-0 select id', () => {
  const full = JSON.parse(readFileSync(resolve(root, 'dist/site-probes/cmb-dictmap-full-20261019.json'), 'utf8'));
  const dom = JSON.parse(readFileSync(resolve(root, 'dist/site-probes/cmb-remaining-dom-ids-20261019.json'), 'utf8'));
  assert.equal(dom.neverSave, true);
  assert.equal(dom.resumeIdCount, 67);
  assert.equal(dom.resumeIds.includes('resume_educationHistoryList_0_educationLevelCode'), true);
  assert.equal(dom.resumeIds.some((id) => /ranking|RankingMajor/i.test(id)), false);
  const hint = dom.labelHints.find((row) => row.label === '学历');
  assert.equal(hint.inputId, CMB_EDUCATION_LEVEL_SELECT_ID);
  assert.equal(hint.ariaControls, CMB_EDUCATION_LEVEL_LIST_ID);
  const kept = full.dicts.Education.filter((row) => row.code !== 'ED000' && row.name !== '请选择');
  assert.equal(kept.length, 7);
  assert.deepEqual(
    [...CMB_EDUCATION_LEVEL_OPTIONS],
    kept.map((row) => ({ text: row.name, code: row.code }))
  );
  assert.equal(CMB_EDUCATION_LEVEL_OPTIONS.some((row) => row.code === 'ED000' || row.text === '博士后'), false);
  assert.equal(resolveCmbCodedOption(CMB_EDUCATION_LEVEL_OPTIONS, 'ED000'), null);
  assert.equal(resolveCmbCodedOption(CMB_EDUCATION_LEVEL_OPTIONS, '博士后'), null);
  assert.equal(resolveCmbCodedOption(CMB_EDUCATION_LEVEL_OPTIONS, '请选择'), null);
  assert.equal(resolveCmbCodedOption(CMB_EDUCATION_LEVEL_OPTIONS, '研究生'), null);
  assert.equal(resolveCmbCodedOption(CMB_EDUCATION_LEVEL_OPTIONS, 'ED004')?.text, '本科');
  assert.equal(resolveCmbCodedOption(CMB_EDUCATION_LEVEL_OPTIONS, '中技(中专/技校/职高)')?.code, 'ED006');
  assert.equal(resolveCmbCodedOption(CMB_EDUCATION_LEVEL_OPTIONS, '硕士研究生')?.code, 'ED003');
  assert.match(fixture, /id="resume_educationHistoryList_0_educationLevelCode"/);
  assert.match(fixture, /id="resume_educationHistoryList_0_educationLevelCode_list"/);
  assert.doesNotMatch(fixture, /data-code="ED000"/);
  assert.doesNotMatch(fixture, /博士后/);
  assert.equal((fixture.match(/data-code="ED/g) || []).length, 7);
  assert.doesNotMatch(fixture, /id="resume_educationHistoryList_0_educationLevelCode"[^>]*show-search/);
  assert.match(source, /fillEducationLevel/);
  assert.match(source, /invalid_education_level/);
  assert.match(harness, /live_education_level_select_fill_unclaimed/);
  assert.equal(isCmbEducationLevelLabel('学历'), true);
  assert.equal(isCmbEducationLevelLabel('学校名称'), false);
  const store = readFileSync(resolve(root, 'src/profile/store.js'), 'utf8');
  assert.doesNotMatch(store, /educationLevel/);
  const base = {
    fullName: '测试甲',
    phone: '13800138000',
    email: 'cmb.user@example.com',
    confirmedFields: ['fullName', 'phone', 'email', 'educationLevel']
  };
  const ready = planCmbBasicFromProfile({ ...base, educationLevel: ' ED004 ' });
  assert.equal(ready.values.educationLevel, '本科');
  assert.equal(ready.fields.find((row) => row.path === 'educationLevel')?.code, 'ED004');
  const dropped = planCmbBasicFromProfile({ ...base, educationLevel: '博士后' });
  assert.equal(dropped.values.educationLevel, '');
  assert.equal(dropped.blockers.find((row) => row.path === 'educationLevel')?.reason, 'invalid_profile_value');
});

test('synthetic harness education select maps text and code and --live refuses the click', { timeout: 120000 }, () => {
  assertGatedSelectKnife(
    '学历',
    'live_education_level_select_fill_unclaimed',
    'synthetic_education_select_pass',
    'cmb-education-select-latest.json',
    '硕士研究生',
    'ED003'
  );
  const payload = JSON.parse(readFileSync(resolve(root, 'dist/auto-runs/cmb-education-select-latest.json'), 'utf8'));
  assert.equal(payload.optionListHarvested, true);
  assert.equal(payload.liveSelectFillClaimed, false);
  assert.equal(payload.formFillClaimed, false);
  assert.equal(payload.neighbor?.idNumber, '');
  assert.equal(payload.neighbor?.idCard?.text, '');
  assert.equal(payload.byText?.after, '本科');
  assert.equal(payload.byText?.afterCode, 'ED004');
  assert.equal(payload.explicitInvalid?.reason, 'invalid_education_level');
});

test('RelationshipType options use both harvested family rows and do not cross indexes', () => {
  const full = JSON.parse(readFileSync(resolve(root, 'dist/site-probes/cmb-dictmap-full-20261019.json'), 'utf8'));
  const dom = JSON.parse(readFileSync(resolve(root, 'dist/site-probes/cmb-remaining-dom-ids-20261019.json'), 'utf8'));
  const hints = dom.labelHints.filter((row) => row.label === '关系类型');
  assert.deepEqual(hints.map((row) => row.inputId), [
    CMB_RELATIONSHIP_TYPE_SELECT_ID,
    CMB_RELATIONSHIP_TYPE_ROW1_SELECT_ID
  ]);
  assert.deepEqual(hints.map((row) => row.ariaControls), [
    CMB_RELATIONSHIP_TYPE_LIST_ID,
    CMB_RELATIONSHIP_TYPE_ROW1_LIST_ID
  ]);
  const kept = full.dicts.RelationshipType.filter((row) => row.name !== '请选择' && row.code !== 'RT000');
  assert.equal(kept.length, 8);
  assert.deepEqual(
    [...CMB_RELATIONSHIP_TYPE_OPTIONS],
    kept.map((row) => ({ text: row.name, code: row.code }))
  );
  assert.equal(resolveCmbCodedOption(CMB_RELATIONSHIP_TYPE_OPTIONS, '请选择'), null);
  assert.equal(resolveCmbCodedOption(CMB_RELATIONSHIP_TYPE_OPTIONS, '父'), null);
  assert.equal(resolveCmbCodedOption(CMB_RELATIONSHIP_TYPE_OPTIONS, '其他'), null);
  assert.equal(resolveCmbCodedOption(CMB_RELATIONSHIP_TYPE_OPTIONS, 'RT000'), null);
  assert.equal(resolveCmbCodedOption(CMB_RELATIONSHIP_TYPE_OPTIONS, '父亲')?.code, 'RT0002');
  assert.equal(resolveCmbCodedOption(CMB_RELATIONSHIP_TYPE_OPTIONS, 'RT0008')?.text, '其他相关人员');
  assert.equal(resolveCmbCodedOption(CMB_RELATIONSHIP_TYPE_OPTIONS, '兄弟')?.code, 'RT0006');
  assert.match(fixture, /id="resume_familyList_0_relationship"/);
  assert.match(fixture, /id="resume_familyList_1_relationship_list"/);
  assert.equal((fixture.match(/data-code="RT000/g) || []).length, 16);
  assert.doesNotMatch(fixture, /id="resume_familyList_0_relationship"[^>]*show-search/);
  assert.doesNotMatch(fixture, /id="resume_familyList_1_relationship"[^>]*show-search/);
  assert.match(source, /fillRelationshipTypeRow1/);
  assert.match(source, /invalid_relationship_type_row1/);
  assert.match(harness, /live_relationship_select_fill_unclaimed/);
  assert.equal(isCmbRelationshipLabel('关系类型'), true);
  assert.equal(isCmbRelationshipLabel('姓名'), false);
  assert.equal(isCmbRelationshipLabel('家庭关系'), false);
  const store = readFileSync(resolve(root, 'src/profile/store.js'), 'utf8');
  assert.doesNotMatch(store, /relationshipType/);
  const base = {
    fullName: '测试甲',
    phone: '13800138000',
    email: 'cmb.user@example.com',
    confirmedFields: ['fullName', 'phone', 'email', 'relationshipType', 'relationshipTypeRow1']
  };
  const row0 = planCmbBasicFromProfile({ ...base, relationshipType: ' RT0002 ' });
  assert.equal(row0.values.relationshipType, '父亲');
  assert.equal(row0.values.relationshipTypeRow1, '');
  assert.equal(row0.fields.some((row) => row.path === 'relationshipTypeRow1'), false);
  const row1 = planCmbBasicFromProfile({ ...base, relationshipTypeRow1: '母亲' });
  assert.equal(row1.values.relationshipType, '');
  assert.equal(row1.values.relationshipTypeRow1, '母亲');
  assert.equal(row1.fields.some((row) => row.path === 'relationshipType'), false);
  const both = planCmbBasicFromProfile({ ...base, relationshipType: '配偶', relationshipTypeRow1: 'RT0004' });
  assert.equal(both.values.relationshipType, '配偶');
  assert.equal(both.values.relationshipTypeRow1, '子女');
  const dropped = planCmbBasicFromProfile({ ...base, relationshipType: '父', relationshipTypeRow1: '其他' });
  assert.equal(dropped.values.relationshipType, '');
  assert.equal(dropped.values.relationshipTypeRow1, '');
  assert.equal(dropped.blockers.find((row) => row.path === 'relationshipType')?.reason, 'invalid_profile_value');
  assert.equal(dropped.blockers.find((row) => row.path === 'relationshipTypeRow1')?.reason, 'invalid_profile_value');
});

test('synthetic harness relationship select isolates row 0 from row 1 and --live refuses the click', { timeout: 120000 }, () => {
  assertGatedSelectKnife(
    '关系类型',
    'live_relationship_select_fill_unclaimed',
    'synthetic_relationship_select_pass',
    'cmb-relationship-select-latest.json',
    '配偶',
    'RT0001'
  );
  const payload = JSON.parse(readFileSync(resolve(root, 'dist/auto-runs/cmb-relationship-select-latest.json'), 'utf8'));
  assert.equal(payload.optionListHarvested, true);
  assert.equal(payload.liveSelectFillClaimed, false);
  assert.equal(payload.formFillClaimed, false);
  assert.equal(payload.neighbor?.relationshipRow1?.text, '');
  assert.equal(payload.neighbor?.relationshipRow1?.code, '');
  assert.equal(payload.neighbor?.familyName0, '');
  assert.equal(payload.neighbor?.familyPhone1, '');
  assert.equal(payload.byText?.after, '父亲');
  assert.equal(payload.byText?.afterCode, 'RT0002');
  assert.equal(payload.explicitInvalid?.reason, 'invalid_relationship_type');
  assert.equal(payload.indexIsolation?.row1Fill?.selectId, 'resume_familyList_1_relationship');
  assert.equal(payload.indexIsolation?.afterRow1?.row0?.code, 'RT0001');
  assert.equal(payload.indexIsolation?.afterRow1?.row1?.text, '母亲');
  assert.equal(payload.indexIsolation?.afterRow1?.row1?.code, 'RT0003');
  assert.equal(payload.indexIsolation?.row1Bad?.reason, 'invalid_profile_value');
  assert.equal(payload.indexIsolation?.afterRow0?.row0?.text, '父亲');
  assert.equal(payload.indexIsolation?.afterRow0?.row1?.code, 'RT0003');
  assert.equal(payload.indexIsolation?.afterRow0?.familyName0, '');
  assert.equal(payload.indexIsolation?.afterRow0?.familyPhone1, '');
  assert.equal(payload.planReady?.values?.relationshipTypeRow1, '');
});

test('AwardsLevel options use the harvested row-0 select and ignore award names', () => {
  const full = JSON.parse(readFileSync(resolve(root, 'dist/site-probes/cmb-dictmap-full-20261019.json'), 'utf8'));
  const dom = JSON.parse(readFileSync(resolve(root, 'dist/site-probes/cmb-remaining-dom-ids-20261019.json'), 'utf8'));
  const hint = dom.labelHints.find((row) => row.label === '获奖级别');
  assert.equal(hint.inputId, CMB_AWARD_LEVEL_SELECT_ID);
  assert.equal(hint.ariaControls, CMB_AWARD_LEVEL_LIST_ID);
  const kept = full.dicts.AwardsLevel.filter((row) => row.name !== '请选择' && row.code !== 'AL000' && row.code !== 'AL001');
  assert.equal(kept.length, 5);
  assert.deepEqual(
    [...CMB_AWARD_LEVEL_OPTIONS],
    kept.map((row) => ({ text: row.name, code: row.code }))
  );
  assert.equal(resolveCmbCodedOption(CMB_AWARD_LEVEL_OPTIONS, '请选择'), null);
  assert.equal(resolveCmbCodedOption(CMB_AWARD_LEVEL_OPTIONS, '国家'), null);
  assert.equal(resolveCmbCodedOption(CMB_AWARD_LEVEL_OPTIONS, '国家级奖学金'), null);
  assert.equal(resolveCmbCodedOption(CMB_AWARD_LEVEL_OPTIONS, '国际'), null);
  assert.equal(resolveCmbCodedOption(CMB_AWARD_LEVEL_OPTIONS, 'AL001'), null);
  assert.equal(resolveCmbCodedOption(CMB_AWARD_LEVEL_OPTIONS, 'AL005')?.text, '国家级');
  assert.equal(resolveCmbCodedOption(CMB_AWARD_LEVEL_OPTIONS, '省区级')?.code, 'AL004');
  assert.match(fixture, /id="resume_awardList_0_awardLevel"/);
  assert.match(fixture, /id="resume_awardList_0_awardLevel_list"/);
  assert.equal((fixture.match(/data-code="AL00/g) || []).length, 5);
  assert.doesNotMatch(fixture, /id="resume_awardList_0_awardLevel"[^>]*show-search/);
  assert.doesNotMatch(fixture, /resume_awardList_1_awardLevel/);
  assert.match(source, /fillAwardLevel/);
  assert.match(source, /invalid_award_level/);
  assert.match(harness, /live_award_level_select_fill_unclaimed/);
  assert.equal(isCmbAwardLevelLabel('获奖级别'), true);
  assert.equal(isCmbAwardLevelLabel('奖项名称'), false);
  const store = readFileSync(resolve(root, 'src/profile/store.js'), 'utf8');
  assert.doesNotMatch(store, /awardLevel/);
  const base = {
    fullName: '测试甲',
    phone: '13800138000',
    email: 'cmb.user@example.com',
    confirmedFields: ['fullName', 'phone', 'email', 'awardLevel']
  };
  const named = planCmbBasicFromProfile({ ...base, awardName: '国家级奖学金' });
  assert.equal(named.values.awardLevel, '');
  assert.equal(named.fields.some((row) => row.path === 'awardLevel'), false);
  const ready = planCmbBasicFromProfile({ ...base, awardLevel: ' AL005 ', awardName: '国家级奖学金' });
  assert.equal(ready.values.awardLevel, '国家级');
  assert.equal(ready.fields.find((row) => row.path === 'awardLevel')?.code, 'AL005');
  const dropped = planCmbBasicFromProfile({ ...base, awardLevel: '国家级奖学金' });
  assert.equal(dropped.values.awardLevel, '');
  assert.equal(dropped.blockers.find((row) => row.path === 'awardLevel')?.reason, 'invalid_profile_value');
});

test('synthetic harness award level select maps text and code and --live refuses the click', { timeout: 120000 }, () => {
  assertGatedSelectKnife(
    '获奖级别',
    'live_award_level_select_fill_unclaimed',
    'synthetic_award_select_pass',
    'cmb-award-select-latest.json',
    '国家级',
    'AL005'
  );
  const payload = JSON.parse(readFileSync(resolve(root, 'dist/auto-runs/cmb-award-select-latest.json'), 'utf8'));
  assert.equal(payload.optionListHarvested, true);
  assert.equal(payload.liveSelectFillClaimed, false);
  assert.equal(payload.formFillClaimed, false);
  assert.equal(payload.neighbor?.awardName, '');
  assert.equal(payload.neighbor?.awardDate, '');
  assert.equal(payload.byText?.after, '院校级');
  assert.equal(payload.byText?.afterCode, 'AL002');
  assert.equal(payload.explicitInvalid?.reason, 'invalid_award_level');
  assert.equal(payload.explicitInvalid?.writeAttempted, false);
});

test('birth date knife records the DatePicker hint and does not write', () => {
  const run = spawnSync(process.execPath, ['scripts/auto-cmb-basic.mjs', '--only', '出生日期'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 20000
  });
  assert.equal(run.status, 3, run.stderr || run.stdout);
  const payload = JSON.parse(run.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.reason, 'datepicker_hint_only');
  assert.equal(payload.kind, 'DatePicker');
  assert.equal(payload.selectId, 'resume_basicInfo_birthday');
  assert.equal(payload.placeholder, '请选择日期');
  assert.equal(payload.readOnly, true);
  assert.equal(payload.syntheticDom, false);
  assert.equal(payload.formFillClaimed, false);
  assert.equal(payload.writeAttempted, false);
  assert.equal(payload.liveFillClaimed, false);
  assert.equal(payload.saved, false);
  assert.match(payload.fillHint, /Never Save/);
  const latest = JSON.parse(readFileSync(resolve(root, 'dist/auto-runs/cmb-birthdate-hint-latest.json'), 'utf8'));
  assert.equal(latest.reason, 'datepicker_hint_only');
  assert.equal(latest.syntheticDom, false);
});
