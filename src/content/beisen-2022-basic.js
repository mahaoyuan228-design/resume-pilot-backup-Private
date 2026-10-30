// Beisen recruitment-portal-2022 first-slice basic fill (fill-without-save).
// Isolated siteId: beisen-2022. Never clicks 保存/提交/投递. Never touches CMS/GTH/citics/feishu.
//
// First slice fields (provisional labels; live form login-walled on *.zhiye.com):
//   姓名 (text) · 手机号码 (text) · 邮箱 (text)
//
// DOM contract: provisional `.bs-form-item` + label + text input (fixture-backed).
// Public portal-2022 bundles do NOT contain bs-form-item (see _beisen-2022-js-class-hints-20261018.txt).
// Live SPA form class names unproven — login wall; refine after Jeremy login.
// Family tenants: junlebaoruye / invt / jssoft / xiandaimuye / insight-med (same ux-recruitment-portal-2022 chunk).
(() => {
  const previous = globalThis.ResumeBeisen2022Basic;
  if (previous?.listener) {
    try { chrome.runtime.onMessage.removeListener(previous.listener); } catch {}
  }

  const SITE_ID = 'beisen-2022';
  const TEXT_LABELS = ['姓名', '手机号码', '邮箱'];
  /** Provisional fixture / first-slice root; live may differ — fail-closed if missing. */
  const ITEM_SEL = '.bs-form-item';
  const LABEL_SEL = '.bs-form-item-label, label';
  const INPUT_SEL = 'input.bs-input, input[type="text"], input[type="tel"], input[type="email"], input:not([type])';

  const norm = (value) => String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/gu, '')
    .replace(/[\s\u00a0]+/gu, ' ')
    .trim();
  const cleanLabel = (value) => norm(value).replace(/^\*\s*/u, '').replace(/\s*\*$/u, '').replace(/[：:]\s*$/u, '').trim();
  const emptyText = (value) => String(value ?? '').trim() === '';
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function isBeisen2022Host(hostname = location.hostname) {
    const host = String(hostname || '').toLowerCase();
    if (!host) return false;
    if (host === 'zhiye.com' || host.endsWith('.zhiye.com')) return true;
    return false;
  }

  /** True on known zhiye hosts (any path). Resume edit path is login-gated; path not hard-coded yet. */
  function onBeisen2022Page(url = location.href) {
    try {
      const u = new URL(url);
      return (u.protocol === 'https:' || u.protocol === 'http:') && isBeisen2022Host(u.hostname);
    } catch {
      return false;
    }
  }

  function pageAllowed(options) {
    if (onBeisen2022Page()) return true;
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

  function isVisible(node) {
    if (!node?.isConnected) return false;
    for (let ancestor = node; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.hidden || ancestor.hasAttribute('inert') || ancestor.getAttribute('aria-hidden') === 'true') return false;
      const style = getComputedStyle(ancestor);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse'
        || style.opacity === '0' || style.contentVisibility === 'hidden') return false;
    }
    return true;
  }

  function visibleTextInputs(item) {
    return [...item.querySelectorAll(INPUT_SEL)].filter((node) => {
      if (!['text', 'tel', 'email'].includes(node.type)) return false;
      if (node.disabled || node.readOnly || node.matches(':disabled')) return false;
      return isVisible(node);
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

  async function restoreOwnedText(snapshot) {
    const { label, control, beforeRaw, writtenValue } = snapshot;
    if (!control?.isConnected) return { label, restored: false, reason: 'control_detached' };
    if (!hasTextBinding(snapshot)) return { label, restored: false, reason: 'control_rebound' };
    if (control.value === beforeRaw) return { label, restored: true, reason: 'already_restored' };
    // A reactive or user value wins. Cleanup must not overwrite a competing value.
    if (control.value !== writtenValue) return { label, restored: false, reason: 'competing_value_preserved' };
    setNativeValue(control, beforeRaw, snapshot);
    await pause(80);
    const restored = hasTextBinding(snapshot) && control.value === beforeRaw;
    return { label, restored, reason: restored ? 'restored' : 'restore_readback_mismatch' };
  }

  async function fillTextWithNeighbors(label, value, options = {}, neighborSnapshots = null) {
    const expected = norm(value);
    const blocked = (reason, extra = {}) => ({
      label, ok: false, reason, before: '', after: '', expected,
      writeAttempted: false, saved: false, skippedSave: true, liveSupportClaimed: false, ...extra
    });
    if (!pageAllowed(options)) return blocked('wrong_page');
    if (!TEXT_LABELS.includes(label)) return blocked('label_not_allowed');
    if (!expected) return blocked('empty_value');
    const row = classifyField(label);
    if (!row.ready) {
      return blocked(row.reason, {
        matchCount: row.matchCount,
        controlCount: row.controlCount ?? null
      });
    }
    const control = row.control;
    const neighbors = neighborSnapshots ?? snapshotTextNeighbors([control]);
    const finish = (result) => withNeighborReadback(result, neighbors);
    const before = norm(control.value);
    const skipExisting = () => ({
      label, ok: true, reason: 'skipped_existing', before: norm(control.value), after: norm(control.value), expected,
      afterRaw: control.value,
      writeAttempted: false, saved: false, skippedSave: true, liveSupportClaimed: false
    });
    // The fixture has no value-placeholder contract. Every nonempty value is occupied,
    // including prompt-looking text; an input's placeholder attribute is never its value.
    if (!readTextNeighbors(neighbors).neighborsPreserved) return finish(blocked('neighbor_changed'));
    if (!emptyText(control.value)) return finish(skipExisting());
    control.focus();
    const focused = classifyField(label);
    if (!readTextNeighbors(neighbors).neighborsPreserved) return finish(blocked('neighbor_changed'));
    if (!focused.ready || focused.control !== control || focused.item !== row.item) return finish(blocked('control_changed_before_write'));
    if (!emptyText(control.value)) return finish(skipExisting());
    const snapshot = { label, item: row.item, control, beforeRaw: control.value, writtenValue: String(value ?? '') };
    setNativeValue(control, snapshot.writtenValue, snapshot);
    await pause(80);
    const current = classifyField(label);
    const after = current.ready ? norm(current.control.value) : '';
    const neighborsPreserved = readTextNeighbors(neighbors).neighborsPreserved;
    const ok = current.ready && current.item === row.item && current.control === control && after === expected && neighborsPreserved;
    const restore = ok ? null : await restoreOwnedText(snapshot);
    return finish({
      label,
      ok,
      reason: !neighborsPreserved ? 'neighbor_changed' : ok ? 'matched' : 'readback_mismatch',
      before,
      beforeRaw: snapshot.beforeRaw,
      after,
      expected,
      writeAttempted: true,
      restored: restore?.restored ?? false,
      restore,
      saved: false,
      skippedSave: true,
      liveSupportClaimed: false
    });
  }

  async function fillText(label, value, options = {}) {
    return fillTextWithNeighbors(label, value, options);
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
      portal2022: /ux-recruitment-portal-2022/i.test(html),
      bstatics: /bstatics\.com|acdn\.bstatics/i.test(html),
      beisen: /beisen/i.test(html) || /BeiSen/i.test(html),
      zhiye: /zhiye\.com/i.test(html) || /\.zhiye\.com$/i.test(location.hostname),
      legacyCms: /CmsPortal|is-old:\s*true/i.test(html),
      hotjob: /wecruit\.hotjob\.cn|hotjob\.cn/i.test(html),
      atsx: /atsx-throne|saas-career/i.test(html)
    };
    return {
      ...hints,
      looksBeisen2022: (hints.portal2022 || (hints.zhiye && hints.bstatics)) && !hints.legacyCms && !hints.hotjob && !hints.atsx,
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
      ok: onPage && (foundCount >= 1 || fp.looksBeisen2022 || options?.synthetic === true),
      siteId: SITE_ID,
      href: location.href,
      title: document.title,
      onBeisen2022Host: onBeisen2022Page(),
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
            : fp.looksBeisen2022
              ? 'beisen2022_shell_no_form_dom'
              : 'labels_missing',
      saved: false,
      skippedSave: true,
      liveSupportClaimed: false
    };
  }

  async function prepareForm(options = {}) {
    const ready = () => pageAllowed(options) && TEXT_LABELS.every(label => classifyField(label).ready);
    if (!pageAllowed(options)) return { ok: false, status: 'manual', reason: 'wrong_page', entryAttempted: false, writeAttempted: false, liveSupportClaimed: false };
    if (!globalThis.ResumeFormFlow) return { ok: ready(), status: ready() ? 'ready' : 'unsupported',
      reason: ready() ? 'form_ready' : 'form_not_ready', entryAttempted: false, writeAttempted: false, liveSupportClaimed: false };
    return globalThis.ResumeFormFlow.ensure({ ready, allowEntry: options.allowEntry !== false,
      timeoutMs: options.readinessTimeoutMs ?? 2000, check: async () => {
        if (!pageAllowed(options)) throw Error('form_document_changed');
        await globalThis.ResumeProfileWriteContext?.check(false);
        if (options.profileBinding) {
          let verdict;
          try { verdict = await chrome.runtime.sendMessage({ type: 'RESUME_PROFILE_BINDING_CHECK', profileBinding: options.profileBinding }); } catch {}
          if (verdict?.allowed !== true) throw Error('profile_binding_changed');
        }
      } });
  }

  async function fillBasic(rawValues = {}, options = {}) {
    if (!pageAllowed(options)) {
      return {
        ok: false,
        siteId: SITE_ID,
        reason: 'wrong_page',
        href: location.href,
        results: [],
        saved: false,
        skippedSave: true,
        liveSupportClaimed: false,
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
          saved: false,
          skippedSave: true,
          liveSupportClaimed: false,
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
          saved: false,
          skippedSave: true,
          liveSupportClaimed: false,
          writeAttempted: false
        };
      }
      values = plan.values;
    }

    if (globalThis.ResumeFormFlow) {
      const readiness = await prepareForm({ ...options, profileBinding: rawValues.profileBinding || options.profileBinding });
      if (!readiness.ok) return { ok: false, siteId: SITE_ID, status: readiness.status, reason: 'form_not_ready',
        readiness, href: location.href, results: [], writeAttempted: false, saved: false,
        skippedSave: true, liveSupportClaimed: false };
    }
    const textPlan = [
      ['姓名', values.fullName],
      ['手机号码', values.mobile],
      ['邮箱', values.email]
    ];
    const classified = textPlan.map(([label, value]) => {
      const row = classifyField(label);
      return { ...row, expected: norm(value), beforeRaw: row.control?.value };
    });
    if (classified.some((row) => !row.ready)) {
      return {
        ok: false,
        siteId: SITE_ID,
        href: location.href,
        title: document.title,
        reason: 'form_not_ready',
        saved: false,
        skippedSave: true,
        liveSupportClaimed: false,
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
    const results = [];
    const written = [];
    for (const [label, value] of textPlan) {
      if (results.some((row) => !row.ok)) {
        results.push({ label, ok: false, reason: 'skipped_after_failure', before: '', after: '', expected: norm(value), writeAttempted: false });
        continue;
      }
      const row = classifyField(label);
      const planned = classified.find((entry) => entry.label === label);
      if (!row.ready || row.control !== planned.control || row.item !== planned.item) {
        results.push({ label, ok: false, reason: 'control_changed_before_write', before: '', after: '', expected: norm(value), writeAttempted: false });
        continue;
      }
      const snapshot = row.ready ? { label, item: row.item, control: row.control, beforeRaw: row.control.value, writtenValue: String(value) } : null;
      const result = await fillTextWithNeighbors(label, value, options, neighbors);
      results.push(result);
      if (result.writeAttempted && snapshot) written.push({ ...snapshot, beforeRaw: result.beforeRaw });
    }
    // Later field events may reactively replace an earlier value after its first readback.
    for (const snapshot of written) {
      const result = results.find((row) => row.label === snapshot.label);
      const row = classifyField(snapshot.label);
      if (result.ok && (!row.ready || row.item !== snapshot.item || row.control !== snapshot.control || norm(row.control.value) !== result.expected)) {
        result.ok = false;
        result.reason = 'readback_mismatch';
        result.after = row.ready ? norm(row.control.value) : '';
      }
    }
    // Occupied skips retain their raw value at acceptance, even if populated on
    // focus. Recheck them too, without adding them to owned-write rollback.
    const skipped = results.filter((row) => row.reason === 'skipped_existing');
    const readSkipped = () => {
      let preserved = true;
      for (const result of skipped) {
        const snapshot = classified.find((row) => row.label === result.label);
        const row = classifyField(result.label);
        if (!row.ready || row.item !== snapshot.item || row.control !== snapshot.control || row.control.value !== result.afterRaw) {
          preserved = false;
          result.ok = false;
          result.reason = 'readback_mismatch';
          result.after = row.ready ? norm(row.control.value) : '';
        }
      }
      return preserved;
    };
    readSkipped();
    const neighborChanged = results.some((row) => row.reason === 'neighbor_changed') || !readTextNeighbors(neighbors).neighborsPreserved;
    const ok = results.every((row) => row.ok) && !neighborChanged;
    const restore = [];
    if (!ok) {
      for (const snapshot of [...written].reverse()) restore.push(await restoreOwnedText(snapshot));
      // A later cleanup event can repopulate a field restored earlier in this loop.
      for (const snapshot of written) {
        const row = restore.find((entry) => entry.label === snapshot.label);
        if (row.restored && (!hasTextBinding(snapshot) || snapshot.control.value !== snapshot.beforeRaw)) {
          row.restored = false;
          row.reason = 'restore_readback_mismatch';
        }
      }
    }
    // Cleanup can change an unowned skip after its first readback. Retain the
    // accepted receipt even if that readback already changed its result reason.
    const skippedPreserved = readSkipped();
    // Fields never reached after an earlier failure have no accepted skip receipt
    // and are excluded from neighbors. Observe their original state after cleanup;
    // they never become rollback writes or replace the original failure reason.
    const unvisited = readTextNeighbors(classified.filter((snapshot) =>
      results.find((row) => row.label === snapshot.label)?.reason === 'skipped_after_failure'));
    return withNeighborReadback({
      ok,
      siteId: SITE_ID,
      href: location.href,
      title: document.title,
      saved: false,
      skippedSave: true,
      liveSupportClaimed: false,
      writeAttempted: written.length > 0,
      reason: neighborChanged ? 'neighbor_changed' : ok ? (written.length ? 'readback_matched' : 'existing_values_skipped') : 'readback_mismatch',
      restored: !ok && written.length > 0 && restore.every((row) => row.restored) && skippedPreserved && unvisited.neighborsPreserved,
      unvisitedPreserved: unvisited.neighborsPreserved,
      unvisited: unvisited.neighbors,
      restore,
      profileSource: allowExplicit ? 'explicit' : 'resumeProfile',
      planSummary: plan
        ? { reason: plan.reason, readyCount: plan.fields.filter((f) => f.ready).length, blockerCount: plan.blockers.length }
        : { reason: 'explicit_override' },
      results
    }, neighbors);
  }

  const api = {
    siteId: SITE_ID,
    prepareForm,
    liveSupportClaimed: false,
    TEXT_LABELS,
    ITEM_SEL,
    isBeisen2022Host,
    onBeisen2022Page,
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
      if (message.type === 'BEISEN_2022_BASIC_PROBE') {
        probeLabels(message.options || {}).then(sendResponse);
        return true;
      }
      if (message.type === 'BEISEN_2022_BASIC_FILL') {
        fillBasic(message.values || { profile: message.profile }, message.options || {}).then(sendResponse);
        return true;
      }
      return false;
    };
    chrome.runtime.onMessage.addListener(api.listener);
  }

  globalThis.ResumeBeisen2022Basic = api;
})();
