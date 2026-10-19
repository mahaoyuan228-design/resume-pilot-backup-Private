#!/usr/bin/env node
// CMB live select click evidence check.
// Measured 10/10 on trial Edge 9237. --check reads the real probe JSON in
// dist/auto-runs. This file does not click 保存 and does not invent readback.
// --only <页面标签> delegates to scripts/auto-cmb-basic.mjs --live (fill-wo-save).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'cmb-live-select-marital-latest.json',
  'cmb-live-select-politics-latest.json',
  'cmb-live-select-ethnicity-latest.json',
  'cmb-live-select-idCardType-latest.json',
  'cmb-live-select-educationLevel-latest.json',
  'cmb-live-select-channelType-latest.json',
  'cmb-live-select-interviewCity-latest.json',
  'cmb-live-select-awardLevel-latest.json',
  'cmb-live-select-relationship-latest.json',
  'cmb-live-select-englishLevel-latest.json'
];

function check() {
  const rows = files.map((name) => {
    const file = path.join(root, 'dist/auto-runs', name);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const probe = data.probe && typeof data.probe === 'object' ? data.probe : {};
    const ok = data.stub !== true
      && data.siteId === 'cmb'
      && data.neverSave === true
      && data.formFillClaimed === false
      && data.liveSelectFillClaimed === true
      && probe.neverSave === true
      && probe.saved === false
      && probe.ok === true
      && typeof probe.selectId === 'string'
      && probe.selectId.length > 0
      && String(probe.href || '').includes('career.cmbchina.com/center/resume');
    return { name, ok, selectId: probe.selectId, stub: data.stub === true };
  });
  const ready = rows.length === 10 && rows.every((row) => row.ok);
  console.log(JSON.stringify({
    event: 'check',
    ready,
    count: rows.length,
    neverSave: true,
    formFillClaimed: false,
    supportedClaimed: false,
    rows
  }, null, 2));
  return ready ? 0 : 2;
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.length === 0 || args.includes('--check')) {
  process.exit(check());
}
const onlyAt = args.indexOf('--only');
if (onlyAt >= 0 && args[onlyAt + 1]) {
  const child = spawnSync(process.execPath, [
    path.join(root, 'scripts/auto-cmb-basic.mjs'),
    '--only',
    args[onlyAt + 1],
    '--live'
  ], { cwd: root, stdio: 'inherit' });
  process.exit(child.status ?? 1);
}
console.error('Use --check, or --only <页面标签> to delegate fill-wo-save. Never Save.');
process.exit(2);
