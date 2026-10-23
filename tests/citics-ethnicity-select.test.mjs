// Offline contract + synthetic Ant Design Vue 1 run for 民族 only (next after 证件类型).
// Flat medium list (6 options) under FLAT_SELECT_MAX_OPTIONS=24; no search input.
// Live may still hit select_search_heavy if careers lists all ~56 or enables showSearch — fail-closed, do not force.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { labels, registerSelectTests } from './citics-select-never-save-helpers.mjs';

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

// Replace occupied alternate/restore smoke with entirely offline empty-only contracts.
registerSelectTests(labels[4]);
