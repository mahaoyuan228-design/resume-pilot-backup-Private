// CITICS 学历 has no harvested options. Refuse before CDP. Do not invent an allowlist.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve('.');
const source = readFileSync(resolve(root, 'src/content/citics-basic.js'), 'utf8');
const draft = readFileSync(resolve(root, 'dist/site-probes/CITICS_EDUCATION_SELECT_DRAFT_20261019.md'), 'utf8');

test('citics education stays unwired until live options exist', () => {
  assert.match(draft, /须 live 采选项后才能接线/);
  assert.match(draft, /live_education_options_unharvested/);
  assert.doesNotMatch(source, /学历/);
  assert.doesNotMatch(source, /educationLevel/);
  assert.doesNotMatch(source, /cms-|gth-/);
});

test('学历 and 学历/学位 refuse before CDP with and without --live', () => {
  for (const args of [
    ['--only', '学历'],
    ['--only', '学历', '--live'],
    ['--only', '学历/学位', '--live'],
    ['--only', '学历/学位', '--synthetic']
  ]) {
    const run = spawnSync(process.execPath, ['scripts/auto-citics-basic.mjs', ...args], {
      cwd: root,
      encoding: 'utf8',
      timeout: 10000
    });
    assert.equal(run.status, 3, run.stderr || run.stdout);
    const payload = JSON.parse(run.stdout);
    assert.equal(payload.ok, false);
    assert.equal(payload.reason, 'live_education_options_unharvested');
    assert.equal(payload.siteId, 'citics');
    assert.equal(payload.writeAttempted, false);
    assert.equal(payload.saved, false);
    assert.equal(payload.formFillClaimed, false);
    assert.equal(payload.liveEdge, false);
    assert.equal(payload.optionsHarvested, false);
    assert.equal(payload.optionCount, 0);
    assert.equal(payload.syntheticDom, false);
  }
});
