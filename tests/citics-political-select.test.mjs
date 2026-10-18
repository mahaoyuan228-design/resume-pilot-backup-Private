// Offline contract + synthetic Ant Design Vue 1 run for 政治面貌 only (next after 婚姻状况).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve('.');
const source = readFileSync(resolve(root, 'src/content/citics-basic.js'), 'utf8');

test('political select source stays on allowlist and off CMS/GTH', () => {
  assert.match(source, /const POLITICAL = '政治面貌'/);
  assert.match(source, /\[POLITICAL\]:\s*\{\s*key:\s*'political'/);
  assert.match(source, /const HUKOU_TYPE = '户口类型'/);
  assert.doesNotMatch(source, /籍贯|证件类型|生源地|国籍/);
  // 民族 appears only as neighbor fixture / refuse label strings are harness-side; content must not fill 民族
  assert.doesNotMatch(source, /fillSelect\(\s*['"]民族['"]/);
  assert.doesNotMatch(source, /cms-|gth-/);
  assert.match(source, /label_not_allowed/);
  assert.match(source, /select_structure_unexpected/);
  assert.match(source, /select_option_selector_missing/);
  assert.match(source, /select_readback_missing/);
});

test('harness rejects any label other than allowlist before CDP', () => {
  const run = spawnSync(process.execPath, ['scripts/auto-citics-basic.mjs', '--only', '民族'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10000
  });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /政治面貌|婚姻状况|户口类型/);
});

test('synthetic harness fill-without-save readback for 政治面貌', { timeout: 120000 }, () => {
  const run = spawnSync(process.execPath, ['scripts/auto-citics-basic.mjs', '--only', '政治面貌', '--synthetic'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 90000
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const evidence = JSON.parse(readFileSync(resolve(root, 'dist/auto-runs/citics-ant-select-政治面貌-latest.json'), 'utf8'));
  assert.equal(evidence.siteId, 'citics');
  assert.equal(evidence.label, '政治面貌');
  assert.equal(evidence.ok, true);
  assert.equal(evidence.before, '群众');
  assert.equal(evidence.after, '共青团员');
  assert.equal(evidence.expected, '共青团员');
  assert.equal(evidence.final, '群众');
  assert.equal(evidence.saved, false);
  assert.equal(evidence.skippedSave, true);
  assert.equal(evidence.skippedYidun, true);
  assert.equal(evidence.liveEdge, false);
  assert.equal(evidence.commitClicks, 0);
  assert.equal(evidence.neighborsUnchanged, true);
  assert.ok(Array.isArray(evidence.selectors));
  assert.equal(evidence.selectors.find(row => row.selector === '.ant-select-dropdown-menu-item[role=option]')?.hit, 4);
  assert.equal(evidence.selectors.find(row => row.selector === '.ant-select-item-option')?.hit, 0);
  assert.equal(evidence.structure?.optionSelector, '.ant-select-dropdown-menu-item[role=option]');
  assert.ok(evidence.checks.every(check => check.ok === true));
});
