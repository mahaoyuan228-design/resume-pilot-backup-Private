/**
 * Paid Edge uses src/license/guard-worker.mjs, not worker.mjs.
 * CMS_BASIC_AUTO / GTH_BASIC_AUTO and the other *_AUTO runners must be installed
 * there with verifyBeforeFill, or sendMessage has no listener and never settles.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

const AUTO_TYPES = [
  'GTH_EDUCATION_AUTO',
  'GTH_BASIC_AUTO',
  'GTH_SIMPLE_AUTO',
  'GTH_OTHER_AUTO',
  'GTH_INTENT_AUTO',
  'CMS_BASIC_AUTO',
  'FEISHU_ATSX_BASIC_AUTO',
  'BEISEN_2022_BASIC_AUTO',
  'MOKA_BASIC_AUTO',
  'HOTJOB_MC_BASIC_AUTO',
  'CMB_BASIC_AUTO',
];

test('guard-worker source wires every auto runner with verifyBeforeFill', async () => {
  const source = await readFile(resolve(root, 'src/license/guard-worker.mjs'), 'utf8');
  const imports = [...source.matchAll(/^import\s.+/gm)].map((match) => match[0]);
  assert.match(imports[0], /['"]\.\.\/background\/bg-ping\.mjs['"]/);
  for (const name of [
    'installGthEducationAutoRunner',
    'installGthSimpleAutoRunner',
    'installGthOtherAutoRunner',
    'installGthIntentAutoRunner',
    'installFeishuAtsxBasicAutoRunner',
    'installBeisen2022BasicAutoRunner',
    'installMokaBasicAutoRunner',
    'installHotjobMcBasicAutoRunner',
    'installCmbBasicAutoRunner',
  ]) {
    assert.match(source, new RegExp(`${name}\\(\\{ verifyBeforeFill \\}\\)`));
  }
  assert.match(source, /import\s+\{\s*paidConfig\s+as\s+paidConfigImported\s*\}\s+from\s+['"]\.\/paid-config\.mjs['"]/);
  assert.doesNotMatch(source, /await\s+import\s*\(\s*['"]\.\/paid-config\.mjs['"]\s*\)/);
  assert.match(source, /Edge 155 MV3 SW fails to register when paid-config is loaded via top-level await import/);
  assert.match(source, /function bootPaidAuto\(name, fn\)/);
  assert.match(source, /fn\(\{\s*verifyBeforeFill\s*\}\)/);
  assert.match(source, /bootPaidAuto\('gth-basic-auto',\s*installGthBasicAutoRunner\)/);
  assert.match(source, /bootPaidAuto\('cms-basic-auto',\s*installCmsBasicAutoRunner\)/);
  assert.match(source, /import\s+\{\s*installGthBasicAutoRunner\s*\}\s+from\s+['"]\.\.\/background\/gth-basic-auto\.mjs['"]/);
  assert.match(source, /import\s+\{\s*installCmsBasicAutoRunner\s*\}\s+from\s+['"]\.\.\/background\/cms-basic-auto\.mjs['"]/);
  assert.doesNotMatch(source, /boot\('gth-basic-auto'/);
  assert.doesNotMatch(source, /boot\('cms-basic-auto'/);
  assert.match(source, /RESUME_PAID_VERIFY/);
  assert.doesNotMatch(source, /softwareClickedSave\s*=\s*true/);

  const paidConfig = await readFile(resolve(root, 'src/license/paid-config.mjs'), 'utf8');
  assert.doesNotMatch(paidConfig, /buildFlavor:\s*['"]paid['"]/);
  const seed = await readFile(resolve(root, 'src/profile/cms-basic-seed-from-education.mjs'), 'utf8');
  assert.match(seed, /export function seedCmsBasicFromEducation/);

  const paidBuild = await readFile(resolve(root, 'scripts/build-paid.ps1'), 'utf8');
  assert.match(paidBuild, /'src\/background\/bg-ping\.mjs'/);
  assert.match(paidBuild, /'src\/auto\/bg-request\.mjs'/);
  assert.match(paidBuild, /'src\/background\/cms-basic-auto\.mjs'/);
  assert.match(paidBuild, /'src\/background\/gth-basic-auto\.mjs'/);
  assert.match(paidBuild, /'src\/background\/cmb-basic-auto\.mjs'/);
  assert.match(paidBuild, /'src\/content\/cmb-basic\.js'/);
  assert.match(paidBuild, /'src\/profile\/cms-basic-seed-from-education\.mjs'/);
  assert.match(paidBuild, /service_worker = 'src\/license\/guard-worker\.mjs'/);
});

test('imported guard worker answers BG_PING and claims each auto message', async () => {
  const listeners = [];
  globalThis.chrome = {
    runtime: {
      id: 'paid-ext',
      getURL: (path) => `chrome-extension://paid-ext/${path}`,
      getManifest: () => ({ background: { service_worker: 'src/license/guard-worker.mjs' } }),
      onMessage: { addListener(fn) { listeners.push(fn); } },
      onConnect: { addListener(fn) { listeners.connect = listeners.connect || []; listeners.connect.push(fn); } },
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

  await import('../src/license/guard-worker.mjs');
  assert.ok(listeners.length >= AUTO_TYPES.length + 1);

  let pong;
  let pingHeld = false;
  for (const listener of listeners) {
    const held = listener({ type: 'BG_PING' }, { id: 'paid-ext' }, (value) => { pong = value; });
    if (held === true) pingHeld = true;
  }
  assert.equal(pingHeld, false);
  assert.equal(pong?.ok, true);
  assert.equal(pong?.reason, 'BG_PONG');

  const stranger = { id: 'paid-ext', url: 'https://evil.example/not-an-auto-page' };
  for (const type of AUTO_TYPES) {
    let response;
    let held = false;
    for (const listener of listeners) {
      const result = listener({ type, mode: 'readiness' }, stranger, (value) => { response = value; });
      if (result === true) held = true;
    }
    assert.equal(held, false, `${type} held the channel without a sync answer`);
    assert.equal(response?.ok, false, `${type} had no listener`);
    assert.match(String(response?.reason || ''), /wrong_sender/);
  }

  const verify = await new Promise((resolve) => {
    let held = false;
    for (const listener of listeners) {
      const result = listener({ type: 'RESUME_PAID_VERIFY' }, { id: 'paid-ext' }, resolve);
      if (result === true) {
        held = true;
        break;
      }
    }
    if (!held) resolve({ allowed: true, reason: 'listener_missing' });
  });
  assert.equal(verify.allowed, false);
  assert.equal(verify.reason, 'license_required');
});
