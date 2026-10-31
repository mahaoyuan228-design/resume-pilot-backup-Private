import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const M = require('../src/core/matcher.js');
const sources = ['src/core/matcher.js', 'src/content/engine.js'].map(file =>
  readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
const systems = [
  ['beisen', 'zhiye.com'], ['moka', 'mokahr.com'], ['hotjob', 'hotjob.cn'],
  ['feishu', 'jobs.feishu.cn'], ['feishu', 'jobs.bytedance.com'], ['feishu', 'jobs.f.mioffice.cn'],
];

test('four thin ATS profiles expose one shared section mapping and an explicit manual boundary', () => {
  assert.equal(Object.isFrozen(M.atsProfiles), true);
  assert.deepEqual(M.atsProfiles.map(profile => profile.id), ['beisen', 'moka', 'hotjob', 'feishu']);
  for (const profile of M.atsProfiles) {
    assert.equal(Object.isFrozen(profile), true);
    assert.equal(Object.isFrozen(profile.domains), true);
    assert.equal(Object.isFrozen(profile.sectionAliases), true);
    for (const aliases of Object.values(profile.sectionAliases)) assert.equal(Object.isFrozen(aliases), true);
    assert.equal(profile.unknownFieldStatus, 'manual');
    assert.equal(profile.liveSupportClaimed, false);
    assert.equal(profile.sectionAliases, M.atsProfiles[0].sectionAliases);
    assert.ok(profile.domains.length > 0);
  }
});

test('ATS identity requires an exact configured domain or a domain-boundary subdomain', () => {
  for (const [id, domain] of systems) {
    assert.equal(M.resolveAtsProfile(domain)?.id, id, domain);
    assert.equal(M.resolveAtsProfile(`offline.${domain}`)?.id, id);
    for (const hostname of [`evil${domain}`, `${domain}.evil.test`, `https://${domain}/resume`, `${domain}:443`])
      assert.equal(M.resolveAtsProfile(hostname), null, hostname);
  }
  for (const hostname of ['', null, 'fixture.example.test', 'feishu.cn', 'bytedance.com', 'mioffice.cn'])
    assert.equal(M.resolveAtsProfile(hostname), null);
});

test('every ATS profile delegates common fields and manual outcomes to the same L2 resolver', () => {
  const requests = [
    { labels: ['姓名'], section: '基本信息' },
    { labels: ['ＧＰＡ'], section: '教育背景', index: 1 },
    { labels: ['入职日期'], section: '工作经历', index: 2 },
    { labels: ['担任角色'], section: '项目经验', index: 0 },
    { labels: ['未识别题目'], section: '基本信息' },
    { labels: ['姓名', '邮箱'], section: '基本信息' },
    { labels: ['开始时间'], section: '教育经历' },
    { labels: ['证书名称'], section: '证书信息', index: 0 },
    { labels: ['姓名'], section: '未识别分组' },
  ];
  for (const [id, hostname] of [...systems, [null, 'fixture.example.test']]) for (const request of requests) {
    const { atsProfile, liveSupportClaimed, ...resolved } = M.resolveAtsField({ hostname, ...request });
    assert.equal(atsProfile, id);
    assert.equal(liveSupportClaimed, false);
    assert.deepEqual(resolved, M.resolveField(request), `${hostname}: ${request.labels}`);
  }
  for (const request of requests.slice(4))
    assert.equal(M.resolveAtsField({ hostname: 'offline.mokahr.com', ...request }).status, 'manual');
});

function engine(t, hostname, enabled, { previousRevision = null } = {}) {
  const dom = new JSDOM(`<!doctype html><body><form><fieldset><legend>基本信息</legend>
    <label>未识别题目<input id="unknown"></label>
    <label for="ambiguous">姓名</label><label for="ambiguous">邮箱</label><input id="ambiguous">
    <label>邮箱<input id="neighbor" value="KEEP_NEIGHBOR"></label>
    </fieldset></form></body>`, {
    url: `https://${hostname}/resume`, pretendToBeVisual: true, runScripts: 'outside-only',
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  window.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  let effects = 0, storageWrites = 0;
  const listeners = new Set();
  const oldListener = previousRevision === null ? null : () => assert.fail('stale engine listener was retained');
  if (oldListener) {
    listeners.add(oldListener);
    Object.assign(window, { __resumeQuickFillInstalled: true, __resumeQuickFillEngineRevision: previousRevision,
      __resumeQuickFillEngineListener: oldListener, ResumeQuickFillGthInspect() {}, ResumeQuickFillFillCurrentPage() {} });
  }
  for (const event of ['click', 'input', 'change', 'blur', 'pointerdown', 'mousedown', 'submit'])
    window.document.addEventListener(event, () => { effects++; }, true);
  window.chrome = { storage: { local: {
    async get() { return enabled ? { resumeAtsEngineWriteEnabled: true } : {}; },
    async set() { storageWrites++; },
  } }, runtime: { id: 'fixture', onMessage: {
    addListener(value) { listeners.add(value); }, removeListener(value) { listeners.delete(value); },
    hasListener(value) { return listeners.has(value); }, hasListeners() { return listeners.size > 0; },
  },
    async sendMessage(message) {
      if (message.type === 'RESUME_ATS_CONTROL_CANDIDATES')
        return { ok: true, mode: 'candidates', candidates: [], writeStarted: false, liveSupportClaimed: false };
      assert.equal(message.type, 'RESUME_PROFILE_BINDING_CHECK');
      return { allowed: true };
    } } };
  for (const source of sources) window.eval(source);
  return {
    window, listeners, oldListener,
    async request(type) {
      const profile = { fullName: '离线姓名', email: 'offline@example.test', confirmedFields: ['fullName', 'email'] };
      assert.equal(listeners.size, 1);
      const result = await new Promise(resolve => [...listeners][0]({ type, profile, profileBinding: {} }, { id: 'fixture' }, resolve));
      assert.equal(result.ok, true, result.error);
      return result.data;
    },
    assertInert() {
      assert.equal(effects, 0);
      assert.equal(storageWrites, 0);
      assert.deepEqual([...window.document.querySelectorAll('input')].map(input => input.value), ['', '', 'KEEP_NEIGHBOR']);
    },
  };
}

for (const previousRevision of [11, 25]) test(`reinjection replaces a revision ${previousRevision} listener once and retains the current ATS-aware listener`, async t => {
  const fixture = engine(t, 'offline.mokahr.com', false, { previousRevision });
  assert.equal(fixture.listeners.has(fixture.oldListener), false);
  assert.equal(fixture.listeners.size, 1);
  const listener = [...fixture.listeners][0];
  assert.equal(fixture.window.__resumeQuickFillEngineListener, listener);
  assert.ok(fixture.window.__resumeQuickFillEngineRevision > previousRevision);
  const { fields } = await fixture.request('RESUME_INSPECT');
  assert.equal(fields.length, 3);
  assert.ok(fields.every(field => field.atsProfile === 'moka'));
  fixture.window.eval(sources[1]);
  assert.equal(fixture.listeners.size, 1);
  assert.equal([...fixture.listeners][0], listener);
  assert.equal(fixture.window.__resumeQuickFillEngineListener, listener);
  fixture.assertInert();
});

for (const [id, domain] of systems.filter(([, domain]) => !['jobs.bytedance.com', 'jobs.f.mioffice.cn'].includes(domain)))
  for (const enabled of [false, true]) test(`${id} ordinary inspect/fill keeps unknown fields manual (opt-in ${enabled})`, async t => {
    const fixture = engine(t, `offline.${domain}`, enabled);
    for (const type of ['RESUME_INSPECT', 'RESUME_FILL']) {
      const { fields } = await fixture.request(type);
      assert.equal(fields.length, 3);
      for (const field of fields) assert.equal(field.atsProfile, id);
      for (const name of ['unknown', 'ambiguous']) {
        const field = fields.find(row => row.id === name);
        assert.equal(field.semanticStatus, 'manual');
        assert.equal(field.path, undefined);
        assert.equal(field.reason, name === 'unknown' ? 'unknown_question' : 'ambiguous_label');
        if (type === 'RESUME_FILL') assert.equal(field.status, 'skipped');
      }
      assert.equal(fields.find(row => row.id === 'neighbor').reason, 'existing_value');
      fixture.assertInert();
    }
  });
