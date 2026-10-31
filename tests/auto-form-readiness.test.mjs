import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { requireCdpAutoFormReady } from '../scripts/lib/ats-extension-harness.mjs';

const source = readFileSync(new URL('../src/content/controls/resume-form.js', import.meta.url), 'utf8');
function cdp(formReadiness, { failInjection = false, exception = false } = {}) {
  const commands = [];
  return {
    commands,
    send: async (method, params) => {
      commands.push({ method, ...params });
      if (commands.length === 1) {
        assert.equal(params.expression, source);
        if (failInjection) throw Error('synthetic_transport_failure');
        return exception ? { exceptionDetails: { text: 'synthetic_injection_failure' } } : { result: {} };
      }
      assert.match(params.expression, /ResumeFormFlow\?\.readiness\?\.inspect\(\)/);
      return { result: { value: formReadiness } };
    }
  };
}

test('direct CDP readiness performs read-only source/inspection calls', async () => {
  const readiness = { status: 'ready', reason: 'visible_editable_form' };
  const h = cdp(readiness);
  assert.deepEqual(await requireCdpAutoFormReady(h.send), { ...readiness, advisory: false, blocking: false, advisoryHints: [] });
  assert.equal(h.commands.length, 2);
  assert.ok(h.commands.every(command => command.method === 'Runtime.evaluate' && command.returnByValue === true));
  assert.doesNotMatch(h.commands[1].expression, /fillBasic|fillSelect|\.click\(|dispatchEvent/);
});

for (const readiness of [
  { status: 'login_required', reason: 'visible_login_wall' },
  { status: 'form_not_ready', reason: 'form_loading' },
  { status: 'manual', reason: 'iframe_or_captcha_manual' },
  { status: 'wrong_page', reason: 'wrong_page' },
  { status: 'page_invalid', reason: 'page_invalid' },
  { status: 'form_unrecognized', reason: 'form_unrecognized' }
]) {
  test(`direct CDP auto preserves ${readiness.status} as a hint and continues`, async () => {
    const h = cdp(readiness);
    let writes = 0;
    const result = await requireCdpAutoFormReady(h.send);
    writes += 1; // Synthetic continuation; this harness itself only reads.
    assert.equal(result.status, readiness.status);
    assert.equal(result.reason, readiness.reason);
    assert.equal(result.advisory, true);
    assert.equal(result.blocking, false);
    assert.deepEqual(result.advisoryHints, [{ ...readiness, advisory: true, blocking: false }]);
    assert.equal(writes, 1);
    assert.equal(h.commands.length, 2);
  });
}

for (const [label, value, options, count] of [
  ['missing API', undefined, {}, 2],
  ['malformed result', { ok: true }, {}, 2],
  ['injection transport failure', undefined, { failInjection: true }, 1],
  ['injection exception', undefined, { exception: true }, 1]
]) {
  test(`direct CDP auto reports ${label} as an unavailable advisory`, async () => {
    const h = cdp(value, options);
    const result = await requireCdpAutoFormReady(h.send);
    assert.equal(result.reason, 'form_readiness_unavailable');
    assert.equal(result.status, 'manual');
    assert.equal(result.blocking, false);
    assert.equal(result.advisoryHints.length, 1);
    assert.equal(result.writeAttempted, false);
    assert.equal(result.saveAttempted, false);
    assert.equal(result.liveSupportClaimed, false);
    assert.equal(h.commands.length, count);
  });
}
