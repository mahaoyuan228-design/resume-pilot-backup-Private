/**
 * Shipped skills/other fills inject the open-editor scripts and send
 * GTH_SKILLS_FILL / GTH_OTHER_FILL. The page probe stays in MAIN.
 * The fill does not call the old section global from MAIN.
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

test('gth-other-auto fill sends GTH_OTHER_FILL; probe stays MAIN', () => {
  const src = load('src/background/gth-other-auto.mjs');
  const dispatch = load('src/background/gth-open-fills.mjs');
  assert.match(src, /executeScript\(\{target:\{tabId\},world:'MAIN',func:probePageFunc/);
  assert.match(src, /shippedGthOtherFill/);
  assert.match(dispatch, /GTH_OTHER_FILL/);
  assert.match(dispatch, /'src\/content\/gth-other\.js'/);
  assert.equal(/world:'MAIN',\s*\n\s*func:async\(payload\)=>typeof globalThis\.ResumeGthOtherSection/.test(src), false);
});

test('gth-simple-auto fill sends GTH_SKILLS_FILL; probe stays MAIN', () => {
  const src = load('src/background/gth-simple-auto.mjs');
  const dispatch = load('src/background/gth-open-fills.mjs');
  assert.match(src, /executeScript\(\{target:\{tabId\},world:'MAIN',func:probePageFunc/);
  assert.match(src, /shippedGthSkillsFill/);
  assert.match(dispatch, /GTH_SKILLS_FILL/);
  assert.match(dispatch, /'src\/content\/gth-skills\.js'/);
  assert.equal(/world:'MAIN',\s*\n\s*func:async\(payload\)=>typeof globalThis\.ResumeGthSimpleSection/.test(src), false);
});
