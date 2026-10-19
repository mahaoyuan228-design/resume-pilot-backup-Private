/**
 * Fresh paid-pack rebuild must include the CMS basic seed and a static paid-config
 * import. These checks fail closed when the seed drops off the paid list, or when
 * guard-worker goes back to a top-level await import("./paid-config.mjs").
 * The smoke imports the built output (not a hand-patched dist).
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
  } finally {
    fs.rmSync(destRoot, { recursive: true, force: true });
  }
});
