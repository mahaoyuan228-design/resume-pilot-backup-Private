import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { MAX_FILE_BYTES, parseResumeProfile } from '../../src/import/parser.mjs';
import { detectResumeCandidates, mergeResumeCandidates } from '../../src/import/candidates.mjs';
import { listFilledPaths } from '../../src/profile/store.js';

const require = createRequire(import.meta.url);
const matcher = require('../../src/core/matcher.js');
const txt = text => new File([text], 'synthetic-resume.txt', { type: 'text/plain' });

// Restore every descriptor after the test; these spies never reach a service or
// an existing profile store, even when a failure path unexpectedly tries to.
function forbidExternalEffects(t) {
  for (const key of ['fetch', 'chrome', 'localStorage']) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, {
      configurable: true,
      get() { assert.fail(`local parsing must not access ${key}`); }
    });
    t.after(() => {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    });
  }
}

test('a local TXT file becomes an unconfirmed structured profile without external effects', async t => {
  forbidExternalEffects(t);
  const input = [
    '姓名：虚构用户', '期望岗位：分析师', '期望城市：上海',
    '邮箱：applicant@example.test', '手机：13800000000',
    '教育经历', '学校：示例大学', '学历：本科', '专业：金融学',
    '在校时间：2020-09至2024-06',
    '实习经历', '公司：示例证券', '岗位：研究实习生',
    '实习时间：2024-07至2024-08', '职责：整理虚构样本'
  ].join('\r\n');
  const result = await parseResumeProfile(txt(input));
  assert.equal(result.format, 'TXT');
  assert.equal(result.text, input.replace(/\r\n/g, '\n'));
  assert.equal(result.neverSave, true);
  assert.equal(result.liveSupportClaimed, false);
  assert.ok(Array.isArray(result.warnings));
  assert.equal(result.profile.fullName, '虚构用户');
  assert.equal(result.profile.email, 'applicant@example.test');
  assert.equal(result.profile.phone, '13800000000');
  assert.deepEqual(result.profile.desiredRoles, ['分析师']);
  assert.deepEqual(result.profile.desiredCities, ['上海']);
  assert.equal(result.profile.education.length, 1);
  assert.equal(result.profile.education[0].school, '示例大学');
  assert.equal(result.profile.education[0].startDate, '2020-09');
  assert.equal(result.profile.experience.length, 1);
  assert.equal(result.profile.experience[0].organization, '示例证券');
  assert.equal(result.profile.experience[0].position, '研究实习生');
  const paths = listFilledPaths(result.profile);
  assert.ok(paths.length > 10);
  assert.deepEqual(result.profile.confirmedFields, []);
  assert.deepEqual(Object.keys(result.profile.sources).sort(), paths.sort());
  assert.ok(Object.values(result.profile.sources).every(source => source === 'resume'));
  assert.equal(result.profile.resumeAttachment, null);
  assert.equal(result.profile.updatedAt, '');
  assert.deepEqual(result.conflicts, []);
  assert.equal(result.candidates.filter(candidate => candidate.path === 'educationRecord').length, 1);
  assert.equal(result.candidates.filter(candidate => candidate.path === 'experienceRecord').length, 1);
});

test('import aliases resolve to the same profile paths as the shared engine matcher', async t => {
  forbidExternalEffects(t);
  for (const [label, value, path] of [
    ['真实姓名', '虚构用户', 'fullName'],
    ['应聘者姓名', '示例人员', 'fullName'],
    ['意向岗位', '分析师', 'desiredRoles.0'],
    ['应聘岗位', '研究员', 'desiredRoles.0'],
    ['意向工作地点', '上海', 'desiredCities.0'],
    ['期望工作城市', '北京', 'desiredCities.0']
  ]) {
    const mapped = matcher.resolveField({ labels: [label] });
    assert.equal(mapped.status, 'mapped');
    const enginePath = ['desiredRoles', 'desiredCities'].includes(mapped.profileKey)
      ? `${mapped.profileKey}.0` : mapped.profileKey;
    assert.equal(enginePath, path);
    const result = await parseResumeProfile(txt(`${label}：${value}`));
    assert.equal(result.candidates.length, 1, label);
    assert.equal(result.candidates[0].path, enginePath, label);
    assert.equal(result.candidates[0].value, value, label);
    assert.equal(result.profile.sources[path], 'resume');
    assert.deepEqual(result.profile.confirmedFields, []);
  }
});

test('legacy Name and job-preference labels remain available', async t => {
  forbidExternalEffects(t);
  const result = await parseResumeProfile(txt('Name: Example Person\n求职意向：分析师'));
  assert.equal(result.profile.fullName, 'Example Person');
  assert.deepEqual(result.profile.desiredRoles, ['分析师']);
});

test('unknown labels and other matcher fields do not expand the import allowlist', async t => {
  forbidExternalEffects(t);
  const result = await parseResumeProfile(txt([
    '神秘字段：未经定义的资料', '证件号：EXAMPLE-ID-0000', '学位：学士',
    '现居城市：上海', '性别：女', '出生日期：2000-01-01', '期望薪资：10000'
  ].join('\n')));
  assert.deepEqual(result.candidates, []);
  assert.deepEqual(listFilledPaths(result.profile), []);
  assert.deepEqual(result.profile.confirmedFields, []);
  assert.deepEqual(result.profile.sources, {});
});

test('different values under aliases stay unresolved instead of being combined', async t => {
  forbidExternalEffects(t);
  const result = await parseResumeProfile(txt([
    '姓名：虚构用户', '真实姓名：示例人员',
    '期望岗位：分析师', '意向岗位：研究员',
    '期望城市：上海', '意向工作地点：北京'
  ].join('\n')));
  assert.deepEqual(result.candidates, []);
  assert.equal(result.profile.fullName, '');
  assert.deepEqual(result.profile.desiredRoles, []);
  assert.deepEqual(result.profile.desiredCities, []);
  assert.equal(result.warnings.filter(warning => /多个不同值/u.test(warning)).length, 3);
});

test('conflicting name aliases on one line remain unresolved with a warning', async t => {
  forbidExternalEffects(t);
  const result = await parseResumeProfile(txt('姓名：虚构用户 真实姓名：示例人员'));
  assert.deepEqual(result.candidates, []);
  assert.equal(result.profile.fullName, '');
  assert.equal(result.warnings.filter(warning => /姓名.*多个不同值/u.test(warning)).length, 1);
});

test('inline name, contact and preference labels keep independent values', async t => {
  forbidExternalEffects(t);
  const result = await parseResumeProfile(txt(
    '真实姓名：虚构用户 联系电话：13800000000 电子邮箱：applicant@example.test 意向岗位：分析师 意向工作地点：上海'
  ));
  assert.equal(result.profile.fullName, '虚构用户');
  assert.equal(result.profile.phone, '13800000000');
  assert.equal(result.profile.email, 'applicant@example.test');
  assert.deepEqual(result.profile.desiredRoles, ['分析师']);
  assert.deepEqual(result.profile.desiredCities, ['上海']);
  assert.equal(result.candidates.length, 5);
  assert.deepEqual(result.warnings, []);
});

test('record-section locations never become desired cities', async t => {
  forbidExternalEffects(t);
  for (const heading of ['工作经历', '实习经历', '教育经历', '工作与实习', 'Education', 'Experience']) {
    // Test each label separately so conflicting values cannot mask an incorrect
    // global mapping by causing the detector to discard both candidates.
    for (const label of ['工作地点', '工作城市']) {
      const result = await parseResumeProfile(txt(`${heading}\n${label}：上海`));
      assert.deepEqual(result.profile.desiredCities, [], `${heading}: ${label}`);
      assert.equal(result.candidates.some(candidate => candidate.path === 'desiredCities.0'), false,
        `${heading}: ${label}`);
    }
  }
});

test('explicit basic and intent sections retain their own admitted fields', async t => {
  forbidExternalEffects(t);
  const result = await parseResumeProfile(txt('基本信息\n真实姓名：虚构用户\n求职意向\n意向工作地点：上海'));
  assert.equal(result.profile.fullName, '虚构用户');
  assert.deepEqual(result.profile.desiredCities, ['上海']);
  assert.equal(result.candidates.length, 2);
});

test('the legacy job-preference label also separates inline fields', async t => {
  forbidExternalEffects(t);
  const result = await parseResumeProfile(txt('真实姓名：虚构用户 求职意向：分析师 意向工作地点：上海'));
  assert.equal(result.profile.fullName, '虚构用户');
  assert.deepEqual(result.profile.desiredRoles, ['分析师']);
  assert.deepEqual(result.profile.desiredCities, ['上海']);
  assert.equal(result.candidates.length, 3);
  assert.deepEqual(result.warnings, []);
});

test('the returned draft reports ambiguous same-school education merge conflicts', async t => {
  forbidExternalEffects(t);
  const result = await parseResumeProfile(txt([
    '教育经历',
    '学校：示例大学', '学历：本科', '专业：金融学', '在校时间：2020-09至2024-06',
    '学校：示例大学', '学历：本科', '专业：经济学', '在校时间：2020-09至2024-06'
  ].join('\n')));
  assert.equal(result.candidates.filter(candidate => candidate.path === 'educationRecord').length, 2);
  assert.equal(result.profile.education.length, 1);
  assert.equal(result.profile.education[0].major, '金融学');
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].path, 'educationRecord');
  assert.equal(result.conflicts[0].reason, 'education_existing_record_ambiguous');
  assert.match(result.conflicts[0].incoming, /经济学/u);
  assert.deepEqual(result.profile.confirmedFields, []);
});

test('alias candidates preserve existing profile facts and confirmations on conflict', () => {
  const profile = {
    fullName: '已有用户', desiredRoles: ['已有岗位'], desiredCities: ['杭州'],
    confirmedFields: ['fullName', 'desiredRoles.0', 'desiredCities.0'],
    sources: { fullName: 'manual', 'desiredRoles.0': 'manual', 'desiredCities.0': 'manual' }
  };
  const original = structuredClone(profile);
  const { candidates } = detectResumeCandidates('真实姓名：虚构用户\n意向岗位：分析师\n意向工作地点：上海');
  const merged = mergeResumeCandidates(profile, candidates);
  assert.deepEqual(profile, original);
  assert.equal(merged.profile.fullName, profile.fullName);
  assert.deepEqual(merged.profile.desiredRoles, profile.desiredRoles);
  assert.deepEqual(merged.profile.desiredCities, profile.desiredCities);
  assert.deepEqual(merged.profile.confirmedFields, profile.confirmedFields);
  assert.deepEqual(merged.profile.sources, profile.sources);
  assert.deepEqual(merged.added, []);
  assert.deepEqual(merged.conflicts.map(conflict => conflict.path).sort(), profile.confirmedFields.slice().sort());
});

test('UTF-8 and UTF-16 BOM text decode before deterministic field mapping', async t => {
  forbidExternalEffects(t);
  const input = '真实姓名：虚构用户\n意向岗位：分析师';
  const utf8 = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(input, 'utf8')]);
  const utf16le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(input, 'utf16le')]);
  const utf16be = Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(input, 'utf16le').swap16()]);
  for (const bytes of [utf8, utf16le, utf16be]) {
    const result = await parseResumeProfile(new File([bytes], 'synthetic-resume.TXT'));
    assert.equal(result.text, input);
    assert.equal(result.profile.fullName, '虚构用户');
    assert.deepEqual(result.profile.desiredRoles, ['分析师']);
  }
});

test('missing, unsupported and oversized files fail locally before reading bytes', async t => {
  forbidExternalEffects(t);
  await assert.rejects(parseResumeProfile(null), /选择本机简历文件/u);
  for (const [name, message] of [['resume.doc', /旧版 \.doc/u], ['resume.html', /仅支持/u]]) {
    const file = new File(['synthetic'], name);
    t.mock.method(file, 'arrayBuffer', () => assert.fail('unsupported bytes must not be read'));
    await assert.rejects(parseResumeProfile(file), message);
  }
  const oversized = new File([new Uint8Array(MAX_FILE_BYTES + 1)], 'oversized.txt');
  t.mock.method(oversized, 'arrayBuffer', () => assert.fail('oversized bytes must not be read'));
  await assert.rejects(parseResumeProfile(oversized), /超过 10 MB/u);
});
