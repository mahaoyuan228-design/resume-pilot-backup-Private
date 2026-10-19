// Fail-closed checks for a fresh paid Edge pack.
// A 20261018 hotpatched dist is not a rebuild. build-paid.ps1 / build-paid-smoke.mjs
// must copy cms-basic-seed-from-education.mjs and static-import generated paid-config.
// Edge 155 MV3 does not register a service worker that top-level await-imports paid-config.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const CMS_BASIC_SEED = 'src/profile/cms-basic-seed-from-education.mjs';
export const GUARD_WORKER = 'src/license/guard-worker.mjs';
export const PAID_CONFIG = 'src/license/paid-config.mjs';

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

export function relativeSpecifiers(source, isHtml) {
  const pattern = isHtml
    ? /(?:src|href)\s*=\s*["'](\.[^"']+)["']/g
    : /(?:from\s*|import\s*\()\s*["'](\.[^"']+)["']/g;
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

/**
 * Import the freshly built extension (not the source tree) and prove:
 * - cms-basic seed module evaluates and exports seedCmsBasicFromEducation
 * - guard-worker evaluates with the generated paid-config static import
 * - BG_PING is registered (service worker module ran)
 * - CMS/GTH basic auto listeners are installed (sync deny, no page DOM)
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
  for (const type of ['CMS_BASIC_AUTO', 'GTH_BASIC_AUTO']) {
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
  };
}
