// Offline contract + synthetic Ant Design Vue 1 run for 民族 only (next after 证件类型).
// Flat medium list (6 options) under FLAT_SELECT_MAX_OPTIONS=24; no search input.
// Live may still hit select_search_heavy if careers lists all ~56 or enables showSearch — fail-closed, do not force.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve('.');
const source = readFileSync(resolve(root, 'src/content/citics-basic.js'), 'utf8');

test('ethnicity select source stays on allowlist and off CMS/GTH', () => {
  assert.match(source, /const ETHNICITY = '民族'/);
  assert.match(source, /\[ETHNICITY\]:\s*\{\s*key:\s*'ethnicity'/);
  assert.match(source, /alternates:\s*\['汉族',\s*'回族',\s*'满族',\s*'蒙古族',\s*'藏族',\s*'维吾尔族'\]/);
  assert.match(source, /FLAT_SELECT_MAX_OPTIONS\s*=\s*24/);
  assert.match(source, /select_search_heavy/);
  assert.match(source, /dropdownSearchHeavy/);
  // Cascader / nation stay out of SELECT_SPECS knives (do not collide ethnicity with 国籍).
  assert.doesNotMatch(source, /籍贯|生源地|国籍/);
  assert.doesNotMatch(source, /key:\s*'nation'/);
  assert.doesNotMatch(source, /fillSelect\(\s*['"]民族['"]/);
  assert.doesNotMatch(source, /cms-|gth-/);
  assert.match(source, /label_not_allowed/);
  assert.match(source, /select_structure_unexpected/);
  assert.match(source, /select_option_selector_missing/);
  assert.match(source, /select_readback_missing/);
});

test('harness rejects cascader/nation labels before CDP', () => {
  const run = spawnSync(process.execPath, ['scripts/auto-citics-basic.mjs', '--only', '国籍'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10000
  });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /民族|证件类型|户口类型|婚姻状况|政治面貌/);
});

test('synthetic harness fill-without-save readback for 民族', { timeout: 120000 }, () => {
  const run = spawnSync(process.execPath, ['scripts/auto-citics-basic.mjs', '--only', '民族', '--synthetic'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 90000
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const evidence = JSON.parse(readFileSync(resolve(root, 'dist/auto-runs/citics-ant-select-民族-latest.json'), 'utf8'));
  assert.equal(evidence.siteId, 'citics');
  assert.equal(evidence.label, '民族');
  assert.equal(evidence.ok, true);
  assert.equal(evidence.before, '汉族');
  assert.equal(evidence.after, '回族');
  assert.equal(evidence.expected, '回族');
  assert.equal(evidence.final, '汉族');
  assert.equal(evidence.saved, false);
  assert.equal(evidence.skippedSave, true);
  assert.equal(evidence.skippedYidun, true);
  assert.equal(evidence.liveEdge, false);
  assert.equal(evidence.commitClicks, 0);
  assert.equal(evidence.neighborsUnchanged, true);
  assert.ok(Array.isArray(evidence.selectors));
  assert.equal(evidence.selectors.find(row => row.selector === '.ant-select-dropdown-menu-item[role=option]')?.hit, 6);
  assert.equal(evidence.selectors.find(row => row.selector === '.ant-select-item-option')?.hit, 0);
  assert.equal(evidence.structure?.optionSelector, '.ant-select-dropdown-menu-item[role=option]');
  assert.ok(evidence.checks.every(check => check.ok === true));
  assert.ok(!evidence.reason || evidence.reason !== 'select_search_heavy');
});
