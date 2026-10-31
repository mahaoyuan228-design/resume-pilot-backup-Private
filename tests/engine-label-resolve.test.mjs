import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const sources = ['src/core/matcher.js', 'src/content/engine.js'].map(path =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const profile = {
  fullName: 'SYNTHETIC_NAME', email: 'synthetic@example.test',
  education: [{ school: 'SYNTHETIC_SCHOOL', major: 'SYNTHETIC_MAJOR' }],
  experience: [{ type: 'internship', organization: 'SYNTHETIC_ORGANIZATION', position: 'SYNTHETIC_POSITION' }],
  confirmedFields: ['fullName', 'email', 'education.0.school', 'education.0.major',
    'experience.0.organization', 'experience.0.position'],
};

function boot(t, markup) {
  const dom = new JSDOM(`<!doctype html><body>${markup}</body>`, {
    url: 'https://fixture.example.test/resume', pretendToBeVisual: true, runScripts: 'outside-only',
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  window.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  let listener, storageWrites = 0;
  const effects = { input: 0, change: 0, click: 0, submit: 0 };
  for (const type of Object.keys(effects)) window.document.addEventListener(type, () => { effects[type]++; }, true);
  window.chrome = { storage: { local: {
    async get() { return {}; }, async set() { storageWrites++; },
  } }, runtime: { id: 'fixture', onMessage: { addListener(value) { listener = value; } },
    async sendMessage(message) {
      assert.equal(message.type, 'RESUME_PROFILE_BINDING_CHECK');
      return { allowed: true };
    } } };
  for (const source of sources) window.eval(source);
  return { window, effects, get storageWrites() { return storageWrites; }, async request(type) {
    const reply = await new Promise(resolve => listener({ type, profile, profileBinding: {} }, { id: 'fixture' }, resolve));
    assert.equal(reply.ok, true, reply.error);
    return reply.data;
  } };
}

const formItems = [
  ['Ant', '<div class="ant-form-item"><div class="ant-form-item-label"><label>姓名</label></div><div class="ant-form-item-control"><input id="target" placeholder="请选择" aria-label="邮箱"></div></div>'],
  ['Element', '<div class="el-form-item"><label class="el-form-item__label">姓名</label><div class="el-form-item__content"><input id="target" placeholder="请输入" aria-label="邮箱"></div></div>'],
  ['iView', '<div class="ivu-form-item"><label class="ivu-form-item-label">姓名</label><div class="ivu-form-item-content"><input id="target" placeholder="请填写" aria-label="邮箱"></div></div>'],
  ['generic', '<div class="form-item"><div class="form-item-label">姓名</div><div class="form-item-control"><input id="target" placeholder="邮箱" aria-label="邮箱"></div></div>'],
  ['generic label', '<div class="form-item"><label>姓名</label><div><input id="target" placeholder="请选择姓名" aria-label="邮箱"></div></div>'],
];
for (const [name, markup] of formItems) test(`${name} form-item question wins over lower-priority hints`, async t => {
  const h = boot(t, `<form>${markup}</form>`);
  const field = (await h.request('RESUME_INSPECT')).fields.find(row => row.id === 'target');
  assert.deepEqual([...field.labels], ['姓名']);
  assert.equal(field.path, 'fullName');
  assert.equal(field.reason, 'ready');
  const filled = (await h.request('RESUME_FILL')).fields.find(row => row.id === 'target');
  assert.equal(filled.status, 'verified');
  assert.equal(h.window.document.getElementById('target').value, profile.fullName);
  assert.equal(h.effects.click, 0); assert.equal(h.effects.submit, 0); assert.equal(h.storageWrites, 0);
});

for (const [name, markup, label, path] of [
  ['explicit for', '<label for="target">邮箱</label><input id="target" aria-labelledby="other" aria-label="姓名"><span id="other">姓名</span>', '邮箱', 'email'],
  ['implicit label', '<label>姓名<input id="target" aria-label="邮箱"></label>', '姓名', 'fullName'],
  ['aria-labelledby', '<span id="question">姓名</span><input id="target" aria-labelledby="question" aria-label="邮箱">', '姓名', 'fullName'],
  ['aria-label', '<input id="target" aria-label="姓名" placeholder="邮箱">', '姓名', 'fullName'],
  ['preceding sibling element', '<div><span>姓名</span><input id="target" placeholder="请选择"></div>', '姓名', 'fullName'],
  ['preceding sibling text', '<div>姓名<input id="target" placeholder="请输入"></div>', '姓名', 'fullName'],
  ['single-field legend', '<fieldset><legend>邮箱</legend><div><input id="target" placeholder="请填写"></div></fieldset>', '邮箱', 'email'],
  ['single-field section heading', '<section><h2>邮箱</h2><div><input id="target" placeholder="请选择"></div></section>', '邮箱', 'email'],
]) test(`${name} supplies the first usable real question`, async t => {
  const h = boot(t, `<form>${markup}</form>`);
  const inspected = (await h.request('RESUME_INSPECT')).fields.find(row => row.id === 'target');
  assert.deepEqual([...inspected.labels], [label]);
  assert.equal(inspected.path, path); assert.equal(inspected.reason, 'ready');
  const filled = (await h.request('RESUME_FILL')).fields.find(row => row.id === 'target');
  assert.equal(filled.status, 'verified');
  assert.equal(h.window.document.getElementById('target').value, profile[path]);
  assert.equal(h.effects.click, 0); assert.equal(h.effects.submit, 0);
});

for (const [name, markup] of [
  ['placeholder attribute naming a known fact', '<input id="target" placeholder="姓名">'],
  ['title attribute naming a known fact', '<input id="target" title="姓名">'],
  ['select prompt as a label', '<label for="target">请选择</label><input id="target" placeholder="姓名">'],
  ['input prompt as a label', '<label for="target">请输入姓名</label><input id="target">'],
  ['fill prompt as a label', '<div class="form-item"><div class="form-item-label">请填写邮箱</div><input id="target"></div>'],
  ['required decorated prompt', '<div class="form-item"><div class="form-item-label">＊ 请选择</div><input id="target"></div>'],
  ['unknown question with a known placeholder', '<label>未识别题目<input id="target" placeholder="姓名"></label>'],
]) test(`${name} stays manual without writing`, async t => {
  const h = boot(t, `<form>${markup}</form>`);
  for (const type of ['RESUME_INSPECT', 'RESUME_FILL']) {
    const field = (await h.request(type)).fields.find(row => row.id === 'target');
    assert.equal(field.semanticStatus, 'manual');
    assert.equal(field.path, undefined);
    if (type === 'RESUME_FILL') assert.equal(field.status, 'skipped');
  }
  assert.equal(h.window.document.getElementById('target').value, '');
  assert.deepEqual(h.effects, { input: 0, change: 0, click: 0, submit: 0 });
});

test('nested form items use their own questions without borrowing the parent question', async t => {
  const h = boot(t, `<form><div class="form-item"><div class="form-item-label">邮箱</div>
    <div class="form-item"><div class="form-item-label">姓名</div><input id="target" placeholder="请选择"></div>
    </div></form>`);
  const field = (await h.request('RESUME_INSPECT')).fields.find(row => row.id === 'target');
  assert.deepEqual([...field.labels], ['姓名']); assert.equal(field.path, 'fullName');
  assert.equal(field.reason, 'ready');
});

test('an unlabelled nested form item cannot borrow a parent form-item question', async t => {
  const h = boot(t, '<form><div class="form-item"><div class="form-item-label">姓名</div><div class="form-item"><input id="target" placeholder="姓名"></div></div></form>');
  for (const type of ['RESUME_INSPECT', 'RESUME_FILL']) {
    const field = (await h.request(type)).fields.find(row => row.id === 'target');
    assert.equal(field.semanticStatus, 'manual'); assert.equal(field.path, undefined);
    if (type === 'RESUME_FILL') assert.equal(field.status, 'skipped');
  }
  assert.equal(h.window.document.getElementById('target').value, '');
  assert.deepEqual(h.effects, { input: 0, change: 0, click: 0, submit: 0 });
});

test('unassociated shared form-item and section questions cannot label several independent editors', async t => {
  const h = boot(t, `<form><section><h2>邮箱</h2><div class="form-item"><div class="form-item-label">姓名</div>
    <input id="first" placeholder="请选择"><input id="second" placeholder="请输入"></div></section></form>`);
  for (const type of ['RESUME_INSPECT', 'RESUME_FILL']) {
    const fields = (await h.request(type)).fields.filter(row => ['first', 'second'].includes(row.id));
    assert.equal(fields.length, 2);
    for (const field of fields) {
      assert.equal(field.semanticStatus, 'manual'); assert.equal(field.path, undefined);
      if (type === 'RESUME_FILL') assert.equal(field.status, 'skipped');
    }
  }
  assert.deepEqual(h.effects, { input: 0, change: 0, click: 0, submit: 0 });
});

for (const [section, question, path] of [
  ['教育经历', '学校', 'education.0.school'], ['实习经历', '实习公司', 'experience.0.organization'],
]) test(`${section} heading supplies context while missing record index remains manual`, async t => {
  const h = boot(t, `<form><section><h2>${section}</h2><div class="form-item"><div class="form-item-label">${question}</div><input id="target" placeholder="请选择"></div></section></form>`);
  const field = (await h.request('RESUME_INSPECT')).fields.find(row => row.id === 'target');
  assert.deepEqual([...field.labels], [question]);
  assert.equal(field.reason, 'ambiguous_repeat_group'); assert.equal(field.semanticStatus, 'manual');
  assert.notEqual(field.path, path);
  const filled = (await h.request('RESUME_FILL')).fields.find(row => row.id === 'target');
  assert.equal(filled.status, 'skipped'); assert.equal(h.window.document.getElementById('target').value, '');
});

for (const [kind, section, question, path, expected] of [
  ['education', '教育经历', '学校', 'education.0.school', profile.education[0].school],
  ['internship', '实习经历', '实习公司', 'experience.0.organization', profile.experience[0].organization],
]) test(`${section} preserves the existing synonym and explicit record mapping`, async t => {
  const h = boot(t, `<form><fieldset data-repeat-kind="${kind}"><legend>${section}</legend><div class="form-item"><div class="form-item-label">${question}</div><input id="target" placeholder="请选择"></div></fieldset></form>`);
  const field = (await h.request('RESUME_INSPECT')).fields.find(row => row.id === 'target');
  assert.equal(field.path, path); assert.equal(field.reason, 'ready');
  const filled = (await h.request('RESUME_FILL')).fields.find(row => row.id === 'target');
  assert.equal(filled.status, 'verified'); assert.equal(h.window.document.getElementById('target').value, expected);
  assert.equal(h.effects.click, 0); assert.equal(h.effects.submit, 0);
});

test('conflicting labels at the same priority remain manual', async t => {
  const h = boot(t, '<form><label for="target">姓名</label><label for="target">邮箱</label><input id="target" placeholder="姓名"></form>');
  for (const type of ['RESUME_INSPECT', 'RESUME_FILL']) {
    const field = (await h.request(type)).fields.find(row => row.id === 'target');
    assert.equal(field.semanticStatus, 'manual'); assert.equal(field.reason, 'ambiguous_label');
    if (type === 'RESUME_FILL') assert.equal(field.status, 'skipped');
  }
  assert.equal(h.window.document.getElementById('target').value, '');
  assert.deepEqual(h.effects, { input: 0, change: 0, click: 0, submit: 0 });
});

test('a placeholder-like form-item label falls through to a real associated label', async t => {
  const h = boot(t, '<form><div class="form-item"><div class="form-item-label">请选择</div><label for="target">邮箱</label><input id="target" placeholder="姓名"></div></form>');
  const field = (await h.request('RESUME_INSPECT')).fields.find(row => row.id === 'target');
  assert.deepEqual([...field.labels], ['邮箱']); assert.equal(field.path, 'email'); assert.equal(field.reason, 'ready');
});

test('a required decorated prompt falls through to the real accessible question', async t => {
  const h = boot(t, '<form><div class="form-item"><div class="form-item-label">* 请选择</div><input id="target" aria-label="姓名"></div></form>');
  const field = (await h.request('RESUME_INSPECT')).fields.find(row => row.id === 'target');
  assert.deepEqual([...field.labels], ['姓名']); assert.equal(field.path, 'fullName'); assert.equal(field.reason, 'ready');
});

for (const cls of ['section', 'form-section']) test(`${cls} div title supplies a question without treating it as a section restriction`, async t => {
  const h = boot(t, `<form><div class="${cls}"><div class="section-title"><h2>邮箱</h2></div><div><input id="target"></div></div></form>`);
  const field = (await h.request('RESUME_INSPECT')).fields.find(row => row.id === 'target');
  assert.deepEqual([...field.labels], ['邮箱']); assert.equal(field.path, 'email'); assert.equal(field.reason, 'ready');
});

test('an unknown div section cannot consume an unrelated confirmed personal fact', async t => {
  const h = boot(t, '<form><div class="section"><h2>家庭情况</h2><label>姓名<input id="target"></label></div></form>');
  for (const type of ['RESUME_INSPECT', 'RESUME_FILL']) {
    const field = (await h.request(type)).fields.find(row => row.id === 'target');
    assert.equal(field.reason, 'section_unconfirmed'); assert.equal(field.semanticStatus, 'manual'); assert.equal(field.path, undefined);
    if (type === 'RESUME_FILL') assert.equal(field.status, 'skipped');
  }
  assert.deepEqual(h.effects, { input: 0, change: 0, click: 0, submit: 0 });
});

for (const [name, display] of [['empty wrapper label', ''], ['selected display inside wrapper label', '<span class="choice-display-value">邮箱</span>']])
  test(`${name} resolves a real question across nested answer wrappers`, async t => {
    const h = boot(t, `<form><div class="question-row"><div class="question-caption">姓名</div><div class="answer-column"><div class="answer-inner"><label>${display}<input id="target" placeholder="请选择"></label></div></div></div></form>`);
    const field = (await h.request('RESUME_INSPECT')).fields.find(row => row.id === 'target');
    assert.deepEqual([...field.labels], ['姓名']); assert.equal(field.path, 'fullName'); assert.equal(field.reason, 'ready');
    const filled = (await h.request('RESUME_FILL')).fields.find(row => row.id === 'target');
    assert.equal(filled.status, 'verified'); assert.equal(h.window.document.getElementById('target').value, profile.fullName);
    assert.equal(h.effects.click, 0); assert.equal(h.effects.submit, 0);
  });

test('selected display text inside a wrapper label is never the question', async t => {
  const h = boot(t, '<form><div class="answer-column"><label><span class="choice-selected-value">邮箱</span><input id="target" placeholder="请选择"></label></div></form>');
  for (const type of ['RESUME_INSPECT', 'RESUME_FILL']) {
    const field = (await h.request(type)).fields.find(row => row.id === 'target');
    assert.deepEqual([...field.labels], []); assert.equal(field.semanticStatus, 'manual'); assert.equal(field.path, undefined);
    if (type === 'RESUME_FILL') assert.equal(field.status, 'skipped');
  }
  assert.deepEqual(h.effects, { input: 0, change: 0, click: 0, submit: 0 });
});

test('a shared date question cannot label several editors across nested wrappers', async t => {
  const h = boot(t, '<form><div class="question-row"><div class="question-caption">出生日期</div><div class="answer-column"><div class="answer-inner"><label><input id="year" placeholder="请选择年份"><input id="month" placeholder="请选择月份"></label></div></div></div></form>');
  for (const type of ['RESUME_INSPECT', 'RESUME_FILL']) {
    const fields = (await h.request(type)).fields.filter(row => ['year', 'month'].includes(row.id));
    assert.equal(fields.length, 2);
    for (const field of fields) {
      assert.deepEqual([...field.labels], []); assert.equal(field.semanticStatus, 'manual'); assert.equal(field.path, undefined);
      if (type === 'RESUME_FILL') assert.equal(field.status, 'skipped');
    }
  }
  assert.deepEqual(h.effects, { input: 0, change: 0, click: 0, submit: 0 });
});

test('a preceding selected-display sibling is never a question', async t => {
  const h = boot(t, '<form><div><span class="choice-display-value">邮箱</span><input id="target" placeholder="请选择"></div></form>');
  for (const type of ['RESUME_INSPECT', 'RESUME_FILL']) {
    const field = (await h.request(type)).fields.find(row => row.id === 'target');
    assert.deepEqual([...field.labels], []); assert.equal(field.semanticStatus, 'manual'); assert.equal(field.path, undefined);
    if (type === 'RESUME_FILL') assert.equal(field.status, 'skipped');
  }
  assert.deepEqual(h.effects, { input: 0, change: 0, click: 0, submit: 0 });
});

for (const [name, answer] of [
  ['associated answer label', '<label for="target">邮箱</label><input id="target">'],
  ['wrapping answer label', '<label>邮箱<input id="target"></label>'],
]) test(`a dedicated form-item question outranks an ${name}`, async t => {
  const h = boot(t, `<form><div class="form-item"><div class="form-item-label">姓名</div><div class="answer-column">${answer}</div></div></form>`);
  const field = (await h.request('RESUME_INSPECT')).fields.find(row => row.id === 'target');
  assert.deepEqual([...field.labels], ['姓名']); assert.equal(field.path, 'fullName'); assert.equal(field.reason, 'ready');
  const filled = (await h.request('RESUME_FILL')).fields.find(row => row.id === 'target');
  assert.equal(filled.status, 'verified'); assert.equal(h.window.document.getElementById('target').value, profile.fullName);
  assert.equal(h.effects.click, 0); assert.equal(h.effects.submit, 0);
});
