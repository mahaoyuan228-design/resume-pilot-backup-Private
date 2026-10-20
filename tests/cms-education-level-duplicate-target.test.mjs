/**
 * Education-row 学历* next to a bound basic 学历*.
 * Pathless rows keep their gate reason instead of failing duplicate_target.
 * They stay out of the 个人基本信息 summary. Never Save. No live DOM.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCmsBasicAutoRunner } from '../src/background/cms-basic-auto.mjs';

function runner() {
  return createCmsBasicAutoRunner({
    api: {
      storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {} } },
      runtime: {
        id: 'x',
        getURL: (p) => 'chrome-extension://x/' + p,
        getManifest: () => ({ background: { service_worker: 'src/background/worker.mjs' } }),
      },
      tabs: {},
      scripting: {},
    },
  });
}

const basicLevel = {
  id: 'cms-academic-__cms_basic_education_level',
  labels: ['学历*'],
  path: 'customAnswers.__cms_basic_education_level',
  status: 'skipped',
  reason: 'existing_value',
  kind: 'cms_ant_v3_select',
  scope: { sectionName: '个人基本信息必填', rowContext: 'single' },
};

function educationLevel(extra = {}) {
  return {
    id: 'cms-ant-v3-学历',
    labels: ['学历*'],
    path: null,
    status: 'failed',
    reason: 'duplicate_target',
    kind: 'cms_ant_v3_select',
    scope: { sectionName: '教育经历必填', rowContext: 'multiple' },
    ...extra,
  };
}

test('pathless education 学历 duplicate_target stays out of the personal summary', () => {
  const auto = runner();
  for (const field of [
    educationLevel(),
    educationLevel({ scope: undefined, sectionName: undefined }),
    educationLevel({ id: 'cms-ant-v3-学历-4', scope: { sectionName: '个人基本信息必填', rowContext: 'single' } }),
    { id: 'cms-ant-v3-学历', labels: ['学历*'], path: null, status: 'failed', reason: 'duplicate_target', kind: 'cms_ant_v3_select' },
    { labels: ['学历'], status: 'failed', reason: 'duplicate_target' },
    { labels: ['专业名称'], path: null, status: 'failed', reason: 'duplicate_target' },
  ]) {
    assert.equal(auto.isPersonalField(field), false, JSON.stringify(field));
  }
  assert.equal(auto.isPersonalField(basicLevel), true);
  assert.equal(auto.isPersonalField({
    id: 'cms-ant-v3-学历-2',
    labels: ['学历*'],
    path: 'customAnswers.学历',
    scope: { sectionName: '个人基本信息必填', rowContext: 'single' },
  }), true);
  const summary = auto.summarizeFields([
    basicLevel,
    educationLevel(),
    educationLevel({ id: 'cms-ant-v3-学历-9', scope: undefined }),
    { id: 'name', labels: ['姓名'], path: 'fullName', status: 'verified', scope: { sectionName: '个人基本信息必填' } },
  ]);
  assert.equal(summary.personalCount, 2);
  assert.equal(summary.verified, 1);
  assert.equal(summary.skipped, 1);
  assert.equal(summary.failed, 0);
  assert.equal(summary.totalReturned, 4);
  assert.equal(summary.personal.some(field => field.id === 'cms-ant-v3-学历'), false);
});
