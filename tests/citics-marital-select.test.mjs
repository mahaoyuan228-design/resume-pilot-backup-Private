// Offline contract + synthetic Ant Design Vue 1 run for 婚姻状况 only.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { labels, registerSelectTests } from './citics-select-never-save-helpers.mjs';

const root = resolve('.');
const source = readFileSync(resolve(root, 'src/content/citics-basic.js'), 'utf8');

test('marital select source stays on allowlist and off CMS/GTH', () => {
  assert.match(source, /const MARITAL = '婚姻状况'/);
  assert.match(source, /const POLITICAL = '政治面貌'/);
  // Flat allowlist: marital + political + hukouType + idType. No cascader/region/nation knives.
  assert.match(source, /const HUKOU_TYPE = '户口类型'/);
  assert.match(source, /const ID_TYPE = '证件类型'/);
  assert.doesNotMatch(source, /籍贯|生源地|国籍/);
  assert.doesNotMatch(source, /fillSelect\(\s*['"]民族['"]/);
  assert.doesNotMatch(source, /cms-|gth-/);
  assert.match(source, /only_marital_select_in_this_slice/);
  assert.match(source, /select_structure_unexpected/);
  assert.match(source, /select_option_selector_missing/);
  assert.match(source, /select_readback_missing/);
});

test('harness rejects any label other than allowlist before CDP', () => {
  const run = spawnSync(process.execPath, ['scripts/auto-citics-basic.mjs', '--only', '国籍'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10000
  });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /婚姻状况|政治面貌|户口类型|证件类型|民族/);
});

// Replace occupied alternate/restore smoke with entirely offline empty-only contracts.
registerSelectTests(labels[0]);
