// Offline: rank/menu Escape must hit typeless text inputs (DOM.type==='text').
// Mirrors cms-select-default-input overlay; no Edge CDP / real site.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const target = resolve('src/content/cms-education-multi-select.js');
const source = await readFile(target, 'utf8');
const sha = createHash('sha256').update(source).digest('hex');
assert.equal(sha, '8dc03eb69c9aed0d90025f94985e7debf3457cc7f51c038f3b90b8b2b5f708fe');

test('close path enumerates HTMLInputElement type===text, not attribute selector only', () => {
  assert.match(
    source,
    /\[\.\.\.select\.querySelectorAll\('input'\)\]\.filter\(n=>n instanceof HTMLInputElement&&n\.type==='text'&&visible\(n\)\)/
  );
  assert.doesNotMatch(
    source,
    /querySelectorAll\('input\[type=text\]'\)/
  );
  assert.match(source, /keyCode:27/);
  assert.match(source, /which:27/);
});

console.log(JSON.stringify({ status: 'PASS', sourceSHA256: sha, evidence: 'static source contract for Escape surfaces' }));
