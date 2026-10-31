// First-party upload control observations. No file selection, events, clicks,
// preview navigation, clearing, storage or network operations belong here.
(() => {
  'use strict';
  const registry = globalThis.ResumeControls;
  if (!registry) throw Error('control_registry_missing');
  if (globalThis.ResumeUploadControls?.version === 1 && registry.list().some(adapter => adapter.name === 'upload-surface')) return;
  const { norm } = registry.helpers;
  const fileSelector = 'input[type="file"]';
  const hintSelector = '[data-upload],[data-dropzone],[data-attachment],.upload,.uploader,.upload-control,.dropzone,.drop-zone,.attachment-control';
  const groupSelector = '[role="group"],fieldset';
  const previewSelector = '[data-upload-preview],[data-attachment-preview],[data-file-name]';
  const flags = Object.freeze({ writeStarted: false, liveSupportClaimed: false });
  const isFile = node => !!node?.matches?.(fileSelector);
  const hint = node => !!node?.matches?.(hintSelector) || [...(node?.classList || [])]
    .some(token => /(?:^|-)(?:upload|uploader|upload-control|upload-dragger|drop-?zone|attachment-control)$/iu.test(token));
  const nodes = (root, selector) => [...(root.matches?.(selector) ? [root] : []), ...root.querySelectorAll(selector)];
  function invalid(el) {
    if (!el?.isConnected) return 'target_detached';
    if (el.ownerDocument !== document || el.getRootNode?.() !== document) return 'shadow_or_frame_manual';
    if (el.closest?.('iframe,[data-captcha],.g-recaptcha,.h-captcha')) return 'iframe_or_captcha_manual';
    return null;
  }
  function linkedFile(label) {
    // Native label.control proves an explicit relationship without selectors,
    // handler inspection, framework identities or field-name inference.
    return label?.tagName === 'LABEL' && isFile(label.control) ? label.control : null;
  }
  function uploadGroup(node) {
    // A general fieldset/form group containing an attachment and ordinary
    // answers is not an upload control. Do not absorb neighboring fields.
    return node.matches?.(groupSelector) && !!node.querySelector(fileSelector)
      && !node.querySelector('input:not([type="file"]):not([readonly]):not([type="button"]):not([type="submit"]):not([type="hidden"]),textarea:not([readonly]),select');
  }
  function rootFor(el) {
    for (let node = el; node && !node.matches?.('body,html,form'); node = node.parentElement) {
      if (hint(node) || uploadGroup(node)) return node;
    }
    const external = isFile(el) ? [...(el.labels || [])].filter(label => hint(label)
      || label.querySelector(`button,a,[role="button"],[data-upload-action],${previewSelector}`)) : [];
    if (external.length === 1) return external[0];
    const label = el.closest?.('label');
    if (linkedFile(label)) return label;
    return el;
  }
  function filesOf(root) {
    const files = nodes(root, fileSelector);
    for (const label of nodes(root, 'label')) {
      const file = linkedFile(label);
      if (file && !files.includes(file)) files.push(file);
    }
    return files;
  }
  function visible(node) {
    if (node.closest?.('[hidden],[aria-hidden="true"],[inert]')) return false;
    for (let parent = node; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.display === 'none' || ['hidden', 'collapse'].includes(style.visibility)) return false;
    }
    return true;
  }
  function action(node) {
    const explicit = node.getAttribute('data-upload-action');
    const text = norm(explicit || node.getAttribute('aria-label') || node.textContent || node.value).toLowerCase();
    if (/^(?:preview|view|预览|查看)$/u.test(text)) return 'preview';
    if (/^(?:clear|remove|清除|移除)$/u.test(text)) return 'clear';
    if (/^(?:skip|跳过)$/u.test(text)) return 'skip';
    if (/^(?:later|upload later|稍后|稍后上传)$/u.test(text)) return 'later';
    return null;
  }
  function rendered(root) {
    const items = [];
    for (const node of nodes(root, `${previewSelector},img,a[href]`)) {
      if (!visible(node) || action(node)) continue;
      // A preview container and its image/link describe the same item. Prefer
      // the leaf representation; never dereference href/src or read file bytes.
      if (node.matches(previewSelector) && node.querySelector('img,a[href]')) continue;
      if (node.matches('a[href]') && node.querySelector('img')) continue;
      if (!node.matches('img,a[href]') && node.parentElement?.closest(previewSelector)) continue;
      const kind = node.tagName === 'IMG' ? 'image' : node.tagName === 'A' ? 'link' : 'text';
      const label = norm(node.getAttribute('aria-label') || (kind === 'image' ? node.getAttribute('alt') : node.textContent)).slice(0, 200);
      items.push({ kind, label });
    }
    return { count: items.length, items: items.slice(0, 100) };
  }
  function empty(reason) {
    return { status: 'manual', reason, kind: 'unknown', ownership: 'unconfirmed', fileInputs: 0,
      selectedFiles: [], preview: { count: 0, items: [] },
      affordances: { preview: 0, clear: 0, skip: 0, later: 0 }, disabled: false, busy: false, ...flags };
  }
  function inspect(el) {
    const reason = invalid(el);
    if (reason) return empty(reason);
    const root = rootFor(el), inputs = filesOf(root);
    if (inputs.some(input => invalid(input))) return empty('shadow_or_frame_manual');
    const ownership = inputs.length > 1 ? 'ambiguous' : inputs.length === 1
      ? root === inputs[0] ? 'native' : 'input-backed' : 'unconfirmed';
    const disabled = !!root.closest('[aria-disabled="true"],fieldset[disabled],[inert]')
      || inputs.some(input => input.disabled || input.matches(':disabled') || input.getAttribute('aria-disabled') === 'true');
    const busy = !!root.closest('[aria-busy="true"]') || inputs.some(input => !!input.closest('[aria-busy="true"]'));
    const affordances = { preview: 0, clear: 0, skip: 0, later: 0 };
    for (const node of nodes(root, 'button,a,[role="button"],input[type="button"],input[type="submit"],[data-upload-action]')) {
      const kind = action(node);
      if (kind && visible(node)) affordances[kind]++;
    }
    const selectedFiles = inputs.flatMap(input => [...(input.files || [])].slice(0, 100)
      .map(file => ({ name: norm(file.name).slice(0, 200), type: norm(file.type).slice(0, 100), size: file.size })));
    const preview = rendered(root);
    const manual = ownership === 'ambiguous' ? 'upload_ownership_ambiguous'
      : ownership === 'unconfirmed' ? 'upload_ownership_unconfirmed' : disabled ? 'disabled' : busy ? 'busy' : null;
    return { status: manual ? 'manual' : 'observed', reason: manual || 'upload_observed',
      kind: isFile(root) ? 'file-input' : hint(root) && /drop/iu.test(`${root.className} ${root.hasAttribute('data-dropzone') ? 'drop' : ''}`)
        ? 'drop-zone' : inputs.length || hint(root) || preview.count ? 'attachment' : 'unknown',
      ownership, fileInputs: inputs.length, selectedFiles, preview, affordances,
      disabled, busy, ...flags };
  }
  function plan(el, instruction = {}) {
    const observation = inspect(el);
    const base = { status: 'manual', skip: true, strategy: 'none', attempts: 0, ...flags };
    if (observation.status === 'manual') return { ...base, reason: observation.reason };
    // Policy choices are returned to the caller; even a page's 'skip' or
    // 'later' button could save or navigate, so it is never activated.
    switch (instruction?.action ?? 'upload') {
      case 'skip': return { ...base, reason: 'upload_skipped', disposition: 'skipped' };
      case 'later': return { ...base, reason: 'upload_deferred', disposition: 'deferred' };
      case 'preview': return { ...base, reason: 'attachment_preview_readonly', preview: observation.preview };
      case 'clear': return { ...base, reason: 'attachment_clear_manual', affordances: observation.affordances };
      case 'detect':
      case 'upload': return { ...base, reason: 'upload_manual' };
      default: return { ...base, reason: 'attachment_action_unknown' };
    }
  }
  function discover(scope = document) {
    if (scope !== document && invalid(scope)) return [inspect(scope)];
    const roots = new Set();
    for (const el of nodes(scope, `${fileSelector},${hintSelector},[class*="upload"],[class*="dropzone"],[class*="attachment"],label[for]`)) {
      if (!isFile(el) && !hint(el) && !linkedFile(el)) continue;
      const root = rootFor(el);
      // A remote label for a native input should not duplicate that input's
      // root when discovery already sees both within this scope.
      const file = linkedFile(root);
      roots.add(file && scope.contains(file) ? rootFor(file) : root);
    }
    return [...roots].slice(0, 300).map(inspect);
  }
  function claims(el) {
    if (!el?.matches || isFile(el) || invalid(el)) return false;
    const root = rootFor(el);
    return hint(root) || uploadGroup(root) || !!linkedFile(root);
  }
  globalThis.ResumeUploadControls = Object.freeze({ version: 1, ...flags, inspect, preview: inspect, plan, discover });
  // Higher priority than native/framework text: upload filename/search display
  // inputs never become answer fields, including unconfirmed drop-zone hints.
  registry.register({ name: 'upload-surface', lib: 'native', type: 'upload', priority: 1100,
    libVersionProbe: () => ({ lib: 'native', version: 'html' }), matches: claims,
    readModel: el => ({ available: false, manual: true, value: null, domValue: null, ...inspect(el) }),
    plan: (_fact, model) => ({ status: 'manual', skip: true,
      reason: model.status === 'manual' ? model.reason : 'upload_manual', ...flags }),
  });
})();
