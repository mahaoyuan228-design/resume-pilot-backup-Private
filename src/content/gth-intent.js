// Shipped GTH 求职意向 fill. Message: GTH_INTENT_FILL (not the removed test hook).
// Five requested questions. A field is written only when its control shape is
// the plain-text contract already in the shipped salary trial. Closed-card
// labels in dist/site-probes/probe-gth-edit.json are not editor selectors.
// tests/fixtures/live-harvest/20261019/gth-readiness.json opened 基本信息, not
// this section. Cascader clicks from the removed hook are not replayed.
// Unsupported or unsettled rows are failed, never skipped, and the fill is
// not complete. Never clicks 保存 / 提交 / 投递.
(() => {
  const previous = globalThis.ResumeGthIntent;
  if (previous?.listener) try { chrome.runtime.onMessage.removeListener(previous.listener); } catch { /* reload */ }
  const PAGE = 'https://hr.gtht.com/resume/edit/';
  const SECTION = '求职意向';
  const SECTION_INDEX = 2;
  const TITLES = ['基本信息','教育经历','求职意向','工作经验','职业技能与特长','附件简历','其他信息'];
  const FIELDS = [
    {question:'期望从事职位类别', kind:'unsupported', evidence:'probe-gth-edit.json closed-card label only'},
    {question:'期望薪资', kind:'text', evidence:'engine.js gthSalaryTrial plain text; probe-gth-edit.json label'},
    {question:'现从事行业', kind:'unsupported', evidence:'probe-gth-edit.json closed-card label only'},
    {question:'现从事职位类别', kind:'unsupported', evidence:'probe-gth-edit.json closed-card label only'},
    {question:'现薪资', kind:'unsupported', evidence:'probe-gth-edit.json closed-card label only; salary trial does not name this control'}
  ];
  const norm = value => String(value ?? '').replace(/[\s\u00a0]+/gu,' ').trim();
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const visible = node => !!node?.getClientRects().length
    && getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden';
  const state = {busy:false, last:null, progress:null};
  class Stop extends Error { constructor(code){ super(code); this.code = code; } }
  const stop = code => { throw new Stop(code); };
  let activeBinding = null, lastBinding = null;
  async function checkBinding(binding = activeBinding) {
    if (binding?.version !== 1 || typeof binding.epoch !== 'string' || !(/^[a-f0-9]{64}$/u.test(binding.profileHash || ''))) stop('profile_binding_required');
    let response;
    try { response = await chrome.runtime.sendMessage({type:'RESUME_PROFILE_BINDING_CHECK', profileBinding:binding}); } catch { /* unavailable */ }
    if (response?.allowed !== true) stop('profile_binding_changed');
  }
  async function boundAction(action) {
    await checkBinding();
    if (location.href !== PAGE || document.visibilityState !== 'visible') stop('profile_action_page_changed');
    return action();
  }
  const step = value => { if (state.progress) state.progress.selectorStep = value; };
  const valueRows = root => [...root.querySelectorAll('input,select,textarea')].map(node => [
    node.tagName, node.type || '', node.value || '', !!node.checked, node.selectedIndex ?? null,
    [...(node.files || [])].map(file => [file.name, file.size, file.type])]);
  const snapshot = root => JSON.stringify([root.textContent || '', valueRows(root)]);
  const outside = sections => JSON.stringify(sections.filter((_, index) => index !== SECTION_INDEX).map(snapshot));
  const sectionForms = sections => [...sections[SECTION_INDEX].querySelectorAll('form')];
  const otherSectionForms = sections => sections.flatMap((section, index) => index === SECTION_INDEX ? [] : [...section.querySelectorAll('form')]);
  const cancelButtons = form => [...form.querySelectorAll('button')].filter(node =>
    visible(node) && node.type === 'button' && norm(node.textContent) === '取消'
    && !node.disabled && !node.hasAttribute('formaction'));
  const valuesExcept = (form, excluded = []) => JSON.stringify(
    [...form.querySelectorAll('input,select,textarea')].filter(node => !excluded.includes(node)).map(node => [
      node.tagName, node.type || '', node.value || '', !!node.checked, node.selectedIndex ?? null,
      [...(node.files || [])].map(file => [file.name, file.size, file.type])]));
  function page() {
    if (location.href !== PAGE) stop('wrong_page');
    if (document.readyState !== 'complete') stop('page_not_ready');
    if (document.visibilityState !== 'visible') stop('page_hidden');
    const sections = [...document.querySelectorAll('.r-section')];
    const titles = sections.map(section => {
      const node = section.querySelector('.title_')?.cloneNode(true);
      node?.querySelectorAll('a,button').forEach(child => child.remove());
      return norm(node?.textContent);
    });
    if (JSON.stringify(titles) !== JSON.stringify(TITLES)) stop('section_structure_changed');
    return sections;
  }
  async function dismissCancelOnly(form) {
    const cancel = cancelButtons(form);
    if (cancel.length !== 1) return false;
    await boundAction(() => { if (!cancel[0]?.isConnected) stop('profile_action_target_changed'); return cancel[0].click(); });
    return true;
  }
  async function clearForeignEditors() {
    let sections = page();
    for (const form of otherSectionForms(sections)) {
      if (!(await dismissCancelOnly(form))) stop('other_section_editor_open');
    }
    const deadline = Date.now() + 4000;
    do {
      await pause(40);
      sections = page();
      if (!otherSectionForms(sections).length) break;
    } while (Date.now() < deadline);
    if (otherSectionForms(sections).length) stop('other_section_editor_open');
    return page();
  }
  function ownLabel(item) {
    const labels = [...item.querySelectorAll('.el-form-item__label')].filter(node => node.closest('.el-form-item') === item);
    return labels.length === 1 ? norm(labels[0].textContent) : '';
  }
  function textTarget(form, question) {
    const items = [...form.querySelectorAll('.el-form-item')].filter(item => ownLabel(item) === question);
    if (items.length !== 1) stop('intent_target_not_unique');
    const item = items[0];
    const controls = [...item.querySelectorAll('input,select,textarea')]
      .filter(node => node.closest('.el-form-item') === item && !node.closest('.popover.plugin-dialog-wrap'));
    const exposed = controls.filter(visible);
    const input = exposed[0];
    if (controls.length !== 1 || exposed.length !== 1 || !(input instanceof HTMLInputElement)
      || input.type !== 'text' || input.readOnly || input.disabled || !visible(input)
      || input.closest('.el-select,.el-date-editor,.el-cascader,.cascader-wrap'))
      stop('intent_target_not_plain_text');
    return {item, input, controls};
  }
  const sameTarget = (left, right) => left.item === right.item && left.input === right.input;
  function siteValid(target) {
    return !target.item.classList.contains('is-error') && !target.item.classList.contains('is-validating')
      && ![...target.item.querySelectorAll('.el-form-item__error')].some(node => visible(node) && norm(node.textContent))
      && target.input.getAttribute('aria-invalid') !== 'true'
      && (!target.input.validity || target.input.validity.valid);
  }
  function overwriteProgressOk(readVal, existing, answer) {
    return readVal === '' || readVal === existing || norm(readVal) === norm(answer);
  }
  async function waitFor(read, timeout = 4000) {
    const deadline = Date.now() + timeout;
    do {
      const found = read();
      if (found) return found;
      await pause(40);
    } while (Date.now() < deadline);
    stop('intent_widget_timeout');
  }
  function factRow(request, question) {
    const profile = request?.profile;
    const fromProfile = profile && typeof profile === 'object' && !Array.isArray(profile);
    const raw = fromProfile ? profile.customAnswers?.[question] : request?.answers?.[question];
    const answer = typeof raw === 'string' ? raw : '';
    const salary = question === '期望薪资' || question === '现薪资';
    const shapeOk = !!answer.trim() && answer.length <= 80 && !/[\r\n\u0000-\u001f]/u.test(answer)
      && (!salary || /^\d{1,10}$/u.test(answer.trim()));
    if (!shapeOk) return {value:'', reason: answer.trim() ? 'invalid_profile_value' : 'missing_profile_value'};
    if (!fromProfile) return {value:answer, reason:'profile_fact_unconfirmed'};
    const confirmed = new Set(Array.isArray(profile.confirmedFields) ? profile.confirmedFields : []);
    const facts = (Array.isArray(profile.customFacts) ? profile.customFacts : []).filter(item => item?.question === question);
    const fact = facts.length === 1 ? facts[0] : null;
    const factOk = !!fact && fact.answer === answer && fact.sitePageUrl === PAGE
      && fact.sectionName === SECTION && fact.rowContext === 'none';
    if (!factOk || !confirmed.has(`customAnswers.${question}`)) return {value:answer, reason:'profile_fact_unconfirmed'};
    return {value:answer, reason:null};
  }
  function fieldRow(field, status, reason) {
    return {id:`gth:求职意向:${field.question}`, question:field.question, labels:[field.question],
      path:`customAnswers.${field.question}`, status, reason, supported:field.kind === 'text'};
  }
  async function trial(request) {
    try {
      const manifest = chrome.runtime.getManifest();
      if (manifest.background?.service_worker === 'src/license/guard-worker.mjs') {
        const verdict = await chrome.runtime.sendMessage({type:'RESUME_PAID_VERIFY'});
        if (verdict?.allowed !== true) throw new Stop('license_required');
      }
    } catch {
      const info = {reason:'license_required', activeField:null, selectorStep:'license_check', completedFields:[], writeStarted:false};
      if (!state.busy) state.last = {requestId:request?.requestId, outcome:'failed_before_write', info};
      return {ok:false, ...info, fields:[], complete:false, supportedComplete:false, operableComplete:false,
        writeStarted:false, editorLeftOpen:false, savedOnSite:null, submitted:null, softwareClickedSave:false,
        softwareClickedSubmit:false, softwareClickedDelete:false, scope:'gth_intent_five', liveSupportClaimed:false};
    }
    const result = {fields:[], coverage:FIELDS.map(field => fieldRow(field, 'failed', field.kind === 'unsupported' ? 'control_not_supported' : 'not_run')),
      complete:false, supportedComplete:false, operableComplete:false, writeStarted:false, editorLeftOpen:false,
      savedOnSite:null, submitted:null, softwareClickedSave:false, softwareClickedSubmit:false, softwareClickedDelete:false,
      scope:'gth_intent_five', liveSupportClaimed:false, section:SECTION};
    if (state.busy) return {ok:false, reason:'fill_in_progress', ...result};
    state.busy = true;
    activeBinding = request?.profileBinding;
    lastBinding = activeBinding;
    state.progress = {requestId:request?.requestId, activeField:null, selectorStep:'request_validation', completedFields:[], writeStarted:false};
    const markWrite = () => { result.writeStarted = true; state.progress.writeStarted = true; };
    const record = (field, status, reason) => {
      const row = fieldRow(field, status, reason);
      const index = result.fields.findIndex(item => item.question === field.question);
      if (index >= 0) result.fields[index] = row; else result.fields.push(row);
      const covered = result.coverage.find(item => item.question === field.question);
      if (covered) Object.assign(covered, row);
      state.progress.completedFields = state.progress.completedFields.filter(item => item.question !== field.question);
      state.progress.completedFields.push({question:field.question, status, reason});
    };
    let form = null, openedByUs = false;
    try {
      await checkBinding();
      if (typeof request?.requestId !== 'string' || !/^[A-Za-z0-9-]{10,100}$/u.test(request.requestId)
        || request.replaceExisting !== undefined && typeof request.replaceExisting !== 'boolean') stop('intent_request_invalid');
      const answers = Object.fromEntries(FIELDS.map(field => [field.question, factRow(request, field.question)]));
      const unsettled = FIELDS.filter(field => answers[field.question].reason);
      if (unsettled.length) {
        for (const field of FIELDS) {
          const reason = answers[field.question].reason || 'blocked_by_unsettled_field';
          record(field, 'failed', reason);
        }
        const info = {reason:answers[unsettled[0].question].reason, activeField:unsettled[0].question, selectorStep:'field_decision',
          completedFields:state.progress.completedFields.map(item => ({...item})), writeStarted:false};
        state.last = {requestId:request.requestId, outcome:'failed_before_write', info};
        return {ok:false, ...result, ...info};
      }
      step('page_preflight');
      let sections = await clearForeignEditors();
      const origin = performance.timeOrigin;
      const otherBefore = outside(sections);
      let editors = sectionForms(sections);
      if (editors.length > 1) stop('intent_editor_not_unique');
      if (otherSectionForms(sections).length) stop('other_section_editor_open');
      if (!editors.length) {
        const links = [...sections[SECTION_INDEX].querySelectorAll('.title_ a.h-e-btn')]
          .filter(node => visible(node) && norm(node.textContent) === '编辑');
        if (links.length !== 1) stop('intent_edit_not_unique');
        const href = links[0].getAttribute('href');
        if (href && !/^(#|javascript:(?:;|void\(0\)))$/iu.test(href)) stop('intent_edit_not_unique');
        step('editor_open');
        await boundAction(() => { if (!links[0]?.isConnected) stop('profile_action_target_changed'); return links[0].click(); });
        openedByUs = true;
        form = await waitFor(() => {
          sections = page();
          const found = sectionForms(sections);
          if (found.length > 1) stop('intent_editor_not_unique');
          if (otherSectionForms(sections).length) stop('other_section_editor_open');
          return found.length === 1 && found[0].querySelector('.el-form-item') ? found[0] : null;
        });
      } else form = editors[0];
      result.editorLeftOpen = true;
      if (outside(page()) !== otherBefore || performance.timeOrigin !== origin) stop('intent_other_values_changed');
      const targets = {};
      for (const field of FIELDS) {
        state.progress.activeField = field.question;
        if (field.kind !== 'text') {
          record(field, 'failed', 'control_not_supported');
          continue;
        }
        step('target_preflight');
        targets[field.question] = textTarget(form, field.question);
      }
      for (const field of FIELDS.filter(item => item.kind === 'text')) {
        state.progress.activeField = field.question;
        step('field_decision');
        const selected = targets[field.question];
        const answer = answers[field.question].value;
        const existing = selected.input.value;
        if (existing !== '' && norm(existing) === norm(answer)) {
          record(field, 'verified', 'preexisting_same_value');
          continue;
        }
        if (existing !== '' && request.replaceExisting !== true) {
          record(field, 'failed', 'existing_value');
          continue;
        }
        if (selected.input.maxLength >= 0 && answer.length > selected.input.maxLength) stop('intent_value_too_long');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (!setter) stop('native_setter_missing');
        const untouched = valuesExcept(form, selected.controls);
        const guard = expectedOwn => {
          const live = page();
          const current = textTarget(form, field.question);
          const readVal = current.input.value;
          const progressOk = request.replaceExisting === true
            ? overwriteProgressOk(readVal, existing, answer)
            : readVal === expectedOwn;
          if (performance.timeOrigin !== origin || outside(live) !== otherBefore
            || sectionForms(live).length !== 1 || sectionForms(live)[0] !== form
            || !sameTarget(selected, current) || valuesExcept(form, selected.controls) !== untouched || !progressOk)
            stop('intent_other_values_changed');
        };
        step('field_guard');
        guard(existing);
        step('text_input_events');
        markWrite();
        await boundAction(() => { if (!selected.input?.isConnected) stop('profile_action_target_changed'); return setter.call(selected.input, answer); });
        guard(answer);
        await boundAction(() => { if (!selected.input?.isConnected) stop('profile_action_target_changed'); return selected.input.dispatchEvent(new Event('input', {bubbles:true})); });
        await boundAction(() => { if (!selected.input?.isConnected) stop('profile_action_target_changed'); return selected.input.dispatchEvent(new Event('change', {bubbles:true})); });
        await boundAction(() => { if (!selected.input?.isConnected) stop('profile_action_target_changed'); return selected.input.dispatchEvent(new Event('blur', {bubbles:true})); });
        step('field_readback');
        await pause(80);
        guard(answer);
        if (selected.input.value !== answer) stop('intent_readback_mismatch');
        if (!siteValid(selected)) stop('intent_site_validation_failed');
        record(field, 'verified', existing === '' ? 'readback_matched' : 'readback_reapplied');
      }
      result.fields = FIELDS.map(field => result.fields.find(row => row.question === field.question) || fieldRow(field, 'failed', 'not_run'));
      result.supportedComplete = result.fields.length === FIELDS.length && result.fields.every(row => row.status === 'verified');
      result.operableComplete = result.supportedComplete;
      result.complete = false;
      if (openedByUs && !result.writeStarted && result.supportedComplete !== true && form?.isConnected) {
        if (await dismissCancelOnly(form)) result.editorLeftOpen = false;
      }
      const failed = result.fields.find(row => row.status !== 'verified');
      const outcome = !failed && result.fields.some(row => row.reason === 'readback_matched' || row.reason === 'readback_reapplied')
        ? 'verified'
        : !failed ? 'verified_preexisting' : (result.writeStarted ? 'unknown' : 'failed_before_write');
      const info = {reason:failed ? failed.reason : null, activeField:null, selectorStep:failed ? 'field_decision' : 'complete',
        completedFields:result.fields.map(row => ({question:row.question, status:row.status, reason:row.reason})),
        writeStarted:result.writeStarted, supportedComplete:result.supportedComplete, operableComplete:result.operableComplete, complete:false};
      state.last = {requestId:request.requestId, outcome, info, currentCheck:() => {
        try {
          if (!result.supportedComplete) return false;
          const live = page();
          return performance.timeOrigin === origin && outside(live) === otherBefore && sectionForms(live)[0] === form
            && FIELDS.every(field => {
              if (field.kind !== 'text') return false;
              const current = textTarget(form, field.question);
              return sameTarget(targets[field.question], current) && current.input.value === answers[field.question].value && siteValid(current);
            });
        } catch { return false; }
      }};
      return {ok:result.supportedComplete === true, ...result, ...info};
    } catch (error) {
      const reason = error instanceof Stop ? error.code : 'intent_fill_failed';
      for (const field of FIELDS) {
        if (!result.fields.some(row => row.question === field.question)) {
          record(field, 'failed', field.kind === 'unsupported' ? 'control_not_supported' : reason);
        }
      }
      if (openedByUs && !result.writeStarted && form?.isConnected) {
        const cancel = cancelButtons(form);
        if (cancel.length === 1) {
          try {
            await boundAction(() => { if (!cancel[0]?.isConnected) stop('profile_action_target_changed'); return cancel[0].click(); });
            result.editorLeftOpen = false;
          } catch { /* leave the editor; the failure is already recorded */ }
        }
      }
      const info = {reason, activeField:state.progress?.activeField || null, selectorStep:state.progress?.selectorStep || 'not_started',
        completedFields:(state.progress?.completedFields || []).map(item => ({...item})), writeStarted:result.writeStarted,
        supportedComplete:false, operableComplete:false, complete:false};
      state.last = {requestId:request?.requestId, outcome:result.writeStarted ? 'unknown' : 'failed_before_write', info};
      return {ok:false, ...result, supportedComplete:false, operableComplete:false, ...info};
    } finally {
      state.busy = false;
      activeBinding = null;
    }
  }
  const listener = (message, sender, sendResponse) => {
    if (message?.type === 'GTH_INTENT_FILL_STATUS') {
      (async () => {
        if (sender?.id !== chrome.runtime.id) { sendResponse({ok:false, error:'profile_wrong_sender', writeStarted:false}); return; }
        if (message.profileBinding) await checkBinding(message.profileBinding);
        await checkBinding(lastBinding || activeBinding);
        const running = state.busy && state.progress?.requestId === message.requestId;
        const last = state.last?.requestId === message.requestId ? state.last : null;
        const outcome = last?.currentCheck ? (last.currentCheck() ? last.outcome : 'unknown') : (last?.outcome || 'unknown');
        sendResponse({ok:true, data:{requestId:message.requestId, state:running ? 'running' : 'settled', outcome,
          ...(running ? {writeStarted:state.progress.writeStarted === true} : last?.info || {writeStarted:false})}});
      })().catch(() => sendResponse({ok:false, error:'profile_binding_changed', data:{requestId:message?.requestId, state:'settled', outcome:'unknown'}}));
      return true;
    }
    if (message?.type !== 'GTH_INTENT_FILL') return;
    if (sender?.id !== chrome.runtime.id) { sendResponse({ok:false, error:'profile_wrong_sender', fillNotStarted:true, writeStarted:false}); return false; }
    trial(message).then(sendResponse, () => sendResponse({ok:false, reason:'intent_fill_failed', writeStarted:false, supportedComplete:false, operableComplete:false, complete:false}));
    return true;
  };
  globalThis.ResumeGthIntent = Object.freeze({
    implementationRevision:1, installed:true, trial, listener,
    fields:FIELDS.map(field => ({question:field.question, kind:field.kind, evidence:field.evidence}))
  });
  chrome.runtime.onMessage.addListener(listener);
})();
