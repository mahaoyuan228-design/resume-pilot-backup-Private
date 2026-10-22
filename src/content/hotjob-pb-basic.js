// Hotjob pb (Ant Design resumeOperation) Never-Save fill for basic profile fields only.
// Probe 2026-10-23: text 姓名 / 移动电话 / 电子邮箱 (input.ant-input);
// 性别 is input.ant-radio-input (page text 男 / 女, not an ant-select; valueSample
// 0/599/604 is an internal code, not a display label);
// flat ant-select allow-clear: 国籍/地区, 民族, 婚姻状况, 政治面貌, 证件类型.
// Dropdown class and ant-select-search__field are those interactive probes.
// Open/focused/enabled matches the same page's ant-select contract in hotjob-pb-region.js.
// Live 2026-10-23: a closed .ant-select-search__field can have no client rect while
// .ant-select-selection / [role=combobox] is visible. Readback uses
// .ant-select-selection-selected-value and strips a 请选择+label placeholder
// (请选择国籍/地区中国 must read 中国). Pending live Never-Save. This does not claim the site is supported.
// liveSupportClaimed stays false. Never clicks 保存/提交/投递/删除/下一步/返回/确定.
// Does not target hotjob-mc, CMS region/education blocks, uploads, or readonly dates.
// 现居住地 / 籍贯 / 期望面试地点 stay in hotjob-pb-region.js.
(() => {
  const NAME = '姓名';
  const GENDER = '性别';
  const NATION = '国籍/地区';
  const ETHNIC = '民族';
  const MARRIAGE = '婚姻状况';
  const POLITICS = '政治面貌';
  const ID_TYPE = '证件类型';
  const PHONE = '移动电话（请填写中国大陆移动电话，以便接收短信通知）';
  const EMAIL = '电子邮箱（请尽量使用163、qq等常见邮箱，尽量不要用gmail、hotmail等境外邮箱或学校邮箱）';
  const ORDER = Object.freeze([NAME, GENDER, NATION, ETHNIC, MARRIAGE, POLITICS, ID_TYPE, PHONE, EMAIL]);
  const KINDS = Object.freeze({
    [NAME]: 'text',
    [PHONE]: 'text',
    [EMAIL]: 'text',
    [GENDER]: 'radio',
    [NATION]: 'select',
    [ETHNIC]: 'select',
    [MARRIAGE]: 'select',
    [POLITICS]: 'select',
    [ID_TYPE]: 'select'
  });
  const DROPDOWN_CLASSES = Object.freeze([
    'ant-select-dropdown',
    'ant-select-dropdown--single',
    'ant-select-dropdown-placement-bottomLeft'
  ]);
  const FORBIDDEN = /^(?:保存|提交|投递|删除|下一步|返回|确定|取消)$/u;
  const PLACEHOLDER_PREFIX = '请选择';
  const SELECTED_VALUE = '.ant-select-selection-selected-value';
  const SELECT_FACE = '.ant-select-selection, .ant-select-selector, .ant-select-selection-item, .ant-select-selection-selected-value, [role="combobox"]';
  const PATH = /^\/SU[0-9A-Za-z]{8,64}\/pb\/resumeOperation\.html$/u;

  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const exact = (value) => String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/gu, '')
    .replace(/[\s\u00a0]+/gu, '')
    .trim();
  const cleanLabel = (value) => exact(value).replace(/[＊*？?]/gu, '').replace(/[：:]+$/gu, '');

  function flags() {
    return {
      liveSupportClaimed: false,
      supportClaimed: false,
      neverSave: true,
      saved: false,
      skippedSave: true,
      complete: false,
      softwareClickedSave: false,
      softwareClickedSubmit: false,
      softwareClickedDeliver: false,
      softwareClickedDelete: false,
      softwareClickedNext: false
    };
  }

  function visible(node) {
    if (!node || node.nodeType !== 1 || !node.isConnected) return false;
    if (node.hidden || node.closest('[hidden]')) return false;
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return node.getClientRects().length > 0;
  }

  function onPage() {
    let url;
    try { url = new URL(location.href); } catch { return false; }
    if (url.protocol !== 'https:' || url.hostname !== 'wecruit.hotjob.cn') return false;
    if (!PATH.test(url.pathname)) return false;
    if (document.querySelector('.el-form, .el-form-item, .my-list-item')) return false;
    return !!document.querySelector('.resume-operation-wrap');
  }

  function ownedLabels(item) {
    return [...item.querySelectorAll('label')].filter((node) => node.closest('.ant-row.ant-form-item') === item);
  }

  function singleRadioLabel(node, item) {
    const radios = [...node.querySelectorAll('input.ant-radio-input')]
      .filter((radio) => radio.closest('.ant-row.ant-form-item') === item);
    return radios.length === 1;
  }

  function itemsFor(label) {
    const want = cleanLabel(label);
    const kind = KINDS[label];
    return [...document.querySelectorAll('.ant-row.ant-form-item')].filter((item) => {
      const labels = ownedLabels(item);
      const captions = labels.filter((node) => cleanLabel(node.textContent) === want);
      if (captions.length !== 1) return false;
      if (kind !== 'radio') return labels.length === 1;
      return labels.every((node) => node === captions[0] || singleRadioLabel(node, item));
    });
  }

  function stray(item, selector) {
    return [...item.querySelectorAll(selector)].filter((node) => node.closest('.ant-row.ant-form-item') === item);
  }

  function locateText(item) {
    if (stray(item, '.ant-select, .cascader-plugins-wrap, input.ant-radio-input, input[type="file"], textarea, .ant-calendar-picker-input').length) {
      return { ok: false, reason: 'control_not_supported' };
    }
    const inputs = stray(item, 'input.ant-input');
    if (inputs.length !== 1) return { ok: false, reason: 'control_not_supported' };
    const input = inputs[0];
    const attr = input.getAttribute('type');
    const type = String(input.type || '').toLowerCase();
    if (type !== 'text' || (attr && attr.toLowerCase() !== 'text')) return { ok: false, reason: 'control_not_supported' };
    if (input.readOnly || input.disabled || input.classList.contains('ant-calendar-picker-input')) {
      return { ok: false, reason: 'control_not_supported' };
    }
    if (!visible(input)) return { ok: false, reason: 'control_not_supported' };
    return { ok: true, kind: 'text', item, input };
  }

  function radioOptionText(input, item) {
    let node = input.parentElement;
    while (node && node !== item) {
      const radios = [...node.querySelectorAll('input.ant-radio-input')]
        .filter((radio) => radio.closest('.ant-row.ant-form-item') === item);
      if (radios.length === 1 && radios[0] === input) {
        const clone = node.cloneNode(true);
        clone.querySelectorAll('input, textarea').forEach((child) => child.remove());
        const text = exact(clone.textContent);
        if (text) return text;
      }
      node = node.parentElement;
    }
    return '';
  }

  function locateRadio(item) {
    if (stray(item, '.ant-select, .cascader-plugins-wrap, input.ant-input, input[type="file"], textarea, .ant-calendar-picker-input').length) {
      return { ok: false, reason: 'control_not_supported' };
    }
    const radios = stray(item, 'input.ant-radio-input');
    if (radios.length < 2) return { ok: false, reason: 'control_not_supported' };
    const optionTexts = [];
    for (const radio of radios) {
      const attr = (radio.getAttribute('type') || '').toLowerCase();
      if (attr !== 'radio' || radio.disabled || radio.readOnly || !visible(radio)) {
        return { ok: false, reason: 'control_not_supported' };
      }
      const text = radioOptionText(radio, item);
      if (!text) return { ok: false, reason: 'control_not_supported' };
      optionTexts.push(text);
    }
    if (new Set(optionTexts).size !== optionTexts.length) return { ok: false, reason: 'control_not_supported' };
    return { ok: true, kind: 'radio', item, radios, optionTexts };
  }

  function stripPrompt(text, label) {
    const prompt = exact(`${PLACEHOLDER_PREFIX}${label || ''}`);
    if (text === prompt || text === PLACEHOLDER_PREFIX) return '';
    if (label && text.startsWith(prompt)) return text.slice(prompt.length);
    return text;
  }

  function readSelectText(select, label) {
    const selected = [...select.querySelectorAll(SELECTED_VALUE)]
      .filter((node) => node.closest('.ant-select') === select);
    const texts = [...new Set(selected.map((node) => exact(node.textContent)).filter(Boolean))];
    if (texts.length > 1) return { ok: false, value: '' };
    if (texts.length === 1) return { ok: true, value: stripPrompt(texts[0], label) };
    const clone = select.cloneNode(true);
    clone.querySelectorAll('input, textarea, .ant-select-search__field, .ant-select-dropdown, .ant-select-selection__placeholder').forEach((node) => node.remove());
    return { ok: true, value: stripPrompt(exact(clone.textContent), label) };
  }

  function selectFace(select) {
    const faces = [...select.querySelectorAll(SELECT_FACE)]
      .filter((node) => node.closest('.ant-select') === select
        && !node.matches('input, textarea, .ant-select-search__field')
        && visible(node));
    if (!faces.length) return null;
    return faces.find((node) => faces.every((other) => other === node || node.contains(other))) || faces[0];
  }

  function locateSelect(item, label) {
    if (item.querySelector('.cascader-plugins-wrap')) return { ok: false, reason: 'control_not_supported' };
    if (stray(item, 'input.ant-radio-input, input.ant-input, input[type="file"], textarea, .ant-calendar-picker-input').length) {
      return { ok: false, reason: 'control_not_supported' };
    }
    const selects = stray(item, '.ant-select');
    if (selects.length !== 1) return { ok: false, reason: 'control_not_supported' };
    const select = selects[0];
    const triggers = [...select.querySelectorAll('.ant-select-search__field')]
      .filter((node) => node.closest('.ant-select') === select);
    const search = triggers[0];
    const trigger = search && visible(search) ? search : selectFace(select);
    if (!select.classList.contains('ant-select-enabled')
      || !select.classList.contains('ant-select-allow-clear')
      || select.classList.contains('ant-select-disabled')
      || triggers.length !== 1
      || !visible(select)
      || !trigger
      || !readSelectText(select, label).ok) {
      return { ok: false, reason: 'control_not_supported' };
    }
    return { ok: true, kind: 'select', item, select, trigger };
  }

  function locate(label) {
    if (!Object.hasOwn(KINDS, label)) return { ok: false, reason: 'label_not_allowed' };
    const items = itemsFor(label);
    if (items.length !== 1) return { ok: false, reason: 'control_not_supported' };
    const kind = KINDS[label];
    const found = kind === 'text' ? locateText(items[0]) : kind === 'radio' ? locateRadio(items[0]) : locateSelect(items[0], label);
    if (found.ok) found.label = label;
    return found;
  }

  function readText(found) {
    return exact(found.input.value);
  }

  function readRadio(found) {
    const checked = found.radios.filter((radio) => radio.checked);
    if (checked.length > 1) return { ok: false, reason: 'control_not_supported', value: '' };
    if (!checked.length) return { ok: true, value: '' };
    const value = radioOptionText(checked[0], found.item);
    if (!value) return { ok: false, reason: 'control_not_supported', value: '' };
    return { ok: true, value };
  }

  function readDisplay(found) {
    const read = readSelectText(found.select, found.label);
    return read.ok ? read.value : '';
  }

  function readFound(found) {
    if (found.kind === 'text') return { ok: true, value: readText(found) };
    if (found.kind === 'radio') return readRadio(found);
    return { ok: true, value: readDisplay(found) };
  }

  function leaves(container, excludeSelect) {
    return [...container.querySelectorAll('*')].filter((node) => {
      if (!visible(node)) return false;
      if (excludeSelect && node.closest('.ant-select')) return false;
      const text = exact(node.textContent);
      if (!text) return false;
      return ![...node.children].some((child) => visible(child) && exact(child.textContent) === text);
    });
  }

  function visibleDropdowns() {
    return [...document.querySelectorAll('.ant-select-dropdown')].filter((node) => visible(node)
      && DROPDOWN_CLASSES.every((name) => node.classList.contains(name)));
  }

  function anyOpen() {
    if ([...document.querySelectorAll('.ant-select.ant-select-open')].some(visible)) return true;
    if (visibleDropdowns().length) return true;
    return [...document.querySelectorAll('.cascader-plugins-wrap')].some((wrap) => leaves(wrap, true).length > 0);
  }

  function opened(found) {
    const select = found.select;
    if (!select.classList.contains('ant-select-open')
      || !select.classList.contains('ant-select-focused')
      || !select.classList.contains('ant-select-enabled')) return null;
    const menus = visibleDropdowns();
    if (menus.length !== 1) return null;
    const nodes = leaves(menus[0]);
    if (!nodes.length) return null;
    return nodes;
  }

  function dispatchEscape(target) {
    if (!target?.dispatchEvent) return;
    const event = new KeyboardEvent('keydown', {
      key: 'Escape', code: 'Escape', bubbles: true, cancelable: true
    });
    try {
      Object.defineProperties(event, { keyCode: { get: () => 27 }, which: { get: () => 27 } });
    } catch { /* key still Escape */ }
    target.dispatchEvent(event);
  }

  async function closeMenus(found) {
    const surfaces = [found?.trigger, found?.select, document.activeElement, document.body];
    for (const surface of surfaces) dispatchEscape(surface);
    for (let i = 0; i < 8; i += 1) {
      if (!anyOpen()) return true;
      await pause(10);
    }
    return !anyOpen();
  }

  function safeClick(node) {
    const button = node.closest?.('button, a, [type="submit"]');
    const label = exact((button || node).textContent || '');
    if (button && FORBIDDEN.test(label)) {
      const error = Error('never_save');
      error.code = 'never_save';
      throw error;
    }
    node.click();
  }

  function writeText(input, value) {
    const proto = Object.getPrototypeOf(input);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value')
      || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (!desc || typeof desc.set !== 'function') return false;
    desc.set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  }

  function result(extra) {
    return {
      ...flags(),
      saved: false,
      skippedSave: true,
      complete: false,
      liveSupportClaimed: false,
      supportClaimed: false,
      neverSave: true,
      ...extra
    };
  }

  async function waitFor(read) {
    for (let i = 0; i < 12; i += 1) {
      const value = read();
      if (value) return value;
      await pause(10);
    }
    return null;
  }

  function refused(label, reason, extra = {}) {
    return result({ ok: false, label, status: 'failed', reason, opened: false, canceled: false, ...extra });
  }

  function kept(label, reason, before, want, status, ok) {
    return result({
      ok, label, status, reason,
      before, after: before, expected: want, opened: false, canceled: false, stillOpen: 0
    });
  }

  async function fillText(found, label, want) {
    const before = readText(found);
    if (!want) return refused(label, 'missing_profile_value', { before, after: before, expected: '' });
    if (before === want) return kept(label, 'preexisting_same_value', before, want, 'verified', true);
    if (before) return kept(label, 'existing_value', before, want, 'skipped', false);
    if (anyOpen()) return refused(label, 'control_busy', { before, after: before, expected: want });
    found.input.focus();
    if (!writeText(found.input, want)) {
      return refused(label, 'control_not_supported', { before, after: readText(found), expected: want });
    }
    const painted = await waitFor(() => readText(found) === want);
    const after = readText(found);
    if (!painted || after !== want) {
      return refused(label, 'readback_mismatch', { before, after, expected: want, opened: false, canceled: false });
    }
    return result({
      ok: true, label, status: 'verified', reason: 'readback_matched',
      before, after, expected: want, opened: false, canceled: false, stillOpen: 0
    });
  }

  async function fillRadio(found, label, want) {
    const current = readRadio(found);
    if (!current.ok) return refused(label, current.reason);
    const before = current.value;
    if (!want) return refused(label, 'missing_profile_value', { before, after: before, expected: '' });
    if (before === want) return kept(label, 'preexisting_same_value', before, want, 'verified', true);
    if (before) return kept(label, 'existing_value', before, want, 'skipped', false);
    if (anyOpen()) return refused(label, 'control_busy', { before, after: before, expected: want });
    const indexes = found.optionTexts.map((text, index) => (text === want ? index : -1)).filter((index) => index >= 0);
    if (indexes.length !== 1) {
      return refused(label, indexes.length ? 'ambiguous_option' : 'option_not_found', {
        before, after: before, expected: want, opened: false, canceled: false, stillOpen: 0
      });
    }
    safeClick(found.radios[indexes[0]]);
    const painted = await waitFor(() => {
      const read = readRadio(found);
      return read.ok && read.value === want;
    });
    const afterRead = readRadio(found);
    const after = afterRead.ok ? afterRead.value : before;
    if (!painted || after !== want) {
      return refused(label, 'readback_mismatch', {
        before, after, expected: want, opened: false, canceled: false, stillOpen: anyOpen() ? 1 : 0
      });
    }
    return result({
      ok: true, label, status: 'verified', reason: 'readback_matched',
      before, after, expected: want, opened: false, canceled: false, stillOpen: 0
    });
  }

  async function fillSelect(found, label, want) {
    const before = readDisplay(found);
    if (!want) return refused(label, 'missing_profile_value', { before, after: before, expected: '' });
    if (before === want) return kept(label, 'preexisting_same_value', before, want, 'verified', true);
    if (before) return kept(label, 'existing_value', before, want, 'skipped', false);
    if (anyOpen()) return refused(label, 'control_busy', { before, after: before, expected: want });
    safeClick(found.trigger);
    const nodes = await waitFor(() => opened(found));
    if (!nodes) {
      const closed = await closeMenus(found);
      return refused(label, closed ? 'control_not_supported' : 'menu_cleanup_failed', {
        before, after: readDisplay(found), expected: want, opened: true, canceled: true,
        stillOpen: closed ? 0 : 1
      });
    }
    const matches = nodes.filter((node) => exact(node.textContent) === want);
    if (matches.length !== 1) {
      const closed = await closeMenus(found);
      const after = readDisplay(found);
      return refused(label, matches.length ? 'ambiguous_option' : 'option_not_found', {
        before, after, expected: want, opened: true, canceled: true,
        stillOpen: closed && !anyOpen() ? 0 : 1,
        reason: after !== before ? 'readback_mismatch' : (closed && !anyOpen()
          ? (matches.length ? 'ambiguous_option' : 'option_not_found')
          : 'menu_cleanup_failed')
      });
    }
    safeClick(matches[0]);
    const painted = await waitFor(() => readDisplay(found) === want && !anyOpen());
    if (!painted) {
      const closed = await closeMenus(found);
      const after = readDisplay(found);
      const open = anyOpen();
      return refused(label, after === want && !open ? 'readback_matched' : (open || !closed ? 'menu_cleanup_failed' : 'readback_mismatch'), {
        ok: after === want && !open,
        status: after === want && !open ? 'verified' : 'failed',
        before, after, expected: want, opened: true, canceled: true, stillOpen: open ? 1 : 0
      });
    }
    return result({
      ok: true, label, status: 'verified', reason: 'readback_matched',
      before, after: want, expected: want, opened: true, canceled: false, stillOpen: 0
    });
  }

  async function fillField(label, value) {
    try {
      if (document.visibilityState === 'hidden') return refused(label, 'fill_interrupted_page_hidden');
      if (!onPage()) return refused(label, 'wrong_page');
      const found = locate(label);
      if (!found.ok) return refused(label, found.reason);
      const want = typeof value === 'string' ? exact(value) : '';
      if (found.kind === 'text') return fillText(found, label, want);
      if (found.kind === 'radio') return fillRadio(found, label, want);
      return fillSelect(found, label, want);
    } catch (error) {
      if (error?.message === 'never_save') return refused(label, 'never_save');
      return refused(label, 'control_error');
    }
  }

  async function cancelField(label) {
    try {
      if (!onPage()) return refused(label, 'wrong_page');
      const found = locate(label);
      if (!found.ok) return refused(label, found.reason);
      const current = readFound(found);
      if (!current.ok) return refused(label, current.reason);
      const before = current.value;
      if (found.kind !== 'select') {
        return refused(label, 'cancel_not_applicable', { before, after: before, opened: false, canceled: false, stillOpen: 0 });
      }
      if (anyOpen()) return refused(label, 'control_busy', { before, after: before });
      safeClick(found.trigger);
      const nodes = await waitFor(() => opened(found));
      if (!nodes) {
        await closeMenus(found);
        return refused(label, 'control_not_supported', { before, after: readDisplay(found), opened: false, canceled: true });
      }
      const closed = await closeMenus(found);
      const after = readDisplay(found);
      const open = anyOpen();
      const ok = closed && !open && after === before;
      return result({
        ok, label, status: ok ? 'verified' : 'failed',
        reason: after !== before ? 'readback_mismatch' : (ok ? 'menu_closed' : 'menu_cleanup_failed'),
        before, after, expected: before, opened: true, canceled: true, stillOpen: open ? 1 : 0
      });
    } catch (error) {
      if (error?.message === 'never_save') return refused(label, 'never_save');
      return refused(label, 'control_error');
    }
  }

  function inspect() {
    if (!onPage()) return result({ ok: false, reason: 'wrong_page', fields: [] });
    const fields = ORDER.map((label) => {
      const found = locate(label);
      const read = found.ok ? readFound(found) : { ok: false, value: '' };
      return {
        label,
        kind: KINDS[label],
        supported: false,
        reason: found.ok && read.ok ? 'structure_matched' : (found.ok ? read.reason : found.reason),
        value: found.ok && read.ok ? read.value : ''
      };
    });
    return result({
      ok: fields.every((field) => field.reason === 'structure_matched'),
      reason: 'structure_matched',
      fields
    });
  }

  async function fillFields(values) {
    const fields = [];
    for (const label of ORDER) fields.push(await fillField(label, values?.[label]));
    return result({
      ok: fields.every((field) => field.ok === true && field.status === 'verified'),
      fields
    });
  }

  globalThis.ResumeHotjobPbBasic = Object.freeze({
    fillField,
    fillFields,
    cancelField,
    inspect,
    liveSupportClaimed: false,
    supportClaimed: false,
    neverSave: true
  });
})();
