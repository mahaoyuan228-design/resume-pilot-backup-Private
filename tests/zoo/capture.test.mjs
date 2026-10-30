import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { readCmsSnapshot } from '../../scripts/lib/zoo-cms-read.mjs';
import { scrubText, safeSourceUrl, sanitizeHtml, REPLAY_CSP } from '../../scripts/lib/zoo-sanitize.mjs';
import { getStaticAsset, archiveAssets } from '../../scripts/capture-zoo-cms.mjs';

const sourceUrl = 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';

function syntheticPage() {
  const dom = new JSDOM('<!doctype html><html><head></head><body><span>Fictional Candidate</span>' +
    '<div id="11_1_0"><div class="ant-form-item"><div class="ant-form-item-label"><label>姓名</label></div>' +
    '<input value="Fictional Candidate"></div></div>' +
    '<div id="13_43_0"><div class="ant-form-item"><div class="ant-form-item-label"><label>工作性质</label></div>' +
    '<div class="ant-select"></div></div></div></body></html>');
  const doc = dom.window.document;
  const select = doc.querySelector('.ant-select');
  const link = {};
  const root = { tag: 3, stateNode: link, memoizedState: {
    resumeTpl: [{ setId: '11', infoItemList: [
      { itemId: '11_1', cnName: '姓名', isNeed: 0, fillType: 1, applicantValue: 'must never serialize' },
      { itemId: '13_43', cnName: '工作性质', isNeed: 1, fillType: 4, dataSource: '0/4' }
    ] }], resumeData: { id: 'fictional-resume-id', resumeName: 'fictional-resume-title', email: 'never-copy@example.test' }
  }, memoizedProps: { dataSource: { '0/4': [{ code: 'FT', name: '全职', currentValue: 'must never serialize' }] } } };
  link.current = root;
  const Option = function Option() {};
  Option.isSelectOption = true;
  const component = { tag: 1, memoizedProps: { children: [
    { type: Option, props: { children: '全职', value: 'FT' } },
    { type: Option, props: { children: '实习', value: 'INTERN' } }
  ], resumeId: 'fictional-resume-id' } };
  const host = { tag: 5, stateNode: select };
  root.child = component; component.child = host;
  const staleRoot = { tag: 3, stateNode: link, memoizedState: { resumeTpl: [{ secret: 'stale template' }] } };
  const staleHost = { tag: 5, stateNode: select, return: staleRoot };
  Object.defineProperty(doc.body, '__reactFiber$fixture', { value: staleHost });
  let getterCalls = 0;
  Object.defineProperty(component.memoizedProps, 'saveData', { get() { getterCalls += 1; throw Error('getter called'); } });
  const before = doc.documentElement.outerHTML;
  const result = vm.runInNewContext(`(${readCmsSnapshot.toString()})()`, { document: doc });
  return { dom, result, before, getterCalls };
}

test('MAIN expression uses committed metadata, captures outer wrappers, and leaves DOM unchanged', () => {
  const { dom, result, before, getterCalls } = syntheticPage();
  try {
    assert.equal(dom.window.document.documentElement.outerHTML, before);
    assert.equal(getterCalls, 0);
    assert.equal(result.schema.mainWorld, true);
    assert.equal(result.controls.length, 2);
    assert.deepEqual(Array.from(result.controls, c => c.wrapperId).sort(), ['11_1_0', '13_43_0']);
    const choice = result.controls.find(c => c.wrapperId === '13_43_0');
    assert.deepEqual(Array.from(choice.options, o => o.label), ['全职', '实习']);
    assert.equal(choice.optionsSource, 'committed_react_option_definitions');
    assert.ok(result.privateStrings.includes('Fictional Candidate'));
    assert.ok(result.privateStrings.includes('fictional-resume-id'));
    const metadata = JSON.stringify({ sections: result.sections, controls: result.controls, dictionaries: result.dictionaries });
    for (const forbidden of ['must never serialize', 'never-copy@example.test', 'stale template', 'fictional-resume-id']) {
      assert.equal(metadata.includes(forbidden), false);
    }
    assert.equal(result.sections[0].infoItemList[0].required, true);
    assert.equal(result.sections[0].infoItemList[1].required, false);
    assert.doesNotMatch(readCmsSnapshot.toString(), /\.(?:click|focus|blur|dispatchEvent|setAttribute|fetch|setState|submit)\s*\(/u);
  } finally { dom.window.close(); }
});

test('sanitizer removes personal values and active live-page surfaces before replay', () => {
  const fixture = '<!doctype html><html><head><base href="https://example.test/">' +
    '<meta http-equiv="refresh" content="0;url=https://example.test/save">' +
    '<script src="/pb/js/app.js" onload="send()"></script><script>secretCandidateData()</script>' +
    '<link rel="stylesheet" href="/pb/css/page.css"></head><body><!-- fictional-resume-id -->' +
    '<span title="Fiction &amp; Person">Fiction &amp; Person</span>' +
    '<span>fiction@example.test 13800138000 11010519491231002X fictional-resume-id</span>' +
    '<form action="https://example.test/save" method="post"><input name="name" value="Fiction &amp; Person">' +
    '<input type="hidden" value="fictional-resume-id"><textarea>private biography</textarea>' +
    '<input type="checkbox" value="unknown-private-value" checked><select><option selected>static option label</option></select>' +
    '<span class="ant-radio-checked ant-checkbox-checked ant-calendar-selected-date" aria-checked="true" aria-selected="true">static choice label</span>' +
    '<div class="ant-select-selection-selected-value" title="private selection">private selection</div>' +
    '<button onclick="save()">Save</button></form><a href="https://example.test/resumeId=secret">Link</a>' +
    '<img src="https://example.test/private-face.png"><iframe src="https://example.test/"></iframe>' +
    '<div style="background:url(https://example.test/private-photo.png)"></div></body></html>';
  const assets = [
    { originalUrl: new URL('/pb/js/app.js', sourceUrl).href, path: 'assets/app.js' },
    { originalUrl: new URL('/pb/css/page.css', sourceUrl).href, path: 'assets/page.css' }
  ];
  const html = sanitizeHtml(fixture, { sourceUrl, privateStrings: ['Fiction & Person', 'fictional-resume-id'], assets });
  const dom = new JSDOM(html);
  try {
    const doc = dom.window.document;
    for (const token of ['Fiction & Person', 'fiction@example.test', '13800138000', '11010519491231002X', 'fictional-resume-id', 'private biography', 'private selection']) {
      assert.equal(doc.documentElement.textContent.includes(token), false, token);
      for (const node of doc.querySelectorAll('*')) for (const attr of node.attributes) assert.equal(attr.value.includes(token), false, token);
    }
    assert.equal(doc.querySelectorAll('base,iframe,object,embed,[onclick],[checked],option[selected]').length, 0);
    assert.equal(doc.querySelectorAll('[aria-checked="true"],[aria-selected="true"],.ant-radio-checked,.ant-checkbox-checked,.ant-calendar-selected-date').length, 0);
    assert.equal(doc.querySelector('form').hasAttribute('action'), false);
    assert.equal(doc.querySelector('form').hasAttribute('method'), false);
    assert.equal(doc.querySelector('button').type, 'button');
    assert.equal(doc.querySelector('a').getAttribute('href'), '#');
    assert.equal(doc.querySelector('img').hasAttribute('src'), false);
    for (const input of doc.querySelectorAll('input')) assert.equal(input.getAttribute('value'), '');
    assert.equal(doc.querySelector('link').getAttribute('href'), 'assets/page.css');
    assert.equal(doc.querySelector('meta[http-equiv="Content-Security-Policy"]').content, REPLAY_CSP);
    for (const script of doc.scripts) {
      assert.equal(script.type, 'application/x-zoo-inert'); assert.equal(script.hasAttribute('src'), false); assert.equal(script.textContent, '');
    }
    const replaySanitizedAgain = new JSDOM(sanitizeHtml(html, { sourceUrl, privateStrings: ['Fiction & Person', 'fictional-resume-id'], assets }));
    try {
      assert.equal(replaySanitizedAgain.window.document.body.innerHTML.trim(), doc.body.innerHTML.trim());
      assert.equal(replaySanitizedAgain.window.document.head.innerHTML, doc.head.innerHTML);
    } finally { replaySanitizedAgain.window.close(); }
  } finally { dom.window.close(); }
});

test('text scrubber removes literal, URL encoded, and escaped exact identifiers', () => {
  const token = 'Fictional 身份';
  const unicode = [...token].map(c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`).join('');
  for (const input of [token, encodeURIComponent(token), unicode]) assert.equal(scrubText(input, [token]), '[REDACTED]');
  assert.doesNotMatch(scrubText('person@example.test 13800138000 11010519491231002X ?resumeId=private'), /person@|13800138000|11010519491231002X|=private/u);
});

test('static GET downloader rejects dynamic endpoints and credentials without network access', async () => {
  for (const url of ['http://example.test/app.js', 'https://user:password@example.test/app.js', 'https://example.test/resume/info/edit', 'https://example.test/file.pdf']) {
    await assert.rejects(getStaticAsset(url), /static_get_only/u);
  }
  assert.throws(() => safeSourceUrl('https://user:password@example.test/app.js', sourceUrl), /asset_url_rejected/u);
  assert.equal(safeSourceUrl('https://example.test/app.js?resumeId=private&v=1#fragment', sourceUrl), 'https://example.test/app.js?v=1');
});

test('asset archive follows CSS imports/dependencies with GET and refuses private URLs before download', async () => {
  const requested = [];
  const bodies = new Map([
    ['https://example.test/page.css', '@import "theme.css"; body { background:url("tile.png"); }'],
    ['https://example.test/theme.css', '@font-face { src:url("font.woff2") }'],
    ['https://example.test/tile.png', Buffer.from([0, 1, 2])],
    ['https://example.test/font.woff2', Buffer.from([3, 4, 5])]
  ]);
  const get = async url => { requested.push(url); assert.ok(bodies.has(url)); return { body: Buffer.from(bodies.get(url)), status: 200, mimeType: url.endsWith('.css') ? 'text/css' : 'application/octet-stream' }; };
  const assets = await archiveAssets([{ url: 'https://example.test/page.css' }], [], () => {}, get);
  assert.equal(assets.length, 4);
  assert.equal(requested.length, 4);
  assert.equal(assets.every(a => a.method === 'GET' && a.body && a.sha256 && a.bytes), true);
  const css = assets.filter(a => a.mimeType === 'text/css').map(a => a.body.toString()).join('\n');
  assert.doesNotMatch(css, /https?:\/\//u);
  for (const extension of ['theme.css', 'tile.png', 'font.woff2']) assert.match(css, new RegExp(`[a-f0-9]{12}-${extension.replace('.', '\\.')}`));
  const previousRequests = requested.length;
  await assert.rejects(archiveAssets([{ url: 'https://example.test/photo.png?resumeId=private' }], [], () => {}, get), /private_asset_url/u);
  assert.equal(requested.length, previousRequests);
  await assert.rejects(archiveAssets([{ url: 'https://example.test/page.css' }], [], () => { throw Error('guard_failure'); }, get), /guard_failure/u);
  assert.equal(requested.length, previousRequests);
});
