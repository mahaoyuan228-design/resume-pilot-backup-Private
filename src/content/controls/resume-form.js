// Shared resume-entry / hydration state machine. No ATS tenant or field mapping.
// Entry routes are observations, never permission to activate page handlers.
(() => {
  'use strict';
  if (globalThis.ResumeFormFlow?.version === 1 && globalThis.ResumeFormFlow.revision === 2) return;
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
  function inspect() {
    const rows = candidates(), entryPlan = rows.length === 1 ? navigationPlan(rows[0].node) : null;
    return { entryCount: rows.length, action: rows.length === 1 ? rows[0].action : null,
      entryPlan, reason: rows.length > 1 ? 'entry_ambiguous' : entryPlan
        ? entryPlan.status === 'planned' ? 'entry_activation_manual' : entryPlan.reason : 'entry_absent' };
  }
  // Navigation observations never activate page handlers. Even an ARIA tab or
  // hashchange can autosave; a plan is not permission to click or change the URL.
  const navigationFlags = Object.freeze({ readOnly: true, activation: 'manual',
    navigationAttempted: false, writeStarted: false, writeAttempted: false,
    saved: false, skippedSave: true, liveSupportClaimed: false });
  const navigationControls = 'a,button,[role="tab"],[role="button"],input[type="button"],input[type="submit"]';
  const navigationGroups = 'nav,aside,[role="navigation"],[role="tablist"],[data-wizard],[data-stepper]';
  const uniqueId = id => {
    if (!id) return null;
    const matches = [...document.querySelectorAll('[id]')].filter(node => node.id === id);
    return matches.length === 1 ? matches[0] : null;
  };
  function nonGetEntry(node) {
    // Generic declarative HTTP actions, including inherited/delegated actions.
    // GET metadata is not proof that arbitrary page handlers are safe.
    for (let owner = node; owner; owner = owner.parentElement) {
      if (['method', 'formmethod', 'data-method', 'data-turbo-method', 'data-http-method']
        .some(name => owner.hasAttribute(name) && owner.getAttribute(name).trim().toUpperCase() !== 'GET')
        || ['post', 'put', 'patch', 'delete'].some(method =>
          owner.hasAttribute(`hx-${method}`) || owner.hasAttribute(`data-hx-${method}`))) return true;
    }
    return false;
  }
  function navigationPlan(node) {
    const label = String(node?.getAttribute?.('aria-label') || node?.textContent || node?.value || '')
      .normalize('NFKC').replace(/\s+/gu, ' ').trim().slice(0, 200);
    const result = (reason, strategy = 'none', target = null) => ({
      status: reason ? 'manual' : 'planned', reason: reason || 'navigation_planned',
      label, strategy, target, ...navigationFlags });
    if (node?.nodeType !== 1 || !node.isConnected || node.ownerDocument !== document || node.getRootNode() !== document)
      return result('navigation_target_changed');
    if (document.visibilityState !== 'visible' || !visible(node)) return result('navigation_hidden');
    if (!node.matches(navigationControls)) return result('navigation_unrecognized');
    if (node.disabled || node.matches(':disabled') || node.closest('[aria-disabled="true"],fieldset[disabled]'))
      return result('navigation_disabled');
    if (node.closest('[aria-busy="true"],[aria-readonly="true"],[data-captcha],.g-recaptcha,.h-captcha'))
      return result('navigation_busy_or_captcha');
    if (nonGetEntry(node)) return result('navigation_non_get_manual');
    if (node.matches('input[type="submit"],input[type="image"]') || node.tagName === 'BUTTON' && node.type !== 'button'
      || node.hasAttribute('formaction') || node.hasAttribute('formmethod')) return result('navigation_submit_manual');
    // Check all captions, including an aria-label which may hide a save/next caption.
    const captions = normalize(`${label} ${node.textContent || ''} ${node.value || ''}`).toLowerCase();
    if (/保存|提交|投递|删除|下一步|上一步|继续|完成|确认|save|submit|delete|next|previous|continue|finish|confirm/iu.test(captions))
      return result('navigation_action_manual');
    const owner = node.closest('a,button,input');
    if (owner && owner !== node) return result('navigation_nested_action');
    if (node.matches('a') && node.hasAttribute('href')) {
      if (node.hasAttribute('download') || node.hasAttribute('ping') || node.target && node.target !== '_self')
        return result('navigation_link_manual');
      let destination;
      try { destination = new URL(node.href); }
      catch { return result('navigation_link_manual'); }
      if (!['http:', 'https:'].includes(destination.protocol) || destination.username || destination.password
        || destination.origin !== location.origin || destination.pathname !== location.pathname)
        return result('navigation_link_manual');
      if (destination.search === location.search && destination.hash) {
        let id;
        try { id = decodeURIComponent(destination.hash.slice(1)); }
        catch { return result('navigation_target_unconfirmed'); }
        const targets = [...document.querySelectorAll('[id],a[name]')]
          .filter(target => target.id === id || target.matches('a[name]') && target.getAttribute('name') === id);
        const panel = targets.length === 1 ? targets[0] : null;
        if (!panel || panel.closest('[data-captcha],.g-recaptcha,.h-captcha')) return result('navigation_target_unconfirmed');
        return result(null, panel.id === id ? 'hash' : 'anchor', id);
      }
      if (destination.hash !== location.hash) return result('navigation_link_manual');
      const current = new URL(location.href).searchParams, next = destination.searchParams;
      const changed = [...new Set([...current.keys(), ...next.keys()])]
        .filter(key => JSON.stringify(current.getAll(key)) !== JSON.stringify(next.getAll(key)));
      const key = changed[0], values = next.getAll(key);
      if (changed.length !== 1 || !['step', 'section', 'tab'].includes(key) || values.length !== 1
        || !/^[\p{L}\p{N}_-]{1,80}$/u.test(values[0])) return result('navigation_query_manual');
      return result(null, 'query', `${destination.pathname}${destination.search}${destination.hash}`);
    }
    if (node.getAttribute('role') === 'tab' && node.closest('[role="tablist"]')) {
      const panel = uniqueId(node.getAttribute('aria-controls'));
      const owners = [...document.querySelectorAll('[role="tab"][aria-controls]')]
        .filter(tab => tab.getAttribute('aria-controls') === panel?.id);
      if (uniqueId(node.id) !== node || panel?.getAttribute('role') !== 'tabpanel'
        || panel.getAttribute('aria-labelledby') !== node.id || owners.length !== 1)
        return result('navigation_tab_unconfirmed');
      return result(null, 'tab', panel.id);
    }
    return result('navigation_unrecognized');
  }
  function inspectNavigation() {
    const sections = [...document.querySelectorAll(`${navigationControls},[aria-controls]`)]
      .filter(node => visible(node) && (node.closest(navigationGroups) || node.matches('[role="tab"],[aria-controls]')))
      .map((node, index) => ({ index, ...navigationPlan(node) }));
    const priority = { hash: 0, anchor: 0, query: 1, tab: 2, none: 3 };
    sections.sort((a, b) => priority[a.strategy] - priority[b.strategy] || a.index - b.index);
    const observed = sections.some(row => row.status === 'planned');
    return { status: observed ? 'observed' : 'manual',
      reason: observed ? 'navigation_observed' : sections.length ? 'navigation_manual' : 'navigation_absent',
      sections, ...navigationFlags };
  }
  async function ensure({ ready, allowEntry = false, timeoutMs = 2000, check } = {}) {
    if (typeof ready !== 'function') throw Error('form_readiness_required');
    const initialDocument = document, initialUrl = location.href;
    const duration = Number.isFinite(timeoutMs) ? Math.min(Math.max(timeoutMs, 0), 10000) : 2000;
    const deadline = Date.now() + duration;
    const result = (ok, status, reason, entryPlan = null) => ({ ok, status, reason, entryPlan,
      transitions: [], entryAttempted: false, ...navigationFlags });
    const validate = async () => {
      if (document !== initialDocument || location.href !== initialUrl) return 'form_document_changed';
      if (document.visibilityState !== 'visible') return 'fill_interrupted_page_hidden';
      if (typeof check === 'function') await check();
      if (document !== initialDocument || location.href !== initialUrl) return 'form_document_changed';
      if (document.visibilityState !== 'visible') return 'fill_interrupted_page_hidden';
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
        if (await ready()) {
          const settled = await validate();
          return settled ? result(false, 'manual', settled) : result(true, 'ready', 'form_ready');
        }
      } else if (allowEntry) {
        const rows = candidates();
        if (rows.length > 1) return result(false, 'manual', 'entry_ambiguous');
        if (rows.length === 1) {
          const { node, action } = rows[0];
          const changed = await validate();
          if (changed) return result(false, 'manual', changed);
          if (await ready()) continue;
          const current = candidates();
          if (current.length !== 1 || current[0].node !== node || current[0].action !== action
            || !visible(node)) return result(false, 'manual', 'entry_changed');
          const entryPlan = navigationPlan(node);
          // A click, tab event, hashchange or document navigation may autosave.
          // No execution-level GET-only capability exists here: fail closed.
          return result(false, 'manual', entryPlan.status === 'planned'
            ? 'entry_activation_manual' : entryPlan.reason, entryPlan);
        }
      }
      if (Date.now() >= deadline) return result(false, 'unsupported', 'form_not_ready');
      await pause(Math.min(40, Math.max(deadline - Date.now(), 0)));
    }
  }
  const navigation = Object.freeze({ version: 1, inspect: inspectNavigation, plan: navigationPlan, liveSupportClaimed: false });
  globalThis.ResumeFormFlow = Object.freeze({ version: 1, revision: 2, inspect, ensure, navigation, liveSupportClaimed: false });
})();
