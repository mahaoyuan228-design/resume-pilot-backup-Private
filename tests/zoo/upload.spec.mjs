import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { startZoo, SYNTHETIC } from './support.mjs';

const files = ['model', 'registry', 'upload', 'native'].map(name => `src/content/controls/${name}.js`);
const noEffects = { blacklistClicks: 0, clicks: 0, fileAssignments: 0, filePickerCalls: 0,
  inputEvents: 0, changeEvents: 0, dragEvents: 0, submits: 0, resets: 0 };

async function fixture(name, work, testInfo) {
  const zoo = await startZoo(name);
  try {
    const before = await zoo.readback();
    // MAIN observes the native file/picker traps as well as the unchanged DOM.
    await zoo.inject(files, 'MAIN');
    const result = await work(zoo);
    const after = await zoo.readback();
    expect(after).toEqual(before);
    expect(after.snapshot.effects).toEqual(noEffects);
    expect(after.model.files.every(row => row.count === 0 && row.value === '')).toBe(true);
    expect(after.model.neighbor).toBe('ZOO_NEIGHBOR_KEEP');
    expect(after.model.disabledValue).toBe('ZOO_DISABLED_KEEP');
    const evidence = await zoo.evidence();
    expect(evidence).toMatchObject({ neverSave: true, liveSupportClaimed: false,
      nonGetObserved: 0, nonGetBlocked: 0, responseToNonGet: 0,
      blacklistClickAttempts: 0, blacklistClicks: 0, guardFailed: false });
    expect(evidence.routing).toMatchObject({ rejected: [], nonGetReachedRoute: 0 });
    expect(zoo.page.url()).toBe(SYNTHETIC);
    for (const file of files) expect(evidence.adapterHashes[file]).toMatch(/^[a-f0-9]{64}$/u);
    await fs.writeFile(testInfo.outputPath('upload-evidence.json'), JSON.stringify({ result, before, after, evidence,
      execution: 'Exact built bytes in disposable loopback MAIN context; empty file lists; no picker, file assignment or upload' }, null, 2));
    await zoo.page.screenshot({ path: testInfo.outputPath('upload-fixture.png'), fullPage: true });
  } finally { await zoo.close(); }
}

test('upload engine: native file input is detected and always planned for manual handling', async ({}, testInfo) => {
  await fixture('upload-native', async zoo => {
    const result = await zoo.execute(() => {
      const el = document.querySelector('#target');
      return { observation: ResumeUploadControls.inspect(el), plan: ResumeUploadControls.plan(el, { action: 'upload' }),
        registry: ResumeControls.plan(el, { value: 'synthetic.pdf' }) };
    }, [], 'MAIN');
    expect(result.observation).toMatchObject({ status: 'observed', kind: 'file-input', fileInputs: 1,
      selectedFiles: [], writeStarted: false, liveSupportClaimed: false });
    expect(result.plan).toMatchObject({ status: 'manual', reason: 'upload_manual', skip: true,
      writeStarted: false, liveSupportClaimed: false });
    expect(result.registry).toMatchObject({ adapter: 'upload', status: 'manual', reason: 'upload_manual' });
    return result;
  }, testInfo);
});

test('upload engine: hidden file-backed drop zone is discovered once and blocks text writer fallback', async ({}, testInfo) => {
  await fixture('upload-hidden-zone', async zoo => {
    const result = await zoo.execute(() => ({
      observation: ResumeUploadControls.inspect(document.querySelector('#target')),
      discovered: ResumeUploadControls.discover(),
      display: ResumeControls.plan(document.querySelector('#display'), { value: 'replacement' }),
    }), [], 'MAIN');
    expect(result.observation).toMatchObject({ status: 'observed', kind: 'drop-zone', ownership: 'input-backed', fileInputs: 1 });
    expect(result.discovered).toHaveLength(1);
    expect(result.display).toMatchObject({ adapter: 'upload-surface', status: 'manual', reason: 'upload_manual' });
    return result;
  }, testInfo);
});

test('upload engine: rendered previews and clear controls are observed without opening or removal', async ({}, testInfo) => {
  await fixture('upload-preview', async zoo => {
    const result = await zoo.execute(() => {
      const el = document.querySelector('#target');
      return { observation: ResumeUploadControls.preview(el),
        previewPlan: ResumeUploadControls.plan(el, { action: 'preview' }),
        clearPlan: ResumeUploadControls.plan(el, { action: 'clear' }) };
    }, [], 'MAIN');
    expect(result.observation.preview.count).toBeGreaterThanOrEqual(1);
    expect(result.observation.preview.items.some(row => row.label.includes('synthetic-report.pdf'))).toBe(true);
    expect(result.observation.affordances).toMatchObject({ preview: 1, clear: 2 });
    expect(JSON.stringify(result)).not.toContain('/never-open-preview');
    expect(result.previewPlan).toMatchObject({ status: 'manual', reason: 'attachment_preview_readonly', writeStarted: false });
    expect(result.clearPlan).toMatchObject({ status: 'manual', reason: 'attachment_clear_manual', writeStarted: false });
    return result;
  }, testInfo);
});

test('upload engine: skip/later remain no-click policy decisions with unsafe matching buttons and links', async ({}, testInfo) => {
  await fixture('upload-defer', async zoo => {
    const result = await zoo.execute(() => {
      const el = document.querySelector('#target');
      return ['skip', 'later'].map(action => ResumeUploadControls.plan(el, { action }));
    }, [], 'MAIN');
    expect(result[0]).toMatchObject({ status: 'manual', reason: 'upload_skipped', disposition: 'skipped', skip: true,
      writeStarted: false, liveSupportClaimed: false });
    expect(result[1]).toMatchObject({ status: 'manual', reason: 'upload_deferred', disposition: 'deferred', skip: true,
      writeStarted: false, liveSupportClaimed: false });
    return result;
  }, testInfo);
});

test('upload engine: unknown drop-zone hints and shared file wrappers fail closed', async ({}, testInfo) => {
  await fixture('upload-unconfirmed', async zoo => {
    const result = await zoo.execute(() => ({ discovered: ResumeUploadControls.discover(),
      hint: ResumeUploadControls.plan(document.querySelector('#target'), { action: 'skip' }),
      shared: ResumeUploadControls.plan(document.querySelector('#shared'), { action: 'later' }),
      words: ResumeUploadControls.inspect(document.querySelector('#words-only')) }), [], 'MAIN');
    expect(result.discovered).toHaveLength(2);
    expect(result.hint).toMatchObject({ status: 'manual', reason: 'upload_ownership_unconfirmed', writeStarted: false });
    expect(result.shared).toMatchObject({ status: 'manual', reason: 'upload_ownership_ambiguous', writeStarted: false });
    expect(result.hint.disposition).not.toBe('skipped');
    expect(result.shared.disposition).not.toBe('deferred');
    expect(result.words.status).toBe('manual');
    return result;
  }, testInfo);
});

test('upload engine: disabled and busy controls remain manual without clear or later effects', async ({}, testInfo) => {
  await fixture('upload-disabled-busy', async zoo => {
    const result = await zoo.execute(() => ({
      disabled: ResumeUploadControls.plan(document.querySelector('#target'), { action: 'clear' }),
      busy: ResumeUploadControls.plan(document.querySelector('#busy'), { action: 'later' }),
    }), [], 'MAIN');
    expect(result.disabled).toMatchObject({ status: 'manual', reason: 'disabled', writeStarted: false });
    expect(result.busy).toMatchObject({ status: 'manual', reason: 'busy', writeStarted: false });
    return result;
  }, testInfo);
});

test('upload engine: explicit writer opt-in cannot turn file or attachment display surfaces into writes', async ({}, testInfo) => {
  await fixture('upload-route', async zoo => {
    const result = await zoo.execute(async () => {
      const rows = [];
      for (const id of ['file', 'display']) {
        const el = document.getElementById(id), adapter = ResumeControls.resolve(el);
        rows.push({ id, adapter: adapter.name, plan: ResumeControls.plan(el, { value: 'replacement' }),
          written: await adapter.write(el, { adapter: adapter.name, status: 'planned', value: 'replacement' },
            { allowWrite: true, check: async () => {} }) });
      }
      return rows;
    }, [], 'MAIN');
    expect(result.map(row => row.adapter)).toEqual(['upload', 'upload-surface']);
    for (const row of result) {
      expect(row.plan).toMatchObject({ status: 'manual', reason: 'upload_manual' });
      expect(row.written.attempts).toBe(0);
      expect(row.written.status).not.toBe('success');
    }
    return result;
  }, testInfo);
});
