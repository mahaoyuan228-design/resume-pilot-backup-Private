// Narrow 国泰海通「其他信息」fill-without-save. Values come only from a
// confirmed resumeProfile (customAnswers + one matching customFact per
// question). Caller-supplied answers are not a fill source. A missing or
// unconfirmed value fails closed and is not invented. liveSupportClaimed
// stays false. This file does not claim the site is supported. Never clicks
// 保存 / 提交 / 投递 / 删除. The editor is left open.
(() => {
  if (globalThis.ResumeGthOtherSection && globalThis.ResumeGthOtherSectionRevision===4) return;

  const PAGE = 'https://hr.gtht.com/resume/edit/';
  const TITLES = ['基本信息', '教育经历', '求职意向', '工作经验',
    '职业技能与特长', '附件简历', '其他信息'];
  const SECTION = '其他信息';
  const FIELDS = [
    { question: '描述', kind: 'textarea' },
    { question: '标题', kind: 'input' }
  ];
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const norm = value => String(value ?? '').replace(/[\s\u00a0]+/gu, ' ').trim();
  const visible = node => !!node?.getClientRects().length
    && getComputedStyle(node).display !== 'none'
    && getComputedStyle(node).visibility !== 'hidden';
  const controlState = node => [node.tagName, node.type || '', node.value || '',
    !!node.checked, node.selectedIndex ?? null,
    [...(node.files || [])].map(file => [file.name, file.size, file.type])];
  const sectionState = section => JSON.stringify({ text: section.textContent || '',
    controls: [...section.querySelectorAll('input,select,textarea')].map(controlState),
    editable: [...section.querySelectorAll('[contenteditable]')]
      .map(node => node.textContent || '') });
  let busy = false;

  class Stop extends Error {
    constructor(code) { super(code); this.code = code; }
  }
  const stop = code => { throw new Stop(code); };
  let activeBinding=null,lastBinding=null;
  async function checkBinding(binding=activeBinding) {
    if(binding?.version!==1||typeof binding.epoch!=='string'||!(/^[a-f0-9]{64}$/u.test(binding.profileHash||'')))stop('profile_binding_required');
    let response;try{response=await chrome.runtime.sendMessage({type:'RESUME_PROFILE_BINDING_CHECK',profileBinding:binding});}catch{}
    if(response?.allowed!==true)stop('profile_binding_changed');
  }
  async function boundAction(action){await checkBinding();if(location.href!==PAGE||document.visibilityState!=='visible')stop('profile_action_page_changed');return action();}

  function sectionsAt(timeOrigin) {
    if (location.href !== PAGE) stop('wrong_page');
    if (document.readyState !== 'complete') stop('page_not_ready');
    if (document.visibilityState !== 'visible') stop('page_hidden');
    if (performance.timeOrigin !== timeOrigin) stop('page_reloaded');
    const sections = [...document.querySelectorAll('.r-section')];
    const title = section => {
      const copy = section.querySelector('.title_')?.cloneNode(true);
      copy?.querySelectorAll('a,button').forEach(node => node.remove());
      return norm(copy?.textContent);
    };
    if (sections.length !== 7 || sections.some((section, index) =>
      title(section) !== TITLES[index])) stop('section_structure_changed');
    return sections;
  }
  const formsOf = sections => [...sections[6].querySelectorAll('form')];
  const outsideState = sections => JSON.stringify(sections
    .filter((_, index) => index !== 6).map(sectionState));
  const ownLabel = item => {
    const labels = [...item.querySelectorAll('.el-form-item__label')]
      .filter(node => node.closest('.el-form-item') === item);
    return labels.length === 1 ? norm(labels[0].textContent) : '';
  };
  function controlsOf(form) {
    const items = [...form.querySelectorAll('.el-form-item')];
    return FIELDS.map(spec => {
      const matches = items.filter(item => ownLabel(item) === spec.question);
      if (matches.length !== 1) stop('target_not_unique');
      const item = matches[0];
      const controls = [...item.querySelectorAll('input,select,textarea')]
        .filter(node => node.closest('.el-form-item') === item && visible(node));
      if (controls.length !== 1) stop('target_not_unique');
      const node = controls[0];
      if (node.disabled || node.readOnly || node.closest('.el-select,.el-date-editor,.el-cascader,.cascader-wrap')
        || spec.kind === 'textarea' && !(node instanceof HTMLTextAreaElement)
        || spec.kind === 'input' && (!(node instanceof HTMLInputElement)
          || !['text', ''].includes(node.type))) stop('target_not_plain_control');
      return { ...spec, item, node };
    });
  }
  function otherControls(form, targets) {
    const nodes = new Set(targets.map(target => target.node));
    return JSON.stringify([...form.querySelectorAll('input,select,textarea')]
      .filter(node => !nodes.has(node)).map(controlState));
  }
  function noValidationErrors(targets) {
    return targets.every(({ item, node }) => !item.classList.contains('is-error')
      && !item.classList.contains('is-validating')
      && node.getAttribute('aria-invalid') !== 'true'
      && (!node.validity || node.validity.valid)
      && ![...item.querySelectorAll('.el-form-item__error')]
        .some(error => visible(error) && norm(error.textContent)));
  }
  const fieldRow = (question, status, reason) => ({
    question, path: `customAnswers.${question}`, labels: [question], status, reason
  });
  function profileAnswers(profile) {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) stop('missing_profile_value');
    const facts = Array.isArray(profile.customFacts) ? profile.customFacts : [];
    const confirmed = new Set(Array.isArray(profile.confirmedFields) ? profile.confirmedFields : []);
    const values = FIELDS.map(spec => {
      const answer = profile.customAnswers?.[spec.question];
      return typeof answer === 'string' ? answer : '';
    });
    if (values.some(answer => !answer.trim())) stop('missing_profile_value');
    if (values.some(answer => answer.length > 4000
      || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(answer)))
      stop('invalid_profile_value');
    const confirmedFacts = FIELDS.every((spec, index) => {
      const answer = values[index];
      const matched = facts.filter(item => item?.question === spec.question);
      const fact = matched.length === 1 ? matched[0] : null;
      return !!fact && fact.answer === answer && fact.sitePageUrl === PAGE
        && fact.sectionName === SECTION && fact.rowContext === 'none'
        && confirmed.has(`customAnswers.${spec.question}`);
    });
    if (!confirmedFacts) stop('profile_fact_unconfirmed');
    return values;
  }

  async function fill({ sectionName, profile, profileBinding } = {}) {
    const result = { ok: false, sectionName: SECTION, fields: [],
      editorLeftOpen: false, writeStarted: false, savedOnSite: false,
      submitted: false, softwareClickedSave: false, softwareClickedSubmit: false,
      softwareClickedDelete: false, liveSupportClaimed: false, complete: false };
    if (busy) return { ...result, reason: 'fill_in_progress' };
    busy = true;activeBinding=profileBinding;lastBinding=profileBinding;
    const timeOrigin = performance.timeOrigin;
    try {
      await checkBinding();
      if (sectionName !== SECTION) stop('unsupported_section');
      const values = profileAnswers(profile);
      let sections = sectionsAt(timeOrigin);
      let forms = formsOf(sections);
      if (forms.length > 1 || forms.length === 1 && !sections[6].contains(forms[0]))
        stop('editor_structure_changed');
      const outsideBefore = outsideState(sections);
      if (!forms.length) {
        const links = [...sections[6].querySelectorAll('.title_ a.h-e-btn')]
          .filter(node => norm(node.textContent) === '编辑' && visible(node));
        if (links.length !== 1) stop('edit_link_not_unique');
        await boundAction(()=>{if(!(links[0])?.isConnected)stop('profile_action_target_changed');return links[0].click();});
        const deadline = Date.now() + 4000;
        do {
          await pause(60);
          sections = sectionsAt(timeOrigin);
          forms = formsOf(sections);
          if (forms.length > 1 || forms.length === 1 && !sections[6].contains(forms[0]))
            stop('editor_structure_changed');
          if (forms.length === 1 && forms[0].querySelector('.el-form-item')) break;
        } while (Date.now() < deadline);
      }
      if (forms.length !== 1 || !sections[6].contains(forms[0])
        || outsideState(sections) !== outsideBefore) stop('editor_structure_changed');
      const form = forms[0];
      result.editorLeftOpen = true;
      let targets = controlsOf(form);
      const originals = targets.map(target => target.node.value);
      const otherBefore = otherControls(form, targets);
      if (originals.some(value => value !== '')) {
        await checkBinding();
        sections = sectionsAt(timeOrigin);
        const latest = controlsOf(form);
        if (formsOf(sections).length !== 1 || formsOf(sections)[0] !== form || !form.isConnected
          || latest.some((target, index) => target.item !== targets[index].item || target.node !== targets[index].node
            || target.node.value !== originals[index])
          || otherControls(form, latest) !== otherBefore || outsideState(sections) !== outsideBefore)
          stop('original_value_changed');
        const matching = latest.filter((target, index) => originals[index] === values[index]);
        if (!noValidationErrors(matching)) stop('site_validation_failed');
        result.ok = true;
        result.fields = targets.map((target, index) => fieldRow(target.question,
          originals[index] === values[index] ? 'verified' : 'skipped',
          originals[index] === values[index] ? 'preexisting_same_value' : 'existing_value'));
        return result;
      }
      if (targets.some((target, index) =>
        target.node.maxLength >= 0 && values[index].length > target.node.maxLength))
        stop('value_too_long');
      await pause(80);
      sections = sectionsAt(timeOrigin);
      const stable = controlsOf(form);
      if (formsOf(sections).length !== 1 || formsOf(sections)[0] !== form
        || !form.isConnected || outsideState(sections) !== outsideBefore
        || otherControls(form, stable) !== otherBefore
        || stable.some((target, index) => target.node !== targets[index].node
          || target.node.value !== '')) stop('original_value_changed');
      targets = stable;
      for (let index = 0; index < targets.length; index += 1) {
        const target = targets[index];
        sectionsAt(timeOrigin);
        const prototype = target.kind === 'textarea'
          ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
        if (!setter) stop('native_setter_missing');
        result.writeStarted = true;
        await boundAction(()=>{if(!(target.node)?.isConnected)stop('profile_action_target_changed');return setter.call(target.node, values[index]);});
        sectionsAt(timeOrigin);
        await boundAction(()=>{if(!(target.node)?.isConnected)stop('profile_action_target_changed');return target.node.dispatchEvent(new Event('input', { bubbles: true }));});
        sectionsAt(timeOrigin);
        await boundAction(()=>{if(!(target.node)?.isConnected)stop('profile_action_target_changed');return target.node.dispatchEvent(new Event('change', { bubbles: true }));});
      }
      await pause(250);
      const verifyReadback = () => {
        const currentSections = sectionsAt(timeOrigin);
        if (formsOf(currentSections).length !== 1 || formsOf(currentSections)[0] !== form
          || !form.isConnected || !currentSections[6].contains(form)) stop('editor_changed_after_fill');
        const latest = controlsOf(form);
        if (latest.some((target, index) => target.item !== targets[index].item || target.node !== targets[index].node
          || target.node.value !== values[index])
          || otherControls(form, latest) !== otherBefore
          || outsideState(currentSections) !== outsideBefore) stop('readback_mismatch');
        if (!noValidationErrors(latest)) stop('site_validation_failed');
        return latest;
      };
      verifyReadback();
      await checkBinding();
      const latest = verifyReadback();
      result.ok = true;
      result.fields = latest.map(target => fieldRow(target.question, 'verified', 'readback_matched'));
      return result;
    } catch (error) {
      result.reason = error instanceof Stop ? error.code : 'fill_failed';
      result.fields = FIELDS.map(spec => fieldRow(spec.question,
        result.writeStarted || result.reason === 'site_validation_failed' ? 'failed' : 'skipped', result.reason));
      return result;
    } finally {
      busy = false;activeBinding=null;
    }
  }

  globalThis.ResumeGthOtherSectionRevision=4;
  globalThis.ResumeGthOtherSection = Object.freeze({ fill });
})();
