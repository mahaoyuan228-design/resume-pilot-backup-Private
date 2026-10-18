/**
 * seedCmsBasicFromEducation: copy only confirmed education → CMS basic aliases.
 * Never invent/confirm 籍贯/婚姻/居住地/面试地点/国籍.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  seedCmsBasicFromEducation,
  pickEducationIndexForCmsBasic,
  CMS_BASIC_NEVER_SEED,
  CMS_BASIC_SEEDABLE
} from '../src/profile/cms-basic-seed-from-education.mjs';
import { createCmsBasicAutoRunner } from '../src/background/cms-basic-auto.mjs';
import { CMS_QUESTION_PAGE } from '../src/profile/site-question-templates.js';
import { SITE_FACTS_KEY } from '../src/profile/cms-education-site-facts.mjs';

const PAGE = CMS_QUESTION_PAGE;

function eduProfile(overrides = {}) {
  return {
    schemaVersion: 1,
    fullName: 'Synthetic',
    education: [
      {
        school: '悉尼大学',
        degree: '硕士',
        major: 'Finance／金融',
        startDate: '',
        endDate: '',
        majorCategory: '',
        unifiedAdmissions: '',
        campusActivities: '',
        gradeRank: '',
        majorDescription: '',
        gpa: '',
        schoolLocation: ''
      },
      {
        school: '示例本科',
        degree: '本科',
        major: '经济学',
        startDate: '2021-09',
        endDate: '2025-06',
        majorCategory: '',
        unifiedAdmissions: '',
        campusActivities: '',
        gradeRank: '',
        majorDescription: '',
        gpa: '',
        schoolLocation: ''
      }
    ],
    customFacts: [],
    customAnswers: {},
    siteOptionMappings: [
      {
        siteUrlPrefix: 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/',
        fieldPath: 'education.0.degree',
        sourceValue: '硕士',
        optionText: '硕士研究生'
      }
    ],
    confirmedFields: [
      'education.0.school',
      'education.0.degree',
      'education.0.major',
      'education.1.school',
      'education.1.degree',
      'education.1.major',
      'siteOptionMappings.0.optionText'
    ],
    ...overrides
  };
}

test('pickEducationIndex prefers higher degree among confirmed school+degree+major', () => {
  const profile = eduProfile();
  assert.equal(pickEducationIndexForCmsBasic(profile, []), 0);
});

test('seed copies school/degree/major and confirms; uses mapped 学历 optionText', () => {
  const result = seedCmsBasicFromEducation(eduProfile());
  assert.equal(result.ok, true);
  assert.equal(result.profileIndex, 0);
  assert.equal(result.profile.customAnswers.毕业院校, '悉尼大学');
  assert.equal(result.profile.customAnswers.__cms_basic_education_level, '硕士研究生');
  assert.equal(result.profile.customAnswers.__cms_basic_major, 'Finance／金融');
  assert.ok(result.profile.confirmedFields.includes('customAnswers.毕业院校'));
  assert.ok(result.profile.confirmedFields.includes('customAnswers.__cms_basic_education_level'));
  assert.ok(result.profile.confirmedFields.includes('customAnswers.__cms_basic_major'));
  assert.equal(result.profile.customAnswers.__cms_basic_academic_degree, undefined);
  assert.equal(result.profile.customAnswers.__cms_basic_graduation_date, undefined);
});

test('seed takes academicDegree + full graduation day only from confirmed site facts', () => {
  const siteFactEntries = [
    {
      confirmed: true,
      field: 'academicDegree',
      origin: 'manual',
      profileIndex: 0,
      sitePageUrl: PAGE,
      value: '硕士'
    },
    {
      confirmed: true,
      field: 'endDate',
      origin: 'manual',
      profileIndex: 0,
      sitePageUrl: PAGE,
      value: '2026-07-01'
    }
  ];
  const result = seedCmsBasicFromEducation(eduProfile(), { siteFactEntries });
  assert.equal(result.ok, true);
  assert.equal(result.profile.customAnswers.__cms_basic_academic_degree, '硕士');
  assert.equal(result.profile.customAnswers.__cms_basic_graduation_date, '2026-07-01');
  assert.ok(result.profile.confirmedFields.includes('customAnswers.__cms_basic_academic_degree'));
  assert.ok(result.profile.confirmedFields.includes('customAnswers.__cms_basic_graduation_date'));
});

test('seed never writes 籍贯/婚姻/居住地/面试地点/国籍 even if present elsewhere', () => {
  const result = seedCmsBasicFromEducation(
    eduProfile({
      customAnswers: {
        '国籍/地区*': '中国',
        '婚姻状况*': '未婚',
        籍贯: '请勿采用'
      },
      customFacts: [
        {
          question: '国籍/地区*',
          answer: '中国',
          sitePageUrl: PAGE,
          sectionName: '个人基本信息必填',
          rowContext: 'single'
        },
        {
          question: '婚姻状况*',
          answer: '未婚',
          sitePageUrl: PAGE,
          sectionName: '个人基本信息必填',
          rowContext: 'single'
        }
      ],
      confirmedFields: [
        'education.0.school',
        'education.0.degree',
        'education.0.major',
        'customAnswers.国籍/地区*',
        'customAnswers.婚姻状况*',
        'customAnswers.籍贯'
      ]
    })
  );
  assert.equal(result.ok, true);
  for (const alias of CMS_BASIC_NEVER_SEED) {
    assert.equal(result.profile.customAnswers[alias], undefined);
    assert.equal(result.profile.confirmedFields.includes(`customAnswers.${alias}`), false);
  }
  assert.deepEqual(result.neverSeeded, [...CMS_BASIC_NEVER_SEED]);
});

test('seed does not invent graduation day from YYYY-MM endDate', () => {
  const result = seedCmsBasicFromEducation(
    eduProfile({
      education: [
        {
          school: '悉尼大学',
          degree: '硕士',
          major: 'Finance',
          startDate: '2025-03',
          endDate: '2026-07',
          majorCategory: '',
          unifiedAdmissions: '',
          campusActivities: '',
          gradeRank: '',
          majorDescription: '',
          gpa: '',
          schoolLocation: ''
        }
      ],
      confirmedFields: [
        'education.0.school',
        'education.0.degree',
        'education.0.major',
        'education.0.endDate'
      ],
      siteOptionMappings: []
    })
  );
  assert.equal(result.profile.customAnswers.__cms_basic_graduation_date, undefined);
  assert.equal(result.profile.customAnswers.__cms_basic_education_level, '硕士');
});

test('seed refuses unconfirmed education fields', () => {
  const result = seedCmsBasicFromEducation(
    eduProfile({
      confirmedFields: ['education.0.school'] // degree/major not confirmed
    })
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'education_row_not_ready');
});

test('seed conflict when confirmed CMS alias already differs', () => {
  const result = seedCmsBasicFromEducation(
    eduProfile({
      customFacts: [
        {
          question: '毕业院校',
          answer: '其他大学',
          sitePageUrl: PAGE,
          sectionName: '个人基本信息必填',
          rowContext: 'single'
        }
      ],
      customAnswers: { 毕业院校: '其他大学' },
      confirmedFields: [
        'education.0.school',
        'education.0.degree',
        'education.0.major',
        'customAnswers.毕业院校',
        'siteOptionMappings.0.optionText'
      ]
    })
  );
  assert.ok(result.conflicts.some((row) => row.alias === '毕业院校'));
  assert.equal(result.profile.customAnswers.毕业院校, '其他大学');
});

test('dryRun does not mutate profile answers', () => {
  const profile = eduProfile();
  const result = seedCmsBasicFromEducation(profile, { dryRun: true });
  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.profile.customAnswers.毕业院校, undefined);
  assert.ok(result.seeded.some((row) => row.status === 'would_seed' && row.alias === '毕业院校'));
});

test('CMS_BASIC_SEEDABLE and NEVER_SEED are disjoint', () => {
  for (const alias of CMS_BASIC_NEVER_SEED) {
    assert.equal(CMS_BASIC_SEEDABLE.includes(alias), false);
  }
});

test('CMS_BASIC_AUTO mode seed_from_education persists profile without page write', async () => {
  const epoch = '00000000-0000-4000-8000-000000000001';
  const data = {
    resumeProfile: eduProfile(),
    resumeProfileLifecycle: { version: 1, epoch, state: 'ready' },
    [SITE_FACTS_KEY]: { version: 1, entries: [] }
  };
  const clone = (value) => (value === undefined ? undefined : structuredClone(value));
  const storage = {
    get: async (keys) =>
      keys === null
        ? clone(data)
        : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map((key) => [key, clone(data[key])])),
    set: async (values) => Object.assign(data, clone(values)),
    remove: async (keys) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key];
    }
  };
  let runner;
  const autoSender = {
    id: 'synthetic-extension',
    url: 'chrome-extension://synthetic-extension/src/auto/cms-basic-auto.html?mode=seed_from_education'
  };
  const invoke = (message, sender = autoSender) =>
    new Promise((resolve) => {
      const handled = runner.listener(message, sender, resolve);
      if (handled === false) resolve({ ok: false, reason: 'listener_ignored' });
    });
  const api = {
    storage: { local: storage },
    runtime: {
      id: autoSender.id,
      getURL: (path) => 'chrome-extension://synthetic-extension/' + path,
      getManifest: () => ({ background: { service_worker: 'src/background/worker.mjs' } })
    },
    windows: { update: async () => ({}) },
    tabs: {
      query: async () => [],
      update: async () => ({}),
      sendMessage: async () => {
        throw new Error('seed_must_not_fill');
      }
    },
    scripting: {
      executeScript: async () => {
        throw new Error('seed_must_not_probe');
      }
    }
  };
  runner = createCmsBasicAutoRunner({
    api,
    timeoutMs: 5000,
    lifecycleOptions: { locks: { request: async (_n, _o, work) => work() }, cryptoImpl: globalThis.crypto },
  });
  const response = await invoke({ type: 'CMS_BASIC_AUTO', mode: 'seed_from_education' });
  assert.equal(response.ok, true);
  assert.equal(response.mode, 'seed_from_education');
  assert.equal(response.writeAttempted, false);
  assert.equal(response.saveAttempted, false);
  assert.equal(data.resumeProfile.customAnswers.毕业院校, '悉尼大学');
  assert.ok(data.resumeProfile.confirmedFields.includes('customAnswers.毕业院校'));
  assert.ok(response.readiness.basic.hasValueCount >= 3);
});
