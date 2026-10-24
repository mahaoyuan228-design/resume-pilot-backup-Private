// Narrow 国泰海通「职业技能与特长」fill-without-save. The value comes only
// from a confirmed resumeProfile customAnswer plus one matching customFact.
// Caller-supplied answers are not a fill source. A missing or unconfirmed
// value fails closed and is not invented. liveSupportClaimed stays false.
// This file does not claim the site is supported. Never clicks 保存 / 提交 /
// 投递 / 删除. The editor is left open.
(() => {
  if (globalThis.ResumeGthSimpleSection && globalThis.ResumeGthSimpleSectionRevision===3) return;

  const PAGE = 'https://hr.gtht.com/resume/edit/';
  const TITLES = ['基本信息', '教育经历', '求职意向', '工作经验',
    '职业技能与特长', '附件简历', '其他信息'];
  const SECTION = '职业技能与特长';
  const QUESTION = '职业技能与特长';
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const norm = value => String(value ?? '').replace(/[\s\u00a0]+/gu, ' ').trim();
  const visible = node => !!node?.getClientRects().length
    && getComputedStyle(node).display !== 'none'
    && getComputedStyle(node).visibility !== 'hidden';
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

  function requirePage(timeOrigin) {
    if (location.href !== PAGE) stop('wrong_page');
    if (document.readyState !== 'complete') stop('page_not_ready');
    if (document.visibilityState !== 'visible') stop('page_hidden');
    if (performance.timeOrigin !== timeOrigin) stop('page_reloaded');
    const sections = [...document.querySelectorAll('.r-section')];
    const heading = section => {
      const copy = section.querySelector('.title_')?.cloneNode(true);
      copy?.querySelectorAll('a,button').forEach(node => node.remove());
      return norm(copy?.textContent);
    };
    if (sections.length !== 7 || sections.some((section, index) =>
      heading(section) !== TITLES[index])) stop('section_structure_changed');
    return sections;
  }
  const formsOf = sections => [...sections[4].querySelectorAll('form')];
  const stateOf = node => [node.tagName, node.type || '', node.value || '',
    !!node.checked, node.selectedIndex ?? null,
    [...(node.files || [])].map(file => [file.name, file.size, file.type])];
  const snapshot = root => JSON.stringify({
    text: root.textContent || '',
    controls: [...root.querySelectorAll('input,select,textarea')].map(stateOf),
    editable: [...root.querySelectorAll('[contenteditable]')]
      .map(node => node.textContent || '')
  });
  const otherSections = sections => JSON.stringify(sections
    .filter((_, index) => index !== 4).map(snapshot));
  const ownLabel = item => {
    const labels = [...item.querySelectorAll('.el-form-item__label')]
      .filter(node => node.closest('.el-form-item') === item);
    return labels.length === 1 ? norm(labels[0].textContent) : '';
  };

  function targetOf(form) {
    const items = [...form.querySelectorAll('.el-form-item')]
      .filter(item => ownLabel(item) === QUESTION);
    if (items.length !== 1) stop('target_not_unique');
    const item = items[0];
    const controls = [...item.querySelectorAll('input,select,textarea')]
      .filter(node => node.closest('.el-form-item') === item && visible(node));
    if (controls.length !== 1 || !(controls[0] instanceof HTMLTextAreaElement)
      || controls[0].disabled || controls[0].readOnly
      || controls[0].closest('.el-select,.el-date-editor,.el-cascader,.cascader-wrap'))
      stop('target_not_plain_textarea');
    return { item, control: controls[0] };
  }
  function otherFormValues(form, target) {
    return JSON.stringify([...form.querySelectorAll('input,select,textarea')]
      .filter(node => node !== target).map(stateOf));
  }
  function validationClear(item, control) {
    return !item.classList.contains('is-error')
      && !item.classList.contains('is-validating')
      && control.getAttribute('aria-invalid') !== 'true'
      && ![...item.querySelectorAll('.el-form-item__error')]
        .some(node => visible(node) && norm(node.textContent))
      && (!control.validity || control.validity.valid);
  }

  const fieldRow = (status, reason) => ({
    question: QUESTION, path: `customAnswers.${QUESTION}`, labels: [QUESTION], status, reason
  });
  function profileAnswer(profile) {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) stop('missing_profile_value');
    const answer = profile.customAnswers?.[QUESTION];
    if (typeof answer !== 'string' || !answer.trim()) stop('missing_profile_value');
    if (answer.length > 4000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(answer))
      stop('invalid_profile_value');
    const facts = Array.isArray(profile.customFacts) ? profile.customFacts : [];
    const matched = facts.filter(item => item?.question === QUESTION);
    const fact = matched.length === 1 ? matched[0] : null;
    const confirmed = Array.isArray(profile.confirmedFields)
      && profile.confirmedFields.includes(`customAnswers.${QUESTION}`);
    if (!fact || fact.answer !== answer || fact.sitePageUrl !== PAGE
      || fact.sectionName !== SECTION || fact.rowContext !== 'none' || !confirmed)
      stop('profile_fact_unconfirmed');
    return answer;
  }

  async function fill({ sectionName, profile, profileBinding } = {}) {
    const result = { ok: false, sectionName: SECTION, fields: [],
      editorLeftOpen: false, writeStarted: false, savedOnSite: null,
      submitted: null, softwareClickedSave: false, softwareClickedSubmit: false,
      softwareClickedDelete: false, liveSupportClaimed: false, complete: false };
    if (busy) return { ...result, reason: 'fill_in_progress' };
    busy = true;activeBinding=profileBinding;lastBinding=profileBinding;
    const timeOrigin = performance.timeOrigin;
    try {
      await checkBinding();
      if (sectionName !== SECTION) stop('unsupported_section');
      const answer = profileAnswer(profile);
      let sections = requirePage(timeOrigin);
      let forms = formsOf(sections);
      if (forms.length > 1 || (forms.length === 1 && !sections[4].contains(forms[0])))
        stop('editor_structure_changed');
      const outsideBefore = otherSections(sections);
      if (!forms.length) {
        const links = [...sections[4].querySelectorAll('.title_ a.h-e-btn')]
          .filter(node => norm(node.textContent) === '编辑' && visible(node));
        if (links.length !== 1) stop('edit_link_not_unique');
        await boundAction(()=>{if(!(links[0])?.isConnected)stop('profile_action_target_changed');return links[0].click();});
        const deadline = Date.now() + 4000;
        do {
          await pause(60);
          sections = requirePage(timeOrigin);
          forms = formsOf(sections);
          if (forms.length > 1 || (forms.length === 1 && !sections[4].contains(forms[0])))
            stop('editor_structure_changed');
          if (forms.length === 1 && forms[0].querySelector('.el-form-item')) break;
        } while (Date.now() < deadline);
      }
      if (forms.length !== 1 || !sections[4].contains(forms[0])
        || otherSections(sections) !== outsideBefore) stop('editor_structure_changed');
      const form = forms[0];
      result.editorLeftOpen = true;
      const first = targetOf(form);
      const { item, control } = first;
      const existing = control.value;
      if (existing !== '') {
        await checkBinding();result.ok = true;
        result.fields = [fieldRow(existing === answer ? 'verified' : 'skipped',
          existing === answer ? 'preexisting_same_value' : 'existing_value')];
        return result;
      }
      if (control.maxLength >= 0 && answer.length > control.maxLength)
        stop('value_too_long');
      const otherBefore = otherFormValues(form, control);
      await pause(80);
      sections = requirePage(timeOrigin);
      if (formsOf(sections).length !== 1 || formsOf(sections)[0] !== form
        || !form.isConnected || targetOf(form).control !== control
        || control.value !== '' || otherFormValues(form, control) !== otherBefore
        || otherSections(sections) !== outsideBefore)
        stop('original_value_changed');
      result.writeStarted = true;
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      if (!setter) stop('native_setter_missing');
      await boundAction(()=>{if(!(control)?.isConnected)stop('profile_action_target_changed');return setter.call(control, answer);});
      requirePage(timeOrigin);
      await boundAction(()=>{if(!(control)?.isConnected)stop('profile_action_target_changed');return control.dispatchEvent(new Event('input', { bubbles: true }));});
      requirePage(timeOrigin);
      await boundAction(()=>{if(!(control)?.isConnected)stop('profile_action_target_changed');return control.dispatchEvent(new Event('change', { bubbles: true }));});
      await pause(250);
      sections = requirePage(timeOrigin);
      if (formsOf(sections).length !== 1 || formsOf(sections)[0] !== form
        || !form.isConnected || !sections[4].contains(form)) stop('editor_changed_after_fill');
      const latest = targetOf(form);
      if (latest.control !== control || otherFormValues(form, control) !== otherBefore
        || otherSections(sections) !== outsideBefore) stop('other_values_changed');
      if (control.value !== answer) stop('readback_mismatch');
      if (!validationClear(latest.item, control)) stop('site_validation_failed');
      await checkBinding();result.ok = true;
      result.fields = [fieldRow('verified', 'readback_matched')];
      return result;
    } catch (error) {
      result.reason = error instanceof Stop ? error.code : 'fill_failed';
      result.fields = [fieldRow(result.writeStarted ? 'failed' : 'skipped', result.reason)];
      return result;
    } finally {
      busy = false;activeBinding=null;
    }
  }

  globalThis.ResumeGthSimpleSectionRevision=3;
  globalThis.ResumeGthSimpleSection = Object.freeze({ fill });
})();
