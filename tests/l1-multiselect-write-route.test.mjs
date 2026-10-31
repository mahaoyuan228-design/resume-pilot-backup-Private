import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import { assertProfileBinding, captureProfileBinding } from '../src/profile/profile-lifecycle.js';
import { createControlWriteBridge, CONTROL_CANDIDATES_MESSAGE, CONTROL_WRITE_MESSAGE, CONTROL_VERIFY_MESSAGE, CONTROL_WRITE_FLAG } from '../src/background/controls-write.mjs';

const require = createRequire(import.meta.url);
const vendors = ['vue/dist/vue.js', 'element-ui/lib/index.js', 'ant-design-vue/dist/antd.js']
  .map(file => readFileSync(require.resolve(file), 'utf8'));
const source = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const copy = value => value === undefined ? undefined : structuredClone(value);

async function harness({ lib = 'el', values = ['北京', '上海'], initial = [], enabled = true, confirmed = true, afterWrite } = {}) {
  const dom = new JSDOM('<!doctype html><body><form><div id="app"></div><input id="neighbor" value="KEEP"><button type="submit">Save</button></form></body>',
    { url: 'https://offline.invalid/resume', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, listeners = [], messages = [], effects = [];
  w.Element.prototype.getClientRects = () => [{ width: 20, height: 20 }];
  w.CSS = { escape: value => value };
  for (const vendor of vendors) w.eval(vendor);
  w.Vue.config.productionTip = false; w.Vue.config.devtools = false;
  w.Vue.use(w.ELEMENT); w.Vue.use(w.antd);
  const app = new w.Vue({ el: '#app', data: () => ({ value: initial.slice() }), template: lib === 'el'
    ? '<div class="el-form-item"><label class="el-form-item__label">期望城市</label><el-select v-model="value" multiple filterable><el-option value="bj" label="北京"/><el-option value="sh" label="上海"/><el-option value="gz" label="广州"/></el-select></div>'
    : '<div class="ant-form-item"><div class="ant-form-item-label"><label>期望城市</label></div><a-select v-model="value" mode="multiple"><a-select-option value="bj">北京</a-select-option><a-select-option value="sh">上海</a-select-option><a-select-option value="gz">广州</a-select-option></a-select></div>' });
  await w.Vue.nextTick();
  const data = { [CONTROL_WRITE_FLAG]: enabled, resumeProfile: { schemaVersion: 1, desiredCities: values.slice(),
    confirmedFields: confirmed ? values.map((_, index) => `desiredCities.${index}`) : [] },
  resumeProfileLifecycle: { version: 1, epoch: '00000000-0000-4000-8000-000000000001', state: 'ready' } };
  const storage = { get: async keys => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, copy(data[key])])),
    set: async values => Object.assign(data, copy(values)) };
  const binding = await captureProfileBinding(storage), tab = { id: 7, active: true, url: w.location.href };
  const sender = { id: 'offline-extension', url: tab.url, tab, frameId: 0 };
  const api = { storage: { local: storage }, tabs: { get: async () => ({ ...tab }) },
    runtime: { id: sender.id, getManifest: () => ({ background: { service_worker: 'src/background/worker.mjs' } }) },
    scripting: { executeScript: async request => {
      if (request.files) { for (const file of request.files) w.eval(source(file)); return [{ frameId: 0 }]; }
      return [{ frameId: 0, result: copy(await w.eval(`(${request.func.toString()})`)(...copy(request.args))) }];
    } } };
  const bridge = createControlWriteBridge({ api, lifecycleOptions: { locks: { request: async (_name, _options, work) => work() } } });
  const invoke = message => new Promise(resolve => bridge.listener(message, sender, async result => {
    if (message.type === CONTROL_WRITE_MESSAGE && result.status === 'success' && afterWrite) await afterWrite({ app, w });
    resolve(result);
  }));
  w.chrome = { runtime: { id: sender.id, onMessage: { addListener: listener => listeners.push(listener), removeListener: () => {} },
    sendMessage: async message => {
      messages.push(copy(message));
      if (message.type !== 'RESUME_PROFILE_BINDING_CHECK') return invoke(message);
      try { await assertProfileBinding(storage, message.profileBinding); return { allowed: true }; }
      catch { return { allowed: false }; }
    } }, storage: { local: storage } };
  for (const type of ['input', 'change', 'blur', 'click', 'submit'])
    w.document.addEventListener(type, event => effects.push({ type, target: event.target }), true);
  w.eval(source('src/core/matcher.js')); w.eval(source('src/content/engine.js'));
  const run = type => new Promise(resolve => listeners[0]({ type, profile: copy(data.resumeProfile), profileBinding: binding }, { id: sender.id }, resolve));
  return { dom, w, app, data, binding, effects, messages, invoke, fill: () => run('RESUME_FILL'), inspect: () => run('RESUME_INSPECT'),
    candidates: () => invoke({ type: CONTROL_CANDIDATES_MESSAGE, timeOrigin: w.performance.timeOrigin }),
    close() { app.$destroy(); dom.window.close(); } };
}

function safe(h) {
  assert.equal(h.w.document.getElementById('neighbor').value, 'KEEP');
  assert.equal(h.effects.some(event => event.type === 'submit' || event.target.id === 'neighbor'
    || event.target.matches('button[type="submit"]')), false);
  assert.equal(h.w.ResumeControls.liveSupportClaimed, false);
}

for (const lib of ['el', 'ant']) {
  test(`${lib} multi-select discovery yields one answer target and preserves array facts through ordinary fill`, async t => {
    for (const values of [['北京', '上海'], ['北京']]) {
      const h = await harness({ lib, values }); t.after(() => h.close());
      const candidates = await h.candidates();
      assert.equal(candidates.ok, true, JSON.stringify(candidates));
      assert.equal(candidates.candidates.length, 1);
      const candidate = candidates.candidates[0];
      assert.equal(candidate.type, 'multi-select');
      assert.equal(candidate.adapter, lib === 'el' ? 'el-select-multiple' : 'antdv1-select-multiple');
      assert.equal(h.w.document.querySelectorAll(candidate.rootSelector).length, 1);
      if (lib === 'el') assert.equal(h.w.document.querySelector(candidate.rootSelector).querySelectorAll('input').length, 2);
      const before = await h.inspect(), rows = before.data.fields.filter(row => row.path === 'desiredCities');
      assert.equal(rows.length, 1, JSON.stringify(before)); assert.equal(rows[0].reason, 'ready');
      assert.deepEqual(h.effects, []);
      const result = await h.fill(), row = result.data.fields.find(field => field.path === 'desiredCities');
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(row.status, 'verified', JSON.stringify(row)); assert.equal(row.reason, 'readback_matched');
      assert.equal(row.adapter, candidate.adapter);
      assert.deepEqual(copy(h.app.value), values.map(value => value === '北京' ? 'bj' : 'sh'));
      const writes = h.messages.filter(message => message.type === CONTROL_WRITE_MESSAGE);
      const verifies = h.messages.filter(message => message.type === CONTROL_VERIFY_MESSAGE);
      assert.equal(writes.length, 1); assert.equal(verifies.length, 1);
      assert.deepEqual(writes[0].value, values); assert.deepEqual(verifies[0].value, values);
      safe(h);
    }
  });
}

test('multi-select preexisting chips retain original values while arrays add missing choices', async t => {
  const h = await harness({ initial: ['gz'], values: ['北京', '上海'] }); t.after(() => h.close());
  const result = await h.fill(), row = result.data.fields.find(field => field.path === 'desiredCities');
  assert.equal(row.status, 'verified', JSON.stringify(row));
  assert.deepEqual(copy(h.app.value), ['gz', 'bj', 'sh']);
  safe(h);
});

test('multi-select ordinary routing stays gated by opt-in and confirmed array facts', async t => {
  for (const options of [{ enabled: false }, { confirmed: false }]) {
    const h = await harness(options); t.after(() => h.close());
    const result = await h.fill();
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(h.messages.some(message => message.type === CONTROL_WRITE_MESSAGE), false);
    assert.deepEqual(copy(h.app.value), []); assert.deepEqual(h.effects, []);
  }
});

test('multi-select batch readback detects later model or chip reversion without a second write', async t => {
  for (const endpoint of ['model', 'chips']) {
    const h = await harness({ afterWrite: async ({ app, w }) => {
      if (endpoint === 'model') { app.value = ['bj']; await w.Vue.nextTick(); }
      else w.document.querySelector('.el-tag').remove();
    } }); t.after(() => h.close());
    const result = await h.fill(), row = result.data.fields.find(field => field.path === 'desiredCities');
    assert.equal(row.status, 'failed', JSON.stringify(row));
    assert.equal(row.reason, 'readback_mismatch');
    assert.equal(h.messages.filter(message => message.type === CONTROL_WRITE_MESSAGE).length, 1);
    assert.equal(h.messages.filter(message => message.type === CONTROL_VERIFY_MESSAGE).length, 1);
    assert.equal(h.effects.filter(event => event.type === 'click' && event.target.closest('.el-select-dropdown__item')).length, 2);
    safe(h);
  }
});
