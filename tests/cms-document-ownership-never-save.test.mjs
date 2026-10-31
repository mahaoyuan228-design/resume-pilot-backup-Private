import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { integrationFixture } from './fixtures/cms-education-fixture.mjs';
import { internshipFixture } from './fixtures/cms-internship-fixture.mjs';

const PAGE = 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';
const plain = value => JSON.parse(JSON.stringify(value));
const settled = () => ({ ok: true, complete: false, writeStarted: false, addClicks: 0,
  saveClicks: 0, deleteClicks: 0, finalSubmitClicks: 0 });

async function bridgeFixture(t, kind, { initialUrl = `${PAGE}?resumeId=fixture-original&lang=1`, session, source, run } = {}) {
  // Reuse the existing fixtures without changing their DOM or widget handlers.
  const html = kind === 'education' ? await integrationFixture({
    schools: ['Fixture School'], regions: [{ province: 'Fixture Province', city: 'Fixture City' }]
  }) : await internshipFixture();
  const dom = new JSDOM(html, { url: initialUrl, runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(window) {
      window.structuredClone = structuredClone;
      window.Element.prototype.getClientRects = function () { return this.isConnected ? [{}] : []; };
    }
  });
  t.after(() => dom.window.close());
  const { window } = dom, calls = { run: 0, session: 0, source: 0 }, clicks = [], listeners = new Set();
  window.document.addEventListener('click', event => clicks.push(event.target), true);
  const prefix = kind === 'education' ? 'CMS_EDUCATION_MULTI_' : 'CMS_INTERNSHIP_MULTI_';
  window.chrome = { runtime: { id: 'fixture-extension', onMessage: {
    addListener: listener => listeners.add(listener), removeListener: listener => listeners.delete(listener),
    hasListener: listener => listeners.has(listener), hasListeners: () => listeners.size > 0
  }, sendMessage: async message => {
    assert.equal(message.type, `${prefix}SOURCE_CHECK`);
    calls.source++;
    await source?.(window, message);
    return { ok: true };
  } } };
  window.eval(await readFile('src/content/cms-record-controller.js', 'utf8'));
  window.installResumeCmsRecordController(kind);
  const controllerName = kind === 'education' ? 'ResumeCmsEducationMulti' : 'ResumeCmsInternshipMulti';
  const controller = window[controllerName];
  assert.equal(controller.inspect().ok, true);
  window[controllerName] = { inspect: controller.inspect, run: async (plan, services) => {
    calls.run++;
    await run?.(window, services, calls);
    return settled();
  } };
  window.ResumeCmsSession = { check: async () => {
    calls.session++;
    await session?.(window);
    return { ok: true };
  } };
  const bridgeFile = kind === 'education' ? 'cms-education-multi-bridge.js' : 'cms-internship-bridge.js';
  window.eval(await readFile(`src/content/${bridgeFile}`, 'utf8'));
  assert.equal(listeners.size, 1);
  const captured = { href: window.location.href, timeOrigin: window.performance.timeOrigin, visible: true };
  const before = plain(window.fixtureSnapshot());
  const invoke = (type, document = captured) => new Promise(resolve => {
    [...listeners][0]({ type: prefix + type, requestId: 'fixture-' + type, document, plan: {} },
      { id: window.chrome.runtime.id }, resolve);
  });
  const preserved = () => {
    assert.deepEqual(plain(window.fixtureSnapshot()), before);
    assert.deepEqual(clicks, []);
  };
  return { window, calls, captured, invoke, preserved };
}

for (const kind of ['education', 'internship']) {
  for (const [name, initialUrl, liveUrl] of [
    ['same resume query churn', `${PAGE}?resumeId=fixture-original&lang=1`, `${PAGE}?lang=2&tid=fixture&resumeId=fixture-original#section`],
    ['both resume IDs absent', `${PAGE}?lang=1`, `${PAGE}?lang=2&tid=fixture`]
  ]) {
    test(`${kind} bridge allows ${name} without fixture writes`, async t => {
      const h = await bridgeFixture(t, kind, { initialUrl });
      h.window.history.replaceState(null, '', liveUrl);
      assert.equal((await h.invoke('INSPECT')).ok, true);
      assert.equal((await h.invoke('RUN')).ok, true);
      assert.equal(h.calls.run, 1);
      h.preserved();
    });
  }
  for (const [name, initialUrl, liveUrl] of [
    ['removed resume ID', `${PAGE}?resumeId=fixture-original`, `${PAGE}?lang=2`],
    ['acquired resume ID', `${PAGE}?lang=1`, `${PAGE}?resumeId=fixture-other`],
    ['changed resume ID', `${PAGE}?resumeId=fixture-original`, `${PAGE}?resumeId=fixture-other`]
  ]) {
    test(`${kind} bridge refuses ${name} before inspect or run`, async t => {
      const h = await bridgeFixture(t, kind, { initialUrl });
      h.window.history.replaceState(null, '', liveUrl);
      for (const type of ['INSPECT', 'RUN']) {
        assert.deepEqual(plain(await h.invoke(type)), { ok: false, reason: 'cms_education_document_changed' });
      }
      assert.deepEqual(h.calls, { run: 0, session: 0, source: 0 });
      h.preserved();
    });
  }
  for (const href of [PAGE.replace('wecruit.hotjob.cn', 'example.invalid') + '?resumeId=fixture-original',
    PAGE.replace('resumeOperation.html', 'different.html') + '?resumeId=fixture-original']) {
    test(`${kind} bridge refuses a captured document outside the canonical route: ${new URL(href).pathname}`, async t => {
      const h = await bridgeFixture(t, kind);
      assert.deepEqual(plain(await h.invoke('RUN', { ...h.captured, href })),
        { ok: false, reason: 'cms_education_document_changed' });
      assert.deepEqual(h.calls, { run: 0, session: 0, source: 0 });
      h.preserved();
    });
  }
  test(`${kind} bridge rechecks document identity after asynchronous session check`, async t => {
    const h = await bridgeFixture(t, kind, { session: async window => {
      await Promise.resolve();
      window.history.replaceState(null, '', `${PAGE}?resumeId=fixture-other`);
    } });
    const response = plain(await h.invoke('RUN'));
    assert.equal(response.ok, false);
    assert.equal(response.data.reason, 'cms_education_document_changed');
    assert.equal(response.data.writeStarted, false);
    assert.equal(h.calls.run, 0);
    assert.equal(h.calls.source, 0);
    h.preserved();
  });
  test(`${kind} bridge rechecks document identity after asynchronous source authorization`, async t => {
    const h = await bridgeFixture(t, kind, { source: async window => {
      await Promise.resolve();
      window.history.replaceState(null, '', `${PAGE}?resumeId=fixture-other`);
    }, run: async (_window, services, calls) => {
      // Exercise the exact bridge callback consumed by controller/adapters.
      calls.sourceAuthorized = await services.checkSource(0, 'fixture-source-hash');
    } });
    await h.invoke('RUN');
    assert.equal(h.calls.run, 1);
    assert.equal(h.calls.source, 1);
    assert.equal(h.calls.sourceAuthorized, false);
    h.preserved();
  });
}
