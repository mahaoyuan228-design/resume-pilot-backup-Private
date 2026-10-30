(function () {
  "use strict";
  // A popup deadline does not cancel a message already running in this page.
  // Keep the guard on the isolated-world global so reinjection shares it.
  const fillState = globalThis.__resumeQuickFillFillState ||= { pending: false };
  let existingListenerAlive=false;
  const nativeMessages=chrome.runtime.onMessage,ownedListener=globalThis.__resumeQuickFillEngineListener;
  if(nativeMessages.hasListeners?.()===false)globalThis.__resumeNativeListenersResetObserved=true;
  if(globalThis.__resumeQuickFillInstalled){
    existingListenerAlive=!!ownedListener&&nativeMessages.hasListener?.(ownedListener)===true;
    if(existingListenerAlive&&globalThis.__resumeQuickFillEngineRevision===18&&typeof globalThis.ResumeQuickFillGthInspect==='function')return;
    if(existingListenerAlive){if(fillState.pending)throw Error('profile_write_context_busy');nativeMessages.removeListener(ownedListener);existingListenerAlive=false;}
    else if(!ownedListener&&nativeMessages.hasListeners?.()===true&&!globalThis.__resumeNativeListenersResetObserved)throw Error('extension_reload_required');
  }

  async function checkProfileWrite(){const context=globalThis.ResumeProfileWriteContext;if(context)await context.check();}
  const M = globalThis.ResumeMatcher;
  const proseValue = value => String(value ?? '').replace(/\r\n?/gu, '\n');
  const richtextControl = control => control.hasAttribute('contenteditable') && !control.matches('input,textarea,select,iframe');
  const proseControl = control => control instanceof HTMLTextAreaElement || richtextControl(control);
  // ISOLATED-world observation mirrors L1's plain-text block/BR contract.
  function richtextValue(root) {
    const block = node => /^(DIV|P|LI|UL|OL|BLOCKQUOTE|PRE|H[1-6]|SECTION|ARTICLE)$/u.test(node.nodeName);
    const read = node => {
      if (node.nodeType === 3) return node.data;
      if (node.nodeName === 'BR') return '\n';
      const children = [...node.childNodes].filter(child => child.nodeType === 1 || child.nodeType === 3);
      if ((node === root || block(node)) && children.length === 1 && children[0].nodeName === 'BR') return '';
      let text = '', previous = null;
      for (const child of children) {
        const value = read(child);
        if (!block(child) && value === '') continue;
        if (previous && (block(previous) || block(child))) text += '\n';
        text += value; previous = child;
      }
      return text;
    };
    return proseValue(read(root));
  }
  let atsControlTargets = new Map();
  const atsControlPeers = new Set();
  async function loadAtsControlTargets(enabled = null) {
    atsControlTargets = new Map();
    atsControlPeers.clear();
    if (enabled === null) enabled = typeof globalThis.chrome?.storage?.local?.get === 'function'
      && (await chrome.storage.local.get('resumeAtsEngineWriteEnabled')).resumeAtsEngineWriteEnabled === true;
    if (!enabled) return;
    const response = await chrome.runtime.sendMessage({ type: 'RESUME_ATS_CONTROL_CANDIDATES', timeOrigin: performance.timeOrigin });
    if (response?.ok !== true || response.mode !== 'candidates' || response.writeStarted !== false || response.liveSupportClaimed !== false) throw Error('control_candidates_unavailable');
    for (const candidate of response.candidates || []) {
      const nodes = document.querySelectorAll(candidate.selector);
      if (nodes.length !== 1 || !nodes[0].matches('input,textarea,[contenteditable]')) continue;
      if (candidate.type === 'multi-select') {
        const roots = typeof candidate.rootSelector === 'string' ? document.querySelectorAll(candidate.rootSelector) : [];
        if (roots.length !== 1 || !roots[0].contains(nodes[0])) continue;
        for (const peer of roots[0].querySelectorAll('input,textarea,[contenteditable]')) if (peer !== nodes[0]) atsControlPeers.add(peer);
      }
      atsControlTargets.set(nodes[0], candidate);
    }
  }
  let fieldMemorySnapshot = null;
  async function loadFieldMemory() {
    fieldMemorySnapshot = null;
    if (!globalThis.ResumeDomainMemory || !chrome.storage?.local) return;
    try { fieldMemorySnapshot = await globalThis.ResumeDomainMemory.load(chrome.storage.local, location.href); }
    catch { /* Unavailable or invalid memory leaves the field manual. */ }
  }
  const RESERVED_TYPES = new Set(["hidden", "password", "search", "submit", "reset", "button", "image", "checkbox"]);
  const MANUAL_CONTROL_SELECTOR = 'iframe,[data-captcha],[class*="captcha" i],[id*="captcha" i],[name*="captcha" i],input[autocomplete="one-time-code"]';
  const manualControlReason = control => control.closest(MANUAL_CONTROL_SELECTOR) ? "iframe_or_captcha_manual" : null;
  function requireWritableControl(control, writeStarted = false) {
    const reason = manualControlReason(control);
    if (reason) throw Object.assign(Error(reason), { writeStarted });
  }
  function manualControlEntry(control, position) {
    return { id: fieldId(control, position), labels: labelTexts(control), kind: control.tagName.toLowerCase(),
      key: null, control, semanticStatus: "manual", reason: "iframe_or_captcha_manual" };
  }
  const PAGE_HIDDEN_DURING_FILL = "fill_interrupted_page_hidden";
  const CMS_PHOTO_PAGE = "https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html";
  function requireVisibleFillPage() {
    if (document.visibilityState !== "visible") throw new Error(PAGE_HIDDEN_DURING_FILL);
  }
  const REPEAT_KEYS = {
    education: { collection: "education", school: "school", degree: "degree", major: "major", startDate: "startDate", endDate: "endDate" },
    project: { collection: "projects", projectName: "name", projectDescription: "description" }
  };

  function antSelectControl(control) {
    return control instanceof HTMLInputElement && control.type === "search"
      && control.getAttribute("role") === "combobox"
      && !!control.closest(".ant-form-item .ant-select");
  }

  function formItemQuestion(item) {
    if (!item) return null;
    const labels = [...item.querySelectorAll('.ant-form-item-label > label')]
      .filter((label) => label.closest('.ant-form-item') === item);
    return labels.length === 1 ? labels[0] : null;
  }

  function antDegreeControl(control) {
    if (!antSelectControl(control) || !control.readOnly || control.disabled) return false;
    const select = control.closest(".ant-select.ant-select-single");
    const item = control.closest(".ant-form-item.form-item");
    const label = formItemQuestion(item);
    return !!select && !!item && !select.classList.contains("ant-select-disabled")
      && !!select.querySelector(".ant-select-selector")
      && item.querySelectorAll(".ant-select").length === 1
      && label?.htmlFor === control.id && M.normalize(label.textContent) === "学历"
      && namedSection(control)?.name === "教育经历";
  }

  function exactOptionText(value) {
    return String(value ?? "").normalize("NFKC").replace(/\s+/g, "").trim();
  }

  function visible(control, confirmedWidget = false) {
    if (control.disabled || control.closest('[hidden],[aria-hidden="true"]')) return false;
    if (control instanceof HTMLInputElement && RESERVED_TYPES.has(control.type) && !antSelectControl(control)
      && !(confirmedWidget && control.type === 'search')) return false;
    const style = getComputedStyle(control);
    return style.display !== "none" && style.visibility !== "hidden" && control.getClientRects().length > 0;
  }

  function questionOwnsControl(label, control, scope) {
    if (!label) return false;
    if (label.htmlFor) {
      const target = document.getElementById(label.htmlFor);
      return target === control || !!target && control.contains(target);
    }
    const editors = [...scope.querySelectorAll('input:not([type="hidden"]),select,textarea,[contenteditable]')]
      .filter(node => !node.hasAttribute('contenteditable') || ['', 'true', 'plaintext-only'].includes(node.getAttribute('contenteditable').toLowerCase())
        && !node.parentElement?.closest('[contenteditable]'))
      .filter(node => !['button', 'submit', 'reset', 'image'].includes(node.type));
    const widget = node => node.closest('.ant-select,.el-select,.ivu-select,.ant-radio-group,.el-radio-group,.ivu-radio-group') || node;
    if (editors.length && editors.every(node => node.type === 'radio' && node.name === editors[0].name)) return editors.includes(control);
    const owners = new Set(editors.map(widget));
    return owners.size === 1 && owners.has(widget(control));
  }

  function labelTexts(control) {
    const found = [];
    const add = (value) => {
      const clean = String(value || "").replace(/\s+/g, " ").trim();
      if (clean && !found.includes(clean)) found.push(clean);
    };
    // The Ant form item's own label is the question. A placeholder may be a
    // generic hint or even name a different fact; it must not veto that label.
    const antQuestion = formItemQuestion(control.closest(".ant-form-item"));
    if (questionOwnsControl(antQuestion, control, control.closest('.ant-form-item'))) {
      add(antQuestion.textContent);
      return found;
    }
    const ownLabels = control.labels || [...document.querySelectorAll('label[for]')].filter(label => label.htmlFor === control.id);
    for (const label of ownLabels) {
      if (!questionOwnsControl(label, control, label)) continue;
      const copy = label.cloneNode(true);
      copy.querySelectorAll("input,select,textarea,button,[contenteditable]").forEach((item) => item.remove());
      add(copy.textContent);
    }
    add(control.getAttribute("aria-label"));
    const labelledBy = control.getAttribute("aria-labelledby");
    if (labelledBy) for (const id of labelledBy.split(/\s+/)) add(document.getElementById(id)?.textContent);
    // Ant Design and Element UI often put the question on the enclosing form
    // item without associating it with the native input. Take only that item's
    // own, unique label so a nested repeat row cannot borrow another question.
    const elementItem = control.closest(".el-form-item");
    if (elementItem) {
      const ownLabels = [...elementItem.querySelectorAll(".el-form-item__label")]
        .filter((label) => label.closest(".el-form-item") === elementItem);
      if (ownLabels.length === 1 && questionOwnsControl(ownLabels[0], control, elementItem)) add(ownLabels[0].textContent);
    }
    add(control.getAttribute("placeholder"));
    add(control.getAttribute("title"));
    if (!found.length) {
      const near = control.closest(".form-item,.form-group,.field,[data-field]");
      const label = near?.querySelector("label,.label,[data-label]");
      if (questionOwnsControl(label, control, near)) add(label.textContent);
    }
    return found;
  }

  function repeatContext(control) {
    const row = control.closest("[data-repeat-kind]");
    if (!row) return null;
    const kind = row.getAttribute("data-repeat-kind");
    const rows = [...document.querySelectorAll(`[data-repeat-kind="${kind}"]`)];
    return { kind, index: rows.indexOf(row) };
  }

  function namedSection(control) {
    const section = control.closest("form .item-box");
    const heading = section?.querySelector(":scope > .item-name");
    if (!heading) return null;
    const sections = [...section.closest("form").querySelectorAll(".item-box > .item-name")]
      .map((item) => M.normalize(item.textContent));
    if (!["个人信息", "家庭情况", "教育经历"].every((name) => sections.includes(name))) return null;
    return { element: section, name: M.normalize(heading.textContent) };
  }

  const CMB_ANT_V4_QUESTIONS = new Set(["证件类型", "政治面貌", "招聘信息来源"]);

  function cmbAntV4Control(control, allowOpenSearch = false) {
    if (location.hostname !== "career.cmbchina.com" || location.pathname !== "/center/resume"
      || !antSelectControl(control) || control.disabled || !control.id) return false;
    const section = namedSection(control);
    const item = control.closest(".ant-form-item.form-item");
    const select = control.closest(".ant-select.ant-select-single");
    const label = formItemQuestion(item);
    const question = M.normalize(label?.textContent);
    if (section?.name !== "个人信息" || !item || !select || !CMB_ANT_V4_QUESTIONS.has(question)
      || label.htmlFor !== control.id || control.closest(".ant-cascader")
      || item.querySelectorAll(".ant-select").length !== 1
      || select.querySelectorAll(".ant-select-selector").length !== 1
      || !control.getAttribute("aria-controls") || select.classList.contains("ant-select-disabled")
      || !(control.readOnly || (allowOpenSearch && select.classList.contains("ant-select-open")))
      || !visible(control)) return false;
    const peers = [...section.element.querySelectorAll(".ant-form-item.form-item")]
      .filter((candidate) => {
        const own = formItemQuestion(candidate);
        return own && visible(own) && M.normalize(own.textContent) === question;
      });
    return peers.length === 1 && peers[0] === item;
  }

  function sectionDecision(control, key, section, context) {
    if (!section) return { context };
    if (section.name === "家庭情况") return { context, reason: "family_field_requires_mapping" };
    if ((key === "fullName" || key === "phone") && section.name !== "个人信息") {
      return { context, reason: "section_requires_mapping" };
    }
    if (section.name !== "教育经历" || context || !REPEAT_KEYS.education[key]) return { context };

    // A single unmarked education row can be identified. Multiple rows need
    // explicit row markers before any value can be assigned to an index.
    const controls = [...section.element.querySelectorAll("input,select,textarea")];
    const classified = controls.map((item) => ({ item, key: M.classify(labelTexts(item)).key }));
    const schools = classified.filter((item) => item.key === "school");
    const peers = classified.filter((item) => item.key === key);
    if (schools.length !== 1 || peers.length !== 1) return { context, reason: "ambiguous_repeat_group" };
    return { context: { kind: "education", index: 0 } };
  }

  function cmsSection(control) {
    const section = control.closest(".form-cell");
    const heading = section?.querySelector(":scope > .tit-wrap .tit");
    if (!heading) return null;
    const scope = section.closest("form") || document;
    const headings = [...scope.querySelectorAll(".form-cell > .tit-wrap .tit")]
      .map((item) => M.normalize(item.textContent));
    const signature = ["个人基本信息必填", "自我评价必填", "教育经历必填"];
    // 南粤 same-shell headings omit 自我评价必填. 个人基本信息必填 + 教育经历必填 still binds.
    const tenantMin = ["个人基本信息必填", "教育经历必填"];
    if (!signature.every((name) => headings.includes(name))
      && !tenantMin.every((name) => headings.includes(name))) return null;
    return { element: section, name: M.normalize(heading.textContent) };
  }

  // This exact employer has explicit source-to-row education/internship
  // entries. The general button must not guess source 0 or apply an unrelated
  // confirmed custom answer inside either owned record set.
  function cmsDedicatedRecordKind(control) {
    if (location.origin + location.pathname !== CMS_PHOTO_PAGE) return null;
    const section = control.closest("form .form-cell");
    return section?.id === "14" ? "education"
      : section?.id === "49170501" ? "internship" : null;
  }

  const CMS_DEDICATED_RECORD_QUESTIONS = {
    education: new Set(["学校", "学历", "学位", "专业名称", "开始时间", "结束时间", "城市", "专业排名", "专业描述"].map(M.normalize)),
    internship: new Set(["开始时间", "结束时间", "企业名称", "工作性质", "职位名称", "工作描述"].map(M.normalize))
  };

  function gthSection(control) {
    if (location.hostname !== "hr.gtht.com" || location.pathname !== "/resume/edit/") return null;
    const section = control.closest(".r-section");
    const form = control.closest("form");
    if (!section || !form || !section.contains(form)) return null;
    const sections = [...document.querySelectorAll(".r-section")];
    if (sections.length !== 7) return null;
    const titleOf = (item) => {
      const title = item.querySelector(".title_")?.cloneNode(true);
      title?.querySelectorAll("a,button").forEach((action) => action.remove());
      return M.normalize(title?.textContent);
    };
    const titles = sections.map(titleOf);
    if (titles.some((title) => !title) || new Set(titles).size !== 7) return null;
    const name = titleOf(section);
    if (!["基本信息", "求职意向", "职业技能与特长", "附件简历", "其他信息"].includes(name)) return null;
    return { element: section, name };
  }

  function customQuestionScope(control) {
    const cms = cmsSection(control);
    const cmb = !cms && namedSection(control);
    const gthPage = location.hostname === "hr.gtht.com" && location.pathname === "/resume/edit/";
    const gth = !cms && !cmb && gthPage ? gthSection(control) : null;
    const fieldset = !cms && !cmb && !gthPage ? control.closest("fieldset") : null;
    const legend = fieldset?.querySelector(":scope > legend");
    const form = control.closest("form");
    const oneForm = form && document.querySelectorAll("form").length === 1;
    const sectionName = cms?.name || cmb?.name || gth?.name
      || (gthPage ? "" : M.normalize(legend?.textContent)
        || (form?.id ? `form:${form.id}` : oneForm ? "form:single" : ""));
    let rowContext = "none";
    if (cms) {
      const row = control.closest(".form-cell-inner");
      if (row) {
        const rows = [...cms.element.querySelectorAll(":scope > .form-cell-right > .form-cell-inner")];
        rowContext = rows.length === 1 && rows[0] === row ? "single" : "multiple";
      }
    } else {
      const repeat = control.closest("[data-repeat-kind]");
      if (repeat) {
        const peers = [...document.querySelectorAll("[data-repeat-kind]")]
          .filter((item) => item.getAttribute("data-repeat-kind") === repeat.getAttribute("data-repeat-kind"));
        rowContext = peers.length === 1 && peers[0] === repeat ? "single" : "multiple";
      }
    }
    return { sectionName, rowContext };
  }

  const LEGACY_STABLE_CUSTOM_QUESTIONS = new Set([
    "民族", "政治面貌", "证件类型", "生源地", "是否参加过正式工作"
  ]);

  function repeatedCustomQuestion(question) {
    const normalize=value=>M.normalize(String(value??'').normalize('NFKC'));
    const targets = new Set();
    for (const item of document.querySelectorAll(".ant-form-item")) {
      const label = formItemQuestion(item);
      if (label && visible(label) && normalize(label.textContent) === question) targets.add(item);
    }
    for (const control of document.querySelectorAll("input,select,textarea")) {
      if (!visible(control) || control.closest(".ant-form-item")) continue;
      if (control instanceof HTMLInputElement && control.type === "radio") {
        const group = radioGroup(control);
        if (group.labels.some((label) => normalize(label) === question)) targets.add(group.token);
      } else if (labelTexts(control).some((label) => normalize(label) === question)) {
        targets.add(control);
      }
    }
    return targets.size > 1;
  }

  function confirmedCustomAnswer(profile, key, control) {
    let path = `customAnswers.${key}`;
    const normal=value=>M.normalize(String(value??'').normalize('NFKC')),question = normal(key);
    if (repeatedCustomQuestion(question)) return { path, reason: "ambiguous_profile_fact" };
    if (question === "获得时间" || question === "成绩") {
      return { path, reason: "section_requires_mapping" };
    }
    const matches = (profile.customFacts || []).filter((row) => normal(row?.question) === question),current=customQuestionScope(control);
    const identity=row=>{let url;try{url=new URL(row?.sitePageUrl);}catch{return '';}const page=url.origin+url.pathname;return ['https:','http:'].includes(url.protocol)&&(!['http:'].includes(url.protocol)||['localhost','127.0.0.1'].includes(url.hostname))&&!url.username&&!url.password&&page===row.sitePageUrl&&normal(row.sectionName)&&['none','single'].includes(row.rowContext)?JSON.stringify([page,normal(row.sectionName),row.rowContext,normal(row.question)]):'';};
    let saved;
    if(matches.length>1){
      if(matches.some(row=>!identity(row))||matches.some((row,index)=>matches.some((other,i)=>i!==index&&row.sitePageUrl===other.sitePageUrl&&normal(row.sectionName)===normal(other.sectionName))))return {path,reason:'ambiguous_profile_fact'};
      const scoped=matches.filter(row=>row.sitePageUrl===`${location.origin}${location.pathname}`&&normal(row.sectionName)===normal(current.sectionName)&&row.rowContext===current.rowContext);
      if(scoped.length!==1)return {path,reason:scoped.length?'ambiguous_profile_fact':'question_scope_mismatch'};saved=scoped[0];path='customScopedAnswers.'+encodeURIComponent(identity(saved));
    }else saved=matches[0];
    if(!saved)return {path,reason:'missing_profile_value'};
    if(matches.length===1)path=`customAnswers.${saved.question}`;
    const answer=String(saved.answer??'').trim();if(!answer)return {path,reason:'missing_profile_value'};
    if(!(profile.confirmedFields||[]).includes(path))return {path,reason:'unconfirmed_profile_value'};
    if (!saved?.sitePageUrl && !saved?.sectionName && !saved?.rowContext) {
      return LEGACY_STABLE_CUSTOM_QUESTIONS.has(question)
        ? { path, value: answer } : { path, reason: "question_scope_unconfirmed" };
    }
    if (!saved?.sitePageUrl || !saved?.sectionName || !saved?.rowContext) {
      return { path, reason: "question_scope_unconfirmed" };
    }
    if (saved.sitePageUrl !== `${location.origin}${location.pathname}`
      || normal(saved.sectionName) !== normal(current.sectionName)
      || saved.rowContext !== current.rowContext || current.rowContext === "multiple") {
      return { path, reason: "question_scope_mismatch" };
    }
    return { path, value: answer };
  }

  const CMS_SINGLE_SELECT_QUESTIONS = new Set(["民族", "政治面貌", "证件类型"]);
  const CMS_EDUCATION_SELECT_KEYS = { 学校: "school", 学历: "degree" };
  // These additional CMS questions have the same observed one-choice Ant v3
  // surface. They may use only a separately confirmed answer to the website's
  // exact question, never a similarly named general profile fact.
  const CMS_CUSTOM_SINGLE_SELECT_QUESTIONS = Object.fromEntries([
    ["个人基本信息必填", ["国籍/地区", "婚姻状况", "毕业院校", "学位", "学历",
      "期望面试地点（供参考，实际安排将根据笔试通过名单确定）"]],
    ["求职意向必填", ["期望工作性质", "期望年薪", "到岗时间"]],
    ["教育经历必填", ["学位", "专业排名"]],
    ["英语能力必填", ["英语证书名称", "成绩"]],
    ["获取的资格或通过的考试必填", ["证券从业资格考试", "注册会计师考试",
      "国家司法考试", "FRM", "CFA"]]
  ].map(([section, questions]) => [M.normalize(section), new Set(questions.map(M.normalize))]));

  function cmsScopedAcademicSelectSpec(selection) {
    if (`${location.origin}${location.pathname}` !== CMS_PHOTO_PAGE
      || !selection?.matches?.(".ant-select-selection--single") || !visible(selection)) return null;
    const section = cmsSection(selection),item = selection?.closest(".ant-form-item");
    const question = M.normalize(formItemQuestion(item)?.textContent);
    const aliases = {
      "个人基本信息必填|学位": "__cms_basic_academic_degree",
      "个人基本信息必填|学历": "__cms_basic_education_level",
      "教育经历必填|学位": "__cms_education_academic_degree"
    };
    const alias = aliases[`${section?.name}|${question}`];
    if (!alias || !item || selection.closest(".cascader-plugins-wrap")) return null;
    const rows = [...section.element.querySelectorAll(":scope > .form-cell-right > .form-cell-inner")],row = item.closest(".form-cell-inner");
    if (rows.length !== 1 || rows[0] !== row) return null;
    const peers = [...row.querySelectorAll(".ant-form-item")].filter(candidate => visible(candidate)
      && candidate.closest(".form-cell-inner") === row && M.normalize(formItemQuestion(candidate)?.textContent) === question);
    return peers.length === 1 && peers[0] === item ? {alias,question,sectionName:section.name,rowContext:"single"} : null;
  }

  function cmsScopedAcademicAnswer(profile, spec) {
    const path = `customAnswers.${spec.alias}`,value = String(profile.customAnswers?.[spec.alias] || "").trim();
    const facts = (profile.customFacts || []).filter(row => row.question === spec.alias);
    if (!value) return {path,reason:"missing_profile_value"};
    if (!(profile.confirmedFields || []).includes(path)) return {path,reason:"unconfirmed_profile_value"};
    if (facts.length !== 1) return {path,reason:"ambiguous_profile_fact"};
    const fact = facts[0];
    if (fact.answer !== value || fact.sitePageUrl !== CMS_PHOTO_PAGE || M.normalize(fact.sectionName) !== spec.sectionName
      || fact.rowContext !== spec.rowContext) return {path,reason:"question_scope_mismatch"};
    return cmsMappedOptionAnswer(profile,{path,value});
  }

  function cmsScopedSimpleInputSpec(control) {
    if (`${location.origin}${location.pathname}` !== CMS_PHOTO_PAGE
      || !(control instanceof HTMLInputElement) || control.type !== "text" || !visible(control)) return null;
    const section=cmsSection(control),item=control.closest(".ant-form-item"),question=M.normalize(formItemQuestion(item)?.textContent);
    const definitions={
      "个人基本信息必填|专业名称":{alias:"__cms_basic_major"},
      "个人基本信息必填|毕业时间":{alias:"__cms_basic_graduation_date",dateKey:"graduationDate"},
      "英语能力必填|获得时间":{alias:"__cms_english_certificate_date",dateKey:"certificateDate"}
    },definition=definitions[`${section?.name}|${question}`];
    if(!definition||!item)return null;
    const calendar=control.matches("input.ant-calendar-picker-input")&&!!control.closest(".ant-calendar-picker");
    if(!!definition.dateKey!==calendar||(!calendar&&(control.readOnly||control.closest(".ant-select,.ant-picker,.el-select"))))return null;
    const rows=[...section.element.querySelectorAll(":scope > .form-cell-right > .form-cell-inner")],row=item.closest(".form-cell-inner");
    if(rows.length!==1||rows[0]!==row)return null;
    const peers=[...row.querySelectorAll(".ant-form-item")].filter(candidate=>visible(candidate)&&candidate.closest(".form-cell-inner")===row
      &&M.normalize(formItemQuestion(candidate)?.textContent)===question);
    const controls=[...item.querySelectorAll("input")].filter(visible);
    return peers.length===1&&peers[0]===item&&controls.length===1&&controls[0]===control
      ?{...definition,question,sectionName:section.name,rowContext:"single"}:null;
  }

  // The row-C harvest confirms this wrapper and a plain text input, but no
  // widget internals. Tighten the existing custom-answer route rather than
  // infer an address from any general profile field or a changed control.
  function cmsBasicAddressBinding(control) {
    if (`${location.origin}${location.pathname}` !== CMS_PHOTO_PAGE) return null;
    const item = control.closest(".ant-form-item"), wrapperId = "11_51414234_0";
    const question = M.normalize(formItemQuestion(item)?.textContent);
    const wrapper = control.closest(`[id="${wrapperId}"]`);
    const addressLabel = labelTexts(control).some(label => M.normalize(label) === "联系地址")
      || [...(item?.querySelectorAll('.ant-form-item-label > label') || [])]
        .some(label => label.closest('.ant-form-item') === item && M.normalize(label.textContent) === "联系地址");
    if (question !== "联系地址" && !wrapper && !addressLabel
      && control.getAttribute("placeholder") !== "请填写联系地址") return null;
    const fail = reason => ({ reason });
    const section = cmsSection(control);
    if (!section || section.name !== "个人基本信息必填" || section.element.id !== "11"
      || document.querySelectorAll('[id="11"]').length !== 1)
      return fail("question_scope_mismatch");
    const rows = [...section.element.querySelectorAll(":scope > .form-cell-right > .form-cell-inner")];
    const row = control.closest(".form-cell-inner");
    if (rows.length !== 1 || rows[0] !== row) return fail("ambiguous_repeat_group");
    const peers = [...section.element.querySelectorAll(".ant-form-item")]
      .filter(candidate => M.normalize(formItemQuestion(candidate)?.textContent) === "联系地址");
    const wrappers = document.querySelectorAll(`[id="${wrapperId}"]`);
    if (peers.length > 1 || wrappers.length > 1) return fail("duplicate_target");
    if (peers.length !== 1 || peers[0] !== item || wrappers.length !== 1) return fail("field_changed");
    // The metadata records a wrapper ID, not whether that wrapper is the item,
    // inside it, or its immediate container. Bind the same item and input in
    // each case without manufacturing an unharvested markup relationship.
    const wrapperItem = wrapper?.closest(".ant-form-item");
    if (!wrapper || !wrapper.contains(control) || wrapper.closest(".form-cell-inner") !== row
      || (wrapperItem ? wrapperItem !== item : !wrapper.contains(item)
        || wrapper.querySelectorAll(".ant-form-item").length !== 1)
      || item.closest(".form-cell-inner") !== row || question !== "联系地址")
      return fail("field_changed");
    const widgets = ".ant-select,.ant-calendar-picker,.ant-picker,.cascader-plugins-wrap,.el-select,.el-cascader,.el-date-editor";
    const inputs = [...item.querySelectorAll("input,select,textarea")];
    const displayed = node => {
      if (!node || !visible(node)) return false;
      for (let current = node; current; current = current.parentElement) {
        const style = getComputedStyle(current);
        if (current.hidden || current.getAttribute("aria-hidden") === "true" || current.hasAttribute("inert")
          || style.display === "none" || ["hidden", "collapse"].includes(style.visibility)) return false;
      }
      return true;
    };
    if (!(control instanceof HTMLInputElement) || control.type !== "text"
      || control.readOnly || control.matches(":disabled")
      || control.closest("fieldset[disabled]") || !displayed(control) || !displayed(formItemQuestion(item))
      || control.getAttribute("placeholder") !== "请填写联系地址"
      || inputs.length !== 1 || inputs[0] !== control || item.querySelector(widgets)
      || control.closest(widgets)) return fail("custom_control_not_supported");
    return { question, sectionName: section.name, rowContext: "single" };
  }

  function cmsBasicAddressAnswer(profile, control, binding) {
    if (binding.reason) return { reason: binding.reason };
    const facts = (profile.customFacts || []).filter(fact => M.normalize(fact?.question) === binding.question);
    if (facts.length !== 1) return { reason: facts.length ? "ambiguous_profile_fact" : "missing_profile_value" };
    const fact = facts[0], path = `customAnswers.${fact.question}`;
    const answer = String(profile.customAnswers?.[fact.question] ?? "").trim();
    if (!answer) return { path, reason: "missing_profile_value" };
    if (String(fact.answer ?? "").trim() !== answer) return { path, reason: "question_scope_mismatch" };
    return confirmedCustomAnswer(profile, fact.question, control);
  }

  function cmsCustomSingleSelect(selection) {
    const item = selection?.closest(".ant-form-item");
    const section = cmsSection(item);
    const label = formItemQuestion(item);
    const question = M.normalize(label?.textContent);
    if (!section || !CMS_CUSTOM_SINGLE_SELECT_QUESTIONS[section.name]?.has(question)
      || selection.closest(".cascader-plugins-wrap")) return false;
    if (cmsScopedAcademicSelectSpec(selection)) return true;
    // A customAnswers key does not encode a section or row. If the same site
    // question appears twice, it cannot safely choose which field to answer.
    const peers = [...document.querySelectorAll(".form-cell .ant-form-item")]
      .filter((candidate) => {
        const own = formItemQuestion(candidate);
        return own && visible(own) && M.normalize(own.textContent) === question;
      });
    return peers.length === 1 && peers[0] === item;
  }

  function cmsExactCustomAnswer(profile, selection) {
    const label = formItemQuestion(selection.closest(".ant-form-item"));
    const rawQuestion = String(label?.textContent || "").replace(/\s+/g, " ").trim();
    const question = rawQuestion.replace(/[\s＊*？?]+$/gu, "").trim();
    return cmsMappedOptionAnswer(profile,customValue(profile,[rawQuestion,question],selection)||{reason:'missing_profile_value'});
  }

  function cmsAntV3Control(selection, allowOpenSearch = false) {
    if (location.hostname !== "wecruit.hotjob.cn" || !/^\/SU[^/]+\/pb\/resumeOperation\.html$/.test(location.pathname)) return false;
    if (!selection?.matches?.(".ant-select-selection.ant-select-selection--single")) return false;
    const item = selection.closest(".ant-form-item");
    const select = selection.closest(".ant-select");
    const question = formItemQuestion(item);
    // HTML inputs default to text even when the type attribute is absent.
    // The CMS Ant v3 search surface is uniquely identifiable by its DOM type,
    // not by the presence of an explicit type="text" attribute.
    const textInputs = [...(select?.querySelectorAll("input") || [])]
      .filter((input) => input.type === "text");
    const search = textInputs.length === 1 ? textInputs[0] : null;
    const sectionName = cmsSection(item)?.name;
    const questionName = M.normalize(question?.textContent);
    const supported = (sectionName === "个人基本信息必填"
      && CMS_SINGLE_SELECT_QUESTIONS.has(questionName))
      || (sectionName === "教育经历必填"
        && Object.hasOwn(CMS_EDUCATION_SELECT_KEYS, questionName))
      || cmsCustomSingleSelect(selection);
    return !!item && !!select && !!question && !!search
      && supported
      && !selection.closest(".cascader-plugins-wrap")
      && item.querySelectorAll(".ant-select").length === 1
      && !select.classList.contains("ant-select-disabled")
      && !search.disabled
      // Collection starts only from the closed, hidden-search state. After
      // our click, Ant v3 exposes that same input while the select is open.
      && (!visible(search) || (allowOpenSearch && select.classList.contains("ant-select-open")))
      && visible(selection);
  }

  function cmsAntV3InnerSearch(control) {
    return location.hostname === "wecruit.hotjob.cn"
      && /^\/SU[^/]+\/pb\/resumeOperation\.html$/.test(location.pathname)
      && control instanceof HTMLInputElement && control.type === "text"
      && !!control.closest(".ant-select .ant-select-selection.ant-select-selection--single");
  }

  function cmsSchoolSearchControl(selection, allowOpenSearch = false) {
    return `${location.origin}${location.pathname}` === CMS_PHOTO_PAGE
      && typeof globalThis.ResumeCmsSchoolSearch?.fillSchool === "function"
      && cmsAntV3Control(selection, allowOpenSearch)
      && ((cmsSection(selection)?.name === "教育经历必填"
        && M.normalize(formItemQuestion(selection.closest(".ant-form-item"))?.textContent) === "学校")
        || (cmsSection(selection)?.name === "个人基本信息必填"
        && M.normalize(formItemQuestion(selection.closest(".ant-form-item"))?.textContent) === "毕业院校"));
  }

  const CMS_REGION_QUESTIONS={
    '个人基本信息必填':new Set(['现居住地','籍贯']),
    '求职意向必填':new Set(['意向一期望工作地点','意向二期望工作地点']),
    '教育经历必填':new Set(['城市'])
  };
  // Same reason set as planCmsRegionFact. Unsettled or non-unique region facts
  // fail closed. This does not add selectors and does not Save.
  function settleUnresolvedEntry(entry, reason) {
    const closed=new Set(["region_fact_not_unique","region_fact_unconfirmed","region_fact_scope_mismatch",
      "explicit_region_pair_required","region_adapter_missing","unconfirmed_or_incomplete_region_pair"]);
    if (reason === "duplicate_target") return "failed";
    if (entry?.kind === "cms_region" && closed.has(reason)) return "failed";
    return "skipped";
  }
  const regionLabel=value=>String(value||'').normalize('NFKC').replace(/[＊*：:\s]/gu,'');
  function cmsRegionControl(wrap) {
    if(location.hostname!=='wecruit.hotjob.cn'||!/^\/SU[^/]+\/pb\/resumeOperation\.html$/.test(location.pathname)
      ||!wrap?.matches?.('.cascader-plugins-wrap')||!visible(wrap))return false;
    const item=wrap.closest('.ant-form-item'),section=cmsSection(wrap);
    const question=regionLabel(formItemQuestion(item)?.textContent),sectionName=regionLabel(section?.name);
    if(!item||!CMS_REGION_QUESTIONS[sectionName]?.has(question)
      ||item.querySelectorAll('.cascader-plugins-wrap').length!==1)return false;
    const selects=[...wrap.querySelectorAll('.ant-select')].filter(node=>node.closest('.cascader-plugins-wrap')===wrap);
    return selects.length===2&&selects.every(select=>[...select.querySelectorAll('.ant-select-selection--single')].filter(visible).length===1);
  }
  function cmsRegionValues(wrap) {
    if(!cmsRegionControl(wrap))return null;
    const values=[...wrap.querySelectorAll('.ant-select')].filter(node=>node.closest('.cascader-plugins-wrap')===wrap)
      .map(select=>String(select.querySelector('.ant-select-selection-selected-value,.ant-select-selection-item')?.textContent||'').trim());
    return {province:values[0],city:values[1]};
  }
  function cmsCheckboxControl(group) {
    return `${location.origin}${location.pathname}` === CMS_PHOTO_PAGE
      && group?.matches?.(".ant-checkbox-group") && visible(group)
      && typeof globalThis.ResumeCmsCheckboxes?.inspectControl === "function"
      && !!globalThis.ResumeCmsCheckboxes.inspectControl(group);
  }

  function cmsBirthDateControl(control) {
    if (location.hostname !== "wecruit.hotjob.cn" || !/^\/SU[^/]+\/pb\/resumeOperation\.html$/.test(location.pathname)) return false;
    if (!(control instanceof HTMLInputElement) || !control.matches("input.ant-calendar-picker-input")
      || !control.closest(".ant-calendar-picker")) return false;
    const section = cmsSection(control);
    const item = control.closest(".ant-form-item");
    if (section?.name !== "个人基本信息必填" || !item
      || M.normalize(formItemQuestion(item)?.textContent) !== "出生日期") return false;
    const peers = [...section.element.querySelectorAll(".ant-form-item input.ant-calendar-picker-input")]
      .filter((input) => visible(input)
        && M.normalize(formItemQuestion(input.closest(".ant-form-item"))?.textContent) === "出生日期");
    return peers.length === 1 && peers[0] === control && visible(control);
  }

  function cmsEducationDateControl(control) {
    if (`${location.origin}${location.pathname}` !== CMS_PHOTO_PAGE
      || !(control instanceof HTMLInputElement) || !control.matches("input.ant-calendar-picker-input")
      || !control.closest(".ant-calendar-picker") || !visible(control)) return false;
    if(cmsScopedSimpleInputSpec(control)?.dateKey)return true;
    const section = cmsSection(control);
    if (section?.name !== "教育经历必填") return false;
    const question = M.normalize(formItemQuestion(control.closest(".ant-form-item"))?.textContent);
    const key = question === "开始时间" ? "startDate" : question === "结束时间" ? "endDate" : null;
    if (!key) return false;
    const decision = cmsDecision(control, key, section);
    return !decision.reason && decision.context?.kind === "education" && decision.context.index === 0;
  }

  function validDayDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month
      && date.getUTCDate() === day;
  }

  function cmsMappedOptionAnswer(profile, fact) {
    // The source fact must already be confirmed and scoped by its own matcher.
    // This adds only the applicant-reviewed wording shown by this employer.
    if (fact.reason || typeof fact.value !== "string" || !fact.value || !fact.path) return fact;
    // A shared recruitment host may serve many employers, so the tenant URL
    // prefix, source field and its exact current value all have to agree.
    const mappings = (Array.isArray(profile.siteOptionMappings) ? profile.siteOptionMappings : [])
      .flatMap((mapping, index) => {
      if (mapping?.fieldPath !== fact.path || mapping.sourceValue !== fact.value
        || !mapping.optionText || typeof mapping.siteUrlPrefix !== "string") return [];
      let prefix;
      try { prefix = new URL(mapping.siteUrlPrefix); } catch { return []; }
      if (prefix.protocol !== "https:" || prefix.username || prefix.password
        || prefix.search || prefix.hash || prefix.pathname === "/" || !prefix.pathname.endsWith("/")
        || prefix.origin !== location.origin || !location.pathname.startsWith(prefix.pathname)) return [];
      return [{ mapping, index }];
      });
    if (mappings.length > 1) return { path: fact.path, reason: "ambiguous_profile_fact" };
    if (!mappings.length) return fact;
    const { mapping, index } = mappings[0];
    const path = `siteOptionMappings.${index}.optionText`;
    return (profile.confirmedFields || []).includes(path)
      ? { path, value: mapping.optionText }
      : { path, reason: "unconfirmed_profile_value" };
  }

  function cmsAntV3Answer(profile, selection, key, context) {
    const academic = cmsScopedAcademicSelectSpec(selection);
    if (academic) return cmsScopedAcademicAnswer(profile, academic);
    if (cmsCustomSingleSelect(selection)) return cmsExactCustomAnswer(profile, selection);
    if (cmsSection(selection)?.name === "教育经历必填") {
      if (context?.kind !== "education" || context.index !== 0) {
        return { reason: "ambiguous_repeat_group" };
      }
      const fact = profileValue(profile, key, context);
      return key === "degree" || key === "school" ? cmsMappedOptionAnswer(profile, fact) : fact;
    }
    const question = M.normalize(formItemQuestion(selection.closest(".ant-form-item"))?.textContent);
    const matches = [...new Set((profile.customFacts||[]).map(row=>row.question).filter(key=>M.normalize(key)===question))].map(key=>[key]);
    if (matches.length !== 1) return { reason: matches.length ? "ambiguous_profile_fact" : "missing_profile_value" };
    const [customKey, raw] = matches[0];
    return confirmedCustomAnswer(profile, customKey, selection);
  }

  function cmsDecision(control, key, section) {
    if (!section) return {};
    const question = M.normalize(formItemQuestion(control.closest(".ant-form-item"))?.textContent);
    if (question === "获得时间" || question === "成绩") {
      return { reason: "section_requires_mapping" };
    }
    // 家庭关系必填 姓名 classifies as fullName and collided with 个人基本信息必填.
    if (key === "fullName" && section.name !== "个人基本信息必填") {
      return { reason: "section_requires_mapping" };
    }
    // 南粤 basic info shows both labels. Keep 移动电话; do not also bind 联系电话.
    if (section.name === "个人基本信息必填" && key === "phone" && question === "联系电话") {
      const mobile = [...section.element.querySelectorAll(".ant-form-item")].some((item) =>
        visible(item) && item.closest(".form-cell") === section.element
        && M.normalize(formItemQuestion(item)?.textContent) === "移动电话");
      if (mobile) return { reason: "section_requires_mapping" };
    }
    if (section.name === "自我评价必填" && question === "评价内容" && control instanceof HTMLTextAreaElement) {
      const peers = [...section.element.querySelectorAll("textarea")]
        .filter((item) => visible(item) && M.normalize(formItemQuestion(item.closest(".ant-form-item"))?.textContent) === "评价内容");
      return peers.length === 1 && peers[0] === control
        ? { key: "selfEvaluation" } : { reason: "ambiguous_repeat_group" };
    }
    if (section.name === "个人基本信息必填"
      && ((key === "major" && (question === "专业" || question === "专业名称"))
        || (key === "endDate" && question === "毕业时间"))) {
      return { reason: "section_requires_mapping" };
    }
    // One education row can show both 专业 and 专业名称. Both classify as major
    // and would share education.0.major (duplicate_target). Keep 专业名称.
    if (section.name === "教育经历必填" && key === "major" && question === "专业") {
      const right = section.element.querySelector(":scope > .form-cell-right");
      const rows = [...(right?.querySelectorAll(":scope > .form-cell-inner") || [])];
      const row = control.closest(".form-cell-inner");
      const named = rows.length === 1 && rows[0] === row && [...row.querySelectorAll(".ant-form-item")].some((item) =>
        visible(item) && item.closest(".form-cell-inner") === row
        && M.normalize(formItemQuestion(item)?.textContent) === "专业名称");
      if (named) return { reason: "section_requires_mapping" };
    }
    if (section.name === "教育经历必填"
      && control.matches?.(".ant-select-selection.ant-select-selection--single")
      && Object.hasOwn(CMS_EDUCATION_SELECT_KEYS, question)
      && CMS_EDUCATION_SELECT_KEYS[question] === key) {
      const right = section.element.querySelector(":scope > .form-cell-right");
      const rows = [...(right?.querySelectorAll(":scope > .form-cell-inner") || [])];
      const row = control.closest(".form-cell-inner");
      const peers = row ? [...row.querySelectorAll(".ant-form-item .ant-select-selection--single")]
        .filter((item) => visible(item)
          && M.normalize(formItemQuestion(item.closest(".ant-form-item"))?.textContent) === question) : [];
      if (rows.length !== 1 || rows[0] !== row || peers.length !== 1 || peers[0] !== control) {
        return { reason: "ambiguous_repeat_group" };
      }
      const context = { kind: "education", index: 0 };
      // Only the explicitly scoped employer and installed search helper may
      // search. Other tenants and builds without the helper stay read-only.
      return key === "school" && !cmsSchoolSearchControl(control)
        ? { context, reason: "search_required" } : { context };
    }
    if (section.name !== "教育经历必填" || !(control instanceof HTMLInputElement)) return {};
    const isMajor = key === "major" && (question === "专业" || question === "专业名称")
      && !control.closest(".ant-calendar-picker");
    const isCalendarDate = ((key === "startDate" && question === "开始时间")
      || (key === "endDate" && question === "结束时间"))
      && !!control.closest(".ant-calendar-picker");
    if (!isMajor && !isCalendarDate) return {};

    // The observed CMS editor starts with one education row. Its first index
    // is certain only while that row has one matching question control.
    const right = section.element.querySelector(":scope > .form-cell-right");
    const rows = [...(right?.querySelectorAll(":scope > .form-cell-inner") || [])];
    const row = control.closest(".form-cell-inner");
    const peers = row ? [...row.querySelectorAll("input")]
      .filter((item) => visible(item)
        && M.normalize(formItemQuestion(item.closest(".ant-form-item"))?.textContent) === question
        && M.classify(labelTexts(item)).key === key) : [];
    if (rows.length !== 1 || rows[0] !== row || peers.length !== 1 || peers[0] !== control) {
      return { reason: "ambiguous_repeat_group" };
    }
    return { context: { kind: "education", index: 0 } };
  }

  function profileValue(profile, key, context) {
    const confirmed = new Set(profile.confirmedFields || []);
    let path = key;
    let raw;
    if (context) {
      const definition = REPEAT_KEYS[context.kind];
      const mapped = definition?.[key];
      if (!mapped) return { reason: "unmapped_repeat_field" };
      path = `${definition.collection}.${context.index}.${mapped}`;
      raw = profile[definition.collection]?.[context.index]?.[mapped];
    } else if (key === "fatherOccupation" || key === "motherOccupation") {
      const relation = key === "fatherOccupation" ? "父亲" : "母亲";
      const matches = (profile.familyMembers || []).map((item, index) => ({ item, index }))
        .filter(({ item }) => M.normalize(item.relation) === M.normalize(relation));
      if (matches.length > 1) return { reason: "ambiguous_profile_fact" };
      if (!matches.length || !matches[0].item.occupation) return { reason: "missing_profile_value" };
      if (!profile.familyDisclosureEnabled) return { reason: "sensitive_profile_disabled" };
      path = `familyMembers.${matches[0].index}.occupation`;
      raw = matches[0].item.occupation;
    } else if (key === "desiredRoles" || key === "desiredCities") {
      const values = (profile[key] || []).map((value, index) => ({ value, path: `${key}.${index}` }))
        .filter((item) => item.value && confirmed.has(item.path));
      if (!values.length) return { reason: (profile[key] || []).length ? "unconfirmed_profile_value" : "missing_profile_value", path: key };
      return { value: values.map((item) => item.value), path: key };
    } else {
      raw = profile[key];
    }
    if (raw === undefined || raw === null || String(raw).trim() === "") return { reason: "missing_profile_value", path };
    if (!confirmed.has(path)) return { reason: "unconfirmed_profile_value", path };
    const validation = M.validValue(key, raw);
    return validation.valid ? { value: validation.value, path } : { reason: validation.reason, path };
  }

  function semanticProfileValue(profile, path, context) {
    if (!M.isProfileKey(path)) return { reason: "unmapped_repeat_field" };
    if (path === "desiredRoles" || path === "desiredCities") return profileValue(profile, path);
    const parts = path.split(".");
    if (context && ["work", "internship"].includes(context.kind)) {
      const actual = M.normalize(profile.experience?.[context.index]?.type);
      const accepted = context.kind === "work" ? ["work", "工作", "工作经历"] : ["internship", "实习", "实习经历"];
      if (!accepted.includes(actual)) return { reason: "section_requires_mapping" };
    }
    let value = profile;
    for (const part of parts) {
      if (!value || !Object.hasOwn(value, part)) return { reason: "missing_profile_value" };
      value = value[part];
    }
    if (value == null || value === "") return { reason: "missing_profile_value" };
    if (!(profile.confirmedFields || []).includes(path)) return { reason: "unconfirmed_profile_value" };
    const checked = M.validValue(parts.at(-1), value);
    return checked.valid ? { value: checked.value } : { reason: checked.reason };
  }

  function fieldId(control, position) {
    return control.id || control.name || `${control.tagName.toLowerCase()}-${position}`;
  }

  function customValue(profile, labels, control) {
    const matching=labels.filter(label=>(profile.customFacts||[]).some(row=>M.normalize(String(row.question).normalize('NFKC'))===M.normalize(String(label).normalize('NFKC'))));
    if(new Set(matching.map(label=>M.normalize(String(label).normalize('NFKC')))).size>1)return {reason:'ambiguous_profile_fact'};
    for (const label of matching) {
      const path = `customAnswers.${label}`;
      if (/父亲|母亲|父母|监护人|家庭成员|家长/.test(label) && !profile.familyDisclosureEnabled) return { path, reason: "sensitive_profile_disabled" };
      return confirmedCustomAnswer(profile, label, control);
    }
    return null;
  }

  function radioGroup(control) {
    if (control.name) {
      const scope = control.form || document;
      const options = [...scope.querySelectorAll('input[type="radio"]')]
        .filter((item) => item.name === control.name);
      return { token: options[0] || control, options, labels: [control.closest("fieldset")?.querySelector("legend")?.textContent?.trim()].filter(Boolean) };
    }
    // Ant Design radios on the CMB form have no name or id. Their nearest
    // form item, rather than the empty name, is the only safe group boundary.
    const item = control.closest(".ant-form-item");
    if (!item) return { token: control, options: [control], labels: [] };
    const options = [...item.querySelectorAll('input[type="radio"]')]
      .filter((input) => !input.name && input.closest(".ant-form-item") === item && visible(input));
    const question = formItemQuestion(item);
    const labels = question ? [question.textContent.trim()].filter(Boolean) : [];
    return { token: options[0] || control, options, labels, antUnnamed: true };
  }

  function radioOptionLabel(option, antUnnamed) {
    if (antUnnamed) return option.closest("label.ant-radio-wrapper")?.textContent?.trim() || "";
    return option.labels?.[0]?.textContent?.trim() || option.value;
  }
  function cmsAssignmentRadioControl(control) {
    if(`${location.origin}${location.pathname}`!==CMS_PHOTO_PAGE||!(control instanceof HTMLInputElement)
      ||control.type!=="radio"||control.name||!visible(control))return false;
    const item=control.closest(".ant-form-item"),section=cmsSection(control),question=M.normalize(formItemQuestion(item)?.textContent);
    if(section?.name!=="求职意向必填"||question!=="期望工作地是否服从分配")return false;
    const rows=[...section.element.querySelectorAll(":scope > .form-cell-right > .form-cell-inner")],row=item.closest(".form-cell-inner");
    const peers=[...section.element.querySelectorAll(".ant-form-item")].filter(node=>visible(node)&&M.normalize(formItemQuestion(node)?.textContent)===question);
    const options=[...item.querySelectorAll('input[type="radio"]')].filter(node=>node.closest(".ant-form-item")===item&&visible(node));
    return rows.length===1&&rows[0]===row&&peers.length===1&&peers[0]===item&&options.length===2
      &&options.every(node=>!node.name&&!node.disabled&&!!node.closest("label.ant-radio-wrapper"))
      &&JSON.stringify(options.map(node=>M.normalize(radioOptionLabel(node,true))).sort())===JSON.stringify(["否","是"].sort());
  }

  function datePartPlaceholder(option) {
    const label = String(option.textContent || '').normalize('NFKC').trim().toLowerCase();
    const value = String(option.value).normalize('NFKC').trim().toLowerCase();
    const part = /^(?:年|year|yyyy|-{2,})$/u.test(label) ? 'year'
      : /^(?:月|month|mm)$/u.test(label) ? 'month' : /^(?:日|day|dd)$/u.test(label) ? 'day' : null;
    if (!part || !['', '-1', '0', label].includes(value)) return false;
    const choices = [...option.closest('select').options].filter(node => node !== option
      && !node.disabled && !node.closest('optgroup[disabled]'));
    const pattern = part === 'year' ? /^\d{4}$/u : /^\d{1,2}$/u;
    const display = part === 'year' ? /^(\d{4})年?$/u : part === 'month' ? /^(\d{1,2})月?$/u : /^(\d{1,2})日?$/u;
    return choices.length > 0 && choices.every(node => {
      const code = node.value.normalize('NFKC').trim(), text = node.textContent.normalize('NFKC').trim().match(display);
      return pattern.test(code) && text && Number(code) === Number(text[1])
        && Number(code) >= (part === 'year' ? 1900 : 1) && Number(code) <= (part === 'year' ? 2100 : part === 'month' ? 12 : 31);
    });
  }

  function meaningfulCurrent(control, radioOptions = null, antUnnamed = false) {
    if (richtextControl(control)) return richtextValue(control);
    if(cmsCheckboxControl(control)) {
      const selected=globalThis.ResumeCmsCheckboxes.inspectControl(control)?.selected;
      return selected?.length?JSON.stringify(selected):'';
    }
    if(cmsRegionControl(control)) {
      const pair=cmsRegionValues(control);return pair.province||pair.city?JSON.stringify(pair):'';
    }
    if (control instanceof HTMLInputElement && control.type === "file") return control.files?.[0]?.name || "";
    if (control instanceof HTMLInputElement && control.type === "radio") {
      const checked = (radioOptions || radioGroup(control).options).find((item) => item.checked);
      return checked ? antUnnamed ? radioOptionLabel(checked, true) : checked.value : "";
    }
    if (antSelectControl(control)) return control.closest(".ant-select")?.querySelector(".ant-select-selection-item")?.textContent?.trim() || "";
    if (control.matches?.(".ant-select-selection--single")) {
      return control.querySelector(".ant-select-selection-selected-value")?.textContent?.trim() || "";
    }
    if (control instanceof HTMLSelectElement) {
      const chosen = control.selectedOptions[0];
      if (!chosen || chosen.disabled || !chosen.value) return "";
      if (datePartPlaceholder(chosen)) return "";
      if (["请选择", "选择", "请选", "select"].includes(M.normalize(chosen.textContent))) return "";
      return chosen.textContent.trim();
    }
    return control.value;
  }

  function acceptsAttachment(control, attachment) {
    const tokens = String(control.accept || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
    if (!tokens.length) return true;
    const name = String(attachment.name || "").toLowerCase();
    const type = String(attachment.type || "").toLowerCase();
    return tokens.some((token) => token.startsWith(".") ? name.endsWith(token)
      : token.endsWith("/*") ? type.startsWith(token.slice(0, -1))
      : !!type && type === token);
  }

  function controlConstraint(control, answer, confirmedWidget = false) {
    if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)) return null;
    // A readonly widget display is eligible only after MAIN has confirmed the
    // registered component version and a writable model. Its adapter owns all
    // effects; it never reaches the native setter in the opt-in route.
    if (confirmedWidget) return null;
    if (cmsBirthDateControl(control) || cmsEducationDateControl(control)) {
      // Once this unique CMS date control already contains a value, it is a
      // readback target rather than a date-entry target. Ant may remove its
      // readonly attribute after selection; accept a valid confirmed answer
      // for comparison, while publicEntry still blocks a different value.
      if (validDayDate(answer) && String(control.value || "").trim()) return null;
      const adapter = cmsEducationDateControl(control) ? globalThis.ResumeCmsEducationDates?.fillEducationDate
        : globalThis.ResumeCmsDatePicker?.fillBirthDate;
      if (!adapter || !control.readOnly || control.disabled)
        return "readonly_control";
      if (/^\d{4}-\d{2}$/.test(String(answer ?? ""))) return "date_precision_insufficient";
      return validDayDate(answer) ? null : "invalid_profile_value";
    }
    // Ant DatePicker may remove readonly after its calendar has been opened.
    // Its input still belongs to a framework-controlled date widget and must
    // not be filled as an ordinary text box until a calendar adapter is proven.
    if (control instanceof HTMLInputElement && control.closest('.ant-picker,.ant-calendar-picker')) return "readonly_control";
    // Element UI can similarly flip readOnly after a menu or calendar opens.
    // Its native input is only a display surface; changing its value directly
    // would not prove that the framework accepted a date or choice.
    if (control instanceof HTMLInputElement && control.closest('.el-date-editor,.el-select,.el-cascader,.cascader-wrap')) return "readonly_control";
    if (antDegreeControl(control) || cmbAntV4Control(control)) return null;
    if (control.readOnly) return "readonly_control";
    if (Array.isArray(answer)) return null;
    const value = String(answer ?? "");
    if (control instanceof HTMLInputElement) {
      if (control.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "format_not_supported";
      if (control.type === "month" && !/^\d{4}-\d{2}$/.test(value)) return "format_not_supported";
      if ((control.type === "number" || control.inputMode === "numeric") && !/^\d+(\.\d+)?$/.test(value)) return "format_not_supported";
    }
    if (control.maxLength >= 0 && value.length > control.maxLength) return "value_too_long";
    return null;
  }

  function collect(profile, attachment = null, trialScope = null) {
    // A trial root is resolved before any classification/current-value read.
    // All ordinary callers keep the existing document-wide collection path.
    const query = selector => trialScope
      ? [...(trialScope.wrapper.matches(selector) ? [trialScope.wrapper] : []), ...trialScope.wrapper.querySelectorAll(selector)]
      : [...document.querySelectorAll(selector)];
    const radioGroups = new Set();
    // Rich text can enter only through MAIN's confirmed, opt-in L1 claim.
    // It has no legacy native-setter path.
    const controls = query('input,select,textarea,iframe,[contenteditable]').filter((control) => {
      if (atsControlPeers.has(control)) return false;
      if (richtextControl(control) && atsControlTargets.get(control)?.type !== 'richtext') return false;
      if (!visible(control, atsControlTargets.has(control))) return false;
      // An opened but unsupported Ant v3 select exposes its inner text input.
      // It is never a standalone answer field, even when this select itself
      // cannot yet be mapped safely.
      if (cmsAntV3InnerSearch(control)) return false;
      if (control instanceof HTMLInputElement && control.type === "checkbox"
        && cmsCheckboxControl(control.closest(".ant-checkbox-group"))) return false;
      if (control instanceof HTMLInputElement && control.type === "radio") {
        const token = radioGroup(control).token;
        if (radioGroups.has(token)) return false;
        radioGroups.add(token);
      }
      return true;
    });
    // Observe only the top-level surface; never read a frame's document/window.
    // A challenge without a visible input still needs a manual placeholder.
    controls.push(...query(MANUAL_CONTROL_SELECTOR).filter(control => visible(control)
      && !controls.some(candidate => control.contains(candidate))
      && !control.parentElement?.closest(MANUAL_CONTROL_SELECTOR)));
    const cmsControls = query(".ant-form-item .ant-select-selection--single")
      .filter(cmsAntV3Control);
    const regionControls=query('.cascader-plugins-wrap').filter(cmsRegionControl);
    const checkboxControls=query('.ant-checkbox-group').filter(cmsCheckboxControl);
    const entries = [...controls, ...cmsControls,...regionControls,...checkboxControls].map((control, position) => {
      if (manualControlReason(control)) return manualControlEntry(control, position);
      const radio = control instanceof HTMLInputElement && control.type === "radio";
      const group = radio ? radioGroup(control) : null;
      const radioOptions = group?.options || null;
      const labels = radio ? group.labels : labelTexts(control);
      const section = namedSection(control);
      const legacyMatch = M.classify(labels);
      const explicitRepeat = repeatContext(control);
      const questionScope = customQuestionScope(control);
      const semanticSection = questionScope.sectionName.startsWith("form:") ? "" : questionScope.sectionName;
      const fieldSection = semanticSection || explicitRepeat?.kind || "";
      const semantic = M.resolveAtsField({ hostname: location.hostname, labels,
        section: fieldSection, index: explicitRepeat?.index ?? null });
      let mappingContext = null;
      try {
        mappingContext = globalThis.ResumeDomainMemory?.fieldMetadata({ labels, section: fieldSection,
          index: explicitRepeat?.index ?? null, kind: radio ? "radio" : control.tagName.toLowerCase(),
          options: radio ? radioOptions.map(item => radioOptionLabel(item, !!group?.antUnnamed))
            : control instanceof HTMLSelectElement ? [...control.options].map(option => option.textContent) : [] });
      } catch { /* Oversized or absent labels are not eligible for memory. */ }
      const remembered = semantic.status === "manual" && semantic.reason !== "ambiguous_label"
        && mappingContext ? globalThis.ResumeDomainMemory?.lookup(fieldMemorySnapshot, mappingContext) : null;
      const match = legacyMatch.key ? legacyMatch : semantic.status === "mapped"
        ? { key: semantic.key, reason: semantic.reason } : legacyMatch;
      const dedicatedRecordKind = cmsDedicatedRecordKind(control);
      const cms = cmsDecision(control, match.key, cmsSection(control));
      const cmsRegion=cmsRegionControl(control);
      const cmsCheckbox=cmsCheckboxControl(control);
      const key = cmsCheckbox?'checkbox_group':cmsRegion?'region':cms.key || match.key;
      const decision = sectionDecision(control, key, section, repeatContext(control));
      const context = dedicatedRecordKind ? undefined : cms.context || decision.context;
      const degreeSelect = antDegreeControl(control);
      const cmbSelect = cmbAntV4Control(control);
      const cmsSelect = cmsAntV3Control(control);
      const cmsSchool = cmsSchoolSearchControl(control);
      const cmsBirthDate = cmsBirthDateControl(control);
      const cmsEducationDate = cmsEducationDateControl(control);
      const cmsAcademic = cmsScopedAcademicSelectSpec(control);
      const cmsSimple = cmsScopedSimpleInputSpec(control);
      const cmsAssignment = cmsAssignmentRadioControl(control);
      const cmsBasicAddress = cmsBasicAddressBinding(control);
      // Repeated unbound selects (e.g. education 学历 behind a row gate) must
      // not share a label-only ID. Confirmed paths still drive collision checks.
      const result = { id: cmsSimple ? `cms-scoped-input-${cmsSimple.alias}` : cmsCheckbox ? 'cms-checkbox-research-scoped' : cmsAcademic ? `cms-academic-${cmsAcademic.alias}` : cmsSelect ? (control.id || `cms-ant-v3-${M.normalize(labels[0])}-${position}`) : fieldId(control, position), labels, kind: cmsCheckbox?'cms_checkbox_group':cmsRegion?'cms_region':radio ? "radio" : degreeSelect ? "ant_degree_select" : cmbSelect ? "cmb_ant_v4_select" : cmsSchool ? "cms_school_search" : cmsSelect ? "cms_ant_v3_select" : cmsBirthDate ? "cms_birth_date" : cmsEducationDate ? "cms_education_date" : antSelectControl(control) ? "ant_select" : control.tagName.toLowerCase(), key, context, scope: questionScope, control, radioOptions, antUnnamedRadio: !!group?.antUnnamed };
      result.atsProfile = semantic.atsProfile;
      // Only ordinary controls offer a manual mapping; dedicated record flows
      // retain their source binding and never learn from their fill results.
      if (!dedicatedRecordKind && !cmsSection(control) && !degreeSelect && !cmbSelect && !antSelectControl(control)
        && !cmsSelect && !cmsRegion && !cmsCheckbox && mappingContext && control.type !== "file") result.mappingContext = mappingContext;
      if (cmsBasicAddress) {
        result.cmsBasicAddress = true;
        const value = cmsBasicAddressAnswer(profile, control, cmsBasicAddress);
        result.path = value.path; result.answer = value.value; result.reason = value.reason || "ready";
      } else if (dedicatedRecordKind) {
        result.dedicatedRecordKind = dedicatedRecordKind;
        const question = M.normalize(formItemQuestion(control.closest(".ant-form-item"))?.textContent);
        result.reason = CMS_DEDICATED_RECORD_QUESTIONS[dedicatedRecordKind].has(question)
          ? "cms_record_requires_explicit_binding" : "cms_record_field_not_supported";
      } else if(cmsCheckbox) {
        const value=globalThis.ResumeCmsCheckboxes.resolveFact(profile,control);
        result.path=value.path;result.checkboxFact=value.fact;
        result.answer=value.ok?JSON.stringify(value.fact.answers.map(exactOptionText).sort()):undefined;
        result.reason=value.ok?'ready':value.reason||'explicit_checkbox_array_required';
      } else if(cmsRegion) {
        const helper=globalThis.ResumeCmsRegion;
        const value=typeof helper?.resolveFact==='function'&&typeof helper?.fillRegion==='function'
          ?helper.resolveFact(profile,control):{ok:false,reason:'region_adapter_missing'};
        result.path=value.path;result.regionFact=value.fact;
        result.answer=value.ok?JSON.stringify({province:value.fact.province,city:value.fact.city}):undefined;
        result.reason=value.ok?'ready':value.reason||'explicit_region_pair_required';
      } else if (cmsSelect) {
        const value = cms.reason === "search_required"
          ? cmsAntV3Answer(profile, control, key, context)
          : cms.reason ? { reason: cms.reason } : cmsAntV3Answer(profile, control, key, context);
        result.path = value.path;
        result.answer = cms.reason ? undefined : value.value;
        result.reason = value.reason || cms.reason || "ready";
      } else if (cmbSelect) {
        const question = formItemQuestion(control.closest(".ant-form-item"))?.textContent.trim();
        const value = customValue(profile, [question], control);
        result.path = value?.path;
        result.answer = value?.value;
        result.reason = value?.reason || (value ? "ready" : "missing_profile_value");
      } else if (antSelectControl(control) && !degreeSelect && atsControlTargets.get(control)?.type !== 'multi-select') {
        result.reason = "custom_select_not_supported";
      } else if(cmsSimple) {
        const value=cmsScopedAcademicAnswer(profile,cmsSimple);
        result.path=value.path;result.answer=value.value;result.reason=value.reason||"ready";
      } else if(cmsAssignment) {
        const value=cmsExactCustomAnswer(profile,control);
        result.path=value.path;result.answer=value.value;result.reason=value.reason||"ready";
      } else if (cms.reason || decision.reason) {
        result.reason = cms.reason || decision.reason;
      } else if (control instanceof HTMLInputElement && control.type === "file") {
        const resumeQuestion = labels.some((label) => /简历/.test(label));
        result.path = resumeQuestion ? "sessionAttachment" : undefined;
        result.answer = resumeQuestion ? attachment?.name : undefined;
        result.reason = !resumeQuestion || !(attachment?.base64?.length || attachment?.bytes?.length || attachment?.size > 0) ? "file_requires_user_selection"
          : acceptsAttachment(control, attachment) ? "ready" : "attachment_type_not_accepted";
      } else if (!labels.length) {
        result.reason = "unlabelled_field";
      } else if (legacyMatch.reason === "ambiguous_label"
        || (fieldSection && !cmsSection(control) && semantic.status === "manual" && !remembered)) {
        result.reason = legacyMatch.reason === "ambiguous_label" ? "ambiguous_label" : semantic.reason;
        result.semanticStatus = "manual";
      } else if ((semantic.status === "mapped" && (!legacyMatch.key || semantic.context)) || remembered) {
        const path = remembered?.profileKey || semantic.profileKey;
        const rememberedKind = remembered ? M.sectionKind(mappingContext.section) : null;
        const semanticContext = remembered && ["work", "internship", "education", "project"].includes(rememberedKind)
          ? { kind: rememberedKind, index: mappingContext.index } : semantic.context;
        const value = semanticProfileValue(profile, path, semanticContext);
        result.path = path; result.answer = value.value; result.reason = value.reason || "ready";
        result.semanticSource = remembered ? "confirmed_domain_mapping" : semantic.reason;
      } else if (!key) {
        const custom = customValue(profile, labels, control);
        result.path = custom?.path;
        result.answer = custom?.value;
        result.reason = custom?.reason || (custom ? "ready" : match.reason);
        if (!custom) result.semanticStatus = "manual";
      } else {
        let value = profileValue(profile, key, context);
        if (value.reason === "missing_profile_value") value = customValue(profile, labels, control) || value;
        result.path = value.path;
        result.answer = value.value;
        result.reason = value.reason || "ready";
        if (result.reason === "ready" && !(control instanceof HTMLSelectElement)
          && atsControlTargets.get(control)?.type !== 'multi-select' && Array.isArray(result.answer) && result.answer.length !== 1) {
          result.reason = "multiple_profile_values";
        }
      }
      if (result.reason === "ready" && group?.antUnnamed
        && !(cmsAssignment&&/^(?:customAnswers|customScopedAnswers)\./u.test(String(result.path||''))&&["是","否"].includes(M.normalize(result.answer)))
        && (key !== "gender" || result.path !== "gender" || !["男", "女"].includes(M.normalize(result.answer)))) {
        result.reason = "invalid_profile_value";
      }
      if (result.reason === "ready" && (control instanceof HTMLSelectElement || radio)) {
        const options = radio ? radioOptions.map((item) => ({ label: radioOptionLabel(item, !!group?.antUnnamed), value: group?.antUnnamed ? "" : item.value, disabled: item.disabled }))
          : [...control.options].map(option => ({ label: option.label, value: option.value,
            disabled: option.disabled || !!option.closest('optgroup[disabled]') || datePartPlaceholder(option) }));
        const selection = M.selectOption(options, result.answer);
        result.optionIndex = selection.index;
        if (selection.index < 0) { result.reason = selection.reason; result.semanticStatus = "manual"; }
      }
      if (result.reason === 'ready' && proseControl(control) && typeof result.path === 'string' && (profile.confirmedFields || []).includes(result.path)) {
        // Validation may trim a scalar for ordinary inputs. Prose consumes the
        // original confirmed string, including its spaces and terminal lines.
        const raw = result.path.startsWith('customAnswers.') ? profile.customAnswers?.[result.path.slice(14)]
          : result.path.split('.').reduce((value, part) => value != null && Object.hasOwn(value, part) ? value[part] : undefined, profile);
        if (typeof raw === 'string') result.answer = raw;
      }
      if (result.reason === "ready") result.reason = controlConstraint(control, result.answer, atsControlTargets.has(control)) || "ready";
      if (["unconfirmed_profile_value", "unlabelled_field"].includes(result.reason)) result.semanticStatus = "manual";
      return result;
    });
    markDuplicateTargets(entries);
    return entries;
  }

  function markDuplicateTargets(entries) {
    const paths = new Map();
    for (const entry of entries) {
      if (entry.reason !== "ready" || !entry.path) continue;
      const matches = paths.get(entry.path) || [];
      matches.push(entry);
      paths.set(entry.path, matches);
    }
    for (const matches of paths.values()) {
      if (matches.length > 1) for (const entry of matches) entry.reason = "duplicate_target";
    }
    return entries;
  }

  function publicEntry(entry) {
    if (manualControlReason(entry.control)) {
      const { control, ...manual } = manualControlEntry(entry.control, 0);
      return { ...manual, id: entry.id, currentValue: "" };
    }
    const { control, answer, radioOptions, antUnnamedRadio,regionFact,checkboxFact,cmsBasicAddress, ...plain } = entry;
    plain.currentValue = meaningfulCurrent(control, radioOptions, antUnnamedRadio);
    // Search text is not a selected chip. MAIN's array model and rendered tags
    // decide preservation and readback for an explicitly claimed multi-select.
    if (atsControlTargets.get(control)?.type === 'multi-select') return plain;
    if(entry.kind==='cms_checkbox_group') {
      const selected=globalThis.ResumeCmsCheckboxes.inspectControl(control)?.selected,
        desired=checkboxFact?.answers?.map(exactOptionText).sort();
      if(plain.reason==='ready'&&(!selected||!desired||selected.some(value=>!desired.includes(value))))plain.reason='existing_value';
      return plain;
    }
    if(entry.kind==='cms_region') {
      const pair=cmsRegionValues(control);
      if(plain.reason==='ready'&&(!pair||['province','city'].some(key=>pair[key]
        &&exactOptionText(pair[key])!==exactOptionText(regionFact?.[key]))))plain.reason='existing_value';
      return plain;
    }
    const answers = Array.isArray(answer) ? answer : [answer];
    const same = plain.kind === "ant_degree_select" || plain.kind === "cmb_ant_v4_select"
      || plain.kind === "cms_ant_v3_select" || plain.kind === "cms_school_search"
      ? (left, right) => exactOptionText(left) === exactOptionText(right)
      : proseControl(control) ? (left, right) => proseValue(left) === proseValue(right)
        : (left, right) => M.normalize(left) === M.normalize(right);
    const matchesCurrent = control instanceof HTMLSelectElement
      ? control.selectedIndex === entry.optionIndex
      : answers.some((value) => same(plain.currentValue, value));
    if (plain.reason === "ready" && plain.currentValue && !matchesCurrent) {
      plain.reason = "existing_value";
    }
    return plain;
  }

  const CMS_PHOTO_SLOTS = {
    basic: { section: "个人基本信息必填", question: "照片" },
    portrait: { section: "个人照片必填", question: "个人照片" }
  };

  function exactCmsPhotoPage() {
    return `${location.origin}${location.pathname}` === CMS_PHOTO_PAGE;
  }

  function cmsPhotoSlot(item) {
    if (!exactCmsPhotoPage() || !item?.matches?.(".ant-form-item")) return null;
    const section = item.closest(".form-cell");
    const heading = section?.querySelector(":scope > .tit-wrap .tit");
    const label = formItemQuestion(item);
    if (!heading || !label || !visible(label)) return null;
    return Object.entries(CMS_PHOTO_SLOTS).find(([, target]) =>
      M.normalize(heading.textContent) === M.normalize(target.section)
      && M.normalize(label.textContent) === M.normalize(target.question))?.[0] || null;
  }

  function cmsPhotoTarget(slot) {
    if (!exactCmsPhotoPage() || !CMS_PHOTO_SLOTS[slot]) return { reason: "photo_target_changed" };
    const items = [...document.querySelectorAll("form .ant-form-item")]
      .filter((item) => cmsPhotoSlot(item) === slot);
    if (items.length !== 1) return { reason: items.length ? "duplicate_target" : "photo_target_changed" };
    const item = items[0];
    const inputs = [...item.querySelectorAll('input[type="file"]')]
      .filter((input) => input.closest(".ant-form-item") === item);
    if (inputs.length !== 1 || inputs[0].disabled || inputs[0].multiple)
      return { reason: "photo_target_changed" };
    return { item, input: inputs[0] };
  }

  function cmsPhotoPresent(item, input) {
    return !!input.files?.length || !!item.querySelector(
      ".ant-upload-list-item,.ant-upload-list-item-done,.ant-upload-list-item-thumbnail");
  }

  function cmsPhotoAccepts(input, photo) {
    const tokens = String(input.accept || "").toLowerCase().split(",")
      .map((token) => token.trim()).filter(Boolean);
    if (!tokens.length) return true;
    const rawType = String(photo.type || "").toLowerCase();
    const type = rawType === "image/x-ms-bmp" ? "image/bmp" : rawType;
    const name = String(photo.name || "").toLowerCase();
    return tokens.some((token) => token.startsWith(".") ? name.endsWith(token)
      : token.endsWith("/*") ? type.startsWith(token.slice(0, -1))
        : type === token);
  }

  async function cmsPhotoFile(photo) {
    if (!photo || typeof photo !== "object" || !photo.base64
      || typeof photo.name !== "string" || typeof photo.type !== "string") return null;
    if (photo.base64.length > 7_000_000 || !Number.isInteger(photo.size)
      || photo.size <= 0 || photo.size > 5 * 1024 * 1024) return null;
    const types = {
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
      gif: "image/gif", bmp: "image/bmp"
    };
    const extension = /\.([a-z]+)$/i.exec(photo.name)?.[1]?.toLowerCase();
    const expected = types[extension];
    if (!expected || (photo.type !== expected
      && !(extension === "bmp" && photo.type === "image/x-ms-bmp"))) return null;
    let bytes;
    try { bytes = Uint8Array.from(atob(photo.base64), (char) => char.charCodeAt(0)); }
    catch { return null; }
    if (bytes.length !== photo.size) return null;
    const png = extension === "png" && bytes.length >= 8
      && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
    const jpeg = ["jpg", "jpeg"].includes(extension) && bytes.length >= 4
      && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217;
    const gif = extension === "gif" && bytes.length >= 6
      && ["GIF87a", "GIF89a"].includes(String.fromCharCode(...bytes.slice(0, 6)));
    const bmp = extension === "bmp" && bytes.length >= 2 && bytes[0] === 66 && bytes[1] === 77;
    if (!png && !jpeg && !gif && !bmp) return null;
    let bitmap;
    try {
      bitmap = await createImageBitmap(new Blob([bytes], { type: photo.type }));
      if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 20_000_000) return null;
    } catch { return null; }
    finally { bitmap?.close(); }
    return new File([bytes], photo.name, { type: photo.type,
      lastModified: Number.isFinite(photo.lastModified) ? photo.lastModified : Date.now() });
  }

  async function fillCmsPhotos(photoUploads) {
    if (!exactCmsPhotoPage()) return [];
    const rows = [];let previousUploadUnverified=false;
    for (const [slot, target] of Object.entries(CMS_PHOTO_SLOTS)) {
      requireVisibleFillPage();
      const row = { id: `cms-photo-${slot}`, labels: [target.question], kind: "file",
        key: null, path: `sessionPhoto.${slot}`, currentValue: "",
        status: "skipped", reason: "photo_requires_selection" };
      rows.push(row);
      const found = cmsPhotoTarget(slot);
      if (found.reason) { row.reason = found.reason; continue; }
      const { item, input } = found;
      if (cmsPhotoPresent(item, input)) { row.reason = "photo_existing_value"; continue; }
      const photo = photoUploads?.[slot];
      if (!photo) continue;
      if(previousUploadUnverified){row.reason="previous_upload_unverified";continue;}
      if (!cmsPhotoAccepts(input, photo)) { row.reason = "photo_site_accept_rejected"; continue; }
      const file = await cmsPhotoFile(photo);
      if (!file) { row.reason = "photo_file_invalid"; continue; }
      try {
        requireVisibleFillPage();
        const live = cmsPhotoTarget(slot);
        if (live.reason || live.item !== item || live.input !== input || cmsPhotoPresent(item, input)) {
          row.reason = "photo_target_changed"; continue;
        }
        const transfer = new DataTransfer();
        transfer.items.add(file);
        await checkProfileWrite(); input.files = transfer.files;
        const assigned = input.files?.[0];
        const original = new Uint8Array(await file.arrayBuffer());
        const assignedBytes = assigned ? new Uint8Array(await assigned.arrayBuffer()) : null;
        if (input.files?.length !== 1 || assigned?.name !== file.name || assigned?.type !== file.type
          || !assignedBytes || assignedBytes.length !== original.length
          || !assignedBytes.every((byte, index) => byte === original[index])) {
          row.status = "failed"; row.reason = "photo_upload_unverified"; continue;
        }
        const pageHref = location.href, pageOrigin = performance.timeOrigin;
        row.fileAssignedBytesVerified = true;
        const beforeInput = cmsPhotoTarget(slot);
        if (beforeInput.reason || beforeInput.item !== item || beforeInput.input !== input || input.files?.[0] !== assigned) {
          row.status = "failed"; row.reason = "photo_target_changed"; continue;
        }
        await checkProfileWrite(); input.dispatchEvent(new Event("input", { bubbles: true }));
        requireVisibleFillPage();
        const beforeChange = cmsPhotoTarget(slot);
        row.nativeInputConnectedBeforeChange = input.isConnected;
        if (beforeChange.reason || beforeChange.item !== item || beforeChange.input !== input || !input.isConnected) {
          row.status = "failed"; row.reason = "photo_target_changed"; continue;
        }
        // rc-upload consumes this FileList once and replaces the native input
        // with a new key. Never dispatch to that replacement or refill it.
        await checkProfileWrite(); input.dispatchEvent(new Event("change", { bubbles: true }));
        row.changeEventsDispatched = 1;
        let complete = false;
        for (let attempt = 0; attempt < 80; attempt += 1) {
          requireVisibleFillPage();
          const liveTarget = cmsPhotoTarget(slot);
          if (!exactCmsPhotoPage() || location.href !== pageHref || performance.timeOrigin !== pageOrigin
            || !item.isConnected || liveTarget.reason || liveTarget.item !== item) break;
          if (item.querySelector(".ant-upload-list-item-error")) break;
          const done = [...item.querySelectorAll(".ant-upload-list-item-done")]
            .filter((node) => node.closest(".ant-form-item") === item);
          const names = done.length === 1 ? [...done[0].querySelectorAll(".ant-upload-list-item-name")] : [];
          if (names.length === 1 && names[0].textContent.trim() === file.name
            && (!names[0].getAttribute("title") || names[0].getAttribute("title") === file.name)) {
            complete = true; break;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        const current = cmsPhotoTarget(slot);
        const sameTarget = !current.reason && current.item === item && location.href === pageHref
          && performance.timeOrigin === pageOrigin;
        const selected = sameTarget ? current.input.files?.[0] : null;
        const bytes = selected ? new Uint8Array(await selected.arrayBuffer()) : null;
        const sameBytes = bytes && bytes.length === original.length
          && bytes.every((byte, index) => byte === original[index]);
        row.nativeInputReplaced = sameTarget && current.input !== input;
        row.nativeFileListConsumed = sameTarget && current.input.files?.length === 0;
        const retainedFileMatches = selected?.name === file.name && selected?.type === file.type && sameBytes;
        if (complete && sameTarget && (row.nativeFileListConsumed || retainedFileMatches)) {
          row.status = "verified";
          row.reason = "photo_upload_widget_verified";
        } else {
          row.status = "failed";
          row.reason = "photo_upload_unverified";
        }
      } catch (error) { if(/^profile_[a-z_]+$/u.test(error?.message||''))throw error;
        if (error?.message === PAGE_HIDDEN_DURING_FILL) throw error;
        row.status = "failed";
        row.reason = "control_error";
      } finally {
        if(row.status==="failed")previousUploadUnverified=true;
      }
    }
    return rows;
  }

  function cmsUncollectedQuestions(entries, photoRows = null) {
    const collectedItems = new Set(entries.map((entry) => entry.control.closest(".ant-form-item")).filter(Boolean));
    return [...document.querySelectorAll(".ant-form-item")].flatMap((item, index) => {
      if (collectedItems.has(item) || !cmsSection(item)) return [];
      const photoSlot = cmsPhotoSlot(item);
      if (photoRows && photoSlot) return [];
      const label = formItemQuestion(item);
      const file = !!item.querySelector('input[type="file"],.ant-upload');
      if (!label || (!file && !visible(label))) return [];
      return [{ id: photoSlot ? `cms-photo-${photoSlot}` : `cms-uncollected-${index}`,
        labels: [label.textContent.replace(/\s+/g, " ").trim()],
        kind: file ? "file" : "custom_control", key: null, currentValue: "",
        reason: photoSlot ? "photo_requires_selection"
          : file ? "file_requires_user_selection" : "custom_control_not_supported",
        status: "skipped" }];
    });
  }

  function currentValidationGaps() {
    try { return globalThis.ResumeCmsValidationGaps?.scan?.() || null; }
    catch { return null; } // Optional read-only panel must never interrupt inspection or filling.
  }

  function inspect(profile, attachment) {
    const entries = collect(profile, attachment);
    const validationGaps = currentValidationGaps();
    return { url: location.href, title: document.title,
      fields: [...entries.map(publicEntry), ...cmsUncollectedQuestions(entries)],
      entry: globalThis.ResumeFormFlow?.inspect() || null,
      navigation: globalThis.ResumeFormFlow?.navigation?.inspect() || null,
      ...(validationGaps ? { validationGaps } : {}) };
  }

  function setNativeValue(control, value) {
    requireVisibleFillPage();
    const proto = control instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(control, value);
    else control.value = value;
    requireVisibleFillPage();
    control.dispatchEvent(new Event("input", { bubbles: true }));
    requireVisibleFillPage();
    control.dispatchEvent(new Event("change", { bubbles: true }));
    requireVisibleFillPage();
    control.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function currentDegreeControl(original) {
    if (original.isConnected && antDegreeControl(original)) return original;
    const matches = [...document.querySelectorAll('form .item-box input[type="search"][role="combobox"]')]
      .filter(antDegreeControl);
    return matches.length === 1 ? matches[0] : null;
  }

  function currentCmbAntV4Control(original, entry) {
    const sameTarget = (control) => cmbAntV4Control(control, true)
      && M.normalize(formItemQuestion(control.closest(".ant-form-item"))?.textContent)
        === M.normalize(entry.labels[0]);
    if (original.isConnected && sameTarget(original)) return original;
    const matches = [...document.querySelectorAll('form .item-box input[type="search"][role="combobox"]')]
      .filter(sameTarget);
    return matches.length === 1 ? matches[0] : null;
  }

  function dropdownOptions(control) {
    const listId = control.getAttribute("aria-controls");
    const list = listId && document.getElementById(listId);
    const dropdown = list?.closest(".ant-select-dropdown") || list;
    if (!dropdown || !dropdown.getClientRects().length || getComputedStyle(dropdown).visibility === "hidden") return null;
    const rendered = [...dropdown.querySelectorAll(".ant-select-item-option")];
    const options = rendered.length ? rendered : [...dropdown.querySelectorAll('[role="option"]')];
    return options.filter((item) => item.getClientRects().length && getComputedStyle(item).visibility !== "hidden");
  }

  function closeAntDropdown(control) {
    control.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
    control.blur();
  }

  function visibleAntV4Dropdowns() {
    return [...document.querySelectorAll(".ant-select-dropdown")]
      .filter((item) => visible(item) && !item.classList.contains("ant-select-dropdown-hidden"));
  }

  async function waitForAntV4DropdownClose(control, openedDropdown) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      requireVisibleFillPage();
      const open = visibleAntV4Dropdowns();
      if (!open.length) return true;
      if (open.length !== 1 || open[0] !== openedDropdown) return false;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    requireVisibleFillPage();
    if (visibleAntV4Dropdowns().length === 1 && visibleAntV4Dropdowns()[0] === openedDropdown) {
      closeAntDropdown(control);
    }
    for (let attempt = 0; attempt < 10; attempt += 1) {
      requireVisibleFillPage();
      if (!visibleAntV4Dropdowns().length) return true;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    return !visibleAntV4Dropdowns().length;
  }

  async function fillAntDegreeSelect(entry, answer, currentControl = currentDegreeControl) {
    let control = currentControl(entry.control, entry);
    let openedByThisFill = false;
    try {
    if (!control) return { status: "skipped", reason: "field_changed" };
    const current = meaningfulCurrent(control);
    if (current) return exactOptionText(current) === exactOptionText(answer)
      ? { status: "verified", reason: "preexisting_same_value" }
      : { status: "skipped", reason: "existing_value" };

    if (visibleAntV4Dropdowns().length) return { status: "skipped", reason: "control_error" };
    requireVisibleFillPage();
    await checkProfileWrite(); control.closest(".ant-select")?.querySelector(".ant-select-selector")?.click();
    openedByThisFill = true;
    let options = null;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      requireVisibleFillPage();
      control = currentControl(entry.control, entry);
      if (!control) return { status: "skipped", reason: "field_changed" };
      options = dropdownOptions(control);
      if (options?.length) break;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    if (!options?.length) {
      closeAntDropdown(control);
      return { status: "failed", reason: "control_error", detail: "选项列表未出现" };
    }
    const openedDropdown = options[0].closest(".ant-select-dropdown");
    if (!openedDropdown || visibleAntV4Dropdowns().length !== 1
      || visibleAntV4Dropdowns()[0] !== openedDropdown) {
      closeAntDropdown(control);
      return { status: "failed", reason: "control_error", detail: "选项列表不唯一" };
    }

    const matches = options.filter((option) => {
      if (option.getAttribute("aria-disabled") === "true" || option.classList.contains("ant-select-item-option-disabled") || option.disabled) return false;
      const label = option.querySelector(".ant-select-item-option-content")?.textContent || option.textContent;
      return exactOptionText(label) === exactOptionText(answer);
    });
    if (matches.length !== 1) {
      closeAntDropdown(control);
      if (!await waitForAntV4DropdownClose(control, openedDropdown)) {
        return { status: "failed", reason: "control_error", detail: "选项列表未关闭" };
      }
      return { status: "skipped", reason: matches.length ? "ambiguous_option" : "option_not_found" };
    }

    requireVisibleFillPage();
    await checkProfileWrite(); matches[0].click();
    for (let attempt = 0; attempt < 30; attempt += 1) {
      requireVisibleFillPage();
      control = currentControl(entry.control, entry);
      if (!control) return { status: "failed", reason: "field_changed" };
      if (exactOptionText(meaningfulCurrent(control)) === exactOptionText(answer)) {
        if (!await waitForAntV4DropdownClose(control, openedDropdown)) {
          return { status: "failed", reason: "control_error", detail: "选项列表未关闭" };
        }
        return { status: "verified", reason: "readback_matched" };
      }
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    closeAntDropdown(control);
    return { status: "failed", reason: "readback_mismatch" };
    } catch (error) { if(/^profile_[a-z_]+$/u.test(error?.message||''))throw error;
      if (error?.message === PAGE_HIDDEN_DURING_FILL && openedByThisFill) {
        try { closeAntDropdown(control || entry.control); } catch { /* Best-effort menu cleanup. */ }
      }
      throw error;
    }
  }

  function currentCmsAntV3Control(entry) {
    const sameTarget = (item) => cmsAntV3Control(item, true)
      && M.normalize(formItemQuestion(item.closest(".ant-form-item"))?.textContent)
        === M.normalize(entry.labels[0])
      && (!String(entry.id || "").startsWith("cms-academic-__cms_")
        || (cmsScopedAcademicSelectSpec(item)?.sectionName === M.normalize(entry.scope?.sectionName)
          && cmsScopedAcademicSelectSpec(item)?.rowContext === entry.scope?.rowContext))
      && (!entry.context || (entry.context.kind === "education"
        && cmsDecision(item, entry.key, cmsSection(item)).context?.index === entry.context.index));
    if (entry.control.isConnected && sameTarget(entry.control)) return entry.control;
    const matches = [...document.querySelectorAll(".ant-form-item .ant-select-selection--single")]
      .filter(sameTarget);
    return matches.length === 1 ? matches[0] : null;
  }

  function cmsAntV3DropdownOptions(selection) {
    const linkedId = selection.getAttribute("aria-controls");
    const linked = linkedId ? document.getElementById(linkedId) : null;
    const visibleDropdowns = [...document.querySelectorAll(".ant-select-dropdown")]
      .filter((item) => visible(item) && !item.classList.contains("ant-select-dropdown-hidden"));
    const dropdown = linked?.closest(".ant-select-dropdown") || (visibleDropdowns.length === 1 ? visibleDropdowns[0] : null);
    if (!dropdown || !visibleDropdowns.includes(dropdown)) return null;
    return [...dropdown.querySelectorAll(".ant-select-dropdown-menu-item")]
      .filter((item) => visible(item));
  }

  function closeCmsAntV3Dropdown(selection) {
    const inputs = [...(selection?.closest(".ant-select")?.querySelectorAll("input") || [])]
      .filter((input) => input.type === "text");
    const search = inputs.length === 1 ? inputs[0] : null;
    if (search) {
      const escape = new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true });
      // Ant v3 handles the legacy key code on the inner search input.
      Object.defineProperties(escape, {
        keyCode: { get: () => 27 },
        which: { get: () => 27 }
      });
      search.dispatchEvent(escape);
      search.blur();
    }
    selection?.blur();
    if ([...document.querySelectorAll(".ant-select-dropdown")]
      .some((item) => visible(item) && !item.classList.contains("ant-select-dropdown-hidden"))) {
      for (const type of ["mousedown", "mouseup", "click"]) {
        document.body.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
      }
    }
  }

  function visibleCmsAntV3Dropdowns() {
    return [...document.querySelectorAll(".ant-select-dropdown")]
      .filter((item) => visible(item) && !item.classList.contains("ant-select-dropdown-hidden"));
  }

  function visibleCmsCalendarPortals() {
    return [...document.querySelectorAll(".ant-calendar-picker-container")]
      .filter((item) => visible(item) && !item.classList.contains("ant-calendar-picker-container-hidden"));
  }

  async function waitForCmsAntV3DropdownClose(selection, openedDropdown) {
    // Ant v3 can render the selected label before its portal disappears. The
    // next field must not be opened while the previous menu is still visible.
    for (let attempt = 0; attempt < 20; attempt += 1) {
      requireVisibleFillPage();
      const open = visibleCmsAntV3Dropdowns();
      if (!open.length) return true;
      if (open.length !== 1 || open[0] !== openedDropdown) return false;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    requireVisibleFillPage();
    // Close only the same menu opened by this selection. A different visible
    // portal may belong to the user or another control and must be left alone.
    const remaining = visibleCmsAntV3Dropdowns();
    if (remaining.length === 1 && remaining[0] === openedDropdown) {
      closeCmsAntV3Dropdown(selection);
    }
    for (let attempt = 0; attempt < 10; attempt += 1) {
      requireVisibleFillPage();
      if (!visibleCmsAntV3Dropdowns().length) return true;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    return !visibleCmsAntV3Dropdowns().length;
  }

  async function fillCmsAntV3Select(entry, answer) {
    let selection = currentCmsAntV3Control(entry);
    let openedByThisFill = false;
    try {
    if (!selection) return { status: "skipped", reason: "field_changed" };
    const current = meaningfulCurrent(selection);
    if (current) return exactOptionText(current) === exactOptionText(answer)
      ? { status: "verified", reason: "preexisting_same_value" }
      : { status: "skipped", reason: "existing_value" };

    // Only one visible portal can be attributed to this click if Ant supplies
    // no aria-controls relation. Do not choose from someone else's menu.
    if ([...document.querySelectorAll(".ant-select-dropdown")]
      .some((item) => visible(item) && !item.classList.contains("ant-select-dropdown-hidden"))) {
      return { status: "skipped", reason: "control_error" };
    }
    requireVisibleFillPage();
    await checkProfileWrite(); selection.click();
    openedByThisFill = true;
    const openedSelection = selection;
    let options = null;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      requireVisibleFillPage();
      selection = currentCmsAntV3Control(entry);
      if (!selection) {
        closeCmsAntV3Dropdown(openedSelection);
        return { status: "failed", reason: "field_changed" };
      }
      options = cmsAntV3DropdownOptions(selection);
      if (options?.length) break;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    if (!options?.length) {
      const openedDropdown = visibleCmsAntV3Dropdowns()[0] || null;
      closeCmsAntV3Dropdown(selection);
      if (openedDropdown && !await waitForCmsAntV3DropdownClose(selection, openedDropdown)) {
        return { status: "failed", reason: "control_error", detail: "选项列表未关闭" };
      }
      return { status: "failed", reason: "control_error", detail: "选项列表未出现" };
    }
    const matches = options.filter((option) => {
      if (option.getAttribute("aria-disabled") === "true" || option.classList.contains("ant-select-dropdown-menu-item-disabled")) return false;
      return exactOptionText(option.textContent) === exactOptionText(answer);
    });
    if (matches.length !== 1) {
      const openedDropdown = options[0].closest(".ant-select-dropdown");
      closeCmsAntV3Dropdown(selection);
      if (!await waitForCmsAntV3DropdownClose(selection, openedDropdown)) {
        return { status: "failed", reason: "control_error", detail: "选项列表未关闭" };
      }
      return { status: "skipped", reason: matches.length ? "ambiguous_option" : "option_not_found" };
    }
    const openedDropdown = matches[0].closest(".ant-select-dropdown");
    requireVisibleFillPage();
    await checkProfileWrite(); matches[0].click();
    for (let attempt = 0; attempt < 30; attempt += 1) {
      requireVisibleFillPage();
      selection = currentCmsAntV3Control(entry);
      if (!selection) {
        closeCmsAntV3Dropdown(openedSelection);
        return { status: "failed", reason: "field_changed" };
      }
      if (exactOptionText(meaningfulCurrent(selection)) === exactOptionText(answer)) {
        if (!await waitForCmsAntV3DropdownClose(selection, openedDropdown)) {
          return { status: "failed", reason: "control_error", detail: "选项列表未关闭" };
        }
        selection = currentCmsAntV3Control(entry);
        return selection && exactOptionText(meaningfulCurrent(selection)) === exactOptionText(answer)
          ? { status: "verified", reason: "readback_matched" }
          : { status: "failed", reason: "readback_mismatch" };
      }
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    closeCmsAntV3Dropdown(selection);
    return { status: "failed", reason: "readback_mismatch" };
    } catch (error) { if(/^profile_[a-z_]+$/u.test(error?.message||''))throw error;
      if (error?.message === PAGE_HIDDEN_DURING_FILL && openedByThisFill) {
        try { closeCmsAntV3Dropdown(selection || entry.control); } catch { /* Best-effort menu cleanup. */ }
      }
      throw error;
    }
  }

  function attachmentBytes(attachment) {
    let bytes;
    if (typeof attachment?.base64 === "string") {
      if (attachment.base64.length > 7_000_000) throw new Error("附件消息过大，请选择较小文件。");
      const binary = atob(attachment.base64);
      bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    } else if (Array.isArray(attachment?.bytes)) {
      bytes = new Uint8Array(attachment.bytes);
    } else {
      throw new Error("附件内容未到达页面，请重新选择文件。");
    }
    if (!bytes.length || bytes.length > 5 * 1024 * 1024 || (attachment.size != null && attachment.size !== bytes.length)) {
      throw new Error("附件大小核对失败，请重新选择文件。");
    }
    return bytes;
  }

  async function ensureRepeatRows(profile) {
    const issues = [];
    for (const kind of ["education", "project"]) {
      if (kind === "education" && location.origin + location.pathname === CMS_PHOTO_PAGE
        && document.querySelector('form .form-cell[id="14"]')) continue;
      const collection = REPEAT_KEYS[kind].collection;
      const confirmed = new Set(profile.confirmedFields || []);
      const target = Math.min((profile[collection] || []).reduce((highest, row, index) =>
        Object.entries(row).some(([field, value]) => value && confirmed.has(`${collection}.${index}.${field}`)) ? index + 1 : highest, 0), 8);
      let rows = document.querySelectorAll(`[data-repeat-kind="${kind}"]`).length;
      while (rows < target) {
        requireVisibleFillPage();
        const matches = [...document.querySelectorAll(`[data-add-repeat="${kind}"]`)];
        const button = matches.length === 1 ? matches[0] : null;
        if (!(button instanceof HTMLButtonElement)
          || button.getAttribute("type")?.toLowerCase() !== "button"
          || button.hasAttribute("formaction") || button.disabled || !visible(button)) {
          issues.push({ id: `repeat-add-${kind}`, labels: [kind === "education" ? "教育经历加行" : "项目经历加行"],
            kind: "repeat_add_button", path: null, status: "skipped", reason: "custom_control_not_supported", currentValue: "" });
          break;
        }
        requireVisibleFillPage();
        await checkProfileWrite(); button.click();
        await new Promise((resolve) => setTimeout(resolve, 100));
        requireVisibleFillPage();
        const next = document.querySelectorAll(`[data-repeat-kind="${kind}"]`).length;
        if (next <= rows) {
          issues.push({ id: `repeat-add-${kind}`, labels: [kind === "education" ? "教育经历加行" : "项目经历加行"],
            kind: "repeat_add_button", path: null, status: "skipped", reason: "custom_control_not_supported", currentValue: "" });
          break;
        }
        rows = next;
      }
    }
    return issues;
  }

  function logicalEntryKey(entry) {
    return entry.path ? `path:${entry.path}` : `field:${JSON.stringify([entry.id, entry.kind, entry.labels.map(M.normalize)])}`;
  }

  function entrySignature(entry) {
    // Frameworks can regenerate an input id while preserving the same
    // question. A confirmed profile path supplies the stable identity;
    // fields without one still need their DOM id to distinguish them.
    return JSON.stringify([entry.path ? null : entry.id, entry.kind, entry.labels.map(M.normalize)]);
  }

  function entryScope(control) {
    return control.form || control.closest("form") || document.body;
  }

  function answerMatches(entry, attachment) {
    const control = entry.control;
    if (!control.isConnected) return false;
    if(entry.kind==='cms_checkbox_group')return !!entry.checkboxFact
      && meaningfulCurrent(control)===JSON.stringify(entry.checkboxFact.answers.map(exactOptionText).sort());
    if(entry.kind==='cms_region') {
      const pair=cmsRegionValues(control);
      return !!pair&&!!entry.regionFact&&['province','city'].every(key=>exactOptionText(pair[key])===exactOptionText(entry.regionFact[key]));
    }
    const answer = Array.isArray(entry.answer) ? entry.answer[0] : entry.answer;
    if (entry.kind === "ant_degree_select" || entry.kind === "cmb_ant_v4_select"
      || entry.kind === "cms_ant_v3_select" || entry.kind === "cms_school_search") {
      return exactOptionText(meaningfulCurrent(control)) === exactOptionText(answer);
    }
    if (control instanceof HTMLInputElement && control.type === "file") {
      const selected = control.files?.[0];
      return !!selected && selected.name === attachment?.name && selected.size === attachment?.size;
    }
    if (entry.kind === "radio") return !!entry.radioOptions?.[entry.optionIndex]?.checked;
    if (control instanceof HTMLSelectElement) {
      const chosen = control.selectedOptions[0];
      return !!chosen && M.selectOption([chosen], entry.answer).index === 0;
    }
    return proseControl(control) ? proseValue(meaningfulCurrent(control)) === proseValue(answer) : control.value === String(answer);
  }


  const CMS_ROW_D_TRIAL_SPECS=Object.freeze({
    expectedWorkNature:Object.freeze({wrapper:'13_43_0',kind:'cms_ant_v3_select',question:'期望工作性质'}),
    researchInterests:Object.freeze({wrapper:'13_102501_0',kind:'cms_checkbox_group',
      question:'如应聘研究发展中心行业研究类岗位请勾选（建议仅勾选3~5项）'})
  });
  // Public static option labels from the R7 provenance fixture; no defaults.
  const CMS_ROW_D_RESEARCH_OPTIONS=['非研究类岗位，不涉及','宏观','策略','债券','银行','非银行金融','房地产',
    '量化','基金评价','金属及材料（有色金属）','化工','交通运输','生物医药','汽车','机械','军工',
    '电力设备及新能源','建材','食品饮料','轻工纺服','纺服化妆品','农林牧渔','家电',
    '商业（零售+社会服务）','电子','传媒','通信','计算机','中小盘','环保及公用事业','煤炭开采','智库研究'];
  function cmsRowDTrialScope(spec) {
    const fail=()=>{throw Error('trial_scope_changed');};
    if(location.href!==CMS_PHOTO_PAGE||(document.designMode||'off').toLowerCase()!=='off')fail();
    const sections=[...document.querySelectorAll('[id="13"]')],wrappers=[...document.querySelectorAll(`[id="${spec.wrapper}"]`)];
    if(sections.length!==1||wrappers.length!==1)fail();
    const section=sections[0],wrapper=wrappers[0];
    const editable=node=>{for(let current=node;current;current=current.parentElement){
      const value=current.getAttribute('contenteditable');if(value!==null&&value.toLowerCase()!=='false')return true;
    }return false;};
    // Static labels are read only after the complete editable ancestry boundary.
    if(editable(section)||[...section.querySelectorAll('[contenteditable]')].some(editable))fail();
    // The reused CMS parser checks shell headings and duplicate question labels
    // globally. These may supply only static metadata, never editable text.
    const staticLabels=[...document.querySelectorAll('.form-cell > .tit-wrap .tit,.ant-form-item-label > label')];
    const liveMetadata='input,select,textarea,button,[role="combobox"],.ant-select-selection-selected-value,.ant-select-selection-item';
    if(staticLabels.some(node=>editable(node)||[...node.querySelectorAll('[contenteditable]')].some(editable)
      ||node.matches(liveMetadata)||node.querySelector(liveMetadata)))fail();
    // confirmedCustomAnswer -> repeatedCustomQuestion may otherwise follow
    // arbitrary global aria-labelledby/near-label/fieldset legend references.
    // Preserve that real parser, but refuse its generic outside-control branch
    // structurally before it can read another field's current display text.
    if([...document.querySelectorAll('input,select,textarea')].some(node=>visible(node)&&!node.closest('.ant-form-item')))fail();
    const items=[...new Set([wrapper.closest('.ant-form-item'),...wrapper.querySelectorAll('.ant-form-item')].filter(Boolean))];
    if(items.length!==1)fail();
    const item=items[0],form=item.closest('form'),row=item.closest('.form-cell-inner');
    const rows=[...section.querySelectorAll(':scope > .form-cell-right > .form-cell-inner')];
    const labels=[...item.querySelectorAll('.ant-form-item-label > label')].filter(label=>label.closest('.ant-form-item')===item);
    if(!form||wrapper.closest('.form-cell')!==section||item.closest('.form-cell')!==section
      ||rows.length!==1||rows[0]!==row||labels.length!==1||M.normalize(labels[0].textContent)!==M.normalize(spec.question)
      ||M.normalize(section.querySelector(':scope > .tit-wrap .tit')?.textContent)!==M.normalize('求职意向必填'))fail();
    const selector=spec.kind==='cms_checkbox_group'?'.ant-checkbox-group':'.ant-select-selection--single';
    const controls=[...(wrapper.matches(selector)?[wrapper]:[]),...wrapper.querySelectorAll(selector)];
    if(controls.length!==1)fail();
    const control=controls[0];
    for(let node=control;node&&node!==section;node=node.parentElement){
      const id=node.getAttribute('id')||'';if(/^\d+_\d+_\d+$/u.test(id)&&node!==wrapper)fail();
    }
    if(control.closest('.ant-form-item')!==item||!visible(control)||wrapper.querySelector('.ant-select-open,.cascader-plugins-wrap,.ant-calendar-picker,.ant-picker,button,textarea,select'))fail();
    const inputs=[...wrapper.querySelectorAll('input')];
    if(inputs.length!==(spec.kind==='cms_checkbox_group'?32:1)
      ||inputs.some(input=>input.disabled||input.closest('.ant-form-item')!==item)
      ||control.closest('[inert],[aria-disabled="true"],fieldset[disabled]'))fail();
    // Native inputs must be closed over this exact widget before collect can
    // dispatch by type (notably radioGroup's document/form-wide legend path).
    if(spec.kind==='cms_checkbox_group') {
      if(inputs.some(input=>input.type!=='checkbox'||!control.contains(input)
        ||input.closest('.ant-checkbox-group')!==control))fail();
      const snapshot=globalThis.ResumeCmsCheckboxes?.inspectControl(control);
      if(!snapshot||snapshot.options.some((option,index)=>exactOptionText(option.text)!==exactOptionText(CMS_ROW_D_RESEARCH_OPTIONS[index])))fail();
    } else {
      const select=control.closest('.ant-select'),input=inputs[0];
      if(!select||!wrapper.contains(select)||wrapper.querySelectorAll('.ant-select').length!==1
        ||input.type!=='text'||visible(input)||!control.contains(input)
        ||input.closest('.ant-select-selection')!==control||input.closest('.ant-select')!==select)fail();
    }
    return {section,wrapper,item,form,row,label:labels[0],control};
  }
  async function cmsRowDPreexistingTrial(message) {
    const reject=reason=>{throw Error(reason);};
    const spec=CMS_ROW_D_TRIAL_SPECS[message.target],startUrl=location.href;
    if(!spec)reject('trial_request_invalid');
    if(location.href!==CMS_PHOTO_PAGE)reject('trial_wrong_page');
    if(globalThis.ResumeProfileWriteContext)reject('profile_write_context_busy');
    let interrupted=false,observer;
    const eventTypes=['click','input','change','focus','blur','focusin','focusout','submit'];
    const onEvent=()=>{interrupted=true;};
    const context={profileBinding:message.profileBinding,writeStarted:false,async check(write=true){
      if(write)reject('trial_write_forbidden');
      if(globalThis.ResumeProfileWriteContext!==context)reject('profile_write_context_changed');
      if(interrupted||location.href!==startUrl)reject('trial_interrupted');
      requireVisibleFillPage();
      let verdict;try{verdict=await chrome.runtime.sendMessage({type:'RESUME_PROFILE_BINDING_CHECK',profileBinding:message.profileBinding});}catch{}
      if(verdict?.allowed!==true)reject('profile_binding_changed');
      if(interrupted||location.href!==startUrl)reject('trial_interrupted');
      requireVisibleFillPage();
    }};
    const projection=async()=>{
      let reply;try{reply=await chrome.runtime.sendMessage({type:'RESUME_CMS_ROW_D_TRIAL_FACT',target:message.target,profileBinding:message.profileBinding});}catch{}
      if(reply?.allowed!==true)reject(/^profile_[a-z_]+$/u.test(reply?.reason||'')?reply.reason:'profile_trial_unavailable');
      const profile=reply.projection,path=`customAnswers.${spec.question}`;
      if(!profile||Object.keys(profile).sort().join('|')!=='confirmedFields|customAnswers|customFacts|schemaVersion'
        ||profile.schemaVersion!==1||!Array.isArray(profile.customFacts)||profile.customFacts.length!==1
        ||profile.customFacts[0]?.question!==spec.question||Object.keys(profile.customAnswers||{}).join('|')!==spec.question
        ||JSON.stringify(profile.confirmedFields)!==JSON.stringify([path]))reject('profile_trial_fact_invalid');
      return profile;
    };
    const entryAt=(profile,scope)=>{
      const entries=collect(profile,null,scope),entry=entries[0];
      if(entries.length!==1||entry.control!==scope.control||entry.kind!==spec.kind
        ||entry.path!==`customAnswers.${spec.question}`||entry.reason!=='ready')reject('trial_target_not_ready');
      if(spec.kind==='cms_ant_v3_select'&&!['全职','实习'].includes(String(entry.answer).trim()))reject('trial_target_not_ready');
      if(!meaningfulCurrent(entry.control))reject('trial_current_empty');
      // This is the product's actual comparison, before every mutation branch.
      if(!answerMatches(entry,null))reject('trial_current_not_equal');
      return entry;
    };
    globalThis.ResumeProfileWriteContext=context;
    for(const type of eventTypes)document.addEventListener(type,onEvent,true);
    try {
      await context.check(false);
      const profile=await projection();
      await context.check(false);
      if(interrupted||location.href!==startUrl)reject('trial_interrupted');
      requireVisibleFillPage();
      const scope=cmsRowDTrialScope(spec);
      observer=new MutationObserver(()=>{interrupted=true;});
      observer.observe(scope.section,{subtree:true,childList:true,attributes:true,characterData:true});
      const entry=entryAt(profile,scope),signature=entrySignature(entry),fact=JSON.stringify(profile);
      await context.check(false);
      const fresh=await projection();
      if(JSON.stringify(fresh)!==fact)reject('profile_binding_changed');
      await context.check(false);
      const liveScope=cmsRowDTrialScope(spec);
      if(Object.keys(scope).some(key=>scope[key]!==liveScope[key]))reject('trial_scope_changed');
      const live=entryAt(fresh,liveScope);
      if(entrySignature(live)!==signature||interrupted)reject('trial_interrupted');
      return {cmsRowDTrial:true,preexistingOnly:true,neverSave:true,target:message.target,status:'verified',reason:'preexisting_same_value',
        writeStarted:false,softwareClickedSave:false,softwareClickedSubmit:false,liveSupportClaimed:false,
        livePassClaimed:false,valuesExposed:false,adapterWriteVerified:false};
    } finally {
      observer?.disconnect();for(const type of eventTypes)document.removeEventListener(type,onEvent,true);
      if(globalThis.ResumeProfileWriteContext===context)delete globalThis.ResumeProfileWriteContext;
    }
  }

  async function fill(profile,attachment,photoUploads=null,profileBinding=null){
    if(globalThis.ResumeProfileWriteContext)throw Error('profile_write_context_busy');
    const context={profileBinding,writeStarted:false,async check(write=true){
      if(globalThis.ResumeProfileWriteContext!==context)throw Error('profile_write_context_changed');
      let verdict;try{verdict=await chrome.runtime.sendMessage({type:'RESUME_PROFILE_BINDING_CHECK',profileBinding});}catch{}
      if(verdict?.allowed!==true){const error=Error('profile_binding_changed');error.writeStarted=context.writeStarted;error.fillNotStarted=!context.writeStarted;throw error;}
      requireVisibleFillPage();if(write)context.writeStarted=true;
    }};
    globalThis.ResumeProfileWriteContext=context;
    try{await context.check(false);const result=await fillOwnedContent(profile,attachment,photoUploads);await context.check(false);return result;}
    finally{if(globalThis.ResumeProfileWriteContext===context)delete globalThis.ResumeProfileWriteContext;}
  }
  async function setBoundNativeValue(control,value,verifyTarget=null){
    const proto=control instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;
    await checkProfileWrite();requireVisibleFillPage();verifyTarget?.(false);requireWritableControl(control);if(setter)setter.call(control,value);else control.value=value;
    for(const type of ['input','change','blur']){await checkProfileWrite();requireVisibleFillPage();verifyTarget?.(true);requireWritableControl(control,true);control.dispatchEvent(new Event(type,{bubbles:true}));}
  }

  function atsControlSelector(control) {
    if (!control?.isConnected || control.getRootNode() !== document) throw Error('control_target_changed');
    const claimed = atsControlTargets.get(control);
    if (claimed?.type === 'multi-select') {
      const nodes = document.querySelectorAll(claimed.selector);
      if (nodes.length !== 1 || nodes[0] !== control) throw Error('control_target_changed');
      return claimed.selector;
    }
    if (control.id) {
      const selector = `#${CSS.escape(control.id)}`;
      if (document.querySelectorAll(selector).length === 1) return selector;
    }
    const parts = [];
    for (let node = control; node && node !== document.documentElement; node = node.parentElement) {
      const parent = node.parentElement;
      if (!parent) throw Error('control_target_changed');
      parts.unshift(`${node.tagName.toLowerCase()}:nth-child(${[...parent.children].indexOf(node) + 1})`);
    }
    const selector = ['html', ...parts].join(' > ');
    if (selector.length > 2048 || document.querySelectorAll(selector).length !== 1) throw Error('control_target_ambiguous');
    return selector;
  }

  async function fillAtsControl(entry, result) {
    const context = globalThis.ResumeProfileWriteContext;
    await context.check(false);
    const response = await chrome.runtime.sendMessage({ type: 'RESUME_ATS_CONTROL_WRITE',
      selector: atsControlSelector(entry.control), path: entry.path, value: entry.answer,
      profileBinding: context.profileBinding, timeOrigin: performance.timeOrigin });
    if (response?.writeStarted === true) context.writeStarted = true;
    await context.check(false);
    if (!response || response.liveSupportClaimed !== false) throw Error('control_result_invalid');
    result.adapter = response.adapter || null;
    result.adapterStatus = response.ok === true ? response.status : 'unsupported';
    result.status = response.ok === true && response.status === 'success' ? 'verified'
      : response.writeStarted === true || ['mismatch', 'reverted'].includes(response.status) ? 'failed' : 'skipped';
    result.reason = response.reason || 'control_write_failed';
    result.currentValue = meaningfulCurrent(entry.control, entry.radioOptions, entry.antUnnamedRadio);
    return response.readbackId;
  }

  async function verifyAtsControl(entry, result, readbackId) {
    const context = globalThis.ResumeProfileWriteContext;
    await context.check(false);
    const response = await chrome.runtime.sendMessage({ type: 'RESUME_ATS_CONTROL_VERIFY',
      selector: atsControlSelector(entry.control), path: entry.path, value: entry.answer, readbackId,
      profileBinding: context.profileBinding, timeOrigin: performance.timeOrigin });
    await context.check(false);
    // A transport acknowledgement or the earlier write cannot replace the
    // original plan's final model AND display verification in MAIN.
    if (response?.ok !== true || response.liveSupportClaimed !== false || response.writeStarted !== false
      || response.status !== 'success' || response.adapter !== result.adapter) {
      result.status = 'failed';
      result.adapterStatus = response?.ok === true ? response.status : 'unsupported';
      result.reason = response?.reason || 'control_readback_failed';
    }
  }

  async function fillOwnedContent(profile, attachment, photoUploads = null) {
    requireVisibleFillPage();
    // Absent/false is the legacy path. Enabling the experiment never turns an
    // unsupported L1 outcome into a second attempt through the old writer.
    const atsEngineWriteEnabled = typeof globalThis.chrome?.storage?.local?.get === 'function'
      && (await chrome.storage.local.get('resumeAtsEngineWriteEnabled')).resumeAtsEngineWriteEnabled === true;
    if (atsEngineWriteEnabled) await loadAtsControlTargets(true);
    else if (typeof atsControlTargets !== 'undefined') { atsControlTargets.clear(); atsControlPeers.clear(); }
    if (location.origin + location.pathname === CMS_PHOTO_PAGE) {
      const session = typeof globalThis.ResumeCmsSession?.check === "function"
        ? await globalThis.ResumeCmsSession.check() : null;
      if (session?.authenticated !== true) {
        const error = new Error(session?.reason || "site_session_unverified");
        error.fillNotStarted = true;error.writeStarted = false;throw error;
      }
      requireVisibleFillPage();
    }
    const formFlow = globalThis.ResumeFormFlow;
    const formReady = () => collect(profile, attachment).some(entry => entry.reason === 'ready'
      && entry.path && entry.path !== 'sessionAttachment' && entry.answer != null
      && (!entry.control.readOnly || atsControlTargets.has(entry.control)) && !entry.control.disabled
      && visible(entry.control, atsControlTargets.has(entry.control))
      && !entry.control.closest('[aria-busy="true"],[aria-readonly="true"],[inert]'));
    if (formFlow && !formReady() && formFlow.inspect().entryCount > 0) {
      const readiness = await formFlow.ensure({ ready: async () => {
        // Revealing an editor replaces the inspected control roots. Refresh the
        // read-only candidate scan so opt-in widgets retain their MAIN evidence.
        if (atsEngineWriteEnabled) await loadAtsControlTargets(true);
        return formReady();
      },
        allowEntry: true, check: () => globalThis.ResumeProfileWriteContext.check(false) });
      if (!readiness.ok) throw Object.assign(Error(readiness.reason), {
        fillNotStarted: true, writeStarted: false, readiness });
    }
    const results = atsEngineWriteEnabled ? [] : await ensureRepeatRows(profile);
    let decodedAttachment = null;
    const processed = new Set();
    const records = new Map();
    const ids = new Map();
    let cmsMenuBlocked = false;
    let cmbMenuBlocked = false;
    let cmsCalendarBlocked = false;
    const startUrl = location.href;
    const firstEntries = collect(profile, attachment);
    const initialScopes = new Set(firstEntries.map((entry) => entryScope(entry.control)));
    for (let pass = 0; pass < 3; pass += 1) {
      requireVisibleFillPage();
      if (location.href !== startUrl) break;
      const allEntries = pass ? collect(profile, attachment) : firstEntries;
      // Capture scopes before any input event can synchronously replace later
      // controls in this pass. A detached input no longer reports its form.
      const entryScopes = new Map(allEntries.map((entry) => [entry.control, entryScope(entry.control)]));
      const counts = new Map();
      for (const entry of allEntries) {
        const key = logicalEntryKey(entry);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      const entries = allEntries.filter((entry) => !processed.has(entry.control));
      if (!entries.length) break;
      let awaitingDependentOptions = false;
      for (const original of entries) {
        await globalThis.ResumeProfileWriteContext.check(false);
        requireVisibleFillPage();
        if (location.href !== startUrl) break;
        const key = logicalEntryKey(original);
        const originalScope = entryScopes.get(original.control);
        let entry = original;
        let rebindFailure = null;
        if (!original.control.isConnected) {
          const matches = collect(profile, attachment)
            .filter((candidate) => logicalEntryKey(candidate) === key);
          if (matches.length !== 1) {
            rebindFailure = matches.length ? "duplicate_target" : "field_changed";
          } else if (entrySignature(matches[0]) !== entrySignature(original)) {
            rebindFailure = "field_changed";
          } else if (entryScope(matches[0].control) !== originalScope) {
            rebindFailure = "form_changed";
          } else {
            entry = matches[0];
          }
        }
        const tokens = [...new Set([original, entry]
          .map((item) => JSON.stringify([item.id, item.kind])))];
        const scope = entryScope(entry.control);
        const priorId = tokens.map((token) => ids.get(token))
          .find((record) => record && record.key !== key);
        if (priorId && priorId.key !== key) {
          priorId.result.status = "failed";
          priorId.result.reason = "field_changed";
          processed.add(entry.control);
          continue;
        }
        let record = records.get(key);
        const existing = !!record;
        const fresh = publicEntry(entry);
        if (pass < 2 && !existing && (fresh.reason === "option_not_found" || fresh.reason === "ambiguous_option")
          && (entry.control instanceof HTMLSelectElement || entry.kind === "radio")) {
          awaitingDependentOptions = true;
          continue;
        }
        processed.add(entry.control);
        if (!record) {
          record = { key, entry, scope: originalScope, signature: entrySignature(original), result: fresh };
          records.set(key, record);
          for (const token of tokens) ids.set(token, record);
          results.push(fresh);
        }
        const result = record.result;
        if (rebindFailure) {
          result.status = "failed";
          result.reason = rebindFailure;
          continue;
        }
        if (counts.get(key) !== 1) {
          result.status = "failed";
          result.reason = "duplicate_target";
          continue;
        }
        if (!initialScopes.has(scope) || !scope?.isConnected
          || scope !== originalScope || scope !== record.scope) {
          result.status = "failed";
          result.reason = "form_changed";
          continue;
        }
        if (existing && entrySignature(entry) !== record.signature) {
          result.status = "failed";
          result.reason = "field_changed";
          continue;
        }
        // Keep the collision guard aware of framework-assigned replacement
        // ids encountered on later passes as well as the initial id.
        for (const token of tokens) ids.set(token, record);
        record.entry = entry;
        result.currentValue = fresh.currentValue;
        if (!entry.control.isConnected) {
          result.status = "failed";
          result.reason = "field_changed";
          continue;
        }
        if (existing && result.status !== "verified") continue;
        if (existing && result.status === "verified") {
          // A successful L1 write is never retried after a re-render. Its
          // original target and plan must pass the final read-only check.
          if (atsEngineWriteEnabled) continue;
          if (answerMatches(entry, attachment)) continue;
          // A date picker may have committed a value before the site re-renders.
          // Never click it a second time if that value later disappears.
          if (["cms_birth_date", "cms_education_date", "cms_school_search", "cms_region", "cms_checkbox_group"].includes(entry.kind)) {
            result.status = "failed";
            result.reason = "readback_mismatch";
            continue;
          }
          if (fresh.currentValue) {
            result.status = "failed";
            result.reason = "readback_mismatch";
            continue;
          }
          if (entry.reason !== "ready") {
            result.status = "failed";
            result.reason = entry.reason;
            continue;
          }
        } else if (fresh.reason !== "ready") {
          result.status = settleUnresolvedEntry(entry, fresh.reason);
          continue;
        }
        if (cmsMenuBlocked) {
          result.status = "skipped";
          result.reason = "blocked_by_open_menu";
          continue;
        }
        if (cmbMenuBlocked) {
          result.status = "skipped";
          result.reason = "blocked_by_open_menu";
          continue;
        }
        if (cmsCalendarBlocked) {
          result.status = "skipped";
          result.reason = "blocked_by_open_calendar";
          continue;
        }
        if (!atsEngineWriteEnabled && answerMatches(entry, attachment)) {
          result.status = "verified";
          // This value was already on the page when this field was reached.
          // A prior software write to the same logical field keeps its
          // readback_matched provenance across framework re-renders.
          if (!existing) result.reason = "preexisting_same_value";
          continue;
        }
        const control = entry.control;
        let genericWriteStarted = false;
        try {
          requireVisibleFillPage();
          const answer = Array.isArray(entry.answer) ? entry.answer[0] : entry.answer;
          if (atsEngineWriteEnabled) {
            record.readbackId = await fillAtsControl(entry, result);
            continue;
          } else if (entry.kind === "ant_degree_select") {
            Object.assign(result, await fillAntDegreeSelect(entry, answer));
            const live = currentDegreeControl(control);
            result.currentValue = live ? meaningfulCurrent(live) : "";
            continue;
          } else if (entry.kind === "cmb_ant_v4_select") {
            Object.assign(result, await fillAntDegreeSelect(entry, answer, currentCmbAntV4Control));
            const live = currentCmbAntV4Control(control, entry);
            result.currentValue = live ? meaningfulCurrent(live) : "";
            if (result.reason === "control_error" && visibleAntV4Dropdowns().length) {
              cmbMenuBlocked = true;
            }
            continue;
          } else if(entry.kind==='cms_checkbox_group') {
            Object.assign(result,await globalThis.ResumeCmsCheckboxes.fillCheckboxes(control,entry.checkboxFact));
            result.currentValue=meaningfulCurrent(control);continue;
          } else if(entry.kind==='cms_region') {
            Object.assign(result,await globalThis.ResumeCmsRegion.fillRegion(control,entry.regionFact));
            const live=collect(profile,attachment).filter(candidate=>candidate.kind==='cms_region'&&candidate.path===entry.path);
            result.currentValue=live.length===1?meaningfulCurrent(live[0].control):'';
            if(visibleCmsAntV3Dropdowns().length)cmsMenuBlocked=true;
            continue;
          } else if (entry.kind === "cms_school_search") {
            // The matcher supplies either a confirmed school verbatim or its
            // confirmed employer-specific wording. The helper may select only
            // one enabled actual option that matches that exact wording.
            Object.assign(result, await globalThis.ResumeCmsSchoolSearch.fillSchool(control, answer));
            const live = currentCmsAntV3Control(entry);
            result.currentValue = live ? meaningfulCurrent(live) : "";
            if (visibleCmsAntV3Dropdowns().length) cmsMenuBlocked = true;
            continue;
          } else if (entry.kind === "cms_ant_v3_select") {
            Object.assign(result, await fillCmsAntV3Select(entry, answer));
            const live = currentCmsAntV3Control(entry);
            result.currentValue = live ? meaningfulCurrent(live) : "";
            if (result.reason === "control_error" && visibleCmsAntV3Dropdowns().length) {
              cmsMenuBlocked = true;
            }
            continue;
          } else if (entry.kind === "cms_birth_date" || entry.kind === "cms_education_date") {
            if (visibleCmsAntV3Dropdowns().length) {
              cmsMenuBlocked = true;
              result.status = "skipped";
              result.reason = "blocked_by_open_menu";
              continue;
            }
            const dateResult = entry.kind === "cms_education_date"
              ? await globalThis.ResumeCmsEducationDates.fillEducationDate(control, answer,
                {confirmed:true,rowIndex:entry.context?.index??0,key:cmsScopedSimpleInputSpec(control)?.dateKey||entry.key,sourcePath:entry.path})
              : await globalThis.ResumeCmsDatePicker.fillBirthDate(control, answer);
            Object.assign(result, dateResult);
            const live = collect(profile, attachment).filter((candidate) =>
              candidate.kind === entry.kind && candidate.path === entry.path);
            result.currentValue = live.length === 1 ? meaningfulCurrent(live[0].control) : "";
            if (visibleCmsCalendarPortals().length) cmsCalendarBlocked = true;
            continue;
          } else if (control instanceof HTMLInputElement && control.type === "file") {
            const bytes = decodedAttachment ||= attachmentBytes(attachment);
            const file = new File([bytes], attachment.name, { type: attachment.type || "application/octet-stream", lastModified: attachment.lastModified || Date.now() });
            const transfer = new DataTransfer();
            transfer.items.add(file);
            requireVisibleFillPage();
            await checkProfileWrite(); requireWritableControl(control); control.files = transfer.files; genericWriteStarted = true;
            requireVisibleFillPage();
            await checkProfileWrite(); requireWritableControl(control,genericWriteStarted); control.dispatchEvent(new Event("input", { bubbles: true }));
            requireVisibleFillPage();
            await checkProfileWrite(); requireWritableControl(control,genericWriteStarted); control.dispatchEvent(new Event("change", { bubbles: true }));
            const selected = control.files?.[0];
            result.status = selected?.name === file.name && selected?.size === file.size ? "verified" : "failed";
          } else if (entry.kind === "radio") {
            const selected = entry.radioOptions[entry.optionIndex];
            requireVisibleFillPage();
            await checkProfileWrite(); requireWritableControl(selected); selected.click();
            result.status = selected.checked ? "verified" : "failed";
          } else if (control instanceof HTMLSelectElement) {
            requireVisibleFillPage();
            await checkProfileWrite(); requireWritableControl(control); control.selectedIndex = entry.optionIndex; genericWriteStarted = true;
            requireVisibleFillPage();
            await checkProfileWrite(); requireWritableControl(control,genericWriteStarted); control.dispatchEvent(new Event("input", { bubbles: true }));
            requireVisibleFillPage();
            await checkProfileWrite(); requireWritableControl(control,genericWriteStarted); control.dispatchEvent(new Event("change", { bubbles: true }));
            const chosen = control.selectedOptions[0];
            result.status = chosen && M.selectOption([chosen], entry.answer).index === 0 ? "verified" : "failed";
          } else {
            const beforeValue = control.value, beforeHref = location.href;
            const verifyAddress = entry.cmsBasicAddress ? written => {
              const binding = cmsBasicAddressBinding(control);
              if (!control.isConnected || !binding || binding.reason) throw Error(binding?.reason || "field_changed");
              if (location.href !== beforeHref || entryScope(control) !== scope) throw Error("field_changed");
              const fact = cmsBasicAddressAnswer(profile, control, binding);
              if (fact.reason || fact.path !== entry.path || fact.value !== answer) throw Error(fact.reason || "field_changed");
              if (control.value !== (written ? String(answer) : beforeValue)) throw Error("existing_value");
            } : null;
            await setBoundNativeValue(control, String(answer), verifyAddress);
            result.status = control.value === String(answer) ? "verified" : "failed";
          }
          result.reason = result.status === "verified" ? "readback_matched" : "readback_mismatch";
          result.currentValue = meaningfulCurrent(control, entry.radioOptions, entry.antUnnamedRadio);
        } catch (error) { if(/^profile_[a-z_]+$/u.test(error?.message||''))throw error;
          if (error?.message === PAGE_HIDDEN_DURING_FILL) throw error;
          if (error?.message === "iframe_or_captcha_manual") {
            Object.assign(result, { status: error.writeStarted ? "failed" : "skipped", semanticStatus: "manual",
              reason: error.message, writeStarted: error.writeStarted === true,
              currentValue: error.writeStarted ? meaningfulCurrent(control, entry.radioOptions, entry.antUnnamedRadio) : "" });
            delete result.mappingContext;
            continue;
          }
          result.status = "failed";
          result.reason = entry.cmsBasicAddress && ["field_changed", "question_scope_mismatch", "ambiguous_repeat_group",
            "duplicate_target", "custom_control_not_supported", "ambiguous_profile_fact", "missing_profile_value",
            "unconfirmed_profile_value", "question_scope_unconfirmed", "existing_value"].includes(error?.message)
            ? error.message : "control_error";
          result.detail = String(error?.message || error).slice(0, 150);
          if (["cms_ant_v3_select", "cms_school_search",'cms_region'].includes(entry.kind) && visibleCmsAntV3Dropdowns().length) {
            cmsMenuBlocked = true;
          }
          if (entry.kind === "cmb_ant_v4_select" && visibleAntV4Dropdowns().length) {
            cmbMenuBlocked = true;
          }
          if (["cms_birth_date", "cms_education_date"].includes(entry.kind) && visibleCmsCalendarPortals().length) {
            cmsCalendarBlocked = true;
          }
        }
      }
      await new Promise((resolve) => setTimeout(resolve, awaitingDependentOptions ? 350 : 40));
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
    requireVisibleFillPage();
    const finalEntries = location.href === startUrl ? collect(profile, attachment) : [];
    for (const record of records.values()) {
      const result = record.result;
      if (result.status !== "verified") continue;
      if (location.href !== startUrl) {
        result.status = "failed";
        result.reason = "page_changed";
        continue;
      }
      if (!record.scope?.isConnected) {
        result.status = "failed";
        result.reason = "form_changed";
        continue;
      }
      const matches = finalEntries.filter((entry) => logicalEntryKey(entry) === record.key);
      if (matches.length !== 1) {
        result.status = "failed";
        result.reason = matches.length ? "duplicate_target" : "field_changed";
        continue;
      }
      const live = matches[0];
      if (entryScope(live.control) !== record.scope) {
        result.status = "failed";
        result.reason = "form_changed";
        continue;
      }
      if (entrySignature(live) !== record.signature || !live.control.isConnected) {
        result.status = "failed";
        result.reason = "field_changed";
        continue;
      }
      result.currentValue = meaningfulCurrent(live.control, live.radioOptions, live.antUnnamedRadio);
      if (atsEngineWriteEnabled) {
        try { await verifyAtsControl(live, result, record.readbackId); }
        catch (error) {
          if (/^profile_[a-z_]+$/u.test(error?.message || '') || error?.message === PAGE_HIDDEN_DURING_FILL) throw error;
          result.status = 'failed'; result.adapterStatus = 'unsupported'; result.reason = 'control_readback_failed';
        }
      } else if (!answerMatches(live, attachment)) {
        result.status = "failed";
        result.reason = "readback_mismatch";
      }
      if (result.status === 'verified' && live.control.validity && !live.control.validity.valid) {
        result.status = "failed";
        result.reason = "browser_validation_failed";
      }
    }
    // Page scripts may autosave or submit after input/change events. The extension
    // cannot infer the remote site's final state from local DOM readback alone.
    const photoRows = atsEngineWriteEnabled ? [] : await fillCmsPhotos(photoUploads);
    const validationGaps = currentValidationGaps();
    return { url: location.href, title: document.title,
      fields: [...results, ...cmsUncollectedQuestions(finalEntries, photoRows), ...photoRows],
      ...(atsEngineWriteEnabled ? { liveSupportClaimed: false } : {}),
      ...(validationGaps ? { validationGaps } : {}),
      savedOnSite: null, submitted: null, softwareClickedSubmit: false };
  }

  async function gthBindingVerdict(profileBinding) {
    let timer;
    try{return await Promise.race([
      chrome.runtime.sendMessage({type:'RESUME_PROFILE_BINDING_CHECK',profileBinding}),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('profile_binding_unavailable')),5000);})
    ]);}catch{return null;}finally{clearTimeout(timer);}
  }
  async function runBoundGthTrial(message,operation) {
    if(globalThis.ResumeProfileWriteContext)throw Object.assign(Error('profile_write_context_busy'),{writeStarted:false,fillNotStarted:true});
    const context={profileBinding:message.profileBinding,writeStarted:false,async check(write=true){
      if(globalThis.ResumeProfileWriteContext!==context)throw Error('profile_write_context_changed');
      const verdict=await gthBindingVerdict(context.profileBinding);
      if(verdict?.allowed!==true||globalThis.ResumeProfileWriteContext!==context){
        throw Object.assign(Error(verdict?'profile_binding_changed':'profile_binding_unavailable'),{writeStarted:context.writeStarted,fillNotStarted:!context.writeStarted});
      }
      requireVisibleFillPage();if(write)context.writeStarted=true;
    }};
    globalThis.ResumeProfileWriteContext=context;
    try{await context.check(false);const result=await operation();await context.check(false);return result;}
    finally{if(globalThis.ResumeProfileWriteContext===context)delete globalThis.ResumeProfileWriteContext;}
  }
  async function boundGthStatus(message,record) {
    if(location.href!=='https://hr.gtht.com/resume/edit/'||record?.requestId!==message.requestId)return {ok:false,error:'unknown_request'};
    const verdict=await gthBindingVerdict(record.profileBinding);
    if(verdict?.allowed!==true)return {ok:false,error:verdict?'profile_binding_changed':'profile_binding_unavailable'};
    const outcome=record.state==='settled'&&record.outcome==='verified'
      ?record.currentCheck?.()===true?'verified':'readback_unverified':record.outcome;
    return {ok:true,data:{requestId:record.requestId,state:record.state,...(record.state==='settled'?{outcome}:{})}};
  }

  // A deliberately narrow GTH trial. The general RESUME_FILL route remains
  // blocked on this site; this route can touch only one confirmed empty field.
  async function gthSalaryTrial(profile, requestId) {
    const page = "https://hr.gtht.com/resume/edit/";
    const titles = ["基本信息", "教育经历", "求职意向", "工作经验",
      "职业技能与特长", "附件简历", "其他信息"];
    const question = "期望薪资";
    let writeStarted = false;
    const fail = (reason) => { throw new Error(reason); };
    const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const heading = (section) => {
      const copy = section.querySelector(".title_")?.cloneNode(true);
      copy?.querySelectorAll("a,button").forEach((node) => node.remove());
      return M.normalize(copy?.textContent);
    };
    const sectionsNow = () => {
      if (location.href !== page) fail("wrong_page");
      requireVisibleFillPage();
      const sections = [...document.querySelectorAll(".r-section")];
      if (sections.length !== titles.length
        || sections.some((section, index) => heading(section) !== titles[index]))
        fail("section_structure_changed");
      return sections;
    };
    const ownLabel = (item) => {
      const labels = [...item.querySelectorAll(".el-form-item__label")]
        .filter((node) => node.closest(".el-form-item") === item);
      return labels.length === 1 ? M.normalize(labels[0].textContent) : "";
    };
    const stateOf = (node) => [node.tagName, node.type || "", node.value || "",
      !!node.checked, node.selectedIndex ?? null,
      [...(node.files || [])].map((file) => [file.name, file.size, file.type])];
    const otherFormValues = (form) => JSON.stringify(
      [...form.querySelectorAll("input,select,textarea")]
        .filter((node) => ownLabel(node.closest(".el-form-item") || form) !== question)
        .map(stateOf));
    const otherSections = (sections) => JSON.stringify(sections
      .filter((_, index) => index !== 2)
      .map((section) => [section.textContent,
        [...section.querySelectorAll("input,select,textarea")].map(stateOf)]));
    try {
      if (location.href !== page) fail("wrong_page");
      if (document.readyState !== "complete") fail("page_not_ready");
      requireVisibleFillPage();
      const facts = (profile.customFacts || []).filter((item) =>
        M.normalize(item?.question) === question);
      const answer = String(profile.customAnswers?.[question] ?? "").trim();
      if (facts.length !== 1 || !answer || /[\r\n\u0000-\u001f]/u.test(answer)
        || answer.length > 100 || facts[0].answer !== answer
        || facts[0].sitePageUrl !== page || facts[0].sectionName !== "求职意向"
        || facts[0].rowContext !== "none"
        || !(profile.confirmedFields || []).includes(`customAnswers.${question}`))
        fail("missing_or_unconfirmed_fact");
      let sections = sectionsNow();
      let forms = sections.flatMap((section) => [...section.querySelectorAll("form")]);
      if (forms.length > 1 || (forms.length === 1 && !sections[2].contains(forms[0])))
        fail("editor_structure_changed");
      const outsideBefore = otherSections(sections);
      if (!forms.length) {
        const links = [...sections[2].querySelectorAll(".title_ a.h-e-btn")]
          .filter((node) => M.normalize(node.textContent) === "编辑" && visible(node));
        if (links.length !== 1) fail("edit_link_not_unique");
        await checkProfileWrite(); links[0].click();
        const deadline = Date.now() + 4000;
        do {
          await pause(60);
          sections = sectionsNow();
          forms = sections.flatMap((section) => [...section.querySelectorAll("form")]);
          if (forms.length > 1 || (forms.length === 1 && !sections[2].contains(forms[0])))
            fail("editor_structure_changed");
          if (forms.length === 1 && forms[0].querySelector(".el-form-item")) break;
        } while (Date.now() < deadline);
      }
      if (forms.length !== 1 || !sections[2].contains(forms[0])
        || otherSections(sections) !== outsideBefore) fail("editor_structure_changed");
      const form = forms[0];
      const target = () => {
        const items = [...form.querySelectorAll(".el-form-item")]
          .filter((item) => ownLabel(item) === question);
        if (items.length !== 1) fail("target_not_unique");
        const item = items[0];
        const controls = [...item.querySelectorAll("input,select,textarea")]
          .filter((node) => node.closest(".el-form-item") === item);
        if (controls.length !== 1 || !(controls[0] instanceof HTMLInputElement)
          || controls[0].type !== "text" || controls[0].readOnly
          || controls[0].disabled || !visible(controls[0])
          || controls[0].closest(".el-select,.el-date-editor,.el-cascader,.cascader-wrap"))
          fail("target_not_plain_text");
        return controls[0];
      };
      const input = target();
      if (input.value !== "") fail("target_has_existing_value");
      if (input.maxLength >= 0 && answer.length > input.maxLength)
        fail("value_too_long");
      const otherBefore = otherFormValues(form);
      await pause(80);
      if (sectionsNow()[2] !== sections[2] || !form.isConnected
        || target() !== input || input.value !== ""
        || otherFormValues(form) !== otherBefore
        || otherSections(sectionsNow()) !== outsideBefore)
        fail("original_value_changed");
      writeStarted = true;
      await setBoundNativeValue(input, answer);
      await pause(250);
      sections = sectionsNow();
      forms = sections.flatMap((section) => [...section.querySelectorAll("form")]);
      if (forms.length !== 1 || forms[0] !== form || !sections[2].contains(form))
        fail("editor_changed_after_fill");
      if (otherFormValues(form) !== otherBefore
        || otherSections(sections) !== outsideBefore)
        fail("other_values_changed");
      const readback = target();
      if (readback.value !== answer) fail("readback_mismatch");
      const targetItem = readback.closest(".el-form-item");
      if (targetItem?.classList.contains("is-error")
        || targetItem?.classList.contains("is-validating")
        || readback.getAttribute("aria-invalid") === "true"
        || [...(targetItem?.querySelectorAll(".el-form-item__error") || [])]
          .some((node) => visible(node) && M.normalize(node.textContent)))
        fail("site_validation_failed");
      if (readback.validity && !readback.validity.valid)
        fail("browser_validation_failed");
      // The popup may close or time out before it receives the reply. Keep a
      // same-document, read-only verifier; never return the applicant's answer
      // from the status route or infer success from the earlier reply alone.
      if (fillState.gthSalary?.requestId === requestId) {
        fillState.gthSalary.currentCheck = () => {
          try {
            if (location.href !== page || document.visibilityState !== "visible"
              || !form.isConnected || !input.isConnected) return false;
            const liveSections = sectionsNow();
            const liveForms = liveSections.flatMap((section) => [...section.querySelectorAll("form")]);
            if (liveForms.length !== 1 || liveForms[0] !== form
              || !liveSections[2].contains(form)) return false;
            const live = target();
            const item = live.closest(".el-form-item");
            return live === input && live.value === answer
              && !item?.classList.contains("is-error")
              && !item?.classList.contains("is-validating")
              && live.getAttribute("aria-invalid") !== "true"
              && ![...(item?.querySelectorAll(".el-form-item__error") || [])]
                .some((node) => visible(node) && M.normalize(node.textContent))
              && (!live.validity || live.validity.valid);
          } catch { return false; }
        };
      }
      return { url: location.href, title: document.title,
        fields: [{ id: "gth:求职意向:期望薪资", labels: [question],
          path: `customAnswers.${question}`, scope: { sectionName: "求职意向", rowContext: "none" },
          reason: "readback_matched", status: "verified" }],
        gthSalaryTrial: true, editorLeftOpen: true, savedOnSite: null,
        submitted: null, softwareClickedSave: false, softwareClickedSubmit: false };
    } catch (error) { if(/^profile_[a-z_]+$/u.test(error?.message||''))throw error;
      if (error && typeof error === "object") {
        error.writeStarted = writeStarted;
        throw error;
      }
      const wrapped = new Error(String(error));
      wrapped.writeStarted = writeStarted;
      throw wrapped;
    }
  }

  if (!existingListenerAlive) { const engineListener=(message, _sender, sendResponse) => {
    if(message?.type==='CMS_ROW_D_PREEXISTING_TRIAL') {
      const refuse=error=>sendResponse({ok:false,error,fillNotStarted:true,writeStarted:false});
      if(_sender?.id!==chrome.runtime.id){refuse('profile_wrong_sender');return false;}
      if(Object.keys(message).sort().join('|')!=='profileBinding|target|type'
        ||!Object.hasOwn(CMS_ROW_D_TRIAL_SPECS,message.target)){refuse('trial_request_invalid');return false;}
      if(fillState.pending){refuse('fill_in_progress');return false;}
      fillState.pending=true;
      cmsRowDPreexistingTrial(message).then(data=>({ok:true,data}),error=>({ok:false,
        error:/^(?:profile|trial|fill)_[a-z_]+$/u.test(error?.message||'')?error.message:'trial_failed',
        fillNotStarted:true,writeStarted:false})).then(reply=>{fillState.pending=false;sendResponse(reply);});
      return true;
    }
    if(["RESUME_FILL","GTH_SALARY_TRIAL","GTH_SALARY_STATUS"].includes(message?.type)&&_sender?.id!==chrome.runtime.id){sendResponse({ok:false,error:"profile_wrong_sender",fillNotStarted:true,writeStarted:false});return false;}
    if (!message || !["RESUME_INSPECT", "RESUME_FILL", "GTH_SALARY_TRIAL", "GTH_SALARY_STATUS"].includes(message.type)) return;
    if(message.type==='GTH_SALARY_STATUS') {
      boundGthStatus(message,fillState.gthSalary).then(sendResponse,()=>sendResponse({ok:false,error:'profile_binding_unavailable'}));return true;
    }
    if (message.type === "GTH_SALARY_TRIAL"
      && (typeof message.requestId !== "string"
        || !/^[A-Za-z0-9-]{10,100}$/.test(message.requestId))) {
      sendResponse({ ok: false, error: "invalid_request_id", writeStarted: false });
      return false;
    }
    if (message.type === "RESUME_FILL"
      && `${location.origin}${location.pathname}` === "https://hr.gtht.com/resume/edit/") {
      sendResponse({ ok: false, error: "gth_read_only" });
      return false;
    }
    if (message.type === "RESUME_FILL" || message.type === "GTH_SALARY_TRIAL") {
      if (document.visibilityState !== "visible") {
        sendResponse({ ok: false, error: "page_hidden",
          ...(message.type !== "RESUME_FILL" ? { writeStarted: false } : {}) });
        return false;
      }
      if (fillState.pending) {
        sendResponse({ ok: false, error: "fill_in_progress" });
        return false;
      }
      // Set synchronously before the asynchronous fill can yield to another message.
      fillState.pending = true;
      if (message.type === "GTH_SALARY_TRIAL") {
        fillState.gthSalary = { requestId: message.requestId, state: "running", profileBinding:message.profileBinding };
      }
    }
    Promise.resolve()
      .then(async () => {
        await loadFieldMemory();
        if (message.type === 'RESUME_INSPECT') await loadAtsControlTargets();
        return message.type === "RESUME_FILL"
        ? fill(message.profile || {}, message.attachment || null, message.photoUploads || null, message.profileBinding)
        : message.type === "GTH_SALARY_TRIAL"
          ? runBoundGthTrial(message,()=>gthSalaryTrial(message.profile || {}, message.requestId))
          : inspect(message.profile || {}, message.attachment || null);
      })
      .then((data) => ({ ok: true, data }),
        (error) => ({ ok: false, error: String(error?.message || error),
          ...(error?.fillNotStarted === true ? { fillNotStarted: true, writeStarted: false } : {}),
          ...(message.type === "GTH_SALARY_TRIAL"
            && typeof error?.writeStarted === "boolean"
            ? { writeStarted: error.writeStarted }
            : error?.writeStarted ? { writeStarted: true } : {}) }))
      .then((reply) => {
        if (message.type === "RESUME_FILL" || message.type === "GTH_SALARY_TRIAL") fillState.pending = false;
        if (message.type === "GTH_SALARY_TRIAL"
          && fillState.gthSalary?.requestId === message.requestId) {
          const record = fillState.gthSalary;
          record.state = "settled";
          record.outcome = reply.ok && typeof record.currentCheck === "function"
            ? "verified" : !reply.ok && reply.writeStarted === false
              ? "failed_before_write" : "write_started_unverified";
        }
        sendResponse(reply);
      });
    return true;
  };chrome.runtime.onMessage.addListener(engineListener);globalThis.__resumeQuickFillEngineListener=engineListener;globalThis.__resumeQuickFillEngineRevision=18;}
  globalThis.ResumeQuickFillGthInspect = (profile) => {
    if (`${location.origin}${location.pathname}` !== "https://hr.gtht.com/resume/edit/")
      throw new Error("gth_inspect_wrong_page");
    return inspect(profile || {}, null);
  };
  globalThis.__resumeQuickFillInstalled = true;
})();
