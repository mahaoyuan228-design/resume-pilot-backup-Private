import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startZoo } from '../zoo/support.mjs';

const output = new URL('../../test-results/aftercare-download/', import.meta.url);
await fs.mkdir(output, { recursive: true });
const zoo = await startZoo('cms-month');
try {
  await zoo.bind({ schemaVersion: 1, confirmedFields: [] });
  await zoo.page.evaluate(() => {
    const label = document.createElement('label');
    label.textContent = '本地未知题目 PRIVATE_LABEL';
    const input = document.createElement('input');
    input.id = 'PRIVATE_FIELD_ID';
    input.value = 'PRIVATE_VALUE';
    label.append(input);
    document.body.append(label);
  });
  const popup = await zoo.page.context().newPage();
  const errors = [];
  popup.on('pageerror', error => errors.push(error.message));
  await zoo.page.bringToFront();
  const popupUrl = new URL('/src/popup/popup.html', zoo.worker.url()).href;
  await popup.goto(popupUrl);
  await popup.waitForFunction(() => !document.getElementById('export-error-report').disabled);
  assert.match(await popup.locator('#manual-list').textContent(), /PRIVATE_LABEL/);
  const requests = [];
  const listener = request => requests.push({ method: request.method(), url: request.url() });
  zoo.page.context().on('request', listener);
  const downloadEvent = popup.waitForEvent('download');
  await popup.evaluate(() => document.getElementById('export-error-report').click());
  const download = await downloadEvent;
  assert.equal(download.suggestedFilename(), 'resume-quick-fill-error-report.json');
  await download.saveAs(fileURLToPath(new URL('resume-quick-fill-error-report.json', output)));
  const report = JSON.parse(await fs.readFile(new URL('resume-quick-fill-error-report.json', output), 'utf8'));
  assert.equal(report.liveSupportClaimed, false);
  assert.equal(report.neverSave, true);
  assert.equal(report.localOnly, true);
  assert.ok(report.manualCount > 0);
  assert.equal(report.manual.length, report.manualCount);
  assert.doesNotMatch(JSON.stringify(report), /PRIVATE_|https?:|labels|currentValue|profileBinding/);
  await popup.screenshot({ path: fileURLToPath(new URL('popup.png', output)), fullPage: true });
  const evidence = await zoo.evidence();
  assert.equal(evidence.nonGetObserved, 0);
  assert.equal(evidence.responseToNonGet, 0);
  assert.equal(evidence.blacklistClickAttempts, 0);
  assert.equal(evidence.blacklistClicks, 0);
  assert.equal(evidence.routing.nonGetReachedRoute, 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  await fs.writeFile(new URL('verification.json', output), JSON.stringify({ report, downloadRequests: requests, evidence }, null, 2));
  console.log(JSON.stringify({ file: new URL('resume-quick-fill-error-report.json', output).href,
    manualCount: report.manualCount, downloadRequests: requests.length, nonGetObserved: evidence.nonGetObserved,
    blacklistClicks: evidence.blacklistClicks, liveSupportClaimed: false, neverSave: true }));
} finally { await zoo.close(); }
