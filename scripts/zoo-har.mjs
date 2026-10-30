#!/usr/bin/env node
// Record/replay only the disposable control zoo; never attach to a live browser.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { openHarContext, readHar, startHarFixture } from '../tests/zoo/har-support.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    har: { type: 'string' }, help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) {
    console.log('Usage: node scripts/zoo-har.mjs <record|replay> --har <new-or-existing.har>');
    return;
  }
  const [mode] = positionals;
  if (positionals.length !== 1 || !['record', 'replay'].includes(mode) || !values.har?.endsWith('.har')) {
    throw Error('Use record or replay with --har <path.har>; see --help.');
  }
  const harPath = path.resolve(values.har);
  const before = mode === 'replay' ? await fs.readFile(harPath) : null;
  let fixture, browser, session;
  try {
    const url = mode === 'record' ? (fixture = await startHarFixture()).url : (await readHar(harPath)).url;
    browser = await chromium.launch({ args: ['--no-proxy-server', '--disable-background-networking'] });
    session = await openHarContext(browser, { mode, harPath, origin: fixture?.origin });
    const page = await session.context.newPage();
    await page.goto(url);
    await page.waitForFunction(() => window.__harZoo?.ready && window.ResumeControls);
    const controls = await page.evaluate(async () => {
      const before = window.__harZoo.snapshot(), rows = [];
      for (const [type, value] of [['text', 'HAR_SYNTHETIC_TEXT'], ['date', '2024-02-29'],
        ['month', '2024-02'], ['select', 'beta']]) {
        const el = document.querySelector(`[data-control="${type}"]`);
        const plan = ResumeControls.plan(el, { value });
        rows.push({ type, adapter: plan.adapter, status: plan.status,
          written: await ResumeControls.resolve(el).write(el, plan) });
      }
      return { before, after: window.__harZoo.snapshot(), rows,
        mode: ResumeControls.mode, liveSupportClaimed: ResumeControls.liveSupportClaimed };
    });
    assert.equal(controls.mode, 'shadow');
    assert.equal(controls.liveSupportClaimed, false);
    assert.deepEqual(controls.after, controls.before);
    assert.deepEqual(controls.after.effects, { clicks: 0, inputs: 0, changes: 0, submits: 0 });
    assert.equal(controls.after.values.neighbor, 'HAR_NEIGHBOR_KEEP');
    assert.deepEqual(controls.rows.map(row => row.adapter), ['native-text', 'native-date', 'native-month', 'native-select']);
    for (const row of controls.rows) {
      assert.equal(row.status, 'planned');
      assert.deepEqual(row.written, { status: 'unsupported', reason: 'shadow_mode', strategy: 'none', attempts: 0 });
    }
    assert.equal(session.traffic.blockedNonGets, 0);
    assert.equal(session.traffic.blockedRequests, 0);
    assert.equal(session.traffic.blockedWebSockets, 0);
    const traffic = { ...session.traffic };
    await session.close(); // Flush recording before inspecting or replaying it.
    session = null;
    await fixture?.close();
    const bytes = await fs.readFile(harPath);
    if (before) assert.ok(bytes.equals(before), 'HAR changed during replay');
    console.log(JSON.stringify({ mode, harPath, url, sha256: sha256(bytes),
      neverSave: true, liveSupportClaimed: false, traffic, controls }, null, 2));
  } finally {
    try { await session?.close(); }
    finally { try { await browser?.close(); } finally { await fixture?.close(); } }
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
