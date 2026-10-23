// Hotjob pb (Ant Design resumeOperation) Never-Save locate/fill for one field:
// 如应聘研究发展中心行业研究类岗位请勾选（建议仅勾选3~5项）
// Probe 2026-10-23 recorded valueSample as an internal code triple. Those
// codes are not display captions and are not matched here. Options were not
// opened. Option text is the caption beside each input.ant-checkbox-input,
// the same walk as 性别 / 期望工作地是否服从分配. Nothing is hardcoded.
// The label suggests 3~5 captions. A preexisting checked set that already
// matches is verified without toggling, including when its count is outside
// that suggestion. An empty control is filled only for a unique list inside
// the suggestion. A different preexisting set is left untouched.
// There is no option menu. Cancel sends Escape and leaves the checks.
// Pending live Never-Save. This does not claim the site is supported.
// liveSupportClaimed and supportClaimed stay false. leftUnsaved stays true.
// Never clicks 保存/提交/投递/删除/下一步/返回/确定.
// Does not target hotjob-mc, CMS core, uploads, or other pb blocks.
(() => {
  const QUESTION = '如应聘研究发展中心行业研究类岗位请勾选（建议仅勾选3~5项）';
  const ORDER = Object.freeze([QUESTION]);
  const KIND = 'checkbox';
  const SUGGESTED_MIN = 3;
  const SUGGESTED_MAX = 5;
  const FORBIDDEN = /^(?:保存|提交|投递|删除|下一步|返回|确定|取消)$/u;
  const PATH = /^\/SU[0-9A-Za-z]{8,64}\/pb\/resumeOperation\.html$/u;
  const DROPDOWN_CLASSES = Object.freeze([
    'ant-select-dropdown',
    'ant-select-dropdown--single',
    'ant-select-dropdown-placement-bottomLeft'
  ]);
  const STRAY = '.ant-select, select, .cascader-plugins-wrap, input.ant-radio-input, input[type="radio"], input.ant-input, input[type="text"], input[type="file"], textarea, .ant-calendar-picker-input, input[type="checkbox"]:not(.ant-checkbox-input)';

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
      leftUnsaved: true,
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

  function formItems() {
    return [...document.querySelectorAll('.ant-row.ant-form-item')];
  }

  function ownedLabels(item) {
    return [...item.querySelectorAll('label')].filter((node) => node.closest('.ant-row.ant-form-item') === item);
  }

  function captionText(node) {
    const clone = node.cloneNode(true);
    clone.querySelectorAll('input, textarea, select, button').forEach((child) => child.remove());
    return cleanLabel(clone.textContent);
  }

  function singleCheckboxLabel(node, item) {
    const boxes = [...node.querySelectorAll('input.ant-checkbox-input')]
      .filter((box) => box.closest('.ant-row.ant-form-item') === item);
    return boxes.length === 1;
  }

  function canonical(label) {
    return cleanLabel(label) === cleanLabel(QUESTION) ? QUESTION : '';
  }

  function itemsFor() {
    const want = cleanLabel(QUESTION);
    return formItems().filter((item) => {
      const labels = ownedLabels(item);
      const captions = labels.filter((node) => captionText(node) === want);
      if (captions.length < 1) return false;
      return labels.every((node) => captionText(node) === want || singleCheckboxLabel(node, item));
    });
  }

  function stray(item, selector) {
    return [...item.querySelectorAll(selector)].filter((node) => node.closest('.ant-row.ant-form-item') === item);
  }

  function checkboxOptionText(input, item) {
    let node = input.parentElement;
    while (node && node !== item) {
      const boxes = [...node.querySelectorAll('input.ant-checkbox-input')]
        .filter((box) => box.closest('.ant-row.ant-form-item') === item);
      if (boxes.length === 1 && boxes[0] === input) {
        const clone = node.cloneNode(true);
        clone.querySelectorAll('input, textarea').forEach((child) => child.remove());
        const text = exact(clone.textContent);
        if (text) return text;
      }
      node = node.parentElement;
    }
    return '';
  }

  function locateCheckbox(item) {
    if (!visible(item)) return { ok: false, reason: 'control_not_supported' };
    if (stray(item, STRAY).length) return { ok: false, reason: 'control_not_supported' };
    const boxes = stray(item, 'input.ant-checkbox-input');
    if (boxes.length < 2) return { ok: false, reason: 'control_not_supported' };
    const optionTexts = [];
    for (const box of boxes) {
      const attr = (box.getAttribute('type') || '').toLowerCase();
      if (attr !== 'checkbox' || box.disabled || box.readOnly || !visible(box)) {
        return { ok: false, reason: 'control_not_supported' };
      }
      const text = checkboxOptionText(box, item);
      if (!text) return { ok: false, reason: 'control_not_supported' };
      optionTexts.push(text);
    }
    if (new Set(optionTexts).size !== optionTexts.length) return { ok: false, reason: 'control_not_supported' };
    return { ok: true, kind: KIND, item, boxes, optionTexts };
  }

  function locate(label) {
    if (!canonical(label)) return { ok: false, reason: 'label_not_allowed' };
    const items = itemsFor();
    if (items.length > 1) return { ok: false, reason: 'ambiguous_label' };
    if (items.length !== 1) return { ok: false, reason: 'control_not_supported' };
    const found = locateCheckbox(items[0]);
    if (found.ok) found.label = QUESTION;
    return found;
  }

  function readChecked(found) {
    const checked = [];
    for (const box of found.boxes) {
      if (!box.checked) continue;
      const text = checkboxOptionText(box, found.item);
      if (!text) return { ok: false, reason: 'control_not_supported', value: [] };
      checked.push(text);
    }
    if (new Set(checked).size !== checked.length) return { ok: false, reason: 'control_not_supported', value: [] };
    return { ok: true, value: checked };
  }

  function sameSet(left, right) {
    if (left.length !== right.length) return false;
    const seen = new Set(right);
    return left.every((value) => seen.has(value));
  }

  function profileList(value) {
    if (value == null) return { ok: false, reason: 'missing_profile_value' };
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return { ok: false, reason: 'missing_profile_value' };
      if (!trimmed.startsWith('[')) return { ok: false, reason: 'profile_not_list' };
      try {
        return listFrom(JSON.parse(trimmed));
      } catch {
        return { ok: false, reason: 'profile_not_list' };
      }
    }
    if (Array.isArray(value)) return listFrom(value);
    return { ok: false, reason: 'profile_not_list' };
  }

  function listFrom(list) {
    if (!Array.isArray(list)) return { ok: false, reason: 'profile_not_list' };
    if (!list.length) return { ok: false, reason: 'missing_profile_value' };
    const captions = [];
    for (const item of list) {
      if (typeof item !== 'string') return { ok: false, reason: 'profile_not_list' };
      const text = exact(item);
      if (!text) return { ok: false, reason: 'profile_not_list' };
      captions.push(text);
    }
    if (new Set(captions).size !== captions.length) return { ok: false, reason: 'profile_not_unique' };
    return { ok: true, list: captions };
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

  function dispatchEscape(target) {
    if (!target?.dispatchEvent) return;
    const button = target.closest?.('button, a, [type="submit"]');
    if (button && FORBIDDEN.test(exact(button.textContent || ''))) return;
    const event = new KeyboardEvent('keydown', {
      key: 'Escape', code: 'Escape', bubbles: true, cancelable: true
    });
    try {
      Object.defineProperties(event, { keyCode: { get: () => 27 }, which: { get: () => 27 } });
    } catch { /* key still Escape */ }
    target.dispatchEvent(event);
  }

  async function leaveUnsaved(found) {
    const surfaces = [found?.boxes?.[0], found?.item, document.activeElement, document.body];
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

  function result(extra) {
    return {
      ...flags(),
      clickedOptions: 0,
      opened: false,
      canceled: false,
      stillOpen: 0,
      ...extra,
      liveSupportClaimed: false,
      supportClaimed: false,
      neverSave: true,
      leftUnsaved: true,
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

  async function waitFor(read) {
    for (let i = 0; i < 12; i += 1) {
      const value = read();
      if (value) return value;
      await pause(10);
    }
    return null;
  }

  function refused(label, reason, extra = {}) {
    return result({ ok: false, label, status: 'failed', reason, ...extra });
  }

  function kept(label, reason, before, want, status, ok) {
    return result({
      ok, label, status, reason,
      before, after: before, expected: want, clickedOptions: 0
    });
  }

  function seenChecked(fallback) {
    const live = locate(QUESTION);
    if (!live.ok) return { found: null, read: { ok: false, value: fallback } };
    return { found: live, read: readChecked(live) };
  }

  async function fillCheckbox(found, label, value) {
    const current = readChecked(found);
    if (!current.ok) return refused(label, current.reason, { before: [], after: [], expected: [] });
    const before = current.value;
    const parsed = profileList(value);
    if (!parsed.ok) return refused(label, parsed.reason, { before, after: before, expected: [] });
    const want = parsed.list;
    if (sameSet(before, want)) return kept(label, 'preexisting_same_value', before, want, 'verified', true);
    if (before.length) return kept(label, 'existing_value', before, want, 'skipped', false);
    if (want.length < SUGGESTED_MIN || want.length > SUGGESTED_MAX) {
      return refused(label, 'suggested_count', { before, after: before, expected: want });
    }
    if (anyOpen()) return refused(label, 'control_busy', { before, after: before, expected: want, stillOpen: 1 });
    const picked = [];
    for (const caption of want) {
      const hits = found.optionTexts.map((text, index) => (text === caption ? index : -1)).filter((index) => index >= 0);
      if (hits.length !== 1) {
        return refused(label, hits.length ? 'ambiguous_option' : 'option_not_found', {
          before, after: before, expected: want
        });
      }
      picked.push(caption);
    }
    let clicked = 0;
    try {
      for (const caption of picked) {
        const live = seenChecked(before);
        if (!live.found || !live.read.ok || !sameSet(live.read.value, want.slice(0, clicked)) || anyOpen()) {
          return refused(label, 'readback_mismatch', {
            before, after: live.read.value, expected: want, clickedOptions: clicked, stillOpen: anyOpen() ? 1 : 0
          });
        }
        const hits = live.found.optionTexts.map((text, index) => (text === caption ? index : -1)).filter((index) => index >= 0);
        const box = hits.length === 1 ? live.found.boxes[hits[0]] : null;
        if (!box || box.checked) {
          return refused(label, hits.length > 1 ? 'ambiguous_option' : 'option_not_found', {
            before, after: live.read.value, expected: want, clickedOptions: clicked
          });
        }
        safeClick(box);
        clicked += 1;
        const painted = await waitFor(() => {
          const next = seenChecked(before);
          if (!next.found || !next.read.ok || !sameSet(next.read.value, want.slice(0, clicked))) return null;
          return next.read.value;
        });
        if (!painted) {
          const next = seenChecked(before);
          return refused(label, 'readback_mismatch', {
            before, after: next.read.ok ? next.read.value : before, expected: want, clickedOptions: clicked
          });
        }
      }
    } catch (error) {
      if (error?.message === 'never_save' || error?.code === 'never_save') {
        await leaveUnsaved(found);
        const next = seenChecked(before);
        return refused(label, 'never_save', {
          before,
          after: next.read.ok ? next.read.value : before,
          expected: want,
          canceled: true,
          clickedOptions: clicked,
          stillOpen: anyOpen() ? 1 : 0
        });
      }
      throw error;
    }
    const done = seenChecked(before);
    if (!done.found || !done.read.ok || !sameSet(done.read.value, want) || anyOpen()) {
      return refused(label, 'readback_mismatch', {
        before,
        after: done.read.ok ? done.read.value : before,
        expected: want,
        clickedOptions: clicked,
        stillOpen: anyOpen() ? 1 : 0
      });
    }
    return result({
      ok: true, label, status: 'verified', reason: 'readback_matched',
      before, after: done.read.value, expected: want, clickedOptions: clicked
    });
  }

  async function fillField(label, value) {
    const name = canonical(label) || String(label ?? '');
    try {
      if (document.visibilityState === 'hidden') return refused(name, 'fill_interrupted_page_hidden');
      if (!onPage()) return refused(name, 'wrong_page');
      if (!canonical(label)) return refused(name, 'label_not_allowed');
      const found = locate(QUESTION);
      if (!found.ok) return refused(name, found.reason);
      return await fillCheckbox(found, name, value);
    } catch (error) {
      if (error?.message === 'never_save' || error?.code === 'never_save') {
        await leaveUnsaved();
        return refused(name, 'never_save', { canceled: true, stillOpen: anyOpen() ? 1 : 0 });
      }
      return refused(name, 'control_error');
    }
  }

  async function cancelField(label) {
    const name = canonical(label) || String(label ?? '');
    try {
      if (!onPage()) return refused(name, 'wrong_page');
      if (!canonical(label)) return refused(name, 'label_not_allowed');
      const found = locate(QUESTION);
      if (!found.ok) return refused(name, found.reason);
      const current = readChecked(found);
      if (!current.ok) return refused(name, current.reason);
      const before = current.value;
      const closed = await leaveUnsaved(found);
      const afterRead = readChecked(found);
      const after = afterRead.ok ? afterRead.value : before;
      const open = anyOpen();
      const same = afterRead.ok && after.length === before.length && after.every((value, index) => value === before[index]);
      const ok = closed && !open && same;
      return result({
        ok, label: name, status: ok ? 'verified' : 'failed',
        reason: !same ? 'readback_mismatch' : (ok ? 'left_unsaved' : 'menu_cleanup_failed'),
        before, after, expected: before, canceled: true, stillOpen: open ? 1 : 0
      });
    } catch (error) {
      if (error?.message === 'never_save' || error?.code === 'never_save') {
        await leaveUnsaved();
        return refused(name, 'never_save', { canceled: true, stillOpen: anyOpen() ? 1 : 0 });
      }
      return refused(name, 'control_error');
    }
  }

  function inspect() {
    if (!onPage()) return result({ ok: false, reason: 'wrong_page', fields: [] });
    const fields = ORDER.map((label) => {
      const found = locate(label);
      const read = found.ok ? readChecked(found) : { ok: false, value: [] };
      return {
        label,
        kind: KIND,
        supported: false,
        reason: found.ok && read.ok ? 'structure_matched' : (found.ok ? read.reason : found.reason),
        value: found.ok && read.ok ? read.value : []
      };
    });
    const ok = fields.every((field) => field.reason === 'structure_matched');
    return result({
      ok,
      reason: ok ? 'structure_matched' : 'control_not_supported',
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

  globalThis.ResumeHotjobPbIndustry = Object.freeze({
    fillField,
    fillFields,
    cancelField,
    inspect,
    liveSupportClaimed: false,
    supportClaimed: false,
    neverSave: true,
    leftUnsaved: true
  });
})();
