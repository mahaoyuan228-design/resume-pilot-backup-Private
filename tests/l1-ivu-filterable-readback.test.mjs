import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const vendor = ['vue/dist/vue.js', 'iview/dist/iview.js'].map(name => readFileSync(require.resolve(name), 'utf8'));
const sources = ['model', 'registry', 'native', 'vue-controls', 'extended-controls'].map(name =>
  readFileSync(new URL(`../src/content/controls/${name}.js`, import.meta.url), 'utf8'));
const school = 'SYNTHETIC_SCHOOL';
const ctx = { allowWrite: true, check: async () => {} };

async function boot(t, filterable = true) {
  const dom = new JSDOM('<!doctype html><body><div id="app"></div><input id="neighbor" value="KEEP"></body>', {
    url: 'https://fixture.example.test/resume', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const w = dom.window, effects = [], network = { requests: 0 };
  w.Element.prototype.getClientRects = () => [{ width: 20, height: 20 }];
  for (const source of vendor) w.eval(source);
  w.Vue.config.productionTip = false; w.Vue.config.devtools = false; w.Vue.use(w.iview);
  const app = new w.Vue({ el: '#app', data: () => ({ school: '' }),
    template: `<main><i-select class="first" v-model="school" ${filterable ? 'filterable' : ''}>
      <i-option value="school-code">${school}</i-option><i-option value="other-code">SYNTHETIC_OTHER</i-option></i-select></main>` });
  await w.Vue.nextTick();
  t.after(() => { app.$destroy(); dom.window.close(); });
  for (const name of ['input', 'change', 'click', 'submit']) w.document.addEventListener(name, event => effects.push([name, event.target.tagName]), true);
  w.fetch = () => { network.requests++; throw Error('unexpected_request'); };
  w.XMLHttpRequest.prototype.open = () => { network.requests++; throw Error('unexpected_request'); };
  w.navigator.sendBeacon = () => { network.requests++; throw Error('unexpected_request'); };
  for (const source of sources) w.eval(source);
  const root = w.document.querySelector('.first'), R = w.ResumeControls;
  return { w, app, root, R, effects, network, input: root.querySelector('.ivu-select-input'), adapter: R.resolve(root),
    safe() {
      assert.equal(network.requests, 0); assert.equal(w.document.getElementById('neighbor').value, 'KEEP');
      assert.equal(effects.some(([name]) => name === 'submit'), false); assert.equal(R.liveSupportClaimed, false);
    } };
}

test('pinned filterable iView select reads the committed input label separately from its model', async t => {
  const h = await boot(t), plan = h.R.plan(h.input, { value: school });
  assert.equal(plan.adapter, 'ivu-select'); assert.equal(plan.status, 'planned');
  assert.equal(h.root.querySelector('.ivu-select-selected-value'), null);
  const result = await h.adapter.write(h.input, plan, ctx);
  assert.equal(result.strategy, 'ui', JSON.stringify(result));
  assert.equal(h.app.school, 'school-code'); assert.equal(h.input.value, school);
  const checked = await h.adapter.verify(h.input, plan, { settleMs: 0 });
  assert.equal(checked.status, 'success'); assert.equal(checked.modelReadback, 'school-code');
  assert.equal(checked.domReadback, school);
  const count = h.effects.length;
  assert.equal((await h.adapter.write(h.input, plan, ctx)).reason, 'preexisting_same_value');
  assert.equal(h.effects.length, count);
  h.safe();
});

test('filterable iView readback rejects DOM corruption and a model-only reversion', async t => {
  const h = await boot(t), plan = h.R.plan(h.input, { value: school });
  await h.adapter.write(h.input, plan, ctx);
  h.input.value = 'SYNTHETIC_CORRUPTED_DISPLAY';
  assert.equal(h.app.school, 'school-code');
  assert.equal((await h.adapter.verify(h.input, plan, { settleMs: 0 })).status, 'mismatch');
  assert.equal((await h.adapter.verify(h.input, plan, { previousSuccess: true, settleMs: 0 })).status, 'reverted');
  h.app.school = 'other-code'; await h.w.Vue.nextTick();
  h.input.value = school;
  assert.equal((await h.adapter.verify(h.input, plan, { settleMs: 0 })).status, 'mismatch');
  h.app.school = ''; await h.w.Vue.nextTick(); h.input.value = school;
  assert.equal((await h.adapter.verify(h.input, plan, { settleMs: 0 })).status, 'mismatch');
  h.safe();
});

test('filterable iView preserves a pending query and rejects ambiguous display inputs or unknown versions', async t => {
  const h = await boot(t);
  h.input.value = 'SYNTHETIC_PENDING_QUERY';
  assert.equal(h.R.plan(h.input, { value: school }).reason, 'existing_value');
  assert.equal(h.app.school, ''); assert.deepEqual(h.effects, []);
  h.input.value = '';
  const peer = h.input.cloneNode(); h.input.parentElement.append(peer);
  assert.equal(h.adapter.readModel(h.input).available, false);
  assert.ok(!['planned', 'success'].includes(h.R.plan(h.input, { value: school }).status));
  peer.remove();
  h.w.iview = { ...h.w.iview, version: '99.0.0' };
  assert.equal(h.R.plan(h.input, { value: school }).status, 'manual');
  assert.deepEqual(h.effects, []); h.safe();
});

test('pinned nonfilterable iView keeps the selected-value span contract', async t => {
  const h = await boot(t, false), plan = h.R.plan(h.root, { value: school });
  assert.equal(plan.adapter, 'ivu-select'); assert.equal(plan.status, 'planned');
  await h.adapter.write(h.root, plan, ctx);
  assert.equal(h.app.school, 'school-code');
  assert.equal(h.root.querySelector('.ivu-select-selected-value').textContent.trim(), school);
  assert.equal((await h.adapter.verify(h.root, plan, { settleMs: 0 })).status, 'success');
  h.safe();
});

test('reinjection replaces revision 22 before using the filterable iView readback contract', async t => {
  const h = await boot(t);
  const old = h.w.ResumeControls = Object.freeze({ ...h.R, revision: 22 });
  for (const source of sources) h.w.eval(source);
  const current = h.w.ResumeControls;
  assert.notEqual(current, old); assert.equal(current.revision, 23);
  const plan = current.plan(h.input, { value: school }), adapter = current.resolve(h.input);
  assert.equal(plan.status, 'planned');
  await adapter.write(h.input, plan, ctx);
  assert.equal((await adapter.verify(h.input, plan, { settleMs: 0 })).status, 'success');
  for (const source of sources) h.w.eval(source);
  assert.equal(h.w.ResumeControls, current);
  assert.equal(current.list().filter(row => row.name === 'ivu-select').length, 1);
  h.safe();
});
