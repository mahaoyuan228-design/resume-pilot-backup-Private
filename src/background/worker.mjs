// bg-ping.mjs must stay the first import. Its listener is registered while that
// module evaluates, before the auto runners below are installed.
import './bg-ping.mjs';
import {installCmsDNetworkGuard} from './cms-row-d-network-guard.mjs';

import {installCmsEducationTaskRunner} from './cms-education-task-runner.mjs';
import {installProfileBindingBridge} from '../profile/profile-lifecycle.js';
import {installEducationTaskRunner} from './education-task-runner.mjs';
import {installBasicTaskRunner} from './basic-task-runner.mjs';
import {installGthDraftTaskRunner} from './gth-draft-task-runner.mjs';
import {registerGthDraftMetadataBridge} from './gth-draft-metadata.mjs';
import {registerGthMonthModelBridge} from './gth-open-fills.mjs';
import {registerGthRefreshBasicMetadataBridge} from './gth-refresh-basic-metadata.mjs';
import {registerGthSerialPrototype} from './gth-serial-runner.mjs';
import {installGthEducationAutoRunner} from './gth-education-auto.mjs';
import {installGthBasicAutoRunner} from './gth-basic-auto.mjs';
import {installGthSimpleAutoRunner} from './gth-simple-auto.mjs';
import {installGthOtherAutoRunner} from './gth-other-auto.mjs';
import {installGthIntentAutoRunner} from './gth-intent-auto.mjs';
import {installCmsBasicAutoRunner} from './cms-basic-auto.mjs';
import {installFeishuAtsxBasicAutoRunner} from './feishu-atsx-basic-auto.mjs';
import {installBeisen2022BasicAutoRunner} from './beisen-2022-basic-auto.mjs';
import {installMokaBasicAutoRunner} from './moka-basic-auto.mjs';
import {installHotjobMcBasicAutoRunner} from './hotjob-mc-basic-auto.mjs';
import {installCmbBasicAutoRunner} from './cmb-basic-auto.mjs';

function boot(name, install) {
  try {
    install();
  } catch (error) {
    console.error('[bg] listener install failed', name, error);
  }
}

boot('profile-binding', installProfileBindingBridge);
boot('education-task', installEducationTaskRunner);
boot('basic-task', installBasicTaskRunner);
boot('gth-draft-metadata', registerGthDraftMetadataBridge);
boot('gth-month-model', registerGthMonthModelBridge);
boot('gth-refresh-basic-metadata', registerGthRefreshBasicMetadataBridge);
boot('gth-draft-task', installGthDraftTaskRunner);
boot('cms-education', () => installCmsEducationTaskRunner());
boot('gth-serial', registerGthSerialPrototype);
boot('cms-internship', () => installCmsEducationTaskRunner({recordKind:'internship'}));
boot('gth-education-auto', installGthEducationAutoRunner);
boot('gth-basic-auto', installGthBasicAutoRunner);
boot('gth-simple-auto', installGthSimpleAutoRunner);
boot('gth-other-auto', installGthOtherAutoRunner);
boot('gth-intent-auto', installGthIntentAutoRunner);
boot('cms-basic-auto', installCmsBasicAutoRunner);
boot('feishu-atsx-basic-auto', installFeishuAtsxBasicAutoRunner);
boot('beisen-2022-basic-auto', installBeisen2022BasicAutoRunner);
boot('moka-basic-auto', installMokaBasicAutoRunner);
boot('hotjob-mc-basic-auto', installHotjobMcBasicAutoRunner);
boot('cmb-basic-auto', installCmbBasicAutoRunner);

boot('cms-row-d-network-guard', installCmsDNetworkGuard);
