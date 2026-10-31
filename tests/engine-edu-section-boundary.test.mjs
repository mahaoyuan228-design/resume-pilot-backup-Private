import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const sources = ['src/core/matcher.js', 'src/content/engine.js'].map(path =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const profile = {
  education: [{ school: 'SYNTHETIC_SCHOOL', degree: 'SYNTHETIC_DEGREE', major: 'SYNTHETIC_MAJOR' }],
  confirmedFields: ['education.0.school', 'education.0.degree', 'education.0.major'],
};
const questions = [['学校', 'school'], ['学历', 'degree'], ['专业', 'major']];
const rows = (entries = questions) => entries.map(([question, key]) =>
  `<div class="question-row"><div>${question}</div><div class="answer-column"><input id="${key}" placeholder="请选择"></div></div>`).join('');

function boot(t, markup) {
  const dom = new JSDOM(`<!doctype html><body><form>${markup}</form></body>`, {
    url: 'https://fixture.example.test/resume', pretendToBeVisual: true, runScripts: 'outside-only',
  });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.Element.prototype.getClientRects = () => [{ width: 10, height: 10 }];
  let listener, events = 0, assignments = 0, requests = 0, storageWrites = 0;
  for (const type of ['input', 'change', 'click', 'submit', 'pointerdown', 'keydown', 'blur'])
    w.document.addEventListener(type, () => { events++; }, true);
  const value = Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value');
  Object.defineProperty(w.HTMLInputElement.prototype, 'value', { ...value, set(next) {
    assignments++; value.set.call(this, next);
  } });
  w.fetch = () => { requests++; throw Error('fixture_network_forbidden'); };
  w.chrome = { storage: { local: {
    async get() { return {}; }, async set() { storageWrites++; throw Error('fixture_storage_write_forbidden'); },
  } }, runtime: { id: 'fixture', onMessage: { addListener(next) { listener = next; } },
    async sendMessage(message) {
      assert.equal(message.type, 'RESUME_PROFILE_BINDING_CHECK');
      return { allowed: true };
    } } };
  for (const source of sources) w.eval(source);
  return { w, async request(type) {
    const reply = await new Promise(resolve => listener({ type, profile, profileBinding: {} }, { id: 'fixture' }, resolve));
    assert.equal(reply.ok, true, reply.error);
    return reply.data;
  }, assertNoEffects() {
    assert.deepEqual({ events, assignments, requests, storageWrites }, { events: 0, assignments: 0, requests: 0, storageWrites: 0 });
    for (const [, key] of questions) assert.equal(w.document.getElementById(key).value, '');
  } };
}

for (const [name, unknownHeading] of [
  ['h2', '<h2>家庭情况</h2>'],
  ['ARIA heading', '<div role="heading" aria-level="2">家庭情况</div>'],
]) for (const placement of ['adjacent', 'nested']) {
  test(`plain education inference cannot cross ${placement} unknown ${name}`, async t => {
    const content = `${unknownHeading}<div class="record-content">${rows()}</div>`;
    const markup = `<div class="record-block"><h2>教育背景</h2>${placement === 'nested'
      ? `<div class="other-section">${content}</div>` : `<div></div>${content}`}</div>`;
    const h = boot(t, markup);
    for (const type of ['RESUME_INSPECT', 'RESUME_FILL']) {
      const fields = (await h.request(type)).fields.filter(row => questions.some(([, key]) => row.id === key));
      assert.equal(fields.length, 3);
      for (const [question, key] of questions) {
        const field = fields.find(row => row.id === key);
        assert.deepEqual([...field.labels], [question]);
        assert.equal(field.semanticStatus, 'manual', JSON.stringify(field));
        assert.equal(field.path, undefined, JSON.stringify(field));
        if (type === 'RESUME_FILL') assert.equal(field.status, 'skipped', JSON.stringify(field));
      }
    }
    h.assertNoEffects();
  });
}

for (const nested of [false, true]) test(`${nested ? 'nested' : 'direct'} partial records cannot combine into a single education record`, async t => {
  const records = `
    <div class="record-content">${rows(questions.slice(0, 1))}</div>
    <div class="record-content">${rows(questions.slice(1))}</div>`;
  const h = boot(t, `<div class="record-block"><h2>教育背景</h2>
    ${nested ? `<div class="record-list">${records}</div>` : records}</div>`);
  for (const type of ['RESUME_INSPECT', 'RESUME_FILL']) {
    const fields = (await h.request(type)).fields.filter(row => questions.some(([, key]) => row.id === key));
    assert.equal(fields.length, 3);
    for (const field of fields) {
      assert.equal(field.semanticStatus, 'manual', JSON.stringify(field));
      assert.equal(field.path, undefined, JSON.stringify(field));
      if (type === 'RESUME_FILL') assert.equal(field.status, 'skipped');
    }
  }
  h.assertNoEffects();
});
