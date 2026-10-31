import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import { assertProfileBinding, captureProfileBinding } from '../src/profile/profile-lifecycle.js';
import { createControlWriteBridge, CONTROL_WRITE_FLAG, CONTROL_WRITE_MESSAGE,
  CONTROL_VERIFY_MESSAGE } from '../src/background/controls-write.mjs';

const source = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
const copy = value => value === undefined ? undefined : structuredClone(value);
const profile = {
  schemaVersion: 1, email: 'synthetic@example.test',
  education: [{ school: 'SYNTHETIC_SCHOOL', degree: 'SYNTHETIC_DEGREE', major: 'SYNTHETIC_MAJOR' }],
  confirmedFields: ['email', 'education.0.school', 'education.0.degree', 'education.0.major'],
};
const facts = [['学校', 'school'], ['学历', 'degree'], ['专业', 'major']];

// Structural fixtures deliberately contain a misleading known question inside
// an answer widget. The native select supplies its own actual option readback;
// no component model or successful control receipt is invented by the test.
function structural(t, markup, suppliedProfile = profile) {
  const dom = new JSDOM(`<!doctype html><body><form>${markup}<input id="neighbor" value="KEEP">
    <button type="submit">Save</button><button type="button">Create resume</button></form></body>`,
  { url: 'https://fixture.example.test/resume', pretendToBeVisual: true, runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const w = dom.window, effects = [], network = [], listeners = [];
  w.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  w.fetch = async (...args) => { network.push(args); throw Error('fixture_network_forbidden'); };
  w.chrome = { storage: { local: { async get() { return {}; }, async set() { throw Error('fixture_storage_write_forbidden'); } } },
    runtime: { id: 'fixture', onMessage: { addListener: value => listeners.push(value),
      removeListener(value) { const index = listeners.indexOf(value); if (index >= 0) listeners.splice(index, 1); },
      hasListener: value => listeners.includes(value), hasListeners: () => listeners.length > 0 },
      async sendMessage(message) { assert.equal(message.type, 'RESUME_PROFILE_BINDING_CHECK'); return { allowed: true }; } } };
  for (const type of ['input', 'change', 'click', 'submit'])
    w.document.addEventListener(type, event => effects.push({ type, target: event.target }), true);
  w.eval(source('src/core/matcher.js')); w.eval(source('src/content/engine.js'));
  return { w, effects, network, listeners, async run(type) {
    const result = await new Promise(resolve => listeners[0]({ type, profile: copy(suppliedProfile), profileBinding: {} }, { id: 'fixture' }, resolve));
    assert.equal(result.ok, true, JSON.stringify(result)); return result.data;
  } };
}

const nativeChoice = (key, id = key) => `<select id="${id}"><option value="">请选择</option>
  <option value="${profile.education[0][key]}">${profile.education[0][key]}</option></select>`;
const record = content => `<fieldset data-repeat-kind="education"><legend>教育经历</legend>${content}</fieldset>`;
function safe(h) {
  assert.equal(h.w.document.getElementById('neighbor').value, 'KEEP');
  assert.deepEqual(h.network, []);
  assert.equal(h.effects.some(event => event.type === 'submit' || event.target.matches('button') || event.target.id === 'neighbor'), false);
}

for (const [name, item, widget] of [
  ['Moka style', 'form-item', 'moka-select'], ['ARIA combobox', 'form-item', 'widget-shell'], ['Ant', 'ant-form-item', 'ant-select'],
  ['Element', 'el-form-item', 'el-select'], ['iView', 'ivu-form-item', 'ivu-select'],
  ['Ant cascader', 'ant-form-item', 'ant-cascader'], ['Element cascader', 'el-form-item', 'el-cascader'],
]) test(`${name} preceding title owns wrapped school, degree and major instead of internal selected text`, async t => {
  const h = structural(t, record(facts.map(([question, key]) => `<div class="${item}">
    <div class="form-item-title">${question}</div><div class="answer-column"><div class="answer-inner">
      <div class="${widget}" ${widget === 'widget-shell' ? 'role="combobox"' : ''}><label><span>邮箱</span><div>${nativeChoice(key)}</div></label></div>
    </div></div></div>`).join('')));
  const inspected = await h.run('RESUME_INSPECT');
  assert.deepEqual(h.effects, []);
  for (const [question, key] of facts) {
    const field = inspected.fields.find(row => row.id === key);
    assert.deepEqual([...field.labels], [question]);
    assert.equal(field.path, `education.0.${key}`); assert.equal(field.reason, 'ready');
  }
  const filled = await h.run('RESUME_FILL');
  for (const [, key] of facts) {
    const field = filled.fields.find(row => row.id === key);
    assert.equal(field.status, 'verified', JSON.stringify(field));
    assert.equal(h.w.document.getElementById(key).value, profile.education[0][key]);
  }
  assert.equal(h.effects.filter(event => event.type === 'change').length, 3);
  assert.equal(h.effects.some(event => event.type === 'click'), false);
  safe(h);
});

test('a label for the widget root labels its sole nested answer editor', async t => {
  const h = structural(t, record(`<div class="form-item"><label for="school-widget">毕业院校</label>
    <div class="answer-column"><div id="school-widget" class="moka-select" role="combobox">
      <label><span>邮箱</span><div>${nativeChoice('school')}</div></label>
    </div></div></div>`));
  const before = (await h.run('RESUME_INSPECT')).fields.find(row => row.id === 'school');
  assert.deepEqual([...before.labels], ['毕业院校']); assert.equal(before.path, 'education.0.school');
  const row = (await h.run('RESUME_FILL')).fields.find(row => row.id === 'school');
  assert.equal(row.status, 'verified', JSON.stringify(row)); safe(h);
});

for (const [rootName, rootAttrs] of [['dropdown', 'class="dropdown"'], ['ARIA combobox', 'role="combobox"']])
  for (const association of ['preceding title', 'label for root'])
    for (const kind of ['input', 'select'])
      test(`unconfirmed ${rootName} with two independent ${kind} editors cannot share a ${association}`, async t => {
        const question = association === 'preceding title' ? '<div class="form-item-title">学校</div>'
          : '<label for="shared-widget">学校</label>';
        const editors = ['school', 'degree'].map(key => `<div>${kind === 'input'
          ? `<input id="${key}" placeholder="请选择">` : nativeChoice(key)}</div>`).join('');
        const h = structural(t, record(`<div class="form-item">${question}<div class="ctrl">
          <div id="shared-widget" ${rootAttrs}>${editors}</div></div></div>`));
        for (const type of ['RESUME_INSPECT', 'RESUME_FILL']) {
          const rows = (await h.run(type)).fields.filter(row => ['school', 'degree'].includes(row.id));
          assert.equal(rows.length, 2);
          for (const row of rows) {
            assert.equal(row.semanticStatus, 'manual', JSON.stringify(row)); assert.equal(row.path, undefined);
            if (type === 'RESUME_FILL') assert.equal(row.status, 'skipped', JSON.stringify(row));
          }
        }
        assert.deepEqual(h.effects, []); safe(h);
      });

for (const display of ['ant-select-selection__choice__content', 'ant-cascader-picker-label', 'el-cascader__label', 'el-select__selected-item'])
  test(`${display} cannot become a question without an outside title`, async t => {
    const h = structural(t, record(`<div class="form-item"><div class="answer-column"><label>
      <span class="${display}">邮箱</span>${nativeChoice('school')}</label></div></div>`));
    for (const type of ['RESUME_INSPECT', 'RESUME_FILL']) {
      const field = (await h.run(type)).fields.find(row => row.id === 'school');
      assert.deepEqual([...field.labels], []); assert.equal(field.semanticStatus, 'manual');
      assert.equal(field.path, undefined); if (type === 'RESUME_FILL') assert.equal(field.status, 'skipped');
    }
    assert.deepEqual(h.effects, []); safe(h);
  });

for (const [name, markup] of [
  ['unknown title', `<div class="form-item"><div class="form-item-title">未识别题目</div><div class="moka-select"><label><span>学校</span>${nativeChoice('school')}</label></div></div>`],
  ['placeholder title', `<div class="form-item"><div class="form-item-title">请选择学校</div><div class="moka-select"><label><span>学历</span>${nativeChoice('school')}</label></div></div>`],
  ['shared independent editors', `<div class="form-item"><div class="form-item-title">学校</div><div class="answer-column"><div class="moka-select"><label>${nativeChoice('school')}</label></div><div class="moka-select">${nativeChoice('major')}</div></div></div>`],
  ['unlabelled nested field', `<div class="form-item"><div class="form-item-title">学校</div><div class="form-item"><div class="moka-select"><label><span>邮箱</span>${nativeChoice('school')}</label></div></div></div>`],
  ['conflicting associated questions', `<div class="form-item"><label for="school-widget">学校</label><label for="school-widget">学历</label><div id="school-widget" class="moka-select">${nativeChoice('school')}</div></div>`],
]) test(`${name} stays manual without effects`, async t => {
  const h = structural(t, record(markup));
  for (const type of ['RESUME_INSPECT', 'RESUME_FILL']) {
    const fields = (await h.run(type)).fields.filter(row => ['school', 'major'].includes(row.id));
    assert.ok(fields.length > 0);
    for (const field of fields) {
      assert.notEqual(field.reason, 'ready', JSON.stringify(field));
      assert.equal(field.semanticStatus, 'manual', JSON.stringify(field));
      if (type === 'RESUME_FILL') assert.equal(field.status, 'skipped', JSON.stringify(field));
    }
  }
  assert.equal(h.w.document.getElementById('school').value, '');
  assert.deepEqual(h.effects, []); safe(h);
});

const plainRows = (entries = facts, suffix = '') => `<div class="record-content">${entries.map(([question, key]) => `
  <div class="question-row"><div class="question-title">${question}</div><div class="ctrl"><div class="dropdown">
    <label><span>邮箱</span><input id="${key}${suffix}" placeholder="请选择"></label><div class="shadow" aria-hidden="true">学校</div>
  </div></div></div>`).join('')}</div>`;
const plainEducation = (rows = plainRows(), title = '教育背景') => `<div class="record-block">
  <div class="record-header"><span>${title}</span><button type="button">新增</button></div>${rows}</div>`;

test('one complete plain education record maps its school, degree and major with a single confirmed source record', async t => {
  const h = structural(t, plainEducation());
  const before = await h.run('RESUME_INSPECT');
  for (const [question, key] of facts) {
    const row = before.fields.find(field => field.id === key);
    assert.deepEqual([...row.labels], [question]); assert.equal(row.path, `education.0.${key}`, JSON.stringify(row));
    assert.equal(row.reason, 'ready'); assert.equal(h.w.document.getElementById(key).value, '');
  }
  assert.deepEqual(h.effects, []);
  const filled = await h.run('RESUME_FILL');
  for (const [, key] of facts) {
    const row = filled.fields.find(field => field.id === key);
    assert.equal(row.status, 'verified', JSON.stringify(row)); assert.equal(h.w.document.getElementById(key).value, profile.education[0][key]);
  }
  assert.equal(h.effects.filter(event => event.type === 'change').length, 3);
  assert.equal(h.effects.some(event => event.type === 'click'), false); safe(h);
});

const multipleEducation = {
  ...profile,
  education: [...profile.education, { school: 'SYNTHETIC_SECOND_SCHOOL', degree: 'SYNTHETIC_SECOND_DEGREE', major: 'SYNTHETIC_SECOND_MAJOR' }],
  confirmedFields: [...profile.confirmedFields, ...facts.map(([, key]) => `education.1.${key}`)],
};

for (const [name, markup, suppliedProfile, expected] of [
  ['two visible records', plainEducation(plainRows(facts, '-first') + plainRows(facts, '-second')), multipleEducation,
    facts.flatMap(([, key]) => [[`${key}-first`, 0, key], [`${key}-second`, 1, key]])],
  ['multiple source records', plainEducation(), multipleEducation, facts.map(([, key]) => [key, 0, key])],
  ...facts.map(([, missing]) => [`missing ${missing} question`, plainEducation(plainRows(facts.filter(([, key]) => key !== missing))),
    profile, facts.filter(([, key]) => key !== missing).map(([, key]) => [key, 0, key])]),
]) test(`plain education ${name} binds each existing field to its record index`, async t => {
  const h = structural(t, markup, suppliedProfile);
  const inspected = await h.run('RESUME_INSPECT');
  assert.deepEqual(h.effects, []);
  const filled = await h.run('RESUME_FILL');
  for (const [id, index, key] of expected) {
    const before = inspected.fields.find(row => row.id === id);
    assert.equal(before.path, `education.${index}.${key}`, JSON.stringify(before));
    assert.equal(before.reason, 'ready', JSON.stringify(before));
    const after = filled.fields.find(row => row.id === id);
    assert.equal(after.path, before.path); assert.equal(after.status, 'verified', JSON.stringify(after));
    assert.equal(h.w.document.getElementById(id).value, suppliedProfile.education[index][key]);
  }
  assert.equal(filled.fields.filter(row => row.path?.startsWith('education.') && row.status === 'verified').length, expected.length);
  assert.equal(h.effects.filter(event => event.type === 'change').length, expected.length);
  assert.equal(h.effects.some(event => event.type === 'click'), false); safe(h);
});

for (const [name, markup] of [
  ['two separate education blocks', plainEducation(plainRows(facts, '-first')) + plainEducation(plainRows(facts, '-second'))],
  ['unknown section heading', plainEducation(plainRows(), '未识别分区')],
]) test(`plain education ${name} cannot guess an education index`, async t => {
  const h = structural(t, markup);
  for (const type of ['RESUME_INSPECT', 'RESUME_FILL']) {
    const fields = (await h.run(type)).fields.filter(row => /^(school|degree|major)/u.test(row.id));
    assert.ok(fields.length >= 2);
    for (const row of fields) {
      assert.equal(row.semanticStatus, 'manual', JSON.stringify(row));
      assert.equal(row.path, undefined, JSON.stringify(row));
      if (type === 'RESUME_FILL') assert.equal(row.status, 'skipped', JSON.stringify(row));
    }
  }
  assert.deepEqual(h.effects, []); safe(h);
});

test('plain education record inference cannot label or fill an unknown adjacent question', async t => {
  const h = structural(t, plainEducation(plainRows([...facts, ['未识别题目', 'other']])));
  const result = await h.run('RESUME_FILL'), other = result.fields.find(row => row.id === 'other');
  assert.deepEqual([...other.labels], ['未识别题目']); assert.equal(other.semanticStatus, 'manual');
  assert.equal(other.path, undefined); assert.equal(other.status, 'skipped');
  assert.equal(result.fields.filter(row => row.path?.startsWith('education.0.') && row.status === 'verified').length, 3);
  assert.equal(h.w.document.getElementById('other').value, ''); safe(h);
});

const vendorFiles = {
  el: ['vue/dist/vue.js', 'element-ui/lib/index.js'],
  ant: ['vue/dist/vue.js', 'moment/min/moment.min.js', 'ant-design-vue/dist/antd.js'],
  ivu: ['vue/dist/vue.js', 'iview/dist/iview.js'],
};

// This second fixture uses pinned real libraries and the production MAIN write
// bridge. Values change only via their ordinary option click handlers.
async function realSelect(t, lib, { wrapInLabel = true, entries = facts, searchable = true, unmarked = false } = {}) {
  const dom = new JSDOM('<!doctype html><body><form><div id="app"></div><input id="neighbor" value="KEEP">'
    + '<button type="submit">Save</button></form></body>',
  { url: 'https://fixture.example.test/resume', pretendToBeVisual: true, runScripts: 'outside-only' });
  const w = dom.window, effects = [], network = [], messages = [], listeners = [];
  w.Element.prototype.getClientRects = () => [{ width: 20, height: 20 }];
  w.CSS = { escape: value => value };
  w.fetch = async (...args) => { network.push(args); throw Error('fixture_network_forbidden'); };
  for (const file of vendorFiles[lib]) w.eval(readFileSync(require.resolve(file), 'utf8'));
  w.Vue.config.productionTip = false; w.Vue.config.devtools = false;
  w.Vue.use(lib === 'el' ? w.ELEMENT : lib === 'ant' ? w.antd : w.iview);
  const [itemClass, tag, option] = lib === 'el' ? ['el-form-item', 'el-select', 'el-option']
    : lib === 'ant' ? ['ant-form-item', 'a-select', 'a-select-option'] : ['ivu-form-item', 'i-select', 'i-option'];
  const wrapper = wrapInLabel ? 'label' : 'div';
  const fields = entries.map(([question, key]) => `<div class="${itemClass}"><div class="form-item-title">${question}</div>
    <div class="answer-column"><div class="answer-inner"><${wrapper}>
      <${tag} class="field-${key}" v-model="${key}" ${lib === 'ant' ? searchable ? 'show-search option-filter-prop="children"' : '' : 'filterable'}>
        <${option} value="${key}-code" ${lib === 'el' ? `label="${profile.education[0][key]}"` : ''}>${profile.education[0][key]}</${option}>
      </${tag}></${wrapper}></div></div></div>`).join('');
  const app = new w.Vue({ el: '#app', data: () => ({ school: '', degree: '', major: '' }),
    template: unmarked ? plainEducation(`<div class="record-content">${fields}</div>`) : record(fields) });
  await w.Vue.nextTick();
  t.after(() => { app.$destroy(); dom.window.close(); });
  const data = { [CONTROL_WRITE_FLAG]: true, resumeProfile: copy(profile),
    resumeProfileLifecycle: { version: 1, epoch: '00000000-0000-4000-8000-000000000001', state: 'ready' } };
  const storage = { get: async keys => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, copy(data[key])])),
    set: async values => Object.assign(data, copy(values)) };
  const binding = await captureProfileBinding(storage), tab = { id: 7, active: true, url: w.location.href };
  const sender = { id: 'fixture', frameId: 0, url: tab.url, tab };
  const api = { storage: { local: storage }, tabs: { get: async () => ({ ...tab }) },
    runtime: { id: sender.id, getManifest: () => ({ background: { service_worker: 'src/background/worker.mjs' } }) },
    scripting: { executeScript: async request => {
      if (request.files) { for (const file of request.files) w.eval(source(file)); return [{ frameId: 0 }]; }
      return [{ frameId: 0, result: copy(await w.eval(`(${request.func.toString()})`)(...copy(request.args))) }];
    } } };
  const bridge = createControlWriteBridge({ api, lifecycleOptions: { locks: { request: async (_name, _options, work) => work() } } });
  w.chrome = { storage: { local: storage }, runtime: { id: sender.id,
    onMessage: { addListener: listener => listeners.push(listener), removeListener() {} },
    sendMessage: async message => {
      messages.push(copy(message));
      if (message.type !== 'RESUME_PROFILE_BINDING_CHECK') return new Promise(resolve => bridge.listener(message, sender, resolve));
      try { await assertProfileBinding(storage, message.profileBinding); return { allowed: true }; }
      catch { return { allowed: false }; }
    } } };
  for (const type of ['input', 'change', 'click', 'submit'])
    w.document.addEventListener(type, event => effects.push({ type, target: event.target }), true);
  w.eval(source('src/core/matcher.js')); w.eval(source('src/content/engine.js'));
  return { w, app, effects, network, messages, async run(type) {
    const result = await new Promise(resolve => listeners[0]({ type, profile: copy(profile), profileBinding: binding }, { id: sender.id }, resolve));
    assert.equal(result.ok, true, JSON.stringify(result)); return result.data;
  } };
}

for (const [lib, adapter, searchable = true, unmarked = false] of [
  ['el', 'el-select-search'], ['ant', 'antdv1-select-search'], ['ivu', 'ivu-select'], ['ant', 'antdv1-select', false],
  ['el', 'el-select-search', true, true], ['ant', 'antdv1-select-search', true, true],
]) test(`${adapter} real ${unmarked ? 'unmarked' : 'wrapped'} education selects use existing adapter writes and independent readback receipts`, async t => {
    const h = await realSelect(t, lib, { wrapInLabel: !unmarked && lib !== 'ivu', searchable, unmarked });
    if (unmarked) assert.equal(h.w.document.querySelectorAll('[data-repeat-kind]').length, 0);
    const before = await h.run('RESUME_INSPECT');
    for (const [question, key] of facts) {
      const row = before.fields.find(field => field.path === `education.0.${key}`);
      assert.ok(row, JSON.stringify(before)); assert.deepEqual([...row.labels], [question]);
      assert.equal(row.reason, 'ready', JSON.stringify(row));
    }
    assert.deepEqual(h.effects, []);
    const result = await h.run('RESUME_FILL');
    for (const [, key] of facts) {
      const row = result.fields.find(field => field.path === `education.0.${key}`);
      assert.equal(row?.status, 'verified', JSON.stringify(result)); assert.equal(row.adapter, adapter);
      assert.equal(row.reason, 'readback_matched'); assert.equal(h.app[key], `${key}-code`);
      assert.equal(row.currentValue, profile.education[0][key]);
    }
    assert.equal(h.messages.filter(message => message.type === CONTROL_WRITE_MESSAGE).length, 3);
    assert.equal(h.messages.filter(message => message.type === CONTROL_VERIFY_MESSAGE).length, 3);
    assert.equal(h.w.ResumeControls.liveSupportClaimed, false); safe(h);
  });

test('a real iView select reopened by an outer label activation never reports a successful readback', async t => {
  const h = await realSelect(t, 'ivu', { entries: [facts[0]] });
  const result = await h.run('RESUME_FILL'), row = result.fields.find(field => field.path === 'education.0.school');
  assert.equal(row?.status, 'failed', JSON.stringify(result));
  assert.equal(row.reason, 'owned_overlay_cleanup_timeout');
  assert.equal(h.app.school, 'school-code');
  assert.equal(h.messages.filter(message => message.type === CONTROL_WRITE_MESSAGE).length, 1);
  assert.equal(h.messages.filter(message => message.type === CONTROL_VERIFY_MESSAGE).length, 0);
  assert.equal(h.w.ResumeControls.liveSupportClaimed, false); safe(h);
});

test('reinjection replaces a revision 27 listener once before resolving wrapped education labels', async t => {
  const h = structural(t, plainEducation()), previous = h.w.__resumeQuickFillEngineListener;
  h.w.__resumeQuickFillEngineRevision = 27;
  h.w.eval(source('src/content/engine.js'));
  const current = h.w.__resumeQuickFillEngineListener;
  assert.notEqual(current, previous); assert.equal(h.w.__resumeQuickFillEngineRevision, 28);
  assert.equal(h.listeners.length, 1); assert.equal(h.listeners[0], current);
  h.w.eval(source('src/content/engine.js'));
  assert.equal(h.w.__resumeQuickFillEngineListener, current); assert.equal(h.listeners.length, 1);
  const result = await h.run('RESUME_FILL');
  assert.equal(result.fields.filter(row => row.path?.startsWith('education.0.') && row.status === 'verified').length, 3);
  assert.equal(h.effects.filter(event => event.type === 'change').length, 3); safe(h);
});
