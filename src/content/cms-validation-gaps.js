(function () {
  "use strict";

  const clean = text => String(text || "").replace(/\s+/g, " ").trim();
  const visible = node => !!node && node.isConnected && node.getClientRects().length > 0
    && !node.closest('[hidden],[aria-hidden="true"]')
    && getComputedStyle(node).display !== "none"
    && getComputedStyle(node).visibility !== "hidden";
  const cmsResumePage = () => location.protocol === "https:"
    && location.hostname === "wecruit.hotjob.cn"
    && /^\/SU[^/]+\/pb\/resumeOperation\.html$/.test(location.pathname);

  // Only echo a prompt that exactly matches a generic instruction plus this
  // question's label. A site error containing a typed answer is never copied.
  function safeMessage(text, question) {
    const raw = clean(text);
    const expected = ["请选择", "请填写", "请输入", "请上传", "请正确填写"]
      .map(prefix => `${prefix}${question}`);
    if (raw.length <= 170 && expected.includes(raw)) return raw;
    if (["该项不能为空", "此项不能为空", "请至少选择一项"].includes(raw)) return raw;
    return "网站提示需检查此项";
  }

  function empty(item) {
    const files = [...item.querySelectorAll('input[type="file"]')];
    if (files.length) return files.every(input => !input.files?.length)
      && !item.querySelector(".ant-upload-list-item-done,.ant-upload-list-item-thumbnail");
    const choices = [...item.querySelectorAll('input[type="checkbox"],input[type="radio"]')];
    if (choices.length) return choices.every(input => !input.checked);
    const values = [...item.querySelectorAll("input,textarea,select")]
      .filter(input => !["hidden", "search", "button", "submit", "reset", "file"].includes(input.type));
    // Presence-only checks stay inside the page. No field value is returned.
    if (values.some(input => input.value.length > 0)) return false;
    return ![...item.querySelectorAll(".ant-select-selection-selected-value,.ant-select-selection-item")]
      .some(node => node.textContent.length > 0);
  }

  function scan() {
    if (!cmsResumePage()) return { total: 0, items: [] };
    const errorItems = [...new Set([...document.querySelectorAll(".ant-form-item-has-error,.has-error")]
      .map(node => node.matches(".ant-form-item") ? node : node.closest(".ant-form-item"))
      .filter(visible))];
    const items = errorItems.slice(0, 100).map(item => {
      const sectionNode = item.closest(".form-cell");
      const section = clean(sectionNode?.querySelector(":scope > .tit-wrap .tit")?.textContent)
        || "未识别分区";
      const labels = [...item.querySelectorAll(".ant-form-item-label > label")]
        .filter(node => node.closest(".ant-form-item") === item);
      const question = labels.length === 1
        ? clean(labels[0].textContent).replace(/\s*[＊*]\s*[?？]?\s*$/u, "")
        : "未识别问题";
      const rows = [...(sectionNode?.querySelectorAll(".form-cell-inner") || [])];
      const row = rows.indexOf(item.closest(".form-cell-inner")) + 1;
      const hints = [...item.querySelectorAll(".ant-form-explain,.ant-form-item-explain,[role=alert]")]
        .filter(node => node.closest(".ant-form-item") === item && visible(node))
        .map(node => safeMessage(node.textContent, question));
      return {
        section: section.slice(0, 100), question: question.slice(0, 160), row: row || null,
        message: [...new Set(hints)].join("；") || "网站提示需检查此项",
        empty: empty(item),
        conditionalLanguage: /^(?:如|若|如果)应聘/u.test(question)
      };
    });
    return { total: errorItems.length, items };
  }

  globalThis.ResumeCmsValidationGaps = { scan };
})();
