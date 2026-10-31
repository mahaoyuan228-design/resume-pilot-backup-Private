import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const values = { allowExplicitValues: true, fullName: 'SYNTHETIC_NAME', mobile: '13800138000', email: 'synthetic@example.test' };
for (const [family, apiName, url] of [
  ['moka', 'ResumeMokaBasic', 'https://app.mokahr.com/resume'],
  ['feishu-atsx', 'ResumeFeishuAtsxBasic', 'https://fixture.jobs.feishu.cn/resume'],
  ['beisen-2022', 'ResumeBeisen2022Basic', 'https://fixture.zhiye.com/resume'],
  ['hotjob-mc', 'ResumeHotjobMcBasic', 'https://fixture.hotjob.cn/SUsynthetic/mc/deliver/operationResumer'],
]) {
  test(`${family}: advisory readiness cannot block visible editable fields or readback`, async t => {
    const fixture = readFileSync(new URL(`./fixtures/${family}-basic-form.html`, import.meta.url), 'utf8');
    const source = readFileSync(new URL(`../src/content/${family}-basic.js`, import.meta.url), 'utf8');
    const dom = new JSDOM(fixture, { url, pretendToBeVisual: true, runScripts: 'outside-only' });
    t.after(() => dom.window.close());
    const { window } = dom, { document } = window;
    window.Element.prototype.getClientRects = () => [{ width: 20, height: 20 }];
    const readiness = { ok: false, status: 'manual', reason: 'form_not_ready', entryAttempted: false, writeAttempted: false };
    window.ResumeFormFlow = { ensure: async options => {
      assert.equal(options.allowEntry, false);
      return readiness;
    } };
    let clicks = 0, nonGets = 0;
    document.addEventListener('click', () => clicks++, true);
    window.fetch = (_url, options = {}) => { if ((options.method || 'GET') !== 'GET') nonGets++; throw Error('unexpected_network'); };
    window.eval(source);
    const result = await window[apiName].fillBasic(values, { restore: false });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.writeAttempted, true);
    for (const [index, expected] of [values.fullName, values.mobile, values.email].entries()) {
      assert.equal(result.results[index].ok, true);
      assert.equal(result.results[index].before, '');
      assert.equal(result.results[index].after, expected);
    }
    if (family !== 'moka') assert.equal(result.advisoryHints[0].reason, 'form_not_ready');
    assert.equal(result.saved, false);
    assert.equal(result.skippedSave, true);
    assert.equal(result.liveSupportClaimed, false);
    assert.equal(clicks, 0);
    assert.equal(nonGets, 0);
  });
}

test('section discovery leaves edit and create controls untouched', async t => {
  const dom = new JSDOM('<button>编辑简历</button><button>新建简历</button>', { url: 'https://fixture.example.test/resume', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  let clicks = 0;
  dom.window.document.addEventListener('click', () => clicks++, true);
  dom.window.eval(readFileSync(new URL('../src/content/gth-section-discovery.js', import.meta.url), 'utf8'));
  const result = await dom.window.ResumeGthSectionDiscovery.discover();
  assert.equal(result.status, 'manual');
  assert.equal(result.entryAttempted, false);
  assert.equal(result.writeAttempted, false);
  assert.equal(clicks, 0);
});

test('Hotjob empty current page is scanned and reported manual without a false write claim', async t => {
  const dom = new JSDOM('<button>新建简历</button>', { url: 'https://fixture.example.test/resume', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  dom.window.eval(readFileSync(new URL('../src/content/hotjob-mc-basic.js', import.meta.url), 'utf8'));
  const result = await dom.window.ResumeHotjobMcBasic.fillBasic(values, { restore: false });
  assert.equal(result.status, 'manual');
  assert.equal(result.writeAttempted, false);
  assert.equal(result.results.length, 3);
  assert.equal(result.results.every(row => row.status === 'manual'), true);
  assert.equal(result.liveSupportClaimed, false);
});
