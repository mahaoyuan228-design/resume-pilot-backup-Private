// Wait until the CMS tab's document reports hasFocus before education text writes.
// No FocusEvent synthesis: only tabs.update + windows.update + document.hasFocus probe.
export const CMS_PAGE_FOCUS_DEFAULTS = Object.freeze({ timeoutMs: 2000, intervalMs: 100 });

export async function awaitCmsPageDocumentFocus(api, tabId, options = {}) {
  if (!api?.tabs?.update || !api?.tabs?.get || !api?.scripting?.executeScript)
    throw Error('page_unfocused');
  if (!Number.isSafeInteger(tabId) || tabId < 0) throw Error('page_unfocused');
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : CMS_PAGE_FOCUS_DEFAULTS.timeoutMs;
  const intervalMs = Number.isFinite(options.intervalMs) ? options.intervalMs : CMS_PAGE_FOCUS_DEFAULTS.intervalMs;
  const pause = typeof options.pause === 'function'
    ? options.pause
    : (ms) => new Promise((done) => setTimeout(done, ms));
  const deadline = Date.now() + Math.max(0, timeoutMs);
  let last = null;
  for (;;) {
    await api.tabs.update(tabId, { active: true });
    const tab = await api.tabs.get(tabId);
    if (Number.isSafeInteger(tab?.windowId) && api.windows?.update) {
      try { await api.windows.update(tab.windowId, { focused: true }); }
      catch { /* OS may deny; keep polling hasFocus */ }
    }
    if (typeof options.beforeProbe === 'function') await options.beforeProbe();
    const results = await api.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => ({
        hasFocus: typeof document.hasFocus === 'function' ? document.hasFocus() : true,
        visible: document.visibilityState === 'visible',
        href: location.href,
        timeOrigin: performance.timeOrigin
      })
    });
    last = results?.length === 1 && (results[0].frameId === 0 || results[0].frameId == null)
      ? results[0].result
      : null;
    if (last?.hasFocus === true && last?.visible === true) return last;
    if (Date.now() >= deadline) break;
    await pause(Math.max(0, intervalMs));
  }
  const error = Error('page_unfocused');
  error.lastProbe = last;
  throw error;
}
