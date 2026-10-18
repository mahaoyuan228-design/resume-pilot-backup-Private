import assert from 'node:assert/strict';
import { awaitCmsPageDocumentFocus, CMS_PAGE_FOCUS_DEFAULTS } from '../src/background/cms-page-focus.mjs';

function mockApi({ hasFocusSequence, visible = true, windowUpdateReject = false } = {}) {
  const log = [];
  let probe = 0;
  const sequence = Array.isArray(hasFocusSequence) ? hasFocusSequence : [true];
  return {
    log,
    api: {
      tabs: {
        async update(id, patch) { log.push(['tabs.update', id, patch]); return { id }; },
        async get(id) { log.push(['tabs.get', id]); return { id, windowId: 9 }; }
      },
      windows: {
        async update(windowId, patch) {
          log.push(['windows.update', windowId, patch]);
          if (windowUpdateReject) throw Error('windows_update_denied');
        }
      },
      scripting: {
        async executeScript({ target, world, func }) {
          log.push(['executeScript', target.tabId, world, typeof func]);
          const hasFocus = sequence[Math.min(probe, sequence.length - 1)];
          probe += 1;
          return [{ frameId: 0, result: { hasFocus, visible, href: 'https://wecruit.hotjob.cn/x', timeOrigin: 1 } }];
        }
      }
    }
  };
}

const focused = mockApi({ hasFocusSequence: [true] });
const got = await awaitCmsPageDocumentFocus(focused.api, 42, { timeoutMs: 500, intervalMs: 10, pause: async () => {} });
assert.equal(got.hasFocus, true);
assert.equal(focused.log.some((row) => row[0] === 'tabs.update'), true);
assert.equal(focused.log.some((row) => row[0] === 'windows.update'), true);

const delayed = mockApi({ hasFocusSequence: [false, false, true] });
let ticks = 0;
const recovered = await awaitCmsPageDocumentFocus(delayed.api, 7, {
  timeoutMs: 1000,
  intervalMs: 1,
  pause: async () => { ticks += 1; }
});
assert.equal(recovered.hasFocus, true);
assert.ok(ticks >= 2);

const deniedWindow = mockApi({ hasFocusSequence: [false, true], windowUpdateReject: true });
const still = await awaitCmsPageDocumentFocus(deniedWindow.api, 3, { timeoutMs: 500, intervalMs: 1, pause: async () => {} });
assert.equal(still.hasFocus, true);

const never = mockApi({ hasFocusSequence: [false, false, false] });
await assert.rejects(
  () => awaitCmsPageDocumentFocus(never.api, 1, { timeoutMs: 30, intervalMs: 5, pause: async () => {} }),
  (error) => error?.message === 'page_unfocused'
);

await assert.rejects(() => awaitCmsPageDocumentFocus({}, 1), /page_unfocused/);
assert.equal(CMS_PAGE_FOCUS_DEFAULTS.timeoutMs, 2000);
assert.equal(CMS_PAGE_FOCUS_DEFAULTS.intervalMs, 100);
console.log(JSON.stringify({ status: 'PASS', cases: ['focused', 'delayed', 'windowDenied', 'timeout', 'badApi'] }));
