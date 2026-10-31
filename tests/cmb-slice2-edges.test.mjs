/**
 * Offline edge cases for already-wired CMB second-slice fields.
 * Does not re-implement fill. Does not claim the site supported.
 *
 * Codex Q draft names are not engine codes:
 * - VALUE_EMPTY → omitted from the plan (no blocker). Direct fill of '' is invalid_profile_value.
 * - NUMBER_INVALID → invalid_profile_value on the plan; invalid_height / invalid_weight on explicit fillBasic.
 *   A decimal that matches /^\d+(?:\.\d+)?$/ stays valid. There is no NUMBER_INVALID code.
 * - UNIT_UNMAPPED → the same codes as NUMBER_INVALID. There is no UNIT_UNMAPPED code.
 * - OPTION_UNMAPPED → invalid_profile_value on the plan and on direct radio fill;
 *   invalid_gender / invalid_formal_work on explicit fillBasic.
 * - RADIO_AMBIGUOUS → radio_structure_changed when the item is not exactly one of each
 *   allowlisted label; radio_readback_ambiguous when more than one radio is checked.
 *
 * RankingMajor stays DOM_CONTROL_MISSING. Never Save.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  CMB_HEIGHT_VALUE_RE,
  CMB_WEIGHT_VALUE_RE,
  numericCmbHeight,
  numericCmbWeight,
  planCmbBasicFromProfile
} from '../src/content/cmb-profile-map.mjs';

const root = resolve('.');
const source = readFileSync(resolve(root, 'src/content/cmb-basic.js'), 'utf8');
const harness = readFileSync(resolve(root, 'scripts/auto-cmb-basic.mjs'), 'utf8');

const CORE = {
  fullName: '测试甲',
  phone: '13800138000',
  email: 'cmb.user@example.com',
  confirmedFields: ['fullName', 'phone', 'email']
};

function plan(extra = {}, confirmed = []) {
  return planCmbBasicFromProfile({
    ...CORE,
    ...extra,
    confirmedFields: [...CORE.confirmedFields, ...confirmed]
  });
}

function blocker(result, label) {
  return result.blockers.find((row) => row.label === label);
}

test('height edges use existing codes: empty omitted, junk invalid_profile_value, decimal kept', () => {
  for (const height of ['', '   ', null]) {
    const absent = plan({ height });
    assert.equal(absent.ok, true);
    assert.equal(absent.values.height, '');
    assert.equal(absent.fields.some((row) => row.label === '身高'), false);
    assert.equal(blocker(absent, '身高'), undefined);
  }

  for (const height of ['abc', '一百七十五', '175CM', '175 cm', '175厘米', '-175', '175.5.1']) {
    const invalid = plan({ height }, ['height']);
    assert.equal(invalid.ok, true);
    assert.equal(invalid.values.fullName, '测试甲');
    assert.equal(invalid.values.mobile, '13800138000');
    assert.equal(invalid.values.email, 'cmb.user@example.com');
    assert.equal(invalid.values.height, '');
    assert.equal(blocker(invalid, '身高')?.reason, 'invalid_profile_value');
    assert.equal(numericCmbHeight(height), '');
    assert.equal(CMB_HEIGHT_VALUE_RE.test(String(height).trim()), false);
  }

  const decimal = plan({ height: ' 180.5 ' }, ['height']);
  assert.equal(decimal.ok, true);
  assert.equal(decimal.values.height, '180.5');
  assert.equal(decimal.fields.find((row) => row.label === '身高')?.ready, true);
  assert.equal(blocker(decimal, '身高'), undefined);
  assert.equal(numericCmbHeight('180.5'), '180.5');
});

test('weight edges use existing codes: empty omitted, junk invalid_profile_value, decimal kept', () => {
  for (const weight of ['', '   ']) {
    const absent = plan({ weight });
    assert.equal(absent.values.weight, '');
    assert.equal(absent.fields.some((row) => row.label === '体重'), false);
  }

  for (const weight of ['abc', '六十', '60kg', '60KG', '60 kg', '60公斤']) {
    const invalid = plan({ weight }, ['weight']);
    assert.equal(invalid.values.weight, '');
    assert.equal(invalid.values.height, '');
    assert.equal(invalid.values.fullName, '测试甲');
    assert.equal(blocker(invalid, '体重')?.reason, 'invalid_profile_value');
    assert.equal(numericCmbWeight(weight), '');
    assert.equal(CMB_WEIGHT_VALUE_RE.test(weight.replace(/\s+/gu, ' ').trim()), false);
  }

  const decimal = plan({ weight: '58.5' }, ['weight']);
  assert.equal(decimal.values.weight, '58.5');
  assert.equal(decimal.fields.find((row) => row.label === '体重')?.ready, true);
  assert.equal(numericCmbWeight('58.5'), '58.5');
});

test('gender edges: empty omitted, unmapped value is invalid_profile_value', () => {
  const absent = plan({ gender: '' });
  assert.equal(absent.values.gender, '');
  assert.equal(absent.fields.some((row) => row.label === '性别'), false);

  for (const gender of ['男士', 'Male', '男的']) {
    const invalid = plan({ gender }, ['gender']);
    assert.equal(invalid.values.gender, '');
    assert.equal(invalid.values.fullName, '测试甲');
    assert.equal(blocker(invalid, '性别')?.reason, 'invalid_profile_value');
  }

  const ready = plan({ gender: ' 男 ' }, ['gender']);
  assert.equal(ready.values.gender, '男');
  assert.equal(ready.fields.find((row) => row.label === '性别')?.ready, true);
});

test('formalWork edges: empty omitted, unmapped value is invalid_profile_value', () => {
  const absent = plan({ formalWork: '   ' });
  assert.equal(absent.values.formalWork, '');
  assert.equal(absent.fields.some((row) => row.label === '是否参加过正式工作'), false);

  for (const formalWork of ['有', '无', 'YES']) {
    const invalid = plan({ formalWork }, ['formalWork']);
    assert.equal(invalid.values.formalWork, '');
    assert.equal(invalid.values.gender, '');
    assert.equal(blocker(invalid, '是否参加过正式工作')?.reason, 'invalid_profile_value');
  }

  const ready = plan({ formalWork: ' 否 ' }, ['formalWork']);
  assert.equal(ready.values.formalWork, '否');
  assert.equal(ready.fields.find((row) => row.label === '是否参加过正式工作')?.ready, true);
});

test('one invalid second-slice value does not clear the other fields or the first slice', () => {
  const mixed = plan({
    gender: '女',
    height: '175CM',
    weight: '58',
    formalWork: '是'
  }, ['gender', 'height', 'weight', 'formalWork']);
  assert.equal(mixed.ok, true);
  assert.equal(mixed.values.fullName, '测试甲');
  assert.equal(mixed.values.mobile, '13800138000');
  assert.equal(mixed.values.email, 'cmb.user@example.com');
  assert.equal(mixed.values.gender, '女');
  assert.equal(mixed.values.height, '');
  assert.equal(mixed.values.weight, '58');
  assert.equal(mixed.values.formalWork, '是');
  assert.equal(blocker(mixed, '身高')?.reason, 'invalid_profile_value');
  assert.equal(blocker(mixed, '性别'), undefined);
  assert.equal(blocker(mixed, '体重'), undefined);
  assert.equal(blocker(mixed, '是否参加过正式工作'), undefined);
});

test('RankingMajor stays missing and second-slice fill is not reimplemented here', () => {
  assert.doesNotMatch(source, /RankingMajor|rankingMajor/);
  assert.match(harness, /RankingMajor is DOM_CONTROL_MISSING/);
  assert.match(source, /skippedSave:\s*true/);
  assert.doesNotMatch(source, /click\(.*保存|保存.*\.click/);
});

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/local/bin/google-chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable'
  ].filter(Boolean);
  return candidates.find((candidate) => {
    try { return readFileSync(candidate, { flag: 'r' }) && true; } catch { return false; }
  }) || 'google-chrome';
}

function wsConnect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const pending = new Map();
    let nextId = 1;
    socket.addEventListener('open', () => {
      resolve({
        socket,
        send(method, params = {}) {
          const id = nextId++;
          return new Promise((res, rej) => {
            pending.set(id, { res, rej });
            socket.send(JSON.stringify({ id, method, params }));
          });
        }
      });
    });
    socket.addEventListener('error', (err) => reject(err.error || err));
    socket.addEventListener('message', (event) => {
      let msg;
      try { msg = JSON.parse(String(event.data)); } catch { return; }
      if (msg.id != null && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message || JSON.stringify(msg.error)));
        else res(msg.result);
      }
    });
  });
}

async function evaluate(send, expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    const text = result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'evaluate_failed';
    throw new Error(text);
  }
  return result.result?.value;
}

const SNAPSHOT = `(() => {
  const norm = (value) => String(value ?? '').replace(/\\s+/g, ' ').trim();
  const items = [...document.querySelectorAll('.ant-form-item')];
  const labelOf = (item) => norm(item.querySelector('.ant-form-item-label label, .ant-form-item-label')?.textContent || '');
  const textOf = (item) => {
    const input = [...(item?.querySelectorAll('input') || [])].find((node) => node.type !== 'radio' && node.type !== 'checkbox' && node.type !== 'hidden');
    return input ? input.value : null;
  };
  const checked = (item) => [...(item?.querySelectorAll('input[type="radio"]') || [])].filter((node) => node.checked).map((node) => node.value);
  const byExact = (want) => items.find((item) => labelOf(item) === want);
  const byRe = (re) => items.find((item) => re.test(labelOf(item)));
  return {
    name: textOf(byExact('姓名')),
    phone: textOf(byExact('手机号')),
    email: textOf(byExact('邮箱')),
    gender: checked(byExact('性别')),
    height: textOf(byRe(/^身高/u)),
    weight: textOf(byRe(/^体重/u)),
    formal: checked(byExact('是否参加过正式工作')),
    saveDisabled: document.getElementById('save-btn')?.disabled === true,
    saveClicks: window.__cmbSaveClicks || 0
  };
})()`;

test('synthetic DOM edges fail closed, isolate neighbors, and never save', { timeout: 120000 }, async () => {
  const fixtureDir = resolve(root, 'tests/fixtures');
  const server = createServer((req, res) => {
    const file = join(fixtureDir, 'cmb-basic-form.html');
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(readFileSync(file));
  });
  await new Promise((resolveListen, reject) => {
    server.listen(0, '127.0.0.1', resolveListen);
    server.on('error', reject);
  });
  const port = server.address().port;
  const cdpPort = await freePort();
  const userData = mkdtempSync(join(tmpdir(), 'cmb-slice2-'));
  const child = spawn(chromePath(), [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    `--user-data-dir=${userData}`,
    `--remote-debugging-port=${cdpPort}`,
    'about:blank'
  ], { stdio: 'ignore' });
  let socket;
  try {
    let versionOk = false;
    for (let i = 0; i < 40; i += 1) {
      try {
        const res = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
        if (res.ok) { versionOk = true; break; }
      } catch { /* wait */ }
      await pause(100);
    }
    assert.equal(versionOk, true);
    const list = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
    const page = list.find((row) => row.type === 'page' && row.webSocketDebuggerUrl);
    assert.ok(page?.webSocketDebuggerUrl);
    const connected = await wsConnect(page.webSocketDebuggerUrl);
    socket = connected.socket;
    const { send } = connected;
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/cmb-basic-form.html` });
    await pause(500);
    await send('Runtime.evaluate', {
      expression: readFileSync(resolve(root, 'src/content/cmb-basic.js'), 'utf8')
    });
    await evaluate(send, `(() => {
      window.__cmbSaveClicks = 0;
      document.addEventListener('click', (event) => {
        const el = event.target.closest && event.target.closest('button,a,input,[role=button]');
        if (el && /保存|提交|投递/.test(el.textContent || el.value || '')) window.__cmbSaveClicks += 1;
      }, true);
      return true;
    })()`);

    const explicit = (field, value) => `ResumeCmbBasic.fillBasic({
      allowExplicitValues: true,
      fullName: '测试甲',
      mobile: '13800138000',
      email: 'cmb.fixture@example.com',
      ${field}: ${JSON.stringify(value)}
    }, { synthetic: true })`;

    const emptyHeight = await evaluate(send, `ResumeCmbBasic.fillHeight('', { synthetic: true })`);
    const junkHeight = await evaluate(send, `ResumeCmbBasic.fillHeight('abc', { synthetic: true })`);
    const unitHeight = await evaluate(send, `ResumeCmbBasic.fillHeight('175CM', { synthetic: true })`);
    const explicitHeight = await evaluate(send, explicit('height', '175厘米'));
    const emptyWeight = await evaluate(send, `ResumeCmbBasic.fillWeight('', { synthetic: true })`);
    const junkWeight = await evaluate(send, `ResumeCmbBasic.fillWeight('六十', { synthetic: true })`);
    const unitWeight = await evaluate(send, `ResumeCmbBasic.fillWeight('60kg', { synthetic: true })`);
    const explicitWeight = await evaluate(send, explicit('weight', '60 KG'));
    const emptyGender = await evaluate(send, `ResumeCmbBasic.fillGender('', { synthetic: true })`);
    const unmappedGender = await evaluate(send, `ResumeCmbBasic.fillGender('男士', { synthetic: true })`);
    const explicitGender = await evaluate(send, explicit('gender', 'Male'));
    const emptyFormal = await evaluate(send, `ResumeCmbBasic.fillFormalWork('', { synthetic: true })`);
    const unmappedFormal = await evaluate(send, `ResumeCmbBasic.fillFormalWork('有', { synthetic: true })`);
    const explicitFormal = await evaluate(send, explicit('formalWork', '无'));
    const before = await evaluate(send, SNAPSHOT);

    assert.equal(emptyHeight.reason, 'invalid_profile_value');
    assert.equal(emptyHeight.ok, false);
    assert.equal(emptyHeight.saved, false);
    assert.equal(junkHeight.reason, 'invalid_profile_value');
    assert.equal(unitHeight.reason, 'invalid_profile_value');
    assert.equal(explicitHeight.reason, 'invalid_height');
    assert.equal(explicitHeight.writeAttempted, false);
    assert.equal(explicitHeight.saved, false);
    assert.equal(emptyWeight.reason, 'invalid_profile_value');
    assert.equal(junkWeight.reason, 'invalid_profile_value');
    assert.equal(unitWeight.reason, 'invalid_profile_value');
    assert.equal(explicitWeight.reason, 'invalid_weight');
    assert.equal(explicitWeight.writeAttempted, false);
    assert.equal(emptyGender.reason, 'invalid_profile_value');
    assert.equal(unmappedGender.reason, 'invalid_profile_value');
    assert.equal(explicitGender.reason, 'invalid_gender');
    assert.equal(explicitGender.writeAttempted, false);
    assert.equal(emptyFormal.reason, 'invalid_profile_value');
    assert.equal(unmappedFormal.reason, 'invalid_profile_value');
    assert.equal(explicitFormal.reason, 'invalid_formal_work');
    assert.equal(explicitFormal.writeAttempted, false);
    assert.equal(before.name, '');
    assert.equal(before.phone, '');
    assert.equal(before.email, '');
    assert.deepEqual(before.gender, []);
    assert.equal(before.height, '');
    assert.equal(before.weight, '60');
    assert.deepEqual(before.formal, ['否']);
    assert.equal(before.saveDisabled, true);
    assert.equal(before.saveClicks, 0);

    const filled = await evaluate(send, `ResumeCmbBasic.fillBasic({
      allowExplicitValues: true,
      fullName: '测试甲',
      mobile: '13800138000',
      email: 'cmb.fixture@example.com',
      gender: '女',
      height: '175',
      weight: '58',
      formalWork: '是'
    }, { synthetic: true })`);
    const afterFill = await evaluate(send, SNAPSHOT);
    assert.equal(filled.ok, true);
    assert.equal(filled.saved, false);
    assert.equal(filled.skippedSave, true);
    assert.equal(filled.writeAttempted, true);
    assert.equal(filled.results.length, 7);
    assert.equal(filled.results.find((row) => row.label === '姓名')?.after, '测试甲');
    assert.equal(filled.results.find((row) => row.label === '手机号')?.after, '13800138000');
    assert.equal(filled.results.find((row) => row.label === '邮箱')?.after, 'cmb.fixture@example.com');
    assert.equal(filled.results.find((row) => row.label === '性别')?.after, '女');
    assert.equal(filled.results.find((row) => row.label === '身高')?.after, '175');
    assert.equal(filled.results.find((row) => row.label === '体重')?.after, '58');
    assert.equal(filled.results.find((row) => row.label === '是否参加过正式工作')?.after, '是');
    assert.equal(afterFill.name, '测试甲');
    assert.equal(afterFill.phone, '13800138000');
    assert.equal(afterFill.email, 'cmb.fixture@example.com');
    assert.deepEqual(afterFill.gender, ['女']);
    assert.equal(afterFill.height, '175');
    assert.equal(afterFill.weight, '58');
    assert.deepEqual(afterFill.formal, ['是']);
    assert.equal(/cm|kg/iu.test(`${afterFill.height}${afterFill.weight}`), false);

    const unitAfter = await evaluate(send, `ResumeCmbBasic.fillHeight('175 cm', { synthetic: true })`);
    const unitWeightAfter = await evaluate(send, `ResumeCmbBasic.fillWeight('58KG', { synthetic: true })`);
    const held = await evaluate(send, SNAPSHOT);
    assert.equal(unitAfter.reason, 'invalid_profile_value');
    assert.equal(unitWeightAfter.reason, 'invalid_profile_value');
    assert.equal(held.height, '175');
    assert.equal(held.weight, '58');
    assert.equal(held.name, '测试甲');
    assert.deepEqual(held.gender, ['女']);
    assert.deepEqual(held.formal, ['是']);

    const ambiguous = await evaluate(send, `(() => {
      const item = document.querySelector('[data-field="是否参加过正式工作"]');
      for (const input of item.querySelectorAll('input[type="radio"]')) {
        input.removeAttribute('name');
        input.checked = true;
      }
      return ResumeCmbBasic.fillFormalWork('是', { synthetic: true });
    })()`);
    const afterAmbiguous = await evaluate(send, SNAPSHOT);
    assert.equal(ambiguous.ok, false);
    assert.equal(ambiguous.reason, 'radio_readback_ambiguous');
    assert.equal(ambiguous.saved, false);
    assert.equal(ambiguous.skippedSave, true);
    assert.deepEqual(afterAmbiguous.formal.sort(), ['否', '是']);
    assert.equal(afterAmbiguous.height, '175');
    assert.equal(afterAmbiguous.weight, '58');
    assert.equal(afterAmbiguous.name, '测试甲');
    assert.deepEqual(afterAmbiguous.gender, ['女']);

    const structure = await evaluate(send, `(() => {
      const item = document.querySelector('[data-field="性别"]');
      const male = item.querySelector('.ant-radio-wrapper');
      item.querySelector('.ant-form-item-control').appendChild(male.cloneNode(true));
      return ResumeCmbBasic.fillGender('女', { synthetic: true });
    })()`);
    const afterStructure = await evaluate(send, SNAPSHOT);
    assert.equal(structure.ok, false);
    assert.equal(structure.reason, 'radio_structure_changed');
    assert.equal(structure.saved, false);
    assert.equal(structure.skippedSave, true);
    assert.deepEqual(afterStructure.gender, ['女']);
    assert.equal(afterStructure.height, '175');
    assert.equal(afterStructure.weight, '58');
    assert.equal(afterStructure.name, '测试甲');
    assert.equal(afterStructure.phone, '13800138000');
    assert.equal(afterStructure.email, 'cmb.fixture@example.com');
    assert.equal(afterStructure.saveDisabled, true);
    assert.equal(afterStructure.saveClicks, 0);
  } finally {
    try { socket?.close(); } catch { /* ignore */ }
    try { child.kill(); } catch { /* ignore */ }
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});
