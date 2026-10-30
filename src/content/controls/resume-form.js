// Shared resume-entry / hydration state machine. No ATS tenant or field mapping.
// Entry actions only reveal an editor; ready() must prove its writable controls.
(() => {
  'use strict';
  if (globalThis.ResumeFormFlow?.version === 1) return;
  const normalize = value => String(value ?? '').normalize('NFKC').replace(/\s+/gu, '').trim();
  const actions = new Map([
    ['创建简历', 'create'], ['新建简历', 'create'],
    ['进入简历', 'enter'], ['填写简历', 'enter'], ['编辑简历', 'edit'],
  ]);
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  function visible(node) {
    if (!node?.isConnected || node.getRootNode() !== document) return false;
    for (let parent = node; parent; parent = parent.parentElement) {
      if (parent.hidden || parent.hasAttribute('inert') || parent.getAttribute('aria-hidden') === 'true') return false;
      const style = getComputedStyle(parent);
      if (['none'].includes(style.display) || ['hidden', 'collapse'].includes(style.visibility)
        || style.opacity === '0' || style.contentVisibility === 'hidden') return false;
    }
    return true;
  }
  function candidates() {
    return [...document.querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"]')]
      .filter(visible).map(node => ({ node,
        action: actions.get(normalize(node.textContent || node.value || node.getAttribute('aria-label'))) }))
      .filter(row => row.action);
  }
  function refusal(node) {
    if (node.disabled || node.matches(':disabled') || node.closest('[aria-disabled="true"]')) return 'entry_disabled';
    if (node.matches('input[type="submit"],input[type="image"]') || node.tagName === 'BUTTON' && node.type !== 'button') return 'entry_submit_manual';
    if (node.closest('form[aria-busy="true"],[data-captcha],.g-recaptcha,.h-captcha')) return 'entry_busy_or_captcha';
    if (node.matches('a')) {
      if (node.hasAttribute('download') || node.target && node.target !== '_self') return 'navigation_manual';
      const href = node.getAttribute('href');
      if (href) {
        let destination;
        try { destination = new URL(href, location.href); } catch { return 'navigation_manual'; }
        // Full document navigation loses the inspected control/context binding.
        // Leave it manual rather than guessing a site's resume route.
        if (!['http:', 'https:'].includes(destination.protocol) || destination.origin !== location.origin
          || destination.pathname !== location.pathname || destination.search !== location.search) return 'navigation_manual';
      }
    }
    return null;
  }
  function inspect() {
    const rows = candidates();
    return { entryCount: rows.length, action: rows.length === 1 ? rows[0].action : null,
      reason: rows.length > 1 ? 'entry_ambiguous' : rows.length ? refusal(rows[0].node) || 'entry_ready' : 'entry_absent' };
  }
  async function ensure({ ready, allowEntry = false, timeoutMs = 2000, check } = {}) {
    if (typeof ready !== 'function') throw Error('form_readiness_required');
    const initialDocument = document, initialOrigin = location.origin;
    const duration = Number.isFinite(timeoutMs) ? Math.min(Math.max(timeoutMs, 0), 10000) : 2000;
    const deadline = Date.now() + duration, clicked = new WeakSet(), transitions = [];
    const result = (ok, status, reason) => ({ ok, status, reason, transitions,
      entryAttempted: transitions.length > 0, writeAttempted: false, saved: false,
      skippedSave: true, liveSupportClaimed: false });
    const validate = async () => {
      if (document !== initialDocument || location.origin !== initialOrigin) return 'form_document_changed';
      if (document.visibilityState !== 'visible') return 'fill_interrupted_page_hidden';
      if (typeof check === 'function') await check();
      return null;
    };
    for (;;) {
      const invalid = await validate();
      if (invalid) return result(false, 'manual', invalid);
      if (await ready()) {
        // Hydration can replace controls on the next task; require settled readiness.
        await pause(40);
        const changed = await validate();
        if (changed) return result(false, 'manual', changed);
        if (await ready()) return result(true, 'ready', 'form_ready');
      } else if (allowEntry) {
        const rows = candidates();
        if (rows.length > 1) return result(false, 'manual', 'entry_ambiguous');
        if (rows.length === 1 && !clicked.has(rows[0].node)) {
          const { node, action } = rows[0], blocked = refusal(node);
          if (blocked) return result(false, 'manual', blocked);
          if (transitions.length >= 3) return result(false, 'manual', 'entry_transition_limit');
          const changed = await validate();
          if (changed) return result(false, 'manual', changed);
          if (await ready()) continue;
          const current = candidates();
          if (current.length !== 1 || current[0].node !== node || current[0].action !== action
            || !visible(node) || refusal(node)) return result(false, 'manual', 'entry_changed');
          clicked.add(node); transitions.push({ action });
          node.click();
        }
      }
      if (Date.now() >= deadline) return result(false, 'unsupported', 'form_not_ready');
      await pause(Math.min(40, Math.max(deadline - Date.now(), 0)));
    }
  }
  globalThis.ResumeFormFlow = Object.freeze({ version: 1, inspect, ensure, liveSupportClaimed: false });
})();
