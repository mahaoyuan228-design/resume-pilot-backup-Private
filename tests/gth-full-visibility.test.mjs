import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { evidenceExitCode, runGthFullResumeLive } from '../scripts/live/gth-full-resume-live.mjs';

const PAGE = 'https://hr.gtht.com/resume/edit/';

// Transport-only fixture: editor opening is deliberately unsupported. These
// tests verify the runner's CDP visibility sequence, not product or live DOM.
async function run(t, recovery) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gth-full-visibility-'));
  t.after(() => fs.rmSync(outDir, { recursive: true, force: true }));
  const commands = [];
  let visible = recovery === 'visible';
  const session = {
    async send(method, params, options = {}) {
      commands.push({ method, params, step: options.step });
      if (method === 'Page.bringToFront' && recovery === 'front') visible = true;
      if (method === 'Page.setWebLifecycleState' && recovery === 'active') visible = true;
      if (method === 'Emulation.setFocusEmulationEnabled' && params.enabled && recovery === 'focus') visible = true;
      if (method !== 'Runtime.evaluate') return {};
      const step = options.step;
      let value;
      if (step === 'page_location') value = { href: PAGE };
      else if (step === 'state') value = { visible, formCount: 0, editorFormCount: 0 };
      else if (step === 'read_guard_evidence') value = { clicks: [], requests: [] };
      else if (step === 'open' || step === 'inspect_education') value = { ok: false, reason: 'control_not_supported' };
      else if (step === 'cancel' || step === 'cancel_education') value = { ok: true, closed: true };
      else if (step.startsWith('writer_ready_')) value = true;
      else if (step.startsWith('inject_') || ['install_page_guard', 'install_education_readback', 'chrome_shim', 'activate'].includes(step)) value = { ok: true };
      else if (!['restore_previous_education_adapter', 'remove_education_readback', 'restore_chrome_shim', 'restore'].includes(step)) {
        throw new Error(`unexpected_evaluation:${step}`);
      }
      return { result: { value } };
    },
    close() {}
  };
  const evidence = await runGthFullResumeLive({
    env: { PORT: '9239', OUTDIR: outDir }, tipSha: 'offline-visibility',
    async getJson() { return [{ type: 'page', id: 'same-tab', url: PAGE,
      webSocketDebuggerUrl: 'ws://127.0.0.1:9239/devtools/page/same-tab' }]; },
    async connectCdp() { return session; }
  });
  assert.equal(evidence.reason, null);
  assert.equal(evidence.neverSave, true);
  assert.equal(evidence.liveSupportClaimed, false);
  assert.deepEqual(evidence.clicks, []);
  assert.deepEqual(evidence.requests, []);
  return { commands, evidence };
}

test('full CDP runner wakes a hidden lifecycle after bringToFront leaves the page hidden', async t => {
  const { commands, evidence } = await run(t, 'active');
  const front = commands.findIndex(row => row.method === 'Page.bringToFront');
  const active = commands.findIndex(row => row.method === 'Page.setWebLifecycleState');
  const open = commands.findIndex(row => row.step === 'open');
  assert.ok(front >= 0 && active > front && open > active);
  assert.deepEqual(commands[active].params, { state: 'active' });
  assert.equal(commands.filter(row => row.method === 'Page.setWebLifecycleState').length, 1);
  assert.equal(commands.some(row => row.method === 'Emulation.setFocusEmulationEnabled'), false);
  assert.ok(evidence.sections.every(row => row.reason === 'control_not_supported'));
});

test('full CDP runner uses focus emulation only after lifecycle activation and restores it', async t => {
  const { commands, evidence } = await run(t, 'focus');
  const active = commands.findIndex(row => row.method === 'Page.setWebLifecycleState');
  const focus = commands.findIndex(row => row.method === 'Emulation.setFocusEmulationEnabled');
  assert.ok(active >= 0 && focus > active);
  assert.deepEqual(commands.filter(row => row.method === 'Emulation.setFocusEmulationEnabled').map(row => row.params),
    [{ enabled: true }, { enabled: false }]);
  assert.equal(evidence.cleanup.focusEmulationRestored, true);
  assert.ok(evidence.sections.every(row => row.reason === 'control_not_supported'));
});

test('visible or bringToFront-recovered pages do not need lifecycle or focus emulation', async t => {
  for (const recovery of ['visible', 'front']) {
    const { commands, evidence } = await run(t, recovery);
    assert.equal(commands.some(row => row.method === 'Page.setWebLifecycleState'), false);
    assert.equal(commands.some(row => row.method === 'Emulation.setFocusEmulationEnabled'), false);
    assert.equal(commands.filter(row => row.method === 'Page.bringToFront').length, recovery === 'front' ? 1 : 0);
    assert.ok(evidence.sections.every(row => row.reason === 'control_not_supported'));
  }
});

test('failed lifecycle and focus recovery still records page_hidden and does not open editors', async t => {
  const { commands, evidence } = await run(t, 'hidden');
  assert.ok(commands.some(row => row.method === 'Page.setWebLifecycleState'));
  assert.ok(commands.some(row => row.method === 'Emulation.setFocusEmulationEnabled' && row.params.enabled));
  assert.equal(commands.some(row => row.step === 'open' || row.step === 'inspect_education'), false);
  assert.ok(evidence.sections.every(row => row.reason === 'page_hidden'));
  assert.equal(evidence.cleanup.focusEmulationRestored, true);
  assert.equal(evidenceExitCode(evidence), 2);
});
