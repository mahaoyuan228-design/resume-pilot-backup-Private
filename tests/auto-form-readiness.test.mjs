import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { requireCdpAutoFormReady, autoFormReadinessFailure } from '../scripts/lib/ats-extension-harness.mjs';

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

test('direct CDP auto accepts only ready and performs read-only source/inspection calls', async () => {
  const readiness = { status: 'ready', reason: 'visible_editable_form' };
  const h = cdp(readiness);
  assert.deepEqual(await requireCdpAutoFormReady(h.send), readiness);
  assert.equal(h.commands.length, 2);
  assert.ok(h.commands.every(command => command.method === 'Runtime.evaluate' && command.returnByValue === true));
  assert.doesNotMatch(h.commands[1].expression, /fillBasic|fillSelect|\.click\(|dispatchEvent/);
});

for (const readiness of [
  { status: 'login_required', reason: 'visible_login_wall' },
  { status: 'form_not_ready', reason: 'form_loading' },
  { status: 'manual', reason: 'iframe_or_captcha_manual' }
]) {
  test(`direct CDP auto stops on ${readiness.status} and preserves the reason without a write`, async () => {
    const h = cdp(readiness);
    let writes = 0;
    await assert.rejects(async () => {
      await requireCdpAutoFormReady(h.send);
      writes += 1;
    }, error => {
      assert.equal(error.message, readiness.reason);
      const failure = autoFormReadinessFailure(error);
      assert.equal(failure.status, readiness.status);
      assert.deepEqual(failure.formReadiness, readiness);
      assert.equal(failure.fillNotStarted, true);
      assert.equal(failure.writeStarted, false);
      assert.equal(failure.writeAttempted, false);
      assert.equal(failure.saveAttempted, false);
      assert.equal(failure.liveSupportClaimed, false);
      return true;
    });
    assert.equal(writes, 0);
    assert.equal(h.commands.length, 2);
  });
}

for (const [label, value, options, count] of [
  ['missing API', undefined, {}, 2],
  ['malformed result', { ok: true }, {}, 2],
  ['injection transport failure', undefined, { failInjection: true }, 1],
  ['injection exception', undefined, { exception: true }, 1]
]) {
  test(`direct CDP auto fails closed on ${label}`, async () => {
    const h = cdp(value, options);
    await assert.rejects(() => requireCdpAutoFormReady(h.send), error => {
      assert.equal(error.message, 'form_readiness_unavailable');
      assert.equal(error.formReadiness.status, 'manual');
      assert.equal(error.formReadiness.writeAttempted, false);
      assert.equal(error.formReadiness.saveAttempted, false);
      assert.equal(error.formReadiness.liveSupportClaimed, false);
      return true;
    });
    assert.equal(h.commands.length, count);
  });
}
