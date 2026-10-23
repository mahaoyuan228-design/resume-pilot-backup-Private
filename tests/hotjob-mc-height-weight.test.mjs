/**
 * Narrow hotjob-mc 身高/体重 text slice, using the 2026-10-18 probe contract.
 * Offline only: 待真机 Never-Save，未宣称已支持.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { planHotjobMcNeverSave } from '../src/content/hotjob-mc-profile-map.mjs';

const root = resolve('.');
const source = readFileSync(resolve(root, 'src/content/hotjob-mc-basic.js'), 'utf8');
const fixture = readFileSync(resolve(root, 'tests/fixtures/hotjob-mc-basic-form.html'), 'utf8');
const rawProbe = JSON.parse(readFileSync(resolve(root, 'dist/site-probes/HOTJOB_MC_OPERATIONRESUMER_raw.json'), 'utf8'));
const PAGE = 'http://127.0.0.1/SU661f37091eb8053acd6cdf3d/mc/deliver/operationResumer';
const FIELDS = [
  { label: '身高', key: 'height', id: 'height-row', placeholder: '请填写身高(cm)', value: '172', different: '180' },
  { label: '体重', key: 'weight', id: 'weight-row', placeholder: '请填写体重(kg)', value: '65', different: '70' }
];

function boot(t, { preexisting = false, url = PAGE } = {}) {
  const dom = new JSDOM(fixture, { url, pretendToBeVisual: true, runScripts: 'dangerously' });
  t.after(() => dom.window.close());
  const { window } = dom;
  const { document } = window;
  if (preexisting) {
    const rows = document.getElementById('preexisting-height-weight-rows').content.cloneNode(true);
    for (const field of FIELDS) {
      document.getElementById(field.id).replaceWith(rows.querySelector(
        field.key === 'height' ? '#preexisting-height-row' : '#preexisting-weight-row'
      ));
    }
  }
  window.Element.prototype.getClientRects = function getClientRects() {
    let node = this;
    while (node && node.nodeType === 1) {
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return [];
      node = node.parentElement;
    }
    return [{ x: 0, y: 0, width: 20, height: 20, top: 0, left: 0, bottom: 20, right: 20 }];
  };

  // Observe actual native value assignments as well as emitted input/change/blur.
  // A no-op must produce neither a setter call nor a synthetic paint event.
  const writes = new Map();
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
  Object.defineProperty(window.HTMLInputElement.prototype, 'value', {
    ...descriptor,
    set(value) {
      if (!writes.has(this)) writes.set(this, { setters: 0, input: 0, change: 0, blur: 0 });
      writes.get(this).setters += 1;
      descriptor.set.call(this, value);
    }
  });
  for (const input of document.querySelectorAll('.my-list-item input')) {
    const count = { setters: 0, input: 0, change: 0, blur: 0 };
    writes.set(input, count);
  }
  for (const type of ['input', 'change', 'blur']) {
    document.addEventListener(type, (event) => {
      const control = event.target;
      if (!(control instanceof window.HTMLInputElement)) return;
      if (!writes.has(control)) writes.set(control, { setters: 0, input: 0, change: 0, blur: 0 });
      writes.get(control)[type] += 1;
    }, true);
  }
  const clicks = [];
  document.addEventListener('click', (event) => {
    clicks.push((event.target.textContent || event.target.value || '').trim());
  }, true);
  window.chrome = { runtime: { onMessage: { addListener() {}, removeListener() {} } } };
  vm.runInContext(source, dom.getInternalVMContext());
  return { dom, window, document, api: window.ResumeHotjobMcBasic, writes, clicks };
}

function item(document, label) {
  return [...document.querySelectorAll('.my-list-item')].find((row) =>
    row.querySelector('.header-title')?.textContent.trim() === label
  );
}

function input(document, label) {
  return item(document, label)?.querySelector('.am-input-control input');
}

function snapshot(document) {
  return [...document.querySelectorAll('.my-list-item')].map((row) => ({
    label: row.querySelector('.header-title')?.textContent.trim(),
    inputs: [...row.querySelectorAll('input')].map((control) => control.value),
    select: row.querySelector('.select-am-list-extra')?.textContent.trim() ?? null
  }));
}

function assertNeverSave(result) {
  assert.equal(result.siteId, 'hotjob-mc');
  assert.equal(result.neverSave, true);
  assert.equal(result.saved, false);
  assert.equal(result.skippedSave, true);
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.supportClaimed, false);
  for (const flag of ['softwareClickedSave', 'softwareClickedSubmit', 'softwareClickedDeliver', 'softwareClickedDelete', 'softwareClickedNext']) {
    assert.equal(result[flag], false, flag);
  }
}

function assertNoPaint(state) {
  for (const count of state.writes.values()) {
    assert.deepEqual(count, { setters: 0, input: 0, change: 0, blur: 0 });
  }
  assertNoClicks(state);
}

function assertNoClicks(state) {
  assert.deepEqual(state.clicks, [], 'text slice must not click any control, including picker confirm');
  assert.equal(state.window.__hotjobMcCommitClicks, 0);
  assert.equal(state.window.__hotjobMcForbiddenClicks.length, 0);
  assert.equal(state.document.getElementById('mc-select-popup-wrap').classList.contains('open'), false);
}

function coreValues() {
  return {
    allowExplicitValues: true,
    fullName: '测试甲',
    mobile: '13800138000',
    email: 'height.weight@example.com'
  };
}

test('fixture uses only probed exact 身高/体重 row and input contracts', (t) => {
  const state = boot(t);
  for (const field of FIELDS) {
    assert.ok(rawProbe.probe.placeholders.includes(field.placeholder));
    const row = item(state.document, field.label);
    assert.equal(row.classList.contains('my-list-item'), true);
    assert.equal(row.querySelectorAll('.header-title').length, 1);
    assert.equal(row.querySelectorAll('.am-input-control input').length, 1);
    assert.equal(input(state.document, field.label).getAttribute('placeholder'), field.placeholder);
    assert.equal(input(state.document, field.label).value, '');
    assert.equal(state.document.querySelectorAll('.my-list-item').length, 8, 'inert preexisting rows must not duplicate active labels');
  }
  assertNoPaint(state);
});

test('inspect reports structure_matched for both exact new labels without painting', async (t) => {
  const state = boot(t);
  const before = snapshot(state.document);
  const result = await state.api.inspect({ synthetic: true });
  assertNeverSave(result);
  for (const field of FIELDS) {
    const row = result.fields.find((entry) => entry.label === field.label);
    assert.ok(row, field.label);
    assert.equal(row.found, true);
    assert.equal(row.hasTextControl, true);
    assert.equal(row.ready, true);
    assert.equal(row.reason, 'structure_matched');
    assert.equal(row.placeholder, field.placeholder);
    assert.equal(row.value, '');
  }
  assert.deepEqual(snapshot(state.document), before);
  assertNoPaint(state);
});

for (const field of FIELDS) {
  test(field.label + ': independent empty target paints once and keeps every neighbor untouched', async (t) => {
    const state = boot(t);
    const target = input(state.document, field.label);
    const before = snapshot(state.document);
    const result = await state.api.fillField(field.label, field.value, { synthetic: true });
    assertNeverSave(result);
    assert.equal(result.ok, true);
    assert.equal(result.reason, 'readback_matched');
    assert.equal(result.writeAttempted, true);
    assert.equal(result.before, '');
    assert.equal(result.after, field.value);
    assert.equal(target.value, field.value);
    const count = state.writes.get(target);
    assert.equal(count.setters, 1);
    assert.equal(count.input, 1);
    assert.equal(count.change, 1);
    const after = snapshot(state.document);
    assert.deepEqual(after.filter((row) => row.label !== field.label), before.filter((row) => row.label !== field.label));
    for (const [control, paints] of state.writes) {
      if (control !== target) assert.deepEqual(paints, { setters: 0, input: 0, change: 0, blur: 0 });
    }
    assertNoClicks(state);
  });

  test(field.label + ': preexisting_same_value returns without a paint', async (t) => {
    const state = boot(t, { preexisting: true });
    const before = snapshot(state.document);
    const result = await state.api.fillField(field.label, field.value, { synthetic: true });
    assertNeverSave(result);
    assert.equal(result.ok, true);
    assert.equal(result.reason, 'preexisting_same_value');
    assert.equal(result.writeAttempted, false);
    assert.deepEqual(snapshot(state.document), before);
    assertNoPaint(state);
  });

  test(field.label + ': existing_value is preserved even when force is requested', async (t) => {
    const state = boot(t, { preexisting: true });
    const before = snapshot(state.document);
    const result = await state.api.fillField(field.label, field.different, { synthetic: true, force: true });
    assertNeverSave(result);
    assert.equal(result.ok, true);
    assert.equal(result.reason, 'existing_value');
    assert.equal(result.writeAttempted, false);
    assert.equal(input(state.document, field.label).value, field.value);
    assert.deepEqual(snapshot(state.document), before);
    assertNoPaint(state);
  });

  test(field.label + ': missing profile values return missing_profile_value without painting', async (t) => {
    const state = boot(t);
    const before = snapshot(state.document);
    for (const missing of [undefined, null, '', '   ']) {
      const result = await state.api.fillField(field.label, missing, { synthetic: true });
      assertNeverSave(result);
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'missing_profile_value');
      assert.equal(result.writeAttempted, false);
    }
    assert.deepEqual(snapshot(state.document), before);
    assertNoPaint(state);
  });

  test(field.label + ': placeholder drift fails control_not_supported without painting', async (t) => {
    const state = boot(t);
    const target = input(state.document, field.label);
    const before = snapshot(state.document);
    for (const drift of ['请填写' + field.label, field.placeholder.replace('(', '（').replace(')', '）'), '', field.label === '身高' ? '请填写身高(kg)' : '请填写体重(cm)']) {
      target.setAttribute('placeholder', drift);
      const inspected = await state.api.inspect({ synthetic: true });
      const row = inspected.fields.find((entry) => entry.label === field.label);
      assert.equal(row.ready, false, drift);
      assert.equal(row.reason, 'control_not_supported', drift);
      const result = await state.api.fillField(field.label, field.value, { synthetic: true });
      assertNeverSave(result);
      assert.equal(result.ok, false, drift);
      assert.equal(result.reason, 'control_not_supported', drift);
      assert.equal(result.writeAttempted, false);
    }
    assert.deepEqual(snapshot(state.document), before);
    assertNoPaint(state);
  });

  test(field.label + ': malformed controls and duplicate labels fail closed', async (t) => {
    const mutations = [
      (row) => row.querySelector('.am-input-control input').remove(),
      (row) => { row.querySelector('.am-input-control').className = 'unverified-input-control'; },
      (row) => { row.querySelector('.am-input-control').appendChild(row.querySelector('input').cloneNode()); },
      (row) => { const stray = row.ownerDocument.createElement('input'); row.appendChild(stray); },
      (row) => row.parentElement.appendChild(row.cloneNode(true)),
      ...['number', 'date', 'password', 'range'].map((type) =>
        (row) => { row.querySelector('input').type = type; }
      ),
      (row) => { row.querySelector('input').readOnly = true; },
      (row) => { row.querySelector('input').disabled = true; },
      (row) => {
        const section = row.ownerDocument.createElement('section');
        section.style.display = 'none';
        row.parentElement.insertBefore(section, row);
        section.appendChild(row);
      }
    ];
    for (const mutate of mutations) {
      const state = boot(t);
      mutate(item(state.document, field.label));
      const before = snapshot(state.document);
      const result = await state.api.fillField(field.label, field.value, { synthetic: true });
      assertNeverSave(result);
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'control_not_supported');
      assert.equal(result.writeAttempted, false);
      assert.deepEqual(snapshot(state.document), before);
      assertNoPaint(state);
    }
  });

  test(field.label + ': near labels are never accepted through placeholder fallback', async (t) => {
    const state = boot(t);
    const row = item(state.document, field.label);
    row.querySelector('.header-title').textContent = field.label + '说明';
    const before = snapshot(state.document);
    const result = await state.api.fillField(field.label, field.value, { synthetic: true });
    assertNeverSave(result);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'control_not_supported');
    assert.equal(result.writeAttempted, false);
    assert.deepEqual(snapshot(state.document), before);
    assertNoPaint(state);
  });

  test(field.label + ': post-input control drift can never report readback_matched', async (t) => {
    const state = boot(t);
    const target = input(state.document, field.label);
    const before = snapshot(state.document);
    target.addEventListener('input', () => {
      const replacement = target.cloneNode();
      replacement.setAttribute('placeholder', 'UNVERIFIED_CONTROL');
      target.replaceWith(replacement);
    }, { once: true });
    const result = await state.api.fillField(field.label, field.value, { synthetic: true });
    assertNeverSave(result);
    assert.equal(result.ok, false);
    assert.ok(['control_not_supported', 'readback_mismatch'].includes(result.reason), result.reason);
    assert.notEqual(result.reason, 'readback_matched');
    const after = snapshot(state.document);
    assert.deepEqual(after.filter((row) => row.label !== field.label), before.filter((row) => row.label !== field.label));
    for (const [control, paints] of state.writes) {
      if (control !== target) assert.deepEqual(paints, { setters: 0, input: 0, change: 0, blur: 0 });
    }
    assertNoClicks(state);
  });
}

test('new text operations refuse wrong pages and unapproved labels before any paint', async (t) => {
  const state = boot(t, { url: 'https://example.com/form' });
  for (const label of ['身高', '体重']) {
    const result = await state.api.fillField(label, '172', { synthetic: true });
    assertNeverSave(result);
    assert.equal(result.ok, false);
    assert.equal(result.writeAttempted, false);
  }
  assertNoPaint(state);
});

test('unapproved new-field labels never fall through to a neighboring text input', async (t) => {
  const state = boot(t);
  const before = snapshot(state.document);
  for (const label of ['身高说明', '体重kg', '证件号码', '国籍/地区', '英语等级']) {
    const result = await state.api.fillField(label, '172', { synthetic: true });
    assertNeverSave(result);
    assert.equal(result.ok, false);
    assert.equal(result.writeAttempted, false);
  }
  assert.deepEqual(snapshot(state.document), before);
  assertNoPaint(state);
});

test('optional height/weight join the Never-Save plan and batch without changing select behavior', async (t) => {
  const values = { ...coreValues(), height: '172', weight: '65', gender: '女', idType: '中国护照' };
  const plan = planHotjobMcNeverSave(values);
  assert.equal(plan.ok, true);
  assert.equal(plan.neverSave, true);
  assert.equal(plan.liveSupportClaimed, false);
  assert.equal(plan.supportClaimed, false);
  for (const field of FIELDS) {
    assert.equal(plan.fields.find((row) => row.label === field.label)?.value, field.value);
  }

  const state = boot(t);
  const result = await state.api.fillNeverSave(values, { synthetic: true });
  assertNeverSave(result);
  assert.equal(result.ok, true);
  assert.equal(result.reason, 'readback_matched');
  for (const field of FIELDS) {
    assert.equal(input(state.document, field.label).value, field.value);
    assert.equal(result.results.find((row) => row.label === field.label)?.reason, 'readback_matched');
  }
  assert.equal(input(state.document, '姓名').value, values.fullName);
  assert.equal(input(state.document, '移动电话').value, values.mobile);
  assert.equal(input(state.document, '电子邮箱').value, values.email);
  assert.equal(state.document.getElementById('gender-extra').textContent.trim(), '女');
  assert.equal(state.document.getElementById('idtype-extra').textContent.trim(), '中国护照');
  assert.equal(input(state.document, '证件号码').value, 'NEIGHBOR_KEEP');
  assert.equal(state.window.__hotjobMcCommitClicks, 0);
});

test('legacy core-three fillBasic still restores and leaves new rows untouched', async (t) => {
  const state = boot(t, { preexisting: true });
  const result = await state.api.fillBasic(coreValues(), { synthetic: true });
  assertNeverSave(result);
  assert.equal(result.ok, true);
  assert.equal(result.results.length, 3);
  assert.equal(result.restored, true);
  for (const field of FIELDS) {
    const target = input(state.document, field.label);
    assert.equal(target.value, field.value);
    assert.deepEqual(state.writes.get(target), { setters: 0, input: 0, change: 0, blur: 0 });
  }
  for (const label of ['姓名', '移动电话', '电子邮箱']) assert.equal(input(state.document, label).value, '');
  assert.equal(input(state.document, '证件号码').value, 'NEIGHBOR_KEEP');
  assertNoClicks(state);
});

test('canonical confirmed profile height/weight fill and absent optional fields preserve core behavior', async (t) => {
  const profile = {
    fullName: '测试乙', phone: '13900139000', email: 'profile.hw@example.com',
    height: '172', weight: '65',
    confirmedFields: ['fullName', 'phone', 'email', 'height', 'weight']
  };
  const plan = planHotjobMcNeverSave({ profile });
  assert.equal(plan.ok, true);
  for (const field of FIELDS) {
    assert.equal(plan.fields.find((row) => row.label === field.label)?.path, field.key);
    assert.equal(plan.fields.find((row) => row.label === field.label)?.value, field.value);
  }
  const state = boot(t);
  const result = await state.api.fillNeverSave({ profile }, { synthetic: true });
  assertNeverSave(result);
  assert.equal(result.ok, true);
  for (const field of FIELDS) assert.equal(input(state.document, field.label).value, field.value);
  assertNoClicks(state);

  const absent = boot(t);
  const coreProfile = { fullName: profile.fullName, phone: profile.phone, email: profile.email, confirmedFields: ['fullName', 'phone', 'email'] };
  const coreResult = await absent.api.fillNeverSave({ profile: coreProfile }, { synthetic: true });
  assert.equal(coreResult.ok, true);
  assert.equal(coreResult.results.length, 3);
  for (const field of FIELDS) {
    const target = input(absent.document, field.label);
    assert.equal(target.value, '');
    assert.deepEqual(absent.writes.get(target), { setters: 0, input: 0, change: 0, blur: 0 });
  }
  assertNoClicks(absent);
});

test('missing or unconfirmed optional profile values fail before core or new-field paints', async (t) => {
  for (const field of FIELDS) {
    for (const missing of [undefined, null, '', '   ']) {
      const state = boot(t);
      const values = { ...coreValues(), [field.key]: missing };
      const before = snapshot(state.document);
      const result = await state.api.fillNeverSave(values, { synthetic: true });
      assertNeverSave(result);
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'missing_profile_value');
      assert.equal(result.writeAttempted, false);
      assert.equal(result.results.find((row) => row.label === field.label)?.reason, 'missing_profile_value');
      assert.deepEqual(snapshot(state.document), before);
      assertNoPaint(state);
    }
    const unconfirmed = boot(t);
    const before = snapshot(unconfirmed.document);
    const result = await unconfirmed.api.fillNeverSave({
      profile: {
        fullName: '测试乙', phone: '13900139000', email: 'profile.hw@example.com',
        [field.key]: field.value, confirmedFields: ['fullName', 'phone', 'email']
      }
    }, { synthetic: true });
    assertNeverSave(result);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'profile_fact_unconfirmed');
    assert.equal(result.writeAttempted, false);
    assert.deepEqual(snapshot(unconfirmed.document), before);
    assertNoPaint(unconfirmed);
  }
});

test('Chinese aliases fill both new fields and conflicting aliases fail without paint', async (t) => {
  const state = boot(t);
  const result = await state.api.fillNeverSave({ ...coreValues(), 身高: '172', 体重: '65' }, { synthetic: true });
  assertNeverSave(result);
  assert.equal(result.ok, true);
  for (const field of FIELDS) assert.equal(input(state.document, field.label).value, field.value);
  assertNoClicks(state);
  for (const field of FIELDS) {
    const conflict = boot(t);
    const before = snapshot(conflict.document);
    const blocked = await conflict.api.fillNeverSave({
      ...coreValues(), [field.key]: field.value, [field.label]: field.different
    }, { synthetic: true });
    assertNeverSave(blocked);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.reason, 'field_ambiguous');
    assert.equal(blocked.writeAttempted, false);
    assert.deepEqual(snapshot(conflict.document), before);
    assertNoPaint(conflict);
  }
});

test('malformed confirmedFields never authorize optional profile facts', async (t) => {
  for (const confirmedFields of ['height', { height: true }, null]) {
    const state = boot(t);
    const before = snapshot(state.document);
    const values = {
      profile: {
        fullName: '测试乙', phone: '13900139000', email: 'profile.hw@example.com',
        height: '172', weight: '65', confirmedFields
      }
    };
    const plan = planHotjobMcNeverSave(values);
    assert.equal(plan.ok, false);
    const result = await state.api.fillNeverSave(values, { synthetic: true });
    assertNeverSave(result);
    assert.equal(result.ok, false);
    assert.equal(result.writeAttempted, false);
    assert.deepEqual(snapshot(state.document), before);
    assertNoPaint(state);
  }
});

test('batch restore does not repaint occupied optional same or conflicting values', async (t) => {
  const state = boot(t, { preexisting: true });
  const result = await state.api.fillNeverSave({
    ...coreValues(), height: '172', weight: '70'
  }, { synthetic: true, restore: true });
  assertNeverSave(result);
  assert.equal(result.ok, true);
  assert.equal(result.restored, true);
  assert.equal(result.results.find((row) => row.label === '身高')?.reason, 'preexisting_same_value');
  assert.equal(result.results.find((row) => row.label === '体重')?.reason, 'existing_value');
  for (const field of FIELDS) {
    const target = input(state.document, field.label);
    assert.equal(target.value, field.value);
    assert.deepEqual(state.writes.get(target), { setters: 0, input: 0, change: 0, blur: 0 });
    assert.equal(result.restore.some((row) => row.label === field.label), false);
  }
  for (const label of ['姓名', '移动电话', '电子邮箱']) assert.equal(input(state.document, label).value, '');
  assertNoClicks(state);
});

test('rollback preserves an optional value populated by an earlier core input handler', async (t) => {
  const state = boot(t);
  const height = input(state.document, '身高');
  input(state.document, '姓名').addEventListener('input', () => { height.value = '180'; }, { once: true });
  const result = await state.api.fillNeverSave({
    ...coreValues(), height: '172'
  }, { synthetic: true, restore: true });
  assertNeverSave(result);
  assert.equal(result.ok, true);
  assert.equal(result.restored, true);
  const extra = result.results.find((row) => row.label === '身高');
  assert.equal(extra.reason, 'existing_value');
  assert.equal(extra.writeAttempted, false);
  assert.equal(height.value, '180');
  assert.deepEqual(state.writes.get(height), { setters: 1, input: 0, change: 0, blur: 0 }, 'only the fixture input handler may set 身高');
  assert.equal(result.restore.some((row) => row.label === '身高'), false);
  for (const label of ['姓名', '移动电话', '电子邮箱']) assert.equal(input(state.document, label).value, '');
  assert.equal(input(state.document, '体重').value, '');
  assert.equal(input(state.document, '证件号码').value, 'NEIGHBOR_KEEP');
  assertNoClicks(state);
});
