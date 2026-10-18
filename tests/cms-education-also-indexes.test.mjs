import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runner = fs.readFileSync(path.join(root, 'src/background/cms-education-task-runner.mjs'), 'utf8');
const autoJs = fs.readFileSync(path.join(root, 'src/auto/cms-education-auto.js'), 'utf8');
const launcher = fs.readFileSync(path.join(root, 'scripts/auto-cms-education.mjs'), 'utf8');

function normalizeAlsoIndexes(message, primary) {
  const raw = message?.alsoProfileIndexes ?? message?.alsoProfileIndex ?? [];
  const list = Array.isArray(raw)
    ? raw
    : Number.isInteger(raw)
      ? [raw]
      : String(raw || '')
          .split(/[,\s]+/)
          .filter(Boolean)
          .map((v) => Number.parseInt(v, 10));
  const out = [];
  for (const value of list) {
    if (!Number.isInteger(value) || value < 0 || value > 29 || value === primary || out.includes(value)) continue;
    out.push(value);
  }
  return out;
}

test('normalizeAlsoIndexes accepts array, csv, and drops primary/dupes', () => {
  assert.deepEqual(normalizeAlsoIndexes({ alsoProfileIndexes: [4, 5, 4] }, 5), [4]);
  assert.deepEqual(normalizeAlsoIndexes({ alsoProfileIndexes: '4,5' }, 5), [4]);
  assert.deepEqual(normalizeAlsoIndexes({ alsoProfileIndex: 4 }, 5), [4]);
  assert.deepEqual(normalizeAlsoIndexes({}, 5), []);
});

test('task-runner wires alsoProfileIndexes into bindRecords / autoFill', () => {
  assert.match(runner, /function normalizeAlsoIndexes/);
  assert.match(runner, /bindRecords\(inspected,profileIndex,replaceExisting,alsoProfileIndexes\)/);
  assert.match(runner, /target:\{mode:'new'\}/);
  assert.match(runner, /cms_education_auto_also_source_missing/);
  // Leftover existing rows prefer alsoProfileIndexes when school needle empty.
  assert.match(runner, /alsoCandidates/);
  assert.match(runner, /alsoReplace/);
});

test('auto html helper + launcher pass alsoProfileIndexes', () => {
  assert.match(autoJs, /alsoProfileIndexes/);
  assert.match(autoJs, /CMS_EDUCATION_AUTO_FILL/);
  assert.match(launcher, /ALSO_PROFILE_INDEXES/);
  assert.match(launcher, /alsoProfileIndexes=/);
});
