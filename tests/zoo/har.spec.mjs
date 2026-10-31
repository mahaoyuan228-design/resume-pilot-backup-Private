import { test, expect, chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { openHarContext, startHarFixture } from './har-support.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourcePaths = ['model', 'registry', 'upload', 'native', 'date-controls']
  .map(name => `/controls/${name}.js`);

async function inspectControls(page) {
  await page.waitForFunction(() => window.__harZoo?.ready && window.ResumeControls?.liveSupportClaimed === false);
  return page.evaluate(async () => {
    const before = window.__harZoo.snapshot();
    const rows = [];
    for (const [type, value] of [['text', 'HAR_SYNTHETIC_TEXT'], ['date', '2024-02-29'],
      ['month', '2024-02'], ['select', 'beta']]) {
      const el = document.querySelector(`[data-control="${type}"]`);
      const observation = ResumeControls.inspect(el);
      const plan = ResumeControls.plan(el, { value });
      // No write context is supplied: exercise the real default-off gate.
      const written = await ResumeControls.resolve(el).write(el, plan);
      rows.push({ type, observation, plan, written });
    }
    return { before, rows, after: window.__harZoo.snapshot(),
      mode: ResumeControls.mode, liveSupportClaimed: ResumeControls.liveSupportClaimed };
  });
}

function expectPassivePlans(result) {
  expect(result).toMatchObject({ mode: 'shadow', liveSupportClaimed: false });
  expect(result.after).toEqual(result.before);
  expect(result.after).toEqual({
    values: { text: '', date: '', month: '', select: '', neighbor: 'HAR_NEIGHBOR_KEEP' },
    effects: { clicks: 0, inputs: 0, changes: 0, submits: 0 }, liveSupportClaimed: false,
  });
  expect(result.rows.map(row => row.plan.adapter))
    .toEqual(['native-text', 'native-date', 'native-month', 'native-select']);
  for (const row of result.rows) {
    expect(row.observation.adapter).toBe(row.plan.adapter);
    expect(row.plan.status).toBe('planned');
    expect(row.written).toEqual({ status: 'unsupported', reason: 'shadow_mode', strategy: 'none', attempts: 0 });
  }
}

test('generic HAR: record GET assets, stop the server, and replay passive controls completely offline', async ({}, testInfo) => {
  const harPath = testInfo.outputPath('generic-controls.har');
  const fixture = await startHarFixture();
  let browser, recording, replay;
  try {
    browser = await chromium.launch();
    recording = await openHarContext(browser, { mode: 'record', harPath, origin: fixture.origin });
    const recordPage = await recording.context.newPage();
    await recordPage.goto(fixture.url);
    const recorded = await inspectControls(recordPage);
    expectPassivePlans(recorded);
    await recording.close();
    recording = null;

    const bytesBefore = await fs.readFile(harPath);
    const archive = JSON.parse(bytesBefore.toString('utf8'));
    const entries = archive.log.entries;
    for (const pathname of ['/har.html', ...sourcePaths]) {
      const entry = entries.find(row => row.request.url === new URL(pathname, fixture.origin).href);
      expect(entry, `recorded asset ${pathname}`).toBeTruthy();
      expect(entry.request.method).toBe('GET');
      expect(entry.response.status).toBe(200);
      expect(entry.response.content.text.length).toBeGreaterThan(0);
    }
    expect(entries.every(entry => entry.request.method === 'GET')).toBe(true);
    expect(fixture.traffic.nonGets).toBe(0);
    const serverTraffic = { ...fixture.traffic };
    await fixture.close();

    replay = await openHarContext(browser, { mode: 'replay', harPath });
    // HAR fulfillment must work even when Chromium's network is explicitly offline.
    await replay.context.setOffline(true);
    const replayPage = await replay.context.newPage();
    await replayPage.goto(fixture.url);
    const replayed = await inspectControls(replayPage);
    expectPassivePlans(replayed);
    expect(replayed).toEqual(recorded);

    const failures = await replayPage.evaluate(async () => {
      const attempt = async (path, options) => {
        try { await fetch(path, options); return false; }
        catch { return true; }
      };
      return { missingGet: await attempt('/not-in-archive'),
        nonGet: await attempt('/blocked-mutation-probe', { method: 'POST', body: 'synthetic' }) };
    });
    expect(failures).toEqual({ missingGet: true, nonGet: true });
    expect(replay.traffic.blockedNonGets).toBe(1);
    expect(fixture.traffic).toEqual(serverTraffic);
    expect((await inspectControls(replayPage)).after).toEqual(recorded.after);
    const replayTraffic = { ...replay.traffic };
    await replay.close();
    replay = null;

    const bytesAfter = await fs.readFile(harPath);
    expect(bytesAfter.equals(bytesBefore)).toBe(true);
    await fs.writeFile(testInfo.outputPath('har-evidence.json'), JSON.stringify({
      execution: 'Synthetic loopback GET recording; server stopped; HAR replay with browser offline; passive native control plans only',
      liveSupportClaimed: false, recorded, replayed, failures, serverTraffic, replayTraffic,
      archive: { entries: entries.length, sha256Before: hash(bytesBefore), sha256After: hash(bytesAfter), unchanged: true },
    }, null, 2));
  } finally {
    await recording?.close();
    await replay?.close();
    await browser?.close();
    await fixture.close();
  }
});

test('generic HAR: missing replay archive fails without creating a recording', async ({}, testInfo) => {
  const harPath = testInfo.outputPath('missing.har');
  const browser = await chromium.launch();
  try {
    await expect(openHarContext(browser, { mode: 'replay', harPath })).rejects.toThrow();
    await expect(fs.access(harPath)).rejects.toThrow();
  } finally { await browser.close(); }
});

test('generic HAR: recording blocks mutations and a second origin before either reaches its server', async ({}, testInfo) => {
  const harPath = testInfo.outputPath('guarded-recording.har');
  const fixture = await startHarFixture();
  let otherFixture, browser, recording;
  try {
    otherFixture = await startHarFixture();
    browser = await chromium.launch();
    recording = await openHarContext(browser, { mode: 'record', harPath, origin: fixture.origin });
    const page = await recording.context.newPage();
    await page.goto(fixture.url);
    const before = await inspectControls(page);
    expectPassivePlans(before);
    const serverTraffic = { ...fixture.traffic };
    const failures = await page.evaluate(async otherUrl => {
      const attempt = async (url, options) => {
        try { await fetch(url, options); return false; }
        catch { return true; }
      };
      return { nonGet: await attempt('/blocked-mutation-probe', { method: 'POST', body: 'synthetic' }),
        otherOrigin: await attempt(otherUrl, { mode: 'no-cors' }) };
    }, otherFixture.url);
    expect(failures).toEqual({ nonGet: true, otherOrigin: true });
    expect(recording.traffic).toMatchObject({ blockedNonGets: 1, blockedRequests: 1 });
    expect(fixture.traffic).toEqual(serverTraffic);
    expect(otherFixture.traffic).toEqual({ gets: 0, nonGets: 0 });
    expect((await inspectControls(page)).after).toEqual(before.after);
    await recording.close();
    recording = null;

    const entries = JSON.parse(await fs.readFile(harPath, 'utf8')).log.entries;
    const responses = entries.filter(entry => entry.response.status > 0);
    expect(responses.length).toBeGreaterThanOrEqual(1 + sourcePaths.length);
    expect(responses.every(entry => entry.request.method === 'GET'
      && new URL(entry.request.url).origin === fixture.origin)).toBe(true);
  } finally {
    await recording?.close();
    await browser?.close();
    await otherFixture?.close();
    await fixture.close();
  }
});
