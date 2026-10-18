// Offline contract + synthetic Ant Design Vue 1 run for 证件类型 only (next after 户口类型).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve('.');
const source = readFileSync(resolve(root, 'src/content/citics-basic.js'), 'utf8');

test('id-type select source stays on allowlist and off CMS/GTH', () => {
  assert.match(source, /const ID_TYPE = '证件类型'/);
  assert.match(source, /\[ID_TYPE\]:\s*\{\s*key:\s*'idType'/);
  assert.match(source, /alternates:\s*\['身份证',\s*'中国护照',\s*'港澳居民来往内地通行证',\s*'台湾居民来往大陆通行证'\]/);
  assert.match(source, /FLAT_SELECT_MAX_OPTIONS\s*=\s*24/);
  assert.match(source, /select_search_heavy/);
  assert.match(source, /dropdownSearchHeavy/);
  // Cascader / nation stay out of SELECT_SPECS knives (民族 not filled).
  assert.doesNotMatch(source, /籍贯|生源地|国籍/);
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
  assert.match(run.stderr, /证件类型|户口类型|婚姻状况|政治面貌/);
});

test('synthetic harness fill-without-save readback for 证件类型', { timeout: 120000 }, () => {
  const run = spawnSync(process.execPath, ['scripts/auto-citics-basic.mjs', '--only', '证件类型', '--synthetic'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 90000
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const evidence = JSON.parse(readFileSync(resolve(root, 'dist/auto-runs/citics-ant-select-证件类型-latest.json'), 'utf8'));
  assert.equal(evidence.siteId, 'citics');
  assert.equal(evidence.label, '证件类型');
  assert.equal(evidence.ok, true);
  assert.equal(evidence.before, '身份证');
  assert.equal(evidence.after, '中国护照');
  assert.equal(evidence.expected, '中国护照');
  assert.equal(evidence.final, '身份证');
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
