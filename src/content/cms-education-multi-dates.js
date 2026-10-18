// Independent CMS multi-row candidate derived from cms-education-dates.js, SHA256 e0a6a6377a3a792d18bd4c8a45c9f0d05c49c0afd99a7255e333e17fcd9d40b0.
(function () {
  "use strict";
  async function checkProfileWrite(){const context=globalThis.ResumeProfileWriteContext;if(context)await context.check();}


  // Four exact CMS calendar scopes share the verified calendar interaction.
  // The caller must bind one confirmed full date to its only section row. A
  // month-only fact is never expanded to an invented day, including trials.
  // All value changes go through actual calendar choices, never input.value.
  const PAGE = "https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html";
  const SCOPES = {
    startDate: { section: "教育经历必填", question: "开始时间", path: "education.0.startDate" },
    endDate: { section: "教育经历必填", question: "结束时间", path: "education.0.endDate" },
    graduationDate: { section: "个人基本信息必填", question: "毕业时间", path: "customAnswers.__cms_basic_graduation_date" },
    certificateDate: { section: "英语能力必填", question: "获得时间", path: "customAnswers.__cms_english_certificate_date" }
  };
  const STEP_MS = 1400;
  const CLOSE_MS = 2000;
  const MAX_YEAR_PAGES = 16;
  const PAGE_HIDDEN_DURING_FILL = "fill_interrupted_page_hidden";
  function requireVisibleFillPage() {
    if (document.visibilityState !== "visible") throw new Error(PAGE_HIDDEN_DURING_FILL);
  }

  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const questionName = (value) => String(value || "").normalize("NFKC")
    .replace(/[＊*：:！!？?，,。\s]/g, "");
  const visible = (element) => !!element
    && !element.closest('[hidden],[aria-hidden="true"]')
    && element.getClientRects().length > 0
    && getComputedStyle(element).display !== "none"
    && getComputedStyle(element).visibility !== "hidden";
  const enabled = (element) => !!element && !element.disabled
    && element.getAttribute("aria-disabled") !== "true"
    && !element.closest(".ant-calendar-disabled-cell,.ant-calendar-year-panel-disabled-cell,.ant-calendar-month-panel-disabled-cell");

  function validDayDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month
      && date.getUTCDate() === day;
  }

  function uniqueEducationInput(form, binding) {
    if (!form?.isConnected) return null;
    const internship=binding.collection==='experience';
    const spec=internship?(['startDate','endDate'].includes(binding.key)?{section:'实习经历',question:binding.key==='startDate'?'开始时间':'结束时间'}:null):SCOPES[binding.key];
    if (!spec) return null;
    const sections = [...form.querySelectorAll(".form-cell")].filter((section) =>
      visible(section) && questionName(section.querySelector(":scope > .tit-wrap .tit")?.textContent)
        === spec.section);
    if (sections.length !== 1) return null;
    const rows = [...sections[0].querySelectorAll(":scope > .form-cell-right > .form-cell-inner")];
    const controller=binding.collection==='experience'?globalThis.ResumeCmsInternshipMulti:globalThis.ResumeCmsEducationMulti;
    const row=controller?.locateRow(form,binding.rowIdentity);
    if (!['startDate','endDate'].includes(binding.key) || !row || !rows.includes(row)) return null;
    if (binding.key === "certificateDate") {
      const certificateItems = [...rows[0].querySelectorAll(".ant-form-item")].filter(item => {
        const labels = [...item.querySelectorAll(".ant-form-item-label > label")].filter(label => label.closest(".ant-form-item") === item);
        return visible(item) && labels.length === 1 && questionName(labels[0].textContent) === "英语证书名称";
      });
      const selections = certificateItems.length === 1
        ? [...certificateItems[0].querySelectorAll(".ant-select-selection-selected-value,.ant-select-selection-item")].filter(visible) : [];
      if (selections.length !== 1 || !selections[0].textContent.trim()) return null;
    }
    const questions = [...row.querySelectorAll(".ant-form-item")].filter((item) => {
      if (!visible(item) || item.closest(".form-cell-inner") !== row) return false;
      const labels = [...item.querySelectorAll(".ant-form-item-label > label")]
        .filter((label) => label.closest(".ant-form-item") === item);
      return labels.length === 1 && questionName(labels[0].textContent) === spec.question;
    });
    if (questions.length !== 1) return null;
    const inputs = [...questions[0].querySelectorAll("input.ant-calendar-picker-input")]
      .filter((input) => input.closest(".ant-form-item") === questions[0] && visible(input));
    if (inputs.length !== 1 || inputs[0].type !== "text"
      || !inputs[0].closest(".ant-calendar-picker")
      || questions[0].querySelectorAll(".ant-calendar-picker").length !== 1) return null;
    return inputs[0];
  }

  const openPortals = () => [...document.querySelectorAll(".ant-calendar-picker-container")]
    .filter((portal) => visible(portal)
      && !portal.classList.contains("ant-calendar-picker-container-hidden"));

  async function waitUntil(predicate, milliseconds, deadline, allowHidden = false) {
    const end = Math.min(Date.now() + milliseconds, deadline);
    while (Date.now() <= end) {
      if (!allowHidden) requireVisibleFillPage();
      const result = predicate();
      if (result) return result;
      await pause(40);
    }
    return null;
  }

  function oneVisible(root, selector) {
    const matches = [...root.querySelectorAll(selector)].filter(visible);
    return matches.length === 1 ? matches[0] : null;
  }

  function parseYear(element) {
    const tokens = [element.getAttribute("title"), element.getAttribute("aria-label"), element.textContent];
    const years = tokens.map((token) => /^\s*(\d{4})\s*$/.exec(String(token || ""))?.[1])
      .filter(Boolean).map(Number);
    return years.length && years.every((value) => value === years[0]) ? years[0] : null;
  }

  function parseMonth(element, year) {
    const title = String(element.getAttribute("title") || "").trim();
    const numeric = /^(\d{4})[-/.年](\d{1,2})(?:月)?$/.exec(title);
    if (numeric) return Number(numeric[1]) === year ? Number(numeric[2]) : null;
    const text = String(element.textContent || "").trim();
    const arabic = /^(\d{1,2})月$/.exec(text);
    if (arabic) return Number(arabic[1]);
    const chinese = /^(一|二|三|四|五|六|七|八|九|十|十一|十二)月$/.exec(text);
    if (chinese) return ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"]
      .indexOf(chinese[1]) + 1;
    return null;
  }

  function parseFullDate(element) {
    // rc-calendar can put the complete date on the enclosing cell while its
    // clickable inner element contains only the day number. Never derive a
    // full date from that number. If both surfaces declare complete dates,
    // require them to agree before clicking.
    const cell = element.closest(".ant-calendar-cell");
    if (!cell) return null;
    const tokens = [element.getAttribute("title"), element.getAttribute("aria-label"),
      cell.getAttribute("title"), cell.getAttribute("aria-label")];
    const dates = tokens.flatMap((token) => {
      const match = /^\s*(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})(?:日)?\s*$/.exec(String(token || ""));
      if (!match) return [];
      const canonical = `${match[1]}-${String(Number(match[2])).padStart(2, "0")}-${String(Number(match[3])).padStart(2, "0")}`;
      return validDayDate(canonical) ? [canonical] : [];
    });
    return dates.length && dates.every((date) => date === dates[0]) ? dates[0] : null;
  }

  async function closePortal(locate, deadline) {
    if (openPortals().length === 0) return true;
    const input = locate();
    if (!input || openPortals().length !== 1) return false;
    input?.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true
    }));
    input?.blur();
    input?.closest(".ant-calendar-picker")?.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true
    }));
    document.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true
    }));
    if (await waitUntil(() => openPortals().length === 0, 650, deadline, true)) return true;
    for (const type of ["mousedown", "mouseup", "click"])
      document.body.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
    return !!await waitUntil(() => openPortals().length === 0, 650, deadline, true);
  }

  async function onlineAllowed() {
    try {
      if (typeof chrome === "undefined" || chrome.runtime?.getManifest?.()?.background?.service_worker
        !== "src/license/guard-worker.mjs") return true;
      return (await chrome.runtime.sendMessage({ type: "RESUME_PAID_VERIFY" }))?.allowed === true;
    } catch { return false; }
  }

  async function fillEducationDate(input, targetDate, binding) {
    // Shared direct entry is the sole writing entry. Paid checks happen before
    // profile-derived date validation, site inspection, or any calendar action.
    if (!await onlineAllowed()) return { status: "skipped", reason: "license_required" };
    if (`${location.origin}${location.pathname}` !== PAGE)
      return { status: "skipped", reason: "wrong_site" };
    if (binding?.confirmed !== true || !['startDate','endDate'].includes(binding.key) || !Number.isInteger(binding.profileIndex) || binding.profileIndex < 0 || binding.profileIndex > 29 || !binding.rowIdentity
      || !(binding.collection==='experience'?[`experience.${binding.profileIndex}.${binding.key}`]:[`education.${binding.profileIndex}.${binding.key}`,`recordSupplement.${binding.profileIndex}.${binding.key}`]).includes(binding.sourcePath))
      return { status: "skipped", reason: "education_binding_unconfirmed" };
    if (!validDayDate(targetDate)) return { status: "skipped", reason: "insufficient_precision" };
    if (!(input instanceof HTMLInputElement)) return { status: "skipped", reason: "control_guard" };
    const form = input.form || input.closest("form");
    const startOrigin = location.origin;
    const startPath = location.pathname;
    const startTimeOrigin = performance.timeOrigin;
    const first = uniqueEducationInput(form, binding);
    if (first !== input) return { status: "skipped", reason: "control_guard" };
    const outside = () => {
      const own = uniqueEducationInput(form, binding)?.closest(".ant-form-item");
      if (!own) return null;
      return JSON.stringify([...form.querySelectorAll("input,textarea,select,.ant-select-selection-selected-value,.ant-select-selection-item")]
        .filter(node => node.closest(".ant-form-item") !== own)
        .map(node => [node.tagName, node.type || "", node.value ?? node.textContent ?? "", !!node.checked,
          node.selectedIndex ?? null, [...(node.files || [])].map(file => [file.name, file.size, file.type])]));
    };
    const protectedValues = outside();
    const locate = () => location.origin === startOrigin && location.pathname === startPath
      && performance.timeOrigin === startTimeOrigin && form.isConnected && outside() === protectedValues
      ? uniqueEducationInput(form, binding) : null;
    if (!form || locate() !== input || !input.readOnly || input.disabled)
      return { status: "skipped", reason: "control_guard" };
    const initialValue=input.value;
    if (initialValue === targetDate && binding.replaceExisting !== true) return {status:'verified',reason:'preexisting_same_value'};
    if (initialValue && binding.replaceExisting !== true) return {status:'skipped',reason:'existing_value'};
    if (openPortals().length || [...document.querySelectorAll(".ant-select-dropdown,.ant-cascader-menus,.ant-modal")]
      .some(node => visible(node) && !node.classList.contains("ant-select-dropdown-hidden")))
      return { status: "skipped", reason: "control_busy" };

    // One bounded attempt. Never retry a date click, as it may have succeeded
    // before a delayed component repaint.
    const deadline = Date.now() + 12000;
    let clickedDay = false;
    let interrupted = false;
    let decision = { status: "failed", reason: "control_error" };
    try {
      requireVisibleFillPage();
      await checkProfileWrite(); input.click();await checkProfileWrite();
      const portal = await waitUntil(() => openPortals().length === 1 && openPortals()[0], STEP_MS, deadline);
      if (!portal) {
        // A framework can still have a timer queued to mount the portal.
        // Send both close signals even though none is visible yet.
        locate()?.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true
        }));
        document.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true
        }));
        for (const type of ["mousedown", "mouseup", "click"])
          document.body.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
        decision = { status: "failed", reason: "portal_not_open" };
      } else if (openPortals().length !== 1 || locate() == null) {
        decision = { status: "failed", reason: "field_changed" };
      } else {
        const targetYear = Number(targetDate.slice(0, 4));
        const targetMonth = Number(targetDate.slice(5, 7));
        const yearTrigger = oneVisible(portal, ".ant-calendar-date-panel .ant-calendar-year-select");
        if (!yearTrigger) decision = { status: "skipped", reason: "year_selector_missing" };
        else {
          requireVisibleFillPage();
          await checkProfileWrite(); yearTrigger.click();await checkProfileWrite();
          let yearPanel = await waitUntil(() => oneVisible(portal, ".ant-calendar-year-panel"), STEP_MS, deadline);
          if (!yearPanel || locate() == null) decision = { status: "failed", reason: "year_panel_missing" };
          else {
            for (let page = 0; page < MAX_YEAR_PAGES; page += 1) {
              yearPanel = oneVisible(portal, ".ant-calendar-year-panel");
              if (!yearPanel || locate() == null) break;
              const cells = [...yearPanel.querySelectorAll(".ant-calendar-year-panel-year")]
                .filter(visible);
              const matches = cells.filter((cell) => parseYear(cell) === targetYear && enabled(cell));
              if (matches.length > 0) break;
              const years = cells.map(parseYear).filter((year) => year !== null);
              if (!years.length || new Set(years).size !== years.length
                || targetYear >= Math.min(...years) && targetYear <= Math.max(...years)) break;
              const direction = targetYear < Math.min(...years) ? "prev" : "next";
              const control = oneVisible(yearPanel,
                `.ant-calendar-year-panel-${direction}-decade-btn`);
              if (!enabled(control)) break;
              requireVisibleFillPage();
              await checkProfileWrite(); control.click();await checkProfileWrite();
              await pause(40);
            }
            yearPanel = oneVisible(portal, ".ant-calendar-year-panel");
            const yearChoices = yearPanel ? [...yearPanel.querySelectorAll(".ant-calendar-year-panel-year")]
              .filter((cell) => visible(cell) && parseYear(cell) === targetYear && enabled(cell)) : [];
            if (yearChoices.length !== 1 || locate() == null)
              decision = { status: "skipped", reason: yearChoices.length ? "ambiguous_year" : "year_not_found" };
            else {
              requireVisibleFillPage();
              await checkProfileWrite(); yearChoices[0].click();await checkProfileWrite();
              // Ant v3 variants either open the month panel or return to the
              // day panel after choosing a year. In the latter case use the
              // displayed month's own selector, never infer a month. The day
              // panel can remain visible beneath the year overlay, so wait
              // until that overlay is gone before touching the day panel.
              const afterYear = await waitUntil(() =>
                !oneVisible(portal, ".ant-calendar-year-panel")
                  ? oneVisible(portal, ".ant-calendar-month-panel")
                    || oneVisible(portal, ".ant-calendar-date-panel")
                  : null, STEP_MS, deadline);
              if (afterYear?.classList.contains("ant-calendar-date-panel")) {
                const monthTrigger = oneVisible(afterYear, ".ant-calendar-month-select");
                if (enabled(monthTrigger)) {
                  requireVisibleFillPage();
                  await checkProfileWrite(); monthTrigger.click();await checkProfileWrite();
                }
              }
              const monthPanel = await waitUntil(() => oneVisible(portal, ".ant-calendar-month-panel"), STEP_MS, deadline);
              const monthChoices = monthPanel ? [...monthPanel.querySelectorAll(".ant-calendar-month-panel-month")]
                .filter((cell) => visible(cell) && parseMonth(cell, targetYear) === targetMonth && enabled(cell)) : [];
              if (monthChoices.length !== 1 || locate() == null)
                decision = { status: "skipped", reason: monthChoices.length ? "ambiguous_month" : "month_not_found" };
              else {
                requireVisibleFillPage();
                await checkProfileWrite(); monthChoices[0].click();await checkProfileWrite();
                // A stale day grid may still be present underneath the month
                // overlay during React's transition. Do not click its cells.
                const dayPanel = await waitUntil(() =>
                  !oneVisible(portal, ".ant-calendar-month-panel")
                    ? oneVisible(portal, ".ant-calendar-date-panel") : null,
                STEP_MS, deadline);
                const allDayChoices = dayPanel ? [...dayPanel.querySelectorAll(".ant-calendar-date")]
                  .filter((cell) => visible(cell) && parseFullDate(cell) === targetDate) : [];
                const dayChoices = allDayChoices.filter(enabled);
                if (dayChoices.length !== 1 || locate() == null)
                  decision = { status: "skipped", reason: dayChoices.length ? "ambiguous_day"
                    : allDayChoices.length ? "disabled_day" : "day_not_found" };
                else {
                  requireVisibleFillPage();
                  await checkProfileWrite(); dayChoices[0].click();await checkProfileWrite();
                  clickedDay = true;
                  const readback = await waitUntil(() => {
                    const live = locate();
                    return live && live.value === targetDate ? live : null;
                  }, STEP_MS, deadline);
                  decision = readback
                    ? { status: "verified", reason: initialValue === targetDate ? "reapplied" : "readback_matched" }
                    : { status: "failed", reason: "readback_mismatch" };
                }
              }
            }
          }
        }
      }
    } catch (error) { if(/^profile_[a-z_]+$/u.test(error?.message||''))throw error;
      interrupted = error?.message === PAGE_HIDDEN_DURING_FILL;
      decision = { status: "failed", reason: "control_error" };
    }
    // Wait for Ant's exiting portal before using Escape/body fallback. A label
    // appearing before portal closure is not enough to report success.
    const naturallyClosed = !!await waitUntil(() => openPortals().length === 0, CLOSE_MS, deadline, true);
    const closed = naturallyClosed || await closePortal(locate, Date.now() + 1400);
    if (interrupted || document.visibilityState !== "visible") throw new Error(PAGE_HIDDEN_DURING_FILL);
    if (!closed) return { status: "failed", reason: "portal_not_closed" };
    const live = locate();
    if (!live) return { status: "failed", reason: "field_changed" };
    if (clickedDay && live.value !== targetDate) return { status: "failed", reason: "readback_mismatch" };
    if (decision.status === "verified" && live.value === targetDate) return decision;
    if (decision.status === "skipped" && live.value && live.value !== initialValue) return { status: "failed", reason: "unexpected_value" };
    return decision;
  }

  globalThis.ResumeCmsMultiEducationDates=Object.freeze({implementationRevision:3,fillEducationDate:(input,value,binding)=>fillEducationDate(input,value,{...binding,collection:'education'})});
  globalThis.ResumeCmsInternshipDates=Object.freeze({implementationRevision:1,fillDate:(input,value,binding)=>fillEducationDate(input,value,{...binding,collection:'experience'})});
})();
