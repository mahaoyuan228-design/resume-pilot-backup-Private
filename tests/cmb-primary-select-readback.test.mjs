// The existing fixture supplies synthetic dropdown markup and accepting clicks.
// Only control/list IDs and dictionary rows are harvested CMB evidence. Negative
// side effects below are synthetic guard cases, not a live fill/support claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const fixture = readFileSync(new URL('./fixtures/cmb-basic-form.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../src/content/cmb-basic.js', import.meta.url), 'utf8');
const census = JSON.parse(readFileSync(new URL('../dist/site-probes/cmb-remaining-dom-ids-20261019.json', import.meta.url), 'utf8'));
const synthetic = { synthetic: true };
const primary = [
  ['fillEducationLevel', 'educationLevel', 'resume_educationHistoryList_0_educationLevelCode', 'ED004'],
  ['fillRelationshipType', 'relationshipType', 'resume_familyList_0_relationship', 'RT0002'],
  ['fillRelationshipTypeRow1', 'relationshipTypeRow1', 'resume_familyList_1_relationship', 'RT0003'],
  ['fillAwardLevel', 'awardLevel', 'resume_awardList_0_awardLevel', 'AL005'],
  ['fillEnglishLevel', 'englishLevel', 'resume_skill_0_englishLevel', 'EL006'],
  ['fillChannelType', 'channelType', 'resume_basicInfo_channelType', 'CT002'],
  ['fillInterviewCity', 'interviewCity', 'resume_basicInfo_expectedInterviewCity', 'P00291']
];

function page(t) {
  const dom = new JSDOM(fixture, { url: 'http://127.0.0.1/cmb-basic-form.html', runScripts: 'dangerously' });
  t.after(() => dom.window.close());
  const { document } = dom.window;
  const counts = { options: 0, actions: 0, requests: 0, submits: 0 };
  document.addEventListener('click', event => {
    if (event.target.closest('[role="option"]')) counts.options++;
    if (event.target.closest('button,a,input,[role="button"]')) counts.actions++;
  }, true);
  dom.window.fetch = () => { counts.requests++; throw Error('Unexpected network request'); };
  dom.window.XMLHttpRequest.prototype.open = () => { counts.requests++; throw Error('Unexpected network request'); };
  dom.window.HTMLFormElement.prototype.submit = dom.window.HTMLFormElement.prototype.requestSubmit = () => {
    counts.submits++; throw Error('Unexpected submission');
  };
  dom.window.eval(source);
  return {
    window: dom.window, document, api: dom.window.ResumeCmbBasic, counts,
    navigate: url => dom.reconfigure({ url }),
    root: id => document.getElementById(id),
    safe(result) {
      assert.equal(result.saved, false);
      assert.equal(result.skippedSave, true);
      assert.equal(result.supported, false);
      assert.equal(result.liveSupportClaimed, false);
      assert.equal(counts.actions, 0);
      assert.equal(counts.requests, 0);
      assert.equal(counts.submits, 0);
    }
  };
}

function accept(root, code) {
  const target = root.querySelector(`[role="option"][data-code="${code}"]`);
  for (const option of root.querySelectorAll('[role="option"]'))
    option.setAttribute('aria-selected', String(option === target));
  const shown = root.querySelector('.ant-select-selection-item');
  shown.textContent = target.textContent;
  shown.setAttribute('data-code', code);
}

test('PRIMARY residual control/list IDs are the exact harvested census IDs', () => {
  for (const [, , id] of primary) {
    const field = census.fields.find(row => row.id === id);
    assert.ok(field, id);
    assert.equal(field.ariaControls, `${id}_list`);
    assert.equal(field.role, 'combobox');
    assert.equal(field.type, 'search');
  }
});

for (const [method, , id, code] of primary) {
  test(`${id}: unchanged existing PRIMARY selections remain isolated and repeated fill does not click`, async t => {
    const p = page(t);
    const [, , neighborId, neighborCode] = primary.find(row => row[2] !== id);
    const neighbor = p.root(neighborId);
    accept(neighbor, neighborCode);
    const before = neighbor.outerHTML;
    const result = await p.api[method](code, synthetic);
    assert.equal(result.ok, true);
    assert.equal(result.afterCode, code);
    assert.equal(result.selectId, id);
    assert.equal(Object.hasOwn(result, 'neighborCheck'), false);
    assert.equal(neighbor.outerHTML, before);
    const repeated = await p.api[method](code, synthetic);
    assert.equal(repeated.ok, true);
    assert.equal(repeated.writeAttempted, false);
    assert.equal(p.counts.options, 1);
    p.safe(result);
    p.safe(repeated);
  });

  test(`${id}: target acceptance cannot hide a changed PRIMARY neighboring selection`, async t => {
    const p = page(t);
    const [, , neighborId, neighborCode] = primary.find(row => row[2] !== id);
    const root = p.root(id), neighbor = p.root(neighborId);
    root.querySelector(`[data-code="${code}"]`).addEventListener('click', () => accept(neighbor, neighborCode));
    const result = await p.api[method](code, synthetic);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'neighbor_changed');
    assert.equal(result.writeAttempted, true);
    assert.equal(result.afterCode, code);
    assert.equal(root.querySelector('.ant-select-selection-item').getAttribute('data-code'), code);
    assert.equal(neighbor.querySelector('.ant-select-selection-item').getAttribute('data-code'), neighborCode);
    assert.deepEqual([...result.neighborCheck.changedSelectIds], [neighborId]);
    assert.equal(result.neighborCheck.ok, false);
    assert.equal(result.neighborCheck.reason, 'neighbor_changed');
    assert.equal(p.counts.options, 1);
    p.safe(result);
  });
}

test('a partial existing fixture does not require absent PRIMARY neighboring controls', async t => {
  const p = page(t);
  const [method, , id, code] = primary[5];
  for (const [, , otherId] of primary) if (otherId !== id) p.root(otherId).closest('.ant-form-item').remove();
  const result = await p.api[method](code, synthetic);
  assert.equal(result.ok, true);
  assert.equal(result.afterCode, code);
  assert.equal(p.counts.options, 1);
  p.safe(result);
});

test('a correctly accepted target rerender still reads the current unique select', async t => {
  const p = page(t);
  const [method, , id, code] = primary[5];
  const oldRoot = p.root(id);
  // This listener runs after the fixture has accepted the option click.
  p.document.addEventListener('click', event => {
    if (!event.target.closest(`[id="${id}"] [role="option"]`)) return;
    const item = oldRoot.closest('.ant-form-item');
    item.replaceWith(item.cloneNode(true));
  });
  const result = await p.api[method](code, synthetic);
  assert.notEqual(p.root(id), oldRoot);
  assert.equal(result.ok, true);
  assert.equal(result.afterCode, code);
  assert.equal(p.root(id).querySelector('.ant-select-selection-item').getAttribute('data-code'), code);
  assert.equal(p.counts.options, 1);
  p.safe(result);
});

for (const mode of ['removed', 'replacement', 'added', 'reordered', 'disabled', 'uncommitted_selection', 'list_id', 'aria_controls', 'show_search']) {
  test(`PRIMARY neighboring ${mode} is reported without repairing page state`, async t => {
    const p = page(t);
    const [method, , id, code] = primary[5];
    const [, , neighborId] = primary[1];
    const neighbor = p.root(neighborId);
    p.root(id).querySelector(`[data-code="${code}"]`).addEventListener('click', () => {
      if (mode === 'removed') neighbor.remove();
      if (mode === 'replacement') neighbor.replaceWith(neighbor.cloneNode(true));
      if (mode === 'added') neighbor.after(neighbor.cloneNode(true));
      if (mode === 'reordered') p.document.querySelector('form').append(neighbor.closest('.ant-form-item'));
      if (mode === 'disabled') neighbor.setAttribute('aria-disabled', 'true');
      if (mode === 'uncommitted_selection') neighbor.querySelector('.ant-select-selection-item').textContent = 'private neighbor side effect';
      if (mode === 'list_id') neighbor.querySelector('[role="listbox"]').id = 'changed-existing-list-id';
      if (mode === 'aria_controls') neighbor.setAttribute('aria-controls', 'changed-existing-controls-reference');
      if (mode === 'show_search') neighbor.classList.add('ant-select-show-search');
    });
    const result = await p.api[method](code, synthetic);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'neighbor_changed');
    assert.equal(result.afterCode, code);
    assert.ok(result.neighborCheck.changedSelectIds.includes(neighborId));
    assert.equal(JSON.stringify(result.neighborCheck).includes('private neighbor side effect'), false);
    if (mode === 'uncommitted_selection')
      assert.equal(neighbor.querySelector('.ant-select-selection-item').textContent, 'private neighbor side effect');
    assert.equal(p.counts.options, 1);
    p.safe(result);
  });
}

for (const phase of ['immediate_then_reverted', 'settled']) {
  test(`PRIMARY neighbor isolation checks ${phase} changes`, async t => {
    const p = page(t);
    const [method, , id, code] = primary[5];
    const [, , neighborId, neighborCode] = primary[1];
    const neighbor = p.root(neighborId), initial = neighbor.innerHTML;
    p.root(id).querySelector(`[data-code="${code}"]`).addEventListener('click', () => {
      if (phase === 'settled') p.window.setTimeout(() => accept(neighbor, neighborCode), 10);
      else {
        accept(neighbor, neighborCode);
        p.window.setTimeout(() => { neighbor.innerHTML = initial; }, 10);
      }
    });
    const result = await p.api[method](code, synthetic);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'neighbor_changed');
    assert.ok(result.neighborCheck.changedSelectIds.includes(neighborId));
    assert.equal(result.afterCode, code);
    assert.equal(p.counts.options, 1);
    p.safe(result);
  });
}

test('fillBasic preserves isolation failure and leaves later requested PRIMARY fields not run', async t => {
  const p = page(t);
  const [, firstPath, firstId, firstCode] = primary[0];
  const [, , neighborId] = primary[5];
  // A different existing channel row is the synthetic side effect. The later
  // requested channel must not click over it and hide the isolation failure.
  p.root(firstId).querySelector(`[data-code="${firstCode}"]`).addEventListener('click', () => accept(p.root(neighborId), 'CT0014'));
  const result = await p.api.fillBasic({
    allowExplicitValues: true, fullName: 'CMB fixture person', mobile: '13800138000', email: 'cmb.fixture@example.com',
    ...Object.fromEntries(primary.map(([, path, , code]) => [path, code])), birthDate: '2000-01-01'
  }, synthetic);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'neighbor_changed');
  const first = result.results.find(row => row.path === firstPath);
  assert.equal(first.reason, 'neighbor_changed');
  assert.equal(first.afterCode, firstCode);
  assert.equal(first.writeAttempted, true);
  for (const [, path, id] of primary.slice(1)) {
    const row = result.results.find(row => row.path === path);
    assert.equal(row.selectId, id);
    assert.equal(row.ok, false);
    assert.equal(row.reason, 'not_run');
    assert.equal(row.blockedBy, 'neighbor_changed');
    assert.equal(row.writeAttempted, false);
    assert.equal(row.liveSupportClaimed, false);
  }
  const birth = result.results.find(row => row.path === 'birthDate');
  assert.equal(birth.reason, 'not_run');
  assert.equal(birth.writeAttempted, false);
  assert.equal(p.root(neighborId).querySelector('.ant-select-selection-item').getAttribute('data-code'), 'CT0014');
  assert.equal(p.counts.options, 1);
  p.safe(result);
});

test('PRIMARY fills recheck the page after an accepted click and stop later requested writes', async t => {
  const p = page(t);
  const [, firstPath, firstId, firstCode] = primary[0];
  p.root(firstId).querySelector(`[data-code="${firstCode}"]`).addEventListener('click', () => p.navigate('https://example.invalid/center/resume'));
  const result = await p.api.fillBasic({
    allowExplicitValues: true, fullName: 'CMB fixture person', mobile: '13800138000', email: 'cmb.fixture@example.com',
    educationLevel: firstCode, channelType: 'CT002', birthDate: '2000-01-01'
  }, synthetic);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'wrong_page');
  assert.equal(result.results.find(row => row.path === firstPath).reason, 'wrong_page');
  for (const path of ['channelType', 'birthDate']) {
    const row = result.results.find(row => row.path === path);
    assert.equal(row.reason, 'not_run');
    assert.equal(row.blockedBy, 'wrong_page');
    assert.equal(row.writeAttempted, false);
  }
  assert.equal(p.root('resume_basicInfo_channelType').querySelector('.ant-select-selection-item').textContent, '');
  assert.equal(p.counts.options, 1);
  p.safe(result);
});
