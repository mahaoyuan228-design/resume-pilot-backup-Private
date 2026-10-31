import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const M = require('../src/core/matcher.js');
const profile = { education: [{ degree: 'SYNTHETIC_DEGREE' }], confirmedFields: ['education.0.degree'] };
const basicDegree = supplied => M.resolveField({ labels: ['最高学历'], section: '个人信息', profile: supplied });

test('basic highest education aliases degree and retains its confirmed education source path', () => {
  assert.equal(M.classify(['最高学历']).key, 'degree');
  for (const section of ['个人信息', '个人资料', '基本信息', '']) {
    const mapped = M.resolveField({ labels: ['最高学历（必填）'], section, profile });
    assert.equal(mapped.status, 'mapped');
    assert.equal(mapped.key, 'degree');
    assert.equal(mapped.profileKey, 'education.0.degree');
    assert.equal(mapped.reason, 'single_education_degree');
    assert.equal(M.isProfileKey(mapped.profileKey), true);
  }
  assert.equal(M.isProfileKey('degree'), false);
});

test('highest education requires one nonempty confirmed source record', () => {
  for (const [supplied, reason] of [
    [undefined, 'missing_profile_value'],
    [{ education: [] }, 'missing_profile_value'],
    [{ education: [{}], confirmedFields: ['education.0.degree'] }, 'missing_profile_value'],
    [{ ...profile, confirmedFields: [] }, 'unconfirmed_profile_value'],
    [{ ...profile, education: [...profile.education, { degree: 'SYNTHETIC_SECOND_DEGREE' }] }, 'ambiguous_profile_fact'],
    [{ ...profile, education: [...profile.education, ...profile.education] }, 'ambiguous_profile_fact'],
    [{ ...profile, education: [...profile.education, {}] }, 'ambiguous_profile_fact'],
  ]) {
    const mapped = basicDegree(supplied);
    assert.equal(mapped.status, 'manual');
    assert.equal(mapped.profileKey, null);
    assert.equal(mapped.reason, reason);
  }
});

test('basic highest education alias does not broaden academic degree or repeated questions', () => {
  for (const labels of [['学历'], ['学位'], ['最高学位'], ['最高学历', '姓名']]) {
    assert.equal(M.resolveField({ labels, section: '个人信息', profile }).status, 'manual');
  }
  assert.equal(M.resolveField({ labels: ['最高学历'], section: '工作经历', index: 0, profile }).reason, 'unknown_question');
  assert.equal(M.resolveField({ labels: ['学历'], section: '教育经历', profile }).reason, 'ambiguous_repeat_group');
  assert.equal(M.resolveField({ labels: ['最高学历'], section: '教育背景', index: 2, profile }).profileKey, 'education.2.degree');
});

const sources = await Promise.all(['src/core/matcher.js', 'src/content/engine.js'].map(file => readFile(file, 'utf8')));

function engine(t, supplied, withEducation = false) {
  const dom = new JSDOM('<!doctype html><form><fieldset><legend>个人信息</legend>'
    + '<label>最高学历<select id="highest-degree"><option value="">请选择</option><option>SYNTHETIC_DEGREE</option></select></label>'
    + '<label>学位<input id="academic-degree"></label><button type="submit">Save</button>'
    + '<button type="button">Create resume</button></fieldset>'
    + (withEducation ? '<fieldset data-repeat-kind="education"><legend>教育经历</legend>'
      + '<label>学历<select id="education-degree"><option value="">请选择</option><option>SYNTHETIC_DEGREE</option></select></label></fieldset>' : '')
    + '</form>',
  { url: 'https://fixture.example.test/resume', pretendToBeVisual: true, runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const w = dom.window, effects = [], network = [];
  w.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  let listener;
  w.fetch = async (...args) => { network.push(args); throw Error('fixture_network_forbidden'); };
  w.chrome = { storage: { local: { async get() { return {}; }, async set() { throw Error('fixture_storage_write_forbidden'); } } },
    runtime: { id: 'fixture', onMessage: { addListener(value) { listener = value; } },
      async sendMessage(message) { assert.equal(message.type, 'RESUME_PROFILE_BINDING_CHECK'); return { allowed: true }; } } };
  for (const type of ['input', 'change', 'click', 'submit']) w.document.addEventListener(type, event => effects.push({ type, target: event.target }), true);
  for (const source of sources) w.eval(source);
  return { w, effects, network, async run(type) {
    const reply = await new Promise(resolve => listener({ type, profile: structuredClone(supplied), profileBinding: {} }, { id: 'fixture' }, resolve));
    assert.equal(reply.ok, true, JSON.stringify(reply));
    return reply.data;
  } };
}

test('ordinary engine writes and reads highest education from the confirmed source without saving', async t => {
  const h = engine(t, profile);
  const inspected = await h.run('RESUME_INSPECT');
  const before = inspected.fields.find(field => field.id === 'highest-degree');
  assert.equal(before.path, 'education.0.degree');
  assert.equal(before.reason, 'ready');
  assert.deepEqual(h.effects, []);
  const filled = await h.run('RESUME_FILL');
  const after = filled.fields.find(field => field.id === 'highest-degree');
  assert.equal(after.path, 'education.0.degree');
  assert.equal(after.status, 'verified', JSON.stringify(after));
  assert.equal(h.w.document.getElementById('highest-degree').value, 'SYNTHETIC_DEGREE');
  assert.equal(h.w.document.getElementById('academic-degree').value, '');
  assert.equal(h.effects.some(event => event.type === 'click' || event.type === 'submit'), false);
  assert.deepEqual(h.network, []);
});

test('ordinary engine keeps unconfirmed and multiple highest education sources manual without events', async t => {
  for (const supplied of [{ ...profile, confirmedFields: [] }, { ...profile, education: [...profile.education, {}] }]) {
    const h = engine(t, supplied);
    const filled = await h.run('RESUME_FILL');
    const field = filled.fields.find(entry => entry.id === 'highest-degree');
    assert.equal(field.semanticStatus, 'manual');
    assert.equal(field.status, 'skipped');
    assert.equal(h.w.document.getElementById('highest-degree').value, '');
    assert.deepEqual(h.effects, []);
    assert.deepEqual(h.network, []);
  }
});

test('basic highest education and a separate education question may consume the same confirmed source', async t => {
  const h = engine(t, profile, true);
  const filled = await h.run('RESUME_FILL');
  for (const id of ['highest-degree', 'education-degree']) {
    const field = filled.fields.find(entry => entry.id === id);
    assert.equal(field.path, 'education.0.degree');
    assert.equal(field.status, 'verified', JSON.stringify(field));
    assert.equal(h.w.document.getElementById(id).value, 'SYNTHETIC_DEGREE');
  }
  assert.equal(h.effects.some(event => event.type === 'click' || event.type === 'submit'), false);
  assert.deepEqual(h.network, []);
});

test('two highest education questions in the same basic section still collide', async t => {
  const h = engine(t, profile);
  const original = h.w.document.getElementById('highest-degree');
  const duplicate = original.closest('label').cloneNode(true);
  duplicate.querySelector('select').id = 'highest-copy';
  original.closest('fieldset').append(duplicate);
  const inspected = await h.run('RESUME_INSPECT');
  const ids = ['highest-degree', 'highest-copy'];
  assert.equal(inspected.fields.filter(entry => ids.includes(entry.id) && entry.reason === 'duplicate_target').length, 2);
  const filled = await h.run('RESUME_FILL');
  const fields = filled.fields.filter(entry => ids.includes(entry.id));
  assert.ok(fields.length >= 1);
  for (const field of fields) {
    assert.equal(field.reason, 'duplicate_target');
    assert.equal(field.status, 'failed');
  }
  for (const id of ids) assert.equal(h.w.document.getElementById(id).value, '');
  assert.deepEqual(h.effects, []);
  assert.deepEqual(h.network, []);
});
