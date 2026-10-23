import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {JSDOM} from 'jsdom';
import {harvestSelects, mountHarvestSelectFixture} from './fixtures/cms-education-harvest-selects.mjs';

const PAGE = 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';
const sources = await Promise.all(['cms-record-controller.js', 'cms-education-multi-school.js', 'cms-education-multi-select.js'].map(name => readFile(new URL(`../src/content/${name}`, import.meta.url), 'utf8')));
const plain = value => JSON.parse(JSON.stringify(value));

function setup(t) {
  const dom = new JSDOM('', {url: PAGE, runScripts: 'dangerously', pretendToBeVisual: true});
  t.after(() => dom.window.close());
  const {window} = dom;
  window.Element.prototype.getClientRects = function () {
    if (!this.isConnected) return [];
    for (let node = this; node instanceof window.Element; node = node.parentElement) {
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return [];
    }
    return [{}];
  };
  Object.defineProperty(window.document, 'visibilityState', {get: () => 'visible'});
  const schedule = window.setTimeout.bind(window); window.setTimeout = callback => schedule(callback, 0);
  let time = 0;
  window.performance.now = () => (time += 100);
  window.Date.now = () => (time += 100);
  const fixture = mountHarvestSelectFixture(window);
  const clicks = [];
  const click = window.HTMLElement.prototype.click;
  window.HTMLElement.prototype.click = function () {
    assert.ok(this.matches('.ant-select-selection,.ant-select-dropdown-menu-item[role="option"]'), 'only harvested selection/option surfaces may be clicked');
    assert.ok(this.isConnected);
    clicks.push(this);
    return click.call(this);
  };
  window.document.execCommand = () => { throw Error('opened exact catalog must not request a synthetic trusted search'); };
  for (const source of sources) window.eval(source);
  window.installResumeCmsRecordController('education');
  const api = window.ResumeCmsEducationMulti;
  const state = api.inspect(); assert.equal(state.ok, true);
  const identity = state.records[0].identity, form = state.form;
  const locate = question => api.locateField(form, identity, question);
  const snapshot = () => [...form.querySelectorAll('input,textarea,.ant-select-selection-selected-value')].map(node => [node.tagName, node.value ?? node.textContent, node.title]);
  const binding = question => ({question, confirmed: true, rowIdentity: identity, replaceExisting: true});
  return {window, api, fixture, clicks, identity, form, locate, snapshot, binding};
}

test('harvest wrappers, labels, hidden manual-school duplicate and two-select city locate without inferred IDs', t => {
  const h = setup(t);
  const record = plain(h.api.inspect().records[0]);
  assert.deepEqual(record.fields.map(field => [field.key, field.kind]), [
    ['school','select'], ['degree','select'], ['academicDegree','select'], ['major','text'],
    ['startDate','date'], ['endDate','date'], ['region','region'], ['gradeRank','select'], ['description','text']
  ]);
  assert.deepEqual(JSON.parse(record.identity), ['14_102301_0','14_248_0','14_49_0','14_50_0','14_51513929_0','14_51_0','14_52_0','14_53_0','14_55_0']);
  const school = h.locate('学校');
  assert.equal(school.selections.length, 1);
  assert.equal(school.item.closest('[id]').id, '14_51_0');
  assert.equal(h.form.querySelectorAll('[id="14_51_0"] .ant-form-item').length, 2);
  assert.equal(h.form.querySelector('[id="14_51_0"] input.ant-input').value, 'fixture-school-code');
  const region = h.locate('城市'); assert.equal(region.kind, 'region'); assert.equal(region.selections.length, 2);
  assert.ok(region.selections[0].closest('.cascader-plugins-wrap'));
  assert.deepEqual(h.clicks, []);
  assert.equal(harvestSelects.materialRoot.includes('cms-edu-controls-materials'), true);
});

for (const [question, desired] of [['学历','硕士研究生'], ['学位','硕士'], ['专业排名','前10%']]) {
  test(`harvest ${question} catalog selection and exact display restoration leave neighboring values untouched`, async t => {
    const h = setup(t), before = h.snapshot(), original = h.locate(question).value[0];
    const run = optionText => h.window.ResumeCmsMultiSelect.fillSelect(h.locate(question), {optionText}, h.binding(question), {form: h.form, locate: () => h.locate(question)});
    const filled = await run(desired); assert.equal(filled.status, 'verified', JSON.stringify(filled));
    assert.deepEqual(plain(h.locate(question).value), [desired]);
    const restored = await run(original); assert.equal(restored.status, 'verified', JSON.stringify(restored));
    assert.deepEqual(h.snapshot(), before);
    assert.equal(h.fixture.counts.selections, 2); assert.equal(h.fixture.counts.opens, 2);
    assert.equal(h.fixture.counts.searches, 0);
    assert.equal(h.window.document.querySelectorAll('.ant-select-dropdown,.ant-select-open').length, 0);
  });
}

test('school harvest exact catalog LI can fill an offline blank row without trusted search', async t => {
  const h = setup(t), field = h.locate('学校'), display = field.selections[0].querySelector('.ant-select-selection-selected-value');
  display.textContent = ''; display.title = '';
  const result = await h.window.ResumeCmsMultiSchoolSearch.fillSchool(field.selections[0], '虚构示例大学', '虚构示例大学', h.binding('学校'));
  assert.equal(result.status, 'verified', JSON.stringify(result));
  assert.equal(result.reason, 'readback_matched');
  assert.deepEqual(plain(h.locate('学校').value), ['虚构示例大学']);
  assert.equal(h.fixture.counts.searches, 0);
  assert.equal(h.fixture.counts.opens, 1); assert.equal(h.fixture.counts.selections, 1);
  assert.equal(h.window.document.querySelectorAll('.ant-select-dropdown,.ant-select-open').length, 0);
});

for (const stage of ['before_open','before_candidate']) {
  test(`school preserves a native answer changed ${stage} during ownership checks`, async t => {
    const h = setup(t), field = h.locate('学校'), display = field.selections[0].querySelector('.ant-select-selection-selected-value');
    display.textContent = ''; display.title = '';
    let checks = 0;
    h.window.ResumeProfileWriteContext = {async check() {
      if (++checks === (stage === 'before_open' ? 1 : 2)) { display.textContent = '虚构用户新学校'; display.title = display.textContent; }
    }};
    const result = await h.window.ResumeCmsMultiSchoolSearch.fillSchool(field.selections[0], '虚构示例大学', '虚构示例大学', h.binding('学校'));
    assert.equal(result.status, 'failed', JSON.stringify(result));
    assert.equal(result.reason, 'unexpected_value');
    assert.equal(display.textContent, '虚构用户新学校');
    assert.equal(h.fixture.counts.selections, 0); assert.equal(h.fixture.counts.searches, 0);
    assert.equal(h.window.document.querySelectorAll('.ant-select-dropdown,.ant-select-open').length, 0);
  });
}

test('same harvested school display returns without opening or searching', async t => {
  const h = setup(t), before = h.snapshot();
  const result = await h.window.ResumeCmsMultiSchoolSearch.fillSchool(h.locate('学校').selections[0], '虚构示例大学', '虚构示例大学', h.binding('学校'));
  assert.equal(result.status, 'verified'); assert.equal(result.reason, 'preexisting_same_value');
  assert.deepEqual(h.snapshot(), before); assert.deepEqual(h.clicks, []);
});
