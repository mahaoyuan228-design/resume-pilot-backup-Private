// Generic, first-party HAR scaffold. No production adapters or guards are changed.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const assets = new Map([
  ['/har.html', ['tests/zoo/fixtures/har.html', 'text/html; charset=utf-8']],
  ...['model', 'registry', 'upload', 'native', 'date-controls'].map(name =>
    [`/controls/${name}.js`, [`src/content/controls/${name}.js`, 'text/javascript; charset=utf-8']]),
]);

export async function startHarFixture() {
  const traffic = { gets: 0, nonGets: 0 };
  // Explicit files only: no URL-to-filesystem mapping, redirects or upstream proxy.
  const bodies = new Map(await Promise.all([...assets].map(async ([url, [file, type]]) =>
    [url, { body: await fs.readFile(path.join(root, file)), type }])));
  const server = http.createServer((request, response) => {
    if (request.method !== 'GET') {
      traffic.nonGets++;
      response.writeHead(405).end();
      return;
    }
    traffic.gets++;
    const asset = bodies.get(request.url);
    if (!asset) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'content-type': asset.type, 'cache-control': 'no-store' });
    response.end(asset.body);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  let closed = false;
  return { origin, url: `${origin}/har.html`, traffic,
    async close() {
      if (closed) return;
      closed = true;
      await new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        server.closeAllConnections();
      });
    },
  };
}

function recordingOrigin(origin) {
  let url;
  try { url = new URL(origin); } catch { throw Error('har_record_requires_loopback_origin'); }
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.origin !== origin) {
    throw Error('har_record_requires_loopback_origin');
  }
  return url.origin;
}

export async function readHar(harPath) {
  const archive = JSON.parse(await fs.readFile(harPath, 'utf8'));
  const entries = archive.log?.entries;
  if (!Array.isArray(entries) || !entries.length) throw Error('har_entries_missing');
  // A standalone embedded HAR is required; never load a body from an external path.
  if (entries.some(entry => entry.response?.content?._file)) throw Error('har_requires_embedded_content');
  const document = entries.find(entry => entry.request?.method === 'GET'
    && entry.response?.content?.mimeType?.startsWith('text/html') && entry.response.status === 200);
  if (!document) throw Error('har_document_missing');
  const url = new URL(document.request.url);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw Error('har_document_url_invalid');
  return { archive, url: url.href };
}

export async function openHarContext(browser, { mode, harPath, origin }) {
  if (!['record', 'replay'].includes(mode)) throw Error('har_mode_invalid');
  const recording = mode === 'record';
  if (recording) {
    origin = recordingOrigin(origin);
    // Refuse accidental replacement; context.close() is what flushes a new recording.
    try { await fs.access(harPath); throw Error('har_record_path_exists'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    await fs.mkdir(path.dirname(path.resolve(harPath)), { recursive: true });
  } else { await readHar(harPath); }

  const context = await browser.newContext({
    serviceWorkers: 'block', acceptDownloads: false,
    ...(recording ? { recordHar: { path: harPath, mode: 'minimal', content: 'embed',
      urlFilter: `${origin}/**` } } : {}),
  });
  const traffic = { allowedGets: 0, blockedNonGets: 0, blockedRequests: 0, blockedWebSockets: 0 };
  try {
    if (!recording) {
      await context.routeFromHAR(harPath, { update: false, notFound: 'abort' });
      await context.setOffline(true);
    }
    // Routes run last-registered first. Guard before HAR, then FALLBACK into HAR;
    // continue() here would bypass replay. Recording alone permits scoped GETs.
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() !== 'GET') {
        traffic.blockedNonGets++;
        await route.abort('blockedbyclient');
      } else if (!['http:', 'https:'].includes(url.protocol) || recording && url.origin !== origin) {
        traffic.blockedRequests++;
        await route.abort('blockedbyclient');
      } else {
        traffic.allowedGets++;
        if (recording) await route.continue();
        else await route.fallback();
      }
    });
    await context.routeWebSocket('**/*', socket => {
      traffic.blockedWebSockets++;
      socket.close(); // Never connectToServer(): WebSocket streams are outside HAR.
    });
    return { context, traffic, close: () => context.close() };
  } catch (error) { await context.close(); throw error; }
}
