// Standalone, read-only discovery for GTH's seven-section overview page.
// Load as an isolated-world content script, then call discover() once per user
// action. It never fills, uploads, saves, submits, or returns applicant values.
(() => {
  const PAGE = 'https://hr.gtht.com/resume/edit/';
  const TITLES = ['基本信息', '教育经历', '求职意向',
    '工作经验', '职业技能与特长', '附件简历', '其他信息'];
  const EDITABLE = ['基本信息', '求职意向', '职业技能与特长',
    '附件简历', '其他信息'];
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const normalized = value => String(value || '').replace(/[\s\u00a0]+/gu, ' ').trim();

  class DiscoveryError extends Error {
    constructor(code) { super(code); this.code = code; }
  }
  const stop = code => { throw new DiscoveryError(code); };
  const visible = node => node.getClientRects().length > 0
    && getComputedStyle(node).visibility !== 'hidden';

  function titleOf(section) {
    const title = section.querySelector('.title_');
    if (!title) return '';
    const copy = title.cloneNode(true);
    copy.querySelectorAll('a,button').forEach(node => node.remove());
    return normalized(copy.textContent);
  }

  function structure(timeOrigin) {
    if (`${location.origin}${location.pathname}` !== PAGE) stop('wrong_page');
    if (performance.timeOrigin !== timeOrigin) stop('page_reloaded');
    const sections = [...document.querySelectorAll('.r-section')];
    const titles = sections.map(titleOf);
    if (sections.length !== 7 || new Set(titles).size !== 7
      || TITLES.some((title, index) => titles[index] !== title))
      stop('section_structure_changed');
    return sections;
  }

  function controlsOf(root) {
    return [...root.querySelectorAll('input,select,textarea')].map(node => ({
      tag: node.tagName, type: node.type || '', value: node.value || '',
      checked: !!node.checked, selectedIndex: node.selectedIndex ?? null,
      files: [...(node.files || [])].map(file => [file.name, file.size, file.type])
    }));
  }

  function fingerprint(root) {
    return JSON.stringify({
      text: root.textContent || '', controls: controlsOf(root),
      editable: [...root.querySelectorAll('[contenteditable]')]
        .map(node => node.textContent || '')
    });
  }

  function closedSnapshot(sections) {
    return JSON.stringify(sections.map(section => ({
      title: titleOf(section), fingerprint: fingerprint(section)
    })));
  }

  function openForms(sections) {
    return sections.flatMap(section => [...section.querySelectorAll('form')]);
  }

  function ownLabel(item) {
    const labels = [...item.querySelectorAll('.el-form-item__label')]
      .filter(node => node.closest('.el-form-item') === item);
    return labels.length === 1 ? normalized(labels[0].textContent).slice(0, 90) : '';
  }

  function inventory(form, sectionName) {
    const fields = [...form.querySelectorAll('.el-form-item')].map((item, index) => ({
      index, label: ownLabel(item), required: item.classList.contains('is-required'),
      widgets: {
        select: item.querySelectorAll('.el-select').length,
        date: item.querySelectorAll('.el-date-editor').length,
        upload: item.querySelectorAll('.el-upload').length,
        radio: item.querySelectorAll('.el-radio').length
      },
      controls: [...item.querySelectorAll('input,select,textarea')]
        .filter(node => node.closest('.el-form-item') === item && visible(node))
        .map(node => ({ kind: node.tagName.toLowerCase() === 'input'
          ? `input:${node.type}` : node.tagName.toLowerCase(),
        readOnly: !!node.readOnly, disabled: !!node.disabled,
        nonempty: node.type === 'radio' || node.type === 'checkbox'
          ? !!node.checked : !!node.value }))
    }));
    return { sectionName, fields,
      outsideControls: [...form.querySelectorAll('input,select,textarea')]
        .filter(node => !node.closest('.el-form-item') && visible(node)).length,
      fileInputs: form.querySelectorAll('input[type=file]').length };
  }

  async function waitForEditor(sectionName, timeOrigin, wantOpen, deadline) {
    for (;;) {
      if (document.visibilityState !== 'visible') stop('page_hidden');
      const sections = structure(timeOrigin);
      const forms = openForms(sections);
      const section = sections[TITLES.indexOf(sectionName)];
      const form = section.querySelector('form');
      if (wantOpen) {
        if (forms.length > 1 || (forms.length === 1 && form !== forms[0]))
          stop('editor_structure_changed');
        if (forms.length === 1 && form
          && (form.querySelector('.el-form-item') || form.querySelector('input,select,textarea')))
          return { sections, section, form };
      } else {
        if (forms.length > 1) stop('editor_structure_changed');
        if (forms.length === 0) return { sections, section, form: null };
      }
      if (Date.now() >= deadline) stop(wantOpen ? 'editor_did_not_render' : 'editor_did_not_close');
      await pause(80);
    }
  }

  async function discover({ waitTimeoutMs = 6000, inspectSection = null } = {}) {
    const result = { ok: false, reason: '', completedSections: [],
      fields: [], originalValuesPreserved: false, editorLeftOpen: false };
    const timeOrigin = performance.timeOrigin;
    const timeout = Number.isInteger(waitTimeoutMs)
      ? Math.max(250, Math.min(waitTimeoutMs, 15000)) : 6000;
    try {
      if (document.readyState !== 'complete') stop('page_not_ready');
      if (document.visibilityState !== 'visible') stop('page_hidden');
      const sections = structure(timeOrigin);
      if (openForms(sections).length) {
        result.editorLeftOpen = true;
        stop('preexisting_editor');
      }
      const original = closedSnapshot(sections);
      for (const sectionName of EDITABLE) {
        if (document.visibilityState !== 'visible') stop('page_hidden');
        const current = structure(timeOrigin);
        if (openForms(current).length) stop('preexisting_editor');
        if (closedSnapshot(current) !== original) stop('overview_values_changed');
        const section = current[TITLES.indexOf(sectionName)];
        const links = [...section.querySelectorAll('.title_ a.h-e-btn')]
          .filter(node => normalized(node.textContent) === '编辑');
        if (links.length !== 1 || !visible(links[0])) stop('edit_link_not_unique');
        if (document.visibilityState !== 'visible') stop('page_hidden');
        links[0].click();
        result.editorLeftOpen = true;
        const opened = await waitForEditor(sectionName, timeOrigin, true,
          Date.now() + timeout);
        const beforeCancel = fingerprint(opened.form);
        const found = inventory(opened.form, sectionName);
        let matched = [];
        if (inspectSection !== null) {
          if (typeof inspectSection !== 'function') stop('inspect_callback_invalid');
          const report = await inspectSection(sectionName);
          if (!Array.isArray(report?.fields) || report.url?.split(/[?#]/)[0] !== PAGE
            || report.fields.some(field => field.scope?.sectionName !== sectionName))
            stop('match_scope_mismatch');
          matched = report.fields.map(field => {
            // The matcher needs currentValue internally to classify old values.
            // The popup only needs the conclusion, never the applicant's value.
            const { currentValue, detail, ...safe } = field;
            return { ...safe, id: `gth:${sectionName}:${safe.id}`,
              hasExistingValue: !!String(currentValue ?? '').trim() };
          });
        }
        // A second read prevents cancelling an editor changed by the website or
        // a person while discovery was in progress.
        await pause(50);
        const freshSections = structure(timeOrigin);
        const freshForms = openForms(freshSections);
        const freshForm = freshSections[TITLES.indexOf(sectionName)].querySelector('form');
        if (freshForms.length !== 1 || freshForm !== freshForms[0]
          || fingerprint(freshForm) !== beforeCancel)
          stop('editor_values_changed');
        const cancel = [...freshForm.querySelectorAll('button')]
          .filter(node => node.type === 'button' && normalized(node.textContent) === '取消');
        if (cancel.length !== 1 || !visible(cancel[0])) stop('cancel_not_unique');
        if (document.visibilityState !== 'visible') stop('page_hidden');
        cancel[0].click();
        const closed = await waitForEditor(sectionName, timeOrigin, false,
          Date.now() + timeout);
        result.editorLeftOpen = false;
        if (closedSnapshot(closed.sections) !== original) stop('overview_values_changed');
        result.completedSections.push({ ...found, matcherFieldCount: matched.length });
        result.fields.push(...matched);
      }
      result.ok = true;
      result.reason = 'complete';
      result.originalValuesPreserved = true;
      return result;
    } catch (error) {
      result.reason = error instanceof DiscoveryError ? error.code : 'discovery_failed';
      return result;
    }
  }

  globalThis.ResumeGthSectionDiscovery = Object.freeze({ discover });
})();
