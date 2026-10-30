/**
 * Native Blink/V8 regression on an exclusively owned offline Chrome profile.
 * Installed Vue/Ant scripts are fulfilled locally. This never attaches to a
 * user browser, opens a select, or establishes CMS live support/book D.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROW_D_FIELDS, ROW_D_PAGE, buildCmsRowDOptionsProbeExpression }
  from '../scripts/lib/cms-row-d-options.mjs';
import { connectCdp } from '../tools/live-harvest/cdp-client.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRIVATE = 'OWNED_OFFLINE_SELECTED_VALUE_DO_NOT_READ';
const PROFILE_PREFIX = 'cms-row-d-owned-options-blink-';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const field = ROW_D_FIELDS.find(row => row.key === 'expectedWorkNature');
const assetUrl = name => new URL(`/__owned_cms_row_d_fixture__/${name}`, ROW_D_PAGE).href;
const flags = { neverSave: true, liveSupportClaimed: false, livePassClaimed: false,
  writeStarted: false, mutationAllowed: false, valuesExposed: false, probeOnly: true };

function offlineFixture() {
  return `<!doctype html><html><head><meta charset="utf-8">
    <link rel="icon" href="data:,">
    <script src="${assetUrl('moment.js')}"></script>
    <script src="${assetUrl('vue.js')}"></script>
    <script src="${assetUrl('antd.js')}"></script>
    </head><body><div id="app"></div><script>
    (() => {
      const state = window.__ownedOptionsFixture = {
        ready: false, mountFailed: false, effects: { reads: 0, writes: 0, interactions: 0, network: 0 }
      };
      try {
        Vue.config.productionTip = false;
        Vue.config.devtools = false;
        Vue.use(antd);
        const labels = ${JSON.stringify(field.options)};
        new Vue({ render(h) {
          return h('section', { class: 'form-cell', attrs: { id: ${JSON.stringify(field.sectionId)} } }, [
            h('div', { attrs: { id: ${JSON.stringify(field.wrapperId)} } }, [
              h('div', { class: 'ant-form-item' }, [
                h('div', { class: 'ant-form-item-label' }, [h('label', ${JSON.stringify(field.label)})]),
                h('div', { class: 'ant-form-item-control' }, [
                  h(antd.Select, { props: { value: ${JSON.stringify(PRIVATE)}, showSearch: true, filterOption: true } },
                    labels.map(label => h(antd.Select.Option,
                      { key: label, props: { value: label } }, [label])))
                ])
              ])
            ])
          ]);
        }}).$mount('#app');
        Vue.nextTick(() => setTimeout(() => {
          try {
            const document = window.document;
            state.vueVersion = Vue.version;
            state.antVersion = antd.version;
            state.hostCount = document.querySelectorAll('.ant-select').length;
            state.portalCount = document.querySelectorAll('.ant-select-dropdown').length;
            state.optionDomCount = document.querySelectorAll('[role="option"]').length;
            state.selectedNodeCount = document.querySelectorAll('.ant-select-selection-selected-value').length;
            const forbid = kind => function () {
              state.effects[kind] += 1;
              throw new Error('owned_fixture_forbidden_' + kind);
            };
            // Install only after the real framework has mounted and settled.
            // Selected DOM state and its ancestor text must never be read.
            const privateAncestors = new Set();
            for (const selected of document.querySelectorAll('.ant-select-selection-selected-value')) {
              for (let current = selected; current; current = current.parentElement) privateAncestors.add(current);
            }
            for (const node of privateAncestors) {
              for (const name of ['textContent', 'innerHTML', 'outerHTML', 'innerText', 'selectedText']) {
                Object.defineProperty(node, name, { configurable: true,
                  get: forbid('reads'), set: forbid('writes') });
              }
            }
            for (const input of document.querySelectorAll('input')) {
              for (const name of ['value', 'checked', 'selected', 'selectedIndex', 'selectedOptions']) {
                Object.defineProperty(input, name, { configurable: true,
                  get: forbid('reads'), set: forbid('writes') });
              }
              const getAttribute = input.getAttribute.bind(input);
              input.getAttribute = function (name) {
                if (/^(?:value|checked|selected|aria-selected|aria-checked)$/i.test(name)) return forbid('reads')();
                return getAttribute(name);
              };
            }
            // Protect component selected/option values too. These descriptors
            // are installed after mounting; framework option-label definitions
            // remain the actual current VNodes created by the installed Ant.
            const own = (object, key) => {
              const descriptor = object && Object.getOwnPropertyDescriptor(object, key);
              return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
            };
            const host = document.querySelector('.ant-select');
            let selectComponent;
            for (let component = own(host, '__vue__'), depth = 0; component && depth < 8; depth += 1) {
              if (own(component, '$el') !== host) break;
              const parentOptions = own(own(component, '$vnode'), 'componentOptions');
              if (own(own(own(parentOptions, 'Ctor'), 'options'), 'name') === 'Select') selectComponent = component;
              component = own(component, '$parent');
            }
            if (!selectComponent) throw new Error('owned_fixture_missing_select');
            const props = own(own(selectComponent, '$options'), 'propsData');
            Object.defineProperty(props, 'value', { configurable: true, get: forbid('reads') });
            Object.defineProperty(selectComponent, '_optionsInfo', { configurable: true, get: forbid('reads') });
            Object.defineProperty(selectComponent, '_inputValue', { configurable: true, get: forbid('reads') });
            const definitions = own(props, 'children');
            for (let index = 0; index < definitions.length; index += 1) {
              const optionProps = own(own(definitions[index], 'componentOptions'), 'propsData');
              Object.defineProperty(optionProps, 'value', { configurable: true, get: forbid('reads') });
            }
            for (const name of ['click', 'focus', 'blur']) HTMLElement.prototype[name] = forbid('interactions');
            EventTarget.prototype.dispatchEvent = forbid('interactions');
            for (const name of ['submit', 'requestSubmit', 'reset']) HTMLFormElement.prototype[name] = forbid('interactions');
            window.fetch = forbid('network');
            XMLHttpRequest.prototype.send = forbid('network');
            window.XMLHttpRequest = forbid('network');
            window.WebSocket = forbid('network');
            window.EventSource = forbid('network');
            navigator.sendBeacon = forbid('network');
            state.ready = true;
          } catch { state.mountFailed = true; }
        }, 20));
      } catch { state.mountFailed = true; }
    })();
    </script></body></html>`;
}

test('native Blink accepts owned never-opened Vue/Ant option VNodes under the strict full inspector',
  { timeout: 30000 }, async t => {
    const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    assert.ok(fs.existsSync(chrome), 'the dedicated offline Chrome binary is installed');
    assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/vue/package.json'), 'utf8')).version, '2.7.16');
    assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/ant-design-vue/package.json'), 'utf8')).version, '1.7.8');
    const assets = new Map([
      [ROW_D_PAGE, { type: 'text/html; charset=utf-8', body: offlineFixture() }],
      [assetUrl('moment.js'), { type: 'text/javascript; charset=utf-8',
        body: fs.readFileSync(path.join(ROOT, 'node_modules/moment/min/moment.min.js'), 'utf8') }],
      [assetUrl('vue.js'), { type: 'text/javascript; charset=utf-8',
        body: fs.readFileSync(path.join(ROOT, 'node_modules/vue/dist/vue.min.js'), 'utf8') }],
      [assetUrl('antd.js'), { type: 'text/javascript; charset=utf-8',
        body: fs.readFileSync(path.join(ROOT, 'node_modules/ant-design-vue/dist/antd.min.js'), 'utf8') }]
    ]);
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), PROFILE_PREFIX));
    const pending = new Set();
    const requests = [];
    const errors = [];
    let child, session, testFailed = false;
    try {
      child = spawn(chrome, ['--headless=new', '--disable-gpu', '--disable-background-networking',
        '--no-first-run', '--no-default-browser-check', '--no-proxy-server',
        '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost',
        '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
      { windowsHide: true, stdio: 'ignore' });
      let port;
      for (let round = 0; round < 100 && !port; round += 1) {
        try { port = Number(fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split(/\r?\n/u)[0]); } catch {}
        if (!port) await pause(80);
      }
      assert.ok(Number.isInteger(port) && port > 0);
      assert.ok(![9237, 9239, 9241, 9242].includes(port), 'never attach to known user browser ports');
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
      const pages = targets.filter(row => row.type === 'page' && row.url === 'about:blank');
      assert.equal(pages.length, 1, 'only the freshly launched blank page is selected');
      assert.equal(new URL(pages[0].webSocketDebuggerUrl).port, String(port));
      session = await connectCdp(pages[0].webSocketDebuggerUrl, { timeoutMs: 5000, onEvent(event) {
        if (event.method !== 'Fetch.requestPaused') return;
        const { requestId, request } = event.params;
        const asset = request.method === 'GET' ? assets.get(request.url) : undefined;
        requests.push({ url: request.url, method: request.method, fulfilledLocally: Boolean(asset) });
        const command = asset
          ? session.send('Fetch.fulfillRequest', { requestId, responseCode: 200,
            responseHeaders: [{ name: 'Content-Type', value: asset.type }],
            body: Buffer.from(asset.body).toString('base64') })
          : session.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
        pending.add(command);
        void command.then(() => pending.delete(command), error => { errors.push(error); pending.delete(command); });
      } });
      await session.send('Page.enable');
      await session.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
      await session.send('Emulation.setFocusEmulationEnabled', { enabled: true });
      await session.send('Page.navigate', { url: ROW_D_PAGE });
      let status;
      for (let round = 0; round < 100; round += 1) {
        const reply = await session.send('Runtime.evaluate', {
          expression: 'globalThis.__ownedOptionsFixture || null', returnByValue: true
        });
        assert.equal(reply.exceptionDetails, undefined);
        status = reply.result.value;
        if (status?.ready || status?.mountFailed) break;
        await pause(50);
      }
      assert.equal(status?.mountFailed, false, 'the locally installed Vue/Ant fixture mounted');
      assert.equal(status?.ready, true, 'post-mount tripwires are active');
      assert.equal(status.vueVersion, '2.7.16');
      assert.equal(status.antVersion, '1.7.8');
      assert.equal(status.hostCount, 1);
      assert.equal(status.portalCount, 0, 'a never-opened real Ant select has no dropdown portal');
      assert.equal(status.optionDomCount, 0);
      assert.equal(status.selectedNodeCount, 1, 'the private selected display is protected by getters');
      const strict = { returnByValue: true, awaitPromise: false, userGesture: false,
        throwOnSideEffect: true, timeout: 5000 };
      const reply = await session.send('Runtime.evaluate', {
        ...strict, expression: buildCmsRowDOptionsProbeExpression()
      });
      assert.equal(reply.exceptionDetails, undefined, JSON.stringify(reply.exceptionDetails));
      assert.ok(reply.result && Object.hasOwn(reply.result, 'value'));
      const inspection = reply.result.value;
      assert.equal(inspection.reason, 'row_d_preflight_incomplete');
      assert.equal(inspection.fields.length, ROW_D_FIELDS.length);
      const observed = inspection.fields.find(row => row.key === field.key);
      assert.equal(observed.ok, true, JSON.stringify(observed));
      assert.equal(observed.reason, 'read_only_options_preflight');
      assert.equal(observed.observedOptionCount, 2);
      assert.equal(observed.optionsEvidenceSource, 'owned_select_vnodes');
      assert.equal(observed.optionsReadiness, 'target_missing');
      for (const row of [inspection, ...inspection.fields]) {
        for (const [name, expected] of Object.entries(flags)) assert.equal(row[name], expected, name);
      }
      assert.equal(JSON.stringify(inspection).includes(PRIVATE), false, 'private selected values never enter evidence');
      const after = await session.send('Runtime.evaluate', { returnByValue: true,
        expression: `({ effects: globalThis.__ownedOptionsFixture.effects,
          portals: document.querySelectorAll('.ant-select-dropdown').length,
          options: document.querySelectorAll('[role="option"]').length })` });
      assert.deepEqual(after.result.value.effects, { reads: 0, writes: 0, interactions: 0, network: 0 });
      assert.equal(after.result.value.portals, 0);
      assert.equal(after.result.value.options, 0);
      const refused = await session.send('Runtime.evaluate', {
        ...strict, expression: "document.body.setAttribute('data-owned-strict-write', 'forbidden')"
      });
      assert.ok(refused.exceptionDetails, 'native V8 rejects a deliberate DOM mutation');
      const unchanged = await session.send('Runtime.evaluate', { returnByValue: true,
        expression: "document.body.hasAttribute('data-owned-strict-write')" });
      assert.equal(unchanged.result.value, false);
      await Promise.all([...pending]);
      assert.deepEqual(errors, []);
      assert.equal(requests.filter(row => row.fulfilledLocally).length, assets.size);
      assert.equal(requests.some(row => row.method !== 'GET'), false);
      assert.ok(requests.every(row => !row.fulfilledLocally || assets.has(row.url)));
      t.diagnostic('owned offline Chrome only; real Vue 2.7.16 / Ant 1.7.8; zero portal; full strict inspector accepted; deliberate native write rejected');
    } catch (error) {
      testFailed = true;
      throw error;
    } finally {
      try {
        // Close only this child browser, then remove only its checked profile.
        try { await session?.send('Browser.close'); } catch {}
        session?.close();
        const waitForExit = async () => {
          if (child && child.exitCode === null && child.signalCode === null) {
            await Promise.race([new Promise(resolve => child.once('exit', resolve)), pause(2000)]);
          }
        };
        await waitForExit();
        if (child && child.exitCode === null && child.signalCode === null) { child.kill(); await waitForExit(); }
        const relative = path.relative(fs.realpathSync(os.tmpdir()), fs.realpathSync(profile));
        assert.ok(relative.startsWith(PROFILE_PREFIX) && !path.isAbsolute(relative) && !relative.includes(path.sep));
        fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
      } catch (error) {
        if (!testFailed) throw error;
        t.diagnostic('owned offline browser cleanup also failed; original test failure retained');
      }
    }
  });
