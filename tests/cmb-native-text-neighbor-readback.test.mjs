// Positive controls and values come from the existing CMB census and live TRY
// artifacts. Neighbor changes below are synthetic negative guard mutations of
// those observed controls; they do not identify the cause of the live churn.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const readJson = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const live = readJson('./fixtures/cmb-native-text-neighbor-readback/live-try-20261023.json');
const cases = [
  ['basic', 'basic_self', 'ResumeCmbBasicNativeText'],
  ['internship', 'internship_content', 'ResumeCmbInternshipNativeText'],
  ['clubs', 'clubs', 'ResumeCmbClubsNativeText']
].map(([name, section, apiName]) => {
  const probe = readJson(`./fixtures/cmb-${name}-native-text-probe-dom.json`);
  const capture = live.captures.find(row => row.section === section);
  const id = capture.fill.fields.find(row => row.reason === 'neighbor_changed').id;
  return {
    name, apiName, probe, capture, id, value: capture.postReadback[id].value,
    source: readFileSync(new URL(`../src/content/cmb-${name}-native-text.js`, import.meta.url), 'utf8')
  };
});
const neighborBefore = 'private neighbor before';
const neighborAfter = 'private neighbor side effect';
const descriptorKeys = ['ariaHidden', 'className', 'id', 'name', 'role', 'tag', 'type'];

function boot(scenario) {
  const dom = new JSDOM('<!doctype html><body></body>', {
    url: scenario.probe.url, pretendToBeVisual: true, runScripts: 'outside-only'
  });
  const { window } = dom, { document } = window;
  Object.defineProperty(document, 'readyState', { configurable: true, value: 'complete' });
  window.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  const counts = { clicks: 0, requests: 0, submits: 0 }, events = [];
  window.HTMLElement.prototype.click = () => { counts.clicks++; throw Error('Unexpected click'); };
  window.HTMLFormElement.prototype.submit = window.HTMLFormElement.prototype.requestSubmit = () => {
    counts.submits++; throw Error('Unexpected submission');
  };
  window.fetch = () => { counts.requests++; throw Error('Unexpected request'); };
  window.XMLHttpRequest.prototype.open = () => { counts.requests++; throw Error('Unexpected request'); };
  for (const field of [...scenario.probe.fields, ...scenario.probe.neighbors]) {
    const node = document.createElement(field.tag);
    for (const [key, attr] of [['id', 'id'], ['name', 'name'], ['type', 'type'],
      ['role', 'role'], ['className', 'class'], ['placeholder', 'placeholder'],
      ['ariaControls', 'aria-controls'], ['ariaLabel', 'aria-label']]) {
      if (field[key] !== null) node.setAttribute(attr, field[key]);
    }
    if (scenario.probe.neighbors.includes(field)) node.value = neighborBefore;
    for (const eventName of ['input', 'change', 'blur'])
      node.addEventListener(eventName, () => events.push([node.id, eventName]));
    document.body.append(node);
  }
  window.eval(scenario.source);
  return {
    dom, window, document, counts, events, api: window[scenario.apiName],
    node: id => document.getElementById(id)
  };
}

function safe(result, p) {
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.supportClaimed, false);
  assert.equal(result.complete, false);
  assert.equal(result.neverSave, true);
  assert.equal(result.skippedSave, true);
  for (const key of ['softwareClickedSave', 'softwareClickedSubmit', 'softwareClickedDeliver',
    'softwareClickedDelete', 'softwareClickedNext', 'saved', 'submitted']) assert.equal(result[key], false, key);
  assert.deepEqual(p.counts, { clicks: 0, requests: 0, submits: 0 });
}

function diagnostic(result, kind, neighborId) {
  assert.equal(result.neighborCheck.ok, false);
  assert.equal(result.neighborCheck.reason, 'neighbor_changed');
  assert.ok(['native_setter', 'input', 'change', 'blur', 'settled', 'before_write'].includes(result.neighborCheck.phase));
  const changes = result.neighborCheck.changes;
  assert.ok(changes.length > 0);
  const change = changes.find(row => row.kind === kind
    && (row.before?.id === neighborId || row.after?.id === neighborId));
  assert.ok(change, JSON.stringify(changes));
  for (const row of changes) {
    assert.ok(['state_changed', 'removed', 'added', 'reordered'].includes(row.kind));
    assert.ok(Array.isArray(row.changedProperties));
    for (const descriptor of [row.before, row.after]) if (descriptor !== null) {
      assert.deepEqual(Object.keys(descriptor).sort(), descriptorKeys);
      assert.ok(['input', 'select', 'textarea'].includes(descriptor.tag));
    }
  }
  const serialized = JSON.stringify(result.neighborCheck);
  assert.equal(serialized.includes(neighborBefore), false);
  assert.equal(serialized.includes(neighborAfter), false);
  return change;
}

function remainingPlan(scenario, id, value) {
  const nextId = scenario.probe.fields.find(field => field.id !== id).id;
  return { nextId, profile: { values: { [id]: value, [nextId]: 'Confirmed later field' }, confirmedFields: [id, nextId] } };
}

function retained(result, p, id, value) {
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'neighbor_changed');
  assert.equal(result.writeAttempted, true);
  const field = result.fields.find(row => row.id === id);
  assert.equal(field.status, 'verified');
  assert.equal(field.reason, 'readback_matched');
  assert.equal(field.before, '');
  assert.equal(field.after, value);
  assert.equal(field.writeAttempted, true);
  assert.equal(p.node(id).value, value);
  assert.deepEqual(p.events, [[id, 'input']]);
  assert.equal(result.neighborCheck.phase, 'input');
  safe(result, p);
}

for (const scenario of cases) {
  test(`${scenario.name}: regression value and textarea ID are retained from the Never-Save live FAIL`, () => {
    const { capture, id, value, probe } = scenario;
    assert.match(capture.sourceSha256, /^[0-9a-f]{64}$/u);
    assert.equal(capture.cdpPort, 9237);
    assert.equal(capture.pageUrl, probe.url);
    assert.equal(capture.neverSave, true);
    assert.equal(capture.liveSupportClaimed, false);
    assert.equal(capture.fill.ok, false);
    assert.equal(capture.fill.reason, 'neighbor_changed');
    assert.equal(capture.fill.fields.find(row => row.id === id).status, 'failed');
    assert.equal(capture.visibility.fields[id].tag, 'textarea');
    assert.equal(probe.fields.find(row => row.id === id).tag, 'textarea');
    assert.equal(capture.postReadback[id].visible, true);
    assert.ok(value.length > 0);
    assert.deepEqual(capture.networkNonGet, []);
  });

  test(`${scenario.name}: unchanged neighbors produce normal verified textarea success`, async () => {
    const p = boot(scenario);
    try {
      const result = await p.api.fillField(scenario.id, scenario.value, { confirmed: true });
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.field.status, 'verified');
      assert.equal(result.field.after, scenario.value);
      assert.equal(Object.hasOwn(result, 'neighborCheck'), false);
      assert.deepEqual(p.events.map(([, name]) => name), ['input', 'change', 'blur']);
      safe(result, p);
    } finally { p.dom.window.close(); }
  });

  test(`${scenario.name}: retained textarea is verified while neighbor isolation still blocks the plan`, async () => {
    const p = boot(scenario);
    try {
      const { id, value } = scenario, neighborId = scenario.probe.neighbors[0].id;
      const { nextId, profile } = remainingPlan(scenario, id, value);
      p.node(id).addEventListener('input', () => { p.node(neighborId).value = neighborAfter; });
      const result = await p.api.fillProfile(profile);
      retained(result, p, id, value);
      const change = diagnostic(result, 'state_changed', neighborId);
      assert.ok(change.changedProperties.includes('value'));
      assert.equal(p.node(neighborId).value, neighborAfter);
      assert.equal(p.node(nextId).value, '');
      assert.equal(result.fields.find(row => row.id === nextId).reason, 'not_run');
      assert.equal(result.fields.find(row => row.id === nextId).writeAttempted, false);
    } finally { p.dom.window.close(); }
  });

  test(`${scenario.name}: neighboring control identity, membership, order and hidden values still block`, async t => {
    for (const mode of ['replacement', 'removed', 'added', 'reordered', 'hidden_value']) {
      await t.test(mode, async () => {
        const p = boot(scenario);
        try {
          const { id, value } = scenario, neighborId = scenario.probe.neighbors[0].id;
          const neighbor = p.node(neighborId), { nextId, profile } = remainingPlan(scenario, id, value);
          if (mode === 'hidden_value') neighbor.hidden = true;
          p.node(id).addEventListener('input', () => {
            if (mode === 'replacement' || mode === 'added') {
              const clone = neighbor.cloneNode(true);
              clone.value = neighbor.value;
              if (mode === 'replacement') neighbor.replaceWith(clone);
              else p.document.body.append(clone);
            } else if (mode === 'removed') neighbor.remove();
            else if (mode === 'reordered') p.document.body.prepend(neighbor);
            else neighbor.value = neighborAfter;
          });
          const result = await p.api.fillProfile(profile);
          retained(result, p, id, value);
          const kind = mode === 'replacement' ? 'removed' : mode === 'hidden_value' ? 'state_changed' : mode;
          diagnostic(result, kind, neighborId);
          if (mode === 'replacement') diagnostic(result, 'added', neighborId);
          assert.equal(p.node(nextId).value, '');
          assert.equal(result.fields.find(row => row.id === nextId).reason, 'not_run');
        } finally { p.dom.window.close(); }
      });
    }
  });

  test(`${scenario.name}: delayed target rejection wins over a neighbor isolation failure`, async t => {
    const modes = {
      reset: 'readback_mismatch', validity: 'site_validation_failed', aria_invalid: 'site_validation_failed',
      replacement: 'target_changed', navigation: 'wrong_page', page_hidden: 'page_hidden',
      disabled: 'target_not_editable', readonly: 'target_not_editable', target_hidden: 'target_hidden'
    };
    for (const [mode, reason] of Object.entries(modes)) {
      await t.test(mode, async () => {
        const p = boot(scenario);
        try {
          const { id, value } = scenario, target = p.node(id), neighborId = scenario.probe.neighbors[0].id;
          const { nextId, profile } = remainingPlan(scenario, id, value);
          target.addEventListener('input', () => {
            p.node(neighborId).value = neighborAfter;
            p.window.setTimeout(() => {
              if (mode === 'reset') target.value = '';
              else if (mode === 'validity') target.setCustomValidity('site rejected');
              else if (mode === 'aria_invalid') target.setAttribute('aria-invalid', 'true');
              else if (mode === 'replacement') {
                const clone = target.cloneNode(true);
                clone.value = value;
                target.replaceWith(clone);
              } else if (mode === 'navigation') p.dom.reconfigure({ url: 'https://career.cmbchina.com/center/other' });
              else if (mode === 'page_hidden')
                Object.defineProperty(p.document, 'visibilityState', { configurable: true, value: 'hidden' });
              else if (mode === 'disabled') target.disabled = true;
              else if (mode === 'readonly') target.readOnly = true;
              else target.hidden = true;
            }, 0);
          });
          const result = await p.api.fillProfile(profile);
          assert.equal(result.ok, false);
          assert.equal(result.reason, reason);
          const field = result.fields.find(row => row.id === id);
          assert.equal(field.status, 'failed');
          assert.equal(field.reason, reason);
          assert.equal(field.writeAttempted, true);
          diagnostic(result, 'state_changed', neighborId);
          assert.equal(p.node(nextId).value, '');
          assert.equal(result.fields.find(row => row.id === nextId).reason, 'not_run');
          assert.deepEqual(p.events, [[id, 'input']]);
          safe(result, p);
        } finally { p.dom.window.close(); }
      });
    }
  });

  test(`${scenario.name}: immediate target readback failure takes precedence over neighbor changes`, async () => {
    const p = boot(scenario);
    try {
      const { id, value } = scenario;
      p.node(id).addEventListener('input', () => {
        p.node(scenario.probe.neighbors[0].id).value = neighborAfter;
        p.node(id).value = '';
      });
      const result = await p.api.fillField(id, value, { confirmed: true });
      assert.equal(result.reason, 'readback_mismatch');
      assert.equal(result.field.status, 'failed');
      assert.equal(Object.hasOwn(result, 'neighborCheck'), false);
      assert.deepEqual(p.events, [[id, 'input']]);
      safe(result, p);
    } finally { p.dom.window.close(); }
  });

  test(`${scenario.name}: single-line native text has the same separate readback and isolation outcome`, async () => {
    const p = boot(scenario);
    try {
      const id = scenario.probe.fields.find(field => field.tag === 'input').id, value = 'Confirmed native text';
      const neighborId = scenario.probe.neighbors[0].id;
      p.node(id).addEventListener('input', () => { p.node(neighborId).value = neighborAfter; });
      const result = await p.api.fillField(id, value, { confirmed: true });
      retained(result, p, id, value);
      diagnostic(result, 'state_changed', neighborId);
    } finally { p.dom.window.close(); }
  });

  test(`${scenario.name}: prewrite neighbor changes cannot recover an unwritten target as verified`, async () => {
    const p = boot(scenario);
    try {
      const { id, value } = scenario, target = p.node(id), neighborId = scenario.probe.neighbors[0].id;
      const accessor = Object.getOwnPropertyDescriptor(p.window.HTMLTextAreaElement.prototype, 'value');
      let reads = 0;
      Object.defineProperty(target, 'value', {
        configurable: true,
        get() {
          if (++reads === 2) p.node(neighborId).value = neighborAfter;
          return accessor.get.call(this);
        },
        set(next) { accessor.set.call(this, next); }
      });
      const result = await p.api.fillField(id, value, { confirmed: true });
      assert.equal(result.reason, 'neighbor_changed');
      assert.equal(result.ok, false);
      assert.equal(result.writeAttempted, false);
      assert.equal(result.field.status, 'failed');
      assert.equal(result.field.reason, 'neighbor_changed');
      assert.equal(result.field.writeAttempted, false);
      assert.equal(target.value, '');
      assert.deepEqual(p.events, []);
      diagnostic(result, 'state_changed', neighborId);
      assert.equal(result.neighborCheck.phase, 'before_write');
      safe(result, p);
    } finally { p.dom.window.close(); }
  });
}
