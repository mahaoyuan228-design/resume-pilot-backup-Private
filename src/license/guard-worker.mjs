// Paid-flavor service worker. Internal 0.1.4.9 keeps src/background/worker.mjs.
// Content/background hooks detect this path then send RESUME_PAID_VERIFY.
// Fail-closed: non-paid or invalid paid-config → all verifies deny.
// bg-ping.mjs must stay the first import so BG_PING / bg-wake exist even if a later install throws.

import '../background/bg-ping.mjs';
import { installCmsEducationTaskRunner } from '../background/cms-education-task-runner.mjs';
import { installProfileBindingBridge } from '../profile/profile-lifecycle.js';
import { installEducationTaskRunner } from '../background/education-task-runner.mjs';
import { installBasicTaskRunner } from '../background/basic-task-runner.mjs';
import { installGthDraftTaskRunner } from '../background/gth-draft-task-runner.mjs';
import { registerGthDraftMetadataBridge } from '../background/gth-draft-metadata.mjs';
import { registerGthRefreshBasicMetadataBridge } from '../background/gth-refresh-basic-metadata.mjs';
import { registerGthSerialPrototype } from '../background/gth-serial-runner.mjs';
import { installGthEducationAutoRunner } from '../background/gth-education-auto.mjs';
import { installGthBasicAutoRunner } from '../background/gth-basic-auto.mjs';
import { installGthSimpleAutoRunner } from '../background/gth-simple-auto.mjs';
import { installGthOtherAutoRunner } from '../background/gth-other-auto.mjs';
import { installGthIntentAutoRunner } from '../background/gth-intent-auto.mjs';
import { installCmsBasicAutoRunner } from '../background/cms-basic-auto.mjs';
import { installFeishuAtsxBasicAutoRunner } from '../background/feishu-atsx-basic-auto.mjs';
import { installBeisen2022BasicAutoRunner } from '../background/beisen-2022-basic-auto.mjs';
import { installMokaBasicAutoRunner } from '../background/moka-basic-auto.mjs';
import { installHotjobMcBasicAutoRunner } from '../background/hotjob-mc-basic-auto.mjs';
// Edge 155 MV3 SW fails to register when paid-config is loaded via top-level await import; static import is required.
import { paidConfig as paidConfigImported } from './paid-config.mjs';
import { createLicenseClient } from './client.mjs';
import { ensureInstallId } from './binding.mjs';
import { LICENSE_CODES, toUiLicenseCode } from './errors.mjs';
import { isFillAllowedAsync } from './entitlement.mjs';
import { FLAVOR_PAID } from './flavor.mjs';

installProfileBindingBridge();

let paidConfig = paidConfigImported;

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

function boot(name, install) {
  try {
    install();
  } catch (error) {
    console.error('[bg] listener install failed', name, error);
  }
}

boot('education-task', () => installEducationTaskRunner({ verifyBeforeFill }));
boot('basic-task', () => installBasicTaskRunner({ verifyBeforeFill }));
boot('gth-draft-metadata', registerGthDraftMetadataBridge);
boot('gth-refresh-basic-metadata', registerGthRefreshBasicMetadataBridge);
boot('gth-draft-task', () => installGthDraftTaskRunner({ verifyBeforeFill }));
boot('cms-education', () => installCmsEducationTaskRunner({ verifyBeforeFill }));
boot('gth-serial', () => registerGthSerialPrototype({ verifyBeforeFill }));
boot('cms-internship', () => installCmsEducationTaskRunner({ recordKind: 'internship', verifyBeforeFill }));
boot('gth-education-auto', () => installGthEducationAutoRunner({ verifyBeforeFill }));
boot('gth-simple-auto', () => installGthSimpleAutoRunner({ verifyBeforeFill }));
boot('gth-other-auto', () => installGthOtherAutoRunner({ verifyBeforeFill }));
boot('gth-intent-auto', () => installGthIntentAutoRunner({ verifyBeforeFill }));
boot('feishu-atsx-basic-auto', () => installFeishuAtsxBasicAutoRunner({ verifyBeforeFill }));
boot('beisen-2022-basic-auto', () => installBeisen2022BasicAutoRunner({ verifyBeforeFill }));
boot('moka-basic-auto', () => installMokaBasicAutoRunner({ verifyBeforeFill }));
boot('hotjob-mc-basic-auto', () => installHotjobMcBasicAutoRunner({ verifyBeforeFill }));

function bootPaidAuto(name, fn) {
  try { fn({ verifyBeforeFill }); }
  catch (error) { console.error('[paid-auto] install failed', name, error); }
}
bootPaidAuto('gth-basic-auto', installGthBasicAutoRunner);
bootPaidAuto('cms-basic-auto', installCmsBasicAutoRunner);
