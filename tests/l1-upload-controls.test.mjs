import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { writeControlInPage } from '../src/background/controls-write.mjs';

const names = ['model', 'registry', 'upload', 'native'];
const sources = names.map(name => readFileSync(new URL(`../src/content/controls/${name}.js`, import.meta.url), 'utf8'));
const json = value => JSON.parse(JSON.stringify(value));
function boot(html = '<input id="target" type="file">') {
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, { url: 'https://offline.example/attachments', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom, effects = { clicks: 0, assignments: 0, events: 0, picker: 0 };
  window.Element.prototype.getClientRects = () => [{ width: 20, height: 20 }];
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'files');
  Object.defineProperty(window.HTMLInputElement.prototype, 'files', { ...descriptor,
    set() { effects.assignments++; throw Error('file_assignment_forbidden'); } });
  const valueDescriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
  Object.defineProperty(window.HTMLInputElement.prototype, 'value', { ...valueDescriptor,
    set(value) {
      if (this.type === 'file') { effects.assignments++; throw Error('file_value_assignment_forbidden'); }
      valueDescriptor.set.call(this, value);
    } });
  window.HTMLInputElement.prototype.showPicker = () => { effects.picker++; throw Error('file_picker_forbidden'); };
  for (const type of ['click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'focus', 'blur', 'input', 'change', 'dragenter', 'dragover', 'drop', 'reset', 'submit']) {
    window.document.addEventListener(type, event => {
      effects[type === 'click' ? 'clicks' : 'events']++; event.preventDefault(); event.stopImmediatePropagation();
    }, true);
  }
  for (const source of sources) window.eval(source);
  return { dom, window, effects, U: window.ResumeUploadControls, R: window.ResumeControls,
    get: id => window.document.getElementById(id), document: window.document };
}
function unchanged(h, before) {
  assert.equal(h.document.body.innerHTML, before);
  assert.deepEqual(h.effects, { clicks: 0, assignments: 0, events: 0, picker: 0 });
  for (const input of h.document.querySelectorAll('input[type="file"]')) {
    assert.equal(input.files.length, 0); assert.equal(input.value, '');
  }
}

test('native file detection and reinjection remain read-only and never claim upload success', async t => {
  const h = boot('<label for="target">Supporting document</label><input id="target" type="file" accept=".pdf,image/*" multiple><input id="neighbor" value="KEEP">');
  t.after(() => h.dom.window.close());
  const before = h.document.body.innerHTML, el = h.get('target');
  assert.equal(h.U.version, 1); assert.equal(h.U.liveSupportClaimed, false);
  const observation = json(h.U.inspect(el));
  assert.equal(observation.status, 'observed');
  assert.equal(observation.kind, 'file-input'); assert.equal(observation.fileInputs, 1);
  assert.deepEqual(observation.selectedFiles, []);
  assert.equal(observation.writeStarted, false); assert.equal(observation.liveSupportClaimed, false);
  const adapter = h.R.resolve(el); assert.equal(adapter.name, 'upload');
  assert.equal(h.R.plan(el, { value: 'synthetic.pdf' }).reason, 'upload_manual');
  assert.equal((await adapter.write(el, { adapter: adapter.name, status: 'planned', value: 'synthetic.pdf' },
    { allowWrite: true, check: async () => {} })).attempts, 0);
  const count = h.R.list().length;
  h.window.eval(sources[2]); h.window.eval(sources[3]);
  assert.equal(h.R.list().length, count);
  unchanged(h, before);
});

test('a hidden input establishes bounded drop-zone ownership without selecting files', t => {
  const h = boot('<div id="target" class="dropzone" role="group"><input id="file" type="file" hidden><input id="display" readonly value="KEEP"><button type="button">Choose file</button></div>');
  t.after(() => h.dom.window.close());
  const before = h.document.body.innerHTML;
  const observation = h.U.inspect(h.get('target'));
  assert.equal(observation.status, 'observed'); assert.equal(observation.kind, 'drop-zone');
  assert.equal(observation.ownership, 'input-backed'); assert.equal(observation.fileInputs, 1);
  assert.equal(h.U.discover().length, 1);
  assert.equal(h.R.resolve(h.get('display')).name, 'upload-surface');
  assert.equal(h.R.plan(h.get('display'), { value: 'replacement' }).status, 'manual');
  unchanged(h, before);
});

test('mixed general groups preserve ordinary answer fields while reporting their file controls separately', t => {
  for (const wrapper of ['fieldset', 'div role="group"']) {
    const tag = wrapper.split(' ')[0];
    const h = boot(`<${wrapper} id="target"><label for="name">Name</label><input id="name"><label for="file">Attachment</label><input id="file" type="file"></${tag}>`);
    t.after(() => h.dom.window.close());
    const before = h.document.body.innerHTML;
    assert.equal(h.R.resolve(h.get('name')).name, 'native-text');
    assert.equal(h.R.plan(h.get('name'), { value: 'Synthetic name' }).status, 'planned');
    assert.equal(h.R.resolve(h.get('file')).name, 'upload');
    assert.equal(h.U.inspect(h.get('file')).kind, 'file-input');
    assert.equal(h.U.inspect(h.get('file')).ownership, 'native');
    assert.equal(h.U.discover().length, 1);
    unchanged(h, before);
  }
});

test('section and preview class names do not turn an unrelated answer into an upload display', t => {
  for (const className of ['attachment-section', 'upload-section', 'attachment-preview', 'upload-preview']) {
    const h = boot(`<div class="${className}"><input id="target" type="file"><label for="answer">Description</label><input id="answer"></div>`);
    t.after(() => h.dom.window.close());
    const before = h.document.body.innerHTML;
    assert.equal(h.R.resolve(h.get('answer')).name, 'native-text', className);
    assert.equal(h.R.plan(h.get('answer'), { value: 'Synthetic description' }).status, 'planned', className);
    assert.equal(h.U.inspect(h.get('target')).ownership, 'native', className);
    assert.equal(h.U.discover().length, 1, className);
    unchanged(h, before);
  }
});

test('reinjection replaces a revision 3 registry and re-registers upload surfaces without stale adapters', t => {
  const h = boot('<div class="upload-control"><input id="target" type="file" hidden><input id="display" value="KEEP"></div>');
  t.after(() => h.dom.window.close());
  const before = h.document.body.innerHTML;
  // Recreate the previous registry identity while keeping the old observer
  // global alive, as an already-open page would during extension reinjection.
  const previousRegistrySource = sources[1].replace('revision === 15', 'revision === 3').replace('revision: 15', 'revision: 3');
  h.window.eval(previousRegistrySource);
  assert.equal(h.window.ResumeControls.revision, 3);
  const previousRegistry = h.window.ResumeControls;
  h.window.eval(sources[3]);
  for (const source of sources) h.window.eval(source);
  const current = h.window.ResumeControls;
  assert.equal(current.revision, 15); assert.notEqual(current, previousRegistry);
  assert.equal(current.resolve(h.get('target')).name, 'upload');
  assert.equal(current.resolve(h.get('display')).name, 'upload-surface');
  assert.equal(current.plan(h.get('display'), { value: 'replacement' }).reason, 'upload_manual');
  assert.equal(current.list().filter(row => row.name === 'upload-surface').length, 1);
  unchanged(h, before);
});

test('native label ownership can describe a separate hidden input without duplicate discovery', t => {
  const h = boot('<label id="target" for="file"><span>Choose attachment</span><button type="button">Later</button></label><input id="file" type="file" hidden>');
  t.after(() => h.dom.window.close());
  const before = h.document.body.innerHTML;
  const observed = h.U.inspect(h.get('target'));
  assert.equal(observed.status, 'observed'); assert.equal(observed.ownership, 'input-backed');
  assert.equal(observed.fileInputs, 1); assert.equal(observed.affordances.later, 1);
  const discovered = json(h.U.discover());
  assert.equal(discovered.length, 1);
  assert.equal(discovered[0].ownership, 'input-backed');
  assert.equal(discovered[0].affordances.later, 1);
  assert.equal(h.U.plan(h.get('target'), { action: 'later' }).reason, 'upload_deferred');
  unchanged(h, before);
});

test('preview and clear expose existing rendered metadata without opening or removing attachments', t => {
  const h = boot('<section id="target" class="attachment-control"><input type="file" hidden><span data-file-name>synthetic.pdf</span><a href="https://offline.example/private?token=SECRET">Preview</a><button type="button">Clear</button><button type="button">Remove</button></section>');
  t.after(() => h.dom.window.close());
  const before = h.document.body.innerHTML, el = h.get('target');
  const observation = json(h.U.preview(el));
  assert.ok(observation.preview.count >= 1);
  assert.ok(observation.preview.items.some(row => row.label.includes('synthetic.pdf')));
  assert.equal(observation.affordances.preview, 1); assert.equal(observation.affordances.clear, 2);
  assert.equal(JSON.stringify(observation).includes('SECRET'), false);
  assert.equal(JSON.stringify(observation).includes('https://'), false);
  assert.equal(h.U.plan(el, { action: 'preview' }).reason, 'attachment_preview_readonly');
  assert.equal(h.U.plan(el, { action: 'clear' }).reason, 'attachment_clear_manual');
  unchanged(h, before);
});

test('preview observations count visible leaf items and omit hidden metadata and resource URLs', t => {
  const h = boot('<div id="target" class="attachment-control"><input type="file" hidden><div data-upload-preview><img alt="synthetic image"></div><div data-attachment-preview><a href="/private?secret=NO_EXPORT">synthetic.pdf</a></div><span data-file-name hidden>HIDDEN_NAME</span><span data-file-name style="display:none">CSS_HIDDEN_NAME</span></div>');
  t.after(() => h.dom.window.close());
  const before = h.document.body.innerHTML;
  const preview = json(h.U.preview(h.get('target'))).preview;
  assert.equal(preview.count, 2);
  assert.deepEqual(preview.items, [{ kind: 'image', label: 'synthetic image' }, { kind: 'link', label: 'synthetic.pdf' }]);
  assert.equal(JSON.stringify(preview).includes('NO_EXPORT'), false);
  assert.equal(JSON.stringify(preview).includes('HIDDEN_NAME'), false);
  unchanged(h, before);
});

test('a linked image in an attachment preview represents one image item', t => {
  const h = boot('<div id="target" class="upload-control"><input type="file" hidden><div data-upload-preview><a href="/never-open-image"><img alt="synthetic file"></a></div></div>');
  t.after(() => h.dom.window.close());
  const before = h.document.body.innerHTML;
  const preview = json(h.U.preview(h.get('target'))).preview;
  assert.equal(preview.count, 1);
  assert.deepEqual(preview.items, [{ kind: 'image', label: 'synthetic file' }]);
  unchanged(h, before);
});

test('nested preview containers remain part of the input-backed parent upload control', t => {
  const h = boot('<div id="target" class="upload-control"><input type="file" hidden><div id="preview" class="upload-preview"><div data-upload-preview><div data-attachment-preview><span data-file-name>synthetic.pdf</span></div></div></div></div>');
  t.after(() => h.dom.window.close());
  const before = h.document.body.innerHTML;
  const discovered = json(h.U.discover());
  assert.equal(discovered.length, 1); assert.equal(discovered[0].ownership, 'input-backed');
  assert.equal(discovered[0].fileInputs, 1);
  const observation = json(h.U.preview(h.get('preview')));
  assert.equal(observation.ownership, 'input-backed'); assert.equal(observation.fileInputs, 1);
  assert.equal(observation.preview.count, 1);
  assert.deepEqual(observation.preview.items, [{ kind: 'text', label: 'synthetic.pdf' }]);
  unchanged(h, before);
});

test('skip and later are policy outcomes even when matching controls could submit or navigate', t => {
  const h = boot('<fieldset id="target"><input type="file"><button>Later</button><a href="/do-not-open">Skip</a></fieldset>');
  t.after(() => h.dom.window.close());
  const before = h.document.body.innerHTML, el = h.get('target');
  for (const [action, reason, disposition] of [['skip', 'upload_skipped', 'skipped'], ['later', 'upload_deferred', 'deferred']]) {
    const plan = h.U.plan(el, { action });
    assert.equal(plan.status, 'manual'); assert.equal(plan.skip, true); assert.equal(plan.reason, reason);
    assert.equal(plan.disposition, disposition); assert.equal(plan.writeStarted, false); assert.equal(plan.liveSupportClaimed, false);
  }
  assert.equal(h.U.plan(el, { action: 'upload' }).reason, 'upload_manual');
  assert.equal(h.U.plan(el, { action: 'other' }).reason, 'attachment_action_unknown');
  unchanged(h, before);
});

test('unconfirmed hints, shared inputs and plain upload text never establish actionable ownership', t => {
  const h = boot('<div id="target" class="dropzone">Drop here</div><div id="shared" class="upload-control"><input type="file"><input type="file"></div><button id="words" type="button">Upload</button>');
  t.after(() => h.dom.window.close());
  const before = h.document.body.innerHTML;
  for (const [id, reason] of [['target', 'upload_ownership_unconfirmed'], ['shared', 'upload_ownership_ambiguous']]) {
    const observed = h.U.inspect(h.get(id)); assert.equal(observed.status, 'manual'); assert.equal(observed.reason, reason);
    const plan = h.U.plan(h.get(id), { action: 'skip' }); assert.equal(plan.reason, reason);
    assert.notEqual(plan.disposition, 'skipped');
  }
  assert.equal(h.U.inspect(h.get('words')).status, 'manual');
  assert.equal(h.U.discover().length, 2);
  unchanged(h, before);
});

test('disabled and busy upload roots remain manual for every requested policy', t => {
  const h = boot('<fieldset id="target" disabled><input type="file"></fieldset><div id="busy" class="upload-control" aria-busy="true"><input type="file"></div>');
  t.after(() => h.dom.window.close());
  const before = h.document.body.innerHTML;
  for (const [id, reason] of [['target', 'disabled'], ['busy', 'busy']]) {
    const observed = h.U.inspect(h.get(id)); assert.equal(observed.status, 'manual'); assert.equal(observed.reason, reason);
    assert.equal(h.U.plan(h.get(id), { action: 'later' }).reason, reason);
  }
  unchanged(h, before);
});

test('detached, shadow and foreign-document controls fail closed without effects', t => {
  const h = boot('<div id="host"></div><input id="target" type="file"><iframe id="frame"></iframe>');
  t.after(() => h.dom.window.close());
  const detached = h.get('target'); detached.remove();
  const shadow = h.get('host').attachShadow({ mode: 'open' }), shadowInput = h.document.createElement('input');
  shadowInput.type = 'file'; shadow.append(shadowInput);
  const frameInput = h.get('frame').contentDocument.createElement('input'); frameInput.type = 'file';
  h.get('frame').contentDocument.body.append(frameInput);
  const before = h.document.body.innerHTML;
  assert.equal(h.U.inspect(detached).reason, 'target_detached');
  for (const el of [shadowInput, frameInput]) assert.equal(h.U.plan(el, { action: 'skip' }).reason, 'shadow_or_frame_manual');
  unchanged(h, before);
});

test('the ordinary MAIN writer refuses file inputs and upload display inputs before writeStarted', async t => {
  const h = boot('<div class="upload-control" role="group"><input id="target" type="file" hidden><input id="display" value="KEEP"></div>');
  t.after(() => h.dom.window.close());
  const before = h.document.body.innerHTML;
  const write = h.window.eval(`(${writeControlInPage.toString()})`);
  for (const selector of ['#target', '#display']) {
    const result = await write({ selector, value: 'synthetic.pdf', expectedUrl: h.window.location.href, timeOrigin: h.window.performance.timeOrigin });
    assert.equal(result.status, 'manual'); assert.equal(result.writeStarted, false); assert.equal(result.liveSupportClaimed, false);
    assert.equal(result.reason, 'upload_manual');
  }
  unchanged(h, before);
});
