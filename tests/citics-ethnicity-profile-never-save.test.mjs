import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeProfile } from '../src/profile/store.js';
import { assertFlags, bootSelect } from './citics-select-never-save-helpers.mjs';

const LABEL = "民族";
const KEY = 'ethnicity';
const PATH = `customAnswers.${LABEL}`;
const profile = (extra = {}) => ({ customAnswers: { [LABEL]: 'SYN_TARGET' }, confirmedFields: [PATH], ...extra });
const plain = (value) => JSON.parse(JSON.stringify(value));

test(`${LABEL}: confirmed stored exact-label facts and direct snapshots plan without aliases`, () => {
  const h = bootSelect(LABEL);
  try {
    const stored = normalizeProfile(profile());
    assert.equal(stored.customAnswers[LABEL], 'SYN_TARGET');
    assert.equal(h.api.planSelectFromProfile(LABEL, stored).path, PATH);
    const direct = h.api.planSelectFromProfile(LABEL, { [KEY]: ' SYN_TARGET ', confirmedFields: [KEY] });
    assert.equal(direct.ready, true); assert.equal(direct.value, 'SYN_TARGET'); assert.equal(direct.path, KEY);
    const core = { fullName: '陈一', identityNumber: 'SYN_ID', phone: 'SYN_PHONE', email: 's@example.test',
      ...profile(), confirmedFields: ['fullName', 'identityNumber', 'phone', 'email', PATH] };
    const plan = h.api.planFromProfile(core);
    assert.equal(plan.ok, true); assert.equal(plan.values[KEY], 'SYN_TARGET');
    assert.equal(plan.fields.find((row) => row.label === LABEL).path, PATH);
    assert.equal(h.stats.opened, 0);
  } finally { h.dom.window.close(); }
});

test(`${LABEL}: unconfirmed, malformed and conflicting facts do not write`, async () => {
  for (const [input, reason] of [
    [null, 'profile_missing'], [{}, 'missing_profile_value'],
    [profile({ confirmedFields: [] }), 'profile_fact_unconfirmed'],
    [profile({ [KEY]: 'SYN_OTHER', confirmedFields: [KEY, PATH] }), 'profile_value_ambiguous'],
    [profile({ [KEY]: 1 }), 'invalid_profile_value'],
    [profile({ customAnswers: { [LABEL]: {} } }), 'invalid_profile_value'],
    [{ [KEY]: 'SYN_TARGET', confirmedFields: [PATH] }, 'profile_fact_unconfirmed']
  ]) {
    const h = bootSelect(LABEL);
    try {
      const result = await h.api.fillSelectFromProfile(LABEL, input);
      assert.equal(result.reason, reason, JSON.stringify(input));
      assert.equal(result.writeAttempted, false); assertFlags(result); assert.equal(h.stats.opened, 0);
    } finally { h.dom.window.close(); }
  }
});

test(`${LABEL}: a confirmed profile fills only an empty control and skips occupied`, async () => {
  for (const before of ['', 'SYN_OTHER', 'SYN_TARGET']) {
    const h = bootSelect(LABEL, { before });
    try {
      const result = await h.api.fillSelectFromProfile(LABEL, normalizeProfile(profile()));
      assert.equal(result.reason, before === '' ? 'readback_matched' : before === 'SYN_TARGET' ? 'preexisting_same_value' : 'existing_value');
      assert.equal(result.after, before || 'SYN_TARGET'); assert.equal(result.path, PATH);
      assert.equal(h.stats.options, before ? 0 : 1); assertFlags(result);
      assert.equal(h.document.querySelectorAll('input.ant-input')[1].value, 'SYN_ID');
      assert.equal(h.stats.commits, 0);
    } finally { h.dom.window.close(); }
  }
});

test(`${LABEL}: scope conflicts and duplicate questions cannot reuse a global confirmation`, () => {
  const h = bootSelect(LABEL);
  try {
    const fact = { question: LABEL, answer: 'SYN_TARGET', sitePageUrl: 'https://careers.citics.com/my/jl', sectionName: '个人信息', rowContext: 'single' };
    const local = profile({ customFacts: [fact] });
    assert.equal(h.api.planSelectFromProfile(LABEL, normalizeProfile(local)).ready, true);
    for (const override of [
      { sitePageUrl: 'https://example.com/my/jl' }, { sectionName: '其他信息' },
      { rowContext: 'repeat' }, { sitePageUrl: '' }, { sitePageUrl: 'https://user:pass@careers.citics.com/my/jl' }
    ]) {
      const result = h.api.planSelectFromProfile(LABEL, profile({ customFacts: [{ ...fact, ...override }] }));
      assert.equal(result.reason, 'question_scope_mismatch');
    }
    assert.equal(h.api.planSelectFromProfile(LABEL, profile({ customFacts: [fact, fact] })).reason, 'profile_value_ambiguous');
    assert.equal(h.api.planSelectFromProfile(LABEL, profile({ customFacts: [{ ...fact, answer: 'SYN_OTHER' }] })).reason, 'profile_value_ambiguous');
    assert.equal(h.stats.opened, 0);
    assert.deepEqual(plain(h.api.planSelectFromProfile(LABEL, profile())).value, 'SYN_TARGET');
  } finally { h.dom.window.close(); }
});
