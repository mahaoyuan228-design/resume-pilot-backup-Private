(function () {
  "use strict";
  async function checkProfileWrite(){const context=globalThis.ResumeProfileWriteContext;if(context)await context.check();}


  // Standalone Ant v3 school search. The caller supplies both the mapped
  // school control and the site's exact option text; this module never infers
  // a school from the applicant's free-text answer.
  const ORIGIN = "https://wecruit.hotjob.cn";
  const PATH = /^\/SU[^/]+\/pb\/resumeOperation\.html$/;
  const BASIC_PAGE = "https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html";
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const normalizedQuestion = (value) => String(value || "").normalize("NFKC")
    .replace(/[＊*：:！!？?，,。\s]/g, "");
  const normalizedOption = (value) => String(value || "").normalize("NFKC")
    .replace(/\s+/g, "").trim();
  const visible = (node) => !!node && node.isConnected
    && !node.closest('[hidden],[aria-hidden="true"]')
    && node.getClientRects().length > 0
    && getComputedStyle(node).display !== "none"
    && getComputedStyle(node).visibility !== "hidden";
  const openMenus = () => [...document.querySelectorAll(".ant-select-dropdown")]
    .filter((node) => visible(node) && !node.classList.contains("ant-select-dropdown-hidden"));
  const openSelects = () => [...document.querySelectorAll(".ant-select.ant-select-open")].filter(visible);
  const otherOverlays = () => [...document.querySelectorAll(
    ".ant-calendar-picker-container,.ant-cascader-menus,.ant-modal,.ant-popover"
  )].filter(visible);
  const selectedText = (selection) => String(selection?.querySelector(
    ".ant-select-selection-selected-value,.ant-select-selection-item"
  )?.textContent || "").trim();

  function schoolDisplayMatches(existing, desiredText) {
    const e = normalizedOption(existing);
    const d = normalizedOption(desiredText);
    if (!e || !d) return false;
    if (e === d) return true;
    const shorter = e.length <= d.length ? e : d;
    const longer = e.length <= d.length ? d : e;
    if (shorter.length < 4) return false;
    return longer.includes(shorter);
  }

  function target(selection) {
    if (!(selection instanceof HTMLElement)
      || !selection.matches(".ant-select-selection--single") || !visible(selection)) return null;
    const form = selection.closest("form");
    const row = selection.closest(".form-cell-inner");
    const section = selection.closest(".form-cell");
    const title = section?.querySelector(":scope > .tit-wrap .tit");
    const sectionName = normalizedQuestion(title?.textContent);
    const question = sectionName === "教育经历必填" ? "学校"
      : sectionName === "个人基本信息必填" && location.origin + location.pathname === BASIC_PAGE ? "毕业院校" : null;
    if (!form || !row || !section || !visible(section) || !question) return null;
    const sections = [...form.querySelectorAll(".form-cell")]
      .filter((node) => visible(node)
        && normalizedQuestion(node.querySelector(":scope > .tit-wrap .tit")?.textContent)
          === sectionName);
    if (sections.length !== 1 || sections[0] !== section) return null;
    const rows = [...section.querySelectorAll(":scope > .form-cell-right > .form-cell-inner")];
    const rowIndex = rows.indexOf(row);
    if (rows.length !== 1 || rowIndex !== 0) return null;
    const items = [...row.querySelectorAll(".ant-form-item")].filter((item) => {
      if (!visible(item) || item.closest(".form-cell-inner") !== row) return false;
      const labels = [...item.querySelectorAll(".ant-form-item-label > label")]
        .filter((label) => label.closest(".ant-form-item") === item);
      return labels.length === 1 && normalizedQuestion(labels[0].textContent) === question;
    });
    if (items.length !== 1 || !items[0].contains(selection)) return null;
    const controls = [...items[0].querySelectorAll(".ant-select-selection--single")].filter(visible);
    const select = selection.closest(".ant-select");
    const searches = [...(select?.querySelectorAll("input") || [])]
      .filter((input) => input.type === "text");
    if (controls.length !== 1 || controls[0] !== selection
      || items[0].querySelectorAll(".ant-select").length !== 1
      || !select || select.classList.contains("ant-select-disabled")
      || searches.length !== 1 || searches[0].disabled || searches[0].readOnly) return null;
    return { form, section, sectionName, question, rowIndex, rowCount: rows.length, selection, search: searches[0] };
  }

  function locate(baseline) {
    if (location.href !== baseline.href || performance.timeOrigin !== baseline.timeOrigin
      || !baseline.form.isConnected) return null;
    const section = [...baseline.form.querySelectorAll(".form-cell")]
      .filter((node) => visible(node)
        && normalizedQuestion(node.querySelector(":scope > .tit-wrap .tit")?.textContent)
          === baseline.sectionName);
    if (section.length !== 1) return null;
    const rows = [...section[0].querySelectorAll(":scope > .form-cell-right > .form-cell-inner")];
    if (rows.length !== baseline.rowCount) return null;
    const row = rows[baseline.rowIndex];
    const selections = [...(row?.querySelectorAll(".ant-select-selection--single") || [])]
      .filter((selection) => {
        const current = target(selection);
        return current?.rowIndex === baseline.rowIndex && current.sectionName === baseline.sectionName
          && current.question === baseline.question;
      });
    return selections.length === 1 ? target(selections[0]) : null;
  }

  function requireVisiblePage() {
    if (document.visibilityState !== "visible")
      throw new Error("fill_interrupted_page_hidden");
  }

  function uniqueOpenMenu(baseline) {
    const current = locate(baseline);
    const menus = openMenus();
    const opened = openSelects();
    if (!current || menus.length !== 1 || opened.length !== 1
      || opened[0] !== current.selection.closest(".ant-select")) return null;
    const linkedId = current.selection.getAttribute("aria-controls");
    const linked = linkedId && document.getElementById(linkedId);
    if (!linkedId || !linked || !menus[0].contains(linked) || otherOverlays().length) return null;
    return { ...current, menu: menus[0] };
  }

  function escape(input) {
    const event = new KeyboardEvent("keydown", {
      key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true, cancelable: true
    });
    input.dispatchEvent(event);
  }

  function cleanupState(baseline) {
    const current = locate(baseline), menus = openMenus(), opened = openSelects();
    if (!current || otherOverlays().length) return null;
    if (!menus.length && !opened.length) return { current, closed: true };
    if (menus.length !== 1 || opened.length > 1
      || opened.length === 1 && opened[0] !== current.selection.closest('.ant-select')) return null;
    const id = current.selection.getAttribute('aria-controls'), linked = id && document.getElementById(id);
    if (!id || !linked || !menus[0].contains(linked)) return null;
    return { current, closed: false, opened: opened.length === 1, menu: menus[0] };
  }

  async function closeOwnMenu(baseline) {
    requireVisiblePage();
    const initial = cleanupState(baseline);
    if (!initial) return false;
    if (initial.closed) return true;
    const selected = selectedText(initial.current.selection), search = initial.current.search.value;
    // Search changes can reopen rc-select. Close only the proven owner, without
    // clearing its query, dispatching input/change, or clicking the page body.
    if (initial.opened) {
      await checkProfileWrite(); requireVisiblePage();
      const live = cleanupState(baseline);
      if (!live || live.closed || !live.opened || live.menu !== initial.menu
        || live.current.selection !== initial.current.selection || live.current.search !== initial.current.search
        || selectedText(live.current.selection) !== selected || live.current.search.value !== search) return false;
      escape(live.current.search);
      live.current.search.blur();
      live.current.selection.blur();
    }
    for (let i = 0; i < 30; i += 1) {
      requireVisiblePage();
      const live = cleanupState(baseline);
      if (!live || selectedText(live.current.selection) !== selected) return false;
      if (live.closed) return live.current.search.value === '' || live.current.search.value === search;
      await pause(40);
    }
    return false;
  }

  function candidateState(menu, exactText, desiredText, searchText) {
    const options = [...menu.querySelectorAll(".ant-select-dropdown-menu-item")].filter(visible);
    const signature = JSON.stringify(options.map((item) => [
      normalizedOption(item.textContent), item.className, item.getAttribute("aria-disabled")
    ]));
    const busy = !!menu.querySelector('.ant-spin-spinning,[aria-busy="true"],.ant-select-dropdown-loading')
      || /加载中|搜索中|loading/i.test(menu.textContent || "");
    const enabled = options.filter((item) => item.getAttribute("aria-disabled") !== "true"
      && !item.classList.contains("ant-select-dropdown-menu-item-disabled"));
    const exact=enabled.filter((item)=>normalizedOption(item.textContent)===exactText);
    // The CMS exposes a literal creatable-school option instead of a catalog
    // hit. Accept only its observed templates for the identical search/fact,
    // as the sole visible enabled LI. The selected value must still read back
    // as the school itself; this label is never stored as the applicant fact.
    const createLabels = new Set([
      `使用“${desiredText}”作为我的学校`,
      `使用"${desiredText}"作为我的学校`,
      `使用「${desiredText}」作为我的学校`
    ]);
    const create=exact.length===0&&options.length===1&&enabled.length===1
      &&desiredText===searchText&&enabled[0].tagName==='LI'&&enabled[0].getAttribute('role')==='option'
      &&createLabels.has(String(enabled[0].textContent||'').trim())
      ?enabled:[];
    const createTemplatePresent = options.some((item) => {
      const label = String(item.textContent || '').trim();
      return createLabels.has(label) || /作为我的学校$/u.test(label);
    });
    return { signature,busy,exact:create.length?create:exact,
      candidateKind:create.length?'explicit_create_school':'exact_catalog_option',
      visibleOptionCount: options.length, createTemplatePresent,
      sampleOptions: options.slice(0, 5).map((item) => String(item.textContent || '').trim().slice(0, 80)) };
  }

  async function fillSchool(selection, desiredOptionText, searchText = desiredOptionText) {
    if (location.origin !== ORIGIN || !PATH.test(location.pathname))
      return { status: "skipped", reason: "wrong_site" };
    if (typeof desiredOptionText !== "string" || !normalizedOption(desiredOptionText)
      || desiredOptionText.length > 160 || typeof searchText !== "string"
      || !searchText.trim() || searchText.length > 160)
      return { status: "skipped", reason: "explicit_option_required" };
    const initial = target(selection);
    if (!initial) return { status: "skipped", reason: "control_guard" };
    const baseline = { ...initial, href: location.href, timeOrigin: performance.timeOrigin };
    const desired = normalizedOption(desiredOptionText);
    const existing = selectedText(initial.selection);
    if (existing) return schoolDisplayMatches(existing, desiredOptionText)
      ? { status: "verified", reason: "preexisting_same_value", existingDisplay: existing }
      : { status: "skipped", reason: "existing_value" };
    if (initial.search.value !== "" || visible(initial.search)
      || openMenus().length || openSelects().length || otherOverlays().length)
      return { status: "skipped", reason: "control_busy" };
    let openedByThisCall = false;
    let selectedByThisCall = false;
    let decision = { status: "failed", reason: "control_error" };
    try {
      requireVisiblePage();
      await checkProfileWrite(); requireVisiblePage();
      const beforeOpen = locate(baseline);
      if (!beforeOpen) return { status: "failed", reason: "field_changed" };
      const nowSelected = selectedText(beforeOpen.selection);
      if (nowSelected) return schoolDisplayMatches(nowSelected, desiredOptionText)
        ? { status: "verified", reason: "preexisting_same_value", existingDisplay: nowSelected }
        : { status: "skipped", reason: "existing_value" };
      if (beforeOpen.selection !== initial.selection || beforeOpen.search !== initial.search)
        return { status: "failed", reason: "field_changed" };
      if (beforeOpen.search.value !== "" || visible(beforeOpen.search)
        || openMenus().length || openSelects().length || otherOverlays().length)
        return { status: "skipped", reason: "control_busy" };
      beforeOpen.selection.click();
      openedByThisCall = true;
      let opened = null;
      for (let i = 0; i < 35; i += 1) {
        requireVisiblePage();
        opened = uniqueOpenMenu(baseline);
        if (opened && visible(opened.search)) break;
        await pause(40);
      }
      if (!opened || !visible(opened.search) || opened.search.value !== "")
        decision = { status: "failed", reason: "search_not_open" };
      else {
        opened.search.focus();
        if (document.activeElement !== opened.search)
          decision = { status: "failed", reason: "search_focus_failed" };
        else {
          await checkProfileWrite(); requireVisiblePage();
          const beforeSearch = uniqueOpenMenu(baseline);
          if (!beforeSearch || beforeSearch.selection !== opened.selection || beforeSearch.search !== opened.search
            || selectedText(beforeSearch.selection) || beforeSearch.search.value !== ""
            || document.activeElement !== beforeSearch.search) throw new Error("field_changed");
          let trusted = false;
          const watch = (event) => { trusted ||= event.isTrusted; };
          opened.search.addEventListener("input", watch);
          let inserted;
          try { inserted = document.execCommand("insertText", false, searchText); }
          finally { opened.search.removeEventListener("input", watch); }
          if (!inserted || !trusted || opened.search.value !== searchText)
            decision = { status: "failed", reason: "trusted_search_unavailable" };
          else {
            const started = performance.now();
            let lastSignature = null;
            let stable = 0;
            let candidate = null,candidateKind=null;
            for (let i = 0; i < 60; i += 1) {
              requireVisiblePage();
              const live = uniqueOpenMenu(baseline);
              if (!live) { decision = { status: "failed", reason: "menu_changed" }; break; }
              if (selectedText(live.selection)) { decision = { status: "failed", reason: "unexpected_value" }; break; }
              if (live.search.value !== searchText) {
                decision = { status: "failed", reason: "search_changed" }; break;
              }
              const state = candidateState(live.menu, desired,desiredOptionText,searchText);
              stable = state.signature === lastSignature && !state.busy ? stable + 1 : 0;
              lastSignature = state.signature;
              if (performance.now() - started >= 900 && stable >= 3) {
                if (state.exact.length !== 1) decision = {
                  status: "skipped",
                  reason: state.exact.length ? "ambiguous_option" : "option_not_found",
                  ...(state.exact.length ? {} : {
                    searchText,
                    desiredOptionText,
                    visibleOptionCount: state.visibleOptionCount,
                    createTemplatePresent: !!state.createTemplatePresent,
                    sampleOptions: state.sampleOptions || [],
                    hint: state.createTemplatePresent
                      ? "create_template_seen_but_not_sole_enabled_match"
                      : "no_catalog_or_create_match"
                  })
                };
                else {candidate=state.exact[0];candidateKind=state.candidateKind;}
                break;
              }
              await pause(80);
            }
            if (candidate) {
              requireVisiblePage();
              await checkProfileWrite(); requireVisiblePage();
              const live = uniqueOpenMenu(baseline);
              const currentState=live&&candidateState(live.menu,desired,desiredOptionText,searchText);
              const current=currentState?.exact;
              if (!live || !candidate.isConnected || current?.length !== 1
                || current[0] !== candidate || !live.menu.contains(candidate)
                || currentState.candidateKind!==candidateKind || currentState.busy || selectedText(live.selection)
                || live.search.value !== searchText || candidate.tagName !== "LI"
                || candidate.getAttribute("role") !== "option")
                decision = { status: "failed", reason: "candidate_changed" };
              else {
                candidate.click();
                selectedByThisCall = true;
                let readback = false;
                for (let i = 0; i < 30; i += 1) {
                  requireVisiblePage();
                  const selected = locate(baseline);
                  if (selected && normalizedOption(selectedText(selected.selection)) === desired) {
                    readback = true;
                    break;
                  }
                  await pause(40);
                }
                decision = readback
                  ? { status: "verified", reason: "readback_matched",
                    ...(candidateKind==='explicit_create_school'?{candidateKind}:{}) }
                  : { status: "failed", reason: "readback_mismatch" };
              }
            } else if (decision.reason === "control_error") {
              decision = { status: "failed", reason: "menu_not_stable" };
            }
          }
        }
      }
    } catch (error) { if(/^profile_[a-z_]+$/u.test(error?.message||''))throw error;
      decision = { status: "failed", reason: error?.message === "fill_interrupted_page_hidden"
        ? "fill_interrupted_page_hidden" : error?.message === "field_changed" ? "field_changed" : "control_error" };
    }
    if (openedByThisCall && document.visibilityState === "visible") {
      for (let i = 0; i < 20 && openMenus().length; i += 1) await pause(40);
      if (openMenus().length || openSelects().length) {
        if (!await closeOwnMenu(baseline))
          return { status: "failed", reason: "menu_cleanup_failed" };
      }
    }
    if (decision.reason === "fill_interrupted_page_hidden")
      throw new Error("fill_interrupted_page_hidden");
    const final = locate(baseline);
    if (!final) return { status: "failed", reason: "field_changed" };
    const actual = selectedText(final.selection);
    if (selectedByThisCall && normalizedOption(actual) !== desired)
      return { status: "failed", reason: "readback_mismatch" };
    if (!selectedByThisCall && actual)
      return { status: "failed", reason: "unexpected_value" };
    if (openMenus().length || openSelects().length)
      return { status: "failed", reason: "menu_cleanup_failed" };
    return decision;
  }

  globalThis.ResumeCmsSchoolSearch = Object.freeze({implementationRevision:3, fillSchool });
})();
