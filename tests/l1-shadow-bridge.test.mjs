import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectControls, CONTROL_FILES } from '../src/background/controls-shadow.mjs';

test('shadow broker pins MAIN top frame and has no write message route', async () => {
  const calls = [];
  const api = { tabs: { get: async () => ({ active: true, url: 'https://example.test/resume' }) },
    scripting: { executeScript: async options => {
      calls.push(options);
      return [{ frameId: 0, result: { mode: 'shadow', writeStarted: false, liveSupportClaimed: false, plans: [] } }];
    } } };
  const result = await inspectControls(api, 8, [{ selector: '#date', field: 'month', fact: { value: '2023-01', secret: 'omitted' } }]);
  assert.equal(result.writeStarted, false);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.world, 'MAIN');
    assert.deepEqual(call.target, { tabId: 8, frameIds: [0] });
  }
  assert.deepEqual(calls[0].files, [...CONTROL_FILES]);
  assert.deepEqual(calls[1].args[0][0].fact, { value: '2023-01' });
});

test('shadow refuses inactive targets and malformed requests before injecting', async () => {
  let injected = false;
  const api = { tabs: { get: async () => ({ active: false, url: 'https://example.test/' }) },
    scripting: { executeScript: async () => { injected = true; } } };
  await assert.rejects(inspectControls(api, 8, [{ selector: '#x', fact: { value: 'x' } }]), /shadow_tab_inactive/u);
  await assert.rejects(inspectControls(api, 8, [{ selector: '#x', fact: { value: {} } }]), /shadow_fact_invalid/u);
  await assert.rejects(inspectControls(api, 8, [{ selector: '#x' }]), /shadow_request_invalid/u);
  assert.equal(injected, false);
});

test('shadow rejects subframe and false support claims in results', async () => {
  for (const result of [{ frameId: 4, result: { mode: 'shadow', writeStarted: false, liveSupportClaimed: false } },
    { frameId: 0, result: { mode: 'shadow', writeStarted: false, liveSupportClaimed: true } }]) {
    const api = { tabs: { get: async () => ({ active: true, url: 'https://example.test/' }) }, scripting: { executeScript: async () => [result] } };
    await assert.rejects(inspectControls(api, 8, []), /shadow_result_invalid/u);
  }
});
