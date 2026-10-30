import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  testDir: here,
  testMatch: ['legacy.spec.mjs', 'l1.spec.mjs', 'extended.spec.mjs', 'write-route.spec.mjs', 'batchb.spec.mjs', 'upload.spec.mjs', 'dates.spec.mjs', 'time.spec.mjs', 'date-range.spec.mjs', 'tree-select.spec.mjs', 'switch.spec.mjs', 'slider.spec.mjs', 'rate.spec.mjs', 'transfer.spec.mjs', 'har.spec.mjs', 'input-mask.spec.mjs'],
  timeout: 90000,
  expect: { timeout: 10000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  outputDir: path.resolve(here, '../../test-results/zoo'),
});
