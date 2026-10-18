// Pure helpers: resolve which hotjob CMS / mc resume page the harness targets.
// Default = 招商 baseline (no behavior change when CMS_PAGE / CMS_SU unset).
// Two shells (fail-closed; do not mix):
//   pb  — desktop Ant CMS: /SU*/pb/resumeOperation.html (no query/hash)
//   mc  — H5 antd-mobile: /SU*/mc/deliver/operationResumer (query OK; stripped in canonical page)
// CMS_BASIC_AUTO only accepts pb. mc requires a separate thin adapter (see HOTJOB_MC_OPERATIONRESUMER_20261018.md).
export const CMS_BASELINE_SU = 'SU629dbc0c0dcad452299bc0f7';
export const CMS_HOST = 'wecruit.hotjob.cn';
export const CMS_PAGE_PATH_RE = /^\/(SU[0-9A-Za-z]{8,64})\/pb\/resumeOperation\.html$/u;
export const CMS_MC_PATH_RE = /^\/(SU[0-9A-Za-z]{8,64})\/mc\/deliver\/operationResumer$/u;
export const CMS_SU_RE = /^SU[0-9A-Za-z]{8,64}$/u;

export const cmsPageForSu = (su) => `https://${CMS_HOST}/${su}/pb/resumeOperation.html`;
export const cmsMcPageForSu = (su) => `https://${CMS_HOST}/${su}/mc/deliver/operationResumer`;
export const CMS_BASELINE_PAGE = cmsPageForSu(CMS_BASELINE_SU);

// Same-host hotjob tenants. shell=pb → CMS_BASIC; shell=mc → thin adapter only (中联 live 2026-10-18).
export const HOTJOB_TENANTS = Object.freeze({
  zhonglian: Object.freeze({
    su: 'SU661f37091eb8053acd6cdf3d',
    name: '中联重科',
    shell: 'mc',
    // Live after login uses mc operationResumer; pb/resumeOperation.html stays「正在加载中…」.
    note: 'prefer mc; Path B thin adapter (antd-mobile), not CMS_BASIC pb Ant shell'
  }),
  nanyue: Object.freeze({ su: 'SU670a291d6202cc7666c744bc', name: '广东南粤银行', shell: 'pb' }),
  celebright: Object.freeze({ su: 'SU6279c916bef57c3ac0d49671', name: 'Celebright 曼领', shell: 'pb' }),
  guosheng: Object.freeze({ su: 'SU6879a7b3e57172288b60df9d', name: '国盛证券 (via wecruit)', shell: 'pb' })
});

function refuse(reason, detail) {
  const error = new Error(`${reason}: ${detail}`);
  error.code = reason;
  throw error;
}

function hostOk(url) {
  if (url.protocol !== 'https:') refuse('cms_page_invalid', 'must be https');
  if (url.hostname !== CMS_HOST || url.port || url.username || url.password)
    refuse('cms_page_invalid', `host must be ${CMS_HOST}`);
}

// Returns { su, page } for pb shell (query/hash refused).
export function parseCmsPage(value) {
  let url;
  try { url = new URL(String(value || '').trim()); } catch { refuse('cms_page_invalid', 'not a URL'); }
  hostOk(url);
  const match = CMS_PAGE_PATH_RE.exec(url.pathname);
  if (!match) refuse('cms_page_invalid', 'path must be /SU*/pb/resumeOperation.html');
  if (url.search || url.hash) refuse('cms_page_invalid', 'query/hash not allowed');
  return { su: match[1], page: `${url.origin}${url.pathname}`, shell: 'pb' };
}

// Returns { su, page, shell:'mc' }. Query/hash allowed on input; canonical page strips them.
export function parseHotjobMcPage(value) {
  let url;
  try { url = new URL(String(value || '').trim()); } catch { refuse('cms_page_invalid', 'not a URL'); }
  hostOk(url);
  const match = CMS_MC_PATH_RE.exec(url.pathname);
  if (!match) refuse('cms_page_invalid', 'path must be /SU*/mc/deliver/operationResumer');
  return { su: match[1], page: `${url.origin}${url.pathname}`, shell: 'mc' };
}

// Accept pb or mc. Used when CMS_PAGE may be either shell.
export function parseHotjobResumePage(value) {
  let url;
  try { url = new URL(String(value || '').trim()); } catch { refuse('cms_page_invalid', 'not a URL'); }
  hostOk(url);
  if (CMS_PAGE_PATH_RE.test(url.pathname)) return parseCmsPage(value);
  if (CMS_MC_PATH_RE.test(url.pathname)) return parseHotjobMcPage(value);
  refuse('cms_page_invalid', 'path must be /SU*/pb/resumeOperation.html or /SU*/mc/deliver/operationResumer');
}

export const tenantTag = (su) => String(su).slice(2, 8);

export function pageForTenantSu(su) {
  const row = Object.values(HOTJOB_TENANTS).find((t) => t.su === su);
  if (row?.shell === 'mc') return cmsMcPageForSu(su);
  return cmsPageForSu(su);
}

export function shellForSu(su) {
  const row = Object.values(HOTJOB_TENANTS).find((t) => t.su === su);
  if (row?.shell === 'mc') return 'mc';
  if (CMS_PAGE_PATH_RE.test(new URL(cmsPageForSu(su)).pathname)) return 'pb';
  return 'pb';
}

// env: CMS_PAGE (full URL) and/or CMS_SU. Both set → must agree on SU.
// 中联 (shell=mc): CMS_SU alone prefers mc operationResumer. Explicit pb CMS_PAGE still accepted.
export function resolveCmsTarget(env = {}) {
  const rawPage = typeof env.CMS_PAGE === 'string' ? env.CMS_PAGE.trim() : '';
  const rawSu = typeof env.CMS_SU === 'string' ? env.CMS_SU.trim() : '';
  let su = null;
  let page = null;
  let shell = 'pb';
  let source = 'default';
  if (rawPage) {
    ({ su, page, shell } = parseHotjobResumePage(rawPage));
    source = 'CMS_PAGE';
  }
  if (rawSu) {
    if (!CMS_SU_RE.test(rawSu)) refuse('cms_su_invalid', 'CMS_SU must look like SU<alnum>');
    if (su && su !== rawSu) refuse('cms_target_conflict', `CMS_PAGE SU ${su} != CMS_SU ${rawSu}`);
    su = rawSu;
    if (!rawPage) {
      page = pageForTenantSu(rawSu);
      shell = shellForSu(rawSu);
      source = 'CMS_SU';
    } else {
      source = 'CMS_PAGE+CMS_SU';
    }
  }
  if (!su) {
    su = CMS_BASELINE_SU;
    page = CMS_BASELINE_PAGE;
    shell = 'pb';
  }
  const isBaseline = su === CMS_BASELINE_SU;
  const tenantKey = Object.entries(HOTJOB_TENANTS).find(([, row]) => row.su === su)?.[0] || null;
  return { su, page, shell, isBaseline, source, tag: tenantTag(su), tenantKey };
}

export const tenantEvidenceName = (su, stampValue) =>
  `hotjob-tenant-${tenantTag(su)}-cms-basic-${stampValue}.json`;
