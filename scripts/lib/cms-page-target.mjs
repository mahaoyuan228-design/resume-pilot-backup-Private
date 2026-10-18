// Pure helpers: resolve which hotjob CMS resumeOperation page the CMS basic harness targets.
// Default = 招商 baseline (no behavior change when CMS_PAGE / CMS_SU unset).
// Only https://wecruit.hotjob.cn/SU<id>/pb/resumeOperation.html is accepted; anything else is refused.
export const CMS_BASELINE_SU = 'SU629dbc0c0dcad452299bc0f7';
export const CMS_HOST = 'wecruit.hotjob.cn';
export const CMS_PAGE_PATH_RE = /^\/(SU[0-9A-Za-z]{8,64})\/pb\/resumeOperation\.html$/u;
export const CMS_SU_RE = /^SU[0-9A-Za-z]{8,64}$/u;

export const cmsPageForSu = (su) => `https://${CMS_HOST}/${su}/pb/resumeOperation.html`;
export const CMS_BASELINE_PAGE = cmsPageForSu(CMS_BASELINE_SU);

// Same-shell hotjob tenants (see dist/site-probes/HOTJOB_TENANT_NEXT_EXPERIMENT.md).
export const HOTJOB_TENANTS = Object.freeze({
  zhonglian: Object.freeze({ su: 'SU661f37091eb8053acd6cdf3d', name: '中联重科' }),
  nanyue: Object.freeze({ su: 'SU670a291d6202cc7666c744bc', name: '广东南粤银行' }),
  celebright: Object.freeze({ su: 'SU6279c916bef57c3ac0d49671', name: 'Celebright 曼领' }),
  guosheng: Object.freeze({ su: 'SU6879a7b3e57172288b60df9d', name: '国盛证券 (via wecruit)' })
});

function refuse(reason, detail) {
  const error = new Error(`${reason}: ${detail}`);
  error.code = reason;
  throw error;
}

// Returns { su, page } or throws code cms_page_invalid.
export function parseCmsPage(value) {
  let url;
  try { url = new URL(String(value || '').trim()); } catch { refuse('cms_page_invalid', 'not a URL'); }
  if (url.protocol !== 'https:') refuse('cms_page_invalid', 'must be https');
  if (url.hostname !== CMS_HOST || url.port || url.username || url.password)
    refuse('cms_page_invalid', `host must be ${CMS_HOST}`);
  const match = CMS_PAGE_PATH_RE.exec(url.pathname);
  if (!match) refuse('cms_page_invalid', 'path must be /SU*/pb/resumeOperation.html');
  if (url.search || url.hash) refuse('cms_page_invalid', 'query/hash not allowed');
  return { su: match[1], page: `${url.origin}${url.pathname}` };
}

export const tenantTag = (su) => String(su).slice(2, 8);

// env: CMS_PAGE (full URL) and/or CMS_SU. Both set → must agree.
export function resolveCmsTarget(env = {}) {
  const rawPage = typeof env.CMS_PAGE === 'string' ? env.CMS_PAGE.trim() : '';
  const rawSu = typeof env.CMS_SU === 'string' ? env.CMS_SU.trim() : '';
  let su = null;
  let page = null;
  let source = 'default';
  if (rawPage) {
    ({ su, page } = parseCmsPage(rawPage));
    source = 'CMS_PAGE';
  }
  if (rawSu) {
    if (!CMS_SU_RE.test(rawSu)) refuse('cms_su_invalid', 'CMS_SU must look like SU<alnum>');
    if (su && su !== rawSu) refuse('cms_target_conflict', `CMS_PAGE SU ${su} != CMS_SU ${rawSu}`);
    su = rawSu;
    page = cmsPageForSu(rawSu);
    source = rawPage ? 'CMS_PAGE+CMS_SU' : 'CMS_SU';
  }
  if (!su) { su = CMS_BASELINE_SU; page = CMS_BASELINE_PAGE; }
  const isBaseline = su === CMS_BASELINE_SU;
  const tenantKey = Object.entries(HOTJOB_TENANTS).find(([, row]) => row.su === su)?.[0] || null;
  return { su, page, isBaseline, source, tag: tenantTag(su), tenantKey };
}

export const tenantEvidenceName = (su, stampValue) =>
  `hotjob-tenant-${tenantTag(su)}-cms-basic-${stampValue}.json`;
