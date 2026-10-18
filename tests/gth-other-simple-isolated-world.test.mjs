/**
 * Live pack (校园投递库 hhem) requires fill trigger in ISOLATED world so
 * ResumeGthOtherSection / ResumeGthSimpleSection globals are visible.
 * Probe stays MAIN.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function load(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('gth-other-auto fill trigger uses world ISOLATED; probe stays MAIN', () => {
  const src = load('src/background/gth-other-auto.mjs');
  assert.match(src, /executeScript\(\{target:\{tabId\},world:'MAIN',func:probePageFunc/);
  assert.match(src, /target:\{tabId:tab\.id\},world:'ISOLATED',\s*\n\s*func:async\(payload\)=>typeof globalThis\.ResumeGthOtherSection/);
  assert.equal(/target:\{tabId:tab\.id\},world:'MAIN',\s*\n\s*func:async\(payload\)=>typeof globalThis\.ResumeGthOtherSection/.test(src), false);
});

test('gth-simple-auto fill trigger uses world ISOLATED; probe stays MAIN', () => {
  const src = load('src/background/gth-simple-auto.mjs');
  assert.match(src, /executeScript\(\{target:\{tabId\},world:'MAIN',func:probePageFunc/);
  assert.match(src, /target:\{tabId:tab\.id\},world:'ISOLATED',\s*\n\s*func:async\(payload\)=>typeof globalThis\.ResumeGthSimpleSection/);
  assert.equal(/target:\{tabId:tab\.id\},world:'MAIN',\s*\n\s*func:async\(payload\)=>typeof globalThis\.ResumeGthSimpleSection/.test(src), false);
});
