/**
 * The live harvest tool stays read-only. Never Save.
 * Site pages are not clicked, filled, or submitted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stampEvidence } from '../tools/live-harvest/run.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const toolDir = resolve(root, 'tools/live-harvest');

function toolSource() {
  return readdirSync(toolDir)
    .filter((name) => name.endsWith('.mjs'))
    .map((name) => readFileSync(resolve(toolDir, name), 'utf8'))
    .join('\n');
}

test('tool source has no Input.dispatch, click, submit, or save calls', () => {
  const source = toolSource();
  assert.doesNotMatch(source, /Input\.dispatch/);
  assert.doesNotMatch(source, /\.click\b/);
  assert.doesNotMatch(source, /\bclick\s*\(/);
  assert.doesNotMatch(source, /\.submit\b/);
  assert.doesNotMatch(source, /\bsubmit\s*\(/);
  assert.doesNotMatch(source, /\bsave\s*\(/);
  assert.doesNotMatch(source, /dispatchEvent\s*\(/);
  assert.doesNotMatch(source, /KeyboardEvent/);
  assert.doesNotMatch(source, /userGesture\s*:\s*true/);
  assert.match(source, /neverSave\s*:\s*true/);
  assert.match(source, /extension_storage/);
  assert.match(source, /StepTimeoutError/);
});

test('every stamped packet forces neverSave and refuses a support claim', () => {
  const stamped = stampEvidence({
    neverSave: false,
    claimedSupported: true,
    ok: true,
    site: 'CMS'
  }, {
    harvestedAt: '2026-10-19T15:49:34.000Z',
    harvestedAtAsiaShanghai: '2026/10/19 23:49:34',
    runId: 'fixture'
  });
  assert.equal(stamped.neverSave, true);
  assert.equal(stamped.claimedSupported, false);
  assert.equal(stamped.ok, true);
  assert.equal(stamped.site, 'CMS');
  assert.equal(stamped.runId, 'fixture');
});
