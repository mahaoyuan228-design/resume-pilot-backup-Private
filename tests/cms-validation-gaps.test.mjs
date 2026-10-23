import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(new URL('../src/content/cms-validation-gaps.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('./fixtures/cms-ant-form-synthetic.html', import.meta.url), 'utf8');
const page = 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';
const safeMessage = vm.runInNewContext(`(() => {
  ${source.slice(source.indexOf('const clean ='), source.indexOf('const visible ='))}
  ${source.slice(source.indexOf('function safeMessage('), source.indexOf('function empty('))}
  return safeMessage;
})()`);
const empty = vm.runInNewContext(`(${source.slice(source.indexOf('function empty('), source.indexOf('function scan('))})`);

function fixture(url = page) {
  const dom = new JSDOM(html, { url, pretendToBeVisual: true, runScripts: 'dangerously' });
  dom.window.Element.prototype.getClientRects = () => [{ width: 8, height: 8 }];
  dom.window.eval(source);
  return dom;
}

test('validation messages echo exact generic prompts and redact answer-bearing or oversized errors', () => {
  const question = '评价内容';
  for (const prefix of ['请选择', '请填写', '请输入', '请上传', '请正确填写']) {
    assert.equal(safeMessage(`${prefix}${question}`, question), `${prefix}${question}`);
  }
  for (const message of ['该项不能为空', '此项不能为空', '请至少选择一项']) {
    assert.equal(safeMessage(message, question), message);
  }
  assert.equal(safeMessage('  请填写评价内容  ', question), '请填写评价内容');
  for (const message of ['', '已填写私密答案', '请填写评价内容：私密答案', '请填写姓名', `请填写${'长'.repeat(171)}`]) {
    assert.equal(safeMessage(message, question), '网站提示需检查此项');
  }
  assert.equal(safeMessage(`请填写${'长'.repeat(171)}`, '长'.repeat(171)), '网站提示需检查此项');
});

test('existing CMS text/date/self-evaluation fixture fields use presence without returning values', () => {
  const dom = fixture();
  try {
    for (const id of ['basic-name', 'basic-id', 'basic-phone', 'basic-email', 'basic-birth', 'self-evaluation', 'education-major']) {
      const control = dom.window.document.getElementById(id);
      const item = control.closest('.ant-form-item');
      assert.equal(empty(item), true, id);
      control.value = 'private synthetic value';
      assert.equal(empty(item), false, id);
      control.value = '   ';
      assert.equal(empty(item), false, 'presence does not trim away an occupied field');
      control.value = '';
      assert.equal(empty(item), true, id);
    }
  } finally { dom.window.close(); }
});

test('existing CMS checkbox fixture checks the whole group without clicking an option', () => {
  const dom = fixture();
  try {
    const group = dom.window.document.getElementById('industry-options');
    const item = group.closest('.ant-form-item');
    const choices = group.querySelectorAll('input');
    assert.equal(choices.length, 32);
    assert.equal(empty(item), true);
    choices[31].checked = true;
    assert.equal(empty(item), false);
    choices[31].checked = false;
    assert.equal(empty(item), true);
    assert.equal(dom.window.syntheticCmsFixture.snapshot().unsupportedEvents, 0);
  } finally { dom.window.close(); }
});

test('existing CMS upload fixture recognizes a file without selecting or uploading it', () => {
  const dom = fixture();
  try {
    const input = dom.window.document.getElementById('basic-photo');
    const item = input.closest('.ant-form-item');
    assert.equal(empty(item), true);
    // jsdom cannot select files; represent FileList presence on the proven input.
    Object.defineProperty(input, 'files', { configurable: true, value: [new dom.window.File(['offline'], 'synthetic.txt')] });
    assert.equal(empty(item), false);
    Object.defineProperty(input, 'files', { configurable: true, value: [] });
    assert.equal(empty(item), true);
    assert.equal(dom.window.syntheticCmsFixture.snapshot().unsupportedEvents, 0);
  } finally { dom.window.close(); }
});

test('validation scan on the existing no-error fixture is read-only and never claims success for a field', () => {
  const dom = fixture();
  try {
    const { window } = dom;
    const events = [];
    for (const type of ['click', 'submit', 'input', 'change', 'blur']) {
      window.document.addEventListener(type, () => events.push(type), true);
    }
    window.document.getElementById('basic-name').value = 'private synthetic name';
    const before = window.document.body.innerHTML;
    const snapshot = window.syntheticCmsFixture.snapshot();
    for (let index = 0; index < 2; index += 1) {
      const result = window.ResumeCmsValidationGaps.scan();
      assert.equal(JSON.stringify(result), '{"total":0,"items":[]}');
      assert.equal(JSON.stringify(result).includes('private'), false);
      assert.equal(Object.hasOwn(result, 'liveSupportClaimed'), false);
    }
    assert.equal(window.document.body.innerHTML, before);
    assert.deepEqual(window.syntheticCmsFixture.snapshot(), snapshot);
    assert.deepEqual(events, []);
  } finally { dom.window.close(); }
});

for (const url of [page.replace('https:', 'http:'), page.replace('wecruit.hotjob.cn', 'example.test'), page.replace('resumeOperation.html', 'other.html')]) {
  test(`validation scan refuses a page outside the CMS resume route: ${new URL(url).origin}${new URL(url).pathname}`, () => {
    const dom = fixture(url);
    try {
      // Reject the route before even looking for error elements.
      dom.window.document.querySelectorAll = () => { throw Error('DOM must not be scanned'); };
      assert.equal(JSON.stringify(dom.window.ResumeCmsValidationGaps.scan()), '{"total":0,"items":[]}');
    } finally { dom.window.close(); }
  });
}

// No error-state markup is present in the checked-in CMS fixtures. Positive
// error-item collection, hint selectors, upload thumbnails, and scan truncation
// require captured evidence before adding DOM-shaped tests for those branches.
