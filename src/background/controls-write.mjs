// First-party opt-in route from the ordinary RESUME_FILL engine to L1.
// The shared profile lifecycle lock spans the whole MAIN-world operation.
import { assertProfileBinding, withProfileBinding } from '../profile/profile-lifecycle.js';
import { CONTROL_FILES } from './controls-shadow.mjs';

export const CONTROL_WRITE_MESSAGE = 'RESUME_ATS_CONTROL_WRITE';
export const CONTROL_CANDIDATES_MESSAGE = 'RESUME_ATS_CONTROL_CANDIDATES';
export const CONTROL_WRITE_FLAG = 'resumeAtsEngineWriteEnabled';

export function readControlCandidatesInPage(expectedUrl, timeOrigin) {
  if (location.href !== expectedUrl || performance.timeOrigin !== timeOrigin || document.visibilityState !== 'visible') throw Error('control_document_changed');
  const registry = globalThis.ResumeControls;
  if (registry?.version !== 1 || registry.liveSupportClaimed !== false) throw Error('control_registry_missing');
  const names = new Set(['ivu-select', 'ivu-date', 'ud-select', 'ud-date', 'ud-cascader', 'phoenix-select', 'phoenix-cascader', 'phoenix-date']);
  const candidates = [];
  for (const element of [...document.querySelectorAll('input,textarea')].slice(0, 300)) {
    if (['hidden', 'password', 'file', 'submit', 'button', 'reset', 'image'].includes(element.type)
      || element.disabled || element.getRootNode() !== document) continue;
    const adapter = registry.resolve(element), model = adapter?.readModel(element);
    if (!names.has(adapter?.name) || !model.available || model.disabled || model.readonly) continue;
    const parts = [];
    for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
      const parent = node.parentElement;
      if (!parent) break;
      parts.unshift(`${node.tagName.toLowerCase()}:nth-child(${[...parent.children].indexOf(node) + 1})`);
    }
    const selector = ['html', ...parts].join(' > ');
    if (selector.length <= 2048 && document.querySelectorAll(selector).length === 1) candidates.push({ selector, adapter: adapter.name, type: adapter.type });
  }
  return { mode: 'candidates', candidates, writeStarted: false, liveSupportClaimed: false };
}

export async function writeControlInPage(payload) {
  const reject = reason => { throw Error(reason); };
  const registry = globalThis.ResumeControls;
  let element, scope, identity = null, writeStarted = false;
  const check = async () => {
    if (location.href !== payload.expectedUrl || performance.timeOrigin !== payload.timeOrigin) reject('control_document_changed');
    if (document.visibilityState !== 'visible') reject('fill_interrupted_page_hidden');
    if (!element?.isConnected || element.ownerDocument !== document || element.getRootNode() !== document
      || !scope?.isConnected || !scope.contains(element)) reject('control_target_changed');
    const current = document.querySelectorAll(payload.selector);
    if (current.length !== 1 || current[0] !== element) reject('control_target_changed');
    if (identity) {
      const live = registry.resolve(element), ref = globalThis.ResumeControlModel.resolve(element);
      const model = live?.readModel(element);
      if (live?.name !== identity.adapter || model?.version !== identity.version || model?.controlRoot !== identity.root
        || ref.framework !== identity.framework || ref.vm !== identity.vm || ref.componentType !== identity.componentType) reject('control_adapter_changed');
      if (!model.available || model.disabled || model.readonly) reject('control_not_writable');
    }
  };
  try {
    if (registry?.version !== 1 || registry.liveSupportClaimed !== false) reject('control_registry_missing');
    const nodes = document.querySelectorAll(payload.selector);
    if (nodes.length !== 1) reject(nodes.length ? 'control_target_ambiguous' : 'control_target_absent');
    element = nodes[0]; scope = element.closest('form') || document.documentElement;
    await check();
    const selectedAdapter = registry.resolve(element);
    // Existing intent facts are a list of individually confirmed answers. A
    // single-choice control may consume only an exactly-one projection.
    const value = Array.isArray(payload.value) && payload.value.length === 1
      && ['text', 'textarea', 'select', 'select-search', 'radio'].includes(selectedAdapter?.type)
      ? payload.value[0] : payload.value;
    const plan = registry.plan(element, { value });
    if (!['planned', 'success'].includes(plan.status)) return { ...plan, writeStarted: false, liveSupportClaimed: false };
    const adapter = registry.resolve(element);
    if (!adapter || adapter.name !== plan.adapter) reject('control_adapter_changed');
    const model = adapter.readModel(element), ref = globalThis.ResumeControlModel.resolve(element);
    identity = { adapter: adapter.name, root: model.controlRoot, version: model.version,
      framework: ref.framework, vm: ref.vm, componentType: ref.componentType };
    if (plan.status === 'success') {
      const verification = await adapter.verify(element, plan);
      await check();
      return { ...verification, adapter: adapter.name, reason: verification.status === 'success' ? 'preexisting_same_value' : 'readback_mismatch',
        writeStarted: false, strategy: 'none', attempts: 0, liveSupportClaimed: false };
    }
    // Conservative: after entry into the writer an error may follow a partial UI
    // sequence, so callers must retain review ownership even without readback.
    writeStarted = true;
    const written = await adapter.write(element, plan, { allowWrite: true, check });
    await check();
    if (written.status && written.status !== 'success') return { ...written, adapter: adapter.name, writeStarted, liveSupportClaimed: false };
    const verification = await adapter.verify(element, plan);
    await check();
    return { ...written, ...verification, adapter: adapter.name,
      reason: verification.status === 'success' ? 'readback_matched' : 'readback_mismatch', writeStarted, liveSupportClaimed: false };
  } catch (error) {
    return { status: 'unsupported', reason: /^[a-z_]+$/u.test(error?.message || '') ? error.message : 'control_write_failed',
      writeStarted, liveSupportClaimed: false };
  }
}

function confirmedValue(profile, path) {
  if (typeof path !== 'string' || !path || path.length > 512 || /(?:^|\.)(?:__proto__|prototype|constructor)(?:\.|$)/u.test(path)) throw Error('control_fact_invalid');
  if (path === 'desiredRoles' || path === 'desiredCities') {
    if (!Array.isArray(profile[path])) throw Error('control_fact_invalid');
    const values = profile[path].filter((value, index) => value && (profile.confirmedFields || []).includes(`${path}.${index}`));
    if (!values.length) throw Error('control_fact_unconfirmed');
    if (values.length > 30 || values.some(value => typeof value !== 'string')) throw Error('control_fact_invalid');
    return values;
  }
  // Custom question labels can contain dots; do not treat those as object paths.
  const value = path.startsWith('customAnswers.') ? profile.customAnswers?.[path.slice(14)]
    : path.split('.').reduce((current, key) => current != null && Object.hasOwn(current, key) ? current[key] : undefined, profile);
  if (!(profile.confirmedFields || []).includes(path)) throw Error('control_fact_unconfirmed');
  if (!(typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    || Array.isArray(value) && value.length <= 30 && value.every(part => ['string', 'number', 'boolean'].includes(typeof part)))) throw Error('control_fact_invalid');
  return value;
}

export function createControlWriteBridge({ api = globalThis.chrome, verifyBeforeFill = null, lifecycleOptions = {} } = {}) {
  const pending = new Set();
  const listener = (message, sender, sendResponse) => {
    if (![CONTROL_WRITE_MESSAGE, CONTROL_CANDIDATES_MESSAGE].includes(message?.type)) return false;
    const refuse = reason => sendResponse({ ok: false, reason, writeStarted: false, liveSupportClaimed: false });
    if (sender?.id !== api.runtime.id || sender.frameId !== 0 || !Number.isSafeInteger(sender.tab?.id)
      || sender.tab.id < 0 || sender.url !== sender.tab.url || !/^https:\/\//u.test(sender.url || '')) {
      refuse('control_wrong_sender'); return false;
    }
    const discovering = message.type === CONTROL_CANDIDATES_MESSAGE;
    if (!Number.isFinite(message.timeOrigin) || !discovering && (typeof message.selector !== 'string' || !message.selector || message.selector.length > 2048
      || typeof message.path !== 'string')) {
      refuse('control_request_invalid'); return false;
    }
    const tabId = sender.tab.id;
    if (pending.has(tabId)) { refuse('control_write_busy'); return false; }
    pending.add(tabId);
    let started = false;
    (async () => {
      if ((await api.storage.local.get(CONTROL_WRITE_FLAG))[CONTROL_WRITE_FLAG] !== true) throw Error('control_write_disabled');
      if (discovering) {
        const tab = await api.tabs.get(tabId);
        if (tab?.active !== true || tab.url !== sender.url) throw Error('control_tab_changed');
        const target = { tabId, frameIds: [0] };
        await api.scripting.executeScript({ target, world: 'MAIN', files: [...CONTROL_FILES] });
        const rows = await api.scripting.executeScript({ target, world: 'MAIN', func: readControlCandidatesInPage, args: [sender.url, message.timeOrigin] });
        const result = rows.length === 1 && rows[0].frameId === 0 ? rows[0].result : null;
        if (result?.mode !== 'candidates' || result.writeStarted !== false || result.liveSupportClaimed !== false
          || !Array.isArray(result.candidates) || result.candidates.length > 300) throw Error('control_result_invalid');
        return { ...result, ok: true };
      }
      const paid = api.runtime.getManifest?.().background?.service_worker === 'src/license/guard-worker.mjs';
      if (paid && typeof verifyBeforeFill !== 'function') throw Error('license_required');
      if (verifyBeforeFill) await verifyBeforeFill();
      return withProfileBinding(api.storage.local, message.profileBinding, async () => {
        const exactTab = async () => {
          const tab = await api.tabs.get(tabId);
          if (tab?.active !== true || tab.url !== sender.url) throw Error('control_tab_changed');
          if ((await api.storage.local.get(CONTROL_WRITE_FLAG))[CONTROL_WRITE_FLAG] !== true) throw Error('control_write_disabled');
          await assertProfileBinding(api.storage.local, message.profileBinding, lifecycleOptions);
        };
        await exactTab();
        const profile = (await api.storage.local.get('resumeProfile')).resumeProfile;
        const value = confirmedValue(profile || {}, message.path);
        if (JSON.stringify(value) !== JSON.stringify(message.value)) throw Error('control_fact_changed');
        const target = { tabId, frameIds: [0] };
        await api.scripting.executeScript({ target, world: 'MAIN', files: [...CONTROL_FILES] });
        await exactTab();
        started = true;
        const rows = await api.scripting.executeScript({ target, world: 'MAIN', func: writeControlInPage,
          args: [{ selector: message.selector, value, expectedUrl: sender.url, timeOrigin: message.timeOrigin }] });
        await exactTab();
        const result = rows.length === 1 && rows[0].frameId === 0 ? rows[0].result : null;
        if (!result || result.liveSupportClaimed !== false || typeof result.writeStarted !== 'boolean'
          || !['success', 'mismatch', 'reverted', 'unsupported', 'manual'].includes(result.status)) throw Error('control_result_invalid');
        // Registry verification also exposes an `ok` sample flag. Keep it from
        // replacing this transport verdict for mismatch/reverted outcomes.
        return { ...result, ok: true };
      }, lifecycleOptions);
    })().then(sendResponse, error => sendResponse({ ok: false,
      reason: /^[a-z_]+$/u.test(error?.message || '') ? error.message : 'control_write_failed', writeStarted: started, liveSupportClaimed: false }))
      .finally(() => pending.delete(tabId));
    return true;
  };
  return { listener };
}

export function installControlWriteBridge(options = {}) {
  const bridge = createControlWriteBridge(options);
  (options.api || globalThis.chrome).runtime.onMessage.addListener(bridge.listener);
  return bridge;
}
