import {installCmsEducationTaskRunner} from './cms-education-task-runner.mjs';
import {installProfileBindingBridge} from '../profile/profile-lifecycle.js';
installProfileBindingBridge();
import {installEducationTaskRunner} from './education-task-runner.mjs';
import {installBasicTaskRunner} from './basic-task-runner.mjs';
import {installGthDraftTaskRunner} from './gth-draft-task-runner.mjs';
import {registerGthDraftMetadataBridge} from './gth-draft-metadata.mjs';
import {registerGthRefreshBasicMetadataBridge} from './gth-refresh-basic-metadata.mjs';
installEducationTaskRunner();
installBasicTaskRunner();
registerGthDraftMetadataBridge();
registerGthRefreshBasicMetadataBridge();
installGthDraftTaskRunner();

installCmsEducationTaskRunner();

import {registerGthSerialPrototype} from './gth-serial-runner.mjs';
registerGthSerialPrototype();

installCmsEducationTaskRunner({recordKind:'internship'});

import {installGthEducationAutoRunner} from './gth-education-auto.mjs';
installGthEducationAutoRunner();

import {installGthBasicAutoRunner} from './gth-basic-auto.mjs';
installGthBasicAutoRunner();

import {installGthSimpleAutoRunner} from './gth-simple-auto.mjs';
installGthSimpleAutoRunner();

import {installGthOtherAutoRunner} from './gth-other-auto.mjs';
installGthOtherAutoRunner();

import {installGthIntentAutoRunner} from './gth-intent-auto.mjs';
installGthIntentAutoRunner();

import {installCmsBasicAutoRunner} from './cms-basic-auto.mjs';
installCmsBasicAutoRunner();

import {installFeishuAtsxBasicAutoRunner} from './feishu-atsx-basic-auto.mjs';
installFeishuAtsxBasicAutoRunner();

import {installBeisen2022BasicAutoRunner} from './beisen-2022-basic-auto.mjs';
installBeisen2022BasicAutoRunner();

import {installMokaBasicAutoRunner} from './moka-basic-auto.mjs';
installMokaBasicAutoRunner();
