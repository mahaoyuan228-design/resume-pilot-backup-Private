#!/usr/bin/env node
// Test stub standing in for msedge: on the cms-basic-auto URL, POST a synthetic result to reportPort.
import fs from 'node:fs';
const url = process.argv[2] || '';
if (process.env.FAKE_EDGE_LOG) fs.appendFileSync(process.env.FAKE_EDGE_LOG, url + '\n');
if (url.startsWith('chrome-extension://') && url.includes('cms-basic-auto.html') && !url.includes('mode=reload')) {
  const qs = new URL(url).searchParams;
  const body = { ok: true, version: 1, kind: 'cms_basic_auto', mode: qs.get('mode'), saveAttempted: false,
    writeAttempted: false, cmsPage: qs.get('cmsPage'), readiness: { pageState: 'ready' }, job: null };
  await fetch(`http://127.0.0.1:${qs.get('reportPort')}/result`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  });
}
