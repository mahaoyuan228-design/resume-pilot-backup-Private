// CITICS careers.citics.com first-slice basic fill (fill-without-save).
// Isolated from CMS/GTH. Never clicks 保存/提交/暂存. Never touches 易盾.
// Values come from resumeProfile (fullName/identityNumber/phone/email/gender);
// fail-closed when core facts missing or unconfirmed — no TEST placeholders.
//
// Ant Select knives (Ant Design Vue 1): 婚姻状况 + 政治面貌 + 户口类型 + 证件类型 + 民族
// (selectControl / readSelect / fillSelect). One label per call; allowlist only.
// Flat-select guard: FLAT_SELECT_MAX_OPTIONS=24 + search-input detect → select_search_heavy.
// Cascader/region/nation knives stay out of scope. Key for 民族 is ethnicity (not nation).
// Selector order follows careers.citics.com chunk-vendors.a191a981.css
// (Ant Design Vue 1 / ant-design 3 class names). Ant Design 4 names are
// tried after that and only count if the live DOM actually matches.
(() => {
  const previous = globalThis.ResumeCiticsBasic;
  if (previous?.listener) {
    try { chrome.runtime.onMessage.removeListener(previous.listener); } catch {}
  }

  const HOST = "careers.citics.com";
  const PATH = "/my/jl";
  // Labels/control kinds recorded in dist/site-probes/citics-field-map-20261018.json.
  // Pinyin components are independent confirmed facts; never transliterate a name.
  const OPTIONAL_TEXT_FIELDS = [
    { label: '姓（拼音）', key: 'lastNamePinyin' },
    { label: '名（拼音）', key: 'firstNamePinyin' },
    { label: '联系地址', key: 'address' },
    { label: '邮编', key: 'postalCode' },
    { label: '微信', key: 'wechat' },
    { label: '紧急联系人', key: 'emergencyContact' },
    { label: '紧急联系人手机', key: 'emergencyContactPhone' }
  ];
  const TEXT_LABELS = ["姓", "名", "证件号码", "手机", "电子邮箱", "确认邮箱", ...OPTIONAL_TEXT_FIELDS.map((row) => row.label)];
  const RADIO_LABEL = "性别";
  const MARITAL = '婚姻状况';
  const POLITICAL = '政治面貌';
  const HUKOU_TYPE = '户口类型';
  const ID_TYPE = '证件类型';
  const ETHNICITY = '民族';
  /** Flat Ant Select allowlist only (marital + political + hukouType + idType + ethnicity). Cascader/region/nation out of scope. */
  const SELECT_SPECS = {
    [MARITAL]: { key: 'marital', alternates: ['未婚', '已婚', '离异', '丧偶'] },
    [POLITICAL]: { key: 'political', alternates: ['群众', '共青团员', '中共党员', '中共预备党员'] },
    [HUKOU_TYPE]: { key: 'hukouType', alternates: ['家庭户口', '集体户口'] },
    [ID_TYPE]: { key: 'idType', alternates: ['身份证', '中国护照', '港澳居民来往内地通行证', '台湾居民来往大陆通行证'] },
    [ETHNICITY]: { key: 'ethnicity', alternates: ['汉族', '回族', '满族', '蒙古族', '藏族', '维吾尔族'] }
  };
  const ALLOWED_SELECT_LABELS = Object.keys(SELECT_SPECS);
  const ALTERNATES = SELECT_SPECS[MARITAL].alternates;
  const FLAT_SELECT_MAX_OPTIONS = 24;
  const SEARCH_INPUT_SEL = [
    'input.ant-select-search__field',
    '.ant-select-search__field',
    'input.ant-select-selection-search-input',
    '.ant-select-selection-search-input'
  ].join(', ');
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

  const norm = (value) => String(value ?? "")
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/gu, '')
    .replace(/[\s\u00a0]+/gu, " ")
    .trim();
  const cleanLabel = (value) => norm(value).replace(/^\*\s*/u, '').replace(/\s*\*$/u, '').replace(/[：:]\s*$/u, '').trim();
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const code = (reason) => Object.assign(new Error(reason), { code: reason });

  function visible(node) {
    if (!node || !node.isConnected) return false;
    const rects = [...node.getClientRects()];
    if (!rects.some((rect) => rect.width > 0 && rect.height > 0)) return false;
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    if (Number.parseFloat(style.opacity) === 0) return false;
    return true;
  }

  function isCiticsResumeEditPage(url = location.href) {
    try {
      const u = new URL(url);
      return u.protocol === "https:" && u.hostname === HOST && u.pathname === PATH;
    } catch {
      return false;
    }
  }

  function onCiticsPage() {
    return isCiticsResumeEditPage();
  }

  function pageAllowed(options) {
    if (onCiticsPage()) return true;
    if (options?.synthetic !== true) return false;
    return location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  }

  async function assertPaidGate() {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime?.getManifest) return true;
      let manifest;
      try { manifest = chrome.runtime.getManifest(); } catch { return true; }
      if (manifest?.background?.service_worker !== 'src/license/guard-worker.mjs') return true;
      if (typeof chrome.runtime.sendMessage !== 'function') return true;
      const verified = await Promise.race([
        chrome.runtime.sendMessage({ type: 'RESUME_PAID_VERIFY' }),
        new Promise((resolve) => setTimeout(() => resolve({ allowed: true, timedOut: true }), 800))
      ]);
      if (verified?.allowed !== true) return false;
    } catch {
      return false;
    }
    return true;
  }

  function yidunCovering() {
    return [...document.querySelectorAll('.yidun_popup, .yidun_modal, .yidun_panel, .yidun_cover-frame')].some((node) => {
      if (!visible(node)) return false;
      const rect = node.getBoundingClientRect();
      return rect.width >= 40 && rect.height >= 40;
    });
  }

  function labelText(node) {
    const clone = node.cloneNode(true);
    clone.querySelectorAll("span,i,svg,em").forEach((child) => {
      const t = norm(child.textContent);
      if (!t || t === "*" || t === "：") child.remove();
    });
    return norm(clone.textContent).replace(/[*:：]+$/u, "").trim();
  }

  function formItems() {
    return [...document.querySelectorAll(".ant-form-item")].filter((item) => {
      const label = item.querySelector("label.ant-form-item-required, label.ant-form-item-no-colon, .ant-form-item-label label");
      return !!label;
    });
  }

  /** Live text/radio finder: returns Element | null (exact one match). */
  function findItem(wanted) {
    const want = norm(wanted);
    const hits = formItems().filter((item) => {
      const label = item.querySelector(".ant-form-item-label label, label");
      return label && labelText(label) === want;
    });
    return hits.length === 1 ? hits[0] : null;
  }

  function itemLabel(item) {
    const holders = [...item.querySelectorAll(':scope > .ant-form-item-label, :scope > .ant-form-item-label-left')];
    const scoped = holders.length ? holders : [...item.querySelectorAll('.ant-form-item-label')]
      .filter((node) => node.closest('.ant-form-item') === item);
    if (scoped.length !== 1) return { ok: false, reason: 'label_structure_unexpected', labelHolders: scoped.length };
    const labels = [...scoped[0].querySelectorAll('label')];
    if (labels.length !== 1) return { ok: false, reason: 'label_structure_unexpected', labels: labels.length };
    return { ok: true, text: cleanLabel(labels[0].textContent) };
  }

  /** Structured finder used by select knife (PR shape). */
  function findSelectItem(label) {
    const wanted = cleanLabel(label);
    const items = [...document.querySelectorAll('.ant-form-item')].filter((item) => {
      const parsed = itemLabel(item);
      return parsed.ok && parsed.text === wanted;
    });
    if (items.length !== 1) {
      return { ok: false, reason: items.length ? 'item_not_unique' : 'item_missing', count: items.length };
    }
    return { ok: true, item: items[0], label: wanted };
  }

  function basicEnvelope(partial = {}) {
    return { siteId: 'citics', saved: false, skippedSave: true, skippedYidun: true,
      saveAllowed: false, liveSupportClaimed: false, writeAttempted: false, neighborsUnchanged: true, ...partial };
  }

  function basicVisible(node) {
    if (!visible(node)) return false;
    for (let current = node; current instanceof Element; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (current.hidden || current.hasAttribute('inert') || current.getAttribute('aria-hidden') === 'true'
        || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse'
        || Number.parseFloat(style.opacity) === 0) return false;
    }
    return true;
  }

  function basicWritable(node) {
    return !!node && !node.disabled && !node.readOnly && !node.matches(':disabled')
      && !node.closest('[aria-disabled="true"], [aria-readonly="true"], [inert]');
  }

  function textControl(item) {
    if (!item) return null;
    const inputs = [...item.querySelectorAll('input')].filter((node) =>
      node.closest('.ant-form-item') === item && ['text', 'tel', 'email'].includes(node.type)
      && !node.closest('.ant-select, .ant-picker, .ant-radio') && basicVisible(node));
    return inputs.length === 1 && basicWritable(inputs[0]) ? inputs[0] : null;
  }

  // Native values and checked state matter as much as neighboring Ant readback.
  // Keep element identities so replacing/removing a neighboring control also fails closed.
  function snapshotBasicNeighbors(activeItem) {
    const native = [...document.querySelectorAll('input, textarea, select')]
      .filter((node) => !activeItem.contains(node)).map((node) => ({
        node, value: node.value, checked: node.checked, selectedIndex: node.selectedIndex
      }));
    const selects = [...document.querySelectorAll('.ant-select')]
      .filter((node) => !activeItem.contains(node)).map((node) => ({
        node, value: [...node.querySelectorAll('.ant-select-selection-selected-value, .ant-select-selection-item')]
          .map((value) => norm(value.textContent || value.getAttribute('title') || '')).join('\u0000')
      }));
    return [...native, ...selects];
  }

  function basicNeighborsUnchanged(before, activeItem) {
    const after = snapshotBasicNeighbors(activeItem);
    return before.length === after.length && before.every((row, index) => {
      const next = after[index];
      return row.node === next.node && row.value === next.value && row.checked === next.checked
        && row.selectedIndex === next.selectedIndex;
    });
  }

  function basicClickSafe(node) {
    return node instanceof Element
      && !node.closest('button, a, [type="submit"], [type="button"], [role="button"], .yidun_cover-frame, .yidun_popup, .yidun_modal, .yidun_panel, iframe')
      && !/保存|提交|暂存|下一步|投递|递交|删除|save|submit|next|deliver|delete/iu.test(norm(node.textContent));
  }

  function basicRadioAvailable(row) {
    if (!row.control.isConnected || !basicWritable(row.control) || !basicVisible(row.wrap || row.control)) return false;
    // Ant hides its native radio with opacity:0; its visible wrapper is the click target.
    // A hidden/display:none native input or ancestor still must fail closed.
    for (let node = row.control; node && node !== row.wrap; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (node.hidden || node.getAttribute('aria-hidden') === 'true' || style.display === 'none'
        || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    }
    return true;
  }

  function setNativeValue(input, value) {
    const proto = Object.getPrototypeOf(input);
    const desc = Object.getOwnPropertyDescriptor(proto, "value")
      || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    if (desc?.set) desc.set.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function readText(item) {
    const control = textControl(item);
    return control ? norm(control.value) : "";
  }

  async function fillText(label, value, options = {}) {
    const expected = norm(value);
    const result = (partial) => basicEnvelope({ label, ok: false, before: '', after: '', expected, ...partial });
    if (!expected) return result({ reason: 'expected_required' });
    const item = findItem(label);
    if (!item) return result({ reason: 'item_not_found' });
    const control = textControl(item);
    if (!control) return result({ reason: 'control_not_found' });
    const before = norm(control.value);
    if (before) return result({ ok: true, reason: before === expected ? 'preexisting_same_value' : 'occupied_skip', before, after: before });
    const neighbors = snapshotBasicNeighbors(item);
    control.focus();
    const occupied = norm(control.value);
    if (!basicNeighborsUnchanged(neighbors, item)) return result({ reason: 'neighbor_changed', before, after: occupied, neighborsUnchanged: false });
    if (occupied) return result({ ok: true, reason: 'occupied_skip', before: occupied, after: occupied, neighborsUnchanged: true });
    if (textControl(item) !== control) return result({ reason: 'control_changed', before, after: occupied });
    if (!pageAllowed(options)) return result({ reason: 'wrong_page', before, after: occupied });
    if (yidunCovering()) return result({ reason: 'yidun_visible', before, after: occupied });
    setNativeValue(control, expected);
    await pause(80);
    const after = readText(item);
    const neighborsUnchanged = basicNeighborsUnchanged(neighbors, item);
    return result({ ok: after === expected && neighborsUnchanged,
      reason: !neighborsUnchanged ? 'neighbor_changed' : (after === expected ? 'matched' : 'readback_mismatch'),
      before, after, writeAttempted: true, neighborCount: neighbors.length, neighborsUnchanged });
  }

  function genderOptions(item) {
    const radios = [...item.querySelectorAll("input[type='radio']")].filter((node) => node.closest('.ant-form-item') === item);
    return radios.map((control) => {
      const wrap = control.closest("label.ant-radio-wrapper, .ant-radio-wrapper, label");
      const text = norm(wrap?.textContent || "");
      return { control, wrap, text };
    });
  }

  function readGender(item) {
    const checked = genderOptions(item).filter((row) => row.control.checked);
    return checked[0]?.text || "";
  }

  async function fillGender(value, options = {}) {
    const want = norm(value);
    const result = (partial) => basicEnvelope({ label: RADIO_LABEL, ok: false, before: '', after: '', expected: want, ...partial });
    const item = findItem(RADIO_LABEL);
    if (!item) return result({ reason: 'item_not_found' });
    const radios = genderOptions(item);
    const before = readGender(item);
    if (radios.length !== 2 || radios.filter((row) => row.text === '男').length !== 1
      || radios.filter((row) => row.text === '女').length !== 1) {
      return result({ reason: 'radio_structure_changed', before, after: before });
    }
    if (before) return result({ ok: true, reason: before === want ? 'preexisting_same_value' : 'occupied_skip', before, after: before });
    const target = radios.find((row) => row.text === want);
    if (!target) return result({ reason: 'option_not_found', before, after: before });
    if (radios.some((row) => !basicRadioAvailable(row))) {
      return result({ reason: 'radio_control_unavailable', before, after: before });
    }
    if (!basicClickSafe(target.wrap || target.control)) return result({ reason: 'commit_or_yidun_target', before, after: before });
    if (!pageAllowed(options)) return result({ reason: 'wrong_page', before, after: before });
    if (yidunCovering()) return result({ reason: 'yidun_visible', before, after: before });
    const neighbors = snapshotBasicNeighbors(item);
    if (target.wrap) target.wrap.click();
    else target.control.click();
    await pause(100);
    const after = readGender(item);
    const neighborsUnchanged = basicNeighborsUnchanged(neighbors, item);
    return result({ ok: after === want && neighborsUnchanged,
      reason: !neighborsUnchanged ? 'neighbor_changed' : (after === want ? 'matched' : 'readback_mismatch'),
      before, after, writeAttempted: true, neighborCount: neighbors.length, neighborsUnchanged });
  }

  function splitName(fullName) {
    const name = norm(fullName);
    if (!name) return { lastName: "", firstName: "" };
    if (name.length === 1) return { lastName: name, firstName: "" };
    return { lastName: name.slice(0, 1), firstName: name.slice(1) };
  }

  /**
   * Map CMS-shared resumeProfile → CITICS labels.
   * Paths: fullName→姓/名, identityNumber→证件号码, phone→手机, email→邮箱×2, gender→性别.
   * Core six text fields must be confirmed; gender optional.
   */
  function planFromProfile(profile) {
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
      return { ok: false, reason: "profile_missing", values: null, fields: [], blockers: [{ reason: "profile_missing" }] };
    }
    if (!Array.isArray(profile.confirmedFields)) {
      return {
        ok: false,
        reason: "profile_missing",
        values: null,
        fields: [],
        blockers: [{ reason: "confirmed_fields_missing" }]
      };
    }
    const confirmed = new Set(profile.confirmedFields.filter((path) => typeof path === "string"));
    const split = splitName(profile.fullName || "");
    const lastName = split.lastName;
    const firstName = split.firstName;
    const idNumber = norm(profile.identityNumber || "");
    const mobile = norm(profile.phone || "");
    const email = norm(profile.email || "");
    const genderRaw = norm(profile.gender || "");

    const core = [
      { label: "姓", path: "fullName", value: lastName },
      { label: "名", path: "fullName", value: firstName },
      { label: "证件号码", path: "identityNumber", value: idNumber },
      { label: "手机", path: "phone", value: mobile },
      { label: "电子邮箱", path: "email", value: email },
      { label: "确认邮箱", path: "email", value: email }
    ].map((row) => {
      let reason = null;
      if (!row.value) reason = "missing_profile_value";
      else if (!confirmed.has(row.path)) reason = "profile_fact_unconfirmed";
      return { ...row, ready: reason === null, reason };
    });

    const fields = [...core];
    if (genderRaw) {
      let reason = null;
      if (!confirmed.has("gender")) reason = "profile_fact_unconfirmed";
      else if (genderRaw !== "男" && genderRaw !== "女") reason = "invalid_profile_value";
      fields.push({ label: RADIO_LABEL, path: "gender", value: genderRaw, ready: reason === null, reason });
    }
    for (const spec of OPTIONAL_TEXT_FIELDS) {
      const direct = norm(profile[spec.key] || '');
      const answer = norm(profile.customAnswers?.[spec.label] || '');
      if (!direct && !answer) continue;
      const answerPath = `customAnswers.${spec.label}`;
      const directReady = !!direct && confirmed.has(spec.key);
      const answerReady = !!answer && confirmed.has(answerPath);
      const path = directReady || (!answerReady && direct) ? spec.key : answerPath;
      const value = path === spec.key ? direct : answer;
      const peers = Array.isArray(profile.customFacts)
        ? profile.customFacts.filter((row) => cleanLabel(row?.question) === cleanLabel(spec.label)) : [];
      let reason = null;
      if (directReady && answerReady && direct !== answer) reason = 'profile_value_ambiguous';
      else if (path === answerPath && peers.length > 1) reason = 'profile_value_ambiguous';
      else if (!confirmed.has(path)) reason = 'profile_fact_unconfirmed';
      fields.push({ label: spec.label, key: spec.key, path, value, ready: reason === null, reason });
    }

    const blockers = fields.filter((row) => !row.ready);
    if (core.some((row) => !row.ready)) {
      return { ok: false, reason: "profile_fields_unavailable", values: null, fields, blockers };
    }

    return {
      ok: true,
      reason: "profile_ready",
      values: {
        lastName,
        firstName,
        idNumber,
        mobile,
        email,
        confirmEmail: email,
        gender: fields.find((row) => row.label === RADIO_LABEL && row.ready)?.value || "",
        ...Object.fromEntries(fields.filter((row) => row.key && row.ready).map((row) => [row.key, row.value]))
      },
      fields,
      blockers: fields.filter((row) => !row.ready)
    };
  }

  /** Back-compat helper: resolved values only when plan is ready. */
  function valuesFromProfile(profile = {}) {
    const plan = planFromProfile(profile);
    return plan.values || { lastName: "", firstName: "", idNumber: "", mobile: "", email: "", confirmEmail: "", gender: "" };
  }

  function hitCount(root, selector, filter) {
    if (!root) return 0;
    return [...root.querySelectorAll(selector)].filter((node) => (filter ? filter(node) : true)).length;
  }

  function readSelect(select) {
    const hits = READBACK.map((selector) => ({
      role: 'readback',
      selector,
      hit: hitCount(select, selector, (node) => node.closest('.ant-select') === select && visible(node))
    }));
    for (const row of hits) {
      if (row.hit !== 1) continue;
      const node = [...select.querySelectorAll(row.selector)]
        .find((candidate) => candidate.closest('.ant-select') === select && visible(candidate));
      return { ok: true, selector: row.selector, value: norm(node.textContent || node.getAttribute('title') || ''), hits };
    }
    if (hits.some((row) => row.hit > 1)) return { ok: false, reason: 'select_readback_ambiguous', hits };
    return { ok: false, reason: 'select_readback_missing', hits };
  }

  function selectNodes(item) {
    return [...item.querySelectorAll('.ant-select')].filter((node) => node.closest('.ant-form-item') === item && visible(node));
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
    const hits = OPEN_TARGET.map((selector) => ({
      role: 'open',
      selector,
      hit: hitCount(select, selector, (node) => node.closest('.ant-select') === select && visible(node))
    }));
    for (const row of hits) {
      if (row.hit !== 1) continue;
      const node = [...select.querySelectorAll(row.selector)]
        .find((candidate) => candidate.closest('.ant-select') === select && visible(candidate));
      return { ok: true, node, selector: row.selector, hits };
    }
    return { ok: false, reason: 'select_structure_unexpected', detail: 'open_target_missing', hits };
  }

  function visibleDropdowns() {
    return [...document.querySelectorAll('.ant-select-dropdown')]
      .filter((node) => visible(node) && !node.classList.contains('ant-select-dropdown-hidden'));
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
    return OPTIONS.map((selector) => ({
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
      const matches = nodes.filter((node) => norm(node.textContent) === wanted);
      return { hits, selector: row.selector, nodes, matches };
    }
    return { hits, selector: null, nodes: [], matches: [] };
  }

  /** True when open Ant Select has a search input or too many options (search-heavy / long list). Never invent options. */
  function dropdownSearchHeavy(select, dropdown) {
    if (!dropdown) return { heavy: false, optionCount: 0, hasSearch: false };
    const hasSearch = !!(dropdown.querySelector(SEARCH_INPUT_SEL) || (select && select.querySelector(SEARCH_INPUT_SEL)));
    let optionCount = 0;
    for (const selector of OPTIONS) {
      const n = [...dropdown.querySelectorAll(selector)].filter(enabledOption).length;
      if (n) { optionCount = n; break; }
    }
    const heavy = hasSearch || optionCount > FLAT_SELECT_MAX_OPTIONS;
    return { heavy, optionCount, hasSearch };
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
    return [...root.querySelectorAll('*')].slice(0, 24).map((node) => `${node.tagName.toLowerCase()}.${[...node.classList].join('.')}`);
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

  function neighborDiffs(before, after, activeLabel) {
    const skip = cleanLabel(activeLabel);
    const diffs = [];
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      const left = before[index];
      const right = after[index];
      if (skip && left?.label === skip && right?.label === skip) continue;
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
      label: partial?.label || MARITAL,
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
      await closeDropdown(select);
      if (visibleDropdowns().length) {
        return { ok: false, reason: 'select_dropdown_busy', selectors, clickedOption: false };
      }
    }
    pointerClick(target.node);
    const opened = await waitForDropdown(select);
    selectors.push({ role: 'dropdown', selector: '.ant-select-dropdown', hit: opened.ok ? 1 : visibleDropdowns().length });
    if (!opened.ok) {
      await closeDropdown(select);
      return { ok: false, reason: opened.reason, selectors, clickedOption: false, openCount: opened.openCount };
    }
    const heavy = dropdownSearchHeavy(select, opened.dropdown);
    if (heavy.heavy) {
      const sampleOptions = [...opened.dropdown.querySelectorAll(OPTIONS[0])]
        .filter(enabledOption)
        .map((node) => norm(node.textContent))
        .filter(Boolean)
        .slice(0, 12);
      await closeDropdown(select);
      return {
        ok: false,
        reason: 'select_search_heavy',
        selectors,
        clickedOption: false,
        sampleOptions,
        optionCount: heavy.optionCount,
        hasSearch: heavy.hasSearch,
        openCount: opened.openCount
      };
    }
    const found = matchingOptions(opened.dropdown, expected);
    selectors.push(...found.hits);
    const sampleOptions = [...opened.dropdown.querySelectorAll(found.selector || OPTIONS[0])]
      .filter(enabledOption)
      .map((node) => norm(node.textContent))
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
    const activeLabel = cleanLabel(label);
    const spec = SELECT_SPECS[activeLabel];
    const fail = (partial) => envelope({
      label: activeLabel || String(label ?? ''),
      liveEdge,
      surface,
      expected: expected == null ? null : norm(expected),
      ...partial
    });
    if (!spec) {
      return fail({ reason: 'label_not_allowed' });
    }
    if (!(await assertPaidGate())) return fail({ reason: 'license_required' });
    if (!pageAllowed(options)) return fail({ reason: 'wrong_page', href: location.href });
    if (yidunCovering()) return fail({ reason: 'yidun_visible' });

    const found = findSelectItem(activeLabel);
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
      if (visibleDropdowns().length) {
        await closeDropdown(control.select);
        if (visibleDropdowns().length) return fail({ before, reason: 'select_dropdown_busy' });
      }
      pointerClick(targetNode.node);
      const opened = await waitForDropdown(control.select);
      if (opened.ok) {
        const heavyPick = dropdownSearchHeavy(control.select, opened.dropdown);
        if (heavyPick.heavy) {
          const sampleOptions = [...opened.dropdown.querySelectorAll(OPTIONS[0])]
            .filter(enabledOption)
            .map((node) => norm(node.textContent))
            .filter(Boolean)
            .slice(0, 12);
          await closeDropdown(control.select);
          return fail({
            before,
            reason: 'select_search_heavy',
            clickedOption: false,
            selectors: control.read.hits,
            structure: structureOf(found.item, control.select, {
              sampleOptions,
              optionCount: heavyPick.optionCount,
              hasSearch: heavyPick.hasSearch
            })
          });
        }
      }
      const hits = opened.ok ? optionHits(opened.dropdown) : [];
      const selector = hits.find((row) => row.hit)?.selector || null;
      const texts = selector
        ? [...opened.dropdown.querySelectorAll(selector)].filter(enabledOption).map((node) => norm(node.textContent))
        : [];
      await closeDropdown(control.select);
      target = (spec.alternates || []).find((option) => option !== before && texts.includes(option)) || '';
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
      const diffs = neighborDiffs(neighborsBefore, snapshotSelects(), activeLabel);
      return envelope({
        label: activeLabel,
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
      const againItem = findSelectItem(activeLabel);
      const again = againItem.ok ? selectControl(againItem.item) : { ok: false };
      const back = again.ok ? await fillOnce(again.select, before) : { ok: false, after: null, reason: 'select_restore_target_missing' };
      final = back.after ?? null;
      restored = back.ok && final === before;
      if (!restored) {
        ok = false;
        reason = 'select_restore_mismatch';
      }
    }
    const diffs = neighborDiffs(neighborsBefore, snapshotSelects(), activeLabel);
    if (diffs.length) {
      ok = false;
      reason = 'neighbor_changed';
    }
    return envelope({
      label: activeLabel,
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

  /** PR-compat: marital-only object → fillSelect; else refuse with only_marital_select_in_this_slice. */
  async function fillMaritalOnly(values, options = {}) {
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

  async function fillBasic(rawValues = {}, options = {}) {
    // Select-only shapes: { '婚姻状况'|'政治面貌'|'户口类型'|'证件类型'|'民族': '…' } — route without touching text/radio path.
    if (rawValues && typeof rawValues === 'object' && !Array.isArray(rawValues)
      && !rawValues.profile && rawValues.allowExplicitValues !== true
      && !rawValues.lastName && !rawValues.firstName && !rawValues.idNumber && !rawValues.mobile && !rawValues.email) {
      const keys = Object.keys(rawValues).filter((k) => k !== 'allowExplicitValues' && k !== 'profile');
      if (keys.length === 1 && SELECT_SPECS[cleanLabel(keys[0])]) {
        return fillSelect(cleanLabel(keys[0]), rawValues[keys[0]], options);
      }
      if (keys.length >= 1 && keys.every((k) => SELECT_SPECS[cleanLabel(k)] || !['lastName', 'firstName', 'idNumber', 'mobile', 'email', 'confirmEmail', 'gender', 'marital', 'political', 'hukouType', 'idType', 'ethnicity'].includes(k))) {
        // Non-basic keys that are not an allowed select → PR refusal string (marital-compat).
        if (keys.length === 1 && !SELECT_SPECS[cleanLabel(keys[0])]) {
          return fillMaritalOnly(rawValues, options);
        }
      }
    }

    if (!pageAllowed(options)) return basicEnvelope({ ok: false, reason: 'wrong_page', href: location.href, results: [] });
    if (!(await assertPaidGate())) return basicEnvelope({ ok: false, reason: 'license_required', results: [] });
    if (yidunCovering()) return basicEnvelope({ ok: false, reason: 'yidun_visible', results: [] });

    const profile = rawValues.profile;
    const allowExplicit = rawValues.allowExplicitValues === true;
    let values = null;
    let plan = null;

    if (allowExplicit && (rawValues.lastName || rawValues.firstName || rawValues.idNumber || rawValues.mobile || rawValues.email)) {
      // Explicit CDP/dev override only when flagged — never default path.
      values = {
        lastName: norm(rawValues.lastName || ""),
        firstName: norm(rawValues.firstName || ""),
        idNumber: norm(rawValues.idNumber || ""),
        mobile: norm(rawValues.mobile || ""),
        email: norm(rawValues.email || ""),
        confirmEmail: norm(rawValues.confirmEmail || rawValues.email || ""),
        gender: norm(rawValues.gender || ""),
        marital: norm(rawValues.marital || rawValues[MARITAL] || "")
      };
      if (!values.lastName || !values.firstName || !values.idNumber || !values.mobile || !values.email) {
        return basicEnvelope({
          ok: false,
          siteId: "citics",
          reason: "explicit_values_incomplete",
          href: location.href,
          results: [],
          saved: false,
          skippedSave: true,
          skippedYidun: true
        });
      }
    } else {
      plan = planFromProfile(profile);
      if (!plan.ok) {
        return basicEnvelope({
          ok: false,
          siteId: "citics",
          reason: plan.reason,
          href: location.href,
          title: document.title,
          results: (plan.fields || []).map((row) => basicEnvelope({
            label: row.label,
            ok: false,
            reason: row.reason || plan.reason,
            before: "",
            after: "",
            expected: row.value || "",
            path: row.path
          })),
          blockers: plan.blockers,
          saved: false,
          skippedSave: true,
          skippedYidun: true,
          writeAttempted: false
        });
      }
      values = { ...plan.values, marital: norm(rawValues.marital || rawValues[MARITAL] || "") };
    }

    const textPlan = [
      ["姓", values.lastName],
      ["名", values.firstName],
      ["证件号码", values.idNumber],
      ["手机", values.mobile],
      ["电子邮箱", values.email],
      ["确认邮箱", values.confirmEmail || values.email],
      ...OPTIONAL_TEXT_FIELDS.filter((row) => norm(values[row.key])).map((row) => [row.label, values[row.key]])
    ];
    const results = [];
    for (const [label, value] of textPlan) {
      if (!pageAllowed(options) || yidunCovering()) {
        results.push(basicEnvelope({ label, ok: false, reason: !pageAllowed(options) ? 'wrong_page' : 'yidun_visible' }));
        break;
      }
      const result = await fillText(label, value, options);
      results.push(result);
      if (result.reason === 'neighbor_changed') break;
    }
    const safeToContinue = results.every((row) => !['neighbor_changed', 'wrong_page', 'yidun_visible'].includes(row.reason));
    if (safeToContinue && norm(values.gender) && (values.gender === "男" || values.gender === "女")) {
      results.push(await fillGender(values.gender, options));
    }
    if (safeToContinue && results.every((row) => row.reason !== 'neighbor_changed') && norm(values.marital)) {
      const selectResult = await fillSelect(MARITAL, values.marital, options);
      results.push({
        label: MARITAL,
        ok: selectResult.ok === true,
        reason: selectResult.reason,
        before: selectResult.before || "",
        after: selectResult.after || "",
        expected: selectResult.expected || norm(values.marital),
        select: selectResult
      });
    }
    const ok = results.every((row) => row.ok);
    return basicEnvelope({
      ok,
      siteId: "citics",
      href: location.href,
      title: document.title,
      saved: false,
      skippedSave: true,
      skippedYidun: true,
      writeAttempted: results.some((row) => row.writeAttempted === true || row.select?.clickedOption === true),
      profileSource: allowExplicit ? "explicit" : "resumeProfile",
      planSummary: plan
        ? { reason: plan.reason, readyCount: plan.fields.filter((f) => f.ready).length, blockerCount: plan.blockers.length }
        : { reason: "explicit_override" },
      blockers: plan?.blockers || [],
      results
    });
  }

  async function probeLabels() {
    const selectProbe = {};
    for (const label of ALLOWED_SELECT_LABELS) {
      const item = findSelectItem(label);
      const control = item.ok ? selectControl(item.item) : null;
      selectProbe[label] = { item, control };
    }
    return basicEnvelope({
      ok: isCiticsResumeEditPage(),
      href: location.href,
      title: document.title,
      labels: TEXT_LABELS.concat([RADIO_LABEL, ...ALLOWED_SELECT_LABELS]).map((label) => {
        const isSelect = !!SELECT_SPECS[label];
        const probe = selectProbe[label];
        return {
          label,
          found: isSelect ? !!probe?.item?.ok : !!findItem(label),
          hasTextControl: label !== RADIO_LABEL && !isSelect && !!findItem(label) && !!textControl(findItem(label)),
          genderOptions: label === RADIO_LABEL && findItem(label) ? genderOptions(findItem(label)).map((r) => r.text) : undefined,
          hasSelect: isSelect ? !!probe?.control?.ok : undefined,
          selectValue: isSelect && probe?.control?.ok ? probe.control.read.value : undefined
        };
      })
    });
  }

  const api = {
    siteId: "citics",
    liveSupportClaimed: false,
    MARITAL,
    POLITICAL,
    HUKOU_TYPE,
    ID_TYPE,
    ETHNICITY,
    ALLOWED_SELECT_LABELS,
    SELECT_SPECS,
    FLAT_SELECT_MAX_OPTIONS,
    isCiticsResumeEditPage,
    fillBasic,
    fillMaritalOnly,
    fillSelect,
    selectControl,
    readSelect,
    findItem,
    findSelectItem,
    probeLabels,
    valuesFromProfile,
    planFromProfile,
    listener: null
  };

  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    api.listener = (message, _sender, sendResponse) => {
      if (!message || (message.siteId && message.siteId !== "citics")) return false;
      if (message.type === "CITICS_BASIC_PROBE") {
        probeLabels().then(sendResponse);
        return true;
      }
      if (message.type === "CITICS_BASIC_FILL") {
        fillBasic(message.values || { profile: message.profile }).then(sendResponse);
        return true;
      }
      if (message.type === "CITICS_SELECT_FILL") {
        fillSelect(message.label || MARITAL, message.expected, message.options || {}).then(sendResponse);
        return true;
      }
      return false;
    };
    chrome.runtime.onMessage.addListener(api.listener);
  }

  globalThis.ResumeCiticsBasic = api;
})();
