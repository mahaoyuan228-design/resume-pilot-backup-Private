import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readGthLivePreflight, assessGthLivePreflight } from '../scripts/lib/gth-live-preflight.mjs';

function fixture() {
  const dom = new JSDOM('<!doctype html><body><input value="PRIVATE-TEST-VALUE"></body>', {
    url: 'https://hr.gtht.com/resume/edit/', pretendToBeVisual: true, runScripts: 'outside-only',
  });
  Object.defineProperty(dom.window.document, 'readyState', { configurable: true, get: () => 'complete' });
  return dom;
}
function probe(window) { return window.eval('(' + readGthLivePreflight.toString() + ')()'); }
function hide(window) {
  Object.defineProperty(window.Document.prototype, 'visibilityState', { configurable: true, get: () => 'hidden' });
  Object.defineProperty(window.Document.prototype, 'hidden', { configurable: true, get: () => true });
}

test('a clean visible GTH page passes without reading form values', () => {
  const dom = fixture();
  try {
    const result = probe(dom.window);
    assert.deepEqual(assessGthLivePreflight(result), { ok: true, reason: null });
    assert.equal(JSON.stringify(result).includes('PRIVATE-TEST-VALUE'), false);
  } finally { dom.window.close(); }
});

test('reproduces the captured legacy override: reported visible, native hidden', () => {
  const dom = fixture();
  try {
    const w = dom.window;
    hide(w);
    Object.defineProperty(w.document, 'visibilityState', { configurable: true, get: () => 'visible' });
    Object.defineProperty(w.document, 'hidden', { configurable: true, get: () => false });
    const result = probe(w);
    assert.equal(result.reportedVisibility, 'visible');
    assert.equal(result.nativeVisibility, 'hidden');
    assert.equal(result.nativeHidden, true);
    assert.equal(assessGthLivePreflight(result).reason, 'visibility_override_detected');
    // The probe reports the override; it never removes it or changes visibility.
    assert.equal(w.document.visibilityState, 'visible');
  } finally { dom.window.close(); }
});

test('a hidden page without overrides stops before any writer is dispatched', () => {
  const dom = fixture();
  try {
    hide(dom.window);
    const decision = assessGthLivePreflight(probe(dom.window));
    let writes = 0;
    if (decision.ok) writes++;
    assert.equal(decision.reason, 'page_hidden');
    assert.equal(writes, 0);
  } finally { dom.window.close(); }
});

test('an override is rejected even if it currently agrees with native visibility', () => {
  const dom = fixture();
  try {
    Object.defineProperty(dom.window.document, 'visibilityState', { configurable: true, get: () => 'visible' });
    assert.equal(assessGthLivePreflight(probe(dom.window)).reason, 'visibility_override_detected');
  } finally { dom.window.close(); }
});

test('missing or throwing native getters fail closed', () => {
  for (const throwing of [false, true]) {
    const dom = fixture();
    try {
      if (throwing) Object.defineProperty(dom.window.Document.prototype, 'visibilityState', {
        configurable: true, get() { throw Error('unavailable'); },
      });
      else delete dom.window.Document.prototype.visibilityState;
      assert.equal(assessGthLivePreflight(probe(dom.window)).reason, 'native_visibility_unavailable');
    } finally { dom.window.close(); }
  }
});

test('the exact GTH URL and complete document remain required', () => {
  const dom = fixture();
  try {
    const clean = probe(dom.window);
    for (const href of ['https://example.com/resume/edit/', 'https://hr.gtht.com/resume/edit/?x=1']) {
      assert.equal(assessGthLivePreflight({ ...clean, href }).reason, 'wrong_page');
    }
    assert.equal(assessGthLivePreflight({ ...clean, readyState: 'loading' }).reason, 'page_not_ready');
  } finally { dom.window.close(); }
});
