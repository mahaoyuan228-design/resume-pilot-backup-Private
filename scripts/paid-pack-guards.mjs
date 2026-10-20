// Fail-closed checks for a fresh paid Edge pack.
// A 20261018 hotpatched dist is not a rebuild. build-paid.ps1 / build-paid-smoke.mjs
// must copy cms-basic-seed-from-education.mjs and static-import generated paid-config.
// Edge 155 MV3 does not register a service worker that top-level await-imports paid-config.
// The packed tree must also carry tip CMS 学历 duplicate_target ids, region fail-closed
// markers, and the CMS auto inject files. It must carry tip GTH basic fail-closed
// coverage: unsupported or unsettled 现居住地/照片/参加工作时间 are failed, and a
// requested fill is not stored as completed. This gate does not claim a live site is supported.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const CMS_BASIC_SEED = 'src/profile/cms-basic-seed-from-education.mjs';
export const GUARD_WORKER = 'src/license/guard-worker.mjs';
export const PAID_CONFIG = 'src/license/paid-config.mjs';

// Byte-compared into the paid output. An Oct-18 pack predates the 学历 id suffix and region fail-closed.
export const CMS_TIP_SOURCE_FILES = [
  'src/content/engine.js',
  'src/content/cms-region.js',
  'src/content/cms-education-multi-select.js',
  'src/content/cms-record-controller.js',
  'src/content/cms-education-serialization.mjs',
  'src/profile/site-question-templates.js',
  'src/background/cms-basic-auto.mjs',
  'src/background/cms-education-task-runner.mjs',
  'src/license/guard-worker.mjs',
];

export const CMS_RUNNER_FILES = [
  'src/background/cms-basic-auto.mjs',
  'src/background/cms-education-task-runner.mjs',
];

// executeScript / auto-page paths the runners name as strings. Import walk does not see them.
export const CMS_REQUIRED_INJECT = [
  'src/content/engine.js',
  'src/content/cms-region.js',
  'src/content/cms-education-multi-select.js',
  'src/auto/cms-basic-auto.html',
  'src/auto/cms-education-auto.html',
];

const DEGREE_SYNONYM_NEEDLES = [
  'DEGREE_LEVELS',
  "['硕士','硕士研究生']",
  "['本科','大学本科']",
  "['博士','博士研究生']",
];

export const CMS_TIP_MARKERS = [
  {
    rel: 'src/content/engine.js',
    group: 'cms-degree',
    needles: [
      'education 学历',
      'cms-ant-v3-${M.normalize(labels[0])}-${position}',
      'cms_record_requires_explicit_binding',
    ],
  },
  {
    rel: 'src/content/cms-education-multi-select.js',
    group: 'cms-degree',
    needles: DEGREE_SYNONYM_NEEDLES,
  },
  {
    rel: 'src/content/cms-record-controller.js',
    group: 'cms-degree',
    needles: DEGREE_SYNONYM_NEEDLES,
  },
  {
    rel: 'src/content/cms-education-serialization.mjs',
    group: 'cms-degree',
    needles: DEGREE_SYNONYM_NEEDLES,
  },
  {
    rel: 'src/profile/site-question-templates.js',
    group: 'region-fail-closed',
    needles: [
      'export function planCmsRegionFact',
      'export const CMS_REGION_FACT_FAIL_CLOSED_REASONS',
      'region_fact_not_unique',
      'region_fact_unconfirmed',
    ],
  },
  {
    rel: 'src/content/engine.js',
    group: 'region-fail-closed',
    needles: [
      'function settleUnresolvedEntry',
      'if (reason === "duplicate_target") return "failed"',
      'region_fact_not_unique',
    ],
  },
  {
    rel: 'src/content/cms-region.js',
    group: 'region-fail-closed',
    needles: [
      'implementationRevision:3',
      "status:'failed',reason:'unconfirmed_or_incomplete_region_pair'",
      "reason:'region_fact_not_unique'",
    ],
  },
  {
    rel: 'src/background/cms-basic-auto.mjs',
    group: 'region-fail-closed',
    needles: [
      'function coerceRegionFailClosed',
      'planCmsRegionFact',
      'CMS_REGION_FACT_FAIL_CLOSED_REASONS',
    ],
  },
  {
    rel: 'src/license/guard-worker.mjs',
    group: 'paid-cms-auto',
    needles: [
      "bootPaidAuto('cms-basic-auto', installCmsBasicAutoRunner)",
      'installCmsEducationTaskRunner({ verifyBeforeFill })',
      "installCmsEducationTaskRunner({ recordKind: 'internship', verifyBeforeFill })",
    ],
  },
  {
    rel: 'src/background/cms-basic-auto.mjs',
    group: 'paid-cms-auto',
    needles: [
      "'src/content/engine.js'",
      "'src/content/cms-region.js'",
      'Never Save/submit',
    ],
  },
  {
    rel: 'src/background/cms-education-task-runner.mjs',
    group: 'paid-cms-auto',
    needles: [
      "'src/content/cms-education-multi-select.js'",
      'CMS_EDUCATION_AUTO_FILL',
      'export function installCmsEducationTaskRunner',
    ],
  },
];

const NEVER_SAVE_FILES = new Set([
  'src/license/guard-worker.mjs',
  'src/background/cms-basic-auto.mjs',
  'src/background/cms-education-task-runner.mjs',
  'src/content/engine.js',
]);

// Byte-compared into the paid output. Pre-PR#23 GTH basic stored unsupported
// 现居住地/照片/参加工作时间 as skipped and could still mark the job completed.
export const GTH_TIP_SOURCE_FILES = [
  'src/content/gth-basic.js',
  'src/background/basic-task-runner.mjs',
  'src/background/gth-basic-auto.mjs',
  'src/popup/gth-basic-actions.js',
];

export const GTH_RUNNER_FILES = [
  'src/background/gth-basic-auto.mjs',
  'src/background/basic-task-runner.mjs',
];

// executeScript path named as a string. Import walk does not see it.
export const GTH_REQUIRED_INJECT = [
  'src/content/gth-basic.js',
];

export const GTH_TIP_MARKERS = [
  {
    rel: 'src/content/gth-basic.js',
    group: 'gth-unsupported-failed',
    needles: [
      "status:field.kind==='unsupported'?'failed':'skipped'",
      "reason:field.kind==='unsupported'?'control_not_supported':'not_run'",
    ],
  },
  {
    rel: 'src/background/basic-task-runner.mjs',
    group: 'gth-unsupported-failed',
    needles: [
      "status:supported?(valid?row.status:'skipped'):'failed'",
      'export const GTH_COVERAGE_FAIL_CLOSED_REASONS',
      'export function planGthBasicCoverage',
      'export function sealGthJobCoverage',
      'export function gthRequestedFillBlocksComplete',
      "'control_not_supported'",
      "'region_fact_not_unique'",
      "'region_fact_unconfirmed'",
      "selector:null,query:null,status:'failed',ok:false",
      "const blocked=fields.some(field=>field.status==='failed'&&GTH_COVERAGE_FAIL_CLOSED_REASONS.includes(field.reason));",
    ],
  },
  {
    rel: 'src/background/basic-task-runner.mjs',
    group: 'gth-no-completed-on-skip',
    needles: [
      "if(outcome!=='failed_before_write'&&gthRequestedFillBlocksComplete(coveragePlan)){",
    ],
  },
  {
    rel: 'src/background/gth-basic-auto.mjs',
    group: 'gth-no-completed-on-skip',
    needles: [
      'planGthBasicCoverage',
      'sealGthJobCoverage',
      'gthRequestedFillBlocksComplete',
      'if(gthRequestedFillBlocksComplete(coveragePlan)){',
      'Unsupported or unsettled 现居住地/照片/参加工作时间 fail closed and are not a completed fill.',
      "'src/content/gth-basic.js'",
    ],
  },
  {
    rel: 'src/popup/gth-basic-actions.js',
    group: 'gth-no-completed-on-skip',
    needles: [
      'GTH_COVERAGE_FAIL_CLOSED_REASONS',
      '现居住地、照片或参加工作时间未能填写（控件尚未支持，或地区资料未定）。本次不记为完成，未保存、未提交。',
    ],
  },
];

const GTH_NEVER_SAVE_FILES = new Set(GTH_TIP_SOURCE_FILES);

const AWAIT_PAID_CONFIG = /await\s+import\s*\(\s*['"]\.\/paid-config\.mjs['"]\s*\)/;
const STATIC_PAID_CONFIG = /import\s+\{\s*paidConfig\s+as\s+paidConfigImported\s*\}\s+from\s+['"]\.\/paid-config\.mjs['"]/;

export function parsePsStringArray(scriptText, varName) {
  const re = new RegExp(`\\$${varName} = @\\(([\\s\\S]*?)\\)\\s*\\n`);
  const match = scriptText.match(re);
  if (!match) throw new Error(`$${varName} array not found`);
  return match[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.replace(/^'/, '').replace(/',$/, '').replace(/'$/, ''))
    .filter(Boolean);
}

export function assertSeedOnPaidPackList(productFiles) {
  if (!Array.isArray(productFiles) || !productFiles.includes(CMS_BASIC_SEED)) {
    throw new Error(`paid pack list missing ${CMS_BASIC_SEED}`);
  }
}

export function assertStaticPaidConfigImport(guardSource) {
  if (typeof guardSource !== 'string') {
    throw new Error('guard-worker source missing');
  }
  if (AWAIT_PAID_CONFIG.test(guardSource)) {
    throw new Error(
      'guard-worker still has a top-level await import("./paid-config.mjs"). Edge 155 MV3 will not register that service worker. Use a static import.',
    );
  }
  if (!STATIC_PAID_CONFIG.test(guardSource)) {
    throw new Error(
      'guard-worker missing static import { paidConfig as paidConfigImported } from "./paid-config.mjs"',
    );
  }
}

export function assertSourcePaidConfigFailClosed(source) {
  if (typeof source !== 'string' || !source.includes('export const paidConfig')) {
    throw new Error('source src/license/paid-config.mjs placeholder missing');
  }
  if (/buildFlavor:\s*['"]paid['"]/.test(source)) {
    throw new Error('source src/license/paid-config.mjs must stay a fail-closed placeholder (not buildFlavor paid)');
  }
  if (!/buildFlavor:\s*['"]internal['"]/.test(source)) {
    throw new Error('source paid-config.mjs must keep buildFlavor internal');
  }
  if (source.includes('BEGIN PRIVATE KEY')) {
    throw new Error('source paid-config.mjs contains a private key');
  }
}

// `from '…'` and `import('…')` miss a bare side-effect `import './file.mjs'`.
// worker.mjs / guard-worker.mjs load bg-ping that way; omitting it keeps the MV3 worker from starting.
export const RELATIVE_MODULE_IMPORT_SOURCE =
  '(?:from\\s*|import\\s*\\(|import\\s*)\\s*["\'](\\.[^"\']+)["\']';

export function relativeSpecifiers(source, isHtml) {
  const pattern = isHtml
    ? /(?:src|href)\s*=\s*["'](\.[^"']+)["']/g
    : new RegExp(RELATIVE_MODULE_IMPORT_SOURCE, 'g');
  return [...source.matchAll(pattern)].map((item) => item[1]);
}

export function assertPackImportsResolve(extensionRoot, files) {
  const allowed = new Set(files);
  const problems = [];
  for (const rel of files) {
    if (!rel.startsWith('src/')) continue;
    if (rel.startsWith('src/import/vendor/')) continue;
    if (!/\.(?:html|js|mjs)$/.test(rel)) continue;
    const abs = path.join(extensionRoot, rel);
    if (!fs.existsSync(abs)) {
      problems.push(`missing pack file ${rel}`);
      continue;
    }
    const text = fs.readFileSync(abs, 'utf8');
    for (const spec of relativeSpecifiers(text, rel.endsWith('.html'))) {
      const clean = spec.split('?')[0].split('#')[0];
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(rel), clean));
      const out = path.join(extensionRoot, resolved);
      if (resolved.startsWith('..') || path.posix.isAbsolute(resolved) || !allowed.has(resolved) || !fs.existsSync(out)) {
        problems.push(`${rel} -> ${resolved}`);
      }
    }
  }
  if (problems.length) {
    throw new Error(`paid pack import unresolved:\n${problems.join('\n')}`);
  }
}

function installPaidSmokeChrome() {
  const listeners = [];
  globalThis.chrome = {
    runtime: {
      id: 'paid-rebuild-smoke',
      getURL: (resource) => `chrome-extension://paid-rebuild-smoke/${resource}`,
      getManifest: () => ({ background: { service_worker: GUARD_WORKER } }),
      onMessage: { addListener(fn) { listeners.push(fn); } },
      onConnect: { addListener() {} },
    },
    storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {} } },
    tabs: {
      query: async () => [],
      get: async () => ({ id: 1 }),
      create: async () => ({ id: 1 }),
      update: async () => ({ id: 1 }),
    },
    windows: { update: async () => ({}) },
    scripting: { executeScript: async () => [] },
  };
  return listeners;
}

function dispatch(listeners, message, sender) {
  let response;
  let held = false;
  for (const listener of listeners) {
    const result = listener(message, sender, (value) => { response = value; });
    if (result === true) held = true;
  }
  return { response, held };
}

export function cmsInjectedRels(source) {
  if (typeof source !== 'string') return [];
  return [...source.matchAll(/'(src\/[^']+\.(?:js|mjs|html))'/g)].map((item) => item[1]);
}

function assertTipMarkers(readText, markers, neverSaveFiles, label) {
  const missing = [];
  const seen = new Set();
  for (const item of markers) {
    let text;
    try {
      text = readText(item.rel);
    } catch (error) {
      missing.push(`missing ${item.rel}: ${error.message}`);
      continue;
    }
    if (typeof text !== 'string') {
      missing.push(`missing ${item.rel}`);
      continue;
    }
    for (const needle of item.needles) {
      if (!text.includes(needle)) missing.push(`${item.group}: ${item.rel} missing ${needle}`);
    }
    if (!seen.has(item.rel) && neverSaveFiles.has(item.rel) && /softwareClickedSave\s*=\s*true/.test(text)) {
      missing.push(`${item.rel} attempts Save`);
    }
    seen.add(item.rel);
  }
  if (missing.length) {
    throw new Error(`paid pack missing tip ${label} content:\n${missing.join('\n')}`);
  }
}

export function assertCmsTipMarkers(readText) {
  assertTipMarkers(readText, CMS_TIP_MARKERS, NEVER_SAVE_FILES, 'CMS');
}

export function assertGthTipMarkers(readText) {
  assertTipMarkers(readText, GTH_TIP_MARKERS, GTH_NEVER_SAVE_FILES, 'GTH');
}

function assertInjectedFilesPacked(runnerFiles, required, runnerTexts, packedFiles, exists, phrases) {
  const allowed = new Set(packedFiles);
  const problems = [];
  const seen = new Set();
  for (const rel of runnerFiles) {
    const text = runnerTexts[rel];
    if (typeof text !== 'string') {
      problems.push(`missing runner ${rel}`);
      continue;
    }
    const paths = cmsInjectedRels(text);
    if (!paths.length) problems.push(`${rel} listed no ${phrases.kind} inject paths`);
    for (const injected of paths) {
      seen.add(injected);
      if (!allowed.has(injected)) problems.push(`${rel} -> ${injected} not on paid pack list`);
      else if (typeof exists === 'function' && !exists(injected)) {
        problems.push(`${rel} -> ${injected} missing from packed tree`);
      }
    }
  }
  for (const rel of required) {
    if (!seen.has(rel)) problems.push(`${phrases.dropped} ${rel}`);
  }
  if (problems.length) {
    throw new Error(`${phrases.summary}:\n${problems.join('\n')}`);
  }
  return [...seen];
}

export function assertCmsInjectedFilesPacked(runnerTexts, packedFiles, exists) {
  return assertInjectedFilesPacked(CMS_RUNNER_FILES, CMS_REQUIRED_INJECT, runnerTexts, packedFiles, exists, {
    kind: 'CMS',
    dropped: 'CMS auto inject set dropped',
    summary: 'paid pack CMS auto files missing',
  });
}

export function assertGthInjectedFilesPacked(runnerTexts, packedFiles, exists) {
  return assertInjectedFilesPacked(GTH_RUNNER_FILES, GTH_REQUIRED_INJECT, runnerTexts, packedFiles, exists, {
    kind: 'GTH',
    dropped: 'GTH inject set dropped',
    summary: 'paid pack GTH inject files missing',
  });
}

export function assertPackedCmsTip(extensionRoot, packedFiles) {
  const readText = (rel) => {
    const abs = path.join(extensionRoot, rel);
    if (!fs.existsSync(abs)) throw new Error(`missing ${rel}`);
    return fs.readFileSync(abs, 'utf8');
  };
  assertCmsTipMarkers(readText);
  const runnerTexts = {};
  for (const rel of CMS_RUNNER_FILES) runnerTexts[rel] = readText(rel);
  const injected = assertCmsInjectedFilesPacked(
    runnerTexts,
    packedFiles,
    (rel) => fs.existsSync(path.join(extensionRoot, rel)),
  );
  return {
    cmsDegreePacked: true,
    regionFailClosedPacked: true,
    paidCmsAutoPacked: true,
    cmsInjectedFilesPacked: true,
    injectedCount: injected.length,
  };
}

export function assertPackedGthTip(extensionRoot, packedFiles) {
  const readText = (rel) => {
    const abs = path.join(extensionRoot, rel);
    if (!fs.existsSync(abs)) throw new Error(`missing ${rel}`);
    return fs.readFileSync(abs, 'utf8');
  };
  assertGthTipMarkers(readText);
  const runnerTexts = {};
  for (const rel of GTH_RUNNER_FILES) runnerTexts[rel] = readText(rel);
  const injected = assertGthInjectedFilesPacked(
    runnerTexts,
    packedFiles,
    (rel) => fs.existsSync(path.join(extensionRoot, rel)),
  );
  return {
    gthFailClosedPacked: true,
    gthInjectedFilesPacked: true,
    gthInjectedCount: injected.length,
  };
}

export function assertPackedBytesMatchSource(repoRoot, extensionRoot, rels = [...CMS_TIP_SOURCE_FILES, ...GTH_TIP_SOURCE_FILES]) {
  for (const rel of rels) {
    const sourcePath = path.join(repoRoot, rel);
    const packedPath = path.join(extensionRoot, rel);
    if (!fs.existsSync(sourcePath) || !fs.existsSync(packedPath)) {
      throw new Error(`packed ${rel} differs from tip source`);
    }
    const source = fs.readFileSync(sourcePath);
    const packed = fs.readFileSync(packedPath);
    if (!source.equals(packed)) throw new Error(`packed ${rel} differs from tip source`);
  }
}

/**
 * Import the freshly built extension (not the source tree) and prove:
 * - cms-basic seed module evaluates and exports seedCmsBasicFromEducation
 * - guard-worker evaluates with the generated paid-config static import
 * - BG_PING is registered (service worker module ran)
 * - CMS/GTH basic auto and CMS education auto listeners are installed (sync deny, no page DOM)
 * - packed CMS files carry tip 学历 / region fail-closed / auto inject pieces
 * - packed GTH basic files fail closed on unsupported or unsettled 现居住地/照片/参加工作时间
 *   and do not store that fill as completed
 */
export async function assertBuiltPaidExtension(extensionRoot, packedFiles) {
  const guardPath = path.join(extensionRoot, GUARD_WORKER);
  const guardSource = fs.readFileSync(guardPath, 'utf8');
  assertStaticPaidConfigImport(guardSource);
  if (guardSource.includes('softwareClickedSave = true') || guardSource.includes('softwareClickedSave=true')) {
    throw new Error('built guard-worker attempts Save');
  }

  const generated = fs.readFileSync(path.join(extensionRoot, PAID_CONFIG), 'utf8');
  if (!/buildFlavor:\s*['"]paid['"]/.test(generated)) {
    throw new Error('generated paid-config is not buildFlavor paid');
  }
  if (generated.includes('BEGIN PRIVATE KEY')) {
    throw new Error('generated paid-config contains a private key');
  }
  if (!/Generated by scripts\/build-paid(?:\.ps1|-smoke\.mjs)/.test(generated)) {
    throw new Error('generated paid-config was not written by the paid build');
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'manifest.json'), 'utf8'));
  if (manifest.background?.service_worker !== GUARD_WORKER) {
    throw new Error(`built manifest service_worker is ${manifest.background?.service_worker}`);
  }
  assertPackImportsResolve(extensionRoot, packedFiles);
  const tip = assertPackedCmsTip(extensionRoot, packedFiles);
  const gth = assertPackedGthTip(extensionRoot, packedFiles);

  let seedMod;
  try {
    seedMod = await import(pathToFileURL(path.join(extensionRoot, CMS_BASIC_SEED)).href);
  } catch (error) {
    throw new Error(`built pack did not resolve ${CMS_BASIC_SEED}: ${error.message}`);
  }
  if (typeof seedMod.seedCmsBasicFromEducation !== 'function') {
    throw new Error('built cms-basic seed did not export seedCmsBasicFromEducation');
  }

  const autoMod = await import(pathToFileURL(path.join(extensionRoot, 'src/background/cms-basic-auto.mjs')).href);
  if (typeof autoMod.installCmsBasicAutoRunner !== 'function') {
    throw new Error('built cms-basic-auto did not evaluate (seed import unresolved)');
  }
  const gthMod = await import(pathToFileURL(path.join(extensionRoot, 'src/background/gth-basic-auto.mjs')).href);
  if (typeof gthMod.installGthBasicAutoRunner !== 'function') {
    throw new Error('built gth-basic-auto did not evaluate');
  }

  const listeners = installPaidSmokeChrome();
  await import(pathToFileURL(guardPath).href);
  const ping = dispatch(listeners, { type: 'BG_PING' }, { id: 'paid-rebuild-smoke' });
  if (ping.held || ping.response?.ok !== true || ping.response?.reason !== 'BG_PONG') {
    throw new Error('built guard-worker did not register BG_PING');
  }

  const stranger = { id: 'paid-rebuild-smoke', url: 'https://rebuild-smoke.invalid/not-a-form' };
  for (const type of ['CMS_BASIC_AUTO', 'GTH_BASIC_AUTO', 'CMS_EDUCATION_AUTO_FILL', 'CMS_EDUCATION_MULTI_INSPECT_JOB']) {
    const result = dispatch(listeners, { type, mode: 'readiness' }, stranger);
    if (result.held) throw new Error(`${type} held the channel on the built service worker`);
    if (result.response?.ok !== false) throw new Error(`${type} had no listener on the built service worker`);
    if (!/wrong_sender/.test(String(result.response?.reason || ''))) {
      throw new Error(`${type} listener did not fail closed on an unknown sender`);
    }
  }

  return {
    seedExportResolved: true,
    serviceWorkerModuleEvaluated: true,
    bgPingRegistered: true,
    cmsBasicAutoInstalled: true,
    gthBasicAutoInstalled: true,
    cmsEducationAutoInstalled: true,
    ...tip,
    ...gth,
  };
}
