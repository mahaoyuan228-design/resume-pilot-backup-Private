/**
 * Offline hint-only coverage for CMB 出生日期.
 * Does not add a writer. Does not claim the site supported.
 *
 * Codex V draft names are not engine codes:
 * - DOB_HINT_MISSING → empty or whitespace birthDate is omitted (no field, no blocker).
 *   A present unconfirmed value is profile_fact_unconfirmed. There is no DOB_HINT_MISSING code.
 * - DOB_HINT_AMBIGUOUS → any confirmed non-empty string is datepicker_hint_only.
 *   The planner does not parse a date and does not copy the string into values.
 *   There is no DOB_HINT_AMBIGUOUS code.
 * - DOB_CONTROL_UNOBSERVED and DOB_FORMAT_UNVERIFIED are live-only and are not implemented.
 *
 * RankingMajor stays DOM_CONTROL_MISSING. Never Save. No calendar click.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { CMB_BIRTHDATE_HINT, planCmbBasicFromProfile } from '../src/content/cmb-profile-map.mjs';

const root = resolve('.');
const source = readFileSync(resolve(root, 'src/content/cmb-basic.js'), 'utf8');
const harness = readFileSync(resolve(root, 'scripts/auto-cmb-basic.mjs'), 'utf8');

const CORE = {
  fullName: '测试甲',
  phone: '13800138000',
  email: 'cmb.user@example.com',
  confirmedFields: ['fullName', 'phone', 'email']
};

const SLICE = {
  gender: '女',
  height: '175',
  weight: '58',
  formalWork: '是'
};

function plan(extra = {}, confirmed = []) {
  return planCmbBasicFromProfile({
    ...CORE,
    ...extra,
    confirmedFields: [...CORE.confirmedFields, ...confirmed]
  });
}

function birthBlocker(result) {
  return result.blockers.find((row) => row.path === 'birthDate');
}

test('birthDate hint metadata stays readonly and is not a fill contract', () => {
  assert.equal(CMB_BIRTHDATE_HINT.key, 'birthDate');
  assert.equal(CMB_BIRTHDATE_HINT.label, '出生日期');
  assert.equal(CMB_BIRTHDATE_HINT.kind, 'DatePicker');
  assert.equal(CMB_BIRTHDATE_HINT.placeholder, '请选择日期');
  assert.equal(CMB_BIRTHDATE_HINT.readOnly, true);
  assert.equal(CMB_BIRTHDATE_HINT.syntheticDom, false);
  assert.equal(CMB_BIRTHDATE_HINT.liveFillClaimed, false);
  assert.match(CMB_BIRTHDATE_HINT.fillHint, /Never Save/);
  assert.equal(CMB_BIRTHDATE_HINT.selectId, 'resume_basicInfo_birthday');
});

test('empty birthDate is omitted; a present unconfirmed value stays profile_fact_unconfirmed', () => {
  for (const birthDate of ['', '   ', null]) {
    const absent = plan({ birthDate });
    assert.equal(absent.ok, true);
    assert.equal(absent.reason, 'profile_ready');
    assert.equal(absent.values.birthDate, undefined);
    assert.equal(absent.fields.some((row) => row.path === 'birthDate'), false);
    assert.equal(birthBlocker(absent), undefined);
  }

  const unconfirmed = plan({ birthDate: '1990-01-02' });
  assert.equal(unconfirmed.ok, true);
  assert.equal(unconfirmed.values.birthDate, undefined);
  assert.equal(unconfirmed.values.fullName, '测试甲');
  const row = birthBlocker(unconfirmed);
  assert.equal(row.reason, 'profile_fact_unconfirmed');
  assert.equal(row.value, '');
  assert.equal(row.ready, false);
  assert.equal(row.kind, 'DatePicker');
  assert.match(row.fillHint, /Never Save/);
});

test('confirmed dates and conflicting strings stay datepicker_hint_only and are not copied', () => {
  for (const birthDate of ['1990-01-02', '1990/01/02', '不是日期', ' 1990-01-02 ']) {
    const hinted = plan({ birthDate }, ['birthDate']);
    assert.equal(hinted.ok, true);
    assert.equal(hinted.reason, 'profile_ready');
    assert.equal(hinted.values.birthDate, undefined);
    assert.equal(Object.hasOwn(hinted.values, 'birthDate'), false);
    const row = birthBlocker(hinted);
    assert.equal(row.reason, 'datepicker_hint_only');
    assert.equal(row.label, '出生日期');
    assert.equal(row.value, '');
    assert.equal(row.ready, false);
    assert.equal(row.kind, 'DatePicker');
    assert.equal(row.fillHint, CMB_BIRTHDATE_HINT.fillHint);
    assert.equal(hinted.birthDateHint.readOnly, true);
    assert.equal(hinted.birthDateHint.syntheticDom, false);
    assert.equal(hinted.birthDateHint.liveFillClaimed, false);
  }
});

test('hint-only birthDate leaves first-slice and second-slice values ready', () => {
  const mixed = plan({
    ...SLICE,
    birthDate: '1990-01-02'
  }, ['gender', 'height', 'weight', 'formalWork', 'birthDate']);
  assert.equal(mixed.ok, true);
  assert.equal(mixed.values.fullName, '测试甲');
  assert.equal(mixed.values.mobile, '13800138000');
  assert.equal(mixed.values.email, 'cmb.user@example.com');
  assert.equal(mixed.values.gender, '女');
  assert.equal(mixed.values.height, '175');
  assert.equal(mixed.values.weight, '58');
  assert.equal(mixed.values.formalWork, '是');
  assert.equal(mixed.values.birthDate, undefined);
  assert.equal(birthBlocker(mixed)?.reason, 'datepicker_hint_only');
  assert.equal(mixed.blockers.some((row) => row.path === 'gender'), false);
  assert.equal(mixed.blockers.some((row) => row.path === 'height'), false);
  assert.equal(mixed.blockers.some((row) => row.path === 'weight'), false);
  assert.equal(mixed.blockers.some((row) => row.path === 'formalWork'), false);
});

test('engine has no birthDate writer, no calendar selector, and RankingMajor stays missing', () => {
  assert.doesNotMatch(source, /RankingMajor|rankingMajor/);
  assert.match(harness, /RankingMajor is DOM_CONTROL_MISSING/);
  assert.match(source, /datepicker_hint_only/);
  assert.match(source, /function birthDateHint\(/);
  assert.doesNotMatch(source, /fillBirthDate|DOB_HINT_|DOB_CONTROL_|DOB_FORMAT_/);
  assert.doesNotMatch(source, /ant-picker|ant-calendar|日历|type="date"/);
  assert.doesNotMatch(source, /click\(.*保存|保存.*\.click/);
  assert.match(source, /skippedSave:\s*true/);
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
  const dob = document.getElementById('probe-dob-readonly');
  return {
    name: textOf(byExact('姓名')),
    phone: textOf(byExact('手机号')),
    email: textOf(byExact('邮箱')),
    gender: checked(byExact('性别')),
    height: textOf(byRe(/^身高/u)),
    weight: textOf(byRe(/^体重/u)),
    formal: checked(byExact('是否参加过正式工作')),
    dobValue: dob ? dob.value : null,
    dobReadOnly: dob ? dob.readOnly === true : null,
    saveDisabled: document.getElementById('save-btn')?.disabled === true,
    saveClicks: window.__cmbSaveClicks || 0,
    calendarClicks: window.__cmbCalendarClicks || 0
  };
})()`;

test('synthetic birthDate attempt does not write, open a calendar, or clobber neighbors', { timeout: 120000 }, async () => {
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
  const userData = mkdtempSync(join(tmpdir(), 'cmb-dob-'));
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
      window.__cmbCalendarClicks = 0;
      document.addEventListener('click', (event) => {
        const el = event.target.closest && event.target.closest('button,a,input,[role=button]');
        if (el && /保存|提交|投递/.test(el.textContent || el.value || '')) window.__cmbSaveClicks += 1;
      }, true);
      const item = document.createElement('div');
      item.className = 'ant-form-item';
      item.setAttribute('data-probe', 'dob');
      item.innerHTML = '<div class="ant-form-item-label"><label>出生日期</label></div><div class="ant-form-item-control"></div>';
      const input = document.createElement('input');
      input.id = 'probe-dob-readonly';
      input.className = 'ant-input';
      input.readOnly = true;
      input.placeholder = '请选择日期';
      input.value = '';
      const button = document.createElement('button');
      button.id = 'probe-dob-calendar';
      button.type = 'button';
      button.className = 'ant-picker-suffix';
      button.textContent = '日历';
      button.addEventListener('click', () => { window.__cmbCalendarClicks += 1; });
      item.querySelector('.ant-form-item-control').append(input, button);
      document.querySelector('form.ant-form').appendChild(item);
      return true;
    })()`);

    const baseline = await evaluate(send, `ResumeCmbBasic.fillBasic({
      allowExplicitValues: true,
      fullName: '测试甲',
      mobile: '13800138000',
      email: 'cmb.fixture@example.com',
      gender: '女',
      height: '175',
      weight: '58',
      formalWork: '是'
    }, { synthetic: true })`);
    const afterBaseline = await evaluate(send, SNAPSHOT);
    assert.equal(baseline.ok, true);
    assert.equal(baseline.saved, false);
    assert.equal(baseline.skippedSave, true);
    assert.equal(afterBaseline.name, '测试甲');
    assert.equal(afterBaseline.phone, '13800138000');
    assert.equal(afterBaseline.email, 'cmb.fixture@example.com');
    assert.deepEqual(afterBaseline.gender, ['女']);
    assert.equal(afterBaseline.height, '175');
    assert.equal(afterBaseline.weight, '58');
    assert.deepEqual(afterBaseline.formal, ['是']);
    assert.equal(afterBaseline.dobValue, '');
    assert.equal(afterBaseline.dobReadOnly, true);
    assert.equal(afterBaseline.calendarClicks, 0);
    assert.equal(afterBaseline.saveClicks, 0);

    const explicit = await evaluate(send, `ResumeCmbBasic.fillBasic({
      allowExplicitValues: true,
      fullName: '改名',
      mobile: '13900000000',
      email: 'other@example.com',
      gender: '男',
      height: '180',
      weight: '70',
      formalWork: '否',
      birthDate: '1990-01-02'
    }, { synthetic: true })`);
    const afterExplicit = await evaluate(send, SNAPSHOT);
    assert.equal(explicit.ok, false);
    assert.equal(explicit.reason, 'datepicker_hint_only');
    assert.equal(explicit.writeAttempted, false);
    assert.deepEqual(explicit.results, []);
    assert.equal(explicit.saved, false);
    assert.equal(explicit.skippedSave, true);
    assert.equal(explicit.birthDateHint.reason, 'datepicker_hint_only');
    assert.equal(explicit.birthDateHint.readOnly, true);
    assert.equal(explicit.birthDateHint.syntheticDom, false);
    assert.equal(explicit.birthDateHint.liveFillClaimed, false);
    assert.equal(explicit.birthDateHint.writeAttempted, false);
    assert.equal(explicit.birthDateHint.saved, false);
    assert.match(explicit.birthDateHint.fillHint, /Never Save/);
    assert.equal(afterExplicit.name, '测试甲');
    assert.equal(afterExplicit.phone, '13800138000');
    assert.equal(afterExplicit.email, 'cmb.fixture@example.com');
    assert.deepEqual(afterExplicit.gender, ['女']);
    assert.equal(afterExplicit.height, '175');
    assert.equal(afterExplicit.weight, '58');
    assert.deepEqual(afterExplicit.formal, ['是']);
    assert.equal(afterExplicit.dobValue, '');
    assert.equal(afterExplicit.dobReadOnly, true);
    assert.equal(afterExplicit.calendarClicks, 0);
    assert.equal(afterExplicit.saveDisabled, true);
    assert.equal(afterExplicit.saveClicks, 0);

    const planned = await evaluate(send, `ResumeCmbBasic.planFromProfile({
      fullName: '测试甲',
      phone: '13800138000',
      email: 'cmb.fixture@example.com',
      gender: '女',
      height: '175',
      weight: '58',
      formalWork: '是',
      birthDate: '1990/01/02',
      confirmedFields: ['fullName', 'phone', 'email', 'gender', 'height', 'weight', 'formalWork', 'birthDate']
    })`);
    assert.equal(planned.ok, true);
    assert.equal(planned.values.birthDate, undefined);
    assert.equal(planned.values.gender, '女');
    assert.equal(planned.values.height, '175');
    assert.equal(planned.blockers.find((row) => row.path === 'birthDate')?.reason, 'datepicker_hint_only');

    const profileFill = await evaluate(send, `ResumeCmbBasic.fillBasic({
      profile: {
        fullName: '测试甲',
        phone: '13800138000',
        email: 'cmb.fixture@example.com',
        gender: '女',
        height: '175',
        weight: '58',
        formalWork: '是',
        birthDate: '不是日期',
        confirmedFields: ['fullName', 'phone', 'email', 'gender', 'height', 'weight', 'formalWork', 'birthDate']
      }
    }, { synthetic: true })`);
    const hintOnly = await evaluate(send, `ResumeCmbBasic.birthDateHint()`);
    const afterProfile = await evaluate(send, SNAPSHOT);
    assert.equal(profileFill.ok, true);
    assert.equal(profileFill.saved, false);
    assert.equal(profileFill.skippedSave, true);
    assert.equal(profileFill.results.some((row) => row.label === '出生日期'), false);
    assert.equal(hintOnly.ok, false);
    assert.equal(hintOnly.reason, 'datepicker_hint_only');
    assert.equal(hintOnly.writeAttempted, false);
    assert.equal(hintOnly.saved, false);
    assert.equal(hintOnly.skippedSave, true);
    assert.equal(afterProfile.name, '测试甲');
    assert.equal(afterProfile.phone, '13800138000');
    assert.equal(afterProfile.email, 'cmb.fixture@example.com');
    assert.deepEqual(afterProfile.gender, ['女']);
    assert.equal(afterProfile.height, '175');
    assert.equal(afterProfile.weight, '58');
    assert.deepEqual(afterProfile.formal, ['是']);
    assert.equal(afterProfile.dobValue, '');
    assert.equal(afterProfile.dobReadOnly, true);
    assert.equal(afterProfile.calendarClicks, 0);
    assert.equal(afterProfile.saveDisabled, true);
    assert.equal(afterProfile.saveClicks, 0);
  } finally {
    try { socket?.close(); } catch { /* ignore */ }
    try { child.kill(); } catch { /* ignore */ }
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});
