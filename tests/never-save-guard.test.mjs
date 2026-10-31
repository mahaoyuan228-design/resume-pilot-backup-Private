import test from 'node:test';
import assert from 'node:assert/strict';
import { createRowDNetworkGuard } from '../scripts/live/cms-row-d-live.mjs';
import { ROW_D_PAGE } from '../scripts/lib/cms-row-d-options.mjs';
import { assessNeverSaveBatch } from '../scripts/lib/never-save-guard.mjs';

// CDP events and command spies only: no browser, HTTP client or live runner.
const PRIVATE = 'private-request-data';
let sequence = 0;
function fixture(reply = () => ({})) {
  const commands = [];
  const guard = createRowDNetworkGuard((method, params) => {
    commands.push({ method, params });
    return reply(method, params);
  });
  return { guard, commands };
}
function events(method, site = 0, url = `https://site-${site}.invalid/business?token=${PRIVATE}`) {
  const id = ++sequence;
  const request = { method, url };
  for (const key of ['headers', 'postData']) Object.defineProperty(request, key,
    { get() { assert.fail(`${key} must never be read`); } });
  return [
    { method: 'Network.requestWillBeSent', params: { requestId: `network-${id}`, request } },
    { method: 'Fetch.requestPaused', params: { requestId: `fetch-${id}`, networkId: `network-${id}`, request } },
  ];
}
async function emit(guard, messages) {
  for (const message of messages) guard.onEvent(message);
  await guard.drain();
}

test('a drained GET-only multi-site batch passes', async () => {
  const fixtures = [fixture(), fixture(), fixture()];
  await Promise.all(fixtures.map(({ guard }, site) => emit(guard, events('GET', site))));
  const batch = assessNeverSaveBatch(fixtures.map(({ guard }) => guard));
  assert.equal(batch.status, 'PASS');
  assert.equal(batch.neverSave, true);
  assert.equal(batch.liveSupportClaimed, false);
  assert.ok(batch.sites.every(site => site.reason === 'get_only'));
  for (const { commands } of fixtures) assert.deepEqual(commands.map(row => row.method), ['Fetch.continueRequest']);
});

for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'CONNECT', 'TRACE', 'post', 'CUSTOM', undefined]) {
  for (const reverse of [false, true]) test(`${method} is recorded, aborted and batch FAIL (Fetch first=${reverse})`, async () => {
    const { guard, commands } = fixture();
    const messages = events(method);
    await emit(guard, reverse ? messages.toReversed() : messages);
    assert.deepEqual(commands, [{ method: 'Fetch.failRequest',
      params: { requestId: messages[1].params.requestId, errorReason: 'BlockedByClient' } }]);
    assert.equal(guard.traffic.observedNonGetCount, 1);
    assert.equal(guard.traffic.interceptedNonGetCount, 1);
    assert.equal(guard.traffic.blockedNonGetCount, 1);
    assert.equal(guard.traffic.responseToNonGetCount, 0);
    const normalized = ['CUSTOM', undefined].includes(method) ? 'UNKNOWN' : method.toUpperCase();
    assert.deepEqual(guard.traffic.records.map(row => row.phase),
      reverse ? ['paused', 'observed', 'blocked'] : ['observed', 'paused', 'blocked']);
    assert.ok(guard.traffic.records.every(row => row.method === normalized));
    const batch = assessNeverSaveBatch([guard]);
    assert.equal(batch.status, 'FAIL');
    assert.equal(batch.sites[0].reason, 'non_get_attempted');
    assert.doesNotMatch(JSON.stringify({ batch, traffic: guard.traffic }),
      /private-request-data|site-0|network-\d|fetch-\d|postData|headers/);
  });
}

for (const failingSite of [0, 1, 2]) test(`one writing site ${failingSite} fails the entire batch permanently`, async () => {
  const guards = [fixture().guard, fixture().guard, fixture().guard];
  await Promise.all(guards.map((guard, site) => emit(guard, events(site === failingSite ? 'PATCH' : 'GET', site))));
  const before = assessNeverSaveBatch(guards);
  assert.equal(before.status, 'FAIL');
  assert.deepEqual(before.sites.map(site => site.status), guards.map((_, site) => site === failingSite ? 'FAIL' : 'PASS'));
  await Promise.all(guards.map((guard, site) => emit(guard, events('GET', site))));
  assert.deepEqual(assessNeverSaveBatch(guards), before, 'later GETs and successful sites cannot clear cumulative write evidence');
});

for (const phase of [0, 1]) test(`incomplete non-GET evidence at phase ${phase} still fails the batch`, async () => {
  const { guard } = fixture();
  await emit(guard, [events('DELETE')[phase]]);
  assert.equal(assessNeverSaveBatch([guard]).status, 'FAIL');
});

test('pending and rejected abort acknowledgements never pass', async () => {
  let reject;
  const { guard } = fixture(() => new Promise((_, fail) => { reject = fail; }));
  for (const event of events('PUT')) guard.onEvent(event);
  assert.equal(guard.hasPendingCommands(), true);
  assert.equal(assessNeverSaveBatch([guard]).status, 'FAIL');
  reject(new Error(PRIVATE));
  await guard.drain();
  assert.equal(guard.traffic.commandFailed, true);
  assert.equal(guard.traffic.blockedNonGetCount, 0);
  assert.equal(assessNeverSaveBatch([guard]).status, 'FAIL');
});

test('GET-only evidence is not complete while a guard decision is pending', async () => {
  let resolve;
  const { guard } = fixture(() => new Promise(done => { resolve = done; }));
  for (const event of events('GET')) guard.onEvent(event);
  assert.equal(guard.failed(), false);
  assert.equal(assessNeverSaveBatch([guard]).sites[0].reason, 'network_guard_failed');
  resolve({});
  await guard.drain();
  assert.equal(assessNeverSaveBatch([guard]).status, 'PASS');
});

test('response evidence cannot be excused by an acknowledged abort', async () => {
  const { guard } = fixture();
  const messages = events('POST');
  await emit(guard, messages);
  guard.onEvent({ method: 'Network.responseReceived', params: { requestId: messages[0].params.requestId } });
  assert.equal(guard.traffic.responseToNonGetCount, 1);
  assert.equal(assessNeverSaveBatch([guard]).status, 'FAIL');
});

test('historical keeper block proof cannot pass a Never-Save batch', async () => {
  const { guard } = fixture();
  guard.setKeeperActive(true);
  const page = new URL(ROW_D_PAGE);
  // Exercise the existing exception with fake events, without changing its policy.
  await emit(guard, events('POST', 0, `${page.origin}/wecruit/resume/info/edit/${page.pathname.split('/')[1]}`));
  assert.equal(guard.failed(), false);
  assert.equal(guard.assessment().status, 'correlated_keeper_blocks');
  assert.equal(assessNeverSaveBatch([guard]).status, 'FAIL');
});

test('empty, missing, truncated and failed guard evidence cannot pass', () => {
  assert.equal(assessNeverSaveBatch([]).status, 'FAIL');
  assert.equal(assessNeverSaveBatch([null]).sites[0].reason, 'guard_evidence_invalid');
  assert.equal(assessNeverSaveBatch(Array(1)).sites[0].reason, 'guard_evidence_invalid');
  assert.throws(() => assessNeverSaveBatch(null), /batch_guards_invalid/);
  for (const flag of ['truncated', 'commandFailed']) {
    const { guard } = fixture();
    guard.traffic[flag] = true;
    assert.equal(assessNeverSaveBatch([guard]).sites[0].reason, 'network_guard_failed');
  }
});
