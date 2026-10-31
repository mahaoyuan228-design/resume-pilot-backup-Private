import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import { captureProfileBinding } from '../src/profile/profile-lifecycle.js';
import { createControlWriteBridge, CONTROL_CANDIDATES_MESSAGE, CONTROL_WRITE_MESSAGE,
  CONTROL_VERIFY_MESSAGE, CONTROL_WRITE_FLAG } from '../src/background/controls-write.mjs';

const require = createRequire(import.meta.url);
const vendor = ['vue/dist/vue.js', 'moment/min/moment.min.js', 'element-ui/lib/index.js', 'ant-design-vue/dist/antd.js']
  .map(name => readFileSync(require.resolve(name), 'utf8'));
const source = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const copy = value => value === undefined ? undefined : structuredClone(value);
const school = 'SYNTHETIC_SCHOOL', path = ['SYNTHETIC_CATEGORY', 'SYNTHETIC_MAJOR'];

// These are the actual pinned Vue components in a disposable document. All
// facts are synthetic; neither discovery nor writes contact a remote server.
async function boot(t, lib, kind, enabled = true) {
  const dom = new JSDOM('<!doctype html><body><div id="app"></div></body>', {
    url: 'https://fixture.example.test/resume', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const w = dom.window, effects = [], calls = [];
  w.Element.prototype.getClientRects = () => [{ width: 20, height: 20 }];
  for (const code of vendor) w.eval(code);
  w.Vue.config.productionTip = false; w.Vue.config.devtools = false;
  w.Vue.use(w.ELEMENT); w.Vue.use(w.antd);
  const select = lib === 'el'
    ? `<el-select class="first" v-model="school"><el-option label="${school}" value="school-code"></el-option></el-select>`
    : `<a-select class="first" v-model="school"><a-select-option value="school-code">${school}</a-select-option></a-select>`;
  const cascade = lib === 'el' ? '<el-cascader class="first" v-model="path" :options="options"></el-cascader>'
    : '<a-cascader class="first" v-model="path" :options="options"></a-cascader>';
  const app = new w.Vue({ el: '#app', data: () => ({ school: '', path: [], options: [
    { value: 'category-code', label: path[0], children: [{ value: 'major-code', label: path[1] }] },
  ] }), template: `<form><div class="question-row"><div>学校</div><div><div>${kind === 'select' ? select : cascade}</div></div></div>
    <input id="neighbor" value="KEEP"><button type="button">保存</button><button type="submit">提交</button></form>` });
  await w.Vue.nextTick();
  t.after(() => { app.$destroy(); dom.window.close(); });
  for (const name of ['input', 'change', 'click', 'submit']) w.document.addEventListener(name, event => effects.push([name, event.target.tagName]), true);
  const network = { requests: 0 };
  w.fetch = () => { network.requests++; throw Error('unexpected_request'); };
  w.XMLHttpRequest.prototype.open = () => { network.requests++; throw Error('unexpected_request'); };
  w.navigator.sendBeacon = () => { network.requests++; throw Error('unexpected_request'); };
  const factPath = kind === 'select' ? 'education.0.school' : 'customAnswers.专业分类';
  const value = kind === 'select' ? school : path;
  const data = { resumeProfile: { schemaVersion: 1, education: [{ school }],
    customAnswers: { 专业分类: path }, confirmedFields: [factPath] },
    resumeProfileLifecycle: { version: 1, epoch: '00000000-0000-4000-8000-000000000001', state: 'ready' } };
  if (enabled !== 'absent') data[CONTROL_WRITE_FLAG] = enabled;
  const storage = { get: async keys => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, copy(data[key])])),
    set: async values => Object.assign(data, copy(values)) };
  const binding = await captureProfileBinding(storage);
  const tab = { id: 7, active: true, url: w.location.href }, sender = { id: 'fixture-extension', url: tab.url, tab, frameId: 0 };
  const api = { storage: { local: storage }, tabs: { get: async () => ({ ...tab }) },
    runtime: { id: sender.id, getManifest: () => ({ background: { service_worker: 'src/background/worker.mjs' } }) },
    scripting: { executeScript: async request => {
      calls.push(request);
      if (request.files) { for (const file of request.files) w.eval(source(file)); return [{ frameId: 0 }]; }
      return [{ frameId: 0, result: copy(await w.eval(`(${request.func.toString()})`)(...copy(request.args))) }];
    } } };
  const bridge = createControlWriteBridge({ api, lifecycleOptions: { locks: { request: async (_name, _options, work) => work() } } });
  const invoke = async message => {
    const result = await new Promise(resolve => bridge.listener(message, sender, resolve));
    await Promise.resolve();
    return result;
  };
  const candidates = () => invoke({ type: CONTROL_CANDIDATES_MESSAGE, timeOrigin: w.performance.timeOrigin });
  const request = selector => ({ type: CONTROL_WRITE_MESSAGE, selector, path: factPath, value,
    profileBinding: binding, timeOrigin: w.performance.timeOrigin });
  return { w, app, effects, network, calls, data, invoke, candidates, request,
    root: w.document.querySelector('.first'), adapter: `${lib === 'el' ? 'el' : 'antdv1'}-${kind}` };
}

for (const lib of ['el', 'ant']) for (const kind of ['select', 'cascader']) {
  test(`${lib} ${kind} discovery binds one pinned component root and stays inert`, async t => {
    const h = await boot(t, lib, kind), before = h.w.document.body.innerHTML;
    const result = await h.candidates();
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.writeStarted, false); assert.equal(result.liveSupportClaimed, false);
    assert.equal(result.candidates.length, 1);
    const candidate = result.candidates[0];
    assert.equal(candidate.adapter, h.adapter); assert.equal(candidate.type, kind);
    assert.equal(h.w.document.querySelector(candidate.rootSelector), h.root);
    assert.equal(h.root.contains(h.w.document.querySelector(candidate.selector)), true);
    // A second display/search input is still a peer of this same answer.
    const peer = h.w.document.createElement('input'); h.root.append(peer);
    const withPeer = await h.candidates();
    assert.equal(withPeer.candidates.length, 1);
    assert.equal(withPeer.candidates[0].rootSelector, candidate.rootSelector);
    peer.remove();
    assert.equal(h.w.document.body.innerHTML, before);
    assert.deepEqual(h.effects, []); assert.equal(h.network.requests, 0);
    assert.equal(h.w.document.getElementById('neighbor').value, 'KEEP');
  });

  test(`${lib} ${kind} discovered target writes and verifies the existing adapter model`, async t => {
    const h = await boot(t, lib, kind), candidate = (await h.candidates()).candidates[0];
    assert.ok(candidate, 'the pinned component must enter ordinary discovery');
    const request = h.request(candidate.selector), written = await h.invoke(request);
    assert.equal(written.ok, true, JSON.stringify(written));
    assert.equal(written.adapter, h.adapter); assert.equal(written.status, 'success');
    assert.equal(written.writeStarted, true); assert.equal(written.liveSupportClaimed, false);
    assert.ok(written.readbackId);
    assert.deepEqual(copy(kind === 'select' ? h.app.school : h.app.path), kind === 'select' ? 'school-code' : ['category-code', 'major-code']);
    const checked = await h.invoke({ ...request, type: CONTROL_VERIFY_MESSAGE, readbackId: written.readbackId });
    assert.equal(checked.ok, true, JSON.stringify(checked)); assert.equal(checked.status, 'success');
    assert.equal(checked.writeStarted, false); assert.equal(checked.liveSupportClaimed, false);
    const display = kind === 'select' && lib === 'ant' ? h.root.querySelector('.ant-select-selection-selected-value')?.textContent.trim()
      : kind === 'cascader' && lib === 'ant' ? h.root.querySelector('.ant-cascader-picker-label')?.textContent.trim() : h.root.querySelector('input').value;
    assert.equal(display, kind === 'select' ? school : path.join(' / '));
    assert.equal(h.effects.some(([name, tag]) => name === 'submit' || name === 'click' && tag === 'BUTTON'), false);
    assert.equal(h.network.requests, 0); assert.equal(h.w.document.getElementById('neighbor').value, 'KEEP');
  });

  test(`${lib} ${kind} unknown library versions remain manual with no effects`, async t => {
    const h = await boot(t, lib, kind);
    if (lib === 'el') h.w.ELEMENT = { ...h.w.ELEMENT, version: '99.0.0' };
    else h.w.antd = { ...h.w.antd, version: '99.0.0' };
    const result = await h.candidates();
    assert.deepEqual(result.candidates, []);
    const input = h.root.querySelector('input');
    assert.equal(h.w.ResumeControls.plan(input, { value: kind === 'select' ? school : path }).status, 'manual');
    const written = await h.invoke(h.request(input ? '.first input' : '.first [role="combobox"]'));
    assert.equal(written.ok, true, JSON.stringify(written)); assert.equal(written.status, 'manual');
    assert.equal(written.writeStarted, false); assert.equal(written.liveSupportClaimed, false);
    assert.deepEqual(h.effects, []); assert.equal(h.network.requests, 0);
  });

  test(`${lib} ${kind} candidates and writes remain disabled unless explicitly enabled`, async t => {
    for (const enabled of ['absent', false]) {
      const h = await boot(t, lib, kind, enabled), result = await h.candidates();
      assert.equal(result.ok, false); assert.equal(result.reason, 'control_write_disabled');
      const written = await h.invoke(h.request('.first input'));
      assert.equal(written.ok, false); assert.equal(written.reason, 'control_write_disabled');
      assert.equal(written.writeStarted, false); assert.equal(written.liveSupportClaimed, false);
      assert.deepEqual(h.calls, []); assert.deepEqual(h.effects, []); assert.equal(h.network.requests, 0);
      assert.equal(h.w.document.getElementById('neighbor').value, 'KEEP');
    }
  });
}
