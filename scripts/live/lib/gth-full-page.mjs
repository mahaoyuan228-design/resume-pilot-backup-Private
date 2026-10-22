// Browser-side Never-Save harness. Selectors come from the shipped GTH writers
// and the existing gth-intent-live / gth-other-skills-live harnesses.
import { SECTION_TITLES, decideOpen, decideCancel } from '../gth-intent-live.mjs';
import { EDIT_PAGE, redactUrl } from '../../probe-gth-intent.mjs';

export const SALARY_UNIT_LOOKUP = 'https://hr.gtht.com/interface/js/type/getsalaryunit.json';

export function isAllowedRequest(method, rawUrl) {
  const verb = String(method || 'GET').toUpperCase();
  if (verb === 'GET') return true;
  if (verb !== 'POST') return false;
  try {
    const url = new URL(String(rawUrl), 'https://hr.gtht.com/resume/edit/');
    return !url.username && !url.password
      && `${url.origin}${url.pathname}` === SALARY_UNIT_LOOKUP;
  } catch { return false; }
}

export function buildPageExpression(options = {}) {
  return `(() => {
    const SALARY_UNIT_LOOKUP = ${JSON.stringify(SALARY_UNIT_LOOKUP)};
    const isAllowedRequest = ${isAllowedRequest.toString()};
    const redactUrl = ${redactUrl.toString()};
    const decideOpen = ${decideOpen.toString()};
    const decideCancel = ${decideCancel.toString()};
    return (${installGthFullLive.toString()})(globalThis.document, ${JSON.stringify({
      titles: SECTION_TITLES, pageUrl: EDIT_PAGE, waitTimeoutMs: 4000, pollMs: 60, ...options
    })});
  })()`;
}

function installGthFullLive(doc, options) {
  const view = doc.defaultView;
  view.__gthFullLive?.restore();
  const clickRows = [];
  const requestRows = [];
  let activeSectionIndex = null;
  const norm = value => String(value ?? '').replace(/[\s\u00a0]+/gu, ' ').trim();
  const sections = () => [...doc.querySelectorAll('.r-section')];
  const forms = () => sections().flatMap(section => [...section.querySelectorAll('form')]);
  function visible(node) {
    if (!node || node.nodeType !== 1 || !node.isConnected) return false;
    for (let cur = node; cur?.nodeType === 1; cur = cur.parentElement) {
      const style = view.getComputedStyle(cur);
      if (cur.hasAttribute('hidden') || !style || style.display === 'none' || style.visibility === 'hidden') return false;
    }
    return !!node.getClientRects().length;
  }
  function titleOf(section) {
    const title = section.querySelector('.title_')?.cloneNode(true);
    title?.querySelectorAll('a,button').forEach(child => child.remove());
    return norm(title?.textContent);
  }
  function state() {
    const href = String(view.location.href || '');
    const list = sections();
    const sectionFormCounts = options.titles.map((_, index) => list[index]?.querySelectorAll('form').length || 0);
    const formCount = forms().length;
    const basicForms = list[0] ? [...list[0].querySelectorAll('form.el-form.sec-form')] : [];
    const basicEdits = list[0] ? [...list[0].querySelectorAll('.title_ a.h-e-btn')]
      .filter(node => norm(node.textContent) === '编辑') : [];
    const basicCancels = basicForms.length === 1 ? [...basicForms[0].querySelectorAll('button')]
      .filter(node => visible(node) && norm(node.textContent) === '取消') : [];
    // The census-backed initial basic form has no 编辑 link. This narrowly
    // identifies it for the orchestrator's first section; it is not permission
    // to adopt an arbitrary editor that was already open when the run began.
    const basicInitialEditor = formCount === 1 && sectionFormCounts[0] === 1
      && basicForms.length === 1 && basicEdits.length === 0
      && basicCancels.length === 1 && basicCancels[0].type === 'button';
    return {
      href, hrefOk: href === options.pageUrl, readyState: doc.readyState,
      visible: doc.visibilityState === 'visible',
      titlesOk: JSON.stringify(list.map(titleOf)) === JSON.stringify(options.titles),
      formCount, editorFormCount: formCount, activeSectionIndex,
      sectionFormCounts, basicInitialEditor
    };
  }
  function wouldNavigate(node) {
    const href = node?.getAttribute('href')?.trim();
    return !!href && href !== '#' && !/^javascript:(?:;|void\(0\))$/iu.test(href);
  }
  function snapshot(sectionIndex) {
    const list = sections();
    const section = list[sectionIndex];
    const links = section ? [...section.querySelectorAll('.title_ a.h-e-btn')]
      .filter(node => norm(node.textContent) === '编辑') : [];
    const shownLinks = links.filter(visible);
    return {
      ...state(),
      foreignFormCount: list.reduce((sum, node, index) => sum + (index === sectionIndex ? 0 : node.querySelectorAll('form').length), 0),
      formCount: section?.querySelectorAll('form').length || 0,
      secFormCount: section?.querySelectorAll('form.el-form.sec-form').length || 0,
      editLinkCount: shownLinks.length, editLinkPresentCount: links.length,
      editWouldNavigate: shownLinks.length === 1 && wouldNavigate(shownLinks[0])
    };
  }
  function activeForm() {
    if (activeSectionIndex == null) return null;
    const section = sections()[activeSectionIndex];
    const matches = section ? [...section.querySelectorAll('form.el-form.sec-form')] : [];
    return matches.length === 1 && forms().length === 1 ? matches[0] : null;
  }
  function classifyClick(target) {
    const node = target?.nodeType === 1 ? target : target?.parentElement;
    const denied = { allowed: false, kind: 'forbidden', reason: 'refusing_forbidden_click' };
    if (!node || !visible(node) || !state().hrefOk || !state().visible) return denied;
    const label = norm(node.textContent);
    if (['保存', '提交', '投递', '删除', '确定'].some(word => label.includes(word))) return denied;
    const edit = node.closest('.title_ a.h-e-btn');
    if (edit && norm(edit.textContent) === '编辑' && !wouldNavigate(edit)
        && edit.closest('.r-section') === sections()[activeSectionIndex] && forms().length === 0) {
      return { allowed: true, kind: 'edit', reason: null };
    }
    const form = activeForm();
    const cancel = node.closest('button');
    if (form && cancel && form.contains(cancel) && cancel.type === 'button' && norm(cancel.textContent) === '取消') {
      return { allowed: true, kind: 'cancel', reason: null };
    }
    if (!form) return denied;
    if (cancel || wouldNavigate(node.closest('a'))) return denied;
    // Only option nodes in an already-visible, census-backed panel qualify.
    // Trigger inputs, radio labels, picker footer confirmation, chip removal,
    // and date navigation arrows are deliberately outside this allowlist.
    const panel = node.closest('.el-select-dropdown,.el-picker-panel,div.dialog-wrap.plugin-dialog-wrap.popover.blue');
    if (!panel || !visible(panel)) return denied;
    const owner = panel.closest('.r-section');
    if (owner && owner !== sections()[activeSectionIndex]) return denied;
    const selectOption = node.closest('.el-select-dropdown__item');
    const monthOption = node.closest('.el-month-table td');
    const branchOption = node.closest('.eo-cascader-panel li.branch');
    if ((selectOption && panel.contains(selectOption) && panel.matches('.el-select-dropdown'))
        || (monthOption && panel.contains(monthOption) && panel.matches('.el-picker-panel'))
        || (branchOption && panel.contains(branchOption) && panel.matches('div.dialog-wrap.plugin-dialog-wrap.popover.blue'))) {
      return { allowed: true, kind: 'picker_option', reason: null };
    }
    return denied;
  }
  function noteClick(node, classification) {
    clickRows.push({ label: norm(node?.textContent).slice(0, 100), ...classification, sectionIndex: activeSectionIndex });
  }
  function forbiddenClick(node) {
    const classification = classifyClick(node);
    if (classification.allowed) return false;
    noteClick(node, classification);
    return true;
  }
  function refusal() {
    const error = new Error('refusing_forbidden_click');
    error.reason = 'refusing_forbidden_click';
    return error;
  }
  const originalClick = view.HTMLElement.prototype.click;
  view.HTMLElement.prototype.click = function guardedClick() {
    if (forbiddenClick(this)) throw refusal();
    return originalClick.call(this);
  };
  const originalDispatch = view.EventTarget.prototype.dispatchEvent;
  view.EventTarget.prototype.dispatchEvent = function guardedDispatch(event) {
    if (event?.type === 'click' && forbiddenClick(this)) throw refusal();
    return originalDispatch.call(this, event);
  };
  function clickCapture(event) {
    const classification = classifyClick(event.target);
    noteClick(event.target, classification);
    if (!classification.allowed) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
  view.addEventListener('click', clickCapture, true);

  function noteRequest(method, rawUrl, via, forceBlock = false) {
    const verb = String(method || 'GET').toUpperCase();
    const allowed = !forceBlock && isAllowedRequest(verb, rawUrl);
    if (verb !== 'GET' || forceBlock) requestRows.push({
      method: verb, url: redactUrl(rawUrl), via, allowed, blocked: !allowed, sectionIndex: activeSectionIndex
    });
    return allowed;
  }
  function blockedRequest() {
    const error = new Error('disallowed_non_get');
    error.reason = 'disallowed_non_get';
    return error;
  }
  const originalFetch = view.fetch;
  if (typeof originalFetch === 'function') view.fetch = function guardedFetch(input, init, ...rest) {
    const method = init?.method || input?.method || 'GET';
    const url = typeof input === 'string' || input instanceof view.URL ? String(input) : input?.url || '';
    if (!noteRequest(method, url, 'fetch')) return Promise.reject(blockedRequest());
    return originalFetch.call(this, input, init, ...rest);
  };
  const xhr = view.XMLHttpRequest?.prototype;
  const originalOpen = xhr?.open;
  const originalSend = xhr?.send;
  const xhrRequests = new WeakMap();
  if (originalOpen && originalSend) {
    xhr.open = function guardedOpen(method, url, ...rest) {
      xhrRequests.set(this, { method, url: String(url) });
      return originalOpen.call(this, method, url, ...rest);
    };
    xhr.send = function guardedSend(...rest) {
      const request = xhrRequests.get(this) || { method: 'GET', url: '' };
      if (!noteRequest(request.method, request.url, 'xhr')) throw blockedRequest();
      return originalSend.call(this, ...rest);
    };
  }
  const originalBeacon = view.navigator?.sendBeacon;
  if (typeof originalBeacon === 'function') view.navigator.sendBeacon = function guardedBeacon(url, ...rest) {
    if (!noteRequest('POST', String(url), 'beacon')) return false;
    return originalBeacon.call(this, url, ...rest);
  };
  function submitCapture(event) {
    noteRequest(event.target?.method || 'GET', event.target?.action || '', 'submit', true);
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  view.addEventListener('submit', submitCapture, true);
  const formPrototype = view.HTMLFormElement.prototype;
  const originalSubmit = formPrototype.submit;
  const originalRequestSubmit = formPrototype.requestSubmit;
  const blockSubmit = function blockedSubmit() {
    noteRequest(this.method || 'GET', this.action || '', 'submit', true);
    throw blockedRequest();
  };
  formPrototype.submit = blockSubmit;
  if (originalRequestSubmit) formPrototype.requestSubmit = blockSubmit;

  async function waitFor(read) {
    const deadline = Date.now() + options.waitTimeoutMs;
    do {
      if (read()) return true;
      await new Promise(resolve => view.setTimeout(resolve, options.pollMs));
    } while (Date.now() < deadline);
    return false;
  }
  async function open(sectionIndex) {
    const decision = decideOpen(snapshot(sectionIndex));
    if (decision.action === 'stop') return { ok: false, openedByUs: false, ...decision };
    activeSectionIndex = sectionIndex;
    const openedByUs = decision.action === 'click_edit';
    if (openedByUs) {
      const link = [...sections()[sectionIndex].querySelectorAll('.title_ a.h-e-btn')]
        .find(node => norm(node.textContent) === '编辑' && visible(node));
      link.click();
    }
    const ready = await waitFor(() => {
      const shot = snapshot(sectionIndex);
      return decideOpen(shot).action === 'already_open' && !!activeForm()?.querySelector('.el-form-item');
    });
    return ready
      ? { ok: true, openedByUs, alreadyOpen: !openedByUs, action: decision.action }
      : { ok: false, openedByUs, reason: state().visible ? 'editor_items_not_rendered' : 'page_hidden' };
  }
  async function cancel(sectionIndex) {
    if (forms().length === 0) {
      activeSectionIndex = null;
      return { ok: true, closed: true, reason: null, alreadyClosed: true };
    }
    if (activeSectionIndex !== sectionIndex) return { ok: false, closed: false, reason: 'editor_not_owned' };
    const form = activeForm();
    if (!form) return { ok: false, closed: false, reason: 'editor_not_unique' };
    const cancels = [...form.querySelectorAll('button')].filter(node => visible(node) && norm(node.textContent) === '取消');
    const decision = decideCancel({ cancelCount: cancels.length,
      cancelText: cancels.length === 1 ? norm(cancels[0].textContent) : '',
      cancelType: cancels.length === 1 ? cancels[0].type : '' });
    if (decision.action !== 'click_cancel') return { ok: false, closed: false, ...decision };
    cancels[0].click();
    // A hidden form still has state. Do not run another section until it is gone.
    const closed = await waitFor(() => !form.isConnected && forms().length === 0);
    if (closed) activeSectionIndex = null;
    return { ok: closed, closed, reason: closed ? null : 'editor_still_open' };
  }
  function read(sectionIndex, questions) {
    const form = activeSectionIndex === sectionIndex ? activeForm() : null;
    const wanted = Array.isArray(questions) ? questions : [];
    const unsupported = q => ({ q, value: null, reason: 'control_not_supported' });
    if (!form) return { ok: false, reason: 'editor_not_open', readback: wanted.map(unsupported), extraLabels: [], unlabeled: 0 };
    const labeled = [];
    let unlabeled = 0;
    for (const item of form.querySelectorAll('.el-form-item')) {
      if (item.closest('form') !== form) continue;
      const labels = [...item.querySelectorAll('.el-form-item__label')].filter(node => node.closest('.el-form-item') === item);
      if (labels.length !== 1) { unlabeled += 1; continue; }
      labeled.push({ item, q: norm(labels[0].textContent) });
    }
    const readback = wanted.map(q => {
      const rows = labeled.filter(row => row.q === q);
      if (rows.length !== 1) return unsupported(q);
      const item = rows[0].item;
      const contact = [...item.querySelectorAll('.e-direct-row > span')].filter(visible);
      if (item.classList.contains('custom-direct-form-item') && contact.length === 1) {
        return { q, value: norm(contact[0].textContent), reason: 'site_readonly' };
      }
      const radios = [...item.querySelectorAll('input[type="radio"]')];
      if (radios.length) {
        const checked = radios.filter(node => node.checked);
        return checked.length <= 1 ? { q, value: norm(checked[0]?.closest('label.el-radio')?.querySelector('.el-radio__label')?.textContent), reason: null } : unsupported(q);
      }
      const controls = [...item.querySelectorAll('input,textarea')].filter(node => node.closest('.el-form-item') === item
        && !node.closest('.popover.plugin-dialog-wrap') && visible(node));
      if (controls.length === 2 && controls.every(node => node.closest('.el-date-editor--month'))) {
        const [startMonth, endMonth] = controls.map(node => String(node.value ?? ''));
        return { q, value: `${startMonth} | ${endMonth}`, startMonth, endMonth, reason: null };
      }
      return controls.length === 1 ? { q, value: String(controls[0].value ?? ''), reason: null } : unsupported(q);
    });
    return { ok: true, readback, extraLabels: labeled.map(row => row.q).filter(q => q && !wanted.includes(q)), unlabeled };
  }
  let restored = false;
  function restore() {
    if (restored) return;
    restored = true;
    view.removeEventListener('click', clickCapture, true);
    view.removeEventListener('submit', submitCapture, true);
    view.HTMLElement.prototype.click = originalClick;
    view.EventTarget.prototype.dispatchEvent = originalDispatch;
    formPrototype.submit = originalSubmit;
    if (originalRequestSubmit) formPrototype.requestSubmit = originalRequestSubmit;
    if (originalFetch) view.fetch = originalFetch;
    if (originalOpen) xhr.open = originalOpen;
    if (originalSend) xhr.send = originalSend;
    if (originalBeacon) view.navigator.sendBeacon = originalBeacon;
  }
  view.__gthFullLive = { open, cancel, read, state, snapshot, clicks: () => clickRows.slice(), requests: () => requestRows.slice(), restore };
  return { ok: true };
}
