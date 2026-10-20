/**
 * Fresh paid-pack rebuild must include the CMS basic seed, a static paid-config
 * import, and tip CMS 学历 / region fail-closed / CMS auto inject files.
 * These checks fail closed when the seed drops off the paid list, when guard-worker
 * goes back to a top-level await import("./paid-config.mjs"), or when the packed
 * tree is still an Oct-18-era CMS copy. The smoke imports the built output.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPaidSmoke } from '../scripts/build-paid-smoke.mjs';
import {
  CMS_BASIC_SEED,
  CMS_REQUIRED_INJECT,
  CMS_RUNNER_FILES,
  CMS_TIP_MARKERS,
  CMS_TIP_SOURCE_FILES,
  PAID_CONFIG,
  assertCmsTipMarkers,
  assertPackedBytesMatchSource,
  assertPackedCmsTip,
  assertPackImportsResolve,
  assertSeedOnPaidPackList,
  assertSourcePaidConfigFailClosed,
  assertStaticPaidConfigImport,
  parsePsStringArray,
} from '../scripts/paid-pack-guards.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('paid pack list must include the cms basic seed', () => {
  const script = fs.readFileSync(path.join(root, 'scripts/build-paid.ps1'), 'utf8');
  const productFiles = parsePsStringArray(script, 'productFiles');
  assertSeedOnPaidPackList(productFiles);
  assert.throws(
    () => assertSeedOnPaidPackList(productFiles.filter((rel) => rel !== CMS_BASIC_SEED)),
    /cms-basic-seed-from-education/,
  );
  assert.throws(() => assertSeedOnPaidPackList([]), /paid pack list missing/);
  assert.match(script, /付费包清单缺少/);
  assert.match(script, /付费包引用未纳入清单/);
  assert.match(script, /await\\s\+import/);
  assert.equal(fs.existsSync(path.join(root, CMS_BASIC_SEED)), true);
});

test('guard-worker static-imports paid-config and rejects a top-level await import', () => {
  const source = fs.readFileSync(path.join(root, 'src/license/guard-worker.mjs'), 'utf8');
  assertStaticPaidConfigImport(source);
  assert.throws(
    () => assertStaticPaidConfigImport('await import("./paid-config.mjs");\n'),
    /top-level await import/,
  );
  assert.throws(
    () => assertStaticPaidConfigImport(
      "import { paidConfig as paidConfigImported } from './paid-config.mjs';\nawait import('./paid-config.mjs');\n",
    ),
    /top-level await import/,
  );
  assert.throws(
    () => assertStaticPaidConfigImport('import { paidConfig } from "./paid-config.mjs";\n'),
    /missing static import/,
  );
});

test('source paid-config placeholder stays fail-closed', () => {
  const source = fs.readFileSync(path.join(root, 'src/license/paid-config.mjs'), 'utf8');
  assertSourcePaidConfigFailClosed(source);
  assert.throws(
    () => assertSourcePaidConfigFailClosed(source.replace("buildFlavor: 'internal'", "buildFlavor: 'paid'")),
    /fail-closed placeholder/,
  );
  assert.doesNotMatch(source, /BEGIN PRIVATE KEY/);
});

test('import walk fails when the seed specifier is not in the paid pack', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-pack-walk-'));
  const rel = 'src/background/cms-basic-auto.mjs';
  fs.mkdirSync(path.join(dir, 'src/background'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, rel),
    "import { seedCmsBasicFromEducation } from '../profile/cms-basic-seed-from-education.mjs';\n",
  );
  try {
    assert.throws(
      () => assertPackImportsResolve(dir, [rel]),
      /cms-basic-seed-from-education/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('smoke rejects a private-key pem and a missing pem path', async () => {
  const destRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-pack-pem-'));
  const privatePem = path.join(destRoot, 'not-a-real-private.pem');
  fs.writeFileSync(privatePem, '-----BEGIN PRIVATE KEY-----\nnot-a-key\n-----END PRIVATE KEY-----\n');
  try {
    await assert.rejects(
      () => runPaidSmoke({ repoRoot: root, destRoot, pemPath: privatePem }),
      /bad public pem/,
    );
    await assert.rejects(
      () => runPaidSmoke({ repoRoot: root, destRoot, pemPath: path.join(destRoot, 'missing.pem') }),
      /PublicKeyPemPath missing/,
    );
  } finally {
    fs.rmSync(destRoot, { recursive: true, force: true });
  }
});

test('fresh paid smoke output registers the service worker and resolves the seed', async () => {
  const destRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-pack-smoke-'));
  try {
    const checks = await runPaidSmoke({ repoRoot: root, destRoot });
    assert.equal(checks.seedOnPackList, true);
    assert.equal(checks.seedCopied, true);
    assert.equal(checks.seedExportResolved, true);
    assert.equal(checks.staticPaidConfigImport, true);
    assert.equal(checks.topLevelAwaitPaidConfig, false);
    assert.equal(checks.sourcePaidConfigFailClosed, true);
    assert.equal(checks.packImportsResolved, true);
    assert.equal(checks.serviceWorkerModuleEvaluated, true);
    assert.equal(checks.bgPingRegistered, true);
    assert.equal(checks.cmsBasicAutoInstalled, true);
    assert.equal(checks.gthBasicAutoInstalled, true);
    assert.equal(checks.cmsEducationAutoInstalled, true);
    assert.equal(checks.cmsDegreePacked, true);
    assert.equal(checks.regionFailClosedPacked, true);
    assert.equal(checks.paidCmsAutoPacked, true);
    assert.equal(checks.cmsInjectedFilesPacked, true);
    assert.equal(checks.cmsTipBytesMatchSource, true);
    assert.equal(checks.injectedCount > CMS_REQUIRED_INJECT.length, true);
    const paidBuild = fs.readFileSync(path.join(root, 'scripts/build-paid.ps1'), 'utf8');
    assertPackedCmsTip(path.join(checks.buildRoot, 'extension'), [
      ...parsePsStringArray(paidBuild, 'productFiles'),
      ...parsePsStringArray(paidBuild, 'licenseFiles'),
      PAID_CONFIG,
    ]);
    assert.equal(checks.serviceWorker, 'src/license/guard-worker.mjs');
    assert.equal(checks.licenseServiceUrl, 'https://127.0.0.1:8787');
    assert.equal(fs.existsSync(path.join(checks.buildRoot, 'extension', CMS_BASIC_SEED)), true);
    const builtGuard = fs.readFileSync(path.join(checks.buildRoot, 'extension/src/license/guard-worker.mjs'), 'utf8');
    assertStaticPaidConfigImport(builtGuard);
    assert.doesNotMatch(builtGuard, /await\s+import\s*\(\s*['"]\.\/paid-config\.mjs['"]\s*\)/);
    const builtConfig = fs.readFileSync(path.join(checks.buildRoot, 'extension/src/license/paid-config.mjs'), 'utf8');
    assert.match(builtConfig, /buildFlavor:\s*'paid'/);
    assert.doesNotMatch(builtConfig, /BEGIN PRIVATE KEY/);
    const sourceConfig = fs.readFileSync(path.join(root, 'src/license/paid-config.mjs'), 'utf8');
    assert.match(sourceConfig, /buildFlavor:\s*'internal'/);
    assert.equal(checks.productFileCount > 0, true);
    assert.equal(checks.licenseFileCount > 0, true);
    const packedEngine = fs.readFileSync(path.join(checks.buildRoot, 'extension/src/content/engine.js'), 'utf8');
    assert.match(packedEngine, /cms-ant-v3-\$\{M\.normalize\(labels\[0\]\)\}-\$\{position\}/);
    assert.match(packedEngine, /function settleUnresolvedEntry/);
    assert.match(packedEngine, /education 学历/);
  } finally {
    fs.rmSync(destRoot, { recursive: true, force: true });
  }
});

function readTip(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('build-paid.ps1 lists the same CMS tip files and needles', () => {
  const script = fs.readFileSync(path.join(root, 'scripts/build-paid.ps1'), 'utf8');
  assert.deepEqual(parsePsStringArray(script, 'cmsTipFiles'), CMS_TIP_SOURCE_FILES);
  assert.deepEqual(parsePsStringArray(script, 'cmsRunnerFiles'), CMS_RUNNER_FILES);
  assert.deepEqual(parsePsStringArray(script, 'cmsRequiredInject'), CMS_REQUIRED_INJECT);
  for (const item of CMS_TIP_MARKERS) {
    for (const needle of item.needles) {
      assert.equal(script.includes(needle), true, `build-paid.ps1 missing needle ${needle}`);
    }
  }
  assert.match(script, /付费包缺少 tip CMS/);
  assert.match(script, /付费包与 tip 源码不一致/);
  assert.match(script, /付费包 CMS 注入文件未纳入清单/);
  assert.match(script, /Never Save/);
  assert.doesNotMatch(script, /已支持/);
});

test('repo tree satisfies the CMS tip pack gate', () => {
  const script = fs.readFileSync(path.join(root, 'scripts/build-paid.ps1'), 'utf8');
  const packed = [
    ...parsePsStringArray(script, 'productFiles'),
    ...parsePsStringArray(script, 'licenseFiles'),
    PAID_CONFIG,
  ];
  const result = assertPackedCmsTip(root, packed);
  assert.equal(result.cmsDegreePacked, true);
  assert.equal(result.regionFailClosedPacked, true);
  assert.equal(result.paidCmsAutoPacked, true);
  assert.equal(result.cmsInjectedFilesPacked, true);
});

test('rebuild fails when packed engine.js drops the 学历 id suffix', () => {
  const oct18 = readTip('src/content/engine.js').replace(
    'cms-ant-v3-${M.normalize(labels[0])}-${position}',
    'cms-ant-v3-${M.normalize(labels[0])}',
  );
  assert.throws(
    () => assertCmsTipMarkers((rel) => (rel === 'src/content/engine.js' ? oct18 : readTip(rel))),
    /cms-degree: src\/content\/engine\.js missing cms-ant-v3-/,
  );
});

test('rebuild fails when region fail-closed or degree synonyms leave the packed tree', () => {
  const engine = readTip('src/content/engine.js').replace('function settleUnresolvedEntry', 'function settleRegionOpen');
  assert.throws(
    () => assertCmsTipMarkers((rel) => (rel === 'src/content/engine.js' ? engine : readTip(rel))),
    /region-fail-closed: src\/content\/engine\.js missing function settleUnresolvedEntry/,
  );
  const select = readTip('src/content/cms-education-multi-select.js').replace("['硕士','硕士研究生']", "['硕士']");
  assert.throws(
    () => assertCmsTipMarkers((rel) => (rel === 'src/content/cms-education-multi-select.js' ? select : readTip(rel))),
    /cms-degree: src\/content\/cms-education-multi-select\.js missing/,
  );
  const guard = readTip('src/license/guard-worker.mjs').replace(
    "bootPaidAuto('cms-basic-auto', installCmsBasicAutoRunner)",
    "boot('cms-basic-auto', installCmsBasicAutoRunner)",
  );
  assert.throws(
    () => assertCmsTipMarkers((rel) => (rel === 'src/license/guard-worker.mjs' ? guard : readTip(rel))),
    /paid-cms-auto: src\/license\/guard-worker\.mjs missing bootPaidAuto/,
  );
});

test('rebuild fails when a CMS auto inject file is off the packed list or bytes drift', () => {
  const script = fs.readFileSync(path.join(root, 'scripts/build-paid.ps1'), 'utf8');
  const packed = [
    ...parsePsStringArray(script, 'productFiles'),
    ...parsePsStringArray(script, 'licenseFiles'),
    PAID_CONFIG,
  ].filter((rel) => rel !== 'src/content/engine.js');
  assert.throws(() => assertPackedCmsTip(root, packed), /src\/content\/engine\.js not on paid pack list/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paid-cms-bytes-'));
  try {
    const rel = 'src/content/engine.js';
    fs.mkdirSync(path.join(dir, 'src/content'), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), `${readTip(rel)}\n`);
    assert.throws(() => assertPackedBytesMatchSource(root, dir, [rel]), /differs from tip source/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
