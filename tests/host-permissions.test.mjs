import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { inspectHostPermissions, requireHostPermission, requestHostPermission,
  requireAutoFormReady, autoFormReadinessFailure } from '../src/background/auto-form-readiness.mjs';

const tabId = 42;
const url = 'https://unknown.example.test:8443/resume?private=token#editor';
const safe = { readOnly: true, neverSave: true, fillNotStarted: true,
  writeStarted: false, writeAttempted: false, saveAttempted: false,
  saved: false, skippedSave: true, liveSupportClaimed: false };
function assertSafe(result) {
  for (const [key, value] of Object.entries(safe)) assert.equal(result[key], value, key);
}
function harness({ allowed = true, origins = ['https://*.example.test/*'], tab = { id: tabId, url } } = {}) {
  const calls = { contains: [], request: [], script: [], tabs: [] };
  const readiness = { status: 'ready', reason: 'visible_editable_form' };
  const api = {
    permissions: {
      getAll: async () => ({ origins }),
      contains: async value => { calls.contains.push(value); return allowed; },
      request: async value => { calls.request.push(value); return allowed; },
    },
    tabs: { get: async id => { calls.tabs.push(id); return tab; } },
    scripting: { executeScript: async value => {
      calls.script.push(value);
      return [{ result: value.files ? undefined : readiness }];
    } },
  };
  return { api, calls, readiness };
}

test('probe reports granted origins and asks Chrome about the exact tab host without injecting', async () => {
  const origins = ['https://static.example.test/*', 'https://*.example.test/*', 'https://optional.example.test/*'];
  const h = harness({ origins });
  const result = await inspectHostPermissions(h.api, tabId);
  assert.equal(result.status, 'granted');
  assert.equal(result.reason, 'host_permission_granted');
  assert.equal(result.hasHostPermission, true);
  assert.deepEqual(result.grantedOrigins, origins);
  assert.equal(result.origin, 'https://unknown.example.test:8443');
  assert.equal(result.originPattern, 'https://unknown.example.test/*');
  assert.deepEqual(h.calls.tabs, [tabId]);
  assert.deepEqual(h.calls.contains, [{ origins: ['https://unknown.example.test/*'] }]);
  assert.deepEqual(h.calls.script, []);
  assert.deepEqual(h.calls.request, []);
  assert.doesNotMatch(JSON.stringify(result), /private|token|editor/);
  assertSafe(result);
});

test('a listed wildcard does not override Chrome denial; unknown origin stops before any field action', async () => {
  const h = harness({ allowed: false });
  let fieldWrites = 0;
  await assert.rejects(async () => {
    await requireAutoFormReady(h.api, tabId);
    fieldWrites++;
  }, error => {
    assert.equal(error.message, 'host_permission_missing');
    const failure = autoFormReadinessFailure(error);
    assert.equal(failure.status, 'no_permission');
    assert.equal(failure.fillNotStarted, true);
    assert.equal(failure.writeStarted, false);
    assert.equal(failure.writeAttempted, false);
    assert.equal(failure.saveAttempted, false);
    assert.equal(failure.liveSupportClaimed, false);
    assert.equal(failure.formReadiness.reason, 'host_permission_missing');
    assert.equal(failure.formReadiness.hostPermission.hasHostPermission, false);
    assertSafe(failure.formReadiness);
    return true;
  });
  assert.equal(fieldWrites, 0);
  assert.deepEqual(h.calls.script, []);
  assert.deepEqual(h.calls.request, []);
});

test('granted host access still requires ready form evidence and is checked again on each invocation', async () => {
  const h = harness();
  assert.deepEqual(await requireAutoFormReady(h.api, tabId), h.readiness);
  assert.equal(h.calls.script.length, 2);
  h.api.permissions.contains = async () => false;
  await assert.rejects(() => requireAutoFormReady(h.api, tabId), /host_permission_missing/);
  assert.equal(h.calls.script.length, 2);
  assert.deepEqual(h.calls.request, []);
});

test('host permission cannot bypass manual form readiness', async () => {
  const h = harness();
  Object.assign(h.readiness, { status: 'manual', reason: 'iframe_or_captcha_manual' });
  let fieldWrites = 0;
  await assert.rejects(async () => {
    await requireAutoFormReady(h.api, tabId);
    fieldWrites++;
  }, error => {
    const failure = autoFormReadinessFailure(error);
    assert.equal(failure.status, 'manual');
    assert.equal(failure.formReadiness.reason, 'iframe_or_captcha_manual');
    assert.equal(failure.fillNotStarted, true);
    assert.equal(failure.writeStarted, false);
    assert.equal(failure.liveSupportClaimed, false);
    return true;
  });
  assert.equal(fieldWrites, 0);
  assert.deepEqual(h.calls.request, []);
});

for (const [name, change, reason] of [
  ['missing permission API', h => { delete h.api.permissions; }, 'host_permission_api_unavailable'],
  ['missing tab API', h => { delete h.api.tabs; }, 'host_permission_api_unavailable'],
  ['permission list failure', h => { h.api.permissions.getAll = async () => { throw Error('offline'); }; }, 'host_permission_probe_unavailable'],
  ['missing permission list result', h => { h.api.permissions.getAll = async () => undefined; }, 'host_permission_probe_unavailable'],
  ['null permission list result', h => { h.api.permissions.getAll = async () => null; }, 'host_permission_probe_unavailable'],
  ['malformed permission list', h => { h.api.permissions.getAll = async () => ({ origins: 'https://*/*' }); }, 'host_permission_probe_unavailable'],
  ['tab lookup failure', h => { h.api.tabs.get = async () => { throw Error('closed'); }; }, 'host_permission_probe_unavailable'],
  ['permission check failure', h => { h.api.permissions.contains = async () => { throw Error('revoked'); }; }, 'host_permission_probe_unavailable'],
  ['nonboolean permission check', h => { h.api.permissions.contains = async () => 'true'; }, 'host_permission_probe_unavailable'],
]) {
  test(`probe fails closed on ${name}`, async () => {
    const h = harness(); change(h);
    const result = await inspectHostPermissions(h.api, tabId);
    assert.equal(result.status, 'manual');
    assert.equal(result.reason, reason);
    assert.equal(result.hasHostPermission, false);
    assertSafe(result);
    await assert.rejects(() => requireHostPermission(h.api, tabId), error => {
      assert.equal(error.formReadiness.reason, reason);
      assert.equal(error.fillNotStarted, true);
      assert.equal(error.writeStarted, false);
      return true;
    });
    assert.deepEqual(h.calls.script, []);
    assert.deepEqual(h.calls.request, []);
  });
}

for (const value of [undefined, 'not a URL', 'chrome://settings/', 'file:///resume.html',
  'https://user:secret@unknown.example.test/resume', 'https://*.example.test/resume']) {
  test(`unsupported tab URL is manual without an origin request: ${String(value).split('@').pop()}`, async () => {
    const h = harness({ tab: { id: tabId, url: value } });
    const result = await inspectHostPermissions(h.api, tabId);
    assert.equal(result.status, 'manual');
    assert.equal(result.reason, 'tab_origin_unavailable');
    assert.equal(result.hasHostPermission, false);
    assertSafe(result);
    assert.deepEqual(h.calls.contains, []);
    assert.deepEqual(h.calls.script, []);
    assert.deepEqual(h.calls.request, []);
  });
}

test('pending navigation to another origin blocks before injection; same-origin navigation remains probeable', async () => {
  const h = harness({ tab: { id: tabId, url, pendingUrl: 'https://another.example.test/form' } });
  const result = await inspectHostPermissions(h.api, tabId);
  assert.equal(result.status, 'manual');
  assert.equal(result.reason, 'tab_navigation_pending');
  assertSafe(result);
  assert.deepEqual(h.calls.contains, []);
  h.api.tabs.get = async () => ({ id: tabId, url, pendingUrl: 'https://unknown.example.test:8443/next' });
  assert.equal((await inspectHostPermissions(h.api, tabId)).hasHostPermission, true);
  assert.deepEqual(h.calls.script, []);
});

test('optional request is disabled by default and requires explicit gesture intent', async () => {
  const h = harness();
  for (const options of [undefined, {}, { userGesture: false }, { userGesture: 'true' }]) {
    const result = await requestHostPermission(h.api, url, options);
    assert.equal(result.status, 'manual');
    assert.equal(result.reason, 'host_permission_user_gesture_required');
    assert.equal(result.requestAttempted, false);
    assertSafe(result);
  }
  assert.deepEqual(h.calls.request, []);
  assert.deepEqual(h.calls.script, []);
});

for (const allowed of [true, false]) {
  test(`explicit request asks only for the captured exact host and returns ${allowed ? 'grant' : 'denial'} without filling`, async () => {
    const h = harness({ allowed });
    const pending = requestHostPermission(h.api, url, { userGesture: true });
    // Native request must run synchronously in the UI gesture before any await.
    assert.deepEqual(h.calls.request, [{ origins: ['https://unknown.example.test/*'] }]);
    const result = await pending;
    assert.equal(result.status, allowed ? 'granted' : 'no_permission');
    assert.equal(result.reason, allowed ? 'host_permission_granted' : 'host_permission_request_denied');
    assert.equal(result.requestAttempted, true);
    assert.equal(result.hasHostPermission, allowed);
    assertSafe(result);
    assert.doesNotMatch(JSON.stringify(result), /private|token|editor/);
    assert.deepEqual(h.calls.script, []);
    assert.deepEqual(h.calls.tabs, []);
    assert.deepEqual(h.calls.contains, []);
  });
}

test('request failure, missing API and invalid or credentialed target remain manual', async () => {
  const h = harness();
  h.api.permissions.request = async () => { throw Error('gesture expired'); };
  let result = await requestHostPermission(h.api, url, { userGesture: true });
  assert.equal(result.reason, 'host_permission_request_failed');
  assert.equal(result.requestAttempted, true);
  assertSafe(result);
  delete h.api.permissions.request;
  result = await requestHostPermission(h.api, url, { userGesture: true });
  assert.equal(result.reason, 'host_permission_request_unavailable');
  assert.equal(result.requestAttempted, false);
  assertSafe(result);
  for (const value of ['https://user:secret@unknown.example.test/resume', 'https://*.example.test/', 'chrome://settings/']) {
    result = await requestHostPermission(h.api, value, { userGesture: true });
    assert.equal(result.reason, 'tab_origin_unavailable');
    assert.equal(result.requestAttempted, false);
    assertSafe(result);
    assert.doesNotMatch(JSON.stringify(result), /secret|resume/);
  }
  assert.deepEqual(h.calls.script, []);
  assert.deepEqual(h.calls.request, []);
});

for (const type of ['RESUME_INSPECT', 'RESUME_FILL']) {
  test(`popup ${type} records a permission stop before profile access or injection`, async () => {
    const h = harness({ allowed: false });
    const effects = { profileReads: 0, owner: 0, script: 0, confirm: 0 };
    const receipts = [];
    const forbidden = key => () => { effects[key]++; throw Error(`forbidden_${key}`); };
    h.api.storage = { local: {
      get: forbidden('profileReads'),
      set: async value => { receipts.push(JSON.parse(JSON.stringify(value))); },
    } };
    h.api.scripting.executeScript = forbidden('script');
    const popup = readFileSync(new URL('../src/popup/popup.js', import.meta.url), 'utf8');
    const body = popup.slice(popup.indexOf('async function send(type)'), popup.indexOf('\nfunction renderValidationGaps('));
    assert.ok(body.startsWith('async function send(type)'));
    const send = runInNewContext(`(${body.trim()})`, {
      attachmentReady: Promise.resolve(), getTab: async () => ({ id: tabId, url }),
      requireHostPermission, chrome: h.api,
      popupFileOwner: { ensure: forbidden('owner') },
      loadProfile: forbidden('profileReads'), window: { confirm: forbidden('confirm') },
    });
    await assert.rejects(() => send(type), error => {
      assert.equal(error.status, 'no_permission');
      assert.equal(error.reason, 'host_permission_missing');
      assert.match(error.message, /host_permission_missing/);
      assert.equal(error.fillNotStarted, true);
      assert.equal(error.writeStarted, false);
      assert.equal(error.writeAttempted, false);
      assert.equal(error.saveAttempted, false);
      assert.equal(error.liveSupportClaimed, false);
      return true;
    });
    assert.deepEqual(receipts, [{ resumeHostPermissionStop: {
      status: 'no_permission', reason: 'host_permission_missing',
      origin: 'https://unknown.example.test:8443', fillNotStarted: true,
      writeStarted: false, writeAttempted: false, saveAttempted: false,
      neverSave: true, liveSupportClaimed: false,
    } }]);
    assert.doesNotMatch(JSON.stringify(receipts), /resume\?|private|token|editor/);
    assert.deepEqual(effects, { profileReads: 0, owner: 0, script: 0, confirm: 0 });
    assert.deepEqual(h.calls.request, []);
  });
}
