// Paid-only activate panel (Chinese). Not packaged by build-internal.ps1.
// Uses local gate/client helpers only — no payment provider calls.

import { FLAVOR_PAID, isPaidFlavor } from './flavor.mjs';
import { LicenseGateError, LICENSE_CODES } from './errors.mjs';
import {
  activateLocalToken,
  clearLocalEntitlement,
  licenseCodeToZh,
  readLicenseStatus,
} from './entitlement.mjs';

const els = {
  flavorGate: document.getElementById('flavor-gate'),
  flavorGateMsg: document.getElementById('flavor-gate-msg'),
  panel: document.getElementById('panel'),
  stStatus: document.getElementById('st-status'),
  stAllowed: document.getElementById('st-allowed'),
  stLicense: document.getElementById('st-license'),
  stExpiry: document.getElementById('st-expiry'),
  stInstall: document.getElementById('st-install'),
  stMessage: document.getElementById('st-message'),
  tokenInput: document.getElementById('token-input'),
  btnActivate: document.getElementById('btn-activate'),
  btnRefresh: document.getElementById('btn-refresh'),
  btnClear: document.getElementById('btn-clear'),
  actionMsg: document.getElementById('action-msg'),
};

/** @type {import('./gate.mjs').PaidConfig|null} */
let paidConfig = null;

function storage() {
  if (typeof chrome === 'undefined' || !chrome?.storage?.local) {
    throw new LicenseGateError(LICENSE_CODES.CONFIG_MISSING, 'storage_unavailable');
  }
  return chrome.storage.local;
}

function formatExpiry(ms) {
  if (ms == null) return '未设置（以经营者策略为准）';
  try {
    return new Date(ms).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) + '（上海时区）';
  } catch {
    return String(ms);
  }
}

function setActionMessage(text, kind) {
  els.actionMsg.textContent = text || '';
  els.actionMsg.classList.remove('ok', 'bad');
  if (kind) els.actionMsg.classList.add(kind);
}

function denyReasonZh(error) {
  if (error instanceof LicenseGateError) {
    const base = licenseCodeToZh(error.code);
    const detailMap = {
      token_empty: '请先粘贴授权令牌。',
      token_unparseable: '无法解析：请粘贴完整 RQF1. 激活码、JSON 或 Base64(JSON)。',
      activation_code_invalid: '激活码格式无效，请完整复制经营者签发的 RQF1. 码。',
      activation_code_version_unsupported: '此激活码版本不受支持，请联系经营者核对安装包与激活码。',
      activation_code_seat_invalid: '激活码缺少有效的席位编号、设备绑定或到期时间，请联系经营者重新签发。',
      token_not_object: '令牌格式无效：根节点必须是对象。',
      token_status_missing: '令牌缺少 status 字段。',
      token_expiry_invalid: '令牌到期时间无效。',
      token_install_id_invalid: '令牌中的 installId 不是合法 UUID。',
      token_bound_other_device: '此令牌已绑定其他设备，无法在本机激活。',
      binding_mismatch: '令牌绑定与本机 installId / 席位不符。',
      past_expiry: '许可已过期（已到 expiresAtMs）。',
      expiry_invalid: '到期时间字段无效。',
      status_expired: '令牌 status 为 expired。',
      status_revoked: '令牌 status 为 revoked。',
      device_revoked: '令牌 status 为 device_revoked。',
      entitlement_missing: '本机尚未保存授权记录。',
      install_id_missing: '本机 installId 尚未生成或无效。',
      internal_no_activate: '内部试用版无需也无法使用此激活页。',
      license_url_not_https: '授权服务地址无效（需要 https）。',
      flavor_not_paid: '当前构建不是授权版。',
      paid_config_absent: '缺少 paid-config，无法激活。',
      public_key_pem_missing: '授权公钥缺失，无法校验签名令牌。',
      signature_invalid: '令牌签名无效（可能被篡改）。',
      signature_missing: '此构建要求签名授权令牌。',
    };
    const extra = detailMap[error.detail] || '';
    return extra ? `${base} ${extra}` : base;
  }
  return licenseCodeToZh(error?.code) || '激活失败，请检查令牌后重试。';
}

async function loadPaidConfig() {
  try {
    const mod = await import('./paid-config.mjs');
    paidConfig = mod?.paidConfig ?? null;
  } catch {
    paidConfig = null;
  }
  return paidConfig;
}

function showFlavorBlocked(message) {
  els.flavorGate.hidden = false;
  els.panel.hidden = true;
  if (message) els.flavorGateMsg.textContent = message;
}

function showPanel() {
  els.flavorGate.hidden = true;
  els.panel.hidden = false;
}

async function refreshStatus() {
  const snap = await readLicenseStatus({
    flavor: FLAVOR_PAID,
    config: paidConfig,
    storage: storage(),
  });
  els.stStatus.textContent = snap.status;
  els.stAllowed.textContent = snap.allowed ? '允许填写' : '禁止填写';
  els.stLicense.textContent = snap.licenseId || '（无）';
  els.stExpiry.textContent = formatExpiry(snap.expiresAtMs);
  els.stInstall.textContent = snap.installId || '（尚未生成）';
  els.stMessage.textContent = snap.messageZh;
  els.stMessage.classList.toggle('ok', snap.allowed === true);
  els.stMessage.classList.toggle('bad', snap.allowed !== true);
  return snap;
}

async function onActivate() {
  setActionMessage('正在本机核验并保存…', null);
  els.btnActivate.disabled = true;
  try {
    await activateLocalToken({
      storage: storage(),
      tokenText: els.tokenInput.value,
      config: paidConfig,
      flavor: FLAVOR_PAID,
    });
    await refreshStatus();
    setActionMessage('激活成功：授权已保存到本机。', 'ok');
  } catch (error) {
    setActionMessage(denyReasonZh(error), 'bad');
    try { await refreshStatus(); } catch { /* keep prior UI */ }
  } finally {
    els.btnActivate.disabled = false;
  }
}

async function onClear() {
  if (!window.confirm('确定清除本机已保存的授权？清除后填写功能将 fail-closed，直到再次激活。')) {
    return;
  }
  setActionMessage('正在清除…', null);
  try {
    await clearLocalEntitlement(storage());
    await refreshStatus();
    setActionMessage('已清除本机授权。', 'ok');
  } catch (error) {
    setActionMessage(denyReasonZh(error), 'bad');
  }
}

async function boot() {
  const config = await loadPaidConfig();
  if (!config || !isPaidFlavor(config.buildFlavor)) {
    showFlavorBlocked('未检测到授权版配置（paid-config）。此页只随 scripts/build-paid.ps1 打包；内部试用包请勿加载此页。');
    return;
  }
  if (typeof chrome === 'undefined' || !chrome?.storage?.local) {
    showFlavorBlocked('无法访问扩展存储。请从已加载的「简历快填 · 授权版」扩展中打开本页。');
    return;
  }
  showPanel();
  try {
    await refreshStatus();
  } catch (error) {
    els.stMessage.textContent = denyReasonZh(error);
    els.stMessage.classList.add('bad');
  }

  els.btnActivate.addEventListener('click', () => { void onActivate(); });
  els.btnRefresh.addEventListener('click', () => {
    setActionMessage('');
    void refreshStatus().catch((error) => setActionMessage(denyReasonZh(error), 'bad'));
  });
  els.btnClear.addEventListener('click', () => { void onClear(); });
}

void boot();
