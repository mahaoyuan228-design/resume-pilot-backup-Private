// Read-only GTH live preflight. This function is serialized into the selected page.
// A legacy own-property visibility override must not make a hidden tab look ready.
export function readGthLivePreflight() {
  const readNative = name => {
    try {
      const getter = Object.getOwnPropertyDescriptor(Document.prototype, name)?.get;
      return typeof getter === 'function' ? getter.call(document) : null;
    } catch { return null; }
  };
  let reportedVisibility = null;
  try { reportedVisibility = document.visibilityState; } catch { /* unavailable */ }
  return {
    href: location.href,
    readyState: document.readyState,
    reportedVisibility,
    nativeVisibility: readNative('visibilityState'),
    nativeHidden: readNative('hidden'),
    visibilityOverrides: ['visibilityState', 'hidden'].filter(name => Object.hasOwn(document, name)),
  };
}

export function assessGthLivePreflight(probe) {
  const fail = reason => ({ ok: false, reason });
  if (probe?.href !== 'https://hr.gtht.com/resume/edit/') return fail('wrong_page');
  if (probe.readyState !== 'complete') return fail('page_not_ready');
  if (!['visible', 'hidden', 'prerender'].includes(probe.nativeVisibility)
    || typeof probe.nativeHidden !== 'boolean') return fail('native_visibility_unavailable');
  if (!Array.isArray(probe.visibilityOverrides) || probe.visibilityOverrides.length
    || probe.reportedVisibility !== probe.nativeVisibility) return fail('visibility_override_detected');
  if (probe.nativeVisibility !== 'visible' || probe.nativeHidden) return fail('page_hidden');
  return { ok: true, reason: null };
}
