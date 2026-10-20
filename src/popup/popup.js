"use strict";
import {captureProfileBinding,assertProfileBinding,withProfileBinding,dispatchBoundSource} from "../profile/profile-lifecycle.js";
import {isCmb,cmbBasicInjectFiles} from "../content/cmb-profile-map.mjs";
import {cmbPopupOutcome} from "../background/cmb-basic-auto.mjs";
import {assessGthIntentFill, GTH_INTENT_FILL_TYPE, intentFillPayload, intentValueShape} from "../background/gth-intent-auto.mjs";
import { clearAttachment, loadAttachment, saveAttachment, MAX_ATTACHMENT_BYTES } from "../import/attachment-store.js";
import { MAX_CUSTOM_FACTS, collectScopedQuestionDrafts, loadProfile, normalizeQuestionKey, saveProfile, questionIdentity, normalizeScopedQuestion } from "../profile/store.js";
import { beginRecentRequest, loadRecentResult, recentResultText, saveRecentResult } from "./recent-result.js";
import { createGthBasicActions } from "./gth-basic-actions.js";
import {createSelectionOwner} from "../import/selection-owner.mjs";
import { fullEducationCandidates, readEducationTargets, createGthEducationDraftActions, gthDraftMessage } from "./gth-education-actions.js";

const elements = {
  title: document.getElementById("site-title"),
  url: document.getElementById("site-url"),
  message: document.getElementById("message"),
  recentResult: document.getElementById("recent-result"),
  recentResultText: document.getElementById("recent-result-text"),
  validationGaps: document.getElementById("validation-gaps"),
  validationGapTitle: document.getElementById("validation-gap-title"),
  validationGapList: document.getElementById("validation-gap-list"),
  summary: document.getElementById("summary"),
  list: document.getElementById("field-list"),
  drafts: document.getElementById("question-drafts"),
  draftList: document.getElementById("question-draft-list"),
  draftButton: document.getElementById("collect-questions"),
  draftNote: document.getElementById("question-draft-note"),
  draftIntro: document.querySelector("#question-drafts p"),
  inspect: document.getElementById("inspect"),
  fill: document.getElementById("fill"),
  gthSalaryTrial: document.getElementById("gth-salary-trial"),
  gthSalaryButton: document.getElementById("gth-salary-button"),
  gthIntentTrial: document.getElementById("gth-intent-trial"),
  gthIntentButton: document.getElementById("gth-intent-button"),
  gthEducationTrial: document.getElementById("gth-education-trial"),
  gthEducationSource: document.getElementById("gth-education-source"),
  gthEducationTarget: document.getElementById("gth-education-target"),
  gthEducationTargetButton: document.getElementById("gth-education-target-button"),
  gthEducationNewButton: document.getElementById("gth-education-new-button"),
  gthDraftInspect: document.getElementById("gth-education-draft-inspect"),
  gthDraftSave: document.getElementById("gth-education-draft-save"),
  gthDraftResume: document.getElementById("gth-education-draft-resume"),
  gthDraftNote: document.getElementById("gth-education-draft-note"),
  gthEducationReplace: document.getElementById("gth-education-replace"),
  gthEducationButtons: [document.getElementById("gth-education-first-button"),
    document.getElementById("gth-education-second-button")],
  gthEducationFullButtons: [document.getElementById("gth-education-full-first-button"),
    document.getElementById("gth-education-full-second-button")],
  gthSimpleTrial: document.getElementById("gth-simple-trial"),
  gthSimpleButton: document.getElementById("gth-simple-button"),
  gthOtherTrial: document.getElementById("gth-other-trial"),
  gthOtherButton: document.getElementById("gth-other-button"),
  gthBasicTrial: document.getElementById("gth-basic-trial"),
  gthBasicSource: document.getElementById("gth-basic-source"),
  gthBasicReplace: document.getElementById("gth-basic-replace"),
  gthBasicButton: document.getElementById("gth-basic-button"),
  profile: document.getElementById("open-profile")
};
const attachmentInput = document.getElementById("attachment");
const attachmentState = document.getElementById("attachment-state");
const rememberAttachment = document.getElementById("remember-attachment");
const clearAttachmentButton = document.getElementById("clear-attachment");
const cmsPhotoSection = document.getElementById("cms-photo-choices");
const cmsPhotoChoices = {
  basic: { input: document.getElementById("cms-photo-basic"),
    confirm: document.getElementById("cms-photo-basic-confirm"),
    state: document.getElementById("cms-photo-basic-state") },
  portrait: { input: document.getElementById("cms-photo-portrait"),
    confirm: document.getElementById("cms-photo-portrait-confirm"),
    state: document.getElementById("cms-photo-portrait-state") }
};
const MAX_CMS_PHOTO_BYTES = 5 * 1024 * 1024;
let cachedAttachment = null;
let cachedConfirmed = false;
let attachmentReady = Promise.resolve(),cachedAttachmentToken=null;
const popupFileOwner=createSelectionOwner({onInvalidate:()=>{
  attachmentInput.value='';rememberAttachment.checked=false;cachedAttachment=null;cachedConfirmed=false;cachedAttachmentToken=null;
  clearAttachmentButton.hidden=true;attachmentState.textContent='资料已变化，请重新选择当前客户的文件。';
  for(const choice of Object.values(cmsPhotoChoices)){choice.input.value='';choice.confirm.checked=false;choice.confirm.disabled=true;choice.state.textContent='资料已变化，请重新选择并确认照片。';}
}});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&(changes.resumeProfile||changes.resumeProfileLifecycle))popupFileOwner.changed().catch(()=>{});});
let gthEducationJobSnapshot = null;
let gthBasicPrepared = false;
let gthBasicPendingReview = false;
let gthEducationTargets = null;
let gthDraftState = null;

const reasons = {
  ready: "可填写", readback_matched: "本次新填并读回一致",
  preexisting_same_value: "页面原有同值，已保留", readback_mismatch: "读回不一致",
  readback_reapplied: "本次重填已有记录并读回一致",
  missing_profile_value: "尚无已确认的对应答案", unconfirmed_profile_value: "资料尚未核对",
  invalid_profile_value: "资料格式需检查", multiple_profile_values: "有多个备选值",
  ambiguous_label: "问题含义不明确", unknown_question: "题目尚未建立资料对应",
  question_scope_unconfirmed: "旧答案未核对网站与分区",
  question_scope_mismatch: "答案属于其他网站或分区",
  unlabelled_field: "网站字段无标签", ambiguous_option: "多个相似选项",
  option_not_found: "网站没有对应选项", existing_value: "页面已有不同内容",
  attachment_type_not_accepted: "网站不接受此附件格式",
  photo_requires_selection: "请在上方为此入口选择并确认照片",
  photo_file_invalid: "照片文件格式或内容无法核对",
  photo_site_accept_rejected: "此入口不接受所选照片格式",
  photo_existing_value: "网站已有照片，已保留原值",
  photo_target_changed: "照片控件与已识别结构不符",
  photo_upload_unverified: "网站未显示上传完成，暂不能算已填对",
  photo_upload_widget_verified: "照片控件已读回并显示上传完成；网站保存另核对",
  format_not_supported: "资料格式与网站要求不同", value_too_long: "内容超过网站字数上限",
  browser_validation_failed: "浏览器校验未通过",
  duplicate_target: "页面存在重复目标字段",
  family_field_requires_mapping: "家庭成员字段需单独定位",
  section_requires_mapping: "当前分区的资料对应未确认",
  cms_record_requires_explicit_binding: "请在下方教育／实习入口明确选择本段资料后填写",
  cms_record_field_not_supported: "本经历题尚未被专用入口支持，已保留待处理",
  ambiguous_repeat_group: "经历组位置不明确",
  readonly_control: "网站控件只读，需手动选择",
  custom_select_not_supported: "网站下拉选项尚未验证，需手动选择",
  custom_control_not_supported: "网站控件暂未支持",
  search_required: "网站需先搜索选项，暂未支持",
  blocked_by_open_menu: "上一个菜单未关闭，已停止后续填写",
  blocked_by_open_calendar: "日期菜单未关闭，已停止后续填写",
  date_precision_insufficient: "日期只有月份，网站需要具体哪一天",
  portal_not_open: "日期菜单没有打开", portal_not_closed: "日期菜单没有关闭",
  year_selector_missing: "网站年选择控件无法识别", year_panel_missing: "网站年份菜单无法识别",
  year_not_found: "网站没有对应年份", ambiguous_year: "网站年份选项不唯一",
  month_not_found: "网站没有对应月份", ambiguous_month: "网站月份选项不唯一",
  day_not_found: "网站没有对应日期", ambiguous_day: "网站日期选项不唯一",
  disabled_day: "网站不允许选择该日期", unexpected_value: "网站出现了意外日期",
  ambiguous_profile_fact: "资料中有多条相似记录", sensitive_profile_disabled: "家庭信息使用未开启",
  file_requires_user_selection: "请在网站手动选文件", field_changed: "网站字段已变化",
  form_changed: "表单已切换，请重新识别", page_changed: "网页已跳转，请重新识别",
  control_error: "控件操作失败", unmapped_repeat_field: "经历字段不明确",
  profile_fact_unconfirmed: "本段教育资料尚未核对",
  control_not_supported: "本项控件尚未支持",
  site_control_disabled: "网站锁定此项，无法修改，已保留原值",
  site_readonly: "账户资料只读，已保留；修改须进入网站账户设置",
  incomplete_date_pair: "开始和结束月份需同时有已确认资料，本组未操作",
  not_run: "本轮未执行",
  item_not_found: "页面上没有这一项",
  control_not_found: "页面控件无法唯一确定",
  wrong_page: "当前不是招行简历编辑页",
  profile_fields_unavailable: "姓名、手机号或邮箱尚未核对完整",
  datepicker_hint_only: "出生日期只记录填法，本次不填写",
  birthdate_unparseable: "出生日期无法识别，本次没有填写",
  birthdate_input_missing: "没有找到出生日期输入框，本次没有填写",
  birthdate_target_ambiguous: "出生日期输入框不唯一，本次没有填写",
  birthdate_panel_missing: "出生日期日历没有打开，本次没有填写",
  birthdate_panel_multiple: "打开了多个日期面板，已关闭并且没有填写",
  birthdate_cell_missing: "日历里没有这一天，本次没有改日期",
  birthdate_cell_disabled: "这一天不能选择，本次没有改日期",
  birthdate_readback_mismatch: "出生日期和资料不一致，已停止并且没有保存"
};

let activeTab = null;
let busy = false;
let pendingInspect = false;
let lastInspection = null;
let previewQuestions = [];
let fillOutcomeUncertain = false;
let gthSalaryEligible = false;
let gthIntentEligible = false;
let gthEducationEligible = false;
let gthSimpleEligible = false;
let gthOtherEligible = false;
let gthPendingReview = false;
let gthIntentPendingReview = false;
let gthEducationPendingReview = false;
let gthEducationPendingRow = null;
let gthEducationPendingFull = false;

const SCRIPT_TIMEOUT_MS = 15000;
const INSPECT_TIMEOUT_MS = 15000;
const FILL_TIMEOUT_MS = 45000;
const GTH_DISCOVERY_TIMEOUT_MS = 45000;
const PENDING_FILL_REVIEW_KEY = "resumePendingFillReview";

function pendingFillReviewKey(tabId) {
  return `${PENDING_FILL_REVIEW_KEY}:${tabId}`;
}

function pendingReviewMatches(record, tab) {
  return record?.tabId === tab.id && record?.origin === authorizationScope(tab.url);
}

async function pendingReviewFor(tab) {
  const key = pendingFillReviewKey(tab.id);
  const scoped = (await chrome.storage.local.get(key))[key];
  if (pendingReviewMatches(scoped, tab)) return scoped;
  // Keep warnings written by an already installed version of the extension.
  const legacy = (await chrome.storage.local.get(PENDING_FILL_REVIEW_KEY))[PENDING_FILL_REVIEW_KEY];
  return pendingReviewMatches(legacy, tab) ? legacy : null;
}

async function replacePendingReview(tab, requestId, previous = null) {
  const key = pendingFillReviewKey(tab.id);
  const current = (await chrome.storage.local.get(key))[key];
  if (current?.requestId !== requestId) return;
  if (previous) await chrome.storage.local.set({ [key]: previous });
  else await chrome.storage.local.remove(key);
}

async function clearLegacyPendingReview(tab) {
  const legacy = (await chrome.storage.local.get(PENDING_FILL_REVIEW_KEY))[PENDING_FILL_REVIEW_KEY];
  if (pendingReviewMatches(legacy, tab)) await chrome.storage.local.remove(PENDING_FILL_REVIEW_KEY);
}

class PopupTimeoutError extends Error {
  constructor(stage) {
    const message = stage === "fill_response"
      ? "填写请求已发出，但 45 秒内未收到结果。网页可能仍在填写，读回结果未知。请先检查网页实际内容，不要立即再次填写。"
      : stage === "gth_discovery"
        ? "国泰海通逐段识别超时，网页可能停在一个编辑器。请先检查并手动关闭编辑器；本次没有发送填写请求。"
      : stage === "script"
        ? "向网页加载识别程序超时。本次没有发送填写指令；请检查网页是否正常，再重新识别。"
        : "网页识别响应超时。本次没有发送填写指令；请检查网页是否正常，再重新识别。";
    super(message);
    this.name = "PopupTimeoutError";
    this.stage = stage;
  }
}

function boundedChromeCall(call, timeoutMs, stage) {
  let timer;
  return Promise.race([
    Promise.resolve().then(call),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new PopupTimeoutError(stage)), timeoutMs);
    })
  ]).finally(() => clearTimeout(timer));
}

function setMessage(message, error = false) {
  elements.message.textContent = message;
  elements.message.classList.toggle("error", error);
}

function showRecentResult(record) {
  elements.recentResult.hidden = !record;
  elements.recentResultText.textContent = recentResultText(record);
}

async function rememberResult(tab, requestId, kind, fields, statusCode = "readback_complete") {
  try {
    const record = await saveRecentResult(tab, requestId, kind, fields, statusCode);
    if (activeTab?.id === tab.id && activeTab.url === tab.url) showRecentResult(record);
  } catch {
    // A receipt is optional; failure must not change the safety state of a fill.
  }
}

function setBusy(value) {
  busy = value;
  elements.inspect.disabled = value;
  elements.fill.disabled = value || !activeTab || isGthSite(activeTab.url) || !lastInspection;
  elements.gthSalaryButton.disabled = value || (gthPendingReview
    ? !activeTab || activeTab.url !== GTH_RESUME_PAGE
    : !gthSalaryEligible || fillOutcomeUncertain);
  elements.gthSalaryButton.textContent = gthPendingReview
    ? "核对上次试填状态（只读）" : "试填期望薪资并读回（不保存）";
  elements.gthIntentButton.disabled = value || !activeTab || activeTab.url !== GTH_RESUME_PAGE
    || (fillOutcomeUncertain && !gthIntentPendingReview);
  elements.gthIntentButton.textContent = gthIntentPendingReview
    ? "核对上次求职意向试填状态（只读）" : "试填求职意向并读回（不保存）";
  elements.gthEducationButtons.forEach((button, rowIndex) => {
    button.disabled = value || (gthEducationPendingReview
      ? !activeTab || activeTab.url !== GTH_RESUME_PAGE || gthEducationPendingRow !== rowIndex || gthEducationPendingFull
      : !activeTab || activeTab.url !== GTH_RESUME_PAGE
        || !gthEducationEligible || fillOutcomeUncertain);
    button.textContent = gthEducationPendingReview && gthEducationPendingRow === rowIndex && !gthEducationPendingFull
      ? `核对第${rowIndex + 1}段教育上次试填状态（只读）`
      : `试填第${rowIndex + 1}段教育的学校与专业（不保存）`;
  });
  elements.gthEducationFullButtons.forEach((button, rowIndex) => {
    button.disabled = value || (gthEducationPendingReview
      ? !activeTab || activeTab.url !== GTH_RESUME_PAGE || gthEducationPendingRow !== rowIndex || !gthEducationPendingFull
      : !activeTab || activeTab.url !== GTH_RESUME_PAGE || !gthEducationEligible
        || selectedGthEducationProfileIndex() === null || fillOutcomeUncertain);
    button.textContent = gthEducationPendingReview && gthEducationPendingRow === rowIndex && gthEducationPendingFull
      ? `核对第${rowIndex + 1}段教育上次运行状态（只读）`
      : `试填第${rowIndex + 1}段教育并读回（不保存）`;
  });
  elements.gthEducationSource.disabled = value || fillOutcomeUncertain;
  elements.gthEducationReplace.disabled = value || fillOutcomeUncertain;
  elements.gthEducationTarget.disabled = value || fillOutcomeUncertain;
  elements.gthEducationTargetButton.disabled = value || fillOutcomeUncertain || !gthEducationEligible
    || selectedGthEducationProfileIndex() === null || selectedGthEducationTargetIndex() === null;
  elements.gthEducationNewButton.disabled = value || fillOutcomeUncertain || !gthEducationEligible
    || selectedGthEducationProfileIndex() === null || !gthEducationTargets?.ok || gthEducationTargets.editorOpen
    || gthEducationTargets.count >= 30;
  const draftSource = gthDraftActions.source;
  const sourceVerified = draftSource?.state === "completed" && draftSource.outcome === "verified";
  elements.gthDraftInspect.disabled = value || fillOutcomeUncertain || !sourceVerified
    || ["queued", "running", "unknown", "completed", "server_verified_needs_refresh", "refreshing_saved_record", "verifying_saved_after_refresh"].includes(gthDraftState?.state);
  elements.gthDraftSave.disabled = value || fillOutcomeUncertain || !sourceVerified
    || gthDraftState?.state !== "ready" || gthDraftState.requestId !== draftSource.requestId;
  elements.gthDraftResume.disabled = value || !activeTab || activeTab.url !== GTH_RESUME_PAGE || !gthDraftActions.canResume;
  elements.gthSimpleButton.disabled = value || !activeTab
    || activeTab.url !== GTH_RESUME_PAGE || !gthSimpleEligible || fillOutcomeUncertain;
  elements.gthOtherButton.disabled = value || !activeTab
    || activeTab.url !== GTH_RESUME_PAGE || !gthOtherEligible || fillOutcomeUncertain;
  elements.gthBasicSource.disabled = value || fillOutcomeUncertain;
  elements.gthBasicReplace.disabled = value || fillOutcomeUncertain;
  elements.gthBasicButton.disabled = value || !activeTab || activeTab.url !== GTH_RESUME_PAGE
    || (!gthBasicPendingReview && (!gthBasicPrepared || selectedGthBasicEducationIndex() === null || fillOutcomeUncertain));
  elements.gthBasicButton.textContent = gthBasicPendingReview
    ? "查看基本信息后台结果（只读）" : "试填基本信息并读回（不保存）";
  elements.fill.textContent = fillOutcomeUncertain ? "核对后继续填写"
    : (activeTab && isCmb(activeTab.url) ? "试填并读回（不保存）"
      : (activeTab && isCmsPhotoResumePage(activeTab.url) ? "填写并读回（教育请用下方）" : "填写并读回"));
  if (elements.fill) {
    elements.fill.title = activeTab && isCmb(activeTab.url)
      ? "只试填招行基本信息并读回，不点击保存、提交或投递。"
      : (activeTab && isCmsPhotoResumePage(activeTab.url)
        ? "此按钮不填写教育经历专业等字段；请用下方「填写全部选定教育并核对」。"
        : "");
  }
  elements.draftButton.disabled = value || !previewQuestions.length;
  for (const choice of Object.values(cmsPhotoChoices)) {
    choice.input.disabled = value;
    choice.confirm.disabled = value || !!cmsPhotoFileError(choice.input.files?.[0]);
  }
}

function isGthSite(url) {
  try { return new URL(url).origin === "https://hr.gtht.com"; }
  catch { return false; }
}

function isGthResumePage(url) {
  try {
    const address = new URL(url);
    return address.origin === "https://hr.gtht.com" && address.pathname === "/resume/edit/";
  } catch { return false; }
}

const GTH_RESUME_PAGE = "https://hr.gtht.com/resume/edit/";
const GTH_INTENT_SECTION = "求职意向";
const GTH_INTENT_QUESTIONS = ["期望从事职位类别", "期望薪资", "现从事行业", "现从事职位类别", "现薪资"];
const GTH_SIMPLE_SECTION = "职业技能与特长";
const GTH_OTHER_SECTION = "其他信息";
const GTH_OTHER_QUESTIONS = ["描述", "标题"];
function confirmedGthSalary(profile) {
  const question = "期望薪资";
  const answer = String(profile.customAnswers?.[question] ?? "").trim();
  const facts = (profile.customFacts || []).filter((item) =>
    normalizeQuestionKey(item?.question) === normalizeQuestionKey(question));
  return !!answer && facts.length === 1 && facts[0].answer === answer
    && facts[0].sitePageUrl === GTH_RESUME_PAGE
    && facts[0].sectionName === "求职意向" && facts[0].rowContext === "none"
    && (profile.confirmedFields || []).includes(`customAnswers.${question}`);
}

const GTH_INTENT_OPTIONAL = ["期望工作地区", "到岗日期"];

function gthIntentFactOk(profile, question, answer) {
  const facts = (profile.customFacts || []).filter((item) =>
    normalizeQuestionKey(item?.question) === normalizeQuestionKey(question));
  return facts.length === 1 && facts[0].question === question
    && facts[0].answer === answer && facts[0].sitePageUrl === GTH_RESUME_PAGE
    && facts[0].sectionName === GTH_INTENT_SECTION && facts[0].rowContext === "none"
    && (profile.confirmedFields || []).includes(`customAnswers.${question}`);
}

function confirmedGthIntent(profile) {
  const required = GTH_INTENT_QUESTIONS.every((question) => {
    const answer = profile.customAnswers?.[question];
    return intentValueShape(question, answer) && gthIntentFactOk(profile, question, answer);
  });
  if (!required) return false;
  return GTH_INTENT_OPTIONAL.every((question) => {
    const answer = profile.customAnswers?.[question];
    if (typeof answer !== "string" || answer.trim() === "") return true;
    return intentValueShape(question, answer) && gthIntentFactOk(profile, question, answer);
  });
}


function gthIntentGapsZh(profile) {
  const missing = [];
  const unconfirmed = [];
  for (const question of GTH_INTENT_QUESTIONS) {
    const answer = profile?.customAnswers?.[question];
    const hasAnswer = intentValueShape(question, typeof answer === "string" ? answer : "");
    if (!hasAnswer) { missing.push(question); continue; }
    if (!gthIntentFactOk(profile, question, answer)) unconfirmed.push(question);
  }
  for (const question of GTH_INTENT_OPTIONAL) {
    const answer = profile?.customAnswers?.[question];
    if (typeof answer !== "string" || answer.trim() === "") continue;
    if (!intentValueShape(question, answer)) { missing.push(question); continue; }
    if (!gthIntentFactOk(profile, question, answer)) unconfirmed.push(question);
  }
  const parts = [];
  if (missing.length) parts.push(`缺少已填答案：${missing.join("、")}`);
  if (unconfirmed.length) parts.push(`已填但未限定本页求职意向或未核对：${unconfirmed.join("、")}`);
  if (!parts.length) return "五项均已核对。";
  return `${parts.join("；")}。请在资料库确认上述项并限定国泰海通此页“求职意向”后再试填；不会保存或投递。`;
}

function confirmedGthEducationCandidates(profile) {
  const confirmed = new Set(profile.confirmedFields || []);
  return (profile.education || []).flatMap((row, profileIndex) => {
    const school = typeof row?.school === "string" ? row.school.trim() : "";
    const major = typeof row?.major === "string" ? row.major.trim() : "";
    const paths = [`education.${profileIndex}.school`, `education.${profileIndex}.major`];
    if (!school || !major || school.length > 200 || major.length > 200
      || /[\u0000-\u001f]/u.test(school + major) || !paths.every((path) => confirmed.has(path))) return [];
    return [{ profileIndex, school, major, confirmedPaths: paths }];
  }).slice(0, 10);
}

const GTH_EDUCATION_FULL_FIELDS = [
  ["毕业学校", "school"], ["专业名称", "major"], ["在校活动/职务", "campusActivities"],
  ["在校成绩排名", "gradeRank"], ["专业描述", "majorDescription"], ["绩点", "gpa"],
  ["学校所在地", "schoolLocation"], ["是否统招", "unifiedAdmissions"],
  ["学历", "degree"], ["在校时间（开始）", "startDate"],
  ["在校时间（结束）", "endDate"], ["专业类别", "majorCategory"]
];

function confirmedGthEducationFullCandidates(profile) {
  return fullEducationCandidates(profile);
}

function selectedGthEducationProfileIndex() {
  const value = elements.gthEducationSource.value;
  return typeof value === "string" && /^(?:[0-9]|[12][0-9])$/.test(value) ? Number(value) : null;
}

function selectedGthEducationTargetIndex() {
  const value = elements.gthEducationTarget.value;
  const index = /^(?:[0-9]|[12][0-9])$/.test(value) ? Number(value) : null;
  return index !== null && gthEducationTargets?.ok && index < gthEducationTargets.count ? index : null;
}

async function populateGthEducationTargets(tab) {
  const previous = elements.gthEducationTarget.value;
  const result = await chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [0] }, func: readEducationTargets });
  gthEducationTargets = result?.length === 1 && result[0].frameId === 0 ? result[0].result : null;
  elements.gthEducationTarget.replaceChildren();
  const empty = document.createElement("option");empty.value = "";
  empty.textContent = gthEducationTargets?.ok ? "请选择网站记录" : "当前记录无法安全识别";
  elements.gthEducationTarget.append(empty);
  if (gthEducationTargets?.ok) for (let index = 0; index < gthEducationTargets.count; index++) {
    const option = document.createElement("option");option.value = String(index);
    option.textContent = `网站第 ${index + 1} 段教育`;elements.gthEducationTarget.append(option);
  }
  elements.gthEducationTarget.value = gthEducationTargets?.ok && Number(previous) < gthEducationTargets.count ? previous : "";
}

function showGthDraftState(job) {
  gthDraftState = job;
  elements.gthDraftNote.textContent = gthDraftMessage(job);
}
const gthDraftActions = createGthEducationDraftActions({ peekTab: () => activeTab, onUpdate: showGthDraftState });

function performGthDraftAction(action) {
  if (busy) return;
  const tab = activeTab;
  if (action === "save" && !window.confirm("保存刚才核对的这条教育草稿？软件只保存一次，再刷新核对这条记录；不会投递岗位。")) return;
  // Queue synchronously; all site work belongs to the persistent worker.
  const queued = gthDraftActions.run(action);
  setBusy(true);
  return (async () => {
    try {
      const accepted = await queued;
      if (!accepted?.accepted) { setMessage("草稿操作没有开始：请先完成教育填写和零写入预检，或检查待核对锁。", true); return; }
      setMessage(action === "save" ? "正在保存一次并刷新核对教育草稿，不会投递…" : action === "resume_refresh" ? "正在继续核对已保存草稿，必要时刷新；不会再次保存…" : "正在检查教育草稿；本次不会点击保存…");
      const result = await gthDraftActions.wait(accepted.requestId, tab.id);
      fillOutcomeUncertain = !!(await pendingReviewFor(tab));
      showGthDraftState(result);setMessage(elements.gthDraftNote.textContent, !["ready", "completed"].includes(result.state));
      if (result.state === "completed") await populateGthEducationTargets(tab);
    } catch { setMessage("草稿后台结果尚未确认。请重新打开扩展查看；不会重复发送保存。", true); }
    finally { setBusy(false); }
  })();
}

function selectedGthBasicEducationIndex() {
  const value = elements.gthBasicSource.value;
  return typeof value === "string" && /^\d{1,2}$/.test(value) ? Number(value) : null;
}
const gthBasicActions = createGthBasicActions({
  getTab, getBusy: () => busy, setBusy,
  getUncertain: () => fillOutcomeUncertain,
  setUncertain: (value) => { fillOutcomeUncertain = value; },
  pendingReviewFor, peekTab: () => activeTab,
  confirmOrigin: ({ origin, replaceExisting }) => window.confirm(`即将在 ${origin} 试填基本信息中可填写的项目并逐项读回。账户只读项会保留并单独报告。${replaceExisting ? "已勾选重填已有内容。" : "只填空项并核对原值。"}不会保存或投递。`)
});
function populateGthBasicSource(sources) {
  const previous = elements.gthBasicSource.value;
  elements.gthBasicSource.replaceChildren();
  const empty = document.createElement("option");empty.value = "";empty.textContent = "请选择资料记录";
  elements.gthBasicSource.append(empty);
  for (const source of sources) {
    const option = document.createElement("option");option.value = String(source.educationIndex);
    option.textContent = `资料第${source.educationIndex + 1}段 · ${source.degree}`;
    elements.gthBasicSource.append(option);
  }
  elements.gthBasicSource.value = sources.some((source) => String(source.educationIndex) === previous) ? previous : "";
}
async function showGthBasicResult(result, tab, historical = false) {
  if(result.job)await assertProfileBinding(chrome.storage.local,result.job.profileBinding);
  gthBasicPendingReview = result.pending === true;
  await render({ profileBinding:result.job?.profileBinding, url: tab.url, title: tab.title || "国泰海通简历",
    fields: (result.coverage || []).map((field) => ({ id: `gth:基本信息:${field.key}`,
      labels: [field.question], path: field.path, status: field.status, reason: field.reason })) }, true);
  if(result.job)await assertProfileBinding(chrome.storage.local,result.job.profileBinding);
  setMessage(`${historical ? "上次后台记录：" : ""}${result.message}${historical ? "网页刷新后请重新识别核对当前内容。" : ""}`,
    !result.supportedComplete);
}
function performGthBasicTrial() {
  if (busy) return;
  if (gthBasicPendingReview) {
    setBusy(true);
    return gthBasicActions.review(activeTab).then((result) => showGthBasicResult(result, activeTab, true))
      .catch(() => setMessage("基本信息后台结果暂不可读取，请检查当前网页；未重复填写。", true))
      .finally(() => setBusy(false));
  }
  const tab = activeTab;
  // run() synchronously dispatches to the worker before returning its Promise.
  const queued = gthBasicActions.run({ educationIndex: selectedGthBasicEducationIndex(),
    replaceExisting: elements.gthBasicReplace.checked });
  return (async () => {
    try {
      const accepted = await queued;
      if (!accepted.accepted) { setMessage(accepted.message, true); return; }
      gthBasicPendingReview = true;setBusy(true);setMessage(accepted.message);
      await showGthBasicResult(await gthBasicActions.waitForResult(accepted.requestId, accepted.tabId), tab);
    } catch { setMessage("基本信息后台结果仍需核对；不会重复发送填写。", true); }
    finally { setBusy(false); }
  })();
}

function populateGthEducationSource(profile) {
  const previous = elements.gthEducationSource.value;
  elements.gthEducationSource.replaceChildren();
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "请选择资料记录";
  elements.gthEducationSource.append(empty);
  const candidates = confirmedGthEducationFullCandidates(profile);
  for (const candidate of candidates) {
    const option = document.createElement("option");
    option.value = String(candidate.profileIndex);
    option.textContent = `资料第 ${candidate.profileIndex + 1} 段 · ${profile.education[candidate.profileIndex].degree || "学历待补充"} · ${candidate.school || "学校待补充"}`;
    elements.gthEducationSource.append(option);
  }
  elements.gthEducationSource.value = candidates.some((candidate) => String(candidate.profileIndex) === previous)
    ? previous : "";
}

function confirmedGthSimple(profile) {
  const question = GTH_SIMPLE_SECTION;
  const answer = profile.customAnswers?.[question];
  const facts = (profile.customFacts || []).filter((item) =>
    normalizeQuestionKey(item?.question) === normalizeQuestionKey(question));
  return typeof answer === "string" && !!answer.trim() && answer.length <= 2000
    && facts.length === 1 && facts[0].answer === answer
    && facts[0].sitePageUrl === GTH_RESUME_PAGE
    && facts[0].sectionName === GTH_SIMPLE_SECTION && facts[0].rowContext === "none"
    && (profile.confirmedFields || []).includes(`customAnswers.${question}`);
}

function confirmedGthOther(profile) {
  return GTH_OTHER_QUESTIONS.every((question) => {
    const answer = profile.customAnswers?.[question];
    const facts = (profile.customFacts || []).filter((item) =>
      normalizeQuestionKey(item?.question) === normalizeQuestionKey(question));
    return typeof answer === "string" && !!answer.trim() && answer.length <= 2000
      && facts.length === 1 && facts[0].answer === answer
      && facts[0].sitePageUrl === GTH_RESUME_PAGE
      && facts[0].sectionName === GTH_OTHER_SECTION && facts[0].rowContext === "none"
      && (profile.confirmedFields || []).includes(`customAnswers.${question}`);
  });
}

// CMS resume match stays wecruit.hotjob.cn only. 招商银行 uses isCmb, not this function.
function isCmsResumePage(url) {
  try {
    const address = new URL(url);
    return address.protocol === "https:" && address.hostname === "wecruit.hotjob.cn"
      && /^\/SU[^/]+\/pb\/resumeOperation\.html$/.test(address.pathname);
  } catch { return false; }
}

function isCmsPhotoResumePage(url) {
  try {
    const address = new URL(url);
    return address.origin === "https://wecruit.hotjob.cn"
      && address.pathname === "/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html";
  } catch { return false; }
}

const CMS_PHOTO_TYPES = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  gif: "image/gif", bmp: "image/bmp"
};

function cmsPhotoFileError(file) {
  if (!file) return "本次尚未选择";
  if (!file.size || file.size > MAX_CMS_PHOTO_BYTES) return "照片必须非空且不超过 5 MB";
  const extension = /\.([a-z]+)$/i.exec(file.name)?.[1]?.toLowerCase();
  const expectedType = CMS_PHOTO_TYPES[extension];
  if (!expectedType || (file.type !== expectedType
    && !(extension === "bmp" && file.type === "image/x-ms-bmp"))) {
    return "仅支持能识别的 JPEG、PNG、GIF、BMP 图片";
  }
  return null;
}

async function cmsPhotoUploads(selectedOwnerToken) {
  await popupFileOwner.assert(selectedOwnerToken);
  const photos = {};
  for (const [slot, choice] of Object.entries(cmsPhotoChoices)) {
    if (!choice.confirm.checked) continue;
    const file = choice.input.files?.[0];
    const problem = cmsPhotoFileError(file);
    if (problem) throw new Error(`${slot === "basic" ? "基本信息照片" : "个人照片"}：${problem}`);
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
      await popupFileOwner.assert(selectedOwnerToken);
      if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 20_000_000)
        throw new Error("图片尺寸无法安全处理");
    } catch {
      throw new Error(`${slot === "basic" ? "基本信息照片" : "个人照片"}：图片无法解码或尺寸过大`);
    } finally { bitmap?.close(); }
    await popupFileOwner.assert(selectedOwnerToken);
    if (choice.input.files?.[0] !== file || !choice.confirm.checked)
      throw new Error("照片选择或确认状态已变化，本次没有发送，请重新确认。");
    photos[slot] = { name: file.name, size: file.size, type: file.type,
      lastModified: file.lastModified,
      base64: encodeBase64(new Uint8Array(await file.arrayBuffer())) };
    await popupFileOwner.assert(selectedOwnerToken);
    if (choice.input.files?.[0] !== file || !choice.confirm.checked)
      throw new Error("照片选择或确认状态已变化，本次没有发送，请重新确认。");
  }
  return photos;
}

function questionPreview(fields, profile, pending, pageUrl) {
  const queued = Array.isArray(pending) ? pending.filter((item) => typeof item === "string" || (item && typeof item === "object")) : [];
  const keyFor=item=>questionIdentity(item)||'legacy:'+normalizeScopedQuestion(typeof item==='string'?item:item?.question);
  const queuedKeys = new Set(queued.map(keyFor).filter(Boolean));
  const existing = new Set((profile.customFacts || []).map(keyFor).filter(Boolean));
  const queuedNew = [...queuedKeys].filter((key) => !existing.has(key)).length;
  const capacity = Math.max(0, Math.min(MAX_CUSTOM_FACTS - (profile.customFacts || []).length - queuedNew, MAX_CUSTOM_FACTS - queued.length));
  const candidates = collectScopedQuestionDrafts(fields, profile, pageUrl)
    .filter((item) => !queuedKeys.has(keyFor(item))&&!queued.some(old=>!questionIdentity(old)&&normalizeScopedQuestion(typeof old==='string'?old:old?.question)===normalizeScopedQuestion(item.question)));
  return { candidates, questions: candidates.slice(0, capacity) };
}

async function openSection(section) {
  await chrome.storage.local.set({ resumeRequestedSection: section });
  await chrome.runtime.openOptionsPage();
}

function encodeBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  }
  return btoa(binary);
}

async function getTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id || !/^https?:\/\//i.test(tab.url || "")) throw new Error("请先打开一个招聘网站的简历编辑页。浏览器内部页无法填写。");
  const address = new URL(tab.url);
  if (address.protocol !== "https:" && !(address.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(address.hostname))) {
    throw new Error("此页面未使用 HTTPS。为保护简历资料，请在招聘网站的加密页面填写。");
  }
  const sameSiteTab = activeTab?.id === tab.id && authorizationScope(activeTab.url) === authorizationScope(tab.url);
  activeTab = tab;
  cmsPhotoSection.hidden = !isCmsPhotoResumePage(tab.url);
  elements.gthSalaryTrial.hidden = tab.url !== GTH_RESUME_PAGE;
  elements.gthIntentTrial.hidden = tab.url !== GTH_RESUME_PAGE;
  elements.gthEducationTrial.hidden = tab.url !== GTH_RESUME_PAGE;
  elements.gthSimpleTrial.hidden = tab.url !== GTH_RESUME_PAGE;
  elements.gthOtherTrial.hidden = tab.url !== GTH_RESUME_PAGE;
  elements.gthBasicTrial.hidden = tab.url !== GTH_RESUME_PAGE;
  if (tab.url !== GTH_RESUME_PAGE) {
    gthSalaryEligible = false;
    gthIntentEligible = false;
    gthEducationEligible = false;
    gthSimpleEligible = false;
    gthOtherEligible = false;
  }
  const pending = await pendingReviewFor(tab);
  gthBasicPendingReview = pending?.kind === "gth_basic_trial";
  try { showRecentResult(pending ? null : await loadRecentResult(tab)); }
  catch { showRecentResult(null); }
  gthPendingReview = tab.url === GTH_RESUME_PAGE && pending?.kind === "gth_salary_trial"
    && typeof pending.requestId === "string";
  gthIntentPendingReview = tab.url === GTH_RESUME_PAGE && pending?.kind === "gth_intent_trial"
    && typeof pending.requestId === "string";
  gthEducationPendingReview = tab.url === GTH_RESUME_PAGE
    && ["gth_education_trial", "gth_education_full_trial"].includes(pending?.kind)
    && typeof pending.requestId === "string";
  gthEducationPendingRow = gthEducationPendingReview ? pending.rowIndex : null;
  gthEducationPendingFull = gthEducationPendingReview && pending.kind === "gth_education_full_trial";
  fillOutcomeUncertain = (sameSiteTab && fillOutcomeUncertain) || !!pending;
  elements.title.textContent = tab.title || "当前网页";
  elements.url.textContent = tab.url || "";
  return tab;
}

function authorizationScope(url) {
  const address = new URL(url);
  if (address.hostname === "wecruit.hotjob.cn") {
    const tenant = /^\/SU[^/]+\//.exec(address.pathname)?.[0];
    if (tenant) return `${address.origin}${tenant}`;
  }
  return address.origin;
}

const gthDiscoveryReasons = {
  wrong_page: "当前不是国泰海通简历编辑页。",
  page_not_ready: "网页尚未加载完成。",
  page_hidden: "国泰海通页面在后台，请切回页面后再识别。",
  page_reloaded: "识别期间网页刷新了。",
  section_structure_changed: "七个简历分区的结构已变化。",
  preexisting_editor: "网页已有打开的编辑器，请先检查并关闭。",
  edit_link_not_unique: "分区的编辑入口无法唯一确定。",
  editor_did_not_render: "编辑器没有正常显示。",
  editor_structure_changed: "出现多个编辑器或编辑器位置异常。",
  editor_values_changed: "编辑器里的原值在识别期间发生变化。",
  cancel_not_unique: "无法安全确定取消按钮。",
  editor_did_not_close: "编辑器没有正常关闭。",
  overview_values_changed: "关闭编辑器后，网页原值发生变化。",
  match_scope_mismatch: "识别结果无法准确归到当前分区。",
  engine_unavailable: "只读识别程序没有正确加载。"
};

async function inspectGth(tab, profile) {
  if (!isGthResumePage(tab.url)) throw new Error("请先进入国泰海通的简历编辑页。该站自动填写尚未验收。");
  await boundedChromeCall(() => chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["src/core/matcher.js", "src/content/engine.js", "src/content/gth-section-discovery.js"]
  }), SCRIPT_TIMEOUT_MS, "script");
  const replies = await boundedChromeCall(() => chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: async (facts) => {
      const discovery = globalThis.ResumeGthSectionDiscovery;
      const inspect = globalThis.ResumeQuickFillGthInspect;
      if (typeof discovery?.discover !== "function" || typeof inspect !== "function")
        return { ok: false, reason: "engine_unavailable", editorLeftOpen: false };
      return discovery.discover({ inspectSection: () => inspect(facts) });
    },
    args: [profile]
  }), GTH_DISCOVERY_TIMEOUT_MS, "gth_discovery");
  const result = replies?.[0]?.result;
  if (!result?.ok || result.completedSections?.length !== 5
    || result.originalValuesPreserved !== true || !Array.isArray(result.fields)) {
    const why = gthDiscoveryReasons[result?.reason] || "网页结构或字段已变化。";
    throw new Error(`国泰海通逐段识别未完成：${why}${result?.editorLeftOpen ? " 编辑器可能仍打开，请检查网页后手动关闭。" : ""}`);
  }
  const questionsInventoried = result.completedSections.reduce((count, section) =>
    count + (Array.isArray(section.fields) ? section.fields.length : 0), 0);
  return { url: tab.url, title: tab.title || "国泰海通简历",
    fields: result.fields, gthReadOnly: true, sectionsInspected: 5,
    questionsInventoried };
}

function cmbRouteMessage(reason) {
  const copy = {
    cmb_save_policy_violation: "招行结果报告了保存、提交或投递，已停止。请核对网页。",
    cmb_site_isolation: "返回结果不是招行页面，已停止。",
    cmb_basic_status_unsettled: "招行试填没有逐项确认读回，结果仍不明确。请核对网页后再决定。",
    cmb_fill_empty_response: "招行页面没有返回填写结果。请刷新后再试。",
    cmb_fill_partial: "招行试填有字段未读回一致。请核对网页，本次不能当作完成。",
    datepicker_hint_only: "出生日期只能提示，没有写入。请核对网页后再决定。",
    birthdate_unparseable: "出生日期无法识别，没有写入。请核对资料后再决定。",
    birthdate_input_missing: "没有找到出生日期输入框，没有写入。请核对网页后再决定。",
    birthdate_target_ambiguous: "出生日期输入框不唯一，没有写入。请核对网页后再决定。",
    birthdate_panel_missing: "出生日期日历没有打开，没有写入。请核对网页后再决定。",
    birthdate_panel_multiple: "打开了多个日期面板，已关闭并且没有写入。请核对网页后再决定。",
    birthdate_cell_missing: "日历里没有这一天，没有改日期。请核对网页后再决定。",
    birthdate_cell_disabled: "这一天不能选择，没有改日期。请核对网页后再决定。",
    birthdate_readback_mismatch: "出生日期和资料不一致，已停止。请核对网页后再决定。",
    profile_fact_unconfirmed: "有资料尚未核对，本次不能当作完成。",
    invalid_profile_value: "有资料对不上网页选项，本次不能当作完成。",
    item_ambiguous: "有字段对应到多处，没有猜选。请核对网页后再决定。",
    radio_readback_ambiguous: "有选项读回不唯一，没有猜选。请核对网页后再决定。",
    select_readback_ambiguous: "有下拉读回不唯一，没有猜选。请核对网页后再决定。",
    profile_fields_unavailable: "姓名、手机号或邮箱尚未核对完整，本次没有开始填写。",
    wrong_page: "我需要帮助！请打开已登录的招行简历页 https://career.cmbchina.com/center/resume"
  };
  return copy[reason] || "招行试填没有完成。请核对网页后再决定。";
}

async function sendCmb(type, tab, selectedOwnerToken) {
  const files = cmbBasicInjectFiles(tab.url);
  if (!files) throw new Error("当前不是招商银行页面。");
  if (type === "RESUME_FILL") {
    const origin = authorizationScope(tab.url);
    const { resumeTrustedOrigins } = await chrome.storage.local.get("resumeTrustedOrigins");
    const trusted = Array.isArray(resumeTrustedOrigins) ? resumeTrustedOrigins : [];
    if (!trusted.includes(origin)) {
      if (!window.confirm(`即将把你已核对的资料填入 ${origin} 的当前网页。请确认这是你要申请的招聘网站。不会点击保存、提交或投递。`)) {
        throw new Error("已取消填写；此网站尚未获准使用资料。");
      }
      const trustedBinding = await popupFileOwner.assert(selectedOwnerToken);
      await withProfileBinding(chrome.storage.local, trustedBinding, () => chrome.storage.local.set({
        resumeTrustedOrigins: [...trusted, origin].slice(-100)
      }));
    }
  }
  await boundedChromeCall(() => chrome.scripting.executeScript({ target: { tabId: tab.id }, files }), SCRIPT_TIMEOUT_MS, "script");
  const filling = type === "RESUME_FILL";
  let operationBinding = null;
  let profile = null;
  let requestId = null;
  let previousPendingReview = null;
  if (filling) {
    operationBinding = await popupFileOwner.assert(selectedOwnerToken);
    profile = await loadProfile();
    await assertProfileBinding(chrome.storage.local, operationBinding);
    try {
      await withProfileBinding(chrome.storage.local, operationBinding, async () => {
        previousPendingReview = await pendingReviewFor(tab);
        requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await beginRecentRequest(tab, requestId);
        await chrome.storage.local.set({
          [pendingFillReviewKey(tab.id)]: {
            tabId: tab.id,
            origin: authorizationScope(tab.url),
            at: Date.now(),
            requestId,
            profileBinding: operationBinding
          }
        });
      });
      showRecentResult(null);
    } catch {
      throw new Error("本机无法记录填写状态，已停止发送填写请求。请检查扩展存储后再试。");
    }
    fillOutcomeUncertain = true;
  }
  const message = filling
    ? { type: "CMB_BASIC_FILL", siteId: "cmb", profile, profileBinding: operationBinding }
    : { type: "CMB_BASIC_PROBE", siteId: "cmb" };
  const response = await boundedChromeCall(() => (
    filling
      ? dispatchBoundSource(chrome.storage.local, operationBinding, () => chrome.tabs.sendMessage(tab.id, message))
      : chrome.tabs.sendMessage(tab.id, message)
  ), filling ? FILL_TIMEOUT_MS : INSPECT_TIMEOUT_MS, filling ? "fill_response" : "inspect_response");
  const outcome = cmbPopupOutcome(response, filling ? "fill" : "inspect");
  if (!outcome.ok) {
    const error = new Error(cmbRouteMessage(outcome.reason));
    if (filling && outcome.fillNotStarted) {
      await replacePendingReview(tab, requestId, previousPendingReview);
      fillOutcomeUncertain = !!(await pendingReviewFor(tab));
      error.fillNotStarted = true;
    }
    throw error;
  }
  if (filling) {
    await replacePendingReview(tab, requestId);
    await clearLegacyPendingReview(tab);
    fillOutcomeUncertain = false;
    await rememberResult(tab, requestId, "resume_fill", outcome.view.fields);
  }
  return { ...outcome.view, profileBinding: operationBinding };
}

async function send(type) {
  await attachmentReady;
  const tab = await getTab();
  const selectedOwnerToken=await popupFileOwner.ensure();
  if (isGthSite(tab.url)) {
    if (type === "RESUME_FILL")
      throw new Error("国泰海通自动填写尚未完成真实验收；当前只提供逐段识别，不会发送填写请求。");
    return inspectGth(tab, await loadProfile());
  }
  if (isCmb(tab.url)) return sendCmb(type, tab, selectedOwnerToken);
  if (type === "RESUME_FILL") {
    const origin = authorizationScope(tab.url);
    const { resumeTrustedOrigins } = await chrome.storage.local.get("resumeTrustedOrigins");
    const trusted = Array.isArray(resumeTrustedOrigins) ? resumeTrustedOrigins : [];
    if (!trusted.includes(origin)) {
      if (!window.confirm(`即将把你已核对的资料填入 ${origin} 的当前网页。请确认这是你要申请的招聘网站。`)) {
        throw new Error("已取消填写；此网站尚未获准使用资料。");
      }
      const trustedBinding=await popupFileOwner.assert(selectedOwnerToken);
      await withProfileBinding(chrome.storage.local,trustedBinding,()=>chrome.storage.local.set({resumeTrustedOrigins:[...trusted,origin].slice(-100)}));
    }
  }
  let profile = await loadProfile();
  const files = ["src/core/matcher.js", "src/content/cms-date-picker.js"];
  if (isCmsResumePage(tab.url)) files.push("src/content/cms-validation-gaps.js");
  if (isCmsPhotoResumePage(tab.url)) files.push("src/content/cms-session.js", "src/content/cms-school-search.js", "src/content/cms-region.js", "src/content/cms-education-dates.js", "src/content/cms-checkboxes.js");
  files.push("src/content/engine.js");
  await boundedChromeCall(() => chrome.scripting.executeScript({ target: { tabId: tab.id }, files }), SCRIPT_TIMEOUT_MS, "script");
  let attachment = null;
  const selectedFile = attachmentInput.files?.[0];
  const cachedFileConfirmed = cachedAttachment && profile.confirmedFields.includes("resumeAttachment.name")
    && profile.resumeAttachment?.name === cachedAttachment.name
    && profile.resumeAttachment?.size === cachedAttachment.size
    && profile.resumeAttachment?.type === cachedAttachment.type;
  if (selectedFile || cachedFileConfirmed) {
    const file = selectedFile || cachedAttachment;
    if (file.size > MAX_ATTACHMENT_BYTES) throw new Error("本次附件超过 5 MB，请选择较小的简历文件。");
    if (!/\.(pdf|doc|docx|txt)$/i.test(file.name)) throw new Error("本次附件只接受 PDF、Word 或 TXT 文件。");
    if (type === "RESUME_FILL" && selectedFile && rememberAttachment.checked) {
      await popupFileOwner.run(selectedOwnerToken,async({binding,assert,ownProfile})=>{
        const profileRecord=await loadProfile();await assert();
        await saveAttachment(file,{profileBinding:binding});await assert();
        profileRecord.confirmedFields=profileRecord.confirmedFields.filter(path=>path!=='resumeAttachment.name');
        profileRecord.resumeAttachment={name:file.name,size:file.size,type:file.type,source:'stored-local'};
        profileRecord.sources['resumeAttachment.name']='manual';await ownProfile(await saveProfile(profileRecord));
      });
      profile=await loadProfile();await popupFileOwner.assert(selectedOwnerToken);
      cachedAttachment=file;cachedConfirmed=false;cachedAttachmentToken=selectedOwnerToken;clearAttachmentButton.hidden=false;
      attachmentState.textContent = `本次已选择：${file.name}；以后复用请先在资料库确认附件`;
    }
    attachment = { name: file.name, size: file.size, type: file.type, lastModified: file.lastModified };
    if (type === "RESUME_FILL") attachment.base64 = encodeBase64(new Uint8Array(await file.arrayBuffer()));
  }
  await popupFileOwner.assert(selectedOwnerToken);
  const operationBinding=await popupFileOwner.assert(selectedOwnerToken);
  profile=await loadProfile();await assertProfileBinding(chrome.storage.local,operationBinding);
  const messagePayload = { type, profile, attachment, profileBinding:operationBinding };
  if (type === "RESUME_FILL" && isCmsPhotoResumePage(tab.url)) {
    messagePayload.photoUploads = await cmsPhotoUploads(selectedOwnerToken);
    // Image decoding/encoding is asynchronous. Refuse to send those bytes if
    // the active page changed while they were being prepared.
    const [stillActive] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (stillActive?.id !== tab.id || stillActive.url !== tab.url)
      throw new Error("招聘网页已切换，本次照片没有发送，请重新识别。");
  }
  let requestId = null;
  let previousPendingReview = null;
  if (type === "RESUME_FILL") {
    try {
      await withProfileBinding(chrome.storage.local,operationBinding,async()=>{
        previousPendingReview=await pendingReviewFor(tab);requestId=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await beginRecentRequest(tab,requestId);
        await chrome.storage.local.set({[pendingFillReviewKey(tab.id)]:{tabId:tab.id,origin:authorizationScope(tab.url),at:Date.now(),requestId,profileBinding:operationBinding}});
      });
      showRecentResult(null);
    } catch {
      throw new Error("本机无法记录填写状态，已停止发送填写请求。请检查扩展存储后再试。");
    }
    fillOutcomeUncertain = true;
  }
  const response = await boundedChromeCall(() => dispatchBoundSource(chrome.storage.local,operationBinding,()=>chrome.tabs.sendMessage(tab.id,messagePayload)),
    type === "RESUME_FILL" ? FILL_TIMEOUT_MS : INSPECT_TIMEOUT_MS,
    type === "RESUME_FILL" ? "fill_response" : "inspect_response");
  return withProfileBinding(chrome.storage.local,operationBinding,async()=>{
  if (!response?.ok) {
    if (type === "RESUME_FILL" && response?.fillNotStarted === true && response.writeStarted === false) {
      await replacePendingReview(tab, requestId, previousPendingReview);
      fillOutcomeUncertain = !!(await pendingReviewFor(tab));
      const error = new Error(response.error === "site_session_expired"
        ? "招聘网站登录已过期，本次没有开始填写。请登录后继续；当前表单内容已保留。"
        : response.error === "license_required" ? "授权核验未通过，本次没有开始填写。请在授权版中打开「授权激活」页粘贴令牌。"
          : "暂时无法确认招聘网站登录状态，本次没有开始填写。当前表单内容已保留。");
      error.fillNotStarted = true;throw error;
    }
    if (type === "RESUME_FILL" && ["page_hidden", "fill_in_progress"].includes(response?.error)) {
      // If another request is running but its old marker is missing, keep the
      // new marker: the page itself has proved the outcome is still unknown.
      if (response.error === "page_hidden" || previousPendingReview)
        await replacePendingReview(tab, requestId, previousPendingReview);
      fillOutcomeUncertain = response.error === "fill_in_progress" || !!(await pendingReviewFor(tab));
      const error = new Error(response.error === "page_hidden"
        ? "招聘网页在后台，本次没有开始填写。请切回该页后重新识别。"
        : "上一轮填写仍在网页中执行，本次没有开始第二次填写。请等待并核对网页实际内容。");
      error.fillNotStarted = true;
      throw error;
    }
    if (type === "RESUME_FILL" && response?.error === "fill_interrupted_page_hidden") {
      // The page became hidden after work began. Keep this tab's pending marker:
      // some fields may already have changed, and there is no final readback.
      const error = new Error("填写途中招聘网页转到后台，已停止后续操作。可能已有部分资料填入，请先核对网页实际内容和网站保存状态。");
      error.fillInterrupted = true;
      throw error;
    }
    throw new Error(response?.error || "页面没有响应，请刷新页面后重试。");
  }
  if (type === "RESUME_FILL") {
    if (!Array.isArray(response.data?.fields)) throw new Error("网页没有返回逐项读回结果，填写状态仍待核对。");
    await replacePendingReview(tab, requestId);
    await clearLegacyPendingReview(tab);
    fillOutcomeUncertain = false;
    await rememberResult(tab, requestId, "resume_fill", response.data.fields);
  }
  return {...response.data,profileBinding:operationBinding};
  });
}

function renderValidationGaps(data) {
  elements.validationGapList.replaceChildren();
  const record = data?.validationGaps;
  const rows = Array.isArray(record?.items) ? record.items.filter(row =>
    row && typeof row.section === "string" && typeof row.question === "string"
    && typeof row.message === "string" && typeof row.empty === "boolean") : [];
  elements.validationGaps.hidden = rows.length === 0;
  if (!rows.length) return;
  const total = Number.isInteger(record.total) && record.total >= rows.length
    ? record.total : rows.length;
  elements.validationGapTitle.textContent = `网站当前校验提示：${total} 处`;
  const groups = new Map();
  for (const row of rows) {
    const section = row.section.slice(0, 100);
    if (!groups.has(section)) groups.set(section, []);
    groups.get(section).push(row);
  }
  for (const [section, items] of groups) {
    const title = document.createElement("h3");
    title.textContent = section;
    const list = document.createElement("ul");
    for (const row of items) {
      const item = document.createElement("li");
      const name = document.createElement("strong");
      name.textContent = `${row.question.slice(0, 160)}${Number.isInteger(row.row) && row.row > 1 ? `（第 ${row.row} 条）` : ""}`;
      const detail = document.createElement("span");
      detail.textContent = `${row.message.slice(0, 170)} · ${row.empty ? "当前为空" : "已有内容，网站仍报错"}${row.conditionalLanguage ? " · 岗位条件需核对" : ""}`;
      item.append(name, detail);
      list.append(item);
    }
    elements.validationGapList.append(title, list);
  }
}

async function render(data, filled = false) {
  if(data.profileBinding)await assertProfileBinding(chrome.storage.local,data.profileBinding);
  elements.list.replaceChildren();
  renderValidationGaps(data);
  const fields = data.fields || [];
  const profile = await loadProfile();
  const { resumePendingQuestions } = await chrome.storage.local.get("resumePendingQuestions");
  if(data.profileBinding)await assertProfileBinding(chrome.storage.local,data.profileBinding);
  const preview = questionPreview(fields, profile, resumePendingQuestions, data.url);
  previewQuestions = preview.questions;
  lastInspection = { data, filled, tabId: activeTab?.id, tabUrl: activeTab?.url };
  elements.draftList.replaceChildren();
  for (const question of previewQuestions) {
    const item = document.createElement("li");
    item.textContent = `${question.question} · ${question.sectionName}`;
    elements.draftList.append(item);
  }
  elements.drafts.hidden = !preview.candidates.length;
  elements.draftButton.hidden = !previewQuestions.length;
  elements.draftButton.disabled = busy || !previewQuestions.length;
  elements.draftButton.textContent = `把这 ${previewQuestions.length} 个问题加入资料库 ↗`;
  elements.draftNote.textContent = preview.candidates.length > previewQuestions.length
    ? `另有 ${preview.candidates.length - previewQuestions.length} 个问题暂存不下；补充问答最多 ${MAX_CUSTOM_FACTS} 条。`
    : "答案留空，须由你填写并确认后才会用于自动填写。";
  elements.draftIntro.textContent = data.gthReadOnly
    ? "只记录下面的题目原文，不复制网页已有值。你回答并确认后可重新识别；国泰海通自动填写仍待验收。"
    : "只记录下面列出的题目原文，不复制网页里的填写内容。你回答并确认后，回到此页重新识别，再点“填写并读回”。";
  const actionable = fields.filter((field) => field.reason === "ready").length;
  const verified = fields.filter((field) => field.status === "verified").length;
  const preexistingSame = fields.filter((field) => field.status === "verified"
    && field.reason === "preexisting_same_value").length;
  const reapplied = fields.filter((field) => field.status === "verified"
    && field.reason === "readback_reapplied").length;
  const writtenAndVerified = verified - preexistingSame - reapplied;
  const failed = fields.filter((field) => field.status === "failed").length;
  elements.summary.textContent = data.gthReadOnly
    ? `分区盘点 ${data.questionsInventoried} 题 · 控件识别 ${fields.length} · 自动填写待验收`
    : filled ? `本次新填并读回 ${writtenAndVerified}${reapplied ? ` · 本次重填并读回 ${reapplied}` : ""} · 页面原有同值 ${preexistingSame} · 失败 ${failed} · 待处理 ${fields.length - verified - failed}`
      : `可填写 ${actionable} · 待处理 ${fields.length - actionable}`;
  for (const field of fields) {
    const row = document.createElement("div");
    row.className = "field";
    const main = document.createElement("div");
    main.className = "field-main";
    const name = document.createElement("div");
    name.className = "field-name";
    name.textContent = field.labels?.[0] || field.id;
    const detail = document.createElement("div");
    detail.className = "field-detail";
    detail.textContent = field.path?.startsWith('customScopedAnswers.')?'资料：当前网站分区的补充答案':field.path ? `资料：${field.path}` : `网站字段：${field.id}`;
    main.append(name, detail);
    if (["unknown_question", "missing_profile_value", "unconfirmed_profile_value", "question_scope_unconfirmed", "question_scope_mismatch"].includes(field.reason) && field.labels?.[0]) {
      const section = sectionForPath(field.path);
      const existingCustomQuestion = !section && (profile.customFacts || []).some((item) =>
        normalizeQuestionKey(item.question) === normalizeQuestionKey(field.labels[0]));
      if (section || existingCustomQuestion) {
      const add = document.createElement("button");
      add.type = "button";
      add.className = "add-question";
      add.textContent = existingCustomQuestion ? "去资料库回答或核对 ↗" : "去资料库填写或核对 ↗";
      add.addEventListener("click", () => openSection(section || "custom").catch((error) => setMessage(error?.message || "打开资料库失败", true)));
      main.append(add);
      }
    }
    const status = document.createElement("div");
    status.className = `field-status ${field.status === "verified" ? "verified" : field.reason}`;
    status.textContent = data.gthReadOnly && field.reason === "ready"
      ? "资料已对应，暂不可自动填写"
      : reasons[field.reason] || field.reason || "待处理";
    row.append(main, status);
    elements.list.append(row);
  }
  if (data.gthReadOnly) {
    const gap = Math.max(0, data.questionsInventoried - fields.length);
    setMessage(`国泰海通已查看 ${data.sectionsInspected} 个分区：盘点 ${data.questionsInventoried} 道题，匹配器识别 ${fields.length} 个控件${gap ? `，数量差 ${gap} 需人工查看未覆盖题目` : ""}。网页原值未变；自动填写尚未验收，填写按钮已禁用。`);
  }
  else if (!fields.length) setMessage("没有识别到可处理的表单字段。请确认已进入简历编辑页。", true);
  else if (data.cmbBasic && filled) setMessage(`招行基本信息试填并读回 ${writtenAndVerified} 项，页面原有同值 ${preexistingSame} 项，失败 ${failed} 项。未点击保存、提交或投递。请核对网页后再决定。`, failed > 0);
  else if (data.cmbBasic) setMessage(`识别到招行简历字段 ${fields.length} 项，其中 ${actionable} 项可试填。不会点击保存、提交或投递。`);
  else if (filled) setMessage(`本次新填并读回 ${writtenAndVerified} 项，页面原有同值 ${preexistingSame} 项，失败 ${failed} 项。请检查待处理项及网站保存状态，再决定是否提交。`, failed > 0);
  else setMessage(`识别到 ${fields.length} 个字段，其中 ${actionable} 项有已核对资料和明确对应。`);
}

function sectionForPath(path) {
  if (["fullName", "identityNumber", "gender", "height", "selfEvaluation", "birthDate", "email", "phone", "currentCity"].includes(path)) return "basic";
  if (["desiredRoles", "desiredCities", "expectedSalary", "availableDate", "availabilityNote"].includes(path)) return "preferences";
  for (const [prefix, section] of [["education.", "education"], ["experience.", "experience"], ["projects.", "projects"], ["familyMembers.", "family"], ["customAnswers.", "custom"], ["customScopedAnswers.", "custom"], ["resumeAttachment.", "materials"]]) {
    if (path?.startsWith(prefix)) return section;
  }
  return null;
}

async function collectQuestions() {
  if (busy || !lastInspection || !previewQuestions.length) return;
  setBusy(true);
  try {
    const tab = await getTab();
    if (tab.id !== lastInspection.tabId || tab.url !== lastInspection.tabUrl) {
      throw new Error("招聘页面已切换，请重新识别后再收集问题。");
    }
    const profile = await loadProfile();
    const { resumePendingQuestions } = await chrome.storage.local.get("resumePendingQuestions");
    const current = questionPreview(lastInspection.data.fields || [], profile, resumePendingQuestions, lastInspection.data.url).questions;
    if (JSON.stringify(current) !== JSON.stringify(previewQuestions)) {
      await render(lastInspection.data, lastInspection.filled);
      throw new Error("资料库已变化，问题清单已更新，请检查后再点击。");
    }
    const queued = Array.isArray(resumePendingQuestions) ? resumePendingQuestions
      .filter((item) => typeof item === "string" || (item && typeof item === "object")) : [];
    await chrome.storage.local.set({
      resumePendingQuestions: [...queued, ...current],
      resumeRequestedSection: "custom"
    });
    await chrome.runtime.openOptionsPage();
    setMessage(lastInspection.data.gthReadOnly
      ? `已送出 ${current.length} 个问题草稿。请在“网站补充问题”填写并确认；国泰海通目前仅支持重新识别。`
      : `已送出 ${current.length} 个问题草稿。请在“网站补充问题”填写并确认，再回招聘网页重新识别、填写。`);
  } catch (error) {
    setMessage(error?.message || "记录网站问题失败，请重试。", true);
  } finally {
    setBusy(false);
  }
}

async function perform(type) {
  if (busy) return;
  setBusy(true);
  try {
    if (type === "RESUME_FILL") {
      if (!lastInspection) {
        setMessage(fillOutcomeUncertain
          ? "上次填写结果未知。请先重新识别，并核对网页实际内容；本弹窗不会自动重发填写请求。"
          : "请先重新识别当前网页，再决定是否填写。", true);
        return;
      }
      const tab = await getTab();
      if (tab.id !== lastInspection.tabId || tab.url !== lastInspection.tabUrl) {
        lastInspection = null;
        setMessage("招聘页面已切换，请重新识别后再决定是否填写。", true);
        return;
      }
      if (fillOutcomeUncertain) {
        if (!window.confirm("上一次填写请求没有确认结果，可能仍在执行。请先核对网页当前内容，确认页面已停止变化；你确定要再发一次填写请求吗？")) {
          setMessage("已停止继续填写。上次结果未知，请核对网页当前内容后再决定。", true);
          return;
        }
      }
    }
    setMessage(type === "RESUME_FILL" ? "正在填写并逐项读回…" : "正在识别当前页面…");
    await render(await send(type), type === "RESUME_FILL");
    if (fillOutcomeUncertain) {
      setMessage("网页已重新识别，但上次填写请求是否仍在执行无法确定。请先核对网页内容和网站保存状态；确认页面停止变化后，才可继续填写。", true);
    }
  } catch (error) {
    lastInspection = null;
    previewQuestions = [];
    elements.drafts.hidden = true;
    if (type === "RESUME_FILL" && fillOutcomeUncertain) {
      pendingInspect = false;
      if (!error.fillNotStarted && !error.fillInterrupted
        && !(error instanceof PopupTimeoutError && error.stage === "fill_response")) {
        error.message += " 填写请求可能已执行或部分执行，请先核对网页实际内容，不要立即重试。";
      }
    }
    if(error?.message==="profile_binding_unavailable")error.message="暂时无法核对当前资料，已停止后续填写；已发出的操作请核对网站当前内容。";else if(/^profile_[a-z_]+(?:\s|$)/u.test(error?.message||""))error.message="客户资料已变化，已停止后续填写；已发出的操作请核对网站当前内容。";
    setMessage(String(error?.message || error), true);
  } finally {
    setBusy(false);
    if (pendingInspect) {
      pendingInspect = false;
      if (!activeTab || !isGthSite(activeTab.url))
        queueMicrotask(() => perform("RESUME_INSPECT"));
    }
  }
}

async function ownedGthResult(binding,promise){const result=await promise;await assertProfileBinding(chrome.storage.local,binding);return result;}

const gthSalaryErrors = {
  wrong_page: "当前不是国泰海通简历编辑页，未试填。",
  page_hidden: "网页在后台，未试填。请切回国泰海通页面。",
  fill_interrupted_page_hidden: "试填途中网页切到后台，结果待核对。",
  missing_or_unconfirmed_fact: "国泰海通“期望薪资”答案尚未单独核对，未试填。",
  section_structure_changed: "国泰海通分区结构已变化，未试填。",
  editor_structure_changed: "求职意向编辑器结构已变化，未继续试填。",
  edit_link_not_unique: "求职意向编辑入口无法唯一确定，未试填。",
  target_not_unique: "期望薪资题目不唯一，未试填。",
  target_not_plain_text: "期望薪资不是已验证的普通文本框，未试填。",
  target_has_existing_value: "网站的期望薪资已有内容，已保留原值。",
  value_too_long: "期望薪资答案超过网站字数限制，未试填。",
  original_value_changed: "原有资料在试填前发生变化，已停止。",
  editor_changed_after_fill: "试填后编辑器变化，读回未确认。",
  other_values_changed: "试填时其他网页字段发生变化，结果待核对。",
  readback_mismatch: "期望薪资读回不一致，结果待核对。",
  site_validation_failed: "期望薪资虽已显示，但网站仍提示校验错误，结果待核对。",
  browser_validation_failed: "网站对期望薪资显示校验问题，结果待核对。",
  fill_in_progress: "网页里已有填写在运行，本次未重复试填。"
};

// Status never carries an applicant value or sends a second fill instruction.
// A missing listener (page reload/extension reload), timeout, or mismatched ID
// keeps the durable tab marker, so an uncertain write cannot be retried.
async function reviewPendingGthSalary(tab, record) {
  if (tab.url !== GTH_RESUME_PAGE || record?.kind !== "gth_salary_trial"
    || typeof record.requestId !== "string") return "unknown";
  const profileBinding=record?.profileBinding;
  try{await assertProfileBinding(chrome.storage.local,profileBinding);}catch{return "unknown";}
  let response;
  try {
    response = await ownedGthResult(profileBinding,boundedChromeCall(() => chrome.tabs.sendMessage(tab.id,
      { type: "GTH_SALARY_STATUS", requestId: record.requestId }),
    INSPECT_TIMEOUT_MS, "inspect_response"));
  } catch { return "unknown"; }
  if (!response?.ok || response.data?.requestId !== record.requestId
    || response.data?.state !== "settled") return "unknown";
  const outcome = response.data.outcome;
  if (outcome !== "verified" && outcome !== "failed_before_write") return "unknown";
  await withProfileBinding(chrome.storage.local,profileBinding,()=>replacePendingReview(tab, record.requestId));
  const remaining = await pendingReviewFor(tab);
  fillOutcomeUncertain = !!remaining;
  gthPendingReview = remaining?.kind === "gth_salary_trial";
  if (!remaining) await withProfileBinding(chrome.storage.local,profileBinding,()=>rememberResult(tab, record.requestId, "gth_salary_trial",
    [{ status: outcome === "verified" ? "verified" : "skipped" }],
    outcome === "verified" ? "verified" : "stopped_before_write"));
  return fillOutcomeUncertain ? "unknown" : outcome;
}

function gthReviewMessage(outcome) {
  if (outcome === "verified") return "上次期望薪资试填已在当前编辑器重新读回一致；软件没有点击保存或投递。网站保存状态仍需单独核对。";
  if (outcome === "failed_before_write") return "上次试填已确认在写入前停止，没有填入期望薪资。可核对当前页面后再试。";
  return "上次试填仍在运行，或页面已重载、读回不一致；结果仍待核对，本次没有再次填写。";
}

async function performGthSalaryTrial() {
  if (busy) return;
  setBusy(true);
  let tab = null;
  let requestId = null;
  let previousPendingReview = null;
  try {
    const profileBinding=await captureProfileBinding(chrome.storage.local);
    tab = await getTab();
    const pending = await pendingReviewFor(tab);
    if (fillOutcomeUncertain) {
      const outcome = await reviewPendingGthSalary(tab, pending);
      setMessage(gthReviewMessage(outcome), outcome === "unknown");
      return;
    }
    const profile = await loadProfile();
    gthSalaryEligible = tab.url === GTH_RESUME_PAGE && confirmedGthSalary(profile);
    if (!gthSalaryEligible) throw new Error("此页尚无已核对的国泰海通专用期望薪资答案。");
    const origin = authorizationScope(tab.url);
    const { resumeTrustedOrigins } = await chrome.storage.local.get("resumeTrustedOrigins");
    const trusted = Array.isArray(resumeTrustedOrigins) ? resumeTrustedOrigins : [];
    if (!trusted.includes(origin)) {
      if (!window.confirm(`即将把已核对的期望薪资试填到 ${origin}。编辑器会保持打开，不点击网站保存或投递。`))
        throw new Error("已取消本次试填。");
      await withProfileBinding(chrome.storage.local,profileBinding,()=>chrome.storage.local.set({ resumeTrustedOrigins: [...trusted, origin].slice(-100) }));
    }
    await ownedGthResult(profileBinding,boundedChromeCall(() => dispatchBoundSource(chrome.storage.local,profileBinding,()=>chrome.scripting.executeScript({
      target: { tabId: tab.id }, files: ["src/core/matcher.js", "src/content/engine.js"]
    })), SCRIPT_TIMEOUT_MS, "script"));
    const [stillActive] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (stillActive?.id !== tab.id || stillActive.url !== tab.url)
      throw new Error("招聘网页已切换，未发送试填请求。");
    previousPendingReview = await pendingReviewFor(tab);
    requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await withProfileBinding(chrome.storage.local,profileBinding,()=>beginRecentRequest(tab, requestId));
    await withProfileBinding(chrome.storage.local,profileBinding,()=>chrome.storage.local.set({ [pendingFillReviewKey(tab.id)]: {
      tabId: tab.id, origin, at: Date.now(), requestId, profileBinding, kind: "gth_salary_trial"
    } }));
    showRecentResult(null);
    fillOutcomeUncertain = true;
    gthPendingReview = true;
    setMessage("正在试填期望薪资，并检查编辑器内的读回与其他字段…");
    // This site-specific route needs one answer, not the applicant's full
    // profile. Keep unrelated confirmed facts out of this page message.
    const salaryFact = profile.customFacts.find((item) =>
      normalizeQuestionKey(item?.question) === normalizeQuestionKey("期望薪资"));
    const scopedProfile = {
      customAnswers: { 期望薪资: profile.customAnswers.期望薪资 },
      customFacts: [{ question: salaryFact.question, answer: salaryFact.answer,
        sitePageUrl: salaryFact.sitePageUrl, sectionName: salaryFact.sectionName,
        rowContext: salaryFact.rowContext }],
      confirmedFields: ["customAnswers.期望薪资"]
    };
    const response = await ownedGthResult(profileBinding,boundedChromeCall(() => dispatchBoundSource(chrome.storage.local,profileBinding,()=>chrome.tabs.sendMessage(tab.id,
      { type: "GTH_SALARY_TRIAL", requestId, profileBinding, profile: scopedProfile })), FILL_TIMEOUT_MS, "fill_response"));
    if (!response?.ok) {
      if (response?.writeStarted === false && response.error !== "fill_in_progress") {
        const outcome = await reviewPendingGthSalary(tab, await pendingReviewFor(tab));
        if (outcome === "unknown" && response.error === "page_hidden") {
          // The page rejected this request before creating a trial record.
          await withProfileBinding(chrome.storage.local,profileBinding,()=>replacePendingReview(tab, requestId, previousPendingReview));
          const remaining = await pendingReviewFor(tab);
          fillOutcomeUncertain = !!remaining;
          gthPendingReview = remaining?.kind === "gth_salary_trial";
        }
      }
      throw new Error(gthSalaryErrors[response?.error]
        || "试填结果待核对；请查看网页编辑器，暂不要重复操作。");
    }
    if (response.data?.gthSalaryTrial !== true
      || response.data?.fields?.length !== 1
      || response.data.fields[0]?.status !== "verified"
      || response.data.savedOnSite !== null
      || response.data.softwareClickedSave !== false
      || response.data.softwareClickedSubmit !== false)
      throw new Error("试填读回结果不完整；请查看网页编辑器，暂不要重复操作。");
    const outcome = await reviewPendingGthSalary(tab, await pendingReviewFor(tab));
    if (outcome !== "verified") throw new Error(gthReviewMessage(outcome));
    await render({...response.data,profileBinding}, true);
    setMessage("期望薪资在当前编辑器内读回一致；试填期间其他已观察控件未变。软件没有点击保存或投递；网站保存状态尚未验证。");
  } catch (error) {
    if(error?.message==="profile_binding_unavailable")error.message="暂时无法核对当前资料，已停止后续填写；已发出的操作请核对网站当前内容。";else if(/^profile_/u.test(error?.message||""))error.message="客户资料已变化，已停止后续填写；已发出的操作请核对网站当前内容。";
    setMessage(error?.message || "期望薪资试填未完成，请核对当前网页。", true);
  } finally {
    setBusy(false);
  }
}

async function reviewPendingGthIntent(tab, record) {
  if (tab.url !== GTH_RESUME_PAGE || record?.kind !== "gth_intent_trial"
    || typeof record.requestId !== "string") return "unknown";
  const profileBinding = record?.profileBinding;
  try { await assertProfileBinding(chrome.storage.local, profileBinding); } catch { return "unknown"; }
  let response;
  try {
    await ownedGthResult(profileBinding, boundedChromeCall(() => dispatchBoundSource(chrome.storage.local, profileBinding, () => chrome.scripting.executeScript({
      target: { tabId: tab.id }, files: ["src/content/gth-intent.js"]
    })), SCRIPT_TIMEOUT_MS, "script"));
    response = await ownedGthResult(profileBinding, boundedChromeCall(() => chrome.tabs.sendMessage(tab.id, {
      type: "GTH_INTENT_FILL_STATUS", requestId: record.requestId, profileBinding
    }), INSPECT_TIMEOUT_MS, "inspect_response"));
  } catch { return "unknown"; }
  if (!response?.ok || response.data?.requestId !== record.requestId
    || response.data?.state !== "settled") return "unknown";
  const outcome = response.data.outcome;
  if (outcome !== "verified" && outcome !== "verified_preexisting" && outcome !== "failed_before_write") return "unknown";
  await withProfileBinding(chrome.storage.local, profileBinding, () => replacePendingReview(tab, record.requestId));
  const remaining = await pendingReviewFor(tab);
  fillOutcomeUncertain = !!remaining;
  gthIntentPendingReview = remaining?.kind === "gth_intent_trial";
  if (!remaining) await withProfileBinding(chrome.storage.local, profileBinding, () => rememberResult(tab, record.requestId, "gth_intent_trial",
    [{ status: outcome === "failed_before_write" ? "skipped" : "verified" }],
    outcome === "failed_before_write" ? "stopped_before_write" : "verified"));
  return fillOutcomeUncertain ? "unknown" : outcome;
}

function gthIntentReviewMessage(outcome) {
  if (outcome === "verified")
    return "上次求职意向五项已在当前编辑器重新读回一致；软件没有点击保存或投递，网站保存状态待核对。";
  if (outcome === "failed_before_write")
    return "上次五项试填已确认在写入前停止；核对当前页面后可以重新试填。";
  return "上次五项试填可能仍在运行，或页面已刷新、读回不一致；本页已锁定，没有再次填写。";
}

const gthIntentErrors = {
  license_required: "授权核验未通过，本次没有填写。",
  wrong_page: "当前不是国泰海通简历编辑页，未试填。",
  page_hidden: "网页在后台，未试填。请切回国泰海通页面。",
  page_not_ready: "招聘网页尚未加载完成，未试填。",
  section_structure_changed: "国泰海通分区结构已变化，未试填。",
  other_section_editor_open: "其他分区仍有打开的编辑器，已停止求职意向试填（未点保存）。",
  intent_editor_not_unique: "求职意向编辑器无法唯一确定，未试填。",
  intent_edit_not_unique: "求职意向编辑入口无法唯一确定，未试填。",
  intent_target_not_unique: "期望薪资题目不唯一，未试填。",
  intent_target_not_plain_text: "期望薪资不是已验证的普通文本框，未试填。",
  intent_value_too_long: "期望薪资答案超过网站字数限制，未试填。",
  intent_other_values_changed: "试填时其他网页字段发生变化，结果待核对。",
  intent_readback_mismatch: "期望薪资读回不一致，结果待核对。",
  intent_site_validation_failed: "期望薪资虽已显示，但网站仍提示校验错误，结果待核对。",
  control_not_supported: "没有录到编辑器控件的求职意向项已记为失败。本次不记为完成，没有点击保存或投递。",
  picker_label_ambiguous: "求职意向里有重名的题目，未猜选，没有保存。",
  picker_structure_changed: "求职意向的选择控件结构已变化，未填写，没有保存。",
  picker_level1_missing: "没有找到精确的一级选项，已关闭选择框，没有保存。",
  picker_level2_missing: "点击一级后没有出现精确的二级选项，已关闭选择框，没有保存。",
  picker_selection_limit: "该选择已达数量上限，未改选，没有保存。",
  picker_existing_selection_conflict: "该题已有其他选项，未取消原选项，没有保存。",
  picker_readback_mismatch: "选择后读回不一致，已关闭选择框，没有保存。",
  select_option_missing: "到岗日期没有对应选项，没有保存。",
  select_option_ambiguous: "到岗日期有多个相同选项，未猜选，没有保存。",
  select_structure_changed: "到岗日期的下拉结构已变化，未填写，没有保存。",
  existing_value: "网站的期望薪资已有不同内容，已保留原值。本次不记为完成，没有点击保存或投递。",
  missing_profile_value: "求职意向答案不完整，没有向网页发送填写。",
  profile_fact_unconfirmed: "求职意向答案尚未限定本页或未核对，没有向网页发送填写。",
  fill_in_progress: "网页里已有填写在运行，本次未重复试填。"
};

async function performGthIntentTrial() {
  if (busy) return;
  setBusy(true);
  let tab = null;
  let requestId = null;
  try {
    const profileBinding = await captureProfileBinding(chrome.storage.local);
    const active = await chrome.tabs.query({ active: true, currentWindow: true });
    if (active.length !== 1) throw new Error("当前 Edge 窗口的活动页面不唯一，已停止。");
    tab = await getTab();
    if (tab.url !== GTH_RESUME_PAGE || active[0].id !== tab.id || active[0].url !== tab.url)
      throw new Error("请进入国泰海通准确的简历编辑页，未试填。");
    const pending = await pendingReviewFor(tab);
    if (pending?.kind === "gth_intent_trial") {
      const outcome = await reviewPendingGthIntent(tab, pending);
      setMessage(gthIntentReviewMessage(outcome), outcome === "unknown");
      return;
    }
    if (fillOutcomeUncertain || pending)
      throw new Error("本页已有其他结果待核对的填写请求；求职意向试填保持锁定。");
    const profile = await loadProfile();
    gthIntentEligible = confirmedGthIntent(profile);
    if (!gthIntentEligible) throw new Error(gthIntentGapsZh(profile));
    const payload = intentFillPayload(profile);
    const origin = authorizationScope(tab.url);
    const { resumeTrustedOrigins } = await chrome.storage.local.get("resumeTrustedOrigins");
    const trusted = Array.isArray(resumeTrustedOrigins) ? resumeTrustedOrigins : [];
    if (!trusted.includes(origin)) {
      if (!window.confirm(`即将把已核对的求职意向试填到 ${origin}。没有录到控件的项会失败，不点击网站保存或投递。`))
        throw new Error("已取消本次试填。");
      await withProfileBinding(chrome.storage.local, profileBinding, () => chrome.storage.local.set({ resumeTrustedOrigins: [...trusted, origin].slice(-100) }));
    }
    await ownedGthResult(profileBinding, boundedChromeCall(() => dispatchBoundSource(chrome.storage.local, profileBinding, () => chrome.scripting.executeScript({
      target: { tabId: tab.id }, files: ["src/content/gth-intent.js"]
    })), SCRIPT_TIMEOUT_MS, "script"));
    const activeAgain = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeAgain.length !== 1 || activeAgain[0].id !== tab.id || activeAgain[0].url !== tab.url)
      throw new Error("招聘网页已切换，未发送试填请求。");
    const fresh = await loadProfile();
    if (!confirmedGthIntent(fresh)) throw new Error("资料库已变化，未发送试填指令。");
    if (await pendingReviewFor(tab)) throw new Error("本页已有待核对请求，未重复试填。");
    requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await withProfileBinding(chrome.storage.local, profileBinding, () => beginRecentRequest(tab, requestId));
    await withProfileBinding(chrome.storage.local, profileBinding, () => chrome.storage.local.set({ [pendingFillReviewKey(tab.id)]: {
      tabId: tab.id, origin, at: Date.now(), requestId, profileBinding, kind: "gth_intent_trial"
    } }));
    showRecentResult(null);
    fillOutcomeUncertain = true;
    gthIntentPendingReview = true;
    setMessage("正在试填求职意向并逐项读回；不点击保存或投递…");
    const response = await ownedGthResult(profileBinding, boundedChromeCall(() => dispatchBoundSource(chrome.storage.local, profileBinding, () => chrome.tabs.sendMessage(tab.id, {
      type: GTH_INTENT_FILL_TYPE, requestId, profileBinding, replaceExisting: false,
      answers: payload.answers, profile: payload.profile
    })), FILL_TIMEOUT_MS, "fill_response"));
    const assessed = assessGthIntentFill(response || {});
    if (!assessed.ok) {
      if (assessed.writeStarted !== true) await reviewPendingGthIntent(tab, await pendingReviewFor(tab));
      throw new Error(gthIntentErrors[assessed.reason] || gthIntentErrors[response?.reason]
        || "求职意向试填结果待核对；请查看网页编辑器，暂不要重复操作。不会保存或投递。");
    }
    const outcome = await reviewPendingGthIntent(tab, await pendingReviewFor(tab));
    if (outcome !== "verified" && outcome !== "verified_preexisting") throw new Error(gthIntentReviewMessage(outcome));
    setMessage("求职意向各项在当前编辑器内读回一致。软件没有点击保存或投递；网站保存状态尚未验证。");
  } catch (error) {
    if(error?.message==="profile_binding_unavailable")error.message="暂时无法核对当前资料，已停止后续填写；已发出的操作请核对网站当前内容。";else if(/^profile_/u.test(error?.message||""))error.message="客户资料已变化，已停止后续填写；已发出的操作请核对网站当前内容。";
    setMessage(error?.message || "求职意向试填未完成，请核对当前网页。", true);
  } finally {
    setBusy(false);
  }
}

const gthEducationErrors = {
  license_required: "授权核验未通过，本次没有填写。",
  education_binding_invalid: "所选资料记录无效或已变化，未试填。",
  education_replacement_requires_binding: "重填已有内容前必须明确选择资料记录。",
  education_date_range_invalid: "本段教育的开始和结束时间顺序不正确，未试填。",
  education_widget_timeout: "教育选择器未在限时内响应，已停止后续填写。",
  education_other_menu_open: "页面有其他未关闭菜单，已停止填写。",
  education_option_ambiguous: "网站有多个相同选项，未猜选。",
  education_option_disabled: "对应的网站选项不可选，已停止填写。",
  education_month_year_unknown: "日期面板的年份无法确认，已停止填写。",
  education_category_path_incomplete: "专业类别还需要完整的分类路径，未选错层级。",
  education_category_existing_selection_unknown: "专业类别已有其他选择，暂未覆盖。",
  education_category_overwrite_guard: "专业类别覆盖时页面值变化超出安全范围，已跳过该项。",
  education_category_structure_changed: "专业类别控件结构已变化，已跳过该项；其他可填项继续。",
  wrong_page: "当前不是国泰海通简历编辑页，未试填。",
  page_not_ready: "招聘网页尚未加载完成，未试填。",
  page_hidden: "招聘网页在后台，未试填。",
  section_structure_changed: "教育分区结构与验证时不同，未试填。",
  editor_structure_changed: "当前有其他编辑器或教育编辑器结构已变化，未试填。",
  other_section_editor_open: "其他分区仍有打开的编辑器，已停止教育试填（未点保存）。",
  education_record_count_changed: "网站教育记录数量已变化，需要重新识别。",
  education_edit_not_unique: "教育记录的编辑入口无法唯一确定。",
  education_editor_not_safe: "打开教育记录后无法确认其他原值安全，未试填。",
  unmarked_education_editor: "已有教育编辑器无法确认属于哪条记录，未试填。",
  education_target_not_unique: "学校或专业题目无法唯一定位。",
  education_target_not_plain_text: "学校或专业不是已验证的普通文字框。",
  row_mapping_unknown: "网站教育记录与资料库记录无法唯一匹配，未猜测或覆盖。",
  original_value_changed: "试填前页面原值发生变化，已停止。",
  education_editor_changed_after_fill: "试填后教育编辑器发生变化，结果待核对。",
  other_values_changed: "试填时其他控件发生变化，结果待核对。",
  readback_mismatch: "学校或专业读回不一致，结果待核对。",
  site_validation_failed: "网站对试填结果提示校验错误，结果待核对。",
  fill_in_progress: "教育记录已有填写运行，未重复发送。"
};

const gthEducationStepLabels = {
  not_started: "尚未开始", request_validation: "检查填写请求", page_preflight: "检查网页状态",
  editor_open: "打开教育编辑器", target_preflight: "检查字段控件", row_binding: "核对教育记录对应",
  field_decision: "核对字段答案", field_guard: "复核写入条件", radio_option_click: "选择是否统招",
  text_input_events: "填写文字", field_readback: "读取填写结果",
  degree_open: "打开学历选项", degree_option_lookup: "查找学历选项", degree_option_click: "选择学历",
  degree_close: "等待学历选项关闭", month_open: "打开月份面板", month_year_read: "读取月份面板年份",
  month_year_navigation: "切换月份面板年份", month_option_lookup: "查找目标月份",
  month_option_click: "选择目标月份", month_close: "等待月份面板关闭",
  category_open: "打开专业类别", category_option_lookup: "查找专业类别",
  category_deselect: "取消原专业类别选项", category_reopen: "重新打开专业类别",
  category_reselect_search: "搜索原专业类别", category_reselect_lookup: "查找原专业类别",
  category_reselect_click: "重新选择专业类别", category_confirm: "确认专业类别",
  category_option_click: "选择专业类别", category_search: "搜索专业类别",
  category_path_lookup: "查找专业类别层级", category_path_expand: "展开专业类别层级",
  category_close: "等待专业类别关闭", complete: "完成逐项读回"
};

function gthEducationFailureMessage(response, full) {
  if (response?.reason === "license_required") {
    const licenseMessages = {
      NOT_ACTIVATED: "尚未激活授权。请打开「授权激活」页粘贴经营者签发的令牌。",
      LICENSE_REVOKED: "许可已停用。如需继续使用，请联系经营者重新签发。",
      LICENSE_EXPIRED: "许可已过期。请向经营者申请续期令牌后重新激活。",
      DEVICE_REVOKED: "本机授权已撤销，无法在此浏览器继续填写。",
      SERVER_UNAVAILABLE: "暂时无法连接授权服务，请稍后重试。",
      BINDING_MISMATCH: "授权与本机不匹配（installId 或席位绑定不符）。",
      CONFIG_MISSING: "授权配置缺失，无法核验。",
    };
    return licenseMessages[response.licenseCode] || gthEducationErrors.license_required;
  }
  const message = gthEducationErrors[response?.reason]
    || "教育试填结果待核对；本页已锁定，避免重复改写。";
  if (!full) return message;
  const field = GTH_EDUCATION_FULL_FIELDS.find(([, key]) => key === response?.activeField)?.[0];
  const step = Object.hasOwn(gthEducationStepLabels, response?.selectorStep)
    ? gthEducationStepLabels[response.selectorStep] : null;
  const location = [field ? `字段：${field}` : "", step ? `步骤：${step}` : ""].filter(Boolean);
  return location.length ? `${message} 失败位置：${location.join("；")}。` : message;
}

async function reviewPendingGthEducation(tab, record) {
  if (tab.url !== GTH_RESUME_PAGE
    || !["gth_education_trial", "gth_education_full_trial"].includes(record?.kind)
    || typeof record.requestId !== "string") return "unknown";
  const profileBinding=record?.profileBinding;
  try{await assertProfileBinding(chrome.storage.local,profileBinding);}catch{return "unknown";}
  let response;
  try {
    response = await ownedGthResult(profileBinding,boundedChromeCall(() => chrome.tabs.sendMessage(tab.id,
      { type: record.kind === "gth_education_full_trial"
        ? "GTH_EDUCATION_FULL_TRIAL_STATUS" : "GTH_EDUCATION_TEXT_TRIAL_STATUS",
      requestId: record.requestId }),
    INSPECT_TIMEOUT_MS, "inspect_response"));
  } catch { return "unknown"; }
  if (!response?.ok || response.data?.requestId !== record.requestId
    || response.data?.state !== "settled") return "unknown";
  const outcome = response.data.outcome;
  if (!["verified", "verified_preexisting", "failed_before_write"].includes(outcome)) return "unknown";
  await withProfileBinding(chrome.storage.local,profileBinding,()=>replacePendingReview(tab, record.requestId));
  const remaining = await pendingReviewFor(tab);
  fillOutcomeUncertain = !!remaining;
  gthEducationPendingReview = ["gth_education_trial", "gth_education_full_trial"].includes(remaining?.kind);
  gthEducationPendingRow = gthEducationPendingReview ? remaining.rowIndex : null;
  gthEducationPendingFull = gthEducationPendingReview && remaining.kind === "gth_education_full_trial";
  if (!remaining) await withProfileBinding(chrome.storage.local,profileBinding,()=>rememberResult(tab, record.requestId, record.kind,
    outcome === "verified" ? [{ status: "verified" }] : [],
    outcome === "failed_before_write" ? "stopped_before_write" : "readback_complete"));
  return fillOutcomeUncertain ? "unknown" : outcome;
}

function gthEducationReviewMessage(outcome, full = false) {
  if (outcome === "verified")
    return full ? "上次教育运行已在当前编辑器重新读回一致；完整性请看逐项结果，网站保存和刷新仍需核对。"
      : "上次教育文字项在当前编辑器读回一致；软件没有保存或投递。学历、日期等项目仍待验证。";
  if (outcome === "verified_preexisting")
    return "网站教育文字项原本已有相同内容，本次软件新增 0 项；原值已读回。学历、日期等项目仍待验证。";
  if (outcome === "failed_before_write")
    return "上次教育文字项试填已确认在写入前停止。原有网站记录没有被软件保存或删除。";
  return "上次教育试填结果仍不明确，本页已锁定；先核对当前网页，避免重复改写。";
}

async function showGthEducationJob(job, tab, historical = false) {
  await assertProfileBinding(chrome.storage.local,job?.profileBinding);
  if (["completed", "stopped_before_write"].includes(job?.state) && Array.isArray(job.fields)) {
    fillOutcomeUncertain = !!(await pendingReviewFor(tab));
    gthEducationPendingReview = fillOutcomeUncertain;
    await render({ profileBinding:job.profileBinding, url: tab.url, title: tab.title || "国泰海通简历",
      fields: job.fields.map((field) => ({ id: `gth:教育经历:${job.rowIndex}:${field.question}`,
        labels: [field.question], path: field.path, status: field.status, reason: field.reason })) }, true);
    const counts = job.counts || {};
    const remaining = job.fields.filter((field) => field.status !== "verified").length;
    await populateGthEducationTargets(tab);
    await gthDraftActions.prepare(tab);
    await assertProfileBinding(chrome.storage.local,job.profileBinding);
    setMessage(`${historical ? "上次后台记录：" : ""}本段教育${job.complete ? "全部项目读回一致" : "仍有项目待处理"}：软件新填 ${counts.newlyFilled || 0}，重填已有内容 ${counts.reapplied || 0}，原有同值 ${counts.originalSame || 0}，待处理 ${remaining}。${historical ? "网页刷新后请重新识别并核对当前内容。" : ""}网站保存和刷新状态仍需核对。`, !job.complete);
    return;
  }
  if (job?.state === "stopped_before_write") {
    fillOutcomeUncertain = !!(await pendingReviewFor(tab));
    gthEducationPendingReview = fillOutcomeUncertain;
    setMessage(`教育后台任务在写入前停止。${gthEducationFailureMessage(job, true)}`, true);
    return;
  }
  setMessage(job?.state === "unknown" ? gthEducationFailureMessage(job, true)
    : "教育任务已交给后台继续执行；关闭弹窗也不会中断。请保持招聘页面可见，完成后可重新打开弹窗查看。", job?.state === "unknown");
}

function startGthEducationFullJob(rowIndex) {
  if (busy) return;
  const prepared = gthEducationJobSnapshot, profileIndex = selectedGthEducationProfileIndex();
  const targetMode = rowIndex === "new" ? "new" : "existing";
  const replaceExisting = targetMode === "new" ? false : elements.gthEducationReplace.checked;
  const candidate = prepared?.candidates.find((item) => item.profileIndex === profileIndex);
  if (!prepared || activeTab?.id !== prepared.tab.id || activeTab.url !== GTH_RESUME_PAGE || !candidate) {
    setMessage("请等待资料加载并选择要使用的教育记录；软件不会猜记录顺序。", true);
    return;
  }
  let originConfirmed = prepared.trusted;
  if (!originConfirmed) {
    originConfirmed = window.confirm(`即将在 https://hr.gtht.com 试填一段教育的全部 12 项，并逐项读回。${replaceExisting ? "已勾选重填已有内容，将使用选定资料重新填写这条记录。" : "未勾选重填已有内容，只填空项并核对已有值。"}不会保存或投递。`);
    if (!originConfirmed) { setMessage("已取消本次试填。", true); return; }
  }
  setBusy(true);
  setMessage(`正在逐项填写并读回本段教育的 12 项；${replaceExisting ? "已启用已有内容重填" : "未启用已有内容重填，只填空项并核对原值"}；后台执行，不保存、不投递…`);
  let queued;
  try {
    // Deliberately before every await: an action popup may disappear as soon
    // as the website receives focus. The worker owns all asynchronous work.
    queued = chrome.runtime.sendMessage({ type: "GTH_EDUCATION_FULL_JOB_START",
      tabId: prepared.tab.id, pageUrl: GTH_RESUME_PAGE, rowIndex: targetMode === "new" ? null : rowIndex, profileIndex, targetMode,
      replaceExisting, candidateSnapshot: structuredClone(candidate), originConfirmed, profileBinding:prepared.profileBinding });
  } catch {
    setBusy(false);setMessage("教育后台任务未能排队，请重新打开扩展后查看。", true);return;
  }
  return (async () => {
    try {
      const accepted = await queued;
      if (!accepted?.ok || !accepted.accepted) {
        setMessage("教育任务未开始：本页可能已有运行或待核对结果，请检查后再试。", true);return;
      }
      prepared.trusted = true;
      fillOutcomeUncertain = true;gthEducationPendingReview = true;
      gthEducationPendingRow = rowIndex;gthEducationPendingFull = true;
      for (let attempt = 0; attempt < 400; attempt += 1) {
        const key = `resumeEducationJob:${prepared.tab.id}`;
        const job = (await chrome.storage.local.get(key))[key];
        if (job?.requestId === accepted.requestId && ["completed", "unknown", "stopped_before_write"].includes(job.state)) {
          await showGthEducationJob(job, prepared.tab);return;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      setMessage("教育后台任务仍需核对。请保持网页可见并稍后重新打开扩展；不会自动重复填写。", true);
    } catch { setMessage("弹窗未收到后台结果；任务可能仍在执行，重新打开后查看，不要重复填写。", true); }
    finally { setBusy(false); }
  })();
}

async function performGthEducationTrial(rowIndex, full = false) {
  if (full) return startGthEducationFullJob(rowIndex);
  if (busy) return;
  setBusy(true);
  try {
    const profileBinding=await captureProfileBinding(chrome.storage.local);
    const active = await chrome.tabs.query({ active: true, currentWindow: true });
    if (active.length !== 1) throw new Error("当前 Edge 活动页不唯一，未试填。");
    const tab = await getTab();
    if (tab.url !== GTH_RESUME_PAGE || active[0].id !== tab.id || active[0].url !== tab.url)
      throw new Error("请进入国泰海通准确的简历编辑页，未试填。");
    const pending = await pendingReviewFor(tab);
    if (["gth_education_trial", "gth_education_full_trial"].includes(pending?.kind)) {
      const outcome = await reviewPendingGthEducation(tab, pending);
      setMessage(gthEducationReviewMessage(outcome, pending.kind === "gth_education_full_trial"), outcome === "unknown");
      return;
    }
    if (fillOutcomeUncertain || pending)
      throw new Error("本页有其他填写结果待核对，教育试填保持锁定。");
    const educationProfile = await loadProfile();
    const candidates = full ? confirmedGthEducationFullCandidates(educationProfile)
      : confirmedGthEducationCandidates(educationProfile);
    const profileIndex = full ? selectedGthEducationProfileIndex() : null;
    const replaceExisting = full && elements.gthEducationReplace.checked;
    gthEducationEligible = candidates.length > 0;
    if (!gthEducationEligible) throw new Error("教育资料中尚无已核对的学校和专业，未试填。");
    if (full && !candidates.some((candidate) => candidate.profileIndex === profileIndex))
      throw new Error("请先选择要使用的资料库教育记录，软件不会猜记录顺序。");
    const origin = authorizationScope(tab.url);
    const { resumeTrustedOrigins } = await chrome.storage.local.get("resumeTrustedOrigins");
    const trusted = Array.isArray(resumeTrustedOrigins) ? resumeTrustedOrigins : [];
    if (!trusted.includes(origin)) {
      const description = full
        ? `试填一段教育的全部 12 项：学校、专业、学历、开始和结束时间、专业类别、是否统招、在校活动或职务、成绩排名、专业描述、绩点、学校所在地，并逐项读回。${replaceExisting ? "已勾选重填已有内容，将使用选定资料重新填写这条记录。" : "未勾选重填已有内容，只填空项并核对已有值。"}`
        : "试填一段教育的空白学校或专业，并逐项读回。";
      if (!window.confirm(`即将在 ${origin} ${description}不会保存或投递。`))
        throw new Error("已取消本次试填。");
      await withProfileBinding(chrome.storage.local,profileBinding,()=>chrome.storage.local.set({ resumeTrustedOrigins: [...trusted, origin].slice(-100) }));
    }
    await ownedGthResult(profileBinding,boundedChromeCall(() => dispatchBoundSource(chrome.storage.local,profileBinding,()=>chrome.scripting.executeScript({
      target: { tabId: tab.id }, files: ["src/content/gth-education.js"]
    })), SCRIPT_TIMEOUT_MS, "script"));
    const activeAgain = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeAgain.length !== 1 || activeAgain[0].id !== tab.id || activeAgain[0].url !== tab.url)
      throw new Error("招聘网页已切换，未发送教育试填指令。");
    const freshProfile = await loadProfile();
    const fresh = full ? confirmedGthEducationFullCandidates(freshProfile)
      : confirmedGthEducationCandidates(freshProfile);
    if (JSON.stringify(fresh) !== JSON.stringify(candidates))
      throw new Error("教育资料已变化，未发送试填指令。");
    if (full && selectedGthEducationProfileIndex() !== profileIndex)
      throw new Error("选用的教育记录已变化，未发送试填指令。");
    if (full && elements.gthEducationReplace.checked !== replaceExisting)
      throw new Error("教育记录的重填选项已变化，未发送试填指令。");
    if (await pendingReviewFor(tab)) throw new Error("本页已有待核对请求，未重复试填。");
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await withProfileBinding(chrome.storage.local,profileBinding,()=>beginRecentRequest(tab, requestId));
    await withProfileBinding(chrome.storage.local,profileBinding,()=>chrome.storage.local.set({ [pendingFillReviewKey(tab.id)]: {
      tabId: tab.id, origin, at: Date.now(), requestId,
      profileBinding, kind: full ? "gth_education_full_trial" : "gth_education_trial", rowIndex
    } }));
    showRecentResult(null);
    fillOutcomeUncertain = true;
    gthEducationPendingReview = true;
    gthEducationPendingRow = rowIndex;
    gthEducationPendingFull = full;
    setMessage(full
      ? `正在逐项填写并读回本段教育的 12 项；${replaceExisting ? "已启用已有内容重填" : "未启用已有内容重填，只填空项并核对原值"}；不保存、不投递…`
      : "正在用已核对的教育资料试填空白文字项并读回；不保存、不投递…");
    const response = await ownedGthResult(profileBinding,boundedChromeCall(() => dispatchBoundSource(chrome.storage.local,profileBinding,()=>chrome.tabs.sendMessage(tab.id, {
      type: full ? "GTH_EDUCATION_FULL_TRIAL" : "GTH_EDUCATION_TEXT_TRIAL", requestId, rowIndex,
      profileBinding, educationCandidates: candidates, ...(full ? { profileIndex, replaceExisting } : {})
    })), FILL_TIMEOUT_MS, "fill_response"));
    if (!response?.ok) {
      if (response?.writeStarted === false && response.reason !== "fill_in_progress")
        await reviewPendingGthEducation(tab, await pendingReviewFor(tab));
      throw new Error(gthEducationFailureMessage(response, full));
    }
    const fields = response.fields;
    const expected = full ? GTH_EDUCATION_FULL_FIELDS : GTH_EDUCATION_FULL_FIELDS.slice(0, 2);
    const valid = response.editorLeftOpen === true && response.savedOnSite === null
      && response.submitted === null && response.softwareClickedSave === false
      && response.softwareClickedSubmit === false && response.softwareClickedDelete === false
      && Array.isArray(fields) && fields.length === expected.length
      && expected.every(([question, key]) => {
        const matches = fields.filter((field) => field.question === question);
        return matches.length === 1 && candidates.some((candidate) =>
          matches[0].path === `education.${candidate.profileIndex}.${key}`);
      })
      && new Set(fields.map((field) => field.path.split(".")[1])).size === 1
      && (!full || fields.every((field) => field.path.split(".")[1] === String(profileIndex)))
      && fields.every((field) => field.status === "verified"
        ? ["readback_matched", "preexisting_same_value", ...(full ? ["readback_reapplied"] : [])].includes(field.reason)
        : full && field.status === "skipped" && ["missing_profile_value", "profile_fact_unconfirmed",
          "control_not_supported", "existing_value", "site_control_disabled",
          "education_category_structure_changed",
          "education_category_existing_selection_unknown","education_category_overwrite_guard"].includes(field.reason));
    if (!valid) throw new Error("教育文字项没有形成完整的新填读回证据；本页仍需核对。");
    const outcome = await reviewPendingGthEducation(tab, await pendingReviewFor(tab));
    if (outcome !== "verified" && outcome !== "verified_preexisting"
      && !(full && outcome === "failed_before_write" && response.writeStarted === false))
      throw new Error(gthEducationReviewMessage(outcome, full));
    await render({ profileBinding, url: tab.url, title: tab.title || "国泰海通简历",
      fields: fields.map((field) => ({ id: `gth:教育经历:${rowIndex}:${field.question}`,
        labels: [field.question], path: field.path, status: field.status, reason: field.reason })),
      savedOnSite: null, softwareClickedSave: false, softwareClickedSubmit: false }, true);
    if (full) {
      const newlyFilled = fields.filter((field) => field.reason === "readback_matched").length;
      const rewritten = fields.filter((field) => field.reason === "readback_reapplied").length;
      const original = fields.filter((field) => field.reason === "preexisting_same_value").length;
      const remaining = fields.filter((field) => field.status !== "verified").length;
      const complete = response.complete === true && remaining === 0;
      setMessage(`本段教育${complete ? "全部项目读回一致" : "仍有项目待处理"}：软件新填 ${newlyFilled}，重填已有内容 ${rewritten}，原有同值 ${original}，待处理 ${remaining}。网站保存和刷新状态仍需核对。`, !complete);
    } else setMessage(outcome === "verified_preexisting"
      ? "网站教育学校和专业原本已有相同内容；本次软件新增 0 项。学历、日期等仍未验收，没有保存或投递。"
      : "教育学校和专业已逐项读回：本次新填与网站原值分开记录。编辑器保持打开；学历、日期等仍未验收，也没有保存或投递。");
  } catch (error) {
    if(error?.message==="profile_binding_unavailable")error.message="暂时无法核对当前资料，已停止后续填写；已发出的操作请核对网站当前内容。";else if(/^profile_/u.test(error?.message||""))error.message="客户资料已变化，已停止后续填写；已发出的操作请核对网站当前内容。";
    setMessage(error?.message || "教育文字项试填未完成，请核对当前网页。", true);
  } finally { setBusy(false); }
}

const gthSimpleErrors = {
  wrong_page: "当前不是国泰海通简历编辑页，未试填。",
  page_not_ready: "网页尚未加载完，未试填。",
  page_hidden: "网页在后台，未继续试填。",
  page_reloaded: "试填时网页已刷新，结果待核对。",
  unsupported_section: "当前分区未开放试填。",
  invalid_test_answer: "职业技能与特长的已确认答案不可用。",
  section_structure_changed: "国泰海通七个分区结构已变化。",
  editor_structure_changed: "网页已有其他编辑器或编辑器结构已变化。",
  edit_link_not_unique: "职业技能与特长的编辑入口无法唯一确定。",
  target_not_unique: "职业技能与特长题目不唯一。",
  target_not_plain_textarea: "目标不是已验证的普通文本域。",
  value_too_long: "答案超过网站字数限制。",
  original_value_changed: "网页原值在试填前发生变化。",
  editor_changed_after_fill: "试填后编辑器变化，读回未确认。",
  other_values_changed: "试填时其他网页字段发生变化，结果待核对。",
  readback_mismatch: "职业技能与特长读回不一致，结果待核对。",
  site_validation_failed: "网站对这段内容仍显示校验错误。",
  fill_in_progress: "网页里已有试填在运行，本次没有重复发送。"
};

// A timeout or uncertain post-write result leaves the durable tab marker in
// place. This narrow route has no automatic retry or guessed recovery.
async function performGthSimpleTrial() {
  if (busy) return;
  setBusy(true);
  let tab = null;
  let requestId = null;
  try {
    const profileBinding=await captureProfileBinding(chrome.storage.local);
    const active = await chrome.tabs.query({ active: true, currentWindow: true });
    if (active.length !== 1) throw new Error("当前 Edge 窗口的活动页面不唯一，已停止。");
    tab = await getTab();
    if (tab.url !== GTH_RESUME_PAGE || active[0].id !== tab.id || active[0].url !== tab.url)
      throw new Error("请进入国泰海通准确的简历编辑页，未试填。");
    if (fillOutcomeUncertain || await pendingReviewFor(tab))
      throw new Error("本页已有结果待核对的填写请求；为避免重复改写，职业技能试填保持锁定。");
    const profile = await loadProfile();
    gthSimpleEligible = confirmedGthSimple(profile);
    if (!gthSimpleEligible) throw new Error("此页尚无已核对且限定本站分区的“职业技能与特长”答案。");
    const answer = profile.customAnswers[GTH_SIMPLE_SECTION];
    const origin = authorizationScope(tab.url);
    const { resumeTrustedOrigins } = await chrome.storage.local.get("resumeTrustedOrigins");
    const trusted = Array.isArray(resumeTrustedOrigins) ? resumeTrustedOrigins : [];
    if (!trusted.includes(origin)) {
      if (!window.confirm(`即将把已核对的职业技能与特长答案试填到 ${origin}。只读回、不点击网站保存或投递。`))
        throw new Error("已取消本次试填。");
      await withProfileBinding(chrome.storage.local,profileBinding,()=>chrome.storage.local.set({ resumeTrustedOrigins: [...trusted, origin].slice(-100) }));
    }
    await ownedGthResult(profileBinding,boundedChromeCall(() => dispatchBoundSource(chrome.storage.local,profileBinding,()=>chrome.scripting.executeScript({
      target: { tabId: tab.id }, files: ["src/content/gth-simple-section.js"]
    })), SCRIPT_TIMEOUT_MS, "script"));
    const activeAgain = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeAgain.length !== 1 || activeAgain[0].id !== tab.id || activeAgain[0].url !== tab.url)
      throw new Error("招聘网页已切换，本次没有发送试填指令。");
    const fresh = await loadProfile();
    if (!confirmedGthSimple(fresh) || fresh.customAnswers[GTH_SIMPLE_SECTION] !== answer)
      throw new Error("资料库已变化，本次没有发送试填指令。");
    if (await pendingReviewFor(tab)) throw new Error("本页已有待核对请求，本次没有重复试填。");
    requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await withProfileBinding(chrome.storage.local,profileBinding,()=>beginRecentRequest(tab, requestId));
    await withProfileBinding(chrome.storage.local,profileBinding,()=>chrome.storage.local.set({ [pendingFillReviewKey(tab.id)]: {
      tabId: tab.id, origin, at: Date.now(), requestId, profileBinding, kind: "gth_simple_section_trial"
    } }));
    showRecentResult(null);
    fillOutcomeUncertain = true;
    setMessage("正在试填职业技能与特长，并核对网站原有内容…");
    const replies = await ownedGthResult(profileBinding,boundedChromeCall(() => dispatchBoundSource(chrome.storage.local,profileBinding,()=>chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (payload) => typeof globalThis.ResumeGthSimpleSection?.fill === "function"
        ? globalThis.ResumeGthSimpleSection.fill(payload)
        : { ok: false, reason: "module_unavailable", writeStarted: false },
      args: [{ profileBinding, sectionName: GTH_SIMPLE_SECTION, answers: { [GTH_SIMPLE_SECTION]: answer } }]
    })), FILL_TIMEOUT_MS, "fill_response"));
    const result = replies?.length === 1 ? replies[0]?.result : null;
    if (!result || typeof result.writeStarted !== "boolean")
      throw new Error("网页未返回完整试填结果；本页已锁定，避免重复填写。");
    if (!result.ok) {
      if (result.writeStarted === false) {
        await withProfileBinding(chrome.storage.local,profileBinding,()=>replacePendingReview(tab, requestId));
        fillOutcomeUncertain = !!(await pendingReviewFor(tab));
      }
      throw new Error(gthSimpleErrors[result.reason]
        || "试填结果待核对；本页已锁定，暂不要重复操作。");
    }
    const field = result.fields?.[0];
    const valid = result.sectionName === GTH_SIMPLE_SECTION && result.editorLeftOpen === true
      && result.fields?.length === 1 && field?.question === GTH_SIMPLE_SECTION
      && result.savedOnSite === null && result.submitted === null
      && result.softwareClickedSave === false && result.softwareClickedSubmit === false
      && ((result.writeStarted === true && field.status === "verified"
        && field.reason === "readback_matched")
        || (result.writeStarted === false && field.status === "verified"
          && field.reason === "preexisting_same_value")
        || (result.writeStarted === false && field.status === "skipped"
          && field.reason === "existing_value"));
    if (!valid) throw new Error("试填回包不完整；本页已锁定，避免重复填写。");
    await withProfileBinding(chrome.storage.local,profileBinding,()=>replacePendingReview(tab, requestId));
    fillOutcomeUncertain = !!(await pendingReviewFor(tab));
    const data = { profileBinding, url: tab.url, title: tab.title || "国泰海通简历",
      fields: [{ id: "gth:职业技能与特长", labels: [GTH_SIMPLE_SECTION],
        path: `customAnswers.${GTH_SIMPLE_SECTION}`, status: field.status, reason: field.reason }],
      savedOnSite: null, submitted: null, softwareClickedSave: false, softwareClickedSubmit: false };
    await render(data, true);
    await withProfileBinding(chrome.storage.local,profileBinding,()=>rememberResult(tab, requestId, "gth_simple_section_trial", data.fields));
    setMessage(result.writeStarted
      ? "职业技能与特长已在当前编辑器读回一致；软件没有点击保存或投递。网站保存仍须单独验证。"
      : field.reason === "preexisting_same_value"
        ? "网站原有职业技能内容与资料一致，软件没有改写或保存。"
        : "网站已有不同的职业技能内容，软件保留原值，没有改写或保存。");
  } catch (error) {
    if(error?.message==="profile_binding_unavailable")error.message="暂时无法核对当前资料，已停止后续填写；已发出的操作请核对网站当前内容。";else if(/^profile_/u.test(error?.message||""))error.message="客户资料已变化，已停止后续填写；已发出的操作请核对网站当前内容。";
    setMessage(error?.message || "职业技能试填未完成，本页可能仍待核对。", true);
  } finally {
    setBusy(false);
  }
}

const gthOtherErrors = {
  wrong_page: "当前不是国泰海通简历编辑页，未试填。",
  page_not_ready: "网页尚未加载完，未试填。",
  page_hidden: "网页在后台，未继续试填。",
  page_reloaded: "试填时网页已刷新，结果待核对。",
  unsupported_section: "当前分区未开放试填。",
  invalid_test_answer: "其他信息的两条已确认答案不可用。",
  section_structure_changed: "国泰海通七个分区结构已变化。",
  editor_structure_changed: "网页已有其他编辑器或编辑器结构已变化。",
  edit_link_not_unique: "其他信息的编辑入口无法唯一确定。",
  target_not_unique: "其他信息题目不唯一。",
  target_not_plain_control: "目标不是已验证的普通文本控件。",
  value_too_long: "答案超过网站字数限制。",
  original_value_changed: "网页原值在试填前发生变化。",
  editor_changed_after_fill: "试填后编辑器变化，读回未确认。",
  other_values_changed: "试填时其他网页字段发生变化，结果待核对。",
  readback_mismatch: "其他信息读回不一致，结果待核对。",
  site_validation_failed: "网站对其他信息仍显示校验错误。",
  fill_in_progress: "网页里已有试填在运行，本次没有重复发送。"
};

async function performGthOtherTrial() {
  if (busy) return;
  setBusy(true);
  let tab = null;
  let requestId = null;
  try {
    const profileBinding=await captureProfileBinding(chrome.storage.local);
    const active = await chrome.tabs.query({ active: true, currentWindow: true });
    if (active.length !== 1) throw new Error("当前 Edge 窗口的活动页面不唯一，已停止。");
    tab = await getTab();
    if (tab.url !== GTH_RESUME_PAGE || active[0].id !== tab.id || active[0].url !== tab.url)
      throw new Error("请进入国泰海通准确的简历编辑页，未试填。");
    if (fillOutcomeUncertain || await pendingReviewFor(tab))
      throw new Error("本页已有结果待核对的填写请求；为避免重复改写，其他信息试填保持锁定。");
    const profile = await loadProfile();
    gthOtherEligible = confirmedGthOther(profile);
    if (!gthOtherEligible) throw new Error("此页尚无已核对且限定本站其他信息分区的描述和标题答案。");
    const answers = Object.fromEntries(GTH_OTHER_QUESTIONS.map((question) =>
      [question, profile.customAnswers[question]]));
    const origin = authorizationScope(tab.url);
    const { resumeTrustedOrigins } = await chrome.storage.local.get("resumeTrustedOrigins");
    const trusted = Array.isArray(resumeTrustedOrigins) ? resumeTrustedOrigins : [];
    if (!trusted.includes(origin)) {
      if (!window.confirm(`即将把已核对的其他信息两项试填到 ${origin}。只读回、不点击网站保存或投递。`))
        throw new Error("已取消本次试填。");
      await withProfileBinding(chrome.storage.local,profileBinding,()=>chrome.storage.local.set({ resumeTrustedOrigins: [...trusted, origin].slice(-100) }));
    }
    await ownedGthResult(profileBinding,boundedChromeCall(() => dispatchBoundSource(chrome.storage.local,profileBinding,()=>chrome.scripting.executeScript({
      target: { tabId: tab.id }, files: ["src/content/gth-other-section.js"]
    })), SCRIPT_TIMEOUT_MS, "script"));
    const activeAgain = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeAgain.length !== 1 || activeAgain[0].id !== tab.id || activeAgain[0].url !== tab.url)
      throw new Error("招聘网页已切换，本次没有发送试填指令。");
    const fresh = await loadProfile();
    if (!confirmedGthOther(fresh) || GTH_OTHER_QUESTIONS.some((question) =>
      fresh.customAnswers[question] !== answers[question]))
      throw new Error("资料库已变化，本次没有发送试填指令。");
    if (await pendingReviewFor(tab)) throw new Error("本页已有待核对请求，本次没有重复试填。");
    requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await withProfileBinding(chrome.storage.local,profileBinding,()=>beginRecentRequest(tab, requestId));
    await withProfileBinding(chrome.storage.local,profileBinding,()=>chrome.storage.local.set({ [pendingFillReviewKey(tab.id)]: {
      tabId: tab.id, origin, at: Date.now(), requestId, profileBinding, kind: "gth_other_section_trial"
    } }));
    showRecentResult(null);
    fillOutcomeUncertain = true;
    setMessage("正在试填其他信息两项，并核对网站原有内容…");
    const replies = await ownedGthResult(profileBinding,boundedChromeCall(() => dispatchBoundSource(chrome.storage.local,profileBinding,()=>chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (payload) => typeof globalThis.ResumeGthOtherSection?.fill === "function"
        ? globalThis.ResumeGthOtherSection.fill(payload)
        : { ok: false, reason: "module_unavailable", writeStarted: false },
      args: [{ profileBinding, sectionName: GTH_OTHER_SECTION, answers }]
    })), FILL_TIMEOUT_MS, "fill_response"));
    const result = replies?.length === 1 ? replies[0]?.result : null;
    if (!result || typeof result.writeStarted !== "boolean")
      throw new Error("网页未返回完整试填结果；本页已锁定，避免重复填写。");
    if (!result.ok) {
      if (result.writeStarted === false) {
        await withProfileBinding(chrome.storage.local,profileBinding,()=>replacePendingReview(tab, requestId));
        fillOutcomeUncertain = !!(await pendingReviewFor(tab));
      }
      throw new Error(gthOtherErrors[result.reason]
        || "试填结果待核对；本页已锁定，暂不要重复操作。");
    }
    const fields = result.fields;
    const valid = result.sectionName === GTH_OTHER_SECTION && result.editorLeftOpen === true
      && Array.isArray(fields) && fields.length === 2
      && GTH_OTHER_QUESTIONS.every((question, index) => fields[index]?.question === question)
      && result.savedOnSite === false && result.submitted === false
      && result.softwareClickedSave === false && result.softwareClickedSubmit === false
      && (result.writeStarted === true
        ? fields.every((field) => field.status === "verified" && field.reason === "readback_matched")
        : fields.every((field) => field.status === "verified" && field.reason === "preexisting_same_value"
          || field.status === "skipped" && field.reason === "existing_value"));
    if (!valid) throw new Error("试填回包不完整；本页已锁定，避免重复填写。");
    await withProfileBinding(chrome.storage.local,profileBinding,()=>replacePendingReview(tab, requestId));
    fillOutcomeUncertain = !!(await pendingReviewFor(tab));
    const data = { profileBinding, url: tab.url, title: tab.title || "国泰海通简历",
      fields: fields.map((field) => ({ id: `gth:其他信息:${field.question}`,
        labels: [field.question], path: `customAnswers.${field.question}`,
        status: field.status, reason: field.reason })),
      savedOnSite: false, submitted: false, softwareClickedSave: false, softwareClickedSubmit: false };
    await render(data, true);
    await withProfileBinding(chrome.storage.local,profileBinding,()=>rememberResult(tab, requestId, "gth_other_section_trial", data.fields));
    setMessage(result.writeStarted
      ? "其他信息两项已在当前编辑器读回一致；软件没有点击保存或投递。网站保存仍须单独验证。"
      : "网站原有的其他信息已保留，软件没有改写或保存。");
  } catch (error) {
    if(error?.message==="profile_binding_unavailable")error.message="暂时无法核对当前资料，已停止后续填写；已发出的操作请核对网站当前内容。";else if(/^profile_/u.test(error?.message||""))error.message="客户资料已变化，已停止后续填写；已发出的操作请核对网站当前内容。";
    setMessage(error?.message || "其他信息试填未完成，本页可能仍待核对。", true);
  } finally {
    setBusy(false);
  }
}

function refreshInspection() {
  if (busy) pendingInspect = !activeTab || !isGthSite(activeTab.url);
  else if (activeTab && isGthSite(activeTab.url)) {
    setMessage("国泰海通逐段识别需要点击“重新识别”；该站自动填写尚未验收。", false);
  }
  else perform("RESUME_INSPECT");
}

elements.inspect.addEventListener("click", () => perform("RESUME_INSPECT"));
elements.fill.addEventListener("click", () => perform("RESUME_FILL"));
elements.gthSalaryButton.addEventListener("click", performGthSalaryTrial);
elements.gthIntentButton.addEventListener("click", performGthIntentTrial);
elements.gthEducationButtons.forEach((button, rowIndex) =>
  button.addEventListener("click", () => performGthEducationTrial(rowIndex)));
elements.gthEducationFullButtons.forEach((button, rowIndex) =>
  button.addEventListener("click", () => performGthEducationTrial(rowIndex, true)));
elements.gthEducationSource.addEventListener("change", () => setBusy(busy));
elements.gthEducationTarget.addEventListener("change", () => setBusy(busy));
elements.gthEducationTargetButton.addEventListener("click", () => {
  const rowIndex = selectedGthEducationTargetIndex();
  if (rowIndex !== null) startGthEducationFullJob(rowIndex);
});
elements.gthEducationNewButton.addEventListener("click", () => startGthEducationFullJob("new"));
elements.gthDraftInspect.addEventListener("click", () => performGthDraftAction("inspect"));
elements.gthDraftSave.addEventListener("click", () => performGthDraftAction("save"));
elements.gthDraftResume.addEventListener("click", () => performGthDraftAction("resume_refresh"));
elements.gthSimpleButton.addEventListener("click", performGthSimpleTrial);
elements.gthOtherButton.addEventListener("click", performGthOtherTrial);
elements.gthBasicButton.addEventListener("click", performGthBasicTrial);
elements.gthBasicSource.addEventListener("change", () => setBusy(busy));
elements.gthBasicReplace.addEventListener("change", () => setBusy(busy));
elements.draftButton.addEventListener("click", collectQuestions);
elements.profile.addEventListener("click", () => chrome.runtime.openOptionsPage());
attachmentInput.addEventListener("change", async () => {
  const file = attachmentInput.files?.[0];
  try{await popupFileOwner.ensure();if(attachmentInput.files?.[0]!==file)return;}catch{attachmentInput.value="";return;}
  attachmentState.textContent = file ? `本次已选择：${file.name}（${Math.ceil(file.size / 1024)} KB）` : cachedAttachment ? cachedConfirmed ? `将使用本机已核对文件：${cachedAttachment.name}` : `本机已保存：${cachedAttachment.name}；核对确认后才会复用` : "本次尚未选择文件";
  refreshInspection();
});
for (const [slot, choice] of Object.entries(cmsPhotoChoices)) {
  choice.input.addEventListener("change", async () => {
    const file = choice.input.files?.[0];
    try{await popupFileOwner.ensure();if(choice.input.files?.[0]!==file)return;}catch{choice.input.value="";choice.confirm.checked=false;return;}
    choice.confirm.checked = false;
    const problem = cmsPhotoFileError(file);
    choice.confirm.disabled = !!problem;
    choice.state.textContent = problem || `已选择 ${file.name}（${Math.ceil(file.size / 1024)} KB）；请确认本入口`;
  });
  choice.confirm.addEventListener("change", async () => {
    const file = choice.input.files?.[0];
    try{await popupFileOwner.ensure();if(choice.input.files?.[0]!==file)return;}catch{choice.confirm.checked=false;return;}
    const problem = cmsPhotoFileError(file);
    if (problem) {
      choice.confirm.checked = false;
      choice.confirm.disabled = true;
      choice.state.textContent = problem;
      return;
    }
    choice.state.textContent = choice.confirm.checked
      ? `已确认 ${slot === "basic" ? "基本信息照片" : "个人照片"}：${file.name}；仅本次使用`
      : `已选择 ${file.name}；本次不会发送，除非再次确认`;
  });
}
clearAttachmentButton.addEventListener("click", async () => {
  const token=cachedAttachmentToken,oldName=cachedAttachment?.name;if(!token)return;
  if (!window.confirm("删除本机保存的简历文件？此文件正文不会包含在 JSON 备份中。")) return;
  try{
    await popupFileOwner.run(token,async({assert,ownProfile})=>{
      const profileRecord=await loadProfile();await assert();await clearAttachment();await assert();
      if(profileRecord.resumeAttachment?.source==='stored-local'&&profileRecord.resumeAttachment.name===oldName){
        profileRecord.resumeAttachment=null;profileRecord.confirmedFields=profileRecord.confirmedFields.filter(path=>path!=='resumeAttachment.name');
        delete profileRecord.sources['resumeAttachment.name'];await ownProfile(await saveProfile(profileRecord));
      }
    });
    cachedAttachment=null;cachedConfirmed=false;cachedAttachmentToken=null;clearAttachmentButton.hidden=true;
    attachmentState.textContent='本次尚未选择文件';refreshInspection();
  }catch{attachmentState.textContent='资料已变化或附件删除失败，请刷新后重新检查。';}
});
attachmentReady = (async()=>{const token=await popupFileOwner.ensure(),file=await loadAttachment();await popupFileOwner.assert(token);return {token,file};})().then(async ({token,file}) => {
  cachedAttachment = file;cachedAttachmentToken=file?token:null;
  clearAttachmentButton.hidden = !file;
  if (file) {
    const profile = await loadProfile();
    cachedConfirmed = profile.confirmedFields.includes("resumeAttachment.name")
      && profile.resumeAttachment?.name === file.name && profile.resumeAttachment?.size === file.size
      && profile.resumeAttachment?.type === file.type;
  }
  await popupFileOwner.assert(token);
  if (!attachmentInput.files?.[0]) attachmentState.textContent = file ? cachedConfirmed ? `将使用本机已核对文件：${file.name}` : `本机已保存：${file.name}；核对确认后才会复用` : "本次尚未选择文件";
}).catch((error) => { attachmentState.textContent = `读取本机附件失败：${error.message}`; });
chrome.storage.onChanged.addListener((changes,area)=>{
  if(area==='local'&&(changes.resumeProfile||changes.resumeProfileLifecycle)){
    gthEducationJobSnapshot=null;gthBasicPrepared=false;gthBasicActions.invalidate();
    gthSalaryEligible=false;gthIntentEligible=false;gthEducationEligible=false;gthSimpleEligible=false;gthOtherEligible=false;
    populateGthEducationSource({education:[],confirmedFields:[]});populateGthBasicSource([]);
    lastInspection=null;previewQuestions=[];elements.list.replaceChildren();elements.summary.textContent='';elements.drafts.hidden=true;showRecentResult(null);setBusy(busy);
    setMessage('客户资料已变化，请重新识别当前客户；已发出的操作须核对网站当前内容。',true);
  }
});
getTab().then(async (tab) => {
  if (isGthSite(tab.url)) {
    const profileBinding=await captureProfileBinding(chrome.storage.local);
    const profile = await loadProfile();
    gthSalaryEligible = tab.url === GTH_RESUME_PAGE && confirmedGthSalary(profile);
    gthIntentEligible = tab.url === GTH_RESUME_PAGE && confirmedGthIntent(profile);
    gthEducationEligible = tab.url === GTH_RESUME_PAGE
      && confirmedGthEducationFullCandidates(profile).length > 0;
    if (tab.url === GTH_RESUME_PAGE) populateGthEducationSource(profile);
    if (tab.url === GTH_RESUME_PAGE) {
      const { resumeTrustedOrigins } = await chrome.storage.local.get("resumeTrustedOrigins");
      await assertProfileBinding(chrome.storage.local,profileBinding);
      gthEducationJobSnapshot = { profileBinding, tab: { id: tab.id, url: tab.url, title: tab.title },
        candidates: confirmedGthEducationFullCandidates(profile),
        trusted: Array.isArray(resumeTrustedOrigins) && resumeTrustedOrigins.includes("https://hr.gtht.com") };
      await populateGthEducationTargets(tab);
      await gthDraftActions.prepare(tab);
      const basicPrepared = await gthBasicActions.prepare({ tab, profile, trusted: gthEducationJobSnapshot.trusted });
      gthBasicPrepared = !!basicPrepared;
      populateGthBasicSource(basicPrepared?.educationSources || []);
    }
    gthSimpleEligible = tab.url === GTH_RESUME_PAGE && confirmedGthSimple(profile);
    gthOtherEligible = tab.url === GTH_RESUME_PAGE && confirmedGthOther(profile);
    if (tab.url === GTH_RESUME_PAGE) {
      const key = `resumeEducationJob:${tab.id}`;
      const job = (await chrome.storage.local.get(key))[key];
      const basicKey = `resumeBasicJob:${tab.id}`;
      const basicJob = (await chrome.storage.local.get(basicKey))[basicKey];
      if (basicJob?.kind === "gth_basic_trial" && basicJob.origin === "https://hr.gtht.com"
        && (!job || basicJob.at >= job.at)) {
        setBusy(false);await showGthBasicResult(await gthBasicActions.review(tab), tab, true);setBusy(false);return;
      }
      if (job?.origin === "https://hr.gtht.com" && job?.kind === "gth_education_full_trial"
        && ["queued", "running", "unknown", "completed", "stopped_before_write"].includes(job.state)) {
        setBusy(false);await showGthEducationJob(job, tab, true);return;
      }
    }
    if (gthPendingReview) {
      const outcome = await reviewPendingGthSalary(tab, await pendingReviewFor(tab));
      setBusy(false);
      setMessage(gthReviewMessage(outcome), outcome === "unknown");
      return;
    }
    if (gthIntentPendingReview) {
      const outcome = await reviewPendingGthIntent(tab, await pendingReviewFor(tab));
      setBusy(false);
      setMessage(gthIntentReviewMessage(outcome), outcome === "unknown");
      return;
    }
    if (gthEducationPendingReview) {
      const pending = await pendingReviewFor(tab);
      const outcome = await reviewPendingGthEducation(tab, pending);
      setBusy(false);
      setMessage(gthEducationReviewMessage(outcome, pending?.kind === "gth_education_full_trial"), outcome === "unknown");
      return;
    }
    if ((await pendingReviewFor(tab))?.kind === "gth_simple_section_trial") {
      setBusy(false);
      setMessage("上次职业技能试填结果尚未安全核对，本页试填已锁定，不能重复改写；请检查编辑器和网站保存状态。", true);
      return;
    }
    if ((await pendingReviewFor(tab))?.kind === "gth_other_section_trial") {
      setBusy(false);
      setMessage("上次其他信息试填结果尚未安全核对，本页试填已锁定，不能重复改写；请检查编辑器和网站保存状态。", true);
      return;
    }
    setBusy(false);
    setMessage(isGthResumePage(tab.url)
      ? "点击“重新识别”，软件会逐段查看问题并核对原值；国泰海通自动填写尚未验收。"
      : "请先进入国泰海通简历编辑页；该站自动填写尚未验收。");
  } else perform("RESUME_INSPECT");
}).catch(() => perform("RESUME_INSPECT"));
