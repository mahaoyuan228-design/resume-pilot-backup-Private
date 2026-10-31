/**
 * Offline synthetic scaffold. The 2026-10-24 row-C harvest supplies only the
 * section/wrapper IDs, label, text-input kind and placeholder used below; it
 * does not supply a full DOM capture, widget implementation or select options.
 * The later dom-inner-rowc capture establishes wrapper > .ant-form-item as
 * the default structural simulation; alternate layouts remain synthetic.
 * These tests harden an existing custom-answer route and claim no live support.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const PAGE = 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';
const WRAPPER = '11_51414234_0';
const SECTION = '个人基本信息必填';
const QUESTION = '联系地址';
const ANSWER = '离线虚构路 8 号';
const SOURCES = await Promise.all(['src/core/matcher.js', 'src/content/engine.js'].map(file => readFile(file, 'utf8')));

function profile() {
  return {
    customAnswers: { [QUESTION]: ANSWER },
    customFacts: [{ question: QUESTION, answer: ANSWER, sitePageUrl: PAGE, sectionName: SECTION, rowContext: 'single' }],
    confirmedFields: [`customAnswers.${QUESTION}`]
  };
}

function item({ wrapper = WRAPPER, label = `${QUESTION}*`, input = '<input class="ant-input" type="text" placeholder="请填写联系地址">', topology = 'outside' } = {}) {
  const content = `<div class="ant-form-item-label"><label>${label}</label></div><div class="ant-form-item-control">${topology === 'inside' ? `<span id="${wrapper}">${input}</span>` : input}</div>`;
  const formItem = `<div class="ant-form-item"${topology === 'item' ? ` id="${wrapper}"` : ''}>${content}</div>`;
  return topology === 'outside' ? `<div id="${wrapper}"><div style="position: static;">${formItem}</div></div>` : formItem;
}

function fixture(t, { field = item(), sectionId = '11', heading = SECTION, extraRow = '', extraSection = '', url = `${PAGE}?resumeId=offline-fictional` } = {}) {
  const dom = new JSDOM(`<!doctype html><form id="offline-synthetic-form">
    <section class="form-cell" id="${sectionId}"><div class="tit-wrap"><div class="tit">${heading}</div></div>
      <div class="form-cell-right"><div class="form-cell-inner">${field}</div>${extraRow}</div></section>
    <section class="form-cell" id="12"><div class="tit-wrap"><div class="tit">自我评价必填</div></div></section>
    <section class="form-cell" id="14"><div class="tit-wrap"><div class="tit">教育经历必填</div></div></section>
    ${extraSection}<input id="unrelated" value="preserved offline sentinel">
    <button type="button" id="save">保存</button><button type="submit" id="submit">提交</button><button type="button" id="delete">删除</button>
    </form>`, { url, runScripts: 'dangerously', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const { window } = dom, { document } = window;
  window.Element.prototype.getClientRects = function () { return this.isConnected ? [{}] : []; };
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  const counts = { click: 0, submit: 0, input: 0, change: 0, blur: 0 };
  document.addEventListener('click', () => counts.click++);
  document.addEventListener('submit', event => { counts.submit++; event.preventDefault(); });
  const target = document.querySelector(`[id="${WRAPPER}"] input, [id="${WRAPPER}"] textarea, [id="${WRAPPER}"] select`) || document.querySelector('.form-cell input,.form-cell textarea,.form-cell select');
  if (target) for (const type of ['input', 'change', 'blur']) target.addEventListener(type, () => counts[type]++);
  const listeners = new Set();
  let onBindingCheck = async () => {};
  let checks = 0;
  window.chrome = { runtime: {
    id: 'offline-cms-row-c',
    sendMessage: async message => {
      assert.equal(message.type, 'RESUME_PROFILE_BINDING_CHECK');
      await onBindingCheck(++checks);
      return { allowed: true };
    },
    onMessage: {
      addListener: listener => listeners.add(listener), removeListener: listener => listeners.delete(listener),
      hasListener: listener => listeners.has(listener), hasListeners: () => listeners.size > 0
    }
  } };
  window.ResumeCmsSession = { check: async () => ({ authenticated: true }) };
  SOURCES.forEach(source => window.eval(source));
  const message = (type, value = profile()) => new Promise(resolve => window.__resumeQuickFillEngineListener(
    { type, profile: value, profileBinding: { fixture: true } }, { id: window.chrome.runtime.id }, resolve
  ));
  const safety = () => {
    assert.equal(counts.click, 0);
    assert.equal(counts.submit, 0);
    assert.equal(document.getElementById('unrelated').value, 'preserved offline sentinel');
    assert.equal(window.ResumeProfileWriteContext, undefined);
  };
  return { window, document, target, counts, message, safety, setBindingHook: hook => { onBindingCheck = hook; } };
}

const guardedAddressIds = new Set(['offline-address-first', 'offline-address-second']);
const addressFields = result => result.data.fields.filter(field => guardedAddressIds.has(field.id)
  || field.labels.some(label => label.startsWith(QUESTION) || label === '请填写联系地址'));

test('confirmed empty harvested address uses the existing guarded native write without clicks', async t => {
  const h = fixture(t);
  const wrapper = h.document.getElementById(WRAPPER);
  assert.equal(wrapper.closest('.ant-form-item'), null);
  assert.equal(wrapper.querySelector('.ant-form-item').contains(h.target), true);
  const inspected = await h.message('RESUME_INSPECT');
  assert.equal(addressFields(inspected)[0].reason, 'ready');
  assert.equal(addressFields(inspected)[0].kind, 'input');
  assert.equal(addressFields(inspected)[0].path, `customAnswers.${QUESTION}`);
  const result = await h.message('RESUME_FILL');
  assert.equal(result.ok, true);
  assert.equal(h.target.value, ANSWER);
  assert.equal(addressFields(result)[0].status, 'verified');
  assert.equal(addressFields(result)[0].reason, 'readback_matched');
  assert.deepEqual(h.counts, { click: 0, submit: 0, input: 1, change: 1, blur: 1 });
  assert.equal(result.data.softwareClickedSubmit, false);
  h.safety();
});

for (const topology of ['item', 'inside']) test(`wrapper metadata does not invent ${topology} topology restrictions`, async t => {
  const h = fixture(t, { field: item({ topology }) });
  const result = await h.message('RESUME_FILL');
  assert.equal(addressFields(result)[0].status, 'verified');
  assert.equal(h.target.value, ANSWER);
  h.safety();
});

test('unharvested input CSS classes are not required for the address binding', async t => {
  const h = fixture(t, { field: item({ input: '<input type="text" placeholder="请填写联系地址">' }) });
  const result = await h.message('RESUME_FILL');
  assert.equal(addressFields(result)[0].status, 'verified');
  assert.equal(h.target.value, ANSWER);
  h.safety();
});

for (const [value, status, reason] of [
  ['already occupied fictional address', 'skipped', 'existing_value'],
  [ANSWER, 'verified', 'preexisting_same_value']
]) test(`occupied address is preserved: ${reason}`, async t => {
  const h = fixture(t);
  h.target.value = value;
  const result = await h.message('RESUME_FILL');
  assert.equal(h.target.value, value);
  assert.equal(addressFields(result)[0].status, status);
  assert.equal(addressFields(result)[0].reason, reason);
  assert.equal(h.counts.input + h.counts.change + h.counts.blur, 0);
  h.safety();
});

for (const [name, options, reason] of [
  ['wrong wrapper', { field: item({ wrapper: '11_51414234_1' }) }, 'field_changed'],
  ['wrong section ID', { sectionId: '110' }, 'question_scope_mismatch'],
  ['wrong section heading', { heading: '求职意向必填' }, 'question_scope_mismatch'],
  ['wrong input type', { field: item({ input: '<input class="ant-input" type="number" placeholder="请填写联系地址">' }) }, 'custom_control_not_supported'],
  ['wrong placeholder', { field: item({ input: '<input class="ant-input" type="text" placeholder="changed">' }) }, 'custom_control_not_supported'],
  ['textarea drift', { field: item({ input: '<textarea class="ant-input" placeholder="请填写联系地址"></textarea>' }) }, 'custom_control_not_supported'],
  ['calendar drift', { field: item({ input: '<span class="ant-calendar-picker"><input class="ant-input" placeholder="请填写联系地址"></span>' }) }, 'custom_control_not_supported'],
  ['select display drift', { field: item({ input: '<div class="ant-select"><input class="ant-input" placeholder="请填写联系地址"></div>' }) }, 'custom_control_not_supported'],
  ['multiple inputs', { field: item({ input: '<input id="offline-address-first" class="ant-input" placeholder="请填写联系地址"><input id="offline-address-second" class="ant-input" placeholder="请填写联系地址">' }) }, 'custom_control_not_supported'],
  ['duplicate question', { field: item() + item({ wrapper: '11_duplicate_0' }) }, 'duplicate_target'],
  ['duplicate wrapper', { field: item() + '<div id="11_51414234_0"></div>' }, 'duplicate_target'],
  ['multiple rows', { extraRow: '<div class="form-cell-inner"></div>' }, 'ambiguous_repeat_group'],
  ['duplicate section', { extraSection: '<section class="form-cell" id="11"><div class="tit-wrap"><div class="tit">个人基本信息必填</div></div></section>' }, 'question_scope_mismatch'],
  ['duplicate non-section ID', { extraSection: '<div id="11"></div>' }, 'question_scope_mismatch']
]) test(`harvest gate closes on ${name}, including the generic custom-answer fallback`, async t => {
  const h = fixture(t, options);
  const result = await h.message('RESUME_FILL');
  assert.equal(result.ok, true);
  const fields = addressFields(result);
  assert.ok(fields.length > 0);
  assert.ok(fields.every(field => field.status !== 'verified'));
  assert.ok(fields.some(field => field.reason === reason), JSON.stringify(fields));
  assert.equal(h.target.value, '');
  assert.equal(h.counts.input + h.counts.change + h.counts.blur, 0);
  h.safety();
});

for (const [name, change, reason] of [
  ['global profile guess', value => { delete value.customFacts; delete value.customAnswers; value.address = ANSWER; value.confirmedFields = ['address']; }, 'missing_profile_value'],
  ['missing customAnswers mirror', value => { delete value.customAnswers; }, 'missing_profile_value'],
  ['unconfirmed source', value => { value.confirmedFields = []; }, 'unconfirmed_profile_value'],
  ['mismatched source mirror', value => { value.customAnswers[QUESTION] = 'different fictional address'; }, 'question_scope_mismatch'],
  ['missing scope', value => { delete value.customFacts[0].sectionName; }, 'question_scope_unconfirmed'],
  ['wrong source page', value => { value.customFacts[0].sitePageUrl = 'https://example.test/offline'; }, 'question_scope_mismatch'],
  ['wrong source section', value => { value.customFacts[0].sectionName = '求职意向必填'; }, 'question_scope_mismatch'],
  ['wrong source row', value => { value.customFacts[0].rowContext = 'none'; }, 'question_scope_mismatch'],
  ['duplicate source fact', value => { value.customFacts.push({ ...value.customFacts[0] }); }, 'ambiguous_profile_fact']
]) test(`address requires exact scoped confirmed custom source: ${name}`, async t => {
  const h = fixture(t), value = profile();
  change(value);
  const result = await h.message('RESUME_FILL', value);
  assert.equal(addressFields(result)[0].reason, reason);
  assert.equal(h.target.value, '');
  assert.equal(h.counts.input + h.counts.change + h.counts.blur, 0);
  h.safety();
});

test('the confirmed source cannot cross tenant URLs', async t => {
  const h = fixture(t, { url: 'https://wecruit.hotjob.cn/SUoffline/pb/resumeOperation.html' });
  const result = await h.message('RESUME_FILL');
  assert.equal(addressFields(result)[0].reason, 'question_scope_mismatch');
  assert.equal(h.target.value, '');
  h.safety();
});

for (const [name, mutate, reason] of [
  ['wrapper', h => { h.document.getElementById(WRAPPER).id = '11_drift_0'; }, 'field_changed'],
  ['section', h => { h.document.querySelector('.form-cell').id = 'changed'; }, 'question_scope_mismatch'],
  ['widget', h => { h.target.parentElement.classList.add('ant-select'); }, 'custom_control_not_supported'],
  ['hidden wrapper', h => { h.document.getElementById(WRAPPER).hidden = true; }, 'custom_control_not_supported'],
  ['hidden label', h => { h.document.querySelector('.ant-form-item-label').style.display = 'none'; }, 'custom_control_not_supported'],
  ['hidden row', h => { h.target.closest('.form-cell-inner').style.display = 'none'; }, 'custom_control_not_supported'],
  ['disabled fieldset', h => { const fieldset = h.document.createElement('fieldset'); fieldset.disabled = true; h.target.before(fieldset); fieldset.append(h.target); }, 'custom_control_not_supported'],
  ['duplicate', h => { h.target.closest('.form-cell-inner').insertAdjacentHTML('beforeend', item({ wrapper: '11_duplicate_0' })); }, 'duplicate_target'],
  ['native edit', h => { h.target.value = 'native offline edit'; }, 'existing_value'],
  ['source confirmation', (_h, value) => { value.confirmedFields = []; }, 'unconfirmed_profile_value'],
  ['page query', h => { h.window.history.replaceState(null, '', '?resumeId=changed-offline'); }, 'field_changed'],
  ['form identity', h => {
    const original = h.document.querySelector('form'), replacement = h.document.createElement('form');
    original.before(replacement);
    for (const child of [...original.children]) replacement.append(child);
  }, 'field_changed']
]) test(`pre-write binding recheck closes delayed ${name} drift before any text mutation`, async t => {
  const h = fixture(t), value = profile();
  h.setBindingHook(async check => { if (check === 3) mutate(h, value); });
  const result = await h.message('RESUME_FILL', value);
  assert.equal(result.ok, true);
  assert.ok(addressFields(result).some(field => field.status === 'failed' && field.reason === reason), JSON.stringify(result));
  assert.equal(h.target.value, name === 'native edit' ? 'native offline edit' : '');
  assert.equal(h.counts.input + h.counts.change + h.counts.blur, 0);
  h.safety();
});

test('binding drift after input stops further events and prevents verified readback', async t => {
  const h = fixture(t);
  h.target.addEventListener('input', () => { h.document.getElementById(WRAPPER).id = '11_drift_0'; });
  const result = await h.message('RESUME_FILL');
  assert.equal(addressFields(result)[0].status, 'failed');
  assert.equal(addressFields(result)[0].reason, 'field_changed');
  assert.equal(h.counts.input, 1);
  assert.equal(h.counts.change + h.counts.blur, 0);
  h.safety();
});

test('existing height and identity-number mappings remain available alongside the stricter address route', async t => {
  const h = fixture(t, { field: item() + item({ wrapper: '11_247_0', label: '身高*?', input: '<input class="ant-input" placeholder="（单位：cm）">' })
    + item({ wrapper: '11_29_0', label: '证件号码*', input: '<input class="ant-input" placeholder="请填写证件号码">' }) });
  const value = { ...profile(), height: '170', identityNumber: 'OFFLINE-FICTIONAL-ID', confirmedFields: [...profile().confirmedFields, 'height', 'identityNumber'] };
  const inspected = await h.message('RESUME_INSPECT', value);
  for (const key of ['height', 'identityNumber']) assert.equal(inspected.data.fields.find(field => field.path === key)?.reason, 'ready');
  h.safety();
});

test('a changed address label cannot fall through to a confirmed general profile fact', async t => {
  const h = fixture(t, { field: item({ label: '姓名*' }) });
  const value = { ...profile(), fullName: '离线虚构人', confirmedFields: [...profile().confirmedFields, 'fullName'] };
  const result = await h.message('RESUME_FILL', value);
  const field = result.data.fields.find(field => field.labels.includes('姓名*'));
  assert.equal(field.reason, 'field_changed');
  assert.equal(h.target.value, '');
  assert.equal(h.counts.input + h.counts.change + h.counts.blur, 0);
  h.safety();
});

test('renamed wrapper plus ambiguous Ant labels cannot bypass the address gate through aria-label', async t => {
  const field = item({ wrapper: '11_changed_0', input: '<input aria-label="联系地址" placeholder="请填写联系地址">' })
    .replace('<label>联系地址*</label>', '<label>联系地址*</label><label>duplicate fictional label</label>');
  const h = fixture(t, { field });
  const result = await h.message('RESUME_FILL');
  assert.equal(addressFields(result)[0].reason, 'field_changed');
  assert.equal(addressFields(result)[0].status, 'skipped');
  assert.equal(h.target.value, '');
  assert.equal(h.counts.input + h.counts.change + h.counts.blur, 0);
  h.safety();
});

test('renamed wrapper plus changed label cannot bypass the harvested address placeholder through fullName', async t => {
  const h = fixture(t, { field: item({ wrapper: '11_changed_0', label: '姓名*' }) });
  const value = { ...profile(), fullName: '离线虚构人', confirmedFields: [...profile().confirmedFields, 'fullName'] };
  const result = await h.message('RESUME_FILL', value);
  const field = result.data.fields.find(field => field.labels.includes('姓名*'));
  assert.equal(field.reason, 'field_changed');
  assert.equal(field.status, 'skipped');
  assert.equal(h.target.value, '');
  assert.equal(h.counts.input + h.counts.change + h.counts.blur, 0);
  h.safety();
});

test('a stale revision-6 listener is replaced so reinjection installs the address guards', t => {
  const h = fixture(t), stale = h.window.__resumeQuickFillEngineListener;
  h.window.__resumeQuickFillEngineRevision = 6;
  h.window.eval(SOURCES[1]);
  assert.notEqual(h.window.__resumeQuickFillEngineListener, stale);
  assert.equal(h.window.__resumeQuickFillEngineRevision, 26);
  assert.equal(h.window.chrome.runtime.onMessage.hasListener(stale), false);
  assert.equal(h.window.chrome.runtime.onMessage.hasListener(h.window.__resumeQuickFillEngineListener), true);
  h.safety();
});

test('a pending revision-6 fill refuses reinjection before replacing its listener', t => {
  const h = fixture(t), stale = h.window.__resumeQuickFillEngineListener;
  h.window.__resumeQuickFillEngineRevision = 6;
  h.window.__resumeQuickFillFillState.pending = true;
  assert.throws(() => h.window.eval(SOURCES[1]), /profile_write_context_busy/);
  assert.equal(h.window.__resumeQuickFillEngineListener, stale);
  assert.equal(h.window.chrome.runtime.onMessage.hasListener(stale), true);
  h.safety();
});
