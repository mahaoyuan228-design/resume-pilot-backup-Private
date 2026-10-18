// Paid-flavor service worker. Internal 0.1.4.9 keeps src/background/worker.mjs.
// Content/background hooks detect this path then send RESUME_PAID_VERIFY.
// Fail-closed: missing/invalid paid-config → all verifies deny.

import { installCmsEducationTaskRunner } from '../background/cms-education-task-runner.mjs';
import { installProfileBindingBridge } from '../profile/profile-lifecycle.js';
import { installEducationTaskRunner } from '../background/education-task-runner.mjs';
import { installBasicTaskRunner } from '../background/basic-task-runner.mjs';
import { installGthDraftTaskRunner } from '../background/gth-draft-task-runner.mjs';
import { registerGthDraftMetadataBridge } from '../background/gth-draft-metadata.mjs';
import { registerGthRefreshBasicMetadataBridge } from '../background/gth-refresh-basic-metadata.mjs';
import { registerGthSerialPrototype } from '../background/gth-serial-runner.mjs';
import { createLicenseClient } from './client.mjs';
import { ensureInstallId } from './binding.mjs';
import { LICENSE_CODES, toUiLicenseCode } from './errors.mjs';
import { isFillAllowedAsync } from './entitlement.mjs';
import { FLAVOR_PAID } from './flavor.mjs';

installProfileBindingBridge();

let paidConfig = null;
try {
  // Generated only by scripts/build-paid.ps1 into this folder as paid-config.mjs
  paidConfig = (await import('./paid-config.mjs')).paidConfig;
} catch {
  paidConfig = null;
}

function denyVerify(code = LICENSE_CODES.NOT_ACTIVATED) {
  return { allowed: false, licenseCode: toUiLicenseCode(code), reason: 'license_required' };
}

let verifyBeforeFill = async () => {
  const error = new Error(LICENSE_CODES.NOT_ACTIVATED);
  error.code = LICENSE_CODES.NOT_ACTIVATED;
  throw error;
};
let handlePaidVerify = async () => denyVerify();

if (paidConfig?.buildFlavor === FLAVOR_PAID) {
  try {
    const config = { ...paidConfig, buildFlavor: FLAVOR_PAID };
    const storage = chrome.storage.local;
    const client = createLicenseClient({
      config,
      storage,
      requireOnline: false,
    });
    verifyBeforeFill = () => client.verifyBeforeFill();
    // RESUME_PAID_VERIFY uses thin isFillAllowed helper (fail-closed, non-throwing).
    handlePaidVerify = async () => {
      const installId = await ensureInstallId(storage);
      const entitlement = await client.readEntitlement();
      const decision = await isFillAllowedAsync({
        flavor: FLAVOR_PAID,
        config,
        entitlement,
        installId,
      });
      if (decision.allowed === true) return { allowed: true };
      return denyVerify(decision.licenseCode || LICENSE_CODES.NOT_ACTIVATED);
    };
  } catch {
    verifyBeforeFill = async () => {
      const error = new Error(LICENSE_CODES.CONFIG_MISSING);
      error.code = LICENSE_CODES.NOT_ACTIVATED;
      throw error;
    };
    handlePaidVerify = async () => denyVerify();
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'RESUME_OPEN_LICENSE_ACTIVATE') {
    const url = chrome.runtime.getURL('src/license/activate.html');
    chrome.tabs.create({ url }).then(
      () => sendResponse({ ok: true }),
      () => sendResponse({ ok: false }),
    );
    return true;
  }
  if (message?.type !== 'RESUME_PAID_VERIFY') return undefined;
  Promise.resolve()
    .then(() => handlePaidVerify())
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse({
      allowed: false,
      licenseCode: toUiLicenseCode(error?.code),
      reason: 'license_required',
    }));
  return true;
});

installEducationTaskRunner({ verifyBeforeFill });
installBasicTaskRunner({ verifyBeforeFill });
registerGthDraftMetadataBridge();
registerGthRefreshBasicMetadataBridge();
installGthDraftTaskRunner({ verifyBeforeFill });
installCmsEducationTaskRunner({ verifyBeforeFill });
registerGthSerialPrototype({ verifyBeforeFill });
installCmsEducationTaskRunner({ recordKind: 'internship', verifyBeforeFill });
