// PR-2 diagnostic entry point. No runtime message handler or production fill
// route calls this module. MAIN targets the top frame's default world explicitly;
// existing CDP context pinning and throwOnSideEffect probes remain untouched.
export const CONTROL_FILES = Object.freeze([
  'src/content/controls/model.js',
  'src/content/controls/registry.js',
  'src/content/controls/native.js',
  'src/content/controls/vue-controls.js',
]);

export function readShadowRequests(requests, expectedUrl) {
  if (location.href !== expectedUrl) throw new Error('shadow_document_changed');
  if (document.visibilityState !== 'visible') throw new Error('shadow_page_hidden');
  const registry = globalThis.ResumeControls;
  if (registry?.version !== 1 || registry.mode !== 'shadow') throw new Error('shadow_registry_missing');
  return { mode: 'shadow', liveSupportClaimed: false, writeStarted: false,
    plans: requests.map(({ selector, fact, field }) => {
      let nodes;
      try { nodes = document.querySelectorAll(selector); }
      catch { return { selector, field, status: 'unsupported', reason: 'selector_invalid' }; }
      if (nodes.length !== 1) return { selector, field, status: 'unsupported', reason: nodes.length ? 'target_ambiguous' : 'target_absent' };
      const element = nodes[0];
      try {
        const plan = registry.plan(element, fact);
        return { selector, field, ...plan, inspection: registry.inspect(element) };
      } catch { return { selector, field, status: 'unsupported', reason: 'component_probe_failed' }; }
    }) };
}

export async function inspectControls(api, tabId, requests) {
  if (!Number.isInteger(tabId) || tabId < 0 || !Array.isArray(requests) || requests.length > 100) throw new Error('shadow_request_invalid');
  const safe = requests.map(request => {
    if (!request || typeof request.selector !== 'string' || !request.selector || request.selector.length > 512
      || (request.field != null && typeof request.field !== 'string') || !request.fact || !Object.hasOwn(request.fact, 'value')) throw new Error('shadow_request_invalid');
    const value = request.fact.value;
    if (!(typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number'
      || (Array.isArray(value) && value.length <= 30 && value.every(v => ['string', 'number', 'boolean'].includes(typeof v))))) throw new Error('shadow_fact_invalid');
    return { selector: request.selector, field: request.field || '', fact: { value } };
  });
  const tab = await api.tabs.get(tabId);
  if (!tab?.active || !/^https?:\/\//u.test(tab.url || '')) throw new Error('shadow_tab_inactive_or_invalid');
  const target = { tabId, frameIds: [0] };
  await api.scripting.executeScript({ target, world: 'MAIN', files: [...CONTROL_FILES] });
  const rows = await api.scripting.executeScript({ target, world: 'MAIN', func: readShadowRequests, args: [safe, tab.url] });
  if (rows.length !== 1 || rows[0].frameId !== 0 || !rows[0].result || rows[0].result.mode !== 'shadow'
    || rows[0].result.writeStarted !== false || rows[0].result.liveSupportClaimed !== false) throw new Error('shadow_result_invalid');
  return rows[0].result;
}
