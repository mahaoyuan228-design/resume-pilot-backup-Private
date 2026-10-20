#!/usr/bin/env node
/**
 * Read-only census of one opened editor on hr.gtht.com/resume/edit/.
 * Never Save, Submit, Deliver, or Delete. Does not claim the live site is supported.
 *
 *   node scripts/probe-gth-section.mjs --port 9239 --section 教育经历
 *   node scripts/probe-gth-section.mjs --port 9239 --section 求职意向 --open-options
 *   node scripts/probe-gth-section.mjs --port 9239 --section 工作经验 --entry 1
 *   node scripts/probe-gth-section.mjs --port 9239 --section 教育经历 --add
 *
 * Safety model, same as scripts/probe-gth-intent.mjs:
 *   Page.setWebLifecycleState {state:"active"} before the census.
 *   GTH hides a section's 编辑 link while its editor is open (hidden 编辑 = open).
 *   基本信息 has no 编辑 link; that always-on form is static and does not block.
 *   Any other opened editor blocks the probe before a click.
 *   The only clicks are the unique 编辑 (or, with --add, the unique 添加/新增)
 *   and that editor's 取消. Multi-entry sections open one entry: --entry <index>,
 *   default the first. --open-options reads hidden lists already in the DOM
 *   (el-select-dropdown and eo-cascader-panel li.branch levels) and does not
 *   click options. The only extra gesture is opening and Esc-closing one select
 *   whose list is not already rendered.
 *   Any POST/PUT/PATCH/DELETE is a failure, except a POST to a known dictionary
 *   endpoint such as getsalaryunit.json. Lookup GETs are not writes.
 * This script stays out of extension packs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { connectCdp, getJson } from '../tools/live-harvest/cdp-client.mjs';
import { isTimeout } from '../tools/live-harvest/errors.mjs';
import { readGthOptionLists } from './gth-option-reader.mjs';
import {
  DEFAULT_PORT,
  DEFAULT_URL_MATCH,
  EDIT_PAGE,
  assertLoopback,
  isSavePost,
  looksLikeLogin,
  openUrlFor,
  pageGuardExpression,
  redactUrl,
  selectResumeTarget
} from './probe-gth-intent.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const SECTION_NAMES = Object.freeze([
  '教育经历',
  '工作经验',
  '职业技能与特长',
  '其他信息',
  '求职意向'
]);

export const KNOWN_DICT_FILES = Object.freeze(['getsalaryunit.json']);

export const HELP = `Usage:
  node scripts/probe-gth-section.mjs --port 9239 --section 教育经历
  node scripts/probe-gth-section.mjs --port 9239 --section 求职意向 --open-options
  node scripts/probe-gth-section.mjs --port 9239 --section 工作经验 --entry 1
  node scripts/probe-gth-section.mjs --port 9239 --section 教育经历 --add

Read-only CDP census of one GTH resume editor. Never Save.
Does not log in, does not navigate an existing tab, and does not claim support.
Sections: ${SECTION_NAMES.join('、')}

Options:
  --port <cdp>            Loopback CDP port. Default ${DEFAULT_PORT}
  --section <名称>        One of: ${SECTION_NAMES.join('、')}
  --url-match <text>      Substring that selects the resume tab. Default ${DEFAULT_URL_MATCH}
  --entry <index>         Multi-entry 编辑 to open. Default 0 (the first)
  --add                   Click the unique 添加/新增 trigger instead of 编辑
  --open-options          Read hidden option lists already in the DOM. At most one select is opened, then Escape
  --step-timeout-ms <n>   Timeout for each CDP call. Default 25000
  --help                  Show this help
`;

export function isKnownDictEndpoint(url) {
  const files = ['getsalaryunit.json'];
  let pathname = '';
  try {
    pathname = new URL(redactUrl(url), 'https://hr.gtht.com').pathname;
  } catch {
    return false;
  }
  const file = pathname.split('/').filter(Boolean).pop() || '';
  return files.includes(file.toLowerCase());
}

export function isUnexpectedWrite(method, url) {
  const verb = String(method || '').toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(verb)) return false;
  if (verb === 'POST' && isKnownDictEndpoint(url)) return false;
  return true;
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
    unexpectedPostObserved: rows.some((row) => isUnexpectedWrite(row.method, row.url)),
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
    softwareClickedDeliver: has('投递'),
    softwareClickedDelete: has('删除')
  };
}

export function parseProbeArgs(argv) {
  const opts = {
    port: DEFAULT_PORT,
    urlMatch: DEFAULT_URL_MATCH,
    section: '',
    entry: 0,
    entryExplicit: false,
    add: false,
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
    if (arg === '--add') {
      if (seen.has(arg)) throw new Error('duplicate --add');
      seen.add(arg);
      opts.add = true;
      continue;
    }
    const valued = ['--port', '--url-match', '--step-timeout-ms', '--section', '--entry'];
    if (!valued.includes(arg)) throw new Error(`unknown argument: ${arg}`);
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
    } else if (arg === '--section') {
      if (!SECTION_NAMES.includes(value)) throw new Error('unknown section');
      opts.section = value;
    } else if (arg === '--entry') {
      if (!/^\d+$/u.test(value)) throw new Error('bad entry');
      const entry = Number(value);
      if (entry < 0 || entry > 29) throw new Error('bad entry');
      opts.entry = entry;
      opts.entryExplicit = true;
    } else {
      if (!/^\d+$/u.test(value)) throw new Error('bad step-timeout');
      const ms = Number(value);
      if (ms < 1000 || ms > 120000) throw new Error('bad step-timeout');
      opts.stepTimeoutMs = ms;
    }
  }
  if (opts.add && opts.entryExplicit) throw new Error('cannot combine --add and --entry');
  if (!opts.help && !opts.section) throw new Error('missing --section');
  return opts;
}

export function probeOutputPath(outDir, section, date) {
  if (!SECTION_NAMES.includes(section)) throw new Error('unknown section');
  const stamp = date.toISOString().replace(/[:.]/gu, '').replace(/-/gu, '');
  return path.join(outDir, `probe-gth-section-${section}-${stamp}.json`);
}

/**
 * DOM census for one section. Self-contained except the helpers
 * buildProbeExpression injects beside this function for the page.
 */
export async function probeSectionEditor(doc, options = {}) {
  const view = doc?.defaultView;
  const actions = [];
  const posts = [];
  let restore = () => {};
  let editor = null;
  let openedByUs = false;
  let selectOpened = false;
  const sectionName = typeof options.section === 'string' ? options.section : '';
  const addMode = options.add === true;
  const entryIndex = Number.isInteger(options.entry) ? options.entry : 0;
  const entryExplicit = options.entryExplicit === true;
  const result = {
    ok: false,
    reason: null,
    error: null,
    neverSave: true,
    claimedSupported: false,
    liveSupportClaimed: false,
    supported: false,
    supportClaimed: false,
    section: sectionName,
    entry: addMode ? null : entryIndex,
    add: addMode,
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
    softwareClickedDelete: false,
    unexpectedPostObserved: false,
    savePostObserved: false,
    network: { feasible: true, posts: [], unexpectedPostObserved: false, savePostObserved: false },
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
    return ['保存', '提交', '投递', '删除', '确定'].some((word) => String(name || '').includes(word));
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

  function inPicker(node) {
    return !!(node && typeof node.closest === 'function'
      && node.closest('.plugin-dialog-wrap, .eo-cascader-panel, .el-select-dropdown, .el-picker-panel'));
  }

  function isEditAffordance(node) {
    if (!node || inPicker(node)) return false;
    if (accessibleName(node) === '编辑') return true;
    return !!node.querySelector?.('.el-icon-edit-outline, .el-icon-edit');
  }

  function isAddAffordance(node) {
    if (!node || inPicker(node)) return false;
    const name = accessibleName(node);
    return name === '添加' || name === '新增';
  }

  function controlsIn(root, section, match) {
    if (!root) return [];
    return [...root.querySelectorAll('a, button, [role="button"]')].filter((node) => {
      if (section && node.closest('.r-section') !== section) return false;
      if (root !== section && !root.contains(node)) return false;
      return match(node);
    });
  }

  function sectionEditNodes(section) {
    return controlsIn(section, section, isEditAffordance);
  }

  function isToggledEditorShell(node) {
    return !!(node && typeof node.closest === 'function' && node.closest('.el-dialog, .el-drawer, [role="dialog"]'));
  }

  function isStaticInlineForm(node) {
    if (!node || node.tagName !== 'FORM' || isToggledEditorShell(node)) return false;
    const section = node.closest('.r-section');
    if (!section) return false;
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

  function entryNodes(section) {
    return [...section.querySelectorAll('.sec-context > .sec-detail')]
      .filter((node) => node.closest('.r-section') === section);
  }

  function hiddenEntryIndexes(entries, section) {
    const indexes = [];
    entries.forEach((entry, index) => {
      const edits = controlsIn(entry, section, isEditAffordance);
      if (edits.length > 0 && edits.every((node) => !visible(node))) indexes.push(index);
    });
    return indexes;
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
    const upload = own(item, '.el-upload').length ? own(item, '.el-upload') : own(item, 'input[type="file"]');
    const cascader = own(item, '.cascader-wrap');
    const selects = own(item, '.el-select');
    const dates = own(item, '.el-date-editor');
    const textareas = own(item, 'textarea');
    const present = [
      upload.length ? ['upload', upload] : null,
      cascader.length ? ['cascader-wrap', cascader] : null,
      selects.length ? ['el-select', selects] : null,
      dates.length ? ['el-date-editor', dates] : null,
      textareas.length ? ['textarea', textareas] : null
    ].filter(Boolean);
    if (present.length > 1) return { controlKind: 'custom', widget: present[0][1][0], note: 'widget_not_unique' };
    if (present.length === 1) {
      const [kind, nodes] = present[0];
      if (kind !== 'el-date-editor' && nodes.length !== 1) {
        return { controlKind: 'custom', widget: nodes[0], note: 'widget_not_unique' };
      }
      return {
        controlKind: kind,
        widget: nodes[0],
        note: kind === 'el-date-editor' && nodes.length !== 1 ? `date_editors:${nodes.length}` : null
      };
    }
    const radios = own(item, 'input[type="radio"], .el-radio');
    const checks = own(item, 'input[type="checkbox"], .el-checkbox')
      .filter((node) => !inPicker(node));
    if (radios.length && checks.length) return { controlKind: 'custom', widget: null, note: 'mixed_choice' };
    if (radios.length) return { controlKind: 'radio', widget: radios[0], note: null };
    if (checks.length) return { controlKind: 'checkbox', widget: checks[0], note: null };
    const textLike = own(item, 'input').filter((node) => {
      if (inPicker(node)) return false;
      const type = (node.getAttribute('type') || '').toLowerCase();
      return !['radio', 'checkbox', 'hidden', 'file', 'password', 'button', 'submit'].includes(type);
    });
    if (textLike.length) {
      const widget = textLike[0].closest('.el-input') || textLike[0];
      return { controlKind: 'el-input', widget, note: null };
    }
    return { controlKind: 'custom', widget: own(item, '.el-form-item__content')[0] || null, note: null };
  }

  function requiredItem(item, label) {
    if (item.classList.contains('is-required')) return true;
    const labels = own(item, '.el-form-item__label');
    if (labels.some((node) => node.classList.contains('is-required'))) return true;
    return /^\*/u.test(label);
  }

  function censusItem(item) {
    const kind = classify(item);
    const labels = own(item, '.el-form-item__label').map((node) => norm(node.textContent)).filter(Boolean);
    const label = labels[0] || '';
    const input = own(item, 'input, textarea, select').find((node) => {
      if (inPicker(node) || node.closest('.el-select-dropdown, .el-picker-panel')) return false;
      const type = (node.getAttribute('type') || '').toLowerCase();
      return !['hidden', 'radio', 'checkbox', 'file', 'password', 'button', 'submit'].includes(type);
    }) || null;
    const anyInput = own(item, 'input, textarea, select').find((node) => !inPicker(node)) || null;
    let value = '';
    let note = kind.note;
    if (kind.controlKind === 'upload' || own(item, 'input[type="file"]').length) {
      value = '';
      note = note || 'upload_not_read';
    } else if (own(item, 'input[type="password"]').length) {
      value = '';
      note = note || 'password_redacted';
    } else if (kind.controlKind === 'radio' || kind.controlKind === 'checkbox') {
      value = own(item, 'input').filter((node) => node.checked && !inPicker(node)).map((node) => {
        const text = norm(node.closest('label')?.textContent || '');
        return text || String(node.value || '');
      }).join(' | ').slice(0, 200);
    } else if (kind.controlKind === 'el-date-editor') {
      const raw = own(item, '.el-date-editor input, .el-date-editor textarea').map((node) => String(node.value ?? '')).join(' | ');
      value = raw.slice(0, 200);
      if (raw.length > 200) note = note || 'value_truncated';
    } else if (input) {
      const raw = String(input.value ?? '');
      value = raw.slice(0, 200);
      if (raw.length > 200) note = note || 'value_truncated';
    }
    const widgetRoot = kind.controlKind === 'el-select'
      ? own(item, '.el-select')[0]
      : kind.controlKind === 'cascader-wrap' ? own(item, '.cascader-wrap')[0] : null;
    const trigger = widgetRoot
      ? ([...widgetRoot.querySelectorAll('input.el-input__inner, .el-input__inner')].find((node) => !inPicker(node) && node.closest('.el-form-item') === item) || null)
      : null;
    const widget = kind.widget;
    const readOnly = !!(input && (input.readOnly || input.hasAttribute('readonly')));
    const disabled = !!(input && input.disabled) || item.classList.contains('is-disabled') || !!(widget && widget.classList.contains('is-disabled'));
    return {
      field: {
        label,
        required: requiredItem(item, label),
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
    const nodes = [...root.querySelectorAll('a, button, [role="button"]')].filter((node) => visible(node) && !inPicker(node));
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

  function pressEscape() {
    const init = { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true };
    doc.dispatchEvent(new view.KeyboardEvent('keydown', init));
    doc.dispatchEvent(new view.KeyboardEvent('keyup', init));
    actions.push({ type: 'keydown', key: 'Escape', label: 'Escape', name: '' });
  }

  async function readFieldOptions(item, field, trigger) {
    const base = {
      label: field.label,
      trigger: field.dropdownTrigger,
      options: [],
      levels: [],
      escapePressed: false,
      optionsClicked: false,
      openedSelect: false,
      renderedInPlace: false,
      reason: null
    };
    const rendered = readGthOptionLists(item);
    if (rendered.options.length) {
      base.options = rendered.options.slice(0, 200);
      base.levels = rendered.levels;
      base.renderedInPlace = true;
      return base;
    }
    if (field.controlKind !== 'el-select') return { ...base, reason: 'options_not_rendered' };
    if (selectOpened) return { ...base, reason: 'select_open_skipped' };
    if (!trigger || !trigger.isConnected) return { ...base, reason: 'trigger_not_found' };
    if (trigger.disabled || forbiddenName(accessibleName(trigger))) return { ...base, reason: 'trigger_not_safe' };
    const before = new Set(visiblePoppers());
    clickTrigger(trigger);
    selectOpened = true;
    base.openedSelect = true;
    await waitFor(() => visiblePoppers().some((node) => !before.has(node)) || null, 800);
    const poppers = visiblePoppers().filter((node) => !before.has(node));
    const opened = readGthOptionLists(poppers.length ? poppers : item);
    base.options = opened.options.slice(0, 200);
    base.levels = opened.levels;
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
        this.__gthSectionProbe = { method: String(method || 'GET').toUpperCase(), url: redactUrl(url) };
        return originalOpen.call(this, method, url, ...rest);
      };
      xhr.prototype.send = function sendTap(...rest) {
        if (this.__gthSectionProbe) posts.push({ via: 'xhr', ...this.__gthSectionProbe });
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
    const sections = [...doc.querySelectorAll('.r-section')].filter((section) => titleText(section) === sectionName && visible(section));
    if (sections.length === 1) return { ok: true, card: sections[0], via: 'r-section-title' };
    if (sections.length > 1) return { ok: false, reason: 'section_ambiguous', detail: { cardCount: sections.length } };
    const labels = [...doc.querySelectorAll('h1, h2, h3, h4, div, span, p, label')].filter((node) => {
      if (!visible(node) || node.closest('.r-section')) return false;
      const ownText = norm([...node.childNodes].filter((child) => child.nodeType === 3).map((child) => child.textContent).join(''));
      return ownText === sectionName || (node.children.length === 0 && norm(node.textContent) === sectionName);
    });
    const cards = [];
    for (const label of labels) {
      let card = label;
      for (let hop = 0; hop < 6 && card.parentElement; hop += 1) {
        if (controlsIn(card.parentElement, null, isEditAffordance).filter(visible).length || controlsIn(card.parentElement, null, isAddAffordance).filter(visible).length) {
          card = card.parentElement;
          break;
        }
        card = card.parentElement;
      }
      if (!cards.includes(card)) cards.push(card);
    }
    if (cards.length === 1) return { ok: true, card: cards[0], via: 'visible-label' };
    if (cards.length > 1) return { ok: false, reason: 'section_ambiguous', detail: { cardCount: cards.length } };
    return { ok: false, reason: 'section_not_found', detail: { cardCount: 0 } };
  }

  function refuseControl(node, missing, navigate) {
    if (wouldNavigate(node)) {
      result.reason = navigate;
      return true;
    }
    if (!isSafeClickable(node)) {
      result.reason = missing;
      return true;
    }
    return false;
  }

  try {
    if (!view || typeof view.getComputedStyle !== 'function') {
      result.reason = 'probe_failed';
      result.error = 'no_view';
      return result;
    }
    const allowedSections = ['教育经历', '工作经验', '职业技能与特长', '其他信息', '求职意向'];
    if (!allowedSections.includes(sectionName)) {
      result.reason = 'section_not_allowed';
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
    const entries = entryNodes(card);
    const before = editorNodes();
    const split = splitEditors(before);
    result.staticInlineForms = split.staticInlineForms;
    const outside = split.opened.filter((node) => !card.contains(node));
    const inside = split.opened.filter((node) => card.contains(node));
    result.detail = {
      cardCount: 1,
      entryCount: entries.length,
      entry: addMode ? null : entryIndex,
      editCount: null,
      addCount: null,
      editorCount: outside.length + inside.length
    };
    if (outside.length) {
      result.reason = 'other_editor_open';
      result.detail.editorCount = outside.length;
      return result;
    }
    if (inside.length && addMode) {
      result.reason = 'editor_already_open';
      result.editorLeftOpen = true;
      result.detail.editorCount = inside.length;
      return result;
    }
    if (inside.length && entries.length) {
      const hiddenIndexes = hiddenEntryIndexes(entries, card);
      const contained = entries.findIndex((entry) => inside.some((node) => entry.contains(node)));
      const matches = contained === entryIndex
        || (contained < 0 && hiddenIndexes.length === 1 && hiddenIndexes[0] === entryIndex);
      if (!matches) {
        result.reason = 'entry_editor_mismatch';
        result.editorLeftOpen = true;
        result.detail.hiddenEntries = hiddenIndexes;
        result.detail.editorCount = inside.length;
        return result;
      }
    }
    if (inside.length) {
      const chosen = preferEditor(inside);
      if (!chosen.ok) {
        result.reason = 'editor_not_unique';
        result.detail.editorCount = chosen.count;
        result.editorLeftOpen = true;
        return result;
      }
      editor = chosen.editor;
      result.editorAlreadyOpen = true;
    } else if (addMode) {
      const adds = controlsIn(card, card, isAddAffordance).filter(visible);
      result.detail.addCount = adds.length;
      if (adds.length !== 1) {
        result.reason = adds.length ? 'add_not_unique' : 'add_not_found';
        return result;
      }
      if (refuseControl(adds[0], 'add_not_safe', 'add_would_navigate')) return result;
      clickNode(adds[0], accessibleName(adds[0]));
      openedByUs = true;
      result.openedByUs = true;
    } else if (entries.length) {
      if (entryIndex < 0 || entryIndex >= entries.length) {
        result.reason = 'entry_not_found';
        result.detail.entryCount = entries.length;
        return result;
      }
      const edits = controlsIn(entries[entryIndex], card, isEditAffordance).filter(visible);
      result.detail.editCount = edits.length;
      if (edits.length !== 1) {
        result.reason = edits.length ? 'edit_not_unique' : 'edit_not_found';
        return result;
      }
      if (refuseControl(edits[0], 'edit_not_safe', 'edit_would_navigate')) return result;
      clickNode(edits[0], '编辑');
      openedByUs = true;
      result.openedByUs = true;
    } else {
      if (entryExplicit && entryIndex !== 0) {
        result.reason = 'entry_not_found';
        result.detail.entryCount = 0;
        return result;
      }
      const edits = controlsIn(card, card, isEditAffordance).filter(visible);
      result.detail.editCount = edits.length;
      if (edits.length !== 1) {
        result.reason = edits.length ? 'edit_not_unique' : 'edit_not_found';
        return result;
      }
      if (refuseControl(edits[0], 'edit_not_safe', 'edit_would_navigate')) return result;
      clickNode(edits[0], '编辑');
      openedByUs = true;
      result.openedByUs = true;
    }
    if (!editor) {
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
        result.detail.editorCount = appeared.count;
        result.editorLeftOpen = true;
        return result;
      }
      editor = appeared.editor;
    }
    result.editorLeftOpen = true;
    const rows = [...editor.querySelectorAll('.el-form-item')].filter((item) => item.closest('form, .el-dialog, .el-drawer, [role="dialog"]') === editor || editor.contains(item)).slice(0, 80).map((item) => {
      const censused = censusItem(item);
      return { item, ...censused };
    });
    result.fields = rows.map((row) => row.field);
    if (options.openOptions === true) {
      result.optionsOpened = true;
      result.optionReads = [];
      for (const row of rows) {
        if (row.field.controlKind !== 'el-select' && row.field.controlKind !== 'cascader-wrap') continue;
        if (result.optionReads.length >= 12) break;
        result.optionReads.push(await readFieldOptions(row.item, row.field, row.trigger));
      }
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
    result.softwareClickedDelete = flags.softwareClickedDelete;
    result.network = networkReport(posts);
    result.unexpectedPostObserved = result.network.unexpectedPostObserved;
    result.savePostObserved = result.network.savePostObserved;
    if (flags.softwareClickedSave || flags.softwareClickedSubmit || flags.softwareClickedDeliver || flags.softwareClickedDelete) {
      result.ok = false;
      result.reason = 'refusing_forbidden_click';
    } else if (result.network.unexpectedPostObserved && !result.reason) {
      result.ok = false;
      result.reason = 'unexpected_post';
    }
    result.neverSave = true;
    result.claimedSupported = false;
    result.liveSupportClaimed = false;
    result.supported = false;
    result.supportClaimed = false;
    for (const field of result.fields) field.supportClaimed = false;
  }
}

export function buildProbeExpression({ section, entry = 0, entryExplicit = false, add = false, openOptions = false } = {}) {
  const payload = JSON.stringify({
    section,
    entry,
    entryExplicit: entryExplicit === true,
    add: add === true,
    openOptions: openOptions === true
  });
  return [
    '(() => {',
    `const readGthOptionLists = ${readGthOptionLists.toString()};`,
    `const redactUrl = ${redactUrl.toString()};`,
    `const isSavePost = ${isSavePost.toString()};`,
    `const isKnownDictEndpoint = ${isKnownDictEndpoint.toString()};`,
    `const isUnexpectedWrite = ${isUnexpectedWrite.toString()};`,
    `const networkReport = ${networkReport.toString()};`,
    `const clickFlags = ${clickFlags.toString()};`,
    `const probeSectionEditor = ${probeSectionEditor.toString()};`,
    `return probeSectionEditor(document, ${payload});`,
    '})()'
  ].join('\n');
}

function exitCodeFor(report) {
  if (report.ok) return 0;
  if (report.reason === 'unexpected_post' || report.reason === 'save_post_observed' || report.reason === 'refusing_forbidden_click') return 3;
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
    required: field?.required === true,
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

function plainOption(option) {
  return {
    text: String(option?.text || '').slice(0, 80),
    classes: strings(option?.classes, 16),
    level: Number.isInteger(option?.level) ? option.level : null
  };
}

function plainOptionRead(row) {
  const levels = Array.isArray(row?.levels) ? row.levels.slice(0, 2).map((level) => ({
    level: Number.isInteger(level?.level) ? level.level : null,
    options: Array.isArray(level?.options) ? level.options.slice(0, 200).map(plainOption) : []
  })) : [];
  return {
    label: String(row?.label || ''),
    trigger: typeof row?.trigger === 'string' ? row.trigger : null,
    options: Array.isArray(row?.options) ? row.options.slice(0, 200).map(plainOption) : [],
    levels,
    escapePressed: row?.escapePressed === true,
    optionsClicked: row?.optionsClicked === true,
    openedSelect: row?.openedSelect === true,
    renderedInPlace: row?.renderedInPlace === true,
    reason: typeof row?.reason === 'string' ? row.reason : null
  };
}

function integerOrNull(value) {
  return Number.isInteger(value) ? value : null;
}

export function buildReport(page, meta) {
  const flags = clickFlags(page?.actions);
  const network = networkReport([...(page?.network?.posts || []), ...(meta.cdpPosts || [])]);
  network.cdpEnabled = meta.cdpNetwork === true;
  network.pageHook = page?.network?.feasible === true;
  let reason = page?.reason || null;
  if (flags.softwareClickedSave || flags.softwareClickedSubmit || flags.softwareClickedDeliver || flags.softwareClickedDelete) reason = 'refusing_forbidden_click';
  else if (network.unexpectedPostObserved) reason = 'unexpected_post';
  else if (page?.editorLeftOpen === true && !reason) reason = 'editor_still_open';
  const ok = page?.ok === true && !reason && page?.editorLeftOpen !== true;
  if (!ok && !reason) reason = meta.reason || 'probe_failed';
  const detail = page?.detail && typeof page.detail === 'object' ? page.detail : null;
  return {
    probe: 'gth-section-editor',
    section: typeof meta.section === 'string' ? meta.section : (page?.section || ''),
    entry: meta.add === true ? null : integerOrNull(meta.entry ?? page?.entry),
    add: meta.add === true || page?.add === true,
    probedAt: meta.probedAt,
    neverSave: true,
    claimedSupported: false,
    liveSupportClaimed: false,
    supported: false,
    formFillClaimed: false,
    productSupportUnchanged: true,
    supportClaimed: false,
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
    detail: detail ? {
      cardCount: integerOrNull(detail.cardCount),
      editCount: integerOrNull(detail.editCount),
      addCount: integerOrNull(detail.addCount),
      editorCount: integerOrNull(detail.editorCount),
      entryCount: integerOrNull(detail.entryCount),
      entry: integerOrNull(detail.entry)
    } : null,
    staticInlineForms: publicStaticInlineForms(page?.staticInlineForms),
    fields: Array.isArray(page?.fields) ? page.fields.map(plainField) : [],
    optionReads: page?.optionsOpened === true && Array.isArray(page.optionReads) ? page.optionReads.slice(0, 12).map(plainOptionRead) : null,
    actions: Array.isArray(page?.actions) ? page.actions.slice(0, 40) : [],
    ...flags,
    network,
    error: page?.error || meta.error || null,
    path: meta.path || null
  };
}

export async function runGthSectionProbe(options = {}) {
  const port = options.port ?? DEFAULT_PORT;
  const urlMatch = options.urlMatch || DEFAULT_URL_MATCH;
  const section = options.section;
  const entry = Number.isInteger(options.entry) ? options.entry : 0;
  const entryExplicit = options.entryExplicit === true;
  const add = options.add === true;
  const openOptions = options.openOptions === true;
  const stepTimeoutMs = options.stepTimeoutMs ?? 25000;
  const outDir = options.outDir || path.join(repoRoot, 'dist', 'site-probes');
  const now = options.now || (() => new Date());
  const getJsonFn = options.getJson || getJson;
  const connectFn = options.connectCdp || connectCdp;
  const probedAt = now().toISOString();
  const filePath = SECTION_NAMES.includes(section) ? probeOutputPath(outDir, section, new Date(probedAt)) : path.join(outDir, 'probe-gth-section-invalid.json');
  const sessions = [];
  const cdpPosts = [];
  const meta = {
    probedAt,
    port,
    urlMatch,
    section,
    entry,
    entryExplicit,
    add,
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
    if (!SECTION_NAMES.includes(section)) throw fail('section_not_allowed');
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
      expression: buildProbeExpression({ section, entry, entryExplicit, add, openOptions }),
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
    const report = await runGthSectionProbe(args);
    process.stdout.write(`${report.path}\n`);
    process.exit(report.exitCode);
  } catch (error) {
    process.stderr.write(`${error?.message || error}\n`);
    process.exit(1);
  }
}
