// CITICS careers.citics.com — one Ant Select: 婚姻状况.
// Fill without save. Never clicks 保存 / 提交 / 暂存. Never touches 易盾.
//
// The backup tree had the design and field map only (no citics-basic.js).
// This module is the marital-status knife: findItem + select read/fill.
// It does not fill any other Ant Select, date, or text field.
//
// Selector order follows careers.citics.com chunk-vendors.a191a981.css
// (Ant Design Vue 1 / ant-design 3 class names). Ant Design 4 names are
// tried after that and only count if the live DOM actually matches.
(() => {
  const MARITAL = '婚姻状况';
  const ALTERNATES = ['未婚', '已婚', '离异', '丧偶'];
  const READBACK = [
    '.ant-select-selection-selected-value',
    '.ant-select-selection-item'
  ];
  const OPEN_TARGET = ['.ant-select-selection', '.ant-select-selector'];
  const OPTIONS = [
    '.ant-select-dropdown-menu-item[role=option]',
    '.ant-select-dropdown-menu-item',
    '.ant-select-item-option[role=option]',
    '.ant-select-item-option'
  ];

  const norm = value => String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/gu, '')
    .replace(/[\s\u00a0]+/gu, ' ')
    .trim();
  const cleanLabel = value => norm(value).replace(/^\*\s*/u, '').replace(/\s*\*$/u, '').replace(/[：:]\s*$/u, '').trim();
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const code = reason => Object.assign(new Error(reason), { code: reason });

  function visible(node) {
    if (!node || !node.isConnected) return false;
    const rects = [...node.getClientRects()];
    if (!rects.some(rect => rect.width > 0 && rect.height > 0)) return false;
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    if (Number.parseFloat(style.opacity) === 0) return false;
    return true;
  }

  function onCiticsPage() {
    try {
      const url = new URL(location.href);
      return url.protocol === 'https:' && url.hostname === 'careers.citics.com' && url.pathname === '/my/jl';
    } catch {
      return false;
    }
  }

  function pageAllowed(options) {
    if (onCiticsPage()) return true;
    if (options?.synthetic !== true) return false;
    return location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  }

  async function assertPaidGate() {
    try {
      if (typeof chrome !== 'undefined'
        && chrome.runtime?.getManifest?.()?.background?.service_worker === 'src/license/guard-worker.mjs'
        && (await chrome.runtime.sendMessage({ type: 'RESUME_PAID_VERIFY' }))?.allowed !== true) {
        return false;
      }
    } catch {
      return false;
    }
    return true;
  }

  function yidunCovering() {
    return [...document.querySelectorAll('.yidun_popup, .yidun_modal, .yidun_panel, .yidun_cover-frame')].some(node => {
      if (!visible(node)) return false;
      const rect = node.getBoundingClientRect();
      return rect.width >= 40 && rect.height >= 40;
    });
  }

  function itemLabel(item) {
    const holders = [...item.querySelectorAll(':scope > .ant-form-item-label, :scope > .ant-form-item-label-left')];
    const scoped = holders.length ? holders : [...item.querySelectorAll('.ant-form-item-label')]
      .filter(node => node.closest('.ant-form-item') === item);
    if (scoped.length !== 1) return { ok: false, reason: 'label_structure_unexpected', labelHolders: scoped.length };
    const labels = [...scoped[0].querySelectorAll('label')];
    if (labels.length !== 1) return { ok: false, reason: 'label_structure_unexpected', labels: labels.length };
    return { ok: true, text: cleanLabel(labels[0].textContent) };
  }

  function findItem(label) {
    const wanted = cleanLabel(label);
    const items = [...document.querySelectorAll('.ant-form-item')].filter(item => {
      const parsed = itemLabel(item);
      return parsed.ok && parsed.text === wanted;
    });
    if (items.length !== 1) {
      return { ok: false, reason: items.length ? 'item_not_unique' : 'item_missing', count: items.length };
    }
    return { ok: true, item: items[0], label: wanted };
  }

  function hitCount(root, selector, filter) {
    if (!root) return 0;
    return [...root.querySelectorAll(selector)].filter(node => (filter ? filter(node) : true)).length;
  }

  function readSelect(select) {
    const hits = READBACK.map(selector => ({
      role: 'readback',
      selector,
      hit: hitCount(select, selector, node => node.closest('.ant-select') === select && visible(node))
    }));
    for (const row of hits) {
      if (row.hit !== 1) continue;
      const node = [...select.querySelectorAll(row.selector)]
        .find(candidate => candidate.closest('.ant-select') === select && visible(candidate));
      return { ok: true, selector: row.selector, value: norm(node.textContent || node.getAttribute('title') || ''), hits };
    }
    if (hits.some(row => row.hit > 1)) return { ok: false, reason: 'select_readback_ambiguous', hits };
    return { ok: false, reason: 'select_readback_missing', hits };
  }

  function selectNodes(item) {
    return [...item.querySelectorAll('.ant-select')].filter(node => node.closest('.ant-form-item') === item && visible(node));
  }

  function selectControl(item) {
    if (item.querySelector('.ant-cascader, .ant-cascader-picker')) {
      return { ok: false, reason: 'select_structure_unexpected', detail: 'cascader_present' };
    }
    const selects = selectNodes(item);
    if (selects.length !== 1) {
      return { ok: false, reason: 'select_structure_unexpected', detail: 'select_count', visibleSelects: selects.length };
    }
    const select = selects[0];
    if (select.classList.contains('ant-select-disabled') || select.getAttribute('aria-disabled') === 'true') {
      return { ok: false, reason: 'select_structure_unexpected', detail: 'disabled' };
    }
    const read = readSelect(select);
    if (!read.ok) return { ...read, reason: read.reason };
    return { ok: true, select, read };
  }

  function openTarget(select) {
    const hits = OPEN_TARGET.map(selector => ({
      role: 'open',
      selector,
      hit: hitCount(select, selector, node => node.closest('.ant-select') === select && visible(node))
    }));
    for (const row of hits) {
      if (row.hit !== 1) continue;
      const node = [...select.querySelectorAll(row.selector)]
        .find(candidate => candidate.closest('.ant-select') === select && visible(candidate));
      return { ok: true, node, selector: row.selector, hits };
    }
    return { ok: false, reason: 'select_structure_unexpected', detail: 'open_target_missing', hits };
  }

  function visibleDropdowns() {
    return [...document.querySelectorAll('.ant-select-dropdown')]
      .filter(node => visible(node) && !node.classList.contains('ant-select-dropdown-hidden'));
  }

  function linkedDropdown(select, dropdowns) {
    const combo = select.querySelector('[role=combobox]') || select.querySelector('.ant-select-selection, .ant-select-selector');
    const id = combo?.getAttribute('aria-controls') || combo?.getAttribute('aria-owns') || '';
    if (id) {
      const node = document.getElementById(id);
      const owner = node?.closest?.('.ant-select-dropdown') || (node?.classList?.contains('ant-select-dropdown') ? node : null);
      if (owner && dropdowns.includes(owner)) return owner;
      return null;
    }
    return dropdowns.length === 1 ? dropdowns[0] : null;
  }

  function enabledOption(node) {
    return visible(node)
      && node.getAttribute('aria-disabled') !== 'true'
      && !node.classList.contains('ant-select-dropdown-menu-item-disabled')
      && !node.classList.contains('ant-select-item-option-disabled');
  }

  function optionHits(dropdown) {
    return OPTIONS.map(selector => ({
      role: 'option',
      selector,
      hit: hitCount(dropdown, selector, enabledOption)
    }));
  }

  function matchingOptions(dropdown, expected) {
    const hits = optionHits(dropdown);
    const wanted = norm(expected);
    for (const row of hits) {
      if (!row.hit) continue;
      const nodes = [...dropdown.querySelectorAll(row.selector)].filter(enabledOption);
      const matches = nodes.filter(node => norm(node.textContent) === wanted);
      return { hits, selector: row.selector, nodes, matches };
    }
    return { hits, selector: null, nodes: [], matches: [] };
  }

  function assertSafeTarget(node) {
    if (!(node instanceof Element)) throw code('select_click_target_missing');
    if (node.closest('button, a, [type=submit], .yidun_cover-frame, .yidun_popup, .yidun_modal, .yidun_panel, iframe')) {
      throw code('commit_or_yidun_target');
    }
    const text = norm(node.textContent);
    if (text.length <= 8 && /保存|提交|暂存/u.test(text)) throw code('commit_or_yidun_target');
  }

  function pointerClick(node) {
    assertSafeTarget(node);
    node.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    if (typeof node.focus === 'function') node.focus();
    const base = { bubbles: true, cancelable: true, view: window, button: 0 };
    node.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1 }));
    node.dispatchEvent(new MouseEvent('mouseup', { ...base, buttons: 0 }));
    node.dispatchEvent(new MouseEvent('click', { ...base, buttons: 0 }));
  }

  function classSample(root) {
    if (!root) return [];
    return [...root.querySelectorAll('*')].slice(0, 24).map(node => `${node.tagName.toLowerCase()}.${[...node.classList].join('.')}`);
  }

  function snapshotSelects() {
    return [...document.querySelectorAll('.ant-form-item')].map((item, index) => {
      const parsed = itemLabel(item);
      const selects = selectNodes(item);
      const read = selects.length === 1 ? readSelect(selects[0]) : null;
      return {
        index,
        label: parsed.ok ? parsed.text : null,
        selectCount: selects.length,
        readOk: !!read?.ok,
        value: read?.ok ? read.value : null
      };
    });
  }

  function neighborDiffs(before, after) {
    const diffs = [];
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      const left = before[index];
      const right = after[index];
      if (left?.label === MARITAL && right?.label === MARITAL) continue;
      if (!left || !right || left.label !== right.label || left.selectCount !== right.selectCount
        || left.readOk !== right.readOk || (left.readOk && right.readOk && left.value !== right.value)) {
        diffs.push({ index, before: left || null, after: right || null });
      }
    }
    return diffs;
  }

  function structureOf(item, select, extra) {
    return {
      itemClass: item ? [...item.classList] : [],
      selectClass: select ? [...select.classList] : [],
      visibleSelects: item ? selectNodes(item).length : 0,
      cascaderInItem: item ? !!item.querySelector('.ant-cascader, .ant-cascader-picker') : false,
      innerSample: classSample(select),
      ...extra
    };
  }

  function envelope(partial) {
    return {
      siteId: 'citics',
      label: MARITAL,
      ok: false,
      reason: null,
      before: null,
      after: null,
      expected: null,
      final: null,
      restored: false,
      saved: false,
      skippedSave: true,
      skippedYidun: true,
      clickedOption: false,
      liveEdge: false,
      surface: null,
      structure: null,
      selectors: [],
      neighborCount: 0,
      neighborsUnchanged: true,
      ...partial
    };
  }

  async function closeDropdown(select) {
    const target = openTarget(select);
    target.node?.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true
    }));
    await pause(40);
    if (visibleDropdowns().length) {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
    }
    const started = Date.now();
    while (visibleDropdowns().length && Date.now() - started < 600) await pause(40);
  }

  async function waitForDropdown(select) {
    const started = Date.now();
    let lastReason = 'select_dropdown_missing';
    while (Date.now() - started < 2500) {
      const dropdowns = visibleDropdowns();
      if (dropdowns.length > 1 && !linkedDropdown(select, dropdowns)) {
        lastReason = 'select_dropdown_not_unique';
      } else {
        const dropdown = linkedDropdown(select, dropdowns);
        if (dropdown) {
          await pause(40);
          const again = linkedDropdown(select, visibleDropdowns());
          if (again === dropdown) return { ok: true, dropdown, openCount: visibleDropdowns().length };
        } else if (dropdowns.length > 1) lastReason = 'select_dropdown_not_unique';
      }
      await pause(40);
    }
    return { ok: false, reason: lastReason, openCount: visibleDropdowns().length };
  }

  async function fillOnce(select, expected) {
    const beforeRead = readSelect(select);
    const selectors = [...(beforeRead.hits || [])];
    const target = openTarget(select);
    selectors.push(...(target.hits || []));
    if (!beforeRead.ok) return { ok: false, reason: beforeRead.reason, selectors, clickedOption: false };
    if (!target.ok) return { ok: false, reason: target.reason, selectors, clickedOption: false, structureDetail: target.detail || null };
    if (visibleDropdowns().length) {
      return { ok: false, reason: 'select_dropdown_busy', selectors, clickedOption: false };
    }
    pointerClick(target.node);
    const opened = await waitForDropdown(select);
    selectors.push({ role: 'dropdown', selector: '.ant-select-dropdown', hit: opened.ok ? 1 : visibleDropdowns().length });
    if (!opened.ok) {
      await closeDropdown(select);
      return { ok: false, reason: opened.reason, selectors, clickedOption: false, openCount: opened.openCount };
    }
    const found = matchingOptions(opened.dropdown, expected);
    selectors.push(...found.hits);
    const sampleOptions = [...opened.dropdown.querySelectorAll(found.selector || OPTIONS[0])]
      .filter(enabledOption)
      .map(node => norm(node.textContent))
      .filter(Boolean)
      .slice(0, 12);
    if (!found.selector) {
      await closeDropdown(select);
      return { ok: false, reason: 'select_option_selector_missing', selectors, clickedOption: false, sampleOptions };
    }
    if (found.matches.length !== 1) {
      await closeDropdown(select);
      return {
        ok: false,
        reason: found.matches.length ? 'select_option_not_unique' : 'select_option_missing',
        selectors,
        clickedOption: false,
        sampleOptions
      };
    }
    pointerClick(found.matches[0]);
    const started = Date.now();
    let after = readSelect(select);
    while (Date.now() - started < 2000) {
      after = readSelect(select);
      if (after.ok && after.value === norm(expected) && !visibleDropdowns().length) break;
      await pause(40);
    }
    if (visibleDropdowns().length) await closeDropdown(select);
    after = readSelect(select);
    const matched = after.ok && after.value === norm(expected);
    return {
      ok: matched,
      reason: matched ? 'readback_matched' : 'select_readback_mismatch',
      selectors,
      clickedOption: true,
      after: after.ok ? after.value : null,
      sampleOptions,
      optionSelector: found.selector
    };
  }

  async function fillSelect(label, expected, options = {}) {
    const liveEdge = onCiticsPage();
    const surface = liveEdge ? 'careers.citics.com' : (options.synthetic === true ? 'synthetic' : null);
    const fail = (partial) => envelope({ liveEdge, surface, expected: expected == null ? null : norm(expected), ...partial });
    if (cleanLabel(label) !== MARITAL) {
      return fail({ label: cleanLabel(label) || String(label ?? ''), reason: 'label_not_allowed' });
    }
    if (!(await assertPaidGate())) return fail({ reason: 'license_required' });
    if (!pageAllowed(options)) return fail({ reason: 'wrong_page', href: location.href });
    if (yidunCovering()) return fail({ reason: 'yidun_visible' });

    const found = findItem(MARITAL);
    if (!found.ok) {
      return fail({ reason: found.reason, structure: structureOf(null, null, { itemCount: found.count }) });
    }
    const control = selectControl(found.item);
    if (!control.ok) {
      return fail({
        reason: control.reason,
        selectors: control.hits || [],
        structure: structureOf(found.item, selectNodes(found.item)[0] || null, { detail: control.detail || null, visibleSelects: control.visibleSelects })
      });
    }
    const before = control.read.value;
    const neighborsBefore = snapshotSelects();
    let target = expected == null ? '' : norm(expected);
    if (!target && options.pickAlternate === true) {
      const targetNode = openTarget(control.select);
      if (!targetNode.ok) return fail({ before, reason: targetNode.reason, selectors: control.read.hits });
      if (visibleDropdowns().length) return fail({ before, reason: 'select_dropdown_busy' });
      pointerClick(targetNode.node);
      const opened = await waitForDropdown(control.select);
      const hits = opened.ok ? optionHits(opened.dropdown) : [];
      const selector = hits.find(row => row.hit)?.selector || null;
      const texts = selector
        ? [...opened.dropdown.querySelectorAll(selector)].filter(enabledOption).map(node => norm(node.textContent))
        : [];
      await closeDropdown(control.select);
      target = ALTERNATES.find(option => option !== before && texts.includes(option)) || '';
      if (!target) {
        return fail({
          before,
          reason: selector ? 'select_option_missing' : 'select_option_selector_missing',
          clickedOption: false,
          selectors: [...control.read.hits, ...hits],
          structure: structureOf(found.item, control.select, { sampleOptions: texts.slice(0, 12) })
        });
      }
    }
    if (!target || target.length > 32) return fail({ before, reason: 'expected_required' });

    if (target === before && options.force !== true) {
      const diffs = neighborDiffs(neighborsBefore, snapshotSelects());
      return envelope({
        ok: diffs.length === 0,
        reason: diffs.length ? 'neighbor_changed' : 'preexisting_same_value',
        before,
        after: before,
        expected: target,
        final: before,
        restored: false,
        liveEdge,
        surface,
        clickedOption: false,
        selectors: control.read.hits,
        structure: structureOf(found.item, control.select, {}),
        neighborCount: neighborsBefore.length,
        neighborsUnchanged: diffs.length === 0
      });
    }

    const written = await fillOnce(control.select, target);
    let final = written.after ?? null;
    let restored = false;
    let reason = written.reason;
    let ok = written.ok;
    if (written.ok && options.restore === true && written.after !== before) {
      const againItem = findItem(MARITAL);
      const again = againItem.ok ? selectControl(againItem.item) : { ok: false };
      const back = again.ok ? await fillOnce(again.select, before) : { ok: false, after: null, reason: 'select_restore_target_missing' };
      final = back.after ?? null;
      restored = back.ok && final === before;
      if (!restored) {
        ok = false;
        reason = 'select_restore_mismatch';
      }
    }
    const diffs = neighborDiffs(neighborsBefore, snapshotSelects());
    if (diffs.length) {
      ok = false;
      reason = 'neighbor_changed';
    }
    return envelope({
      ok,
      reason,
      before,
      after: written.after ?? null,
      expected: target,
      final,
      restored,
      clickedOption: written.clickedOption === true,
      liveEdge,
      surface,
      selectors: written.selectors || [],
      structure: structureOf(found.item, control.select, {
        sampleOptions: written.sampleOptions || [],
        optionSelector: written.optionSelector || null,
        openCount: written.openCount,
        neighborDiffs: diffs.slice(0, 8)
      }),
      neighborCount: neighborsBefore.length,
      neighborsUnchanged: diffs.length === 0
    });
  }

  async function fillBasic(values, options = {}) {
    const keys = values && typeof values === 'object' ? Object.keys(values) : [];
    if (keys.length !== 1 || cleanLabel(keys[0]) !== MARITAL) {
      return envelope({
        reason: 'only_marital_select_in_this_slice',
        liveEdge: onCiticsPage(),
        surface: onCiticsPage() ? 'careers.citics.com' : null
      });
    }
    return fillSelect(MARITAL, values[keys[0]], options);
  }

  globalThis.ResumeCiticsBasic = Object.freeze({
    MARITAL,
    findItem,
    selectControl,
    readSelect,
    fillSelect,
    fillBasic
  });
})();
