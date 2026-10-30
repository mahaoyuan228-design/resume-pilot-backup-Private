// Audit only saved files; private source identifiers stay in memory and are never printed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const REAL = path.join(HERE, 'real');
const textExtensions = new Set(['.html', '.json', '.js', '.mjs', '.css', '.txt', '.md', '.svg']);
const piiPatterns = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu,
  /(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/gu,
  /(?<![\dA-Za-z])\d{17}[\dXx](?![\dA-Za-z])/gu,
  /(?:resumeId|candidateId|applicantId)["']?\s*[:=]\s*["'][a-f0-9]{24}["']/giu,
  /[?&](?:resumeId|candidateId|applicantId)=(?!REDACTED(?:[&#\s"']|$))[^&#\s"']+/giu
];

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(filename));
    else if (entry.isFile()) output.push(filename);
  }
  return output;
}

async function knownResumeIdentifiers() {
  // Optional private capture notes exist on the capture machine, but are not needed in CI.
  let notes;
  try { notes = await readFile(path.resolve(ROOT, '../TEST_MATRIX_V2_2026-10-30.md'), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  return [...new Set([...notes.matchAll(/[?&]resumeId=([^&#\s|]+)/giu)].map(match => match[1]))];
}

const sites = (await readdir(REAL, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name);
assert.ok(sites.length > 0, 'saved real-page fixture required');

for (const site of sites) {
  const directory = path.join(REAL, site);

  test(`${site}: saved text has zero personal-data patterns and no known source resume identifiers`, async () => {
    const identifiers = await knownResumeIdentifiers();
    let scanned = 0;
    for (const filename of await walk(directory)) {
      if (!textExtensions.has(path.extname(filename))) continue;
      const text = await readFile(filename, 'utf8');
      const relative = path.relative(directory, filename);
      for (let index = 0; index < piiPatterns.length; index += 1) {
        assert.equal([...text.matchAll(piiPatterns[index])].length, 0, `personal-data pattern ${index + 1} count in ${relative}`);
      }
      assert.equal(identifiers.some(identifier => text.includes(identifier) || text.includes(encodeURIComponent(identifier))), false,
        `known source identifier present in ${relative}`);
      scanned += 1;
    }
    assert.ok(scanned > 0, 'text fixture files required');
  });

  test(`${site}: both saved HTML documents have empty candidate values and inert application surfaces`, async () => {
    for (const entry of ['index.html', 'outerHTML.html']) {
      const dom = new JSDOM(await readFile(path.join(directory, entry), 'utf8'));
      try {
        const doc = dom.window.document;
        assert.ok(doc.querySelectorAll('.ant-form-item').length > 0, 'real form structure must remain');
        assert.equal([...doc.querySelectorAll('input')].filter(input => input.getAttribute('value') !== '').length, 0,
          'candidate input value count');
        assert.equal([...doc.querySelectorAll('textarea,[contenteditable=true]')].filter(node => node.textContent !== '').length, 0,
          'candidate free-text value count');
        assert.equal(doc.querySelectorAll('[checked],option[selected],[aria-checked=true],[aria-selected=true],.ant-radio-checked,.ant-checkbox-checked,.ant-radio-wrapper-checked,.ant-checkbox-wrapper-checked,.ant-select-dropdown-menu-item-selected').length, 0,
          'candidate selection indicator count');
        const selected = '.ant-select-selection-selected-value,.ant-select-selection__choice__content,.ant-cascader-picker-label,.ant-upload-list-item-name';
        assert.equal([...doc.querySelectorAll(selected)].filter(node => node.textContent.trim()).length, 0,
          'candidate selected label count');
        assert.equal([...doc.querySelectorAll('*')].flatMap(node => [...node.attributes]).filter(attr => /^on/iu.test(attr.name)).length, 0,
          'executable event handler count');
        assert.equal(doc.querySelectorAll('base,iframe,object,embed,form[action],form[method],[formaction],input[type=submit],button[type=submit],meta[http-equiv=refresh]').length, 0,
          'navigation or submission surface count');
        assert.equal([...doc.querySelectorAll('script')].filter(script => script.type !== 'application/x-zoo-inert' || script.hasAttribute('src') || script.textContent.trim()).length, 0,
          'executable application script count');
        assert.equal([...doc.querySelectorAll('a[href]')].filter(link => link.getAttribute('href') !== '#').length, 0,
          'outbound anchor count');
        assert.equal(doc.querySelectorAll('img[src],image[href],image[xlink\\:href],audio[src],video[src],source[src]').length, 0,
          'candidate media source count');
        const csp = doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || '';
        for (const directive of ["script-src 'none'", "connect-src 'none'", "form-action 'none'"]) assert.ok(csp.includes(directive), 'inert replay policy required');
      } finally { dom.window.close(); }
    }
  });

  test(`${site}: manifest and MAIN-world schema counts agree without candidate-state payloads`, async () => {
    const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
    const { controls } = JSON.parse(await readFile(path.join(directory, 'controls.json'), 'utf8'));
    const { sections } = JSON.parse(await readFile(path.join(directory, 'infoItemList.json'), 'utf8'));
    const { dictionaries } = JSON.parse(await readFile(path.join(directory, 'dictionaries.json'), 'utf8'));
    const { assets } = JSON.parse(await readFile(path.join(directory, 'assets.json'), 'utf8'));
    assert.equal(manifest.safety.neverSave, true);
    assert.equal(manifest.safety.liveSupportClaimed, false);
    assert.equal(manifest.safety.readOnly, true);
    for (const metric of ['clicks', 'typing', 'controlOpens', 'navigation', 'login', 'submit', 'save']) assert.equal(manifest.safety[metric], 0, metric);
    assert.equal(manifest.traffic.responseToNonGetCount, 0);
    assert.equal(manifest.counts.controls, controls.length);
    assert.equal(manifest.counts.sections, sections.length);
    assert.equal(manifest.counts.infoItems, sections.reduce((count, section) => count + section.infoItemList.length, 0));
    assert.equal(manifest.counts.dictionaries, dictionaries.length);
    assert.equal(manifest.assets.saved, assets.filter(asset => asset.path).length);
    assert.equal(assets.filter(asset => asset.method !== 'GET').length, 0, 'asset non-GET count');
    assert.ok(Number.isFinite(Date.parse(manifest.capturedAt)), 'capture timestamp required');
    assert.ok(Date.parse(manifest.captureFinishedAt) >= Date.parse(manifest.capturedAt), 'capture time interval required');
    const forbiddenKeys = /^(?:privateStrings|resumeData|resumeId|resumeName|candidateId|applicantId|applicantValue|currentValue|saveData|cookies|localStorage|sessionStorage)$/iu;
    const countForbidden = value => {
      if (!value || typeof value !== 'object') return 0;
      return Object.entries(value).reduce((count, [key, child]) => count + Number(forbiddenKeys.test(key)) + countForbidden(child), 0);
    };
    assert.equal(countForbidden({ controls, sections, dictionaries }), 0, 'candidate-state metadata key count');
  });
}
