/**
 * MV3 service workers do not start when a side-effect import is missing from the pack.
 * worker.mjs and guard-worker.mjs begin with `import '…/bg-ping.mjs'` (no `from`).
 * The old build scanner only matched `from '…'` and `import('…')`, so a pack could
 * omit bg-ping.mjs and still succeed. These checks fail if that hole returns.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PAID_CONFIG,
  RELATIVE_MODULE_IMPORT_SOURCE,
  assertPackImportsResolve,
  parsePsStringArray,
  relativeSpecifiers,
} from '../scripts/paid-pack-guards.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BG_PING = 'src/background/bg-ping.mjs';
const WORKER = 'src/background/worker.mjs';
const GUARD = 'src/license/guard-worker.mjs';

const ORACLE = [
  /\bfrom\s*['"](\.[^'"]+)['"]/g,
  /\bimport\s*['"](\.[^'"]+)['"]/g,
  /\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g,
];

function readPsSingleQuoted(script, start) {
  let out = '';
  for (let i = start; i < script.length; i += 1) {
    const ch = script[i];
    if (ch === "'") {
      if (script[i + 1] === "'") {
        out += "'";
        i += 1;
        continue;
      }
      return out;
    }
    out += ch;
  }
  throw new Error('unterminated PowerShell string');
}

function moduleImportPattern(script, label) {
  const marker = "else { @('";
  const at = script.indexOf(marker);
  if (at < 0) throw new Error(`${label} module import scanner missing`);
  if (script.indexOf(marker, at + marker.length) !== -1) {
    throw new Error(`${label} module import scanner is ambiguous`);
  }
  return readPsSingleQuoted(script, at + marker.length);
}

function oracleSpecifiers(source) {
  const specs = [];
  for (const pattern of ORACLE) {
    for (const match of source.matchAll(pattern)) specs.push(match[1]);
  }
  return specs;
}

function resolveSpecifier(fromRel, spec) {
  const clean = spec.split('?')[0].split('#')[0];
  return path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), clean));
}

function packedSources(allowlist) {
  return allowlist.filter((rel) => (
    rel.startsWith('src/')
    && !rel.startsWith('src/import/vendor/')
    && /\.(?:js|mjs)$/.test(rel)
  ));
}

function graphProblems(allowlist, label) {
  const allowed = new Set(allowlist);
  const problems = [];
  for (const rel of packedSources(allowlist)) {
    const source = fs.readFileSync(path.join(root, rel), 'utf8');
    const seen = new Set(relativeSpecifiers(source, false));
    for (const spec of oracleSpecifiers(source)) {
      if (!seen.has(spec)) problems.push(`${label} scanner missed ${rel} -> ${spec}`);
    }
    for (const spec of seen) {
      if (!spec.startsWith('.')) continue;
      const resolved = resolveSpecifier(rel, spec);
      if (!allowed.has(resolved) || !fs.existsSync(path.join(root, resolved))) {
        problems.push(`${label} ${rel} -> ${resolved}`);
      }
    }
  }
  return problems;
}

function assertGraph(allowlist, label) {
  const problems = graphProblems(allowlist, label);
  if (problems.length) throw new Error(problems.join('\n'));
}

test('build scanners match the side-effect-aware module pattern', () => {
  const internal = fs.readFileSync(path.join(root, 'scripts/build-internal.ps1'), 'utf8');
  const paid = fs.readFileSync(path.join(root, 'scripts/build-paid.ps1'), 'utf8');
  assert.equal(moduleImportPattern(internal, 'build-internal'), RELATIVE_MODULE_IMPORT_SOURCE);
  assert.equal(moduleImportPattern(paid, 'build-paid'), RELATIVE_MODULE_IMPORT_SOURCE);
  assert.match(internal, /源码引用文件不存在/);
  assert.match(paid, /付费包引用文件不存在/);
  const legacy = /(?:from\s*|import\s*\()\s*["'](\.[^"']+)["']/;
  assert.equal(legacy.test("import './bg-ping.mjs';"), false);
  assert.equal(new RegExp(RELATIVE_MODULE_IMPORT_SOURCE).test("import './bg-ping.mjs';"), true);
  assert.deepEqual(relativeSpecifiers("import './bg-ping.mjs';\n", false), ['./bg-ping.mjs']);
  assert.deepEqual(
    relativeSpecifiers("import { installBgPing } from './bg-ping.mjs';\nimport('./extra.mjs');\n", false),
    ['./bg-ping.mjs', './extra.mjs'],
  );
});

test('worker.mjs relative imports are on the internal allowlist, and omitting bg-ping fails', () => {
  const internal = fs.readFileSync(path.join(root, 'scripts/build-internal.ps1'), 'utf8');
  const files = parsePsStringArray(internal, 'files');
  const worker = fs.readFileSync(path.join(root, WORKER), 'utf8');
  assert.equal(files.includes(BG_PING), true);
  assert.equal(files.includes(WORKER), true);
  assert.match(worker, /^import\s+['"]\.\/bg-ping\.mjs['"]/m);

  const specs = relativeSpecifiers(worker, false);
  assert.equal(specs[0], './bg-ping.mjs');
  for (const spec of oracleSpecifiers(worker)) {
    const resolved = resolveSpecifier(WORKER, spec);
    assert.equal(files.includes(resolved), true, `${WORKER} -> ${resolved} is off the internal allowlist`);
    assert.equal(fs.existsSync(path.join(root, resolved)), true, `missing ${resolved}`);
  }

  assertGraph(files, 'internal');
  assertPackImportsResolve(root, files);

  const omitted = files.filter((rel) => rel !== BG_PING);
  assert.throws(() => assertPackImportsResolve(root, omitted), /bg-ping\.mjs/);
  assert.throws(() => assertGraph(omitted, 'internal-omit'), /bg-ping\.mjs/);
});

test('paid pack keeps bg-ping and fails a simulated omit of the guard-worker side-effect import', () => {
  const paid = fs.readFileSync(path.join(root, 'scripts/build-paid.ps1'), 'utf8');
  const productFiles = parsePsStringArray(paid, 'productFiles');
  const licenseFiles = parsePsStringArray(paid, 'licenseFiles');
  const packed = [...productFiles, ...licenseFiles, PAID_CONFIG];
  const guard = fs.readFileSync(path.join(root, GUARD), 'utf8');
  assert.equal(productFiles.includes(BG_PING), true);
  assert.equal(licenseFiles.includes(GUARD), true);
  assert.match(guard, /^import\s+['"]\.\.\/background\/bg-ping\.mjs['"]/m);
  assert.equal(relativeSpecifiers(guard, false)[0], '../background/bg-ping.mjs');

  for (const spec of oracleSpecifiers(guard)) {
    const resolved = resolveSpecifier(GUARD, spec);
    assert.equal(packed.includes(resolved), true, `${GUARD} -> ${resolved} is off the paid pack list`);
    assert.equal(fs.existsSync(path.join(root, resolved)), true, `missing ${resolved}`);
  }

  assertGraph(packed, 'paid');
  assertPackImportsResolve(root, packed);
  assert.throws(
    () => assertPackImportsResolve(root, packed.filter((rel) => rel !== BG_PING)),
    /bg-ping\.mjs/,
  );
});
