import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { appendFieldMemoryControl, confirmFieldMapping, mappingChoices } from '../src/popup/field-memory.js';

const require = createRequire(import.meta.url);
const M = require('../src/core/matcher.js');
const memory = require('../src/core/domain-memory.js');
const scripts = await Promise.all(['src/core/matcher.js', 'src/core/domain-memory.js', 'src/content/engine.js'].map(path => readFile(path, 'utf8')));
const URL = 'https://fixture.example.test/resume/edit?session=do-not-cache#secret';
const metadata = { labels: ['联络端点'], options: [], section: '基本信息', index: null, kind: 'input' };
function storageFixture() {
  const data = {}; let writes = 0;
  return { data, get writes() { return writes; },
    async get(key) { return { [key]: structuredClone(data[key]) }; },
    async set(record) { writes++; Object.assign(data, structuredClone(record)); } };
}

test('section synonyms bind only existing schema fields with an explicit repeated index', () => {
  assert.equal(M.classify(['真实姓名']).key, 'fullName');
  assert.equal(M.classify(['姓名', '邮箱']).reason, 'ambiguous_label');
  assert.equal(M.resolveField({ labels: ['ＧＰＡ'], section: '教育背景', index: 1 }).profileKey, 'education.1.gpa');
  for (const [section, label, index, path] of [
    ['教育背景', '入学日期', 1, 'education.1.startDate'],
    ['工作经历', '开始时间', 2, 'experience.2.startDate'],
    ['实习经历', '开始时间', 0, 'experience.0.startDate'],
    ['项目经验', '担任角色', 0, 'projects.0.role'],
    ['求职意向', '意向岗位', null, 'desiredRoles'],
    ['个人资料', '现居城市', null, 'currentCity']
  ]) assert.equal(M.resolveField({ labels: [label], section, index }).profileKey, path);
  for (const request of [
    { labels: ['开始时间'], section: '教育经历' },
    { labels: ['姓名'], section: '工作经历', index: 0 },
    { labels: ['学位'], section: '教育经历', index: 0 },
    { labels: ['证书名称'], section: '证书信息', index: 0 },
    { labels: ['开始时间'] },
    { labels: ['开始时间'], section: '教育经历', index: -1 },
    { labels: ['开始时间'], section: '教育经历', index: 30 },
    { labels: ['学校', '专业'], section: '教育经历', index: 0 }
  ]) assert.equal(M.resolveField(request).status, 'manual');
  assert.equal(M.isProfileKey('__proto__.polluted'), false);
  assert.equal(M.isProfileKey('certificates.0.name'), false);
  assert.equal(M.isProfileKey('education.01.school'), false);
});

test('only explicit user confirmation persists projected metadata; no facts or URL tokens are cached', async () => {
  const storage = storageFixture();
  await assert.rejects(memory.confirm(storage, URL, metadata, 'email'), /confirmation_required/u);
  assert.equal(storage.writes, 0);
  await assert.rejects(memory.confirm(storage, URL, metadata, 'education.0.school', { confirmed: true, source: 'user' }), /profile_key_invalid/u);
  await memory.confirm(storage, URL, { ...metadata, value: 'PRIVATE-RESUME-VALUE', answer: 'PRIVATE-ANSWER' }, 'email', { confirmed: true, source: 'user' });
  const serialized = JSON.stringify(storage.data);
  assert.doesNotMatch(serialized, /PRIVATE|session|secret|resume\/edit/u);
  assert.equal(memory.lookup(await memory.load(storage, URL), metadata).profileKey, 'email');
  assert.equal(memory.lookup(await memory.load(storage, 'https://neighbor.example.test/resume/edit'), metadata), null);
  assert.equal(memory.lookup(await memory.load(storage, 'https://fixture.example.test/resume/other'), metadata), null);
  assert.equal(memory.lookup(await memory.load(storage, URL), { ...metadata, labels: ['另一个题目'] }), null);
  assert.equal(memory.lookup(await memory.load(storage, URL), { ...metadata, options: ['新选项'] }), null);
  assert.equal(memory.lookup(await memory.load(storage, URL), { ...metadata, index: 0 }), null);
  assert.equal(memory.lookup(await memory.load(storage, 'https://fixture.example.test/resume/edit?new=token'), metadata).profileKey, 'email');
});

test('memory rejects forged confirmation, ambiguous entries, unknown paths and cross-record mapping', async () => {
  const storage = storageFixture();
  await memory.confirm(storage, URL, metadata, 'phone', { confirmed: true, source: 'user' });
  const record = storage.data[memory.STORAGE_KEY];
  record.entries.push({ ...record.entries[0], profileKey: 'email' });
  assert.equal(memory.lookup(await memory.load(storage, URL), metadata), null);
  record.entries = [{ ...record.entries[0], confirmedBy: 'automatic' }];
  assert.equal(memory.lookup(await memory.load(storage, URL), metadata), null);
  const repeated = { ...metadata, section: '工作经历', index: 1 };
  await assert.rejects(memory.confirm(storage, URL, repeated, 'experience.0.position', { confirmed: true, source: 'user' }), /profile_key_invalid/u);
  await assert.rejects(memory.confirm(storage, URL, repeated, 'education.1.major', { confirmed: true, source: 'user' }), /profile_key_invalid/u);
  await assert.rejects(memory.confirm(storage, URL, metadata, 'expectedSalary', { confirmed: true, source: 'user' }), /profile_key_invalid/u);
  await assert.rejects(memory.confirm(storage, URL, metadata, 'customAnswers.PRIVATE-ANSWER', { confirmed: true, source: 'user' }), /profile_key_invalid/u);
});

test('concurrent manual confirmations preserve both mappings without auto-learning', async () => {
  const storage = storageFixture();
  await Promise.all([
    memory.confirm(storage, URL, metadata, 'email', { confirmed: true, source: 'user' }),
    memory.confirm(storage, URL, { ...metadata, labels: ['联络电话端点'] }, 'phone', { confirmed: true, source: 'user' })
  ]);
  const snapshot = await memory.load(storage, URL);
  assert.equal(snapshot.entries.length, 2); assert.equal(storage.writes, 2);
  assert.equal(memory.lookup(snapshot, metadata).profileKey, 'email');
  assert.equal(memory.lookup(snapshot, { ...metadata, labels: ['联络电话端点'] }).profileKey, 'phone');
});

async function engine(html, storage = storageFixture()) {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, { url: URL, pretendToBeVisual: true, runScripts: 'dangerously' });
  const { window } = dom;
  window.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  Object.defineProperty(window.document, 'visibilityState', { value: 'visible' });
  Object.defineProperty(window, 'crypto', { value: webcrypto });
  window.TextEncoder = TextEncoder;
  const effects = { input: 0, change: 0, click: 0, submit: 0 };
  for (const type of Object.keys(effects)) window.document.addEventListener(type, () => { effects[type]++; }, true);
  let listener;
  window.chrome = { storage: { local: storage }, runtime: { id: 'fixture', sendMessage: async () => ({ allowed: true }), onMessage: { addListener(value) { listener = value; } } } };
  for (const source of scripts) window.eval(source);
  return { dom, storage, effects, async fill(profile) {
    return new Promise(resolve => listener({ type: 'RESUME_FILL', profile, profileBinding: {} }, { id: 'fixture' }, resolve));
  }, async inspect(profile) {
    const reply = await new Promise(resolve => listener({ type: 'RESUME_INSPECT', profile }, { id: 'fixture' }, resolve));
    assert.equal(reply.ok, true, reply.error);
    return reply.data;
  } };
}

test('recognized L2 synonyms remain manual until the profile fact is confirmed', async t => {
  const h = await engine('<form><fieldset><legend>个人资料</legend><label>现居城市<input id="city"></label></fieldset><input id="unlabelled"></form>');
  t.after(() => h.dom.window.close());
  const profile = { currentCity: '离线城市', confirmedFields: [] };
  assert.equal(M.resolveField({ labels: ['现居城市'], section: '个人资料' }).profileKey, 'currentCity');
  const inspected = await h.inspect(profile), filled = await h.fill(profile);
  assert.equal(filled.ok, true, filled.error);
  for (const data of [inspected, filled.data]) {
    assert.equal(data.fields.length, 2);
    assert.equal(data.fields.find(field => field.id === 'city').reason, 'unconfirmed_profile_value');
    assert.equal(data.fields.find(field => field.id === 'unlabelled').reason, 'unlabelled_field');
    for (const field of data.fields) assert.equal(field.semanticStatus, 'manual');
  }
  for (const field of filled.data.fields) assert.equal(field.status, 'skipped');
  assert.ok([...h.dom.window.document.querySelectorAll('input')].every(input => input.value === ''));
  assert.equal(h.storage.writes, 0);
  assert.deepEqual(h.effects, { input: 0, change: 0, click: 0, submit: 0 });
});

test('withdrawing profile confirmation makes an explicitly cached mapping manual again', async t => {
  const h = await engine('<form><fieldset><legend>基本信息</legend><label>联络端点<input id="endpoint"></label></fieldset></form>');
  t.after(() => h.dom.window.close());
  const profile = { email: 'offline@example.test', confirmedFields: ['email'] };
  const field = (await h.inspect(profile)).fields[0];
  await memory.confirm(h.storage, URL, field.mappingContext, 'email', { confirmed: true, source: 'user' });
  assert.equal((await h.inspect(profile)).fields[0].reason, 'ready');
  profile.confirmedFields = [];
  const inspected = await h.inspect(profile), filled = await h.fill(profile);
  assert.equal(filled.ok, true, filled.error);
  for (const entry of [inspected.fields[0], filled.data.fields[0]]) {
    assert.equal(entry.reason, 'unconfirmed_profile_value'); assert.equal(entry.semanticStatus, 'manual');
    assert.equal(entry.semanticSource, 'confirmed_domain_mapping');
  }
  assert.equal(filled.data.fields[0].status, 'skipped');
  assert.equal(h.dom.window.document.querySelector('input').value, '');
  assert.equal(h.storage.writes, 1);
  assert.deepEqual(h.effects, { input: 0, change: 0, click: 0, submit: 0 });
});

test('explicit repeat metadata scopes manual choices and confirmation without a section legend', async t => {
  const h = await engine('<form><div data-repeat-kind="work"><label>履历端点<input id="endpoint"></label><label>姓名<input id="wrong-scope"></label></div></form>');
  t.after(() => h.dom.window.close());
  const profile = { email: 'offline@example.test', experience: [{ type: 'work', position: '离线职位' }],
    confirmedFields: ['email', 'experience.0.position', 'experience.1.position', 'education.0.school'] };
  const inspected = await h.inspect(profile), field = inspected.fields[0];
  const wrongScope = inspected.fields.find(entry => entry.id === 'wrong-scope');
  assert.equal(wrongScope.semanticStatus, 'manual'); assert.equal(wrongScope.reason, 'unknown_question');
  assert.equal(wrongScope.path, undefined);
  assert.equal(field.semanticStatus, 'manual'); assert.equal(field.mappingContext.section, 'work');
  assert.equal(field.mappingContext.index, 0);
  assert.deepEqual(mappingChoices(profile, field.mappingContext), ['experience.0.position']);
  await assert.rejects(memory.confirm(h.storage, URL, field.mappingContext, 'experience.0.position'), /confirmation_required/u);
  for (const path of ['email', 'experience.1.position']) {
    await assert.rejects(memory.confirm(h.storage, URL, field.mappingContext, path, { confirmed: true, source: 'user' }), /profile_key_invalid/u);
  }
  assert.equal(h.storage.writes, 0);
  h.storage.data.resumeProfile = profile;
  const api = { storage: { local: h.storage }, tabs: { async query() { return [{ id: 1, url: URL }]; },
    async sendMessage() { return { ok: true, data: await h.inspect(profile) }; } } };
  await confirmFieldMapping(api, { tabId: 1, url: URL, field, profileKey: 'experience.0.position' });
  const remembered = (await h.inspect(profile)).fields[0];
  assert.equal(remembered.path, 'experience.0.position'); assert.equal(remembered.reason, 'ready');
  assert.equal(remembered.semanticSource, 'confirmed_domain_mapping');
  assert.equal(h.storage.writes, 1);
  assert.equal(h.dom.window.document.querySelector('input').value, '');
  assert.deepEqual(h.effects, { input: 0, change: 0, click: 0, submit: 0 });
});

test('real engine honors section manual outcomes and confirmed repeated source types', async () => {
  const h = await engine('<form><fieldset><legend>教育经历</legend><label>姓名<input id="wrong-name"></label><label>开始时间<input id="missing-index"></label></fieldset><fieldset data-repeat-kind="work"><legend>工作经历</legend><label>入职日期<input id="work-start"></label></fieldset><fieldset data-repeat-kind="internship"><legend>实习经历</legend><label>实习公司<input id="wrong-type"></label></fieldset><fieldset><legend>证书信息</legend><label>邮箱<input id="certificate-email"></label></fieldset></form>');
  const profile = { fullName: '离线姓名', email: 'offline@example.test', startDate: '2000-01',
    experience: [{ type: 'work', startDate: '2023-01', organization: '离线公司' }],
    confirmedFields: ['fullName', 'email', 'startDate', 'experience.0.startDate', 'experience.0.organization'] };
  const fields = (await h.inspect(profile)).fields;
  assert.equal(fields.find(field => field.id === 'wrong-name').semanticStatus, 'manual');
  assert.equal(fields.find(field => field.id === 'missing-index').reason, 'ambiguous_repeat_group');
  assert.equal(fields.find(field => field.id === 'work-start').path, 'experience.0.startDate');
  assert.equal(fields.find(field => field.id === 'work-start').reason, 'ready');
  assert.equal(fields.find(field => field.id === 'wrong-type').reason, 'section_requires_mapping');
  assert.equal(fields.find(field => field.id === 'certificate-email').reason, 'profile_field_unavailable');
  assert.ok([...h.dom.window.document.querySelectorAll('input')].every(input => input.value === ''));
  h.dom.window.close();
});

test('real engine applies only confirmed same-page metadata memory and preserves ambiguous labels', async () => {
  const h = await engine('<form><fieldset><legend>基本信息</legend><label>联络端点<input id="endpoint"></label></fieldset></form>');
  const profile = { email: 'offline@example.test', confirmedFields: ['email'] };
  let field = (await h.inspect(profile)).fields[0];
  assert.equal(field.semanticStatus, 'manual'); assert.equal(h.storage.writes, 0);
  await memory.confirm(h.storage, URL, field.mappingContext, 'email', { confirmed: true, source: 'user' });
  field = (await h.inspect(profile)).fields[0];
  assert.equal(field.path, 'email'); assert.equal(field.reason, 'ready');
  assert.equal(field.semanticSource, 'confirmed_domain_mapping');
  assert.equal(h.storage.writes, 1);
  h.dom.window.document.querySelector('label').firstChild.textContent = '联络端点变了';
  assert.equal((await h.inspect(profile)).fields[0].semanticStatus, 'manual');
  h.dom.window.close();
});

test('public inspect and ordinary fill retain explicit manual semantics for unknown and ambiguous labels', async () => {
  const h = await engine('<form><fieldset><legend>基本信息</legend><label>联络端点<input id="unknown"></label><label for="ambiguous">姓名</label><label for="ambiguous">邮箱</label><input id="ambiguous"></fieldset><label>未识别题目<input id="unscoped"></label></form>');
  const profile = { fullName: '离线姓名', email: 'offline@example.test', confirmedFields: ['fullName', 'email'] };
  const inspected = await h.inspect(profile);
  assert.equal(inspected.fields.length, 3);
  for (const field of inspected.fields) assert.equal(field.semanticStatus, 'manual');
  assert.equal(inspected.fields.find(field => field.id === 'ambiguous').reason, 'ambiguous_label');
  const filled = await h.fill(profile);
  assert.equal(filled.ok, true, filled.error);
  for (const field of filled.data.fields) { assert.equal(field.semanticStatus, 'manual'); assert.equal(field.status, 'skipped'); }
  assert.equal(h.storage.writes, 0);
  assert.ok([...h.dom.window.document.querySelectorAll('input')].every(input => input.value === ''));
  h.dom.window.close();
});

test('popup keeps memory opt-in and checks fresh page metadata before confirmation', async () => {
  const dom = new JSDOM('<main></main>');
  const profile = { confirmedFields: ['email', 'fullName'] };
  const field = { id: 'endpoint', labels: metadata.labels, kind: 'input', reason: 'unknown_question', mappingContext: metadata };
  let confirmations = 0;
  const ui = appendFieldMemoryControl(dom.window.document.querySelector('main'), { field, profile, document: dom.window.document, confirm: async key => { assert.equal(key, 'email'); confirmations++; } });
  assert.equal(ui.select.value, ''); assert.equal(ui.button.disabled, true); assert.equal(confirmations, 0);
  assert.match(ui.select.textContent, /邮箱/u); assert.doesNotMatch(ui.select.textContent, /fullName|email/u);
  ui.select.value = 'email'; ui.select.dispatchEvent(new dom.window.Event('change'));
  assert.equal(confirmations, 0); ui.button.click(); await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(confirmations, 1); assert.match(ui.note.textContent, /已确认/u);
  assert.deepEqual(mappingChoices({ confirmedFields: ['experience.0.position', 'experience.1.position'] }, { ...metadata, section: '实习经历', index: 1 }), ['experience.1.position']);
  const storage = storageFixture(); storage.data.resumeProfile = profile;
  const api = { storage: { local: storage }, tabs: { async query() { return [{ id: 1, url: URL }]; }, async sendMessage() { return { ok: true, data: { url: URL, fields: [field] } }; } } };
  await confirmFieldMapping(api, { tabId: 1, url: URL, field, profileKey: 'email' });
  assert.equal(memory.lookup(await memory.load(storage, URL), metadata).profileKey, 'email');
  api.tabs.sendMessage = async () => ({ ok: true, data: { url: URL, fields: [{ ...field, mappingContext: { ...metadata, options: ['changed'] } }] } });
  await assert.rejects(confirmFieldMapping(api, { tabId: 1, url: URL, field, profileKey: 'email' }), /选项已变化/u);
  dom.window.close();
});
