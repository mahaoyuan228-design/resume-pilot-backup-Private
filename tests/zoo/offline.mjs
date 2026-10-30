// Serves captured DOM as inert fixtures. Never connects to a user's browser or ATS.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, realpath, stat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SNAPSHOT_CSP = [
  "default-src 'none'", "script-src 'none'", "connect-src 'none'",
  "style-src 'self' 'unsafe-inline'", "img-src 'self' data:",
  "font-src 'self' data:", "frame-src 'none'", "object-src 'none'",
  "form-action 'none'", "base-uri 'none'"
].join('; ');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.gif': 'image/gif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8'
};

export async function startSnapshotServer(snapshotDir) {
  const root = await realpath(snapshotDir);
  const requests = [];
  const server = createServer(async (req, res) => {
    const record = { method: req.method, path: req.url, status: null };
    requests.push(record);
    const reply = (status, body = '', type = 'text/plain; charset=utf-8') => {
      record.status = status;
      res.writeHead(status, {
        'Content-Type': type, 'Content-Security-Policy': SNAPSHOT_CSP,
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer', 'Cross-Origin-Resource-Policy': 'same-origin'
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') return reply(405);
    try {
      // Decode the raw request target before URL normalization can erase traversal.
      const target = decodeURIComponent(String(req.url).split('?')[0]);
      if (!target.startsWith('/') || target.includes('\\') || target.includes('\0') ||
          target.split('/').some(part => part === '..' || part === '.')) return reply(404);
      const candidate = path.resolve(root, '.' + (target === '/' ? '/index.html' : target));
      const actual = await realpath(candidate);
      if (!actual.startsWith(root + path.sep) || !(await stat(actual)).isFile()) return reply(404);
      return reply(200, await readFile(actual), MIME[path.extname(actual).toLowerCase()] || 'application/octet-stream');
    } catch {
      return reply(404);
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    origin: `http://127.0.0.1:${server.address().port}`, requests,
    close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  };
}

export function isAllowedOfflineRequest(request, origin) {
  try {
    const url = new URL(request.url());
    return request.method() === 'GET' && url.origin === origin && !url.username && !url.password;
  } catch {
    return false;
  }
}

export async function loadPlaywright() {
  // The override is useful when a developer already has a separate Playwright install.
  const source = process.env.PLAYWRIGHT_MODULE;
  return source ? import(pathToFileURL(path.resolve(source)).href) : import('playwright');
}

export async function verifyAssetIntegrity(snapshotDir, assets) {
  const root = await realpath(snapshotDir);
  assert.ok(Array.isArray(assets), 'asset manifest must contain assets array');
  for (const asset of assets) {
    // Only successful, retained assets have a path. Capture failures stay documented.
    if (!asset.path) continue;
    assert.equal(typeof asset.path, 'string', 'asset path must be a string');
    assert.ok(!path.isAbsolute(asset.path) && !asset.path.split(/[\\/]/).includes('..'), 'asset path must stay in fixture');
    const actual = await realpath(path.resolve(root, asset.path));
    assert.ok(actual.startsWith(root + path.sep), 'asset must resolve within fixture');
    const body = await readFile(actual);
    assert.equal(body.length, asset.bytes, 'asset byte count mismatch: ' + asset.path);
    assert.equal(createHash('sha256').update(body).digest('hex'), asset.sha256, 'asset checksum mismatch: ' + asset.path);
  }
  return assets.filter(asset => asset.path).length;
}

export async function verifySnapshot(snapshotDir, { chromium, executablePath } = {}) {
  const manifest = JSON.parse(await readFile(path.join(snapshotDir, 'manifest.json'), 'utf8'));
  const metadata = JSON.parse(await readFile(path.join(snapshotDir, 'controls.json'), 'utf8'));
  const { assets } = JSON.parse(await readFile(path.join(snapshotDir, 'assets.json'), 'utf8'));
  const verifiedAssets = await verifyAssetIntegrity(snapshotDir, assets);
  assert.equal(manifest.safety?.neverSave, true, 'capture must declare neverSave');
  assert.equal(manifest.safety?.liveSupportClaimed, false, 'capture must not claim live support');
  assert.equal(manifest.traffic?.responseToNonGetCount, 0, 'capture must report zero non-GET responses');
  assert.ok(Array.isArray(metadata.controls) && metadata.controls.length > 0, 'captured control metadata required');
  if (!chromium) ({ chromium } = await loadPlaywright());
  const server = await startSnapshotServer(snapshotDir);
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: ['--disable-background-networking', '--no-first-run',
      '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1']
  }).catch(async error => { await server.close(); throw error; });
  const blocked = [];
  const failures = [];
  const nonGetResponses = [];
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.route('**/*', route => {
      if (isAllowedOfflineRequest(route.request(), server.origin)) return route.continue();
      blocked.push({ method: route.request().method(), url: route.request().url() });
      return route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    page.on('response', response => {
      if (response.request().method() !== 'GET') nonGetResponses.push(response.url());
      if (response.status() >= 400) failures.push({ url: response.url(), status: response.status() });
    });
    page.on('requestfailed', request => failures.push({ url: request.url(), error: request.failure()?.errorText }));
    const entrypoints = [];
    for (const entry of ['index.html', 'outerHTML.html']) {
      const response = await page.goto(server.origin + '/' + entry, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200, 'snapshot entry point must load');
      const dom = await page.evaluate(() => ({
        title: document.title,
        controls: document.querySelectorAll('input,select,textarea,button,[role="combobox"]').length,
        formItems: document.querySelectorAll('.ant-form-item').length,
        bodyTextLength: document.body?.textContent?.trim().length || 0,
        localStylesheets: [...document.querySelectorAll('link[rel="stylesheet"][href]')]
          .filter(link => new URL(link.href).origin === location.origin).length,
        loadedStylesheets: [...document.styleSheets].length,
        parsedCssRules: [...document.styleSheets].reduce((count, sheet) => {
          try { return count + sheet.cssRules.length; } catch { return count; }
        }, 0),
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight
      }));
      assert.ok(dom.controls > 0, 'captured form controls must remain present');
      if (Number.isInteger(manifest.schema?.formItemCount)) {
        assert.equal(dom.formItems, manifest.schema.formItemCount, 'captured form item count must agree');
      }
      assert.ok(dom.bodyTextLength > 0, 'snapshot must contain captured page text');
      assert.ok(dom.localStylesheets > 0 && dom.parsedCssRules > 0, 'captured local CSS must parse');
      const agreement = await page.evaluate(controls => {
        const normalize = value => String(value || '').replace(/\s+/g, ' ').trim().replace(/[：:]$/, '');
        return controls.filter(control => control.wrapperId).map(control => {
          const element = document.getElementById(control.wrapperId);
          const wrapper = element?.closest('.ant-form-item') || element;
          return {
            wrapperId: control.wrapperId, found: !!element,
            labelMatches: !control.label || normalize(wrapper?.textContent).includes(normalize(control.label))
          };
        });
      }, metadata.controls);
      assert.ok(agreement.length > 0, 'control metadata must identify captured DOM wrappers');
      assert.deepEqual(agreement.filter(row => !row.found || !row.labelMatches), [], 'captured wrappers/labels must agree with replay DOM');
      const cssEffect = await page.evaluate(() => {
        const properties = ['display', 'boxSizing', 'marginTop', 'marginBottom', 'paddingLeft', 'paddingRight',
          'fontSize', 'height', 'lineHeight', 'backgroundColor', 'color', 'borderTopWidth', 'width'];
        const elements = [...document.querySelectorAll('.ant-form-item,input,select,textarea,.ant-select')].slice(0, 30);
        const sample = () => elements.map(element => {
          const style = getComputedStyle(element);
          return properties.map(property => style[property]);
        });
        const before = sample();
        const sheets = [...document.styleSheets];
        const disabled = sheets.map(sheet => sheet.disabled);
        try {
          sheets.forEach(sheet => { sheet.disabled = true; });
          const without = sample();
          return before.reduce((count, values, index) => count + values.filter((value, key) => value !== without[index][key]).length, 0);
        } finally {
          sheets.forEach((sheet, index) => { sheet.disabled = disabled[index]; });
        }
      });
      assert.ok(cssEffect > 0, 'captured CSS must affect actual form control rendering');
      assert.equal(blocked.length, 0, 'fixture attempted a non-GET or external request');
      assert.equal(failures.length, 0, 'fixture resources must load locally');
      assert.equal(nonGetResponses.length, 0, 'offline replay received a non-GET response');
      entrypoints.push({ entry, matchedWrappers: agreement.length, cssComputedStyleDifferences: cssEffect, dom });
    }
    assert.deepEqual(entrypoints[1].dom, entrypoints[0].dom, 'both saved HTML entry points must preserve the same captured structure');
    const first = entrypoints[0];
    return {
      site: path.basename(path.resolve(snapshotDir)), verifiedAt: new Date().toISOString(),
      browser: 'Playwright Chromium', offline: true, scriptExecution: false,
      responseToNonGet: 0, externalRequests: 0, resourceFailures: 0,
      localGetRequests: server.requests.filter(row => row.method === 'GET').length,
      liveSupportClaimed: false, metadataControls: metadata.controls.length,
      matchedWrappers: first.matchedWrappers, verifiedAssets,
      cssComputedStyleDifferences: first.cssComputedStyleDifferences, dom: first.dom, entrypoints
    };
  } finally {
    await browser.close();
    await server.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const defaultRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), 'real');
  const directories = args.length ? args.map(arg => path.resolve(arg)) :
    (await readdir(defaultRoot, { withFileTypes: true })).filter(row => row.isDirectory()).map(row => path.join(defaultRoot, row.name));
  assert.ok(directories.length, 'no real-page snapshots found');
  const results = [];
  for (const directory of directories) results.push(await verifySnapshot(directory, { executablePath: process.env.CHROME_PATH }));
  process.stdout.write(JSON.stringify({ ok: true, snapshots: results }, null, 2) + '\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
}
