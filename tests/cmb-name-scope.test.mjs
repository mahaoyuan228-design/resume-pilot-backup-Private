/**
 * Offline scope for CMB basic 姓名 when family rows reuse the label.
 * Harvested ids only (cmb-remaining-dom-ids-20261019.json). Never Save.
 * Does not claim the site supported.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve('.');
const source = readFileSync(resolve(root, 'src/content/cmb-basic.js'), 'utf8');
const harvest = JSON.parse(readFileSync(
  resolve(root, 'dist/site-probes/cmb-remaining-dom-ids-20261019.json'),
  'utf8'
));

const BASIC_NAME_ID = 'resume_basicInfo_name';
const FAMILY_NAME_IDS = ['resume_familyList_0_name', 'resume_familyList_1_name'];

test('姓名 scope keys are the harvested basicInfo id and the two family name ids', () => {
  const labeled = harvest.fields
    .filter((row) => row.labelText === '姓名')
    .map((row) => row.id)
    .sort();
  assert.deepEqual(labeled, [BASIC_NAME_ID, ...FAMILY_NAME_IDS].sort());
  assert.equal(harvest.neverSave, true);
  assert.match(source, /BASIC_NAME_INPUT_ID = 'resume_basicInfo_name'/);
  assert.match(source, /resume_familyList_0_name/);
  assert.match(source, /resume_familyList_1_name/);
  assert.match(source, /item_ambiguous/);
  assert.match(source, /resolveBasicName/);
  assert.doesNotMatch(source, /已支持/);
  assert.doesNotMatch(source, /click\(.*保存|保存.*\.click/);
  assert.doesNotMatch(source, /cms-|gth-|careers\.citics|ResumeCitics|ResumeFeishu|atsx-form/);
});

function pause(ms) {
  return new Promise((resolvePause) => setTimeout(resolvePause, ms));
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createNetServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
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
  return new Promise((resolveSocket, reject) => {
    const socket = new WebSocket(url);
    const pending = new Map();
    let nextId = 1;
    socket.addEventListener('open', () => {
      resolveSocket({
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

const FILL = `ResumeCmbBasic.fillBasic({
  allowExplicitValues: true,
  fullName: '测试甲',
  mobile: '13800138000',
  email: 'cmb.fixture@example.com'
}, { synthetic: true })`;

const READ = `(() => {
  const valueOf = (id) => {
    const node = document.getElementById(id);
    return node ? node.value : null;
  };
  const basicItem = document.querySelector('[data-name-scope="basic"], [data-field="姓名"]:not([data-name-scope])');
  const basicInput = basicItem?.querySelector('input.ant-input, input[type="text"]') || null;
  const labeled = [...document.querySelectorAll('.ant-form-item')].filter((item) => {
    const text = (item.querySelector('.ant-form-item-label')?.textContent || '').replace(/\\s+/g, '');
    return text === '姓名';
  });
  const basicIds = [...document.querySelectorAll('input')].filter((node) => node.getAttribute('id') === 'resume_basicInfo_name').map((node) => node.value);
  return {
    basic: basicInput ? basicInput.value : null,
    basicId: basicInput ? (basicInput.getAttribute('id') || '') : '',
    basicIdValues: basicIds,
    family0: valueOf('resume_familyList_0_name'),
    family1: valueOf('resume_familyList_1_name'),
    phone: document.querySelector('[data-field="手机号"] input')?.value ?? null,
    email: document.querySelector('[data-field="邮箱"] input')?.value ?? null,
    nameLabelCount: labeled.length,
    saveDisabled: document.getElementById('save-btn')?.disabled === true,
    saveClicks: window.__cmbSaveClicks || 0
  };
})()`;

test('unique 姓名 fills; duplicate labels scope to basicInfo or fail closed; never save', { timeout: 120000 }, async () => {
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
  const userData = mkdtempSync(join(tmpdir(), 'cmb-name-scope-'));
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

    const hint = await evaluate(send, `ResumeCmbBasic.fillBasic({
      allowExplicitValues: true,
      fullName: '测试甲',
      mobile: '13800138000',
      email: 'cmb.fixture@example.com',
      birthDate: '不是日期'
    }, { synthetic: true })`);
    assert.equal(hint.ok, false);
    assert.equal(hint.reason, 'birthdate_unparseable');
    assert.equal(hint.status, 'failed');
    assert.equal(hint.writeAttempted, false);
    assert.equal(hint.saved, false);
    assert.equal(hint.skippedSave, true);
    assert.equal(hint.saveAllowed, false);
    const beforeUnique = await evaluate(send, READ);
    assert.equal(beforeUnique.basic, '');
    assert.equal(beforeUnique.nameLabelCount, 1);
    assert.equal(beforeUnique.family0, '');
    assert.equal(beforeUnique.family1, '');
    assert.equal(beforeUnique.saveClicks, 0);

    const unique = await evaluate(send, FILL);
    const afterUnique = await evaluate(send, READ);
    assert.equal(unique.ok, true);
    assert.equal(unique.saved, false);
    assert.equal(unique.skippedSave, true);
    assert.equal(unique.writeAttempted, true);
    assert.equal(unique.results.find((row) => row.label === '姓名')?.ok, true);
    assert.equal(unique.results.find((row) => row.label === '姓名')?.after, '测试甲');
    assert.equal(unique.results.find((row) => row.label === '手机号')?.after, '13800138000');
    assert.equal(unique.results.find((row) => row.label === '邮箱')?.after, 'cmb.fixture@example.com');
    assert.equal(afterUnique.basic, '测试甲');
    assert.equal(afterUnique.family0, '');
    assert.equal(afterUnique.family1, '');
    assert.equal(afterUnique.phone, '13800138000');
    assert.equal(afterUnique.email, 'cmb.fixture@example.com');
    assert.equal(afterUnique.saveDisabled, true);
    assert.equal(afterUnique.saveClicks, 0);

    await evaluate(send, `(() => {
      const basicItem = document.querySelector('[data-field="姓名"]');
      basicItem.dataset.nameScope = 'basic';
      const basicInput = basicItem.querySelector('input');
      basicInput.id = 'resume_basicInfo_name';
      basicInput.value = '';
      const form = document.querySelector('form.ant-form');
      for (const [id, value] of [['resume_familyList_0_name', '家属甲'], ['resume_familyList_1_name', '家属乙']]) {
        const input = document.getElementById(id);
        input.value = value;
        const item = document.createElement('div');
        item.className = 'ant-form-item';
        item.dataset.field = '姓名';
        item.dataset.nameScope = 'family';
        const labelWrap = document.createElement('div');
        labelWrap.className = 'ant-form-item-label';
        const label = document.createElement('label');
        label.textContent = '姓名';
        label.htmlFor = id;
        labelWrap.appendChild(label);
        const control = document.createElement('div');
        control.className = 'ant-form-item-control';
        control.appendChild(input);
        item.appendChild(labelWrap);
        item.appendChild(control);
        form.appendChild(item);
      }
      return document.querySelectorAll('.ant-form-item').length;
    })()`);

    const scopedProbe = await evaluate(send, `ResumeCmbBasic.probeLabels({ synthetic: true })`);
    assert.equal(scopedProbe.labels.find((row) => row.label === '姓名')?.found, true);
    const scoped = await evaluate(send, FILL);
    const afterScoped = await evaluate(send, READ);
    assert.equal(afterScoped.nameLabelCount, 3);
    assert.equal(scoped.saved, false);
    assert.equal(scoped.skippedSave, true);
    assert.equal(scoped.results.find((row) => row.label === '姓名')?.ok, true);
    assert.equal(scoped.results.find((row) => row.label === '姓名')?.reason, 'matched');
    assert.equal(scoped.results.find((row) => row.label === '姓名')?.after, '测试甲');
    assert.equal(afterScoped.basic, '测试甲');
    assert.equal(afterScoped.basicId, 'resume_basicInfo_name');
    assert.deepEqual(afterScoped.basicIdValues, ['测试甲']);
    assert.equal(afterScoped.family0, '家属甲');
    assert.equal(afterScoped.family1, '家属乙');
    assert.equal(afterScoped.phone, '13800138000');
    assert.equal(afterScoped.email, 'cmb.fixture@example.com');
    assert.equal(afterScoped.saveDisabled, true);
    assert.equal(afterScoped.saveClicks, 0);

    await evaluate(send, `(() => {
      const basic = document.querySelector('[data-name-scope="basic"] input');
      basic.value = '原姓名';
      basic.removeAttribute('id');
      document.getElementById('resume_familyList_0_name').value = '家属甲';
      document.getElementById('resume_familyList_1_name').value = '家属乙';
      return true;
    })()`);
    const ambiguous = await evaluate(send, FILL);
    const afterAmbiguous = await evaluate(send, READ);
    const nameRow = ambiguous.results.find((row) => row.label === '姓名');
    assert.equal(ambiguous.ok, false);
    assert.equal(ambiguous.saved, false);
    assert.equal(ambiguous.skippedSave, true);
    assert.equal(nameRow.ok, false);
    assert.equal(nameRow.reason, 'item_ambiguous');
    assert.equal(nameRow.writeAttempted, false);
    assert.equal(nameRow.saved, false);
    assert.equal(nameRow.skippedSave, true);
    assert.equal(nameRow.before, '');
    assert.equal(nameRow.after, '');
    assert.equal(afterAmbiguous.basic, '原姓名');
    assert.equal(afterAmbiguous.basicId, '');
    assert.equal(afterAmbiguous.family0, '家属甲');
    assert.equal(afterAmbiguous.family1, '家属乙');
    assert.equal(afterAmbiguous.phone, '13800138000');
    assert.equal(afterAmbiguous.saveClicks, 0);
    assert.equal(ambiguous.results.find((row) => row.label === '手机号')?.ok, true);
    assert.equal(ambiguous.results.find((row) => row.label === '邮箱')?.ok, true);

    await evaluate(send, `(() => {
      const basicItem = document.querySelector('[data-name-scope="basic"]');
      const basic = basicItem.querySelector('input');
      basic.id = 'resume_basicInfo_name';
      basic.value = '原姓名';
      const clone = basicItem.cloneNode(true);
      clone.dataset.nameScope = 'basic-dup';
      clone.querySelector('input').value = '副本';
      basicItem.after(clone);
      document.getElementById('resume_familyList_0_name').value = '家属甲';
      document.getElementById('resume_familyList_1_name').value = '家属乙';
      return true;
    })()`);
    const stillAmbiguous = await evaluate(send, FILL);
    const afterDup = await evaluate(send, `(() => {
      const values = [...document.querySelectorAll('input')].filter((node) => node.getAttribute('id') === 'resume_basicInfo_name').map((node) => node.value);
      return {
        values,
        family0: document.getElementById('resume_familyList_0_name').value,
        family1: document.getElementById('resume_familyList_1_name').value,
        saveClicks: window.__cmbSaveClicks || 0,
        saved: null
      };
    })()`);
    const dupRow = stillAmbiguous.results.find((row) => row.label === '姓名');
    assert.equal(stillAmbiguous.saved, false);
    assert.equal(stillAmbiguous.skippedSave, true);
    assert.equal(dupRow.reason, 'item_ambiguous');
    assert.equal(dupRow.writeAttempted, false);
    assert.equal(afterDup.values.length, 2);
    assert.deepEqual(new Set(afterDup.values), new Set(['原姓名', '副本']));
    assert.equal(afterDup.family0, '家属甲');
    assert.equal(afterDup.family1, '家属乙');
    assert.equal(afterDup.saveClicks, 0);

    const familyOnly = await evaluate(send, `(() => {
      document.querySelector('[data-name-scope="basic"]')?.remove();
      document.querySelector('[data-name-scope="basic-dup"]')?.remove();
      document.querySelector('[data-name-scope="family"]')?.remove();
      const left = document.getElementById('resume_familyList_1_name');
      left.value = '家属乙';
      return ResumeCmbBasic.fillText('姓名', '测试甲');
    })()`);
    const afterFamilyOnly = await evaluate(send, `document.getElementById('resume_familyList_1_name').value`);
    assert.equal(familyOnly.ok, false);
    assert.equal(familyOnly.reason, 'item_not_found');
    assert.equal(familyOnly.writeAttempted, false);
    assert.equal(familyOnly.saved, false);
    assert.equal(familyOnly.skippedSave, true);
    assert.equal(afterFamilyOnly, '家属乙');
    const clicks = await evaluate(send, `window.__cmbSaveClicks || 0`);
    assert.equal(clicks, 0);
  } finally {
    try { socket?.close(); } catch { /* ignore */ }
    try { child.kill(); } catch { /* ignore */ }
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});
