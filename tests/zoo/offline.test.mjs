import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm, symlink, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { SNAPSHOT_CSP, startSnapshotServer, isAllowedOfflineRequest, verifySnapshot, verifyAssetIntegrity } from './offline.mjs';

async function removeOwnedTemp(root) {
  const actual = await realpath(root);
  assert.equal(actual, path.resolve(root));
  assert.equal(path.dirname(actual), await realpath(tmpdir()));
  assert.ok(path.basename(actual).startsWith('zoo-offline-'));
  await rm(actual, { recursive: true, force: true });
}

function request(origin, target = '/', method = 'GET') {
  const url = new URL(origin);
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: url.hostname, port: url.port, path: target, method }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject); req.end();
  });
}

test('loopback replay serves local assets and makes archived application scripts inert', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'zoo-offline-'));
  let server;
  try {
    await mkdir(path.join(root, 'assets'));
    await writeFile(path.join(root, 'index.html'), '<input id="captured"><script src="assets/app.js"></script>');
    await writeFile(path.join(root, 'assets', 'app.js'), 'throw new Error("must not execute")');
    await writeFile(path.join(root, 'assets', 'page.css'), 'input{color:red}');
    server = await startSnapshotServer(root);
    const entry = await request(server.origin);
    assert.equal(entry.status, 200);
    assert.match(entry.body, /id="captured"/);
    assert.equal(entry.headers['content-security-policy'], SNAPSHOT_CSP);
    for (const directive of ["script-src 'none'", "connect-src 'none'", "form-action 'none'", "frame-src 'none'"]) {
      assert.ok(SNAPSHOT_CSP.includes(directive));
    }
    const css = await request(server.origin, '/assets/page.css');
    assert.equal(css.status, 200);
    assert.equal(css.headers['content-type'], 'text/css; charset=utf-8');
    const head = await request(server.origin, '/', 'HEAD');
    assert.equal(head.status, 200); assert.equal(head.body, '');
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      assert.equal((await request(server.origin, '/', method)).status, 405);
    }
  } finally {
    await server?.close();
    await removeOwnedTemp(root);
  }
});

test('replay refuses raw and encoded traversal, missing files, directories, and symlink escapes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'zoo-offline-'));
  let server;
  try {
    await mkdir(path.join(root, 'snapshot'));
    await writeFile(path.join(root, 'secret.txt'), 'outside fixture');
    await writeFile(path.join(root, 'snapshot', 'index.html'), '<input>');
    await symlink(root, path.join(root, 'snapshot', 'escape'), 'junction');
    server = await startSnapshotServer(path.join(root, 'snapshot'));
    for (const target of ['/../secret.txt', '/%2e%2e/secret.txt', '/%2e%2e%5csecret.txt',
      '/escape/secret.txt', '/missing', '/escape', '/%00', '/%zz']) {
      assert.equal((await request(server.origin, target)).status, 404, target);
    }
  } finally {
    await server?.close();
    await removeOwnedTemp(root);
  }
});

test('Playwright policy allows only GET to this exact loopback origin', () => {
  const origin = 'http://127.0.0.1:12345';
  const fake = (url, method = 'GET') => ({ url: () => url, method: () => method });
  assert.equal(isAllowedOfflineRequest(fake(origin + '/assets/page.css'), origin), true);
  for (const url of ['https://wecruit.hotjob.cn/pb/api', 'http://127.0.0.1:12346/', 'http://localhost:12345/',
    'http://user@127.0.0.1:12345/', 'data:text/html,external', 'invalid']) {
    assert.equal(isAllowedOfflineRequest(fake(url), origin), false, url);
  }
  for (const method of ['POST', 'PUT', 'DELETE', 'HEAD']) {
    assert.equal(isAllowedOfflineRequest(fake(origin + '/', method), origin), false, method);
  }
});

test('isolated Playwright replay renders captured controls/CSS while suppressing application hydration', { timeout: 30000 }, async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'zoo-offline-'));
  try {
    const html = '<!doctype html><html><head><link rel="stylesheet" href="/page.css"></head><body>' +
      '<div class="ant-form-item" id="captured"><label>Captured label</label><input></div>' +
      '<script>document.body.innerHTML="hydration must never run"</script></body></html>';
    await writeFile(path.join(root, 'index.html'), html);
    await writeFile(path.join(root, 'outerHTML.html'), html);
    const css = 'input{padding-left:37px;color:rgb(12,34,56)}';
    await writeFile(path.join(root, 'page.css'), css);
    await writeFile(path.join(root, 'assets.json'), JSON.stringify({ assets: [{
      path: 'page.css', bytes: Buffer.byteLength(css), sha256: createHash('sha256').update(css).digest('hex')
    }] }));
    await writeFile(path.join(root, 'manifest.json'), JSON.stringify({
      safety: { neverSave: true, liveSupportClaimed: false }, traffic: { responseToNonGetCount: 0 }
    }));
    await writeFile(path.join(root, 'controls.json'), JSON.stringify({ controls: [{ wrapperId: 'captured', label: 'Captured label' }] }));
    const report = await verifySnapshot(root, { executablePath: process.env.CHROME_PATH });
    assert.equal(report.matchedWrappers, 1);
    assert.equal(report.dom.controls, 1);
    assert.equal(report.dom.formItems, 1);
    assert.ok(report.cssComputedStyleDifferences > 0);
    assert.equal(report.responseToNonGet, 0);
    assert.equal(report.externalRequests, 0);
    assert.equal(report.verifiedAssets, 1);
    assert.deepEqual(report.entrypoints.map(row => row.entry), ['index.html', 'outerHTML.html']);
  } finally {
    await removeOwnedTemp(root);
  }
});

test('asset verification refuses corruption, truncation, and paths outside the snapshot', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'zoo-offline-'));
  try {
    const body = 'captured stylesheet';
    await writeFile(path.join(root, 'asset.css'), body);
    const asset = { path: 'asset.css', bytes: Buffer.byteLength(body), sha256: createHash('sha256').update(body).digest('hex') };
    assert.equal(await verifyAssetIntegrity(root, [asset]), 1);
    await assert.rejects(verifyAssetIntegrity(root, [{ ...asset, bytes: asset.bytes + 1 }]), /byte count mismatch/);
    await assert.rejects(verifyAssetIntegrity(root, [{ ...asset, sha256: '0'.repeat(64) }]), /checksum mismatch/);
    await assert.rejects(verifyAssetIntegrity(root, [{ ...asset, path: '../outside.css' }]), /stay in fixture/);
  } finally {
    await removeOwnedTemp(root);
  }
});
