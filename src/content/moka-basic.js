// Moka ATS first-slice basic fill (fill-without-save).
// Isolated siteId: moka. Never clicks 保存/提交/投递. Never touches CMS/GTH/citics/feishu/beisen.
//
// First slice fields (provisional labels; live form login-walled on app.mokahr.com):
//   姓名 (text) · 手机号码 (text) · 邮箱 (text)
//
// DOM contract: provisional `.moka-form-item` + label + text input (fixture-backed).
// Public recruitment-web-client bundles do NOT contain moka-form-item (CSS hints: apply-form__/campus-apply__;
// see _moka-js-class-hints-20261018.txt). Not adopted yet — would invent live form DOM.
// Live SPA form class names unproven — login wall; refine after Jeremy login.
// Family samples: app.mokahr.com/campus-recruitment/ti/143986 · leniu/36041 · chint/40745 (same static-ats recruitment-web-client build).
(() => {

  const previous = globalThis.ResumeMokaBasic;
  if (previous?.listener) {
    try { chrome.runtime.onMessage.removeListener(previous.listener); } catch {}
  }

  const SITE_ID = 'moka';
  const NEVER_SAVE = Object.freeze({
    saved: false,
    skippedSave: true,
    neverSave: true,
    liveSupportClaimed: false,
    supportClaimed: false
  });
  const TEXT_LABELS = ['姓名', '手机号码', '邮箱'];
  /** Provisional fixture / first-slice root; live may differ — fail-closed if missing. */
  const ITEM_SEL = '.moka-form-item';
  const LABEL_SEL = '.moka-form-item-label, label';
  const INPUT_SEL = 'input.moka-input, input[type="text"], input[type="tel"], input[type="email"], input:not([type])';

  const norm = (value) => String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/gu, '')
    .replace(/[\s\u00a0]+/gu, ' ')
    .trim();
  const cleanLabel = (value) => norm(value).replace(/^\*\s*/u, '').replace(/\s*\*$/u, '').replace(/[：:]\s*$/u, '').trim();
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  // No fixture-backed value sentinel exists. Prompt-looking values are occupied too.
  const emptyText = (value) => String(value ?? '').trim() === '';

  function isMokaHost(hostname = location.hostname) {
    const host = String(hostname || '').toLowerCase();
    if (!host) return false;
    if (host === 'mokahr.com' || host.endsWith('.mokahr.com')) return true;
    return false;
  }

  /** True on known mokahr hosts (any path). Resume edit path is login-gated; path not hard-coded yet. */
  function onMokaPage(url = location.href) {
    try {
      const u = new URL(url);
      return (u.protocol === 'https:' || u.protocol === 'http:') && isMokaHost(u.hostname);
    } catch {
      return false;
    }
  }

  function pageAllowed(options) {
    if (onMokaPage()) return true;
    if (options?.synthetic !== true) return false;
    return location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  }

  function labelText(node) {
    if (!node) return '';
    const clone = node.cloneNode(true);
    clone.querySelectorAll('span,i,svg,em').forEach((child) => {
      const t = norm(child.textContent);
      if (!t || t === '*' || t === '：') child.remove();
    });
    return cleanLabel(clone.textContent);
  }

  function formItems() {
    return [...document.querySelectorAll(ITEM_SEL)];
  }

  function matchingItems(wanted) {
    const want = cleanLabel(wanted);
    return formItems().filter((item) => {
      const label = item.querySelector(LABEL_SEL);
      return label && labelText(label) === want;
    });
  }

  /** Unique label only. Zero or many matches fail closed (no guessed item). */
  function findItem(wanted) {
    const hits = matchingItems(wanted);
    return hits.length === 1 ? hits[0] : null;
  }

  function visibleTextInputs(item) {
    return [...item.querySelectorAll(INPUT_SEL)].filter((node) => {
      if (!['text', 'tel', 'email'].includes(node.type)) return false;
      if (node.disabled || node.readOnly || node.matches(':disabled')) return false;
      for (let ancestor = node; ancestor; ancestor = ancestor.parentElement) {
        if (ancestor.hidden || ancestor.hasAttribute('inert') || ancestor.getAttribute('aria-hidden') === 'true') return false;
        const style = getComputedStyle(ancestor);
        if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
        if (style.opacity === '0' || style.contentVisibility === 'hidden') return false;
      }
      return node.isConnected;
    });
  }

  function textControl(item) {
    const inputs = visibleTextInputs(item);
    return inputs.length === 1 ? inputs[0] : null;
  }

  /**
   * Provisional fixture contract only. Does not invent a live selector.
   * missing → item_not_found; duplicate label → field_ambiguous;
   * zero inputs → control_not_found; several inputs → control_ambiguous.
   */
  function classifyField(label) {
    const hits = matchingItems(label);
    if (hits.length === 0) {
      return { label, ready: false, reason: 'item_not_found', matchCount: 0 };
    }
    if (hits.length !== 1) {
      return { label, ready: false, reason: 'field_ambiguous', matchCount: hits.length };
    }
    const inputs = visibleTextInputs(hits[0]);
    if (inputs.length === 0) {
      return { label, ready: false, reason: 'control_not_found', matchCount: 1, controlCount: 0, item: hits[0] };
    }
    if (inputs.length !== 1) {
      return { label, ready: false, reason: 'control_ambiguous', matchCount: 1, controlCount: inputs.length, item: hits[0] };
    }
    return {
      label,
      ready: true,
      reason: 'unique',
      matchCount: 1,
      controlCount: 1,
      item: hits[0],
      control: inputs[0]
    };
  }

  // Cleanup may restore a hidden owned input, but never a node rebound to a
  // different field/item. Connectivity and value equality alone are not ownership.
  function hasTextBinding({ label, item, control }) {
    const hits = matchingItems(label);
    return control?.isConnected && item?.isConnected
      && hits.length === 1 && hits[0] === item && control.closest(ITEM_SEL) === item;
  }

  // Duplicate labels forbid choosing a write target, but each existing item's
  // single visible/editable text control can still be observed by identity.
  // These snapshots never become owned writes or rollback targets.
  function snapshotTextNeighbors(ownedControls) {
    return formItems().flatMap((item) => {
      const label = labelText(item.querySelector(LABEL_SEL));
      const row = classifyField(label);
      const ambiguousLabel = row.reason === 'field_ambiguous';
      const control = ambiguousLabel ? textControl(item) : row.ready && row.item === item ? row.control : null;
      return control && control.closest(ITEM_SEL) === item && !ownedControls.includes(control)
        ? [{ label, item, control, beforeRaw: control.value, ambiguousLabel }]
        : [];
    });
  }

  function readTextNeighbors(snapshots) {
    const neighbors = snapshots.map((snapshot) => {
      let current = classifyField(snapshot.label);
      if (snapshot.ambiguousLabel) {
        // Never resolve a duplicate through another item with the same caption.
        const control = snapshot.item.isConnected && labelText(snapshot.item.querySelector(LABEL_SEL)) === snapshot.label
          ? textControl(snapshot.item) : null;
        current = { ready: !!control && control.closest(ITEM_SEL) === snapshot.item, item: snapshot.item, control };
      }
      const sameBinding = current.ready && current.item === snapshot.item && current.control === snapshot.control;
      const preserved = sameBinding && snapshot.control.value === snapshot.beforeRaw;
      return {
        label: snapshot.label,
        beforeRaw: snapshot.beforeRaw,
        afterRaw: current.ready ? current.control.value : null,
        originalAfterRaw: snapshot.control.value,
        preserved,
        reason: !sameBinding ? 'neighbor_binding_changed' : preserved ? 'preserved' : 'neighbor_value_changed'
      };
    });
    return { neighborsPreserved: neighbors.every((row) => row.preserved), neighbors };
  }

  function withNeighborReadback(result, snapshots) {
    // Read again after cleanup: target rollback events can change a neighbor too.
    const state = readTextNeighbors(snapshots);
    return {
      ...result,
      ...state,
      ok: result.ok && state.neighborsPreserved,
      reason: state.neighborsPreserved ? result.reason : 'neighbor_changed',
      restored: Boolean(result.restored) && state.neighborsPreserved,
      ...('restoreComplete' in result ? { restoreComplete: result.restoreComplete && state.neighborsPreserved } : {})
    };
  }

  function setNativeValue(input, value, binding) {
    const proto = Object.getPrototypeOf(input);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value')
      || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (desc?.set) desc.set.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    if (!hasTextBinding(binding)) return;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    if (!hasTextBinding(binding)) return;
    input.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function readText(item) {
    const control = textControl(item);
    return control ? norm(control.value) : '';
  }

  async function fillTextAttempt(label, value, neighborSnapshots = null) {
    const expected = norm(value);
    if (!TEXT_LABELS.includes(label) || !expected) {
      return {
        ...NEVER_SAVE,
        label,
        ok: false,
        reason: !TEXT_LABELS.includes(label) ? 'label_not_allowed' : 'empty_value',
        before: '',
        after: '',
        expected,
        writeAttempted: false
      };
    }
    const row = classifyField(label);
    if (!row.ready) {
      return {
        ...NEVER_SAVE,
        label,
        ok: false,
        reason: row.reason,
        matchCount: row.matchCount,
        controlCount: row.controlCount ?? null,
        before: '',
        after: '',
        expected,
        writeAttempted: false
      };
    }
    const control = row.control;
    const neighbors = neighborSnapshots ?? snapshotTextNeighbors([control]);
    const finish = (result) => withNeighborReadback(result, neighbors);
    const before = norm(control.value);
    if (!readTextNeighbors(neighbors).neighborsPreserved) {
      return finish({ ...NEVER_SAVE, label, ok: false, reason: 'neighbor_changed', before, after: before, expected, writeAttempted: false });
    }
    if (!emptyText(control.value)) {
      return finish({ ...NEVER_SAVE, label, ok: true, reason: 'skipped_existing', before, after: before, expected, skipped: true, writeAttempted: false });
    }
    control.focus();
    const focused = classifyField(label);
    if (!readTextNeighbors(neighbors).neighborsPreserved) {
      return finish({ ...NEVER_SAVE, label, ok: false, reason: 'neighbor_changed', before, after: norm(control.value), expected, writeAttempted: false });
    }
    if (!focused.ready || focused.item !== row.item || focused.control !== control || !emptyText(control.value)) {
      return finish({ ...NEVER_SAVE, label, ok: false, reason: 'control_changed_before_write', before, after: norm(control.value), expected, writeAttempted: false });
    }
    setNativeValue(control, expected, row);
    await pause(80);
    const current = classifyField(label);
    const after = norm(control.value);
    const neighborsPreserved = readTextNeighbors(neighbors).neighborsPreserved;
    const ok = current.ready && current.item === row.item && current.control === control && after === expected && neighborsPreserved;
    return finish({
      ...NEVER_SAVE,
      label,
      ok,
      reason: !neighborsPreserved ? 'neighbor_changed' : ok ? 'matched' : 'readback_mismatch',
      before,
      after,
      expected,
      writeAttempted: true
    });
  }

  async function rollbackOwned(writes) {
    const rollback = [];
    for (const row of [...writes].reverse()) {
      if (!hasTextBinding(row)) {
        rollback.push({ label: row.label, restored: false, reason: 'control_rebound' });
        continue;
      }
      // A reactive/user winner belongs to the page. Only undo our still-owned value.
      if (row.control.value !== row.expected) {
        rollback.push({ label: row.label, restored: false, reason: 'competing_value_preserved' });
        continue;
      }
      setNativeValue(row.control, row.original, row);
      await pause(80);
      rollback.push({ label: row.label, restored: row.control.value === row.original, reason: 'restore_attempted' });
    }
    for (const result of rollback) {
      if (result.reason === 'restore_attempted') {
        const row = writes.find((entry) => entry.label === result.label);
        result.restored = hasTextBinding(row) && row.control.value === row.original;
        result.reason = result.restored ? 'restored' : 'restore_mismatch';
      }
    }
    return rollback;
  }

  async function fillText(label, value) {
    const row = classifyField(label);
    const original = row.control?.value;
    const neighbors = row.ready ? snapshotTextNeighbors([row.control]) : [];
    const result = await fillTextAttempt(label, value, neighbors);
    const rollback = !result.ok && result.writeAttempted
      ? await rollbackOwned([{ label, item: row.item, control: row.control, original, expected: norm(value) }])
      : [];
    return withNeighborReadback({
      ...result,
      restored: rollback.length > 0 && rollback.every((entry) => entry.restored),
      restoredCount: rollback.filter((entry) => entry.restored).length,
      restoreComplete: rollback.length > 0 && rollback.every((entry) => entry.restored),
      rollback,
      final: row.control ? norm(row.control.value) : ''
    }, neighbors);
  }

  function planFromProfile(profile) {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
      return { ok: false, reason: 'profile_missing', values: null, fields: [], blockers: [{ reason: 'profile_missing' }] };
    }
    if (!Array.isArray(profile.confirmedFields)) {
      return {
        ok: false,
        reason: 'profile_missing',
        values: null,
        fields: [],
        blockers: [{ reason: 'confirmed_fields_missing' }]
      };
    }
    const confirmed = new Set(profile.confirmedFields.filter((path) => typeof path === 'string'));
    const fullName = norm(profile.fullName || '');
    const mobile = norm(profile.phone || '');
    const email = norm(profile.email || '');
    const core = [
      { label: '姓名', path: 'fullName', value: fullName },
      { label: '手机号码', path: 'phone', value: mobile },
      { label: '邮箱', path: 'email', value: email }
    ].map((row) => {
      let reason = null;
      if (!row.value) reason = 'missing_profile_value';
      else if (!confirmed.has(row.path)) reason = 'profile_fact_unconfirmed';
      return { ...row, ready: reason === null, reason };
    });
    const blockers = core.filter((row) => !row.ready);
    if (blockers.length) {
      return { ok: false, reason: 'profile_fields_unavailable', values: null, fields: core, blockers };
    }
    return {
      ok: true,
      reason: 'profile_ready',
      values: { fullName, mobile, email },
      fields: core,
      blockers: []
    };
  }

  function probeFingerprint() {
    const html = document.documentElement?.innerHTML || '';
    const title = document.title || '';
    const hints = {
      mokahr: /mokahr\.com/i.test(html) || /\.mokahr\.com$/i.test(location.hostname),
      staticAts: /static-ats\.mokahr\.com/i.test(html),
      recruitmentWeb: /recruitment-web-client/i.test(html),
      mokaApply: /moka-apply|useApplyForm/i.test(html),
      hotjob: /wecruit\.hotjob\.cn|hotjob\.cn/i.test(html),
      atsx: /atsx-throne|saas-career/i.test(html),
      beisen: /ux-recruitment-portal-2022|bstatics\.com/i.test(html)
    };
    return {
      ...hints,
      looksMoka: (hints.mokahr || hints.staticAts || hints.recruitmentWeb) && !hints.hotjob && !hints.atsx && !hints.beisen,
      inputCount: document.querySelectorAll('input:not([type=hidden])').length,
      formItemCount: formItems().length,
      foundLabels: TEXT_LABELS.filter((label) => !!findItem(label))
    };
  }

  async function probeLabels(options = {}) {
    const fp = probeFingerprint();
    const labels = TEXT_LABELS.map((label) => {
      const item = findItem(label);
      return {
        label,
        found: !!item,
        hasTextControl: !!item && !!textControl(item),
        value: item ? readText(item) : ''
      };
    });
    const foundCount = labels.filter((row) => row.found && row.hasTextControl).length;
    const onPage = pageAllowed(options);
    return {
      ok: onPage && (foundCount >= 1 || fp.looksMoka || options?.synthetic === true),
      siteId: SITE_ID,
      href: location.href,
      title: document.title,
      onMokaHost: onMokaPage(),
      synthetic: options?.synthetic === true,
      fingerprint: fp,
      labels,
      foundCount,
      reason: !onPage
        ? 'wrong_page'
        : foundCount >= 3
          ? 'labels_ready'
          : foundCount >= 1
            ? 'labels_partial'
            : fp.looksMoka
              ? 'moka_shell_no_form_dom'
              : 'labels_missing',
      ...NEVER_SAVE
    };
  }

  async function fillBasic(rawValues = {}, options = {}) {
    if (!pageAllowed(options)) {
      return {
        ok: false,
        siteId: SITE_ID,
        reason: 'wrong_page',
        href: location.href,
        results: [],
        ...NEVER_SAVE,
        writeAttempted: false
      };
    }

    const profile = rawValues.profile;
    const allowExplicit = rawValues.allowExplicitValues === true;
    let values = null;
    let plan = null;

    if (allowExplicit && (rawValues.fullName || rawValues.mobile || rawValues.email)) {
      values = {
        fullName: norm(rawValues.fullName || ''),
        mobile: norm(rawValues.mobile || rawValues.phone || ''),
        email: norm(rawValues.email || '')
      };
      if (!values.fullName || !values.mobile || !values.email) {
        return {
          ok: false,
          siteId: SITE_ID,
          reason: 'explicit_values_incomplete',
          href: location.href,
          results: [],
          ...NEVER_SAVE,
          writeAttempted: false
        };
      }
    } else {
      plan = planFromProfile(profile);
      if (!plan.ok) {
        return {
          ok: false,
          siteId: SITE_ID,
          reason: plan.reason,
          href: location.href,
          title: document.title,
          results: (plan.fields || []).map((row) => ({
            label: row.label,
            ok: false,
            reason: row.reason || plan.reason,
            before: '',
            after: '',
            expected: row.value || '',
            path: row.path
          })),
          blockers: plan.blockers,
          ...NEVER_SAVE,
          writeAttempted: false
        };
      }
      values = plan.values;
    }

    const textPlan = [
      ['姓名', values.fullName],
      ['手机号码', values.mobile],
      ['邮箱', values.email]
    ];
    const classified = textPlan.map(([label, value]) => ({ ...classifyField(label), expected: norm(value) }));
    if (classified.some((row) => !row.ready)) {
      return {
        ok: false,
        siteId: SITE_ID,
        href: location.href,
        title: document.title,
        reason: 'form_not_ready',
        ...NEVER_SAVE,
        writeAttempted: false,
        profileSource: allowExplicit ? 'explicit' : 'resumeProfile',
        results: classified.map((row) => ({
          label: row.label,
          ok: false,
          reason: row.ready ? 'skipped_form_not_ready' : row.reason,
          matchCount: row.matchCount,
          controlCount: row.controlCount ?? null,
          before: '',
          after: '',
          expected: row.expected
        }))
      };
    }
    const neighbors = snapshotTextNeighbors(classified.map((row) => row.control));
    const snapshots = classified.map((row) => ({ ...row, original: row.control.value }));
    const results = [];
    const writes = [];
    let failure = null;
    for (const row of snapshots) {
      const current = classifyField(row.label);
      if (!current.ready || current.item !== row.item || current.control !== row.control || row.control.value !== row.original) {
        failure = 'control_changed_before_write';
        results.push({ ...NEVER_SAVE, label: row.label, ok: false, reason: failure, before: norm(row.original), after: norm(row.control.value), expected: row.expected, writeAttempted: false });
        break;
      }
      const result = await fillTextAttempt(row.label, row.expected, neighbors);
      results.push(result);
      if (result.writeAttempted) writes.push(row);
      if (!result.ok) {
        failure = result.reason;
        break;
      }
    }
    // Later reactive events can replace an earlier value after its first readback.
    if (!failure) {
      for (const row of snapshots) {
        const current = classifyField(row.label);
        const expected = writes.includes(row) ? row.expected : row.original;
        if (!current.ready || current.item !== row.item || current.control !== row.control || row.control.value !== expected) {
          failure = 'readback_mismatch';
          const result = results.find((entry) => entry.label === row.label);
          Object.assign(result, { ok: false, reason: failure, after: norm(row.control.value) });
          break;
        }
      }
    }
    if (!readTextNeighbors(neighbors).neighborsPreserved) failure = 'neighbor_changed';
    const rollback = failure ? await rollbackOwned(writes) : [];
    for (const result of results) {
      const row = snapshots.find((entry) => entry.label === result.label);
      result.final = norm(row.control.value);
    }
    const ok = !failure;
    return withNeighborReadback({
      ok,
      siteId: SITE_ID,
      href: location.href,
      title: document.title,
      ...NEVER_SAVE,
      reason: failure || (writes.length ? 'readback_matched' : 'skipped_existing'),
      writeAttempted: writes.length > 0,
      restored: rollback.length > 0 && rollback.every((row) => row.restored),
      restoredCount: rollback.filter((row) => row.restored).length,
      restoreComplete: rollback.length > 0 && rollback.every((row) => row.restored),
      rollback,
      profileSource: allowExplicit ? 'explicit' : 'resumeProfile',
      planSummary: plan
        ? { reason: plan.reason, readyCount: plan.fields.filter((f) => f.ready).length, blockerCount: plan.blockers.length }
        : { reason: 'explicit_override' },
      results
    }, neighbors);
  }

  const api = {
    siteId: SITE_ID,
    TEXT_LABELS,
    ITEM_SEL,
    isMokaHost,
    onMokaPage,
    findItem,
    textControl,
    fillText,
    fillBasic,
    probeLabels,
    probeFingerprint,
    planFromProfile,
    listener: null
  };

  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    api.listener = (message, _sender, sendResponse) => {
      if (!message || (message.siteId && message.siteId !== SITE_ID)) return false;
      if (message.type === 'MOKA_BASIC_PROBE') {
        probeLabels(message.options || {}).then(sendResponse);
        return true;
      }
      if (message.type === 'MOKA_BASIC_FILL') {
        fillBasic(message.values || { profile: message.profile }, message.options || {}).then(sendResponse);
        return true;
      }
      return false;
    };
    chrome.runtime.onMessage.addListener(api.listener);
  }

  globalThis.ResumeMokaBasic = api;
})();
