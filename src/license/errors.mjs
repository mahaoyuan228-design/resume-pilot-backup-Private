// Stable codes already surfaced in Chinese popup copy (popup.js / cms-session).

export const LICENSE_CODES = Object.freeze({
  NOT_ACTIVATED: 'NOT_ACTIVATED',
  LICENSE_REVOKED: 'LICENSE_REVOKED',
  LICENSE_EXPIRED: 'LICENSE_EXPIRED',
  DEVICE_REVOKED: 'DEVICE_REVOKED',
  SERVER_UNAVAILABLE: 'SERVER_UNAVAILABLE',
  CONFIG_MISSING: 'CONFIG_MISSING',
  BINDING_MISMATCH: 'BINDING_MISMATCH',
});

export const LICENSE_REASON = 'license_required';

export class LicenseGateError extends Error {
  /**
   * @param {string} code
   * @param {string} [detail]
   */
  constructor(code, detail = '') {
    super(code);
    this.name = 'LicenseGateError';
    this.code = code;
    this.detail = detail;
  }
}

/**
 * Map internal scaffold codes to UI licenseCode values.
 * CONFIG_MISSING collapses to NOT_ACTIVATED (operators should not see raw config errors).
 * BINDING_MISMATCH stays distinct so Chinese copy can say「授权与本机不匹配」.
 */
export function toUiLicenseCode(code) {
  if (code === LICENSE_CODES.CONFIG_MISSING) {
    return LICENSE_CODES.NOT_ACTIVATED;
  }
  if (Object.values(LICENSE_CODES).includes(code)) return code;
  return LICENSE_CODES.NOT_ACTIVATED;
}
