/** Synthetic offline contracts only; no CMS browser, UI opens, or fill support. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { JSDOM } from 'jsdom';
import { ROW_D_FIELDS, ROW_D_PAGE, inspectCmsRowDOptions,
  buildCmsRowDOptionsProbeExpression } from '../scripts/lib/cms-row-d-options.mjs';
import { connectCdp } from '../tools/live-harvest/cdp-client.mjs';

const LOCATIONS = ROW_D_FIELDS.filter(field => ['firstWorkLocation', 'secondWorkLocation'].includes(field.key));
const PRIVATE = 'PRIVATE_LOCATION_CURRENT_VALUE';
// The five synthetic tail labels deliberately provide no missing geography.
const labels = [...LOCATIONS[0].options, ...Array.from({ length: 5 }, (_, index) => `synthetic-tail-${index}`)];
const flags = { neverSave: true, probeOnly: true, writeStarted: false, mutationAllowed: false,
  valuesExposed: false, liveSupportClaimed: false, livePassClaimed: false };
const reference = (index, slot) => `synthetic-location-${index}-${slot}`;

function html(mode = 'react') {
  const wrappers = LOCATIONS.map((field, index) => `<div id="${field.wrapperId}"><div class="ant-form-item">
    <div class="ant-form-item-label"><label>${field.label}</label></div><div class="cascader-plugins-wrap">
    ${[0, 1].map(slot => `<div class="ant-select"><div class="ant-select-selection ant-select-selection--single"
      role="combobox" aria-controls="${reference(index, slot)}"><span class="ant-select-selection-selected-value">${PRIVATE}</span>
      <span class="ant-select-search"><input class="ant-select-search__field" type="text" style="display:none" value="${PRIVATE}"></span>
      </div></div>`).join('')}</div></div></div>`).join('');
  const portals = mode !== 'dom' ? '' : LOCATIONS.map((_field, index) => `<div class="ant-select-dropdown" style="display:none">
    <ul id="${reference(index, 0)}" class="ant-select-dropdown-menu" role="listbox">${labels.map(label =>
      `<li class="ant-select-dropdown-menu-item" role="option">${label}</li>`).join('')}</ul></div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"></head>
    <body><section id="13" class="form-cell">${wrappers}</section>${portals}</body></html>`;
}

// Only own data option labels are readable. Current state, option values, and
// selected props are accessor tripwires that the inspector must never invoke.
function attachReact(host, optionLabels, state = { reads: 0 }) {
  const forbid = () => { state.reads += 1; throw Error('private_location_read'); };
  function Option() {}
  Option.isSelectOption = true;
  function Select() {}
  function SelectTrigger() {}
  function Trigger() {}
  const options = optionLabels.map(children => {
    const props = { children };
    Object.defineProperty(props, 'value', { configurable: true, get: forbid });
    return { type: Option, ref: null, props };
  });
  const props = { prefixCls: 'ant-select', optionLabelProp: 'children', children: options };
  Object.defineProperty(props, 'value', { configurable: true, get: forbid });
  const combo = host.querySelector('[role="combobox"]');
  const input = host.querySelector('input');
  const ariaId = combo.getAttribute('aria-controls') || input.getAttribute('aria-controls');
  const triggerProps = { prefixCls: 'ant-select', ariaId };
  const fiber = (tag, type, stateNode, memoizedProps = {}) => ({ tag, type, stateNode,
    memoizedProps, child: null, sibling: null, return: null, alternate: null });
  const hostFiber = fiber(5, 'div', host);
  const trigger = fiber(1, Trigger, {});
  const selectTrigger = fiber(1, SelectTrigger, { props: triggerProps }, triggerProps);
  const select = fiber(1, Select, { props }, props);
  const outer = fiber(5, 'div', host.parentElement);
  const root = fiber(3, null, {});
  root.stateNode.current = root;
  const chain = [root, outer, select, selectTrigger, trigger, hostFiber];
  for (let index = 1; index < chain.length; index += 1) {
    chain[index].return = chain[index - 1];
    chain[index - 1].child = chain[index];
  }
  host.__reactInternalInstance$locationSynthetic = hostFiber;
  return { props, options, triggerProps, hostFiber, select, root };
}

function safe(result) {
  for (const [key, expected] of Object.entries(flags)) assert.equal(result[key], expected);
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes(PRIVATE));
  assert.ok(!serialized.includes('synthetic-tail-'));
  assert.ok(!serialized.includes('synthetic-location-'));
}

function fixture(t, mode = 'react') {
  const dom = new JSDOM(html(mode), { url: ROW_D_PAGE, pretendToBeVisual: true, runScripts: 'outside-only' });
  const doc = dom.window.document;
  Object.defineProperty(doc, 'readyState', { value: 'complete' });
  const hosts = LOCATIONS.map(field => [...doc.getElementById(field.wrapperId).querySelectorAll('.ant-select')]);
  const graphs = mode === 'react' ? hosts.map(pair => attachReact(pair[0], labels)) : [];
  const forbidden = () => { throw Error('unexpected_current_value_or_interaction'); };
  for (const node of doc.querySelectorAll('input,.ant-select-selection-selected-value')) {
    for (const key of ['value', 'checked', 'selected', 'selectedIndex', 'selectedOptions', 'textContent']) {
      Object.defineProperty(node, key, { configurable: true, get: forbidden, set: forbidden });
    }
  }
  for (const key of ['click', 'focus', 'blur']) dom.window.HTMLElement.prototype[key] = forbidden;
  dom.window.EventTarget.prototype.dispatchEvent = forbidden;
  const read = (expression = false, requests = {}) => {
    const before = doc.documentElement.outerHTML;
    const observer = new dom.window.MutationObserver(forbidden);
    observer.observe(doc, { subtree: true, attributes: true, childList: true, characterData: true });
    try {
      const result = expression ? dom.window.eval(buildCmsRowDOptionsProbeExpression(requests)) : inspectCmsRowDOptions(doc, requests);
      assert.equal(observer.takeRecords().length, 0);
      assert.equal(doc.documentElement.outerHTML, before);
      safe(result);
      return result.fields.filter(row => LOCATIONS.some(field => field.key === row.key));
    } finally { observer.disconnect(); }
  };
  t.after(() => dom.window.close());
  return { dom, doc, hosts, graphs, read };
}

for (const mode of ['react', 'dom']) for (const expression of [false, true]) {
  test(`two exact owned cascader hosts pass only read-only partial preflight (${mode}, expression=${expression})`, t => {
    const f = fixture(t, mode);
    const rows = f.read(expression);
    for (const row of rows) {
      assert.equal(row.ok, true);
      assert.equal(row.reason, 'read_only_location_preflight');
      assert.equal(row.optionsComplete, false);
      assert.equal(row.observedOptionCount, 30);
      assert.equal(row.samplePrefixMatched, true);
      assert.equal(row.currentOptionsIndependentlyObserved, true);
      assert.equal(row.locationSelectionVerified, false);
      assert.equal(row.locationCompositeEvidence.hostCount, 2);
      assert.equal(row.locationCompositeEvidence.optionsHostSlot, 0);
      assert.deepEqual(Array.from(row.locationCompositeEvidence.hosts, host => host.hostSlot), [0, 1]);
      assert.equal(row.optionsEvidenceSource, mode === 'react' ? 'owned_react_props' : 'aria_controls_dom');
    }
    assert.equal(rows[1].evidenceSource, 'reused_dictionary');
    assert.equal(rows[1].independentOptionsEvidence, false);
    assert.equal(rows[1].reusedFrom, LOCATIONS[0].wrapperId);
  });
}

for (const locationIndex of [0, 1]) test(`location ${locationIndex + 1} cannot borrow the other field's current option evidence`, t => {
  const f = fixture(t);
  delete f.hosts[locationIndex][0].__reactInternalInstance$locationSynthetic;
  const rows = f.read();
  assert.equal(rows[locationIndex].ok, false);
  assert.equal(rows[locationIndex].reason, 'current_options_unavailable');
  assert.equal(rows[1 - locationIndex].ok, true);
});

for (const count of [25, 29, 31]) test(`composite refuses independent current count ${count}`, t => {
  const f = fixture(t);
  f.graphs[0].props.children = Array.from({ length: count }, (_, index) =>
    f.graphs[0].options[index] || { type: f.graphs[0].options[0].type, ref: null, props: { children: 'synthetic-extra' } });
  assert.equal(f.read()[0].reason, 'option_dictionary_mismatch');
});

test('a wrong known prefix, getter definition, or stale props cannot become location evidence', t => {
  const f = fixture(t);
  f.graphs[0].options[0].props.children = 'synthetic-wrong-prefix';
  assert.equal(f.read()[0].reason, 'option_dictionary_mismatch');
  Object.defineProperty(f.graphs[0].options[0].props, 'children', { get() { throw Error(PRIVATE); } });
  assert.equal(f.read()[0].reason, 'current_options_unavailable');
  f.graphs[0].select.stateNode.props = {};
  assert.equal(f.read()[0].reason, 'current_options_unavailable');
});

const malformed = {
  'missing cascader': f => { f.doc.querySelector('.cascader-plugins-wrap').className = 'unrecognized'; },
  'nested hosts': f => { f.hosts[0][0].append(f.hosts[0][1]); },
  'extra cascader': f => { const wrap = f.doc.createElement('div'); wrap.className = 'cascader-plugins-wrap'; f.hosts[0][1].before(wrap); wrap.append(f.hosts[0][1]); },
  'extra input outside hosts': f => { f.hosts[0][0].parentElement.append(f.doc.createElement('input')); },
  'peer helper disabled': f => { f.hosts[0][1].querySelector('input').disabled = true; },
  'peer helper visible': f => { f.hosts[0][1].querySelector('input').removeAttribute('style'); },
  'peer generic hidden input': f => { f.hosts[0][1].querySelector('input').className = 'unrecognized'; },
  'peer host hidden': f => { f.hosts[0][1].hidden = true; },
  'peer host disabled': f => { f.hosts[0][1].classList.add('ant-select-disabled'); },
  'peer host loading': f => { f.hosts[0][1].classList.add('ant-select-loading'); },
  'peer combo busy': f => { f.hosts[0][1].querySelector('[role="combobox"]').setAttribute('aria-busy', 'true'); },
  'peer reference absent': f => { f.hosts[0][1].querySelector('[role="combobox"]').removeAttribute('aria-controls'); },
  'peer reference shared': f => { f.hosts[0][1].querySelector('[role="combobox"]').setAttribute('aria-controls', reference(0, 0)); },
  'peer foreign owner': f => { const owner = f.doc.createElement('i'); owner.setAttribute('aria-controls', reference(0, 1)); f.doc.body.append(owner); },
  'peer duplicate target': f => { for (let i = 0; i < 2; i += 1) { const node = f.doc.createElement('ul'); node.id = reference(0, 1); f.doc.body.append(node); } },
  'peer foreign portal': f => { const node = f.doc.createElement('ul'); node.id = reference(0, 1); node.className = 'ant-select-dropdown-menu'; node.setAttribute('role', 'listbox'); const portal = f.doc.createElement('div'); portal.className = 'ant-select-dropdown'; portal.append(node); f.doc.getElementById(LOCATIONS[1].wrapperId).append(portal); },
  'wrong label': f => { f.doc.querySelector('label').textContent = '意向二：期望工作地点*'; },
  'duplicate wrapper': f => { const node = f.doc.createElement('div'); node.id = LOCATIONS[0].wrapperId; f.doc.body.append(node); }
};
for (const [name, change] of Object.entries(malformed)) test(`two-host location refuses ${name}`, t => {
  const f = fixture(t);
  change(f);
  const row = f.read()[0];
  assert.equal(row.ok, false);
  assert.notEqual(row.reason, 'read_only_location_preflight');
});

test('unique input-owned ARIA binding is accepted without reading input content', t => {
  const f = fixture(t);
  for (const pair of f.hosts) for (const host of pair) {
    const combo = host.querySelector('[role="combobox"]');
    host.querySelector('input').setAttribute('aria-controls', combo.getAttribute('aria-controls'));
    combo.removeAttribute('aria-controls');
  }
  assert.ok(f.read(true).every(row => row.ok));
});

test('request failure remains a refusal after complete composite option evidence', t => {
  const f = fixture(t);
  const row = f.read(false, { [LOCATIONS[0].wrapperId]: 'not-an-evidenced-option' })[0];
  assert.equal(row.ok, false);
  assert.equal(row.reason, 'option_unknown');
});

test('native Blink accepts exact location composite evidence with throwOnSideEffect enabled',
  { timeout: 30000 }, async t => {
    const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    assert.ok(fs.existsSync(chrome));
    const prefix = 'cms-row-d-location-owned-';
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    const fixtureUrl = `${ROW_D_PAGE}?synthetic=owned-location-composite`;
    const fixtureHtml = html() + `<script>window.__locationEffects={reads:0};
      (${attachReact.toString()})(document.querySelectorAll('.ant-select')[0],${JSON.stringify(labels)},window.__locationEffects);
      (${attachReact.toString()})(document.querySelectorAll('.ant-select')[2],${JSON.stringify(labels)},window.__locationEffects);
      for(const node of document.querySelectorAll('input,.ant-select-selection-selected-value')){
        for(const key of ['value','checked','selected','textContent'])Object.defineProperty(node,key,{get(){window.__locationEffects.reads++;throw Error('forbidden_location_read')}});
      }</script>`;
    let child, session, loaded;
    const ready = new Promise(resolve => { loaded = resolve; });
    const requests = [];
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    try {
      child = spawn(chrome, ['--headless=new', '--disable-gpu', '--disable-background-networking', '--no-first-run',
        '--no-default-browser-check', '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost',
        '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
      let port;
      for (let round = 0; round < 100 && !port; round += 1) {
        try { port = Number(fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split(/\r?\n/u)[0]); } catch {}
        if (!port) await pause(80);
      }
      assert.ok(port && ![9237, 9239, 9241, 9242].includes(port));
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
      const pages = targets.filter(row => row.type === 'page' && row.url === 'about:blank');
      assert.equal(pages.length, 1);
      session = await connectCdp(pages[0].webSocketDebuggerUrl, { timeoutMs: 5000, onEvent(event) {
        if (event.method === 'Page.loadEventFired') loaded();
        if (event.method !== 'Fetch.requestPaused') return;
        const { requestId, request } = event.params;
        requests.push(request);
        const command = request.method === 'GET' && request.url === fixtureUrl
          ? session.send('Fetch.fulfillRequest', { requestId, responseCode: 200,
            responseHeaders: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }],
            body: Buffer.from(fixtureHtml).toString('base64') })
          : session.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
        void command.catch(() => {});
      } });
      await session.send('Page.enable');
      await session.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
      await session.send('Page.navigate', { url: fixtureUrl });
      await ready;
      const params = { expression: buildCmsRowDOptionsProbeExpression(), returnByValue: true,
        awaitPromise: false, userGesture: false, throwOnSideEffect: true, timeout: 5000 };
      const reply = await session.send('Runtime.evaluate', params);
      assert.equal(reply.exceptionDetails, undefined, JSON.stringify(reply.exceptionDetails));
      safe(reply.result.value);
      const rows = reply.result.value.fields.filter(row => LOCATIONS.some(field => field.key === row.key));
      assert.equal(rows.length, 2);
      assert.ok(rows.every(row => row.ok && row.reason === 'read_only_location_preflight'));
      const reads = await session.send('Runtime.evaluate', { ...params, expression: 'window.__locationEffects.reads' });
      assert.equal(reads.result.value, 0);
      const refused = await session.send('Runtime.evaluate', { ...params,
        expression: "document.body.setAttribute('data-location-write','forbidden')" });
      assert.ok(refused.exceptionDetails, 'the same strict guard rejects deliberate DOM mutation');
      assert.ok(requests.every(request => request.method === 'GET' && request.url === fixtureUrl));
      t.diagnostic('Exclusively owned synthetic browser; fixture fulfilled locally; no real-site network; strict two-location evidence accepted and deliberate write rejected.');
    } finally {
      try { await session?.send('Browser.close'); } catch {}
      session?.close();
      if (child && child.exitCode === null && child.signalCode === null) {
        await Promise.race([new Promise(resolve => child.once('exit', resolve)), pause(2000)]);
        if (child.exitCode === null && child.signalCode === null) child.kill();
      }
      const relative = path.relative(os.tmpdir(), profile);
      assert.ok(relative.startsWith(prefix) && !path.isAbsolute(relative) && !relative.startsWith('..'));
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
    }
  });
