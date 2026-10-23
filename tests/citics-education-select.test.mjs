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

// Refusals must happen before connecting to CDP, spawning a browser or writing
// evidence. Fail the child if any of those operations is attempted.
const noSideEffects = `
  import fs from 'node:fs';
  import net from 'node:net';
  import http from 'node:http';
  import https from 'node:https';
  import childProcess from 'node:child_process';
  import { syncBuiltinESMExports } from 'node:module';
  const denied = () => { throw new Error('unexpected_side_effect_before_refusal'); };
  for (const key of ['writeFileSync', 'appendFileSync', 'mkdirSync', 'mkdtempSync', 'copyFileSync']) fs[key] = denied;
  for (const key of ['writeFile', 'appendFile', 'mkdir', 'mkdtemp', 'copyFile']) fs.promises[key] = denied;
  for (const key of ['spawn', 'exec', 'execFile', 'fork']) childProcess[key] = denied;
  net.connect = denied; net.createConnection = denied; net.Server.prototype.listen = denied;
  http.request = denied; http.get = denied; https.request = denied; https.get = denied;
  globalThis.fetch = denied; globalThis.WebSocket = denied;
  syncBuiltinESMExports();
`;
const preload = `data:text/javascript,${encodeURIComponent(noSideEffects)}`;

for (const label of ['学历', '学位', '学历/学位']) {
  test(`${label} refuses without browser, network, evidence writes or support claims in every mode`, () => {
    for (const mode of [[], ['--live'], ['--synthetic'], ['--live', '--synthetic'], ['--extension']]) {
      const run = spawnSync(process.execPath, ['--import', preload, 'scripts/auto-citics-basic.mjs', '--only', label, ...mode], {
        cwd: root,
        encoding: 'utf8',
        timeout: 10000
      });
      assert.equal(run.status, 3, run.stderr || run.stdout);
      const payload = JSON.parse(run.stdout);
      assert.equal(payload.ok, false);
      assert.equal(payload.reason, label === '学位' ? 'live_degree_options_unharvested' : 'live_education_options_unharvested');
      assert.equal(payload.siteId, 'citics');
      assert.equal(payload.label, label);
      assert.equal(payload.writeAttempted, false);
      assert.equal(payload.saved, false);
      assert.equal(payload.formFillClaimed, false);
      assert.equal(payload.liveEdge, false);
      assert.equal(payload.optionsHarvested, false);
      assert.equal(payload.optionCount, 0);
      assert.equal(payload.syntheticDom, false);
      for (const key of ['liveSupportClaimed', 'supportClaimed', 'softwareClickedSave', 'softwareClickedSubmit', 'softwareClickedNext', 'softwareClickedDeliver', 'softwareClickedDelete']) {
        assert.equal(payload[key], false, key);
      }
      for (const key of ['neverSave', 'skippedSave', 'leftUnsaved']) assert.equal(payload[key], true, key);
      assert.equal(run.stderr, '');
    }
  });
}
