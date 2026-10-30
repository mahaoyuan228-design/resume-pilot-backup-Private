/**
 * Regression: WHITELIST.productPaths length/set must match build-internal $files
 * and build-paid $productFiles. Prevents silent product-path drift.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parsePsStringArray(scriptText, varName) {
  const re = new RegExp(`\\$${varName} = @\\(([\\s\\S]*?)\\)\\s*\\n`);
  const m = scriptText.match(re);
  if (!m) throw new Error(`$${varName} array not found`);
  return m[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.replace(/^'/, '').replace(/',$/, '').replace(/'$/, ''))
    .filter(Boolean);
}

describe('productPaths ↔ WHITELIST ↔ build allowlists', () => {
  const whitelist = JSON.parse(readFileSync(resolve(root, 'WHITELIST.json'), 'utf8'));
  const productPaths = whitelist.productPaths;

  it('productPaths is a non-empty array with expected count (154 @ v0.1.4.9)', () => {
    assert.ok(Array.isArray(productPaths), 'productPaths must be array');
    assert.equal(productPaths.length, 154, `productPaths length ${productPaths.length} ≠ 154`);
    assert.equal(whitelist.version, '0.1.4.9');
  });

  it('every productPath exists on disk and has no duplicates', () => {
    const seen = new Set();
    for (const rel of productPaths) {
      assert.equal(typeof rel, 'string');
      assert.ok(rel.length > 0);
      assert.equal(seen.has(rel), false, `duplicate productPath: ${rel}`);
      seen.add(rel);
      assert.equal(existsSync(resolve(root, rel)), true, `missing on disk: ${rel}`);
    }
    assert.equal(seen.size, productPaths.length);
  });

  it('productPaths count and set match build-internal.ps1 $files', () => {
    const script = readFileSync(resolve(root, 'scripts/build-internal.ps1'), 'utf8');
    const files = parsePsStringArray(script, 'files');
    assert.equal(files.length, productPaths.length, `build-internal $files ${files.length} ≠ productPaths ${productPaths.length}`);
    assert.deepEqual([...files].sort(), [...productPaths].sort());
    assert.equal(script.includes('src/license/'), false);
  });

  it('productPaths count and set match build-paid.ps1 $productFiles', () => {
    const script = readFileSync(resolve(root, 'scripts/build-paid.ps1'), 'utf8');
    const productFiles = parsePsStringArray(script, 'productFiles');
    assert.equal(productFiles.length, productPaths.length, `build-paid $productFiles ${productFiles.length} ≠ productPaths ${productPaths.length}`);
    assert.deepEqual([...productFiles].sort(), [...productPaths].sort());
  });

  it('SOURCE_INVENTORY frozen-product rows match productPaths length and set', () => {
    const inv = JSON.parse(readFileSync(resolve(root, 'SOURCE_INVENTORY.json'), 'utf8'));
    assert.equal(inv.version, whitelist.version);
    const rows = Array.isArray(inv.inventory) ? inv.inventory : [];
    const marked = rows.filter((row) => row?.kind === 'frozen-product');
    assert.equal(marked.length, productPaths.length, `inventory frozen-product ${marked.length} ≠ ${productPaths.length}`);
    assert.deepEqual(
      marked.map((row) => row.path).sort(),
      [...productPaths].sort(),
    );
  });
});
