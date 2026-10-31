import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const sources = ['src/core/matcher.js', 'src/content/engine.js'].map(file =>
  readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
const educationQuestions = [['学校名称', 'school'], ['学历', 'degree'], ['专业名称', 'major']];
const questions = {
  education: educationQuestions,
  work: [['公司名称', 'organization'], ['职位名称', 'position']],
  internship: [['实习公司', 'organization'], ['实习岗位', 'position']],
  project: [['项目名称', 'name'], ['项目描述', 'description']],
};
const headings = { education: '教育背景', work: '工作经历', internship: '实习经历', project: '项目经历' };
const collection = kind => kind === 'education' ? 'education' : kind === 'project' ? 'projects' : 'experience';
const factPath = (kind, index, key) => `${collection(kind)}.${index}.${key}`;
function profileFor(kind = 'education', count = 1) {
  const records = Array.from({ length: count }, (_, index) => ({
    ...(kind === 'work' || kind === 'internship' ? { type: kind } : {}),
    ...Object.fromEntries(questions[kind].map(([, key]) => [key, `SYNTHETIC_${key.toUpperCase()}_${index}`])),
  }));
  return { schemaVersion: 1, [collection(kind)]: records,
    confirmedFields: records.flatMap((record, index) => Object.keys(record)
      .filter(key => key !== 'type').map(key => factPath(kind, index, key))) };
}

function field(kind, index, [question, key], style = 'standard') {
  const id = `${kind}-${index}-${key}`;
  const value = `SYNTHETIC_${key.toUpperCase()}_${index}`;
  const editor = key === 'degree' ? `<select id="${id}"><option value="">请选择</option>
    <option value="${value}">${value}</option></select>` : key === 'description'
    ? `<textarea id="${id}" placeholder="请输入"></textarea>` : `<input id="${id}" placeholder="请选择">`;
  return style === 'standard' ? `<div class="form-item"><label for="${id}">${question}</label>${editor}</div>`
    : `<div class="question-row"><div class="question-title">${question}</div><div class="answer-column">
      <div class="answer-inner"><div class="dropdown"><label><span class="choice-display-value">邮箱</span>
      ${editor}</label></div></div></div></div>`;
}
const record = (kind, index, entries = questions[kind], style = 'standard') =>
  `<div class="record-content">${entries.map(entry => field(kind, index, entry, style)).join('')}</div>`;
const section = (kind, content, style = 'standard') => style === 'standard'
  ? `<section><h2>${headings[kind]}</h2><div class="record-list">${content}</div></section>`
  : `<div class="record-block"><div class="record-header"><span>${headings[kind]}</span>
    <button type="button">新增</button></div><div class="record-list">${content}</div></div>`;

function boot(t, markup, profile, { onBindingCheck } = {}) {
  const dom = new JSDOM(`<!doctype html><body><form>${markup}<input id="neighbor" value="KEEP">
    <button type="submit">Save</button><button type="button">Edit resume</button>
    <button type="button">Create resume</button></form></body>`, {
    url: 'https://fixture.example.test/resume', pretendToBeVisual: true, runScripts: 'outside-only',
  });
  t.after(() => dom.window.close());
  const w = dom.window, effects = [], network = [], storageWrites = [];
  let listener, bindingChecks = 0;
  w.Element.prototype.getClientRects = () => [{ width: 20, height: 20 }];
  w.fetch = async (...args) => { network.push(args); throw Error('fixture_network_forbidden'); };
  w.XMLHttpRequest.prototype.send = function (...args) {
    network.push(args); throw Error('fixture_network_forbidden');
  };
  w.chrome = { storage: { local: {
    async get() { return {}; }, async set(value) { storageWrites.push(value); throw Error('fixture_storage_write_forbidden'); },
  } }, runtime: { id: 'fixture', onMessage: { addListener(next) { listener = next; } },
    async sendMessage(message) {
      assert.equal(message.type, 'RESUME_PROFILE_BINDING_CHECK');
      await onBindingCheck?.({ window: w, message, count: ++bindingChecks });
      return { allowed: true };
    } } };
  for (const type of ['input', 'change', 'click', 'submit'])
    w.document.addEventListener(type, event => effects.push({ type, target: event.target }), true);
  for (const source of sources) w.eval(source);
  return { w, effects, async request(type) {
    const result = await new Promise(resolve => listener({ type, profile: structuredClone(profile), profileBinding: {} },
      { id: 'fixture' }, resolve));
    assert.equal(result.ok, true, JSON.stringify(result)); return result.data;
  }, safe() {
    assert.equal(w.document.getElementById('neighbor').value, 'KEEP');
    assert.deepEqual(network, []); assert.deepEqual(storageWrites, []);
    assert.equal(effects.some(event => event.type === 'click' || event.type === 'submit'
      || event.target.matches('button') || event.target.id === 'neighbor'), false);
  } };
}

async function verify(h, expected) {
  const inspected = await h.request('RESUME_INSPECT');
  assert.deepEqual(h.effects, []);
  for (const [id, path, value] of expected) {
    const field = inspected.fields.find(row => row.id === id);
    assert.equal(field?.path, path, JSON.stringify(field)); assert.equal(field.reason, 'ready');
    assert.equal(h.w.document.getElementById(id).value, '');
  }
  const result = await h.request('RESUME_FILL');
  for (const [id, path, value] of expected) {
    const field = result.fields.find(row => row.id === id);
    assert.equal(field?.path, path, JSON.stringify(field));
    assert.equal(field.status, 'verified', JSON.stringify(field));
    assert.equal(field.reason, 'readback_matched', JSON.stringify(field));
    assert.equal(h.w.document.getElementById(id).value, value);
  }
  assert.equal(result.fields.filter(row => row.status === 'verified').length, expected.length);
  h.safe(); return result;
}
const expectedFields = (kind, profile, rowEntries) => rowEntries.flatMap((entries, index) => entries.map(([, key]) =>
  [`${kind}-${index}-${key}`, factPath(kind, index, key), profile[collection(kind)][index][key]]));

for (const style of ['standard', 'wrapped']) for (const sourceCount of [1, 2])
  test(`${style} single empty education record binds source index zero with ${sourceCount} source records`, async t => {
    const profile = profileFor('education', sourceCount);
    const h = boot(t, section('education', record('education', 0, educationQuestions, style), style), profile);
    await verify(h, expectedFields('education', profile, [educationQuestions]));
  });

for (const entry of educationQuestions) test(`a sole ${entry[1]} editor in one education record does not require the other questions`, async t => {
  const profile = profileFor('education', 2), entries = [entry];
  const h = boot(t, section('education', record('education', 0, entries)), profile);
  await verify(h, expectedFields('education', profile, [entries]));
});

for (const style of ['standard', 'wrapped']) test(`${style} education records keep their indices when the middle record lacks major`, async t => {
  const profile = profileFor('education', 3), entries = [educationQuestions, educationQuestions.slice(0, 2), educationQuestions];
  const markup = section('education', entries.map((row, index) => record('education', index, row, style)).join(''), style);
  await verify(boot(t, markup, profile), expectedFields('education', profile, entries));
});

for (const kind of ['work', 'internship', 'project']) test(`${kind} records bind the Nth source fact and verify writes`, async t => {
  const profile = profileFor(kind, 2), entries = [questions[kind], questions[kind]];
  const markup = section(kind, entries.map((row, index) => record(kind, index, row)).join(''));
  await verify(boot(t, markup, profile), expectedFields(kind, profile, entries));
});

test('a work record cannot consume an internship source through an inferred index', async t => {
  const profile = profileFor('work'); profile.experience[0].type = 'internship';
  const h = boot(t, section('work', record('work', 0)), profile);
  for (const type of ['RESUME_INSPECT', 'RESUME_FILL']) {
    const result = await h.request(type);
    for (const [, key] of questions.work) {
      const field = result.fields.find(row => row.id === `work-0-${key}`);
      assert.equal(field.reason, 'section_requires_mapping', JSON.stringify(field));
      if (type === 'RESUME_FILL') assert.equal(field.status, 'skipped');
    }
  }
  assert.deepEqual(h.effects, []); h.safe();
});

test('inferred education indices still require confirmation for each source fact', async t => {
  const profile = profileFor(); profile.confirmedFields = ['education.0.school', 'education.0.major'];
  const h = boot(t, section('education', record('education', 0)), profile);
  const result = await h.request('RESUME_FILL');
  const degree = result.fields.find(row => row.id === 'education-0-degree');
  assert.equal(degree.status, 'skipped'); assert.equal(degree.reason, 'unconfirmed_profile_value');
  assert.equal(h.w.document.getElementById('education-0-degree').value, '');
  assert.equal(result.fields.filter(row => row.status === 'verified').length, 2); h.safe();
});

for (const [name, content] of [
  ['duplicate questions without record boundaries', `<div class="form-item"><label for="first">学校名称</label>
    <label for="second">学校名称</label><input id="first"><input id="second"></div>`],
  ['conflicting questions for one editor', '<label for="first">学校名称</label><label for="first">专业名称</label><input id="first">'],
]) test(`${name} remain manual without writes`, async t => {
  const h = boot(t, section('education', content), profileFor('education', 2));
  for (const type of ['RESUME_INSPECT', 'RESUME_FILL']) {
    const fields = (await h.request(type)).fields.filter(row => ['first', 'second'].includes(row.id));
    assert.ok(fields.length > 0);
    for (const field of fields) {
      assert.equal(field.semanticStatus, 'manual', JSON.stringify(field));
      assert.equal(field.path, undefined, JSON.stringify(field));
      if (type === 'RESUME_FILL') assert.equal(field.status, 'skipped');
    }
  }
  assert.deepEqual(h.effects, []); h.safe();
});

test('inferred record binding cannot cross a nearer unknown section heading', async t => {
  const h = boot(t, `<section><h2>教育背景</h2><section><h3>未识别分区</h3>
    ${record('education', 0)}</section></section>`, profileFor());
  for (const type of ['RESUME_INSPECT', 'RESUME_FILL']) {
    const fields = (await h.request(type)).fields.filter(row => row.id.startsWith('education-'));
    assert.equal(fields.length, 3);
    for (const field of fields) {
      assert.equal(field.semanticStatus, 'manual', JSON.stringify(field)); assert.equal(field.path, undefined);
      if (type === 'RESUME_FILL') assert.equal(field.status, 'skipped');
    }
  }
  assert.deepEqual(h.effects, []); h.safe();
});

test('flat education and work headings cannot share a record scope or cross-bind date fields', async t => {
  const profile = profileFor('education', 2), dates = [['开始时间', 'startDate'], ['结束时间', 'endDate']];
  for (const [index, entry] of profile.education.entries()) {
    Object.assign(entry, { startDate: '2020-01', endDate: '2024-01' });
    profile.confirmedFields.push(`education.${index}.startDate`, `education.${index}.endDate`);
  }
  const work = profileFor('work');
  profile.experience = [{ ...work.experience[0], startDate: '2024-02', endDate: '2025-02' }];
  profile.confirmedFields.push(...work.confirmedFields, 'experience.0.startDate', 'experience.0.endDate');
  const h = boot(t, `<h2>教育背景</h2>${record('education', 0, [...educationQuestions, ...dates])}`
    + `<h2>工作经历</h2>${record('work', 0, [...questions.work, ...dates])}`, profile);
  for (const type of ['RESUME_INSPECT', 'RESUME_FILL']) {
    const fields = (await h.request(type)).fields.filter(row => /^(education|work)-/u.test(row.id));
    assert.equal(fields.length, 9);
    for (const field of fields) {
      assert.equal(field.semanticStatus, 'manual', JSON.stringify(field));
      assert.equal(field.path, undefined, JSON.stringify(field));
      if (type === 'RESUME_FILL') assert.equal(field.status, 'skipped');
      assert.equal(h.w.document.getElementById(field.id).value, '');
    }
  }
  assert.deepEqual(h.effects, []); h.safe();
});

const twoEducationRecords = () => section('education', record('education', 0) + record('education', 1));
function alterRecords(w, mutation) {
  const list = w.document.querySelector('.record-list');
  const first = w.document.getElementById('education-0-school').closest('.record-content');
  if (mutation === 'reorder') list.append(first);
  else if (mutation === 'delete') first.remove();
  else list.insertAdjacentHTML('afterbegin', record('education', 2));
}
function assertInvalidatedFill(h, result, originalEditors, { allowFirstWrite = true } = {}) {
  for (const editor of originalEditors) {
    if (allowFirstWrite && editor.id === 'education-0-school') continue;
    assert.equal(editor.value, '', `${editor.id} was written after its record binding changed`);
  }
  for (const editor of h.w.document.querySelectorAll('[id^="education-2-"]')) assert.equal(editor.value, '');
  const fields = result.fields.filter(row => row.id.startsWith('education-'));
  assert.equal(fields.some(row => row.status === 'verified'), false, JSON.stringify(fields));
  assert.equal(fields.some(row => ['field_changed', 'ambiguous_repeat_group'].includes(row.reason)), true,
    JSON.stringify(fields));
  h.safe();
}

for (const eventType of ['input', 'change']) for (const mutation of ['reorder', 'delete', 'insert'])
  test(`${eventType} that ${mutation}s education records cannot write the next field or borrow another row's readback`, async t => {
    const h = boot(t, twoEducationRecords(), profileFor('education', 3));
    const editors = [...h.w.document.querySelectorAll('[id^="education-"]')];
    let mutated = false;
    h.w.document.getElementById('education-0-school').addEventListener(eventType, () => {
      mutated = true; alterRecords(h.w, mutation);
    }, { once: true });
    const result = await h.request('RESUME_FILL');
    assert.equal(mutated, true, 'the fixture mutation did not run');
    assertInvalidatedFill(h, result, editors);
  });

for (const targetKey of ['school', 'degree'])
  test(`an awaited profile check that reorders records before ${targetKey} cannot use a stale index`, async t => {
    let mutated = false;
    const h = boot(t, twoEducationRecords(), profileFor('education', 2), {
      async onBindingCheck({ window: w }) {
        if (mutated || w.ResumeProfileWriteContext?.activeControl?.id !== `education-0-${targetKey}`) return;
        await Promise.resolve();
        mutated = true; alterRecords(w, 'reorder');
      },
    });
    const editors = [...h.w.document.querySelectorAll('[id^="education-"]')];
    const result = await h.request('RESUME_FILL');
    assert.equal(mutated, true, 'the fixture mutation did not run during a profile check');
    assertInvalidatedFill(h, result, editors, { allowFirstWrite: targetKey === 'degree' });
  });

test('a hidden first record keeps the visible second record at source index one', async t => {
  const profile = profileFor('education', 2);
  const first = record('education', 0).replace('<div class="record-content">', '<div hidden class="record-content">');
  const h = boot(t, section('education', first + record('education', 1)), profile);
  await verify(h, expectedFields('education', profile, [[], educationQuestions]));
  for (const [, key] of educationQuestions) assert.equal(h.w.document.getElementById(`education-0-${key}`).value, '');
  assert.equal(h.effects.some(event => event.target.id.startsWith('education-0-')), false);
});

test('source records beyond existing rows never activate an add-repeat button', async t => {
  const profile = profileFor('education', 3);
  const h = boot(t, section('education', record('education', 0)
    + '<button type="button" data-add-repeat="education">新增</button>'), profile);
  await verify(h, expectedFields('education', profile, [educationQuestions]));
  assert.equal(h.w.document.querySelectorAll('.record-content').length, 1);
});

const twoExplicitEducationRecords = () => section('education', [0, 1].map(index =>
  record('education', index).replace('<div class="record-content">',
    '<div data-repeat-kind="education" class="record-content">')).join(''));

test('the final awaited profile check cannot retain verified results after a record reorder', async t => {
  let mutated = false;
  const h = boot(t, twoEducationRecords(), profileFor('education', 2), {
    async onBindingCheck({ window: w }) {
      if (mutated || w.ResumeProfileWriteContext?.activeControl
        || !w.ResumeProfileWriteContext?.finalRepeatCheck) return;
      await Promise.resolve(); mutated = true; alterRecords(w, 'reorder');
    },
  });
  const result = await h.request('RESUME_FILL');
  assert.equal(mutated, true);
  assert.equal(result.fields.some(row => row.status === 'verified'), false);
  assert.equal(result.fields.filter(row => row.reason === 'field_changed').length, 6);
  h.safe();
});

test('an input event that reorders explicitly marked records invalidates their old indices', async t => {
  const h = boot(t, twoExplicitEducationRecords(), profileFor('education', 2));
  const editors = [...h.w.document.querySelectorAll('[id^="education-"]')];
  let mutated = false;
  h.w.document.getElementById('education-0-school').addEventListener('input', () => {
    mutated = true; alterRecords(h.w, 'reorder');
  }, { once: true });
  const result = await h.request('RESUME_FILL');
  assert.equal(mutated, true);
  assertInvalidatedFill(h, result, editors);
});

test('an awaited profile check cannot use stale indices for explicitly marked records', async t => {
  let mutated = false;
  const h = boot(t, twoExplicitEducationRecords(), profileFor('education', 2), {
    async onBindingCheck({ window: w }) {
      if (mutated || w.ResumeProfileWriteContext?.activeControl?.id !== 'education-0-degree') return;
      await Promise.resolve(); mutated = true; alterRecords(w, 'reorder');
    },
  });
  const editors = [...h.w.document.querySelectorAll('[id^="education-"]')];
  const result = await h.request('RESUME_FILL');
  assert.equal(mutated, true);
  assertInvalidatedFill(h, result, editors);
});

test('an unrecognized first record cannot compress the second education record to source zero', async t => {
  const profile = profileFor('education', 2);
  const h = boot(t, section('education', '<div class="record-content"><div class="form-item">'
    + '<label for="unknown-first">未识别题目</label><input id="unknown-first"></div></div>'
    + record('education', 1)), profile);
  for (const type of ['RESUME_INSPECT', 'RESUME_FILL']) {
    const result = await h.request(type);
    const unknown = result.fields.find(row => row.id === 'unknown-first');
    assert.equal(unknown.semanticStatus, 'manual'); assert.equal(unknown.path, undefined);
    for (const [, key] of educationQuestions) {
      const id = `education-1-${key}`, field = result.fields.find(row => row.id === id);
      assert.notEqual(field.path, `education.0.${key}`, JSON.stringify(field));
      if (field.path === undefined) {
        assert.equal(field.semanticStatus, 'manual', JSON.stringify(field));
        if (type === 'RESUME_FILL') assert.equal(field.status, 'skipped');
        assert.equal(h.w.document.getElementById(id).value, '');
      } else {
        assert.equal(field.path, `education.1.${key}`, JSON.stringify(field));
        if (type === 'RESUME_FILL') {
          assert.equal(field.status, 'verified', JSON.stringify(field));
          assert.equal(h.w.document.getElementById(id).value, profile.education[1][key]);
        }
      }
    }
  }
  assert.equal(h.w.document.getElementById('unknown-first').value, ''); h.safe();
});
