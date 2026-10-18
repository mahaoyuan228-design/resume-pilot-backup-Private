#!/usr/bin/env node
/**
 * Regenerate SOURCE_INVENTORY.json from WHITELIST.productPaths + non-product rows.
 * Usage (repo root):
 *   node scripts/regen-source-inventory.mjs
 * sumsSha256 = SHA-256 of sorted "hex  path\n" lines for frozen-product entries.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const whitelist = JSON.parse(readFileSync(join(root, 'WHITELIST.json'), 'utf8'));
const old = JSON.parse(readFileSync(join(root, 'SOURCE_INVENTORY.json'), 'utf8'));
const version = whitelist.version || old.version || '0.1.4.9';

function sha256File(abs) {
  return createHash('sha256').update(readFileSync(abs)).digest('hex');
}

const productPaths = whitelist.productPaths;
if (!Array.isArray(productPaths) || productPaths.length === 0) {
  throw new Error('WHITELIST.productPaths missing');
}

const productRows = productPaths.map((path) => {
  const abs = join(root, path);
  if (!existsSync(abs)) throw new Error(`missing product file: ${path}`);
  const dig = sha256File(abs);
  return { path, sha256: dig, sourceSha256: dig, kind: 'frozen-product' };
});

const kept = [];
for (const row of old.inventory) {
  if (row.kind === 'frozen-product') continue;
  const abs = join(root, row.path);
  if (!existsSync(abs)) {
    console.warn('keep stale missing non-product:', row.path);
    kept.push(row);
    continue;
  }
  const dig = sha256File(abs);
  kept.push({ path: row.path, sha256: dig, sourceSha256: dig, kind: row.kind });
}

const lines =
  productRows
    .slice()
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .map((r) => `${r.sha256}  ${r.path}`)
    .join('\n') + '\n';
const sumsSha256 = createHash('sha256').update(lines, 'utf8').digest('hex');

const out = {
  version,
  sumsSha256,
  inventory: [...productRows, ...kept],
};
writeFileSync(join(root, 'SOURCE_INVENTORY.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
console.log(
  JSON.stringify(
    {
      version,
      productCount: productRows.length,
      otherCount: kept.length,
      total: out.inventory.length,
      sumsSha256,
    },
    null,
    2,
  ),
);
