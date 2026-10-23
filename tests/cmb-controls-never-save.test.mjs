/**
 * Existing CMB fixture controls only. Option markup and radio groups are synthetic;
 * live evidence supplies ids/dictionaries, not a full portal dropdown contract.
 * A fill succeeds only after the fixture/page accepts its click. Never Save.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const fixture = readFileSync('tests/fixtures/cmb-basic-form.html', 'utf8');
const source = readFileSync('src/content/cmb-basic.js', 'utf8');
const synthetic = { synthetic: true };

function page(t, url = 'http://127.0.0.1/cmb-basic-form.html') {
  const dom = new JSDOM(fixture, { url, runScripts: 'dangerously' });
  t.after(() => dom.window.close());
  const { document } = dom.window;
  let actionClicks = 0;
  let optionClicks = 0;
  document.addEventListener('click', (event) => {
    const action = event.target.closest('button,a,input,[role="button"]');
    if (action && /保存|提交|删除|投递|下一步|save|submit|delete|deliver|next/iu.test(
      `${action.textContent || ''} ${action.value || ''} ${action.getAttribute('aria-label') || ''}`
    )) actionClicks += 1;
    if (event.target.closest('[role="option"]')) optionClicks += 1;
  }, true);
  dom.window.eval(source);
  const untouched = () => [...document.querySelectorAll('input:not([type="radio"])')]
    .map((node) => [node.id, node.name, node.value]);
  const baseline = JSON.stringify(untouched());
  return {
    window: dom.window,
    document,
    api: dom.window.ResumeCmbBasic,
    root: (id) => document.getElementById(id),
    counts: () => ({ actionClicks, optionClicks }),
    verify(result) {
      assert.equal(result.saved, false);
      assert.equal(result.skippedSave, true);
      assert.equal(result.supported, false);
      assert.equal(result.liveSupportClaimed, false);
      assert.equal(actionClicks, 0);
      assert.equal(document.getElementById('save-btn').disabled, true);
      assert.equal(JSON.stringify(untouched()), baseline);
    }
  };
}

const selects = [
  ['fillMaritalStatus', 'resume_basicInfo_maritalStatus', 'MS002'],
  ['fillPolitics', 'resume_basicInfo_politicalAffinity', 'PA0013'],
  ['fillEthnicity', 'resume_basicInfo_nation', 'NA0018'],
  ['fillIdCardType', 'resume_basicInfo_idCardType', 'ID0011'],
  ['fillEducationLevel', 'resume_educationHistoryList_0_educationLevelCode', 'ED004'],
  ['fillRelationshipType', 'resume_familyList_0_relationship', 'RT0002'],
  ['fillRelationshipTypeRow1', 'resume_familyList_1_relationship', 'RT0003'],
  ['fillAwardLevel', 'resume_awardList_0_awardLevel', 'AL005'],
  ['fillEnglishLevel', 'resume_skill_0_englishLevel', 'EL006'],
  ['fillChannelType', 'resume_basicInfo_channelType', 'CT002'],
  ['fillInterviewCity', 'resume_basicInfo_expectedInterviewCity', 'P00291']
];

for (const [method, id, code] of selects) {
  test(`${method} reads accepted fixture state and isolates other controls`, async (t) => {
    const p = page(t);
    const result = await p.api[method](code, synthetic);
    assert.equal(result.ok, true);
    assert.equal(result.afterCode, code);
    assert.equal(result.writeAttempted, true);
    assert.equal(p.root(id).querySelector('.ant-select-selection-item').getAttribute('data-code'), code);
    assert.equal(p.counts().optionClicks, 1);
    for (const [, otherId] of selects.filter((row) => row[1] !== id)) {
      assert.equal(p.root(otherId).querySelector('.ant-select-selection-item').textContent, '');
    }
    p.verify(result);
    const repeated = await p.api[method](code, synthetic);
    assert.equal(repeated.ok, true);
    assert.equal(repeated.writeAttempted, false);
    assert.equal(p.counts().optionClicks, 1);
    p.verify(repeated);
  });
}

test('an option click without an accepting handler cannot manufacture success', async (t) => {
  const p = page(t);
  p.document.removeEventListener('click', p.window.__cmbSyntheticSelectClick);
  const result = await p.api.fillMaritalStatus('MS002', synthetic);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'readback_mismatch');
  assert.equal(result.after, '');
  assert.equal(p.root('resume_basicInfo_maritalStatus').querySelector('[aria-selected="true"]'), null);
  assert.equal(p.counts().optionClicks, 1);
  p.verify(result);
});

test('contradictory select readback fails before clicking or repairing state', async (t) => {
  const p = page(t);
  const root = p.root('resume_basicInfo_maritalStatus');
  const shown = root.querySelector('.ant-select-selection-item');
  shown.textContent = '已婚';
  shown.setAttribute('data-code', 'MS002');
  const before = root.outerHTML;
  const result = await p.api.fillMaritalStatus('MS001', synthetic);
  assert.equal(result.reason, 'select_readback_ambiguous');
  assert.equal(result.writeAttempted, false);
  assert.equal(root.outerHTML, before);
  assert.equal(p.counts().optionClicks, 0);
  p.verify(result);
});

test('readback inspects the current select after a handler rerenders the form item', async (t) => {
  const p = page(t);
  const oldRoot = p.root('resume_basicInfo_maritalStatus');
  const item = oldRoot.closest('.ant-form-item');
  oldRoot.querySelector('[data-code="MS002"]').addEventListener('click', () => {
    item.replaceWith(item.cloneNode(true));
  });
  const result = await p.api.fillMaritalStatus('MS002', synthetic);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'readback_mismatch');
  assert.equal(oldRoot.querySelector('.ant-select-selection-item').getAttribute('data-code'), 'MS002');
  assert.equal(p.root('resume_basicInfo_maritalStatus').querySelector('.ant-select-selection-item').textContent, '');
  p.verify(result);
});

test('a missing requested option in the existing education subset fails without throwing', async (t) => {
  const p = page(t);
  const result = await p.api.fillEducationLevel('ED000', synthetic);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'option_not_found');
  assert.equal(result.writeAttempted, false);
  assert.equal(p.counts().optionClicks, 0);
  p.verify(result);
});

for (const [name, mutate] of [
  ['disabled root', (root) => root.setAttribute('aria-disabled', 'true')],
  ['disabled option', (root) => root.querySelector('[data-code="MS002"]').setAttribute('aria-disabled', 'true')],
  ['hidden option', (root) => { root.querySelector('[data-code="MS002"]').hidden = true; }],
  ['hidden ancestor', (root) => { root.parentElement.style.display = 'none'; }],
  ['disabled fieldset', (root, document) => {
    const fieldset = document.createElement('fieldset');
    fieldset.disabled = true;
    root.parentElement.insertBefore(fieldset, root);
    fieldset.appendChild(root);
  }]
]) {
  test(`${name} prevents any select click`, async (t) => {
    const p = page(t);
    mutate(p.root('resume_basicInfo_maritalStatus'), p.document);
    const result = await p.api.fillMaritalStatus('MS002', synthetic);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'select_disabled');
    assert.equal(result.writeAttempted, false);
    assert.equal(p.counts().optionClicks, 0);
    p.verify(result);
  });
}

for (const name of ['duplicate item', 'duplicate root', 'duplicate list', 'duplicate id']) {
  test(`${name} fails closed without selecting a neighboring control`, async (t) => {
    const p = page(t);
    const root = p.root('resume_basicInfo_maritalStatus');
    if (name === 'duplicate item') root.closest('.ant-form-item').after(root.closest('.ant-form-item').cloneNode(true));
    if (name === 'duplicate root') root.after(root.cloneNode(true));
    if (name === 'duplicate list') root.appendChild(root.querySelector('[role="listbox"]').cloneNode(true));
    if (name === 'duplicate id') p.document.body.appendChild(root.cloneNode(true));
    const result = await p.api.fillMaritalStatus('MS002', synthetic);
    assert.equal(result.ok, false);
    assert.equal(result.reason, name === 'duplicate item' ? 'item_ambiguous' : 'select_structure_changed');
    assert.equal(result.writeAttempted, false);
    assert.equal(p.counts().optionClicks, 0);
    p.verify(result);
  });
}

test('preexisting or newly written search text is never treated as a committed selection', async (t) => {
  const p = page(t);
  const root = p.root('resume_basicInfo_nation');
  const search = root.querySelector('input');
  search.value = 'uncommitted search';
  const before = root.outerHTML;
  const first = await p.api.fillEthnicity('NA0018', synthetic);
  assert.equal(first.reason, 'search_input_written');
  assert.equal(first.writeAttempted, false);
  assert.equal(root.outerHTML, before);
  assert.equal(p.counts().optionClicks, 0);
  search.value = '';
  root.querySelector('[data-code="NA0018"]').addEventListener('click', () => { search.value = 'not accepted'; });
  const second = await p.api.fillEthnicity('NA0018', synthetic);
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'search_input_written');
  assert.equal(second.writeAttempted, true);
  search.value = '';
  p.verify(second);
});

for (const action of ['保存', '提交', '删除', '投递', '下一步', 'Next']) {
  test(`${action} ancestor cannot receive a select click`, async (t) => {
    const p = page(t);
    const option = p.root('resume_basicInfo_maritalStatus').querySelector('[data-code="MS002"]');
    const button = p.document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', action);
    option.before(button);
    button.appendChild(option);
    const result = await p.api.fillMaritalStatus('MS002', synthetic);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'unsafe_control');
    assert.equal(result.writeAttempted, false);
    assert.equal(p.counts().optionClicks, 0);
    p.verify(result);
  });
}

test('an external forbidden button cannot receive a select option label default action', async (t) => {
  const p = page(t);
  const option = p.root('resume_basicInfo_maritalStatus').querySelector('[data-code="MS002"]');
  const button = p.document.createElement('button');
  button.id = 'forbidden-label-target';
  button.type = 'button';
  button.setAttribute('aria-label', '保存');
  p.document.body.appendChild(button);
  const label = p.document.createElement('label');
  label.htmlFor = button.id;
  option.before(label);
  label.appendChild(option);
  const result = await p.api.fillMaritalStatus('MS002', synthetic);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'unsafe_control');
  assert.equal(result.writeAttempted, false);
  assert.equal(p.counts().optionClicks, 0);
  p.verify(result);
});

for (const [method, label, value] of [
  ['fillGender', '性别', '男'], ['fillFormalWork', '是否参加过正式工作', '是']
]) {
  test(`${method} cannot activate a forbidden label target changed during the click`, async (t) => {
    const p = page(t);
    const wrap = p.document.querySelector(`[data-field="${label}"] .ant-radio-wrapper`);
    const save = p.document.getElementById('save-btn');
    save.disabled = false;
    let forbidden = 0;
    save.addEventListener('click', () => { forbidden += 1; });
    wrap.addEventListener('click', () => { wrap.htmlFor = 'save-btn'; });
    const result = await p.api[method](value, synthetic);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'radio_structure_changed');
    assert.equal(result.writeAttempted, true);
    assert.equal(forbidden, 0);
    save.disabled = true;
    p.verify(result);
  });

  test(`${method} cannot activate a forbidden button associated with the radio label`, async (t) => {
    const p = page(t);
    const item = p.document.querySelector(`[data-field="${label}"]`);
    const button = p.document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', '保存');
    item.querySelector('.ant-radio-wrapper').prepend(button);
    const result = await p.api[method](value, synthetic);
    assert.equal(result.reason, 'radio_structure_changed');
    assert.equal(result.writeAttempted, false);
    p.verify(result);
  });

  test(`${method} rejects native values that disagree with the existing option label`, async (t) => {
    const p = page(t);
    const item = p.document.querySelector(`[data-field="${label}"]`);
    item.querySelector('input').value = 'different native value';
    let clicks = 0;
    item.addEventListener('click', () => { clicks += 1; });
    const result = await p.api[method](value, synthetic);
    assert.equal(result.reason, 'radio_structure_changed');
    assert.equal(result.writeAttempted, false);
    assert.equal(clicks, 0);
    p.verify(result);
  });

  test(`${method} rejects a native radio group shared with the existing neighboring field`, async (t) => {
    const p = page(t);
    const item = p.document.querySelector(`[data-field="${label}"]`);
    const neighborLabel = label === '性别' ? '是否参加过正式工作' : '性别';
    const neighbor = p.document.querySelector(`[data-field="${neighborLabel}"]`);
    const group = item.querySelector('input').name;
    for (const input of neighbor.querySelectorAll('input')) input.name = group;
    const neighborValue = neighbor.querySelector('input');
    neighborValue.checked = true;
    let clicks = 0;
    item.addEventListener('click', () => { clicks += 1; });
    const result = await p.api[method](value, synthetic);
    assert.equal(result.reason, 'radio_structure_changed');
    assert.equal(result.writeAttempted, false);
    assert.equal(neighborValue.checked, true);
    assert.equal(clicks, 0);
    p.verify(result);
  });

  test(`${method} refuses ambiguous preexisting radio state without any input events`, async (t) => {
    const p = page(t);
    const item = p.document.querySelector(`[data-field="${label}"]`);
    const inputs = [...item.querySelectorAll('input')];
    for (const input of inputs) { input.removeAttribute('name'); input.checked = true; }
    let interactions = 0;
    for (const event of ['click', 'input', 'change']) item.addEventListener(event, () => { interactions += 1; });
    const result = await p.api[method](value, synthetic);
    assert.equal(result.reason, 'radio_readback_ambiguous');
    assert.equal(result.writeAttempted, false);
    assert.equal(interactions, 0);
    assert.ok(inputs.every((input) => input.checked));
    p.verify(result);
  });

  test(`${method} checks every option and distinguishes duplicate item labels`, async (t) => {
    const p = page(t);
    const item = p.document.querySelector(`[data-field="${label}"]`);
    const extra = item.querySelector('.ant-radio-wrapper').cloneNode(true);
    extra.lastElementChild.textContent = 'unknown';
    item.querySelector('.ant-form-item-control').appendChild(extra);
    let result = await p.api[method](value, synthetic);
    assert.equal(result.reason, 'radio_structure_changed');
    assert.equal(result.writeAttempted, false);
    p.verify(result);
    extra.remove();
    item.after(item.cloneNode(true));
    result = await p.api[method](value, synthetic);
    assert.equal(result.reason, 'item_ambiguous');
    assert.equal(result.writeAttempted, false);
    p.verify(result);
  });

  test(`${method} accepts the native radio action without a second click or fabricated events`, async (t) => {
    const p = page(t);
    const item = p.document.querySelector(`[data-field="${label}"]`);
    let nativeChanges = 0;
    item.addEventListener('change', () => { nativeChanges += 1; });
    const result = await p.api[method](value, synthetic);
    assert.equal(result.ok, true);
    assert.equal(nativeChanges, 1);
    assert.equal(result.writeAttempted, true);
    const repeated = await p.api[method](value, synthetic);
    assert.equal(repeated.writeAttempted, false);
    assert.equal(nativeChanges, 1);
    p.verify(result);
    p.verify(repeated);
  });
}
