// First-party offline harness. No production permissions, gates or adapters are changed.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRowDNetworkGuard } from '../../scripts/live/cms-row-d-live.mjs';
import { canonicalProfileHash } from '../../src/profile/profile-lifecycle.js';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CMS = 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';
export const GTH = 'https://hr.gtht.com/resume/edit/';
export const SYNTHETIC = 'http://127.0.0.1:17837/offline-ats-control-zoo';
export const WRITE_ROUTE = 'https://offline.mokahr.com/zoo/';
const assets = {
  '/vendor/vue.js': 'node_modules/vue/dist/vue.js',
  '/vendor/moment.js': 'node_modules/moment/min/moment.min.js',
  '/vendor/antd.js': 'node_modules/ant-design-vue/dist/antd.js',
  '/vendor/antd.css': 'node_modules/ant-design-vue/dist/antd.css',
  '/vendor/element.js': 'node_modules/element-ui/lib/index.js',
  '/vendor/element.css': 'node_modules/element-ui/lib/theme-chalk/index.css',
  '/vendor/iview.js': 'node_modules/iview/dist/iview.js',
  '/vendor/iview.css': 'node_modules/iview/dist/styles/iview.css',
  '/vendor/fonts/ionicons.woff2': 'node_modules/iview/dist/styles/fonts/ionicons.woff2',
  '/vendor/fonts/ionicons.woff': 'node_modules/iview/dist/styles/fonts/ionicons.woff',
  '/vendor/fonts/ionicons.ttf': 'node_modules/iview/dist/styles/fonts/ionicons.ttf',
  '/fixtures/extended.js': 'tests/zoo/fixtures/extended.js',
  '/vendor/fonts/element-icons.woff': 'node_modules/element-ui/lib/theme-chalk/fonts/element-icons.woff',
  '/vendor/fonts/element-icons.ttf': 'node_modules/element-ui/lib/theme-chalk/fonts/element-icons.ttf',
  '/fixtures/zoo.js': 'tests/zoo/fixtures/zoo.js',
  '/fixtures/zoo.css': 'tests/zoo/fixtures/zoo.css',
  '/fixtures/batchb.js': 'tests/zoo/fixtures/batchb.js',
  '/fixtures/upload.js': 'tests/zoo/fixtures/upload.js',
  '/fixtures/dates.js': 'tests/zoo/fixtures/dates.js',
};
const contentType = file => /\.(?:js|mjs)$/u.test(file) ? 'text/javascript; charset=utf-8'
  : file.endsWith('.json') ? 'application/json; charset=utf-8'
  : file.endsWith('.css') ? 'text/css; charset=utf-8' : file.endsWith('.woff') ? 'font/woff'
    : file.endsWith('.ttf') ? 'font/ttf' : 'text/html; charset=utf-8';

function extensionPath() {
  if (process.env.ZOO_EXTENSION) return path.resolve(process.env.ZOO_EXTENSION);
  const builds = fs.readdirSync(path.join(root, 'dist'), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith('edge-internal-'))
    .map(entry => path.join(root, 'dist', entry.name, 'extension'))
    .filter(dir => fs.existsSync(path.join(dir, 'manifest.json')))
    .sort().reverse();
  if (!builds.length) throw Error('Build an internal extension first or set ZOO_EXTENSION.');
  return builds[0];
}

export async function startZoo(caseName, variant = '') {
  const synthetic = caseName.startsWith('batchb-') || caseName.startsWith('upload-') || caseName.startsWith('dates-');
  const extension = extensionPath();
  const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json'), 'utf8'));
  if (manifest.background?.service_worker !== 'src/background/worker.mjs') throw Error('zoo_requires_internal_build');
  const productPaths = JSON.parse(fs.readFileSync(path.join(root, 'WHITELIST.json'), 'utf8')).productPaths;
  if (!Array.isArray(productPaths) || !productPaths.includes('manifest.json') || !productPaths.includes('src/background/worker.mjs')) throw Error('zoo_product_inventory_invalid');
  for (const file of productPaths) {
    if (!fs.readFileSync(path.join(extension, file)).equals(fs.readFileSync(path.join(root, file)))) throw Error(`stale_extension:${file}`);
  }
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-zoo-'));
  let context;
  async function cleanup() {
    try { await context?.close(); }
    finally {
      const resolved = path.resolve(profileDir), prefix = path.resolve(os.tmpdir()) + path.sep;
      if (!resolved.startsWith(prefix) || !path.basename(resolved).startsWith('resume-zoo-')) throw Error('zoo_profile_cleanup_invalid');
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }
  try {
    context = await chromium.launchPersistentContext(profileDir, {
      channel: 'chromium', headless: process.env.ZOO_HEADED !== '1', serviceWorkers: 'allow',
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`,
        '--host-resolver-rules=MAP * ~NOTFOUND', '--no-proxy-server', '--disable-background-networking'],
    });
    const routing = { fulfilled: 0, rejected: [], nonGetReachedRoute: 0 };
    let extensionHost = '';
    // Every web request is fulfilled from this fixed map or aborted. There is no
    // fallback continue(), so fixture hostnames can never reach recruiting hosts.
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() !== 'GET') {
        routing.nonGetReachedRoute++;
        await route.abort('blockedbyclient'); return;
      }
      if (url.protocol === 'chrome-extension:' && url.hostname === extensionHost && productPaths.includes(url.pathname.slice(1))) {
        const file = url.pathname.slice(1);
        routing.fulfilled++;
        await route.fulfill({ status: 200, contentType: contentType(file), body: fs.readFileSync(path.join(extension, file)) });
        return;
      }
      if (![new URL(CMS).origin, new URL(GTH).origin, new URL(WRITE_ROUTE).origin,
        ...(synthetic ? [new URL(SYNTHETIC).origin] : [])].includes(url.origin)) {
        routing.rejected.push(`${url.origin}${url.pathname}`); await route.abort('blockedbyclient'); return;
      }
      const file = synthetic && url.href === SYNTHETIC ? (caseName.startsWith('dates-') ? 'tests/zoo/fixtures/dates.html'
        : caseName.startsWith('upload-') ? 'tests/zoo/fixtures/upload.html' : 'tests/zoo/fixtures/batchb.html')
        : url.href === CMS || url.href === GTH || url.href === WRITE_ROUTE ? 'tests/zoo/fixtures/index.html' : assets[url.pathname];
      if (!file) {
        // Browsers may ask for an icon; it is still supplied locally.
        if (url.pathname === '/favicon.ico') { await route.fulfill({ status: 204, body: '' }); return; }
        routing.rejected.push(url.pathname); await route.abort('blockedbyclient'); return;
      }
      routing.fulfilled++;
      await route.fulfill({ status: 200, contentType: contentType(file), body: fs.readFileSync(path.join(root, file)) });
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    extensionHost = new URL(worker.url()).hostname;
    const page = await context.newPage();
    await page.addInitScript(({ caseName, variant }) => {
      window.__ZOO_CASE__ = caseName; window.__ZOO_VARIANT__ = variant;
      const journal = window.__zooSafety = { blacklistClickAttempts: 0 };
      document.addEventListener('click', event => {
        const action = event.target?.closest?.('button,a,[role="button"],input[type="submit"]');
        if (action && /^(保存|提交|下一步|投递|删除)$/u.test((action.textContent || action.value || '').trim())) {
          journal.blacklistClickAttempts++;
          event.preventDefault(); event.stopImmediatePropagation();
        }
      }, true);
    }, { caseName, variant });
    const cdp = await context.newCDPSession(page);
    const guard = createRowDNetworkGuard((method, params) => cdp.send(method, params));
    const events = ['Fetch.requestPaused', 'Network.requestWillBeSent', 'Network.responseReceived',
      'Network.responseReceivedExtraInfo', 'Network.responseReceivedEarlyHints', 'Network.dataReceived',
      'Network.loadingFinished', 'Network.loadingFailed'];
    for (const event of events) cdp.on(event, params => guard.onEvent({ method: event, params }));
    await cdp.send('Network.enable');
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
    const url = synthetic ? SYNTHETIC : caseName === 'write-route' ? WRITE_ROUTE : caseName.startsWith('gth-') ? GTH : CMS;
    await page.goto(url);
    await page.bringToFront();
    await page.waitForFunction(() => window.__zoo?.ready === true);
    const tabId = await worker.evaluate(async url => {
      const tabs = await chrome.tabs.query({});
      const matches = tabs.filter(tab => tab.url === url);
      if (matches.length !== 1) throw Error('zoo_target_not_unique');
      await chrome.tabs.update(matches[0].id, { active: true });
      return matches[0].id;
    }, url);
    const fileHashes = {};
    // The built extension intentionally has no loopback host permission. New
    // synthetic cases execute its exact checked bytes in a disposable browser
    // isolated world; production permissions and the legacy extension path stay
    // unchanged. MAIN remains a distinct real browser execution context.
    const isolatedContext = synthetic ? (await cdp.send('Page.createIsolatedWorld', {
      frameId: (await cdp.send('Page.getFrameTree')).frameTree.frame.id,
      worldName: 'offline-resume-zoo', grantUniveralAccess: false,
    })).executionContextId : null;
    async function fixtureEvaluate(expression, world) {
      const result = await cdp.send('Runtime.evaluate', {
        expression, awaitPromise: true, returnByValue: true,
        ...(world === 'ISOLATED' ? { contextId: isolatedContext } : {}),
      });
      if (result.exceptionDetails) throw Error(`zoo_fixture_execution:${result.exceptionDetails.exception?.description || result.exceptionDetails.text}`);
      return result.result.value;
    }
    async function inject(files, world = 'ISOLATED') {
      for (const file of files) {
        const built = fs.readFileSync(path.join(extension, file));
        const source = fs.readFileSync(path.join(root, file));
        if (!built.equals(source)) throw Error(`stale_extension:${file}`);
        fileHashes[file] = createHash('sha256').update(built).digest('hex');
        if (synthetic) await fixtureEvaluate(built.toString('utf8'), world);
      }
      if (synthetic) return;
      return worker.evaluate(async ({ tabId, files }) => chrome.scripting.executeScript({ target: { tabId }, files, world: 'ISOLATED' }), { tabId, files });
    }
    let bridgeDocument;
    async function shadow(requests) {
      const bridge = 'src/background/controls-shadow.mjs';
      // MV3 service workers reject dynamic import(). A script-free packaged
      // manifest document supplies a normal extension module context instead.
      if (!bridgeDocument) {
        bridgeDocument = await context.newPage();
        await bridgeDocument.goto(new URL('/manifest.json', worker.url()).href);
        await page.bringToFront();
      }
      const files = await bridgeDocument.evaluate(async bridge => {
        const module = await import(chrome.runtime.getURL(bridge));
        return module.CONTROL_FILES;
      }, bridge);
      if (!Array.isArray(files) || !files.length) throw Error('zoo_controls_inventory_missing');
      for (const file of [bridge, ...files]) {
        const built = fs.readFileSync(path.join(extension, file));
        const source = fs.readFileSync(path.join(root, file));
        if (!built.equals(source)) throw Error(`stale_extension:${file}`);
        fileHashes[file] = createHash('sha256').update(built).digest('hex');
      }
      return bridgeDocument.evaluate(async ({ tabId, bridge, requests }) => {
        const module = await import(chrome.runtime.getURL(bridge));
        return module.inspectControls(chrome, tabId, requests);
      }, { tabId, bridge, requests });
    }
    async function execute(func, args = [], world = 'ISOLATED') {
      // Function source is serialized by Playwright into extension scope; all
      // production writes below come from the injected built-extension modules.
      const source = func.toString();
      if (synthetic) return fixtureEvaluate(`(${source})(...${JSON.stringify(args)})`, world);
      const expression = `async ({tabId,args,world}) => { const rows = await chrome.scripting.executeScript({target:{tabId},world,func:(${source}),args}); if(rows.length!==1) throw Error('zoo_execution_ambiguous'); return rows[0].result; }`;
      return worker.evaluate(`(${expression})(${JSON.stringify({ tabId, args, world })})`);
    }
    const readback = () => execute(() => ({ model: window.__zoo.readModel(), snapshot: window.__zoo.snapshot() }), [], 'MAIN');
    async function bind(profile) {
      const epoch = '00000000-0000-4000-8000-000000000001';
      await worker.evaluate(async ({ profile, epoch }) => chrome.storage.local.set({ resumeProfile: profile, resumeProfileLifecycle: { version: 1, epoch, state: 'ready' } }), { profile, epoch });
      return { version: 1, epoch, profileHash: await canonicalProfileHash(profile) };
    }
    async function evidence() {
      await guard.drain();
      const safety = await page.evaluate(() => ({ ...window.__zooSafety,
        blacklistClicks: window.__zoo.snapshot().effects.blacklistClicks }));
      return { neverSave: true, liveSupportClaimed: false, routing, ...safety,
        nonGetObserved: guard.traffic.observedNonGetCount, nonGetBlocked: guard.traffic.blockedNonGetCount,
        responseToNonGet: guard.traffic.responseToNonGetCount, guardFailed: guard.failed(),
        guardAssessment: guard.assessment(), adapterHashes: fileHashes };
    }
    return { page, worker, tabId, inject, shadow, execute, readback, bind, evidence, close: cleanup };
  } catch (error) { await cleanup(); throw error; }
}

export function workProfile() {
  const row = { position: '测试工程师', jobCategory: '金融/保险||投资/证券/基金', organization: '离线示例公司',
    startDate: '2023-01', endDate: '2024-06', description: '离线职责', industry: '金融/保险||投资/证券/基金' };
  return { schemaVersion: 1, experience: [row], confirmedFields: Object.keys(row).map(key => `experience.0.${key}`) };
}
