// A short-lived, tab-and-page-scoped receipt. Never persist field labels,
// applicant answers, page values, or a URL that may contain a personal token.
const RESULT_PREFIX = "resumeRecentFillResult:";
const REQUEST_PREFIX = "resumeRecentFillRequest:";
const MAX_AGE_MS = 30 * 60 * 1000;
const STATUS = new Set(["readback_complete", "verified", "stopped_before_write"]);
const KINDS = new Set(["resume_fill", "gth_salary_trial", "gth_intent_trial", "gth_education_trial", "gth_education_full_trial", "gth_basic_trial", "gth_simple_section_trial", "gth_other_section_trial"]);
const MISMATCH_REASONS = new Set(["readback_mismatch", "unexpected_value"]);

function requestKey(tabId) { return `${REQUEST_PREFIX}${tabId}`; }
function resultKey(tabId, requestId) { return `${RESULT_PREFIX}${tabId}:${requestId}`; }
function validRequestId(requestId) {
  return typeof requestId === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(requestId);
}

async function pageId(url) {
  const page = new URL(url);
  const bytes = new TextEncoder().encode(page.origin + page.pathname + page.search);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function countsFor(fields) {
  const counts = { correct: 0, unfilled: 0, wrong: 0, uncertain: 0 };
  for (const field of fields) {
    if (field?.status === "verified") counts.correct += 1;
    else if (field?.status === "failed" && MISMATCH_REASONS.has(field.reason)) counts.wrong += 1;
    else if (field?.status === "skipped") counts.unfilled += 1;
    else counts.uncertain += 1;
  }
  return counts;
}

function validCounts(counts) {
  return counts && ["correct", "unfilled", "wrong", "uncertain"].every((name) =>
    Number.isSafeInteger(counts[name]) && counts[name] >= 0 && counts[name] <= 10000);
}

export async function beginRecentRequest(tab, requestId) {
  if (!Number.isSafeInteger(tab?.id) || !validRequestId(requestId))
    throw new Error("Invalid recent-result request ID");
  const key = requestKey(tab.id);
  const previous = (await chrome.storage.local.get(key))[key];
  await chrome.storage.local.set({ [key]: {
    tabId: tab.id, sourcePageId: await pageId(tab.url), requestId, at: Date.now()
  } });
  if (validRequestId(previous?.requestId) && previous.requestId !== requestId)
    await chrome.storage.local.remove(resultKey(tab.id, previous.requestId));
}

async function latestRequest(tab, requestId, sourcePageId) {
  const current = (await chrome.storage.local.get(requestKey(tab.id)))[requestKey(tab.id)];
  return current?.tabId === tab.id && current?.requestId === requestId
    && current?.sourcePageId === sourcePageId;
}

export async function saveRecentResult(tab, requestId, kind, fields, statusCode) {
  if (!Number.isSafeInteger(tab?.id) || !validRequestId(requestId)
    || !KINDS.has(kind) || !STATUS.has(statusCode) || !Array.isArray(fields)) return null;
  const record = { tabId: tab.id, sourcePageId: await pageId(tab.url), requestId,
    at: Date.now(), kind, statusCode, counts: countsFor(fields) };
  if (!(await latestRequest(tab, requestId, record.sourcePageId))) return null;
  const key = resultKey(tab.id, requestId);
  await chrome.storage.local.set({ [key]: record });
  if (!(await latestRequest(tab, requestId, record.sourcePageId))) {
    await chrome.storage.local.remove(key);
    return null;
  }
  return record;
}

export async function loadRecentResult(tab) {
  if (!Number.isSafeInteger(tab?.id)) return null;
  const pointerKey = requestKey(tab.id);
  const pointer = (await chrome.storage.local.get(pointerKey))[pointerKey];
  if (!pointer || !validRequestId(pointer.requestId)) return null;
  const storageKey = resultKey(tab.id, pointer.requestId);
  const record = (await chrome.storage.local.get(storageKey))[storageKey];
  const sourcePageId = await pageId(tab.url);
  const pointerValid = pointer.tabId === tab.id && pointer.sourcePageId === sourcePageId
    && Number.isSafeInteger(pointer.at) && pointer.at <= Date.now()
    && Date.now() - pointer.at <= MAX_AGE_MS;
  if (!pointerValid) {
    await chrome.storage.local.remove(pointerKey);
    await chrome.storage.local.remove(storageKey);
    return null;
  }
  if (!record) return null;
  const valid = record.tabId === tab.id && record.sourcePageId === sourcePageId
    && record.requestId === pointer.requestId
    && Number.isSafeInteger(record.at) && record.at <= Date.now()
    && Date.now() - record.at <= MAX_AGE_MS
    && KINDS.has(record.kind) && STATUS.has(record.statusCode)
    && validCounts(record.counts);
  if (valid) return record;
  await chrome.storage.local.remove(storageKey);
  return null;
}

export function recentResultText(record) {
  if (!record) return "";
  const { correct, unfilled, wrong, uncertain } = record.counts;
  const status = record.statusCode === "stopped_before_write"
    ? "本次在写入前停止" : "本次读回已完成";
  return `${status} · 读回一致 ${correct} · 未填 ${unfilled} · 读回不符 ${wrong} · 仍待核对 ${uncertain}。这是上次操作的记录；刷新后请重新识别并核对当前网页。网站保存状态需另行检查。`;
}

// Aftercare uses the current popup result only, never the persisted receipt.
export function manualFields(fields, filled = false) {
  return (Array.isArray(fields) ? fields : []).flatMap((field, index) =>
    field && (field.semanticStatus === "manual"
      || ["failed", "skipped", "manual", "unsupported"].includes(field.status)
      || (field.status !== "verified" && (filled || field.reason !== "ready")))
      ? [{ position: index + 1, field }] : []);
}

const REPORT_REASONS = new Set([
  "unknown_question", "unlabelled_field", "ambiguous_label", "section_unconfirmed",
  "profile_field_unavailable", "missing_profile_value", "unconfirmed_profile_value",
  "invalid_profile_value", "multiple_profile_values", "ambiguous_repeat_group",
  "iframe_or_captcha_manual", "control_not_supported", "custom_control_not_supported",
  "custom_select_not_supported", "readonly_control", "existing_value", "field_changed",
  "form_changed", "page_changed", "readback_mismatch", "unexpected_value",
  "browser_validation_failed", "control_error", "option_not_found", "ambiguous_option",
  "file_requires_user_selection", "blocked_by_open_menu", "blocked_by_open_calendar"
]);

export function createLocalErrorReport(fields, filled = false, operationFailed = false) {
  const manual = manualFields(fields, filled).map(({ position, field }) => ({
    position,
    outcome: ["failed", "skipped", "manual", "unsupported"].includes(field.status)
      ? field.status : "unverified",
    reason: REPORT_REASONS.has(field.reason) ? field.reason : "unclassified"
  }));
  // Explicit projection: no labels, IDs, answers, URLs, DOM or raw exceptions.
  return { schemaVersion: 1, localOnly: true, liveSupportClaimed: false, neverSave: true,
    stage: filled ? "fill_readback" : "inspect",
    result: operationFailed ? "operation_failed" : "fields_returned",
    fieldCount: Array.isArray(fields) ? fields.length : 0, manualCount: manual.length, manual };
}
