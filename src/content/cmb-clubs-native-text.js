// CMB clubs native controls observed in the 2026-10-19 read-only DOM census.
// Exact IDs and native metadata only; no inferred form, picker, or profile schema.
// Injectable standalone API. Pending live Never-Save acceptance; no support claim.
(() => {
  'use strict';
  const PAGE = 'https://career.cmbchina.com/center/resume';
  const FIELDS = Object.freeze([
  {
    "tag": "input",
    "id": "resume_clubActivityList_0_communityName",
    "name": null,
    "type": "text",
    "role": null,
    "className": "ant-input",
    "placeholder": "请输入",
    "ariaControls": null,
    "ariaLabel": null,
    "labelText": "社团名称",
    "reason": "resume_prefix"
  },
  {
    "tag": "input",
    "id": "resume_clubActivityList_0_schoolOfficeName",
    "name": null,
    "type": "text",
    "role": null,
    "className": "ant-input",
    "placeholder": "请输入",
    "ariaControls": null,
    "ariaLabel": null,
    "labelText": "职务名称",
    "reason": "resume_prefix"
  },
  {
    "tag": "textarea",
    "id": "resume_clubActivityList_0_schoolOfficeDescription",
    "name": null,
    "type": null,
    "role": null,
    "className": "ant-input",
    "placeholder": "可列举参加过的大型活动",
    "ariaControls": null,
    "ariaLabel": null,
    "labelText": "活动描述",
    "reason": "resume_prefix"
  }
].map(field => Object.freeze(field)));
  const BY_ID = new Map(FIELDS.map(field => [field.id, field]));
  let busy = false;
  const flags = () => ({
    siteId: 'cmb', scope: 'cmb_clubs_native_text', complete: false,
    liveSupportClaimed: false, supportClaimed: false, neverSave: true,
    saved: false, submitted: false, skippedSave: true,
    softwareClickedSave: false, softwareClickedSubmit: false,
    softwareClickedDeliver: false, softwareClickedDelete: false, softwareClickedNext: false
  });
  const failure = reason => Object.assign(new Error(reason), { code: reason });
  function page() {
    if (location.href !== PAGE) throw failure('wrong_page');
    if (document.readyState !== 'complete') throw failure('page_not_ready');
    if (document.visibilityState !== 'visible') throw failure('page_hidden');
  }
  function visible(node) {
    if (!node?.isConnected || !node.getClientRects().length) return false;
    for (let current = node; current?.nodeType === 1; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (current.hidden || style.display === 'none' || style.visibility === 'hidden'
        || style.visibility === 'collapse' || Number.parseFloat(style.opacity) === 0) return false;
    }
    return true;
  }
  function locate(field) {
    const nodes = [...document.querySelectorAll('[id]')].filter(node => node.id === field.id);
    if (nodes.length !== 1) throw failure(nodes.length ? 'target_ambiguous' : 'target_missing');
    const node = nodes[0];
    if (node.tagName.toLowerCase() !== field.tag
      || field.type !== null && node.getAttribute('type') !== field.type
      || !String(field.className).split(/\s+/u).filter(name => name && !name.startsWith('ant-input-status-')).every(name => node.classList.contains(name))
      || node.getAttribute('placeholder') !== field.placeholder
      || node.getAttribute('role') !== field.role || node.getAttribute('name') !== field.name
      || node.getAttribute('aria-controls') !== field.ariaControls
      || node.getAttribute('aria-label') !== field.ariaLabel
      || !(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement))
      throw failure('control_structure_changed');
    if (!visible(node)) throw failure('target_hidden');
    if (node.disabled || node.readOnly || node.matches(':disabled')
      || node.closest('[aria-disabled="true"],.disabled,.is-disabled')
      || node.hasAttribute('formaction') || node.hasAttribute('form')) throw failure('target_not_editable');
    return node;
  }
  function snapshot(excluded) {
    return [...document.querySelectorAll('input,select,textarea,[contenteditable]')]
      .filter(node => node !== excluded).map(node => ({
        node,
        descriptor: {
          tag: node.tagName.toLowerCase(), id: node.id || null,
          name: node.getAttribute('name'), type: node.type || '', role: node.getAttribute('role'),
          className: node.getAttribute('class'), ariaHidden: node.getAttribute('aria-hidden')
        },
        state: {
          tag: node.tagName, type: node.type || '', value: node.value ?? null, checked: node.checked ?? null,
          selectedIndex: node.selectedIndex ?? null, disabled: node.disabled ?? null, readOnly: node.readOnly ?? null,
          contenteditable: node.getAttribute('contenteditable'),
          textContent: node.hasAttribute('contenteditable') ? node.textContent : null,
          files: [...(node.files || [])].map(file => [file.name, file.size, file.type])
        }
      }));
  }
  function neighborChanges(before, excluded) {
    const after = snapshot(excluded);
    const oldNodes = new Map(before.map((row, index) => [row.node, { row, index }]));
    const newNodes = new Map(after.map((row, index) => [row.node, { row, index }]));
    const changes = [];
    for (const [index, row] of before.entries()) {
      const current = newNodes.get(row.node);
      if (!current) {
        changes.push({ kind: 'removed', before: row.descriptor, after: null, changedProperties: [] });
        continue;
      }
      const changedProperties = Object.keys(row.state).filter(key =>
        JSON.stringify(row.state[key]) !== JSON.stringify(current.row.state[key]));
      if (changedProperties.length) changes.push({
        kind: 'state_changed', before: row.descriptor, after: current.row.descriptor, changedProperties
      });
      if (current.index !== index) changes.push({
        kind: 'reordered', before: row.descriptor, after: current.row.descriptor, changedProperties: []
      });
    }
    for (const row of after) if (!oldNodes.has(row.node))
      changes.push({ kind: 'added', before: null, after: row.descriptor, changedProperties: [] });
    return changes;
  }
  function planFromProfile(profile) {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)
      || !profile.values || typeof profile.values !== 'object' || Array.isArray(profile.values)
      || !Array.isArray(profile.confirmedFields)) return { ok: false, reason: 'profile_invalid', fields: [] };
    const keys = Object.keys(profile.values);
    if (keys.some(id => !BY_ID.has(id))) return { ok: false, reason: 'field_not_allowed', fields: [] };
    const confirmed = new Set(profile.confirmedFields);
    const fields = keys.map(id => {
      const field = BY_ID.get(id), value = profile.values[id];
      const reason = typeof value !== 'string' ? 'invalid_profile_value'
        : !value.trim() ? 'missing_profile_value'
        : value.length > 20000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
          || field.tag === 'input' && /[\r\n]/u.test(value) ? 'invalid_profile_value'
          : !confirmed.has(id) ? 'profile_fact_unconfirmed' : null;
      return { id, label: field.labelText, value, status: reason ? 'failed' : 'ready', reason };
    });
    const blocked = fields.find(row => row.status === 'failed');
    return { ok: fields.length > 0 && !blocked, reason: blocked?.reason || (fields.length ? null : 'no_fields_requested'), fields };
  }
  function valid(node) {
    return node.getAttribute('aria-invalid') !== 'true' && (!node.validity || node.validity.valid);
  }
  function readback(field, node, expected) {
    page();
    if (locate(field) !== node) throw failure('target_changed');
    if (node.value !== expected) throw failure('readback_mismatch');
  }
  async function execute(profile) {
    const plan = planFromProfile(profile);
    const result = { ...flags(), ok: false, writeAttempted: false, fields: [] };
    if (!plan.ok) return { ...result, reason: plan.reason, fields: plan.fields };
    if (busy) return { ...result, reason: 'fill_busy' };
    busy = true;
    let active = null, activeNode = null, activeBefore = null, changed = false;
    try {
      page();
      // Validate every requested control before any write; never partially apply
      // a plan that is already known to contain an unsafe or missing target.
      const targets = new Map(plan.fields.map(row => [row.id, locate(BY_ID.get(row.id))]));
      for (const row of plan.fields) {
        active = row;
        changed = false;
        const field = BY_ID.get(row.id), node = targets.get(row.id);
        activeNode = node;
        page();
        if (locate(field) !== node) throw failure('target_changed');
        const before = node.value;
        activeBefore = before;
        if (before !== '') {
          if (before === row.value && !valid(node)) throw failure('site_validation_failed');
          result.fields.push({ id: row.id, label: row.label, before, after: before,
            status: before === row.value ? 'verified' : 'skipped',
            reason: before === row.value ? 'preexisting_same_value' : 'existing_value', writeAttempted: false });
          active = null;
          continue;
        }
        if (node.maxLength >= 0 && row.value.length > node.maxLength) throw failure('value_too_long');
        const neighbors = snapshot(node);
        let phase = 'before_write';
        const guard = expected => {
          readback(field, node, expected);
          const changes = neighborChanges(neighbors, node);
          if (changes.length) throw Object.assign(failure('neighbor_changed'), { neighborChanges: changes, phase });
        };
        guard('');
        const prototype = field.tag === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
        if (typeof setter !== 'function') throw failure('native_setter_missing');
        result.writeAttempted = true;
        changed = true;
        phase = 'native_setter';
        setter.call(node, row.value);
        guard(row.value);
        for (const eventName of ['input', 'change', 'blur']) {
          guard(row.value);
          phase = eventName;
          node.dispatchEvent(new Event(eventName, { bubbles: true }));
          guard(row.value);
        }
        await new Promise(resolve => setTimeout(resolve, 40));
        phase = 'settled';
        guard(row.value);
        if (!valid(node)) throw failure('site_validation_failed');
        result.fields.push({ id: row.id, label: row.label, before, after: node.value,
          status: 'verified', reason: 'readback_matched', writeAttempted: true });
        active = null;
      }
      result.ok = result.fields.every(row => row.status === 'verified');
      result.reason = result.fields.find(row => row.status !== 'verified')?.reason || null;
    } catch (error) {
      result.reason = error.code || 'fill_failed';
      let targetVerified = false;
      if (error.code === 'neighbor_changed') {
        // Isolation remains a failed operation. The live TRY captures show that
        // its target may nevertheless retain the exact requested text. Stop all
        // events/writes, then verify that target independently after settling.
        result.neighborCheck = {
          ok: false, reason: 'neighbor_changed', phase: error.phase, changes: error.neighborChanges
        };
        if (active && changed) {
          try {
            await new Promise(resolve => setTimeout(resolve, 40));
            readback(BY_ID.get(active.id), activeNode, active.value);
            if (!valid(activeNode)) throw failure('site_validation_failed');
            targetVerified = true;
          } catch (readbackError) {
            result.reason = readbackError.code || 'fill_failed';
          }
        }
      }
      if (active) result.fields.push({
        id: active.id, label: active.label,
        ...(targetVerified ? { before: activeBefore, after: activeNode.value } : {}),
        status: targetVerified ? 'verified' : 'failed',
        reason: targetVerified ? 'readback_matched' : result.reason, writeAttempted: changed
      });
      for (const row of plan.fields) if (!result.fields.some(item => item.id === row.id))
        result.fields.push({ id: row.id, label: row.label, status: 'failed', reason: 'not_run', writeAttempted: false });
    } finally {
      busy = false;
    }
    return result;
  }
  const api = Object.freeze({
    siteId: 'cmb', fields: FIELDS, planFromProfile,
    fillProfile: execute,
    fillFields(values, options = {}) {
      return execute({ values, confirmedFields: options.confirmedFields });
    },
    async fillField(id, value, options = {}) {
      const response = await execute({ values: { [id]: value }, confirmedFields: options.confirmed === true ? [id] : [] });
      return { ...response, field: response.fields.find(row => row.id === id) || null };
    }
  });
  globalThis.ResumeCmbClubsNativeText = api;
})();
