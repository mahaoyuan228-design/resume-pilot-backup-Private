// Offline: region Escape must hit typeless text inputs (DOM.type==='text'),
// same contract as cms-select-default-input / cms-select-escape-surfaces.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const target = resolve('src/content/cms-education-multi-region.js');
const source = (await readFile(target, 'utf8')).replace(/\r\n/gu, '\n');
const sha = createHash('sha256').update(source).digest('hex');
assert.equal(sha, 'fba1009b4aae93a8401095d886d5abaa611ca7bc3c0ce63d509de20ee209ac64');

test('region closeOwn enumerates HTMLInputElement type===text, not attribute selector only', () => {
  assert.match(
    source,
    /surfaces=\[selection,\.\.\.\[\.\.\.ownedSelect\.querySelectorAll\('input'\)\]\.filter\(n=>n instanceof HTMLInputElement&&n\.type==='text'&&visible\(n\)\)\]/
  );
  assert.doesNotMatch(source, /querySelectorAll\('input\[type="text"\]'\)/);
  assert.doesNotMatch(source, /querySelectorAll\("input\[type='text'\]"\)/);
  assert.match(source, /keyCode:27/);
  assert.match(source, /which:27/);
});

console.log(JSON.stringify({ status: 'PASS', sourceSHA256: sha, evidence: 'static region Escape surface contract' }));
