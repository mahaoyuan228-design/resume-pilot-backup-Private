// Shared resume-entry / hydration state machine. No ATS tenant or field mapping.
// Entry routes are observations, never permission to activate page handlers.
(() => {
  'use strict';
  if (globalThis.ResumeFormFlow?.version === 1 && globalThis.ResumeFormFlow.revision === 3) return;
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
  // Page-state evidence is independent of profile values, field semantics and hosts.
  // No events, frame access, navigation, validation or business actions are invoked.
  const editors = 'input,select,textarea,[contenteditable],[role="textbox"],[role="combobox"],'
    + '[role="listbox"],[role="spinbutton"],[role="checkbox"],[role="radio"],[role="switch"],[role="slider"]';
  const requiredRegion = '[required],[aria-required="true"],[data-required="true"],'
    + '.ant-form-item-required,.el-form-item.is-required,.ivu-form-item-required';
  const rendered = node => visible(node) && node.getClientRects().length > 0;
  const unavailable = node => node.matches(':disabled') || node.closest('[aria-disabled="true"],[aria-readonly="true"],fieldset[disabled]');
  function inspectReadiness({ confirmedEditable = [] } = {}) {
    const result = (status, reason, counts = {}) => ({ status, reason,
      visibleControlCount: 0, editableControlCount: 0, visibleRequiredCount: 0, editableRequiredCount: 0,
      ...counts, ...navigationFlags, neverSave: true, saveAttempted: false });
    if (document.visibilityState !== 'visible') return result('form_not_ready', 'page_hidden');
    const all = [...new Set([...document.querySelectorAll(editors), ...confirmedEditable])].filter(node => rendered(node)
      && !confirmedEditable.some(root => root !== node && root.contains(node))
      && !node.matches('input[type="hidden"],input[type="button"],input[type="submit"],input[type="reset"],input[type="image"]'));
    const text = node => String(node.textContent || '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
    const loginCaption = /^(?:登录|登陆|立即登录|用户登录|账号登录|账户登录|手机登录|验证码登录|扫码登录|重新登录|sign\s*in|log\s*in)$/iu;
    const sessionExpired = /(?:请先|需要|尚未|未|重新)(?:登录|登陆)|登录(?:已)?(?:失效|过期)|会话(?:已)?(?:失效|过期)|session\s+expired|please\s+(?:sign|log)\s*in|sign\s*in\s+(?:to\s+continue|required)/iu;
    const loginScopes = [...document.querySelectorAll('form,[role="form"],[role="dialog"],[aria-modal="true"]')].filter(rendered);
    const loginForm = loginScopes.some(scope => {
      const controls = all.filter(node => scope.contains(node));
      const caption = [...scope.querySelectorAll('h1,h2,h3,legend,button,[role="button"],input[type="submit"]')]
        .some(node => rendered(node) && loginCaption.test(node.value || text(node)));
      return controls.some(node => node.matches('input[type="password"][autocomplete="current-password"]'))
        || caption && controls.some(node => node.matches('input[type="password"],input[autocomplete="username"],input[autocomplete="one-time-code"],input[type="tel"],input[type="email"]'));
    });
    const loginWall = [...document.querySelectorAll('h1,h2,[role="alert"],[role="dialog"],main > p,body > p')]
      .some(node => rendered(node) && text(node).length < 240 && sessionExpired.test(text(node)));
    const loginPage = all.some(node => node.matches('input[type="password"]'))
      && [...document.querySelectorAll('h1,h2')].some(node => rendered(node)
        && !node.closest('header,nav,aside') && loginCaption.test(text(node)));
    if (loginForm || loginWall || loginPage || all.some(node => node.matches('input[autocomplete="current-password"]')))
      return result('login_required', 'visible_login_wall');
    const controls = all.filter(node => !node.closest('header,nav,[role="navigation"],[role="search"]')
      && !node.matches('input[type="password"],input[type="search"]:not([role="combobox"])')
      && (node.closest('form,[role="form"]') || node.matches(requiredRegion)
        || node.labels?.length || node.hasAttribute('aria-label') || node.hasAttribute('aria-labelledby')));
    const regions = [...document.querySelectorAll(requiredRegion)].filter(node => rendered(node)
      && !node.closest('header,nav,[role="navigation"],[role="search"]'));
    const ownsRequired = (region, node) => region === node || region.contains(node)
      || node.labels && [...node.labels].includes(region)
      || region.matches('label.ant-form-item-required') && region.closest('.ant-form-item')?.contains(node);
    const required = node => regions.some(region => ownsRequired(region, node)) || !!node.closest(requiredRegion)
      || [...(node.labels || [])].some(label => label.matches(requiredRegion)
        || label.querySelector('[aria-hidden="true"]')?.textContent.trim() === '*');
    const writable = node => !unavailable(node) && !node.closest('[aria-busy="true"]')
      && (confirmedEditable.includes(node) || (node.matches('input,select,textarea') ? !node.readOnly
        : node.hasAttribute('contenteditable') && ['', 'true', 'plaintext-only'].includes(node.getAttribute('contenteditable').toLowerCase())));
    const editable = controls.filter(writable), requiredControls = controls.filter(required);
    const counts = { visibleControlCount: controls.length, editableControlCount: editable.length,
      visibleRequiredCount: requiredControls.length, editableRequiredCount: requiredControls.filter(writable).length };
    const forms = [...document.querySelectorAll('form,[role="form"]')].filter(rendered);
    if ([...document.querySelectorAll('[aria-busy="true"],[role="progressbar"]')].some(node => rendered(node)
      && !node.closest('header,nav,[role="navigation"],[role="search"]')))
      return result('form_not_ready', 'form_loading', counts);
    if ([...document.querySelectorAll('iframe,[data-captcha],.g-recaptcha,.h-captcha,input[autocomplete="one-time-code"]')].some(rendered))
      return result('manual', 'iframe_or_captcha_manual', counts);
    if (regions.some(region => !controls.some(node => ownsRequired(region, node))))
      return result('form_not_ready', 'required_region_empty', counts);
    const unknown = node => !node.matches('input,select,textarea,[contenteditable]')
      || node.readOnly && (node.getAttribute('role') === 'combobox' || node.hasAttribute('aria-haspopup'));
    if (requiredControls.some(node => unknown(node) && !writable(node)))
      return result('manual', 'required_control_unrecognized', counts);
    if (requiredControls.length && !counts.editableRequiredCount)
      return result('form_not_ready', 'required_region_read_only', counts);
    if (editable.length) return result('ready', 'visible_editable_form', counts);
    if (controls.some(unknown)) return result('manual', 'control_unrecognized', counts);
    if (controls.length) return result('form_not_ready', 'form_read_only', counts);
    if (forms.length) return result('form_not_ready', 'form_shell', counts);
    const hasText = node => [...(node?.childNodes || [])].some(child => child.nodeType === 3 && child.textContent.trim());
    const content = hasText(document.body) || [...document.querySelectorAll('body *')].some(node => rendered(node)
      && !node.closest('script,style,template') && (hasText(node) || node.matches('img,svg,canvas,video,button,a')));
    if (!all.length && !content) return result('form_not_ready', 'page_shell', counts);
    return result('manual', 'form_unrecognized', counts);
  }
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
  const readiness = Object.freeze({ version: 1, inspect: inspectReadiness, liveSupportClaimed: false });
  globalThis.ResumeFormFlow = Object.freeze({ version: 1, revision: 3, inspect, ensure, navigation, readiness, liveSupportClaimed: false });
})();
