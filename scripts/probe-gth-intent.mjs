#!/usr/bin/env node
/**
 * Read-only census of the opened GTH 求职意向 editor on an already logged-in Edge.
 * Never Save. Does not claim the live site is supported. Product writers are
 * listed in shippedWritable; supportClaimed stays false.
 *
 *   node scripts/probe-gth-intent.mjs --port 9239
 *   node scripts/probe-gth-intent.mjs --port 9239 --url-match hr.gtht.com/resume/edit --open-options
 *
 * Attaches to the existing resume tab. Opens a new tab only when nothing matches
 * the default edit URL (or an explicit https://hr.gtht.com/resume/edit URL).
 * Never types a login. Clicks only the unique 求职意向 编辑 affordance, then
 * 取消 or a unique close control. Dropdown options stay closed unless
 * --open-options is set; even then the probe only reads them and presses Escape.
 *
 * A section form is an opened editor when that section's 编辑 link is hidden
 * (present but not visible) or, for 求职意向, absent while the form is visible.
 * GTH hides 编辑 while its editor is open. An always-on form in a section that
 * never has an 编辑 link (基本信息) stays staticInlineForms and does not block.
 * This script stays out of extension packs. Before the census it sends
 * Page.setWebLifecycleState {state:"active"} so a frozen background tab wakes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { connectCdp, getJson } from '../tools/live-harvest/cdp-client.mjs';
import { isTimeout } from '../tools/live-harvest/errors.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const DEFAULT_PORT = 9239;
export const DEFAULT_URL_MATCH = 'hr.gtht.com/resume/edit';
export const EDIT_PAGE = 'https://hr.gtht.com/resume/edit/';
export const SHIPPED_WRITABLE = Object.freeze([
  '期望工作地区', '期望从事职位类别', '期望薪资', '到岗日期', '现从事行业', '现从事职位类别', '现薪资'
]);
export const STILL_UNSUPPORTED = Object.freeze([]);

export const HELP = `Usage:
  node scripts/probe-gth-intent.mjs --port 9239
  node scripts/probe-gth-intent.mjs --port 9239 --url-match hr.gtht.com/resume/edit --open-options

Read-only CDP census of the opened GTH 求职意向 editor. Never Save.
Does not log in, does not navigate an existing tab, and does not claim support.

Options:
  --port <cdp>            Loopback CDP port. Default ${DEFAULT_PORT}
  --url-match <text>      Substring that selects the resume tab. Default ${DEFAULT_URL_MATCH}
  --open-options          Open each select/cascader, read option text, then press Escape
  --step-timeout-ms <n>   Timeout for each CDP call. Default 25000
  --help                  Show this help
`;

export function redactUrl(raw) {
  const text = String(raw || '');
  try {
    const url = new URL(text, 'https://hr.gtht.com');
    return `${url.origin}${url.pathname}`;
  } catch {
    return text.split('?')[0].split('#')[0].slice(0, 200);
  }
}

export function isSavePost(method, url) {
  const verb = String(method || '').toUpperCase();
  if (!['POST', 'PUT', 'PATCH'].includes(verb)) return false;
  let pathname = '';
  try {
    pathname = new URL(redactUrl(url)).pathname.replace(/\/+$/u, '') || '/';
  } catch {
    return false;
  }
  if (pathname === '/api/resume/edit.json') return true;
  if (verb === 'POST' && pathname.startsWith('/api/resume/')) return true;
  return /\/(?:save|submit|deliver|apply)(?:\.json)?$/iu.test(pathname);
}

export function networkReport(posts) {
  const rows = [];
  for (const post of Array.isArray(posts) ? posts : []) {
    const method = String(post?.method || '').toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) continue;
    rows.push({
      via: String(post?.via || 'unknown').slice(0, 40),
      method,
      url: redactUrl(post?.url)
    });
  }
  return {
    feasible: true,
    posts: rows.slice(0, 40),
    savePostObserved: rows.some((row) => isSavePost(row.method, row.url))
  };
}

export function clickFlags(actions) {
  const names = [];
  for (const action of Array.isArray(actions) ? actions : []) {
    if (action?.type !== 'click') continue;
    if (typeof action.label === 'string') names.push(action.label);
    if (typeof action.name === 'string') names.push(action.name);
  }
  const has = (word) => names.some((name) => name.includes(word));
  return {
    softwareClickedSave: has('保存'),
    softwareClickedSubmit: has('提交'),
    softwareClickedDeliver: has('投递')
  };
}

export function parseProbeArgs(argv) {
  const opts = {
    port: DEFAULT_PORT,
    urlMatch: DEFAULT_URL_MATCH,
    openOptions: false,
    stepTimeoutMs: 25000,
    help: false
  };
  const seen = new Set();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
      continue;
    }
    if (arg === '--open-options') {
      if (seen.has(arg)) throw new Error('duplicate --open-options');
      seen.add(arg);
      opts.openOptions = true;
      continue;
    }
    if (arg !== '--port' && arg !== '--url-match' && arg !== '--step-timeout-ms') {
      throw new Error(`unknown argument: ${arg}`);
    }
    if (seen.has(arg)) throw new Error(`duplicate ${arg}`);
    seen.add(arg);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${arg}`);
    i += 1;
    if (arg === '--port') {
      if (!/^\d+$/u.test(value)) throw new Error('bad port');
      const port = Number(value);
      if (port < 1 || port > 65535) throw new Error('bad port');
      opts.port = port;
    } else if (arg === '--url-match') {
      if (value.length < 3 || value.length > 200) throw new Error('bad url-match');
      opts.urlMatch = value;
    } else {
      if (!/^\d+$/u.test(value)) throw new Error('bad step-timeout');
      const ms = Number(value);
      if (ms < 1000 || ms > 120000) throw new Error('bad step-timeout');
      opts.stepTimeoutMs = ms;
    }
  }
  return opts;
}

export function assertLoopback(wsUrl, port) {
  let url;
  try { url = new URL(wsUrl); } catch { return false; }
  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') return false;
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) return false;
  if (url.username || url.password) return false;
  if (url.port && Number(url.port) !== Number(port)) return false;
  return true;
}

export function openUrlFor(urlMatch) {
  if (urlMatch === DEFAULT_URL_MATCH) return EDIT_PAGE;
  if (typeof urlMatch !== 'string') return null;
  let url;
  try { url = new URL(urlMatch); } catch { return null; }
  if (url.protocol !== 'https:' || url.hostname !== 'hr.gtht.com') return null;
  if (!url.pathname.startsWith('/resume/edit')) return null;
  if (url.username || url.password) return null;
  return url.href;
}

export function selectResumeTarget(targets, urlMatch) {
  const pages = [];
  for (const target of Array.isArray(targets) ? targets : []) {
    if (!target || target.type !== 'page') continue;
    const url = String(target.url || '');
    if (!url || url.startsWith('chrome-extension:') || url.startsWith('devtools:')) continue;
    if (!url.includes(urlMatch)) continue;
    pages.push(target);
  }
  if (pages.length === 1) return { action: 'attach', target: pages[0] };
  if (pages.length > 1) return { action: 'stop', reason: 'tab_ambiguous', targets: pages };
  return { action: 'missing', reason: 'tab_not_found', targets: [] };
}

export function looksLikeLogin(guard) {
  if (!guard || typeof guard !== 'object') return false;
  if (guard.password === true) return true;
  return /\/(?:login|signin|sign-in|passport)(?:\/|$|\?|#)/iu.test(String(guard.href || ''));
}

export function pageGuardExpression() {
  return `(() => {
    const view = document.defaultView;
    const styleHidden = (node) => {
      let cur = node;
      while (cur && cur.nodeType === 1) {
        if (cur.hasAttribute('hidden')) return true;
        const style = view.getComputedStyle(cur);
        if (style.display === 'none' || style.visibility === 'hidden') return true;
        cur = cur.parentElement;
      }
      return false;
    };
    const password = [...document.querySelectorAll('input[type="password"]')].some((node) => !styleHidden(node));
    return { href: location.href, title: document.title, readyState: document.readyState, password };
  })()`;
}

function publicTab(target) {
  if (!target) return null;
  return {
    id: target.id || null,
    url: redactUrl(target.url || ''),
    title: String(target.title || '').slice(0, 120)
  };
}

function strings(values, max) {
  if (!Array.isArray(values)) return [];
  return values.filter((value) => typeof value === 'string' && value.length > 0).slice(0, max);
}

function publicStaticInlineForms(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 20).map((row) => ({
    section: String(row?.section || '').slice(0, 80),
    labels: strings(row?.labels, 40)
  }));
}

function plainField(field) {
  return {
    label: String(field?.label || ''),
    controlKind: typeof field?.controlKind === 'string' ? field.controlKind : 'custom',
    classes: strings(field?.classes, 16),
    itemClasses: strings(field?.itemClasses, 16),
    placeholder: typeof field?.placeholder === 'string' ? field.placeholder.slice(0, 200) : null,
    readOnly: field?.readOnly === true,
    disabled: field?.disabled === true,
    value: typeof field?.value === 'string' ? field.value.slice(0, 200) : '',
    tag: typeof field?.tag === 'string' ? field.tag : null,
    inputType: typeof field?.inputType === 'string' ? field.inputType : null,
    dropdownTrigger: typeof field?.dropdownTrigger === 'string' ? field.dropdownTrigger : null,
    note: typeof field?.note === 'string' ? field.note : null,
    supportClaimed: false
  };
}

function questionEvidence(fields) {
  const rows = Array.isArray(fields) ? fields : [];
  return [...SHIPPED_WRITABLE, ...STILL_UNSUPPORTED].map((question) => {
    const match = rows.find((field) => String(field?.label || '').replace(/^\*\s*/u, '').trim() === question);
    return {
      question,
      present: !!match,
      controlKind: match?.controlKind || null,
      supportClaimed: false
    };
  });
}

export function probeOutputPath(outDir, date) {
  const stamp = date.toISOString().replace(/[:.]/gu, '').replace(/-/gu, '');
  return path.join(outDir, `probe-gth-intent-${stamp}.json`);
}

/**
 * DOM census. Self-contained except networkReport, clickFlags, and redactUrl,
 * which buildProbeExpression injects beside this function for the page.
 */
export async function probeIntentEditor(doc, options = {}) {
  const view = doc?.defaultView;
  const actions = [];
  const posts = [];
  let restore = () => {};
  let editor = null;
  let openedByUs = false;
  const result = {
    ok: false,
    reason: null,
    error: null,
    neverSave: true,
    claimedSupported: false,
    liveSupportClaimed: false,
    supported: false,
    supportClaimed: false,
    editorAlreadyOpen: false,
    editorLeftOpen: false,
    openedByUs: false,
    cardVia: null,
    detail: null,
    staticInlineForms: [],
    fields: [],
    optionReads: null,
    optionsOpened: false,
    actions: [],
    clickedLabels: [],
    softwareClickedSave: false,
    softwareClickedSubmit: false,
    softwareClickedDeliver: false,
    savePostObserved: false,
    network: { feasible: true, posts: [], savePostObserved: false },
    href: '',
    title: ''
  };

  function norm(value) {
    return String(value ?? '').replace(/[\s\u00a0]+/gu, ' ').trim();
  }

  function visible(node) {
    if (!node || !node.isConnected || node.nodeType !== 1) return false;
    let cur = node;
    while (cur && cur.nodeType === 1) {
      if (cur.hasAttribute('hidden')) return false;
      const style = view.getComputedStyle(cur);
      if (!style || style.display === 'none' || style.visibility === 'hidden') return false;
      cur = cur.parentElement;
    }
    if (typeof node.getClientRects === 'function' && node.getClientRects().length === 0) return false;
    return true;
  }

  function accessibleName(node) {
    const aria = norm(node.getAttribute('aria-label') || '');
    if (aria) return aria;
    return norm(node.textContent);
  }

  function forbiddenName(name) {
    return ['保存', '提交', '投递'].some((word) => String(name || '').includes(word));
  }

  function isSafeClickable(node) {
    if (!node || forbiddenName(accessibleName(node))) return false;
    const tag = node.tagName;
    if (tag === 'BUTTON') {
      if ((node.getAttribute('type') || '').toLowerCase() !== 'button') return false;
      if (node.hasAttribute('formaction')) return false;
    } else if (tag !== 'A' && node.getAttribute('role') !== 'button') return false;
    return true;
  }

  function wouldNavigate(node) {
    if (!node || node.tagName !== 'A') return false;
    const href = node.getAttribute('href');
    if (href == null) return false;
    const text = href.trim();
    if (text === '' || text === '#') return false;
    return !/^javascript:(?:;|void\(0\))$/iu.test(text);
  }

  function performClick(node, label) {
    const name = accessibleName(node);
    if (forbiddenName(name) || forbiddenName(label)) {
      const error = new Error('refusing_forbidden_click');
      error.reason = 'refusing_forbidden_click';
      throw error;
    }
    actions.push({ type: 'click', label, name, tag: node.tagName });
    node.click();
  }

  function clickNode(node, label) {
    if (!isSafeClickable(node)) {
      const error = new Error('refusing_forbidden_click');
      error.reason = 'refusing_forbidden_click';
      throw error;
    }
    performClick(node, label);
  }

  function clickTrigger(node) {
    const widget = node?.closest?.('.el-select, .el-cascader, .cascader-wrap');
    if (!widget || node.closest('button, a')) {
      const error = new Error('refusing_forbidden_click');
      error.reason = 'refusing_forbidden_click';
      throw error;
    }
    performClick(node, 'dropdown-trigger');
  }

  function classTokens(nodes) {
    const out = [];
    for (const node of nodes) {
      for (const token of node?.classList || []) {
        if (token && !out.includes(token)) out.push(token);
      }
    }
    return out.slice(0, 16);
  }

  function own(item, selector) {
    return [...item.querySelectorAll(selector)].filter((node) => node.closest('.el-form-item') === item);
  }

  function titleText(section) {
    const titles = [...section.querySelectorAll('.title_')].filter((node) => node.closest('.r-section') === section);
    if (!titles.length) return '';
    const clone = titles[0].cloneNode(true);
    clone.querySelectorAll('a, button, [role="button"]').forEach((child) => child.remove());
    return norm(clone.textContent);
  }

  function editCandidates(card) {
    return [...card.querySelectorAll('a, button, [role="button"]')].filter((node) => visible(node) && accessibleName(node) === '编辑');
  }

  function sectionEditNodes(section) {
    if (!section) return [];
    return [...section.querySelectorAll('a, button, [role="button"]')].filter((node) =>
      node.closest('.r-section') === section && accessibleName(node) === '编辑');
  }

  function isToggledEditorShell(node) {
    return !!(node && typeof node.closest === 'function' && node.closest('.el-dialog, .el-drawer, [role="dialog"]'));
  }

  function isStaticInlineForm(node) {
    if (!node || node.tagName !== 'FORM' || isToggledEditorShell(node)) return false;
    const section = node.closest('.r-section');
    if (!section) return false;
    // A hidden 编辑 link means the editor is open. No 编辑 node at all is an
    // always-on form, except 求职意向, whose 编辑 link is absent while open.
    if (sectionEditNodes(section).length > 0) return false;
    return titleText(section) !== '求职意向';
  }

  function staticInlineFormRecord(form) {
    const section = form.closest('.r-section');
    const labels = [];
    for (const item of form.querySelectorAll('.el-form-item')) {
      if (item.closest('form') !== form) continue;
      const labelNode = [...item.querySelectorAll('.el-form-item__label')].find((node) => node.closest('.el-form-item') === item);
      const text = norm(labelNode ? labelNode.textContent : '').replace(/^\*\s*/u, '');
      if (text) labels.push(text);
    }
    return {
      section: section ? titleText(section) : '',
      labels: labels.slice(0, 40)
    };
  }

  function editorNodes() {
    return [...doc.querySelectorAll('form, .el-dialog, .el-drawer, [role="dialog"]')]
      .filter((node) => visible(node) && node.querySelector('.el-form-item'));
  }

  function splitEditors(nodes) {
    const opened = [];
    const staticInlineForms = [];
    for (const node of nodes) {
      if (isStaticInlineForm(node)) staticInlineForms.push(staticInlineFormRecord(node));
      else opened.push(node);
    }
    return { opened, staticInlineForms };
  }

  function preferEditor(nodes) {
    const forms = nodes.filter((node) => node.tagName === 'FORM');
    const chosen = forms.length ? forms : nodes;
    if (chosen.length !== 1) return { ok: false, count: chosen.length };
    return { ok: true, editor: chosen[0], count: 1 };
  }

  function cssPath(node, root) {
    const parts = [];
    let cur = node;
    while (cur && cur !== root) {
      const parent = cur.parentElement;
      if (!parent) return null;
      const tag = cur.tagName.toLowerCase();
      const index = [...parent.children].filter((child) => child.tagName === cur.tagName).indexOf(cur) + 1;
      parts.unshift(`${tag}:nth-of-type(${index})`);
      cur = parent;
    }
    return cur === root ? parts.join(' > ') : null;
  }

  function triggerSelector(item, trigger) {
    if (!trigger) return null;
    const widget = trigger.closest('.el-cascader, .cascader-wrap, .el-select');
    const hints = [];
    if (widget) {
      const marker = ['el-cascader', 'el-select', 'cascader-wrap'].find((name) => widget.classList.contains(name));
      if (marker && trigger.classList.contains('el-input__inner')) hints.push(`.${marker} .el-input__inner`);
      if (marker) hints.push(`.${marker}`);
    }
    for (const hint of hints) {
      let found = [];
      try {
        found = [...item.querySelectorAll(hint)].filter((node) => node.closest('.el-form-item') === item);
      } catch {
        continue;
      }
      if (found.length === 1 && found[0] === trigger) return hint;
    }
    return cssPath(trigger, item);
  }

  function classify(item) {
    const widgets = [
      ['el-cascader', own(item, '.el-cascader, .cascader-wrap')],
      ['el-select', own(item, '.el-select')],
      ['el-date-editor', own(item, '.el-date-editor')]
    ].filter(([, nodes]) => nodes.length);
    if (widgets.length > 1 || (widgets.length === 1 && widgets[0][1].length !== 1)) {
      return { controlKind: 'custom', widget: widgets[0]?.[1]?.[0] || null, note: 'widget_not_unique' };
    }
    if (widgets.length === 1) return { controlKind: widgets[0][0], widget: widgets[0][1][0], note: null };
    const radios = own(item, 'input[type="radio"], .el-radio');
    const checks = own(item, 'input[type="checkbox"], .el-checkbox');
    if (radios.length && checks.length) return { controlKind: 'custom', widget: null, note: 'mixed_choice' };
    if (radios.length) return { controlKind: 'radio', widget: radios[0], note: null };
    if (checks.length) return { controlKind: 'checkbox', widget: checks[0], note: null };
    const textLike = own(item, 'input, textarea').filter((node) => {
      const type = (node.getAttribute('type') || '').toLowerCase();
      return node.tagName === 'TEXTAREA' || !['radio', 'checkbox', 'hidden', 'file', 'password', 'button', 'submit'].includes(type);
    });
    if (textLike.length) return { controlKind: 'input', widget: textLike[0], note: null };
    if (own(item, 'select').length) return { controlKind: 'custom', widget: own(item, 'select')[0], note: 'native_select' };
    return { controlKind: 'custom', widget: own(item, '.el-form-item__content')[0] || null, note: null };
  }

  function censusItem(item) {
    const kind = classify(item);
    const labels = own(item, '.el-form-item__label').map((node) => norm(node.textContent)).filter(Boolean);
    const input = own(item, 'input, textarea, select').find((node) => {
      const type = (node.getAttribute('type') || '').toLowerCase();
      return !['hidden', 'radio', 'checkbox', 'file', 'password', 'button', 'submit'].includes(type);
    }) || null;
    const anyInput = own(item, 'input, textarea, select')[0] || null;
    let value = '';
    let note = kind.note;
    if (own(item, 'input[type="password"]').length) {
      value = '';
      note = note || 'password_redacted';
    } else if (kind.controlKind === 'radio' || kind.controlKind === 'checkbox') {
      value = own(item, 'input').filter((node) => node.checked).map((node) => {
        const text = norm(node.closest('label')?.textContent || '');
        return text || String(node.value || '');
      }).join(' | ').slice(0, 200);
    } else if (input) {
      const raw = String(input.value ?? '');
      value = raw.slice(0, 200);
      if (raw.length > 200) note = note || 'value_truncated';
    }
    const widgetRoot = kind.controlKind === 'el-select'
      ? own(item, '.el-select')[0]
      : kind.controlKind === 'el-cascader' ? own(item, '.el-cascader, .cascader-wrap')[0] : null;
    const trigger = widgetRoot
      ? ([...widgetRoot.querySelectorAll('input.el-input__inner, .el-input__inner')].find((node) => node.closest('.el-form-item') === item) || widgetRoot)
      : null;
    const widget = kind.widget;
    const readOnly = !!(input && (input.readOnly || input.hasAttribute('readonly')));
    const disabled = !!(input && input.disabled) || item.classList.contains('is-disabled') || !!(widget && widget.classList.contains('is-disabled'));
    return {
      field: {
        label: labels[0] || '',
        controlKind: kind.controlKind,
        classes: classTokens(widget ? [widget] : input ? [input] : []),
        itemClasses: classTokens([item]),
        placeholder: input?.getAttribute('placeholder') || null,
        readOnly,
        disabled,
        value,
        tag: (input || widget || anyInput)?.tagName || null,
        inputType: anyInput
          ? (anyInput.getAttribute('type') || (anyInput.tagName === 'TEXTAREA' ? 'textarea' : anyInput.tagName === 'SELECT' ? 'select' : 'text'))
          : null,
        dropdownTrigger: triggerSelector(item, trigger),
        note,
        supportClaimed: false
      },
      trigger
    };
  }

  function closeCandidates(root) {
    const nodes = [...root.querySelectorAll('a, button, [role="button"]')].filter((node) => visible(node));
    const safe = nodes.filter((node) => isSafeClickable(node));
    const cancel = safe.filter((node) => accessibleName(node) === '取消');
    if (cancel.length) return { label: '取消', nodes: cancel };
    const close = safe.filter((node) => accessibleName(node) === '关闭' || node.classList.contains('el-dialog__headerbtn'));
    return { label: '关闭', nodes: close };
  }

  async function waitFor(read, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    for (let i = 0; i < 200; i += 1) {
      const found = read();
      if (found) return found;
      if (Date.now() >= deadline) return null;
      await new Promise((resolve) => view.setTimeout(resolve, 40));
    }
    return null;
  }

  function visiblePoppers() {
    return [...doc.querySelectorAll('.el-popper, .el-select-dropdown, .el-cascader-panel, .el-picker-panel, .popover')].filter((node) => visible(node));
  }

  function readOptionNodes(poppers) {
    const options = [];
    for (const popper of poppers) {
      for (const node of popper.querySelectorAll('.el-select-dropdown__item, .el-cascader-node, [role="option"]')) {
        if (!visible(node)) continue;
        const text = norm(node.textContent).slice(0, 80);
        if (!text) continue;
        options.push({ text, classes: classTokens([node]) });
        if (options.length >= 40) return options;
      }
    }
    return options;
  }

  function pressEscape() {
    const init = { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true };
    doc.dispatchEvent(new view.KeyboardEvent('keydown', init));
    doc.dispatchEvent(new view.KeyboardEvent('keyup', init));
    actions.push({ type: 'keydown', key: 'Escape', label: 'Escape', name: '' });
  }

  async function openAndRead(item, field, trigger) {
    const base = {
      label: field.label,
      trigger: field.dropdownTrigger,
      options: [],
      popperClasses: [],
      escapePressed: false,
      optionsClicked: false,
      reason: null
    };
    if (!trigger || !trigger.isConnected) return { ...base, reason: 'trigger_not_found' };
    if (trigger.disabled || forbiddenName(accessibleName(trigger))) return { ...base, reason: 'trigger_not_safe' };
    const before = new Set(visiblePoppers());
    clickTrigger(trigger);
    await waitFor(() => visiblePoppers().some((node) => !before.has(node)) || null, 800);
    const poppers = visiblePoppers().filter((node) => !before.has(node));
    base.options = readOptionNodes(poppers);
    base.popperClasses = classTokens(poppers);
    pressEscape();
    base.escapePressed = true;
    return base;
  }

  async function dismiss(root) {
    const scope = root.closest('.el-dialog, .el-drawer, [role="dialog"]') || root;
    const found = closeCandidates(scope);
    if (found.nodes.length !== 1) {
      result.editorLeftOpen = true;
      return { closed: false, reason: found.nodes.length ? 'cancel_not_unique' : 'cancel_not_found' };
    }
    clickNode(found.nodes[0], found.label);
    const gone = await waitFor(() => !root.isConnected || !visible(root), 2000);
    result.editorLeftOpen = !gone;
    return gone ? { closed: true, reason: null } : { closed: false, reason: 'editor_still_open' };
  }

  function installTap() {
    const originalFetch = view.fetch;
    const xhr = view.XMLHttpRequest;
    const originalOpen = xhr?.prototype?.open;
    const originalSend = xhr?.prototype?.send;
    const originalBeacon = view.navigator?.sendBeacon;
    const onSubmit = (event) => {
      const form = event.target;
      if (!form || form.tagName !== 'FORM') return;
      posts.push({ via: 'submit', method: String(form.getAttribute('method') || form.method || 'GET').toUpperCase(), url: redactUrl(form.action || '') });
    };
    if (typeof originalFetch === 'function') {
      view.fetch = function fetchTap(input, init, ...rest) {
        const method = String((init && init.method) || (typeof input === 'object' && input ? input.method : '') || 'GET').toUpperCase();
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        posts.push({ via: 'fetch', method, url: redactUrl(url) });
        return originalFetch.call(this, input, init, ...rest);
      };
    }
    if (originalOpen && originalSend) {
      xhr.prototype.open = function openTap(method, url, ...rest) {
        this.__gthIntentProbe = { method: String(method || 'GET').toUpperCase(), url: redactUrl(url) };
        return originalOpen.call(this, method, url, ...rest);
      };
      xhr.prototype.send = function sendTap(...rest) {
        if (this.__gthIntentProbe) posts.push({ via: 'xhr', ...this.__gthIntentProbe });
        return originalSend.call(this, ...rest);
      };
    }
    if (typeof originalBeacon === 'function' && view.navigator) {
      view.navigator.sendBeacon = function beaconTap(url, ...rest) {
        posts.push({ via: 'beacon', method: 'POST', url: redactUrl(url) });
        return originalBeacon.call(this, url, ...rest);
      };
    }
    doc.addEventListener('submit', onSubmit, true);
    return () => {
      if (typeof originalFetch === 'function') view.fetch = originalFetch;
      if (originalOpen) xhr.prototype.open = originalOpen;
      if (originalSend) xhr.prototype.send = originalSend;
      if (typeof originalBeacon === 'function' && view.navigator) view.navigator.sendBeacon = originalBeacon;
      doc.removeEventListener('submit', onSubmit, true);
    };
  }

  function findCard() {
    const sections = [...doc.querySelectorAll('.r-section')].filter((section) => titleText(section) === '求职意向' && visible(section));
    if (sections.length === 1) return { ok: true, card: sections[0], via: 'r-section-title' };
    if (sections.length > 1) return { ok: false, reason: 'intent_card_ambiguous', detail: { cardCount: sections.length } };
    const labels = [...doc.querySelectorAll('h1, h2, h3, h4, div, span, p, label')].filter((node) => {
      if (!visible(node) || node.closest('.r-section')) return false;
      const ownText = norm([...node.childNodes].filter((child) => child.nodeType === 3).map((child) => child.textContent).join(''));
      return ownText === '求职意向' || (node.children.length === 0 && norm(node.textContent) === '求职意向');
    });
    const cards = [];
    for (const label of labels) {
      let card = label;
      for (let hop = 0; hop < 6 && card.parentElement; hop += 1) {
        if (editCandidates(card.parentElement).length) {
          card = card.parentElement;
          break;
        }
        card = card.parentElement;
      }
      if (!cards.includes(card)) cards.push(card);
    }
    if (cards.length === 1) return { ok: true, card: cards[0], via: 'visible-label' };
    if (cards.length > 1) return { ok: false, reason: 'intent_card_ambiguous', detail: { cardCount: cards.length } };
    return { ok: false, reason: 'intent_card_not_found', detail: { cardCount: 0 } };
  }

  try {
    if (!view || typeof view.getComputedStyle !== 'function') {
      result.reason = 'probe_failed';
      result.error = 'no_view';
      return result;
    }
    try { result.href = String(view.location?.href || ''); } catch { result.href = ''; }
    try { result.title = String(doc.title || ''); } catch { result.title = ''; }
    restore = installTap();
    const found = findCard();
    if (!found.ok) {
      result.reason = found.reason;
      result.detail = found.detail || null;
      return result;
    }
    result.cardVia = found.via;
    const card = found.card;
    const before = editorNodes();
    const split = splitEditors(before);
    result.staticInlineForms = split.staticInlineForms;
    const outside = split.opened.filter((node) => !card.contains(node));
    const inside = split.opened.filter((node) => card.contains(node));
    if (outside.length) {
      result.reason = 'other_editor_open';
      result.detail = { editorCount: outside.length };
      return result;
    }
    if (inside.length) {
      const chosen = preferEditor(inside);
      if (!chosen.ok) {
        result.reason = 'editor_not_unique';
        result.detail = { editorCount: chosen.count };
        result.editorLeftOpen = true;
        return result;
      }
      editor = chosen.editor;
      result.editorAlreadyOpen = true;
    } else {
      const edits = editCandidates(card);
      if (edits.length !== 1) {
        result.reason = edits.length ? 'intent_edit_not_unique' : 'intent_edit_not_found';
        result.detail = { editCount: edits.length };
        return result;
      }
      if (wouldNavigate(edits[0]) || !isSafeClickable(edits[0])) {
        result.reason = wouldNavigate(edits[0]) ? 'edit_would_navigate' : 'edit_not_safe';
        result.detail = { editCount: 1 };
        return result;
      }
      clickNode(edits[0], '编辑');
      openedByUs = true;
      result.openedByUs = true;
      const editorWaitMs = Number.isFinite(options.editorWaitMs) ? options.editorWaitMs : 4000;
      const appeared = await waitFor(() => {
        const now = editorNodes().filter((node) => !before.includes(node) && !isStaticInlineForm(node));
        if (!now.length) return null;
        const insideNow = now.filter((node) => card.contains(node));
        const chosen = preferEditor(insideNow.length ? insideNow : now);
        if (!chosen.ok) return { ambiguous: true, count: chosen.count };
        return { editor: chosen.editor };
      }, editorWaitMs);
      if (!appeared) {
        result.reason = 'editor_not_opened';
        result.editorLeftOpen = true;
        const stray = editorNodes().filter((node) => card.contains(node) && node.tagName === 'FORM');
        if (stray.length === 1) editor = stray[0];
        return result;
      }
      if (appeared.ambiguous) {
        result.reason = 'editor_not_unique';
        result.detail = { editorCount: appeared.count };
        result.editorLeftOpen = true;
        return result;
      }
      editor = appeared.editor;
    }
    result.editorLeftOpen = true;
    const rows = [...editor.querySelectorAll('.el-form-item')].slice(0, 80).map((item) => {
      const censused = censusItem(item);
      return { item, ...censused };
    });
    result.fields = rows.map((row) => row.field);
    if (options.openOptions === true) {
      result.optionsOpened = true;
      result.optionReads = [];
      for (const row of rows) {
        if (row.field.controlKind !== 'el-select' && row.field.controlKind !== 'el-cascader') continue;
        if (result.optionReads.length >= 12) break;
        result.optionReads.push(await openAndRead(row.item, row.field, row.trigger));
      }
      pressEscape();
    }
    const closed = await dismiss(editor);
    if (!closed.closed) {
      result.ok = false;
      result.reason = closed.reason;
      return result;
    }
    result.ok = true;
    result.reason = null;
    result.editorLeftOpen = false;
    return result;
  } catch (error) {
    result.ok = false;
    result.reason = error?.reason || result.reason || 'probe_failed';
    result.error = String(error?.message || error).slice(0, 300);
    return result;
  } finally {
    if (editor && !actions.some((action) => action.label === '取消' || action.label === '关闭')) {
      try { await dismiss(editor); } catch { /* the failure is already recorded */ }
    }
    try { restore(); } catch { /* leave the page hooks as they were if restore fails */ }
    result.openedByUs = openedByUs || result.openedByUs === true;
    result.actions = actions.map((action) => ({
      type: action.type,
      label: action.label,
      name: action.name || '',
      tag: action.tag || null,
      key: action.key || null
    }));
    result.clickedLabels = result.actions.filter((action) => action.type === 'click').map((action) => action.label);
    const flags = clickFlags(result.actions);
    result.softwareClickedSave = flags.softwareClickedSave;
    result.softwareClickedSubmit = flags.softwareClickedSubmit;
    result.softwareClickedDeliver = flags.softwareClickedDeliver;
    result.network = networkReport(posts);
    result.savePostObserved = result.network.savePostObserved;
    if (flags.softwareClickedSave || flags.softwareClickedSubmit || flags.softwareClickedDeliver) {
      result.ok = false;
      result.reason = 'refusing_forbidden_click';
    } else if (result.network.savePostObserved && !result.reason) {
      result.ok = false;
      result.reason = 'save_post_observed';
    }
    result.neverSave = true;
    result.claimedSupported = false;
    result.liveSupportClaimed = false;
    result.supported = false;
    result.supportClaimed = false;
    for (const field of result.fields) field.supportClaimed = false;
  }
}

export function buildProbeExpression({ openOptions = false } = {}) {
  const flag = openOptions === true ? 'true' : 'false';
  return [
    '(() => {',
    `const redactUrl = ${redactUrl.toString()};`,
    `const isSavePost = ${isSavePost.toString()};`,
    `const networkReport = ${networkReport.toString()};`,
    `const clickFlags = ${clickFlags.toString()};`,
    `const probeIntentEditor = ${probeIntentEditor.toString()};`,
    `return probeIntentEditor(document, { openOptions: ${flag} });`,
    '})()'
  ].join('\n');
}

function exitCodeFor(report) {
  if (report.ok) return 0;
  if (report.reason === 'save_post_observed' || report.reason === 'refusing_forbidden_click') return 3;
  if (['cdp_unreachable', 'timeout', 'probe_failed', 'cdp_endpoint_invalid', 'cdp_targets_invalid'].includes(report.reason)) return 1;
  return 2;
}

function fail(reason, message = reason) {
  const error = new Error(message);
  error.reason = reason;
  return error;
}

function evalValue(reply) {
  if (reply?.exceptionDetails) {
    const text = reply.exceptionDetails.exception?.description || reply.exceptionDetails.text || 'eval_failed';
    throw fail('probe_failed', String(text).slice(0, 300));
  }
  return reply?.result?.value;
}

export function buildReport(page, meta) {
  const flags = clickFlags(page?.actions);
  const network = networkReport([...(page?.network?.posts || []), ...(meta.cdpPosts || [])]);
  network.cdpEnabled = meta.cdpNetwork === true;
  network.pageHook = page?.network?.feasible === true;
  let reason = page?.reason || null;
  if (flags.softwareClickedSave || flags.softwareClickedSubmit || flags.softwareClickedDeliver) reason = 'refusing_forbidden_click';
  else if (network.savePostObserved) reason = 'save_post_observed';
  else if (page?.editorLeftOpen === true && !reason) reason = 'editor_still_open';
  const ok = page?.ok === true && !reason && page?.editorLeftOpen !== true;
  if (!ok && !reason) reason = meta.reason || 'probe_failed';
  return {
    probe: 'gth-intent-editor',
    probedAt: meta.probedAt,
    neverSave: true,
    claimedSupported: false,
    liveSupportClaimed: false,
    supported: false,
    formFillClaimed: false,
    productSupportUnchanged: true,
    shippedWritable: [...SHIPPED_WRITABLE],
    stillUnsupportedInProduct: [...STILL_UNSUPPORTED],
    ok,
    reason: ok ? null : reason,
    pageReason: page?.reason || null,
    exitCode: 0,
    port: meta.port,
    urlMatch: meta.urlMatch,
    openOptions: meta.openOptions === true,
    tabAction: meta.tabAction || 'none',
    tab: publicTab(meta.tab),
    tabs: Array.isArray(meta.tabs) ? meta.tabs.map(publicTab) : undefined,
    editor: page ? {
      alreadyOpen: page.editorAlreadyOpen === true,
      leftOpen: page.editorLeftOpen === true,
      openedByUs: page.openedByUs === true,
      cardVia: page.cardVia || null,
      href: redactUrl(page.href || ''),
      title: typeof page.title === 'string' ? page.title.slice(0, 120) : null
    } : null,
    detail: page?.detail && typeof page.detail === 'object' ? {
      cardCount: Number.isInteger(page.detail.cardCount) ? page.detail.cardCount : null,
      editCount: Number.isInteger(page.detail.editCount) ? page.detail.editCount : null,
      editorCount: Number.isInteger(page.detail.editorCount) ? page.detail.editorCount : null
    } : null,
    staticInlineForms: publicStaticInlineForms(page?.staticInlineForms),
    fields: Array.isArray(page?.fields) ? page.fields.map(plainField) : [],
    evidence: questionEvidence(page?.fields),
    optionReads: page?.optionsOpened === true && Array.isArray(page.optionReads) ? page.optionReads.slice(0, 12) : null,
    actions: Array.isArray(page?.actions) ? page.actions.slice(0, 40) : [],
    ...flags,
    network,
    error: page?.error || meta.error || null,
    path: meta.path || null
  };
}

export async function runGthIntentProbe(options = {}) {
  const port = options.port ?? DEFAULT_PORT;
  const urlMatch = options.urlMatch || DEFAULT_URL_MATCH;
  const openOptions = options.openOptions === true;
  const stepTimeoutMs = options.stepTimeoutMs ?? 25000;
  const outDir = options.outDir || path.join(repoRoot, 'dist', 'site-probes');
  const now = options.now || (() => new Date());
  const getJsonFn = options.getJson || getJson;
  const connectFn = options.connectCdp || connectCdp;
  const probedAt = now().toISOString();
  const filePath = probeOutputPath(outDir, new Date(probedAt));
  const sessions = [];
  const cdpPosts = [];
  const meta = {
    probedAt,
    port,
    urlMatch,
    openOptions,
    tabAction: 'none',
    tab: null,
    tabs: undefined,
    cdpPosts,
    cdpNetwork: false,
    path: filePath,
    reason: null,
    error: null
  };
  let page = null;

  const onEvent = (msg) => {
    if (msg?.method !== 'Network.requestWillBeSent') return;
    const request = msg.params?.request;
    if (!request) return;
    cdpPosts.push({ via: 'cdp', method: request.method, url: request.url });
  };

  async function attach(wsUrl, step) {
    if (!assertLoopback(wsUrl, port)) throw fail('cdp_endpoint_invalid');
    const session = await connectFn(wsUrl, { timeoutMs: stepTimeoutMs, step, onEvent });
    sessions.push(session);
    return session;
  }

  try {
    let targets;
    try {
      targets = await getJsonFn(port, '/json/list', { timeoutMs: stepTimeoutMs, step: 'target_list' });
    } catch (error) {
      if (isTimeout(error)) throw error;
      throw fail('cdp_unreachable');
    }
    if (!Array.isArray(targets)) throw fail('cdp_targets_invalid');
    const selected = selectResumeTarget(targets, urlMatch);
    let target = selected.target || null;
    if (selected.action === 'stop') {
      meta.tabAction = 'none';
      meta.reason = selected.reason;
      meta.tabs = selected.targets;
      throw fail(selected.reason);
    }
    if (selected.action === 'missing') {
      const url = openUrlFor(urlMatch);
      if (!url) {
        meta.reason = 'tab_not_found';
        throw fail('tab_not_found');
      }
      let version;
      try {
        version = await getJsonFn(port, '/json/version', { timeoutMs: stepTimeoutMs, step: 'browser_version' });
      } catch (error) {
        if (isTimeout(error)) throw error;
        throw fail('cdp_unreachable');
      }
      const browser = await attach(version?.webSocketDebuggerUrl, 'browser_attach');
      const created = await browser.send('Target.createTarget', { url }, { timeoutMs: stepTimeoutMs, step: 'target_create' });
      if (!created?.targetId) throw fail('probe_failed', 'target_create_failed');
      meta.tabAction = 'created';
      const deadline = Date.now() + Math.min(5000, stepTimeoutMs);
      while (!target && Date.now() < deadline) {
        const again = await getJsonFn(port, '/json/list', { timeoutMs: stepTimeoutMs, step: 'target_list' });
        if (!Array.isArray(again)) throw fail('cdp_targets_invalid');
        target = again.find((item) => item.id === created.targetId && item.type === 'page' && item.webSocketDebuggerUrl) || null;
        if (!target) await delay(100);
      }
      if (!target) throw fail('probe_failed', 'created_target_missing');
    } else {
      meta.tabAction = 'attached';
    }
    meta.tab = target;
    if (!target.webSocketDebuggerUrl) throw fail('cdp_endpoint_invalid');
    const session = await attach(target.webSocketDebuggerUrl, 'page_attach');
    await session.send('Page.setWebLifecycleState', { state: 'active' }, { timeoutMs: stepTimeoutMs, step: 'page_lifecycle_active' });
    try {
      await session.send('Network.enable', {}, { timeoutMs: stepTimeoutMs, step: 'network_enable' });
      meta.cdpNetwork = true;
    } catch {
      meta.cdpNetwork = false;
    }
    await session.send('Runtime.enable', {}, { timeoutMs: stepTimeoutMs, step: 'runtime_enable' });
    const guardDeadline = Date.now() + Math.min(5000, stepTimeoutMs);
    let guard = null;
    while (Date.now() <= guardDeadline) {
      const reply = await session.send('Runtime.evaluate', {
        expression: pageGuardExpression(),
        returnByValue: true,
        awaitPromise: false
      }, { timeoutMs: stepTimeoutMs, step: 'page_guard' });
      guard = evalValue(reply);
      if (looksLikeLogin(guard) || guard?.readyState === 'complete') break;
      await delay(100);
    }
    if (looksLikeLogin(guard)) {
      meta.reason = 'needs_login';
      throw fail('needs_login');
    }
    const reply = await session.send('Runtime.evaluate', {
      expression: buildProbeExpression({ openOptions }),
      returnByValue: true,
      awaitPromise: true
    }, { timeoutMs: stepTimeoutMs, step: 'probe_evaluate' });
    page = evalValue(reply);
    if (!page || typeof page !== 'object') throw fail('probe_failed', 'probe_result_invalid');
  } catch (error) {
    meta.reason = meta.reason || error?.reason || (isTimeout(error) ? 'timeout' : 'probe_failed');
    meta.error = String(error?.message || error).slice(0, 300);
    if (meta.reason === 'timeout') meta.error = 'timeout';
  } finally {
    for (const session of sessions) {
      try { session.close(); } catch { /* already closed */ }
    }
  }

  const report = buildReport(page, meta);
  if (!page && meta.reason) report.reason = meta.reason;
  report.exitCode = exitCodeFor(report);
  report.path = filePath;
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
  try {
    const args = parseProbeArgs(process.argv.slice(2));
    if (args.help) {
      process.stdout.write(HELP);
      process.exit(0);
    }
    const report = await runGthIntentProbe(args);
    process.stdout.write(`${report.path}\n`);
    process.exit(report.exitCode);
  } catch (error) {
    process.stderr.write(`${error?.message || error}\n`);
    process.exit(1);
  }
}
