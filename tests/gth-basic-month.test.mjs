// Direct product trials against the existing Element-UI month DOM, under the
// shipped full-resume Never-Save guard and its MAIN-world model bridge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { buildPageExpression } from '../scripts/live/lib/gth-full-page.mjs';
import { chromeShimExpression } from '../scripts/live/lib/gth-full-sections.mjs';

const source = readFileSync(new URL('../src/content/gth-basic.js', import.meta.url), 'utf8');
const PAGE = 'https://hr.gtht.com/resume/edit/';
const TITLES = ['基本信息', '教育经历', '求职意向', '工作经验', '职业技能与特长', '附件简历', '其他信息'];
const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const binding = { version: 1, epoch: '00000000-0000-4000-8000-000000000001', profileHash: 'a'.repeat(64) };
const item = (label, body) => `<div class="el-form-item"><label class="el-form-item__label">${label}</label><div class="el-form-item__content">${body}</div></div>`;
// Closed probe shell so 现居住地 passes structure preflight without a fill.
const residenceShell = () => `<div class="el-form-item"><label for="resume_residence_area" class="el-form-item__label">现居住地</label><div class="el-form-item__content cascader-wrap"><div class="input-l pointer"><div class="input-l pointer el-input"><input class="el-input__inner" type="text" readonly placeholder="请选择" value=""></div></div><div class="dialog-wrap plugin-dialog-wrap popover blue" style="display:none"><ul class="selected-view-data"></ul><div class="search-outer"><input class="search-input" type="text" placeholder="请输入关键字"></div><div class="eo-cascader-panel"><div class="eo-cascader-menu simple-tree-outer"><ul class="simple-tree-wrapper"><li class="branch has-child"><span uid="86030000">北京</span></li></ul></div></div><a class="confirm pop-btn" href="javascript:;">确定</a><a class="cancel pop-btn" href="javascript:;">取消</a></div></div></div>`;
const radio = (text, checked) => `<label class="el-radio"><span class="el-radio__input"><input type="radio" name="gender" value="${text}"${checked ? ' checked' : ''}></span><span class="el-radio__label">${text}</span></label>`;
function html(value) {
  const fields = [
    item('姓名', '<input type="text" id="name" value="旧姓名">'),
    item('性别', `<div class="el-radio-group">${radio('男', false)}${radio('女', true)}</div>`),
    item('手机号码', '<input type="text" value="13800138000">'),
    item('出生年月', `<div class="el-date-editor date-hl el-input el-input--prefix el-input--suffix el-date-editor--month"><span class="el-input__prefix"><i class="el-input__icon el-icon-date" id="month-icon"></i></span><input class="el-input__inner" type="text" readonly id="birth" value="${value}"></div>`),
    item('电子邮件', '<input type="text" value="synthetic@example.com">'),
    // Residence uses the 2026-10-23 probe shell. This file does not fill it.
    // Work-start uses the 2026-10-22 probe's readonly month editor.
    residenceShell(),
    item('最高学历', '<div class="el-select"><input class="el-input__inner" type="text" readonly value="硕士"></div>'),
    item('照片', ''),
    item('参加工作时间', '<div class="el-date-editor el-date-editor--month input-l"><span class="el-input__prefix"><i class="el-input__icon el-icon-date" id="work-start-icon"></i></span><input class="el-input__inner" type="text" readonly id="work-start" value="2022-09"></div>'),
  ].join('');
  return `<!doctype html><body>${TITLES.map((title, i) => `<section class="r-section"><div class="title_">${title}</div>${i === 0 ? `<div class="sec-context" id="original-display" style="display:none">2022.09</div><form class="el-form sec-form">${fields}<button type="button" id="cancel">取消</button><button type="button">保存</button><button type="button">提交</button><button type="button">投递</button><button type="button">删除</button></form>` : ''}</section>`).join('')}
    <div class="el-picker-panel el-date-picker" id="panel" style="display:none"><div class="el-date-picker__header"><i class="el-icon-d-arrow-left" id="prev"></i><span class="el-date-picker__header-label" id="year">2000 年</span><i class="el-icon-d-arrow-right" id="next"></i></div><table class="el-month-table"><tbody><tr>${MONTHS.map(name => `<td><div><a class="cell">${name}</a></div></td>`).join('')}</tr></tbody></table></div></body>`;
}
async function boot(options = {}) {
  const dom = new JSDOM(html(options.initial ?? '1997-04'), { url: PAGE, pretendToBeVisual: true, runScripts: 'dangerously' });
  const { window } = dom;
  const { document } = window;
  window.Element.prototype.getClientRects = function () {
    for (let node = this; node?.nodeType === 1; node = node.parentElement) {
      if (node.style.display === 'none') return [];
    }
    return [{ width: 8, height: 8 }];
  };
  Object.defineProperty(document, 'readyState', { configurable: true, get: () => 'complete' });
  if (options.replaceExisting === false) {
    document.getElementById('name').value = '';
    for (const control of document.querySelectorAll('input[type="radio"]')) control.checked = false;
  }
  const input = document.getElementById('birth');
  const workInput = document.getElementById('work-start');
  const panel = document.getElementById('panel');
  const year = document.getElementById('year');
  const stats = { anchors: 0, cells: 0, accepted: 0, dismissed: 0, years: 0, opened: [], acceptedFields: [], finalMutations: 0 };
  const models = new Map([[input, input.value], [workInput, workInput.value]]);
  let activeInput = input;
  const desired = month => `${year.textContent.match(/\d{4}/u)[0]}-${String(month + 1).padStart(2, '0')}`;
  const accept = (month, control = activeInput) => {
    stats.accepted += 1;
    stats.acceptedFields.push(control.id);
    const model = options.refuseModel ? '1999-01' : desired(month);
    models.set(control, model);
    control.value = model;
  };
  if (!options.noVue) {
    panel.__vue__ = { selectionMode: 'month', year: 2000, handleMonthPick: accept };
    for (const control of [input, workInput]) control.closest('.el-date-editor').__vue__ = {
      emitInput(date) { accept(date.getMonth(), control); },
    };
  }
  for (const [id, control, initialYear] of [['month-icon', input, 2000], ['work-start-icon', workInput, 2022]]) {
    document.getElementById(id).addEventListener('click', () => {
      activeInput = control;
      stats.opened.push(control.id);
      panel.style.display = 'block';
      year.textContent = `${initialYear} 年`;
      if (panel.__vue__) panel.__vue__.year = initialYear;
      if (options.clearOnOpen) control.value = '';
    });
  }
  for (const [id, delta] of [['prev', -1], ['next', 1]]) document.getElementById(id).addEventListener('click', () => {
    const next = Number(year.textContent.match(/\d{4}/u)[0]) + delta * (options.badYearStep ? 10 : 1);
    year.textContent = `${next} 年`;
    if (panel.__vue__) panel.__vue__.year = next;
    stats.years += 1;
  });
  for (const [month, cell] of [...panel.querySelectorAll('td')].entries()) {
    cell.querySelector('a').addEventListener('click', () => {
      stats.anchors += 1;
      if (!options.tdOnly) activeInput.value = desired(month); // paint without model acceptance
      if (options.removeOnClick) panel.remove();
    });
    cell.addEventListener('click', event => {
      if (event.target !== cell) return;
      stats.cells += 1;
      activeInput.value = desired(month);
    });
  }
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    activeInput.value = models.get(activeInput);
    panel.style.display = 'none';
    stats.dismissed += 1;
  });
  document.getElementById('cancel').addEventListener('click', event => {
    event.target.closest('form').remove();
    document.getElementById('original-display').style.display = 'block';
  });
  window.eval(buildPageExpression({ waitTimeoutMs: 30, pollMs: 1 }));
  window.eval(chromeShimExpression());
  if (options.finalReadbackMutation) {
    const sendMessage = window.chrome.runtime.sendMessage;
    window.chrome.runtime.sendMessage = async message => {
      // The closing action has completed and removed the bridge markers. The
      // next binding await is the writer's final one before returning success.
      if (message?.type === 'RESUME_PROFILE_BINDING_CHECK' && stats.dismissed > 0
        && panel.style.display === 'none' && !document.querySelector('[data-gth-month-role]') && !stats.finalMutations) {
        stats.finalMutations += 1;
        if (options.finalReadbackMutation === 'value') input.value = '2001-01';
        else if (options.finalReadbackMutation === 'validation') input.setAttribute('aria-invalid', 'true');
        else document.querySelectorAll('.r-section')[1].appendChild(document.createElement('form'));
      }
      return sendMessage(message);
    };
  }
  window.eval(source);
  assert.equal((await window.__gthFullLive.open(0)).ok, true);
  const request = {
    requestId: 'basic-month-trial-0001', profileBinding: binding, replaceExisting: options.replaceExisting ?? true, educationIndex: 0,
    profile: { fullName: 'Synthetic Customer B', gender: '男', birthDate: options.answer ?? '1998-06',
      education: [{ degree: '硕士' }], confirmedFields: ['fullName', 'gender', 'birthDate', 'education.0.degree'] },
  };
  if (options.workStart !== undefined) {
    request.profile.workStart = options.workStart;
    if (options.confirmWorkStart !== false) request.profile.confirmedFields.push('workStart');
  }
  if (options.onlyField) {
    const fields = {
      fullName: [document.getElementById('name'), '旧姓名', 'fullName'],
      gender: [document.querySelector('input[type="radio"]:checked'), '女', 'gender'],
      birthDate: [input, request.profile.birthDate, 'birthDate'],
      degree: [document.querySelector('.el-select input'), '硕士', 'education.0.degree'],
      workStart: [workInput, request.profile.workStart, 'workStart'],
    };
    const [control, value, path] = fields[options.onlyField];
    request.profile = { education: [{}], confirmedFields: [path] };
    if (options.onlyField === 'degree') request.profile.education[0].degree = value;
    else request.profile[options.onlyField] = value;
    if (options.validation === 'aria-invalid') control.setAttribute('aria-invalid', 'true');
    else if (options.validation === 'native-invalid') control.setCustomValidity('Invalid month');
    else if (options.validation) control.closest('.el-form-item').classList.add(options.validation);
  }
  return { dom, window, document, input, workInput, panel, stats, request };
}
async function run(options, verify) {
  const h = await boot(options);
  try {
    const result = await h.window.ResumeGthBasic.trial(h.request);
    await verify(h, result);
    if (result.ok) assert.equal(result.fields.length, 8);
    assert.equal(h.window.__gthFullLive.clicks().some(row => row.allowed !== true), false);
    assert.equal(h.window.__gthFullLive.clicks().some(row => /保存|提交|投递|删除/u.test(row.label)), false);
    assert.equal(result.softwareClickedSave, false);
    assert.equal(result.softwareClickedSubmit, false);
    assert.equal(result.softwareClickedDelete, false);
    assert.equal(result.liveSupportClaimed, false);
    assert.equal(h.document.querySelector('[data-gth-month-role]'), null);
    const city = result.coverage.find(row => row.question === '现居住地');
    assert.equal(city.supported, true);
    assert.equal(city.path, 'currentCity');
    assert.ok(['missing_profile_value', 'not_run'].includes(city.reason), city.reason);
    assert.equal(result.coverage.find(row => row.question === '照片').reason, 'control_not_supported');
    assert.equal(result.coverage.find(row => row.question === '参加工作时间').path, 'workStart');
    assert.equal(result.coverage.find(row => row.question === '参加工作时间').supported, true);
  } finally {
    h.window.__gthFullLive.restore();
    h.window.__gthFullResumeChromeRestore();
    h.dom.window.close();
  }
}
function assertNameGender(h, result) {
  assert.equal(h.document.getElementById('name').value, 'Synthetic Customer B');
  assert.equal(h.document.querySelector('input[type="radio"]:checked').value, '男');
  for (const question of ['姓名', '性别']) assert.equal(result.fields.find(row => row.question === question)?.status, 'verified');
}

test('basic name/gender and birth month navigate the existing picker under full Never-Save guard', async () => {
  await run({}, (h, result) => {
    assert.equal(result.ok, true, JSON.stringify(result));
    assertNameGender(h, result);
    assert.equal(result.fields.find(row => row.question === '出生年月').status, 'verified');
    assert.equal(h.input.value, '1998-06');
    assert.equal(h.stats.years, 2);
    assert.equal(h.stats.anchors, 1);
    assert.equal(h.stats.accepted, 1);
    assert.equal(h.stats.dismissed > 0, true);
  });
});

test('birth month retries the connected TD when its anchor does not commit', async () => {
  await run({ initial: '', tdOnly: true, clearOnOpen: true, replaceExisting: false }, (h, result) => {
    assert.equal(result.ok, true, JSON.stringify(result));
    assertNameGender(h, result);
    assert.equal(h.input.value, '1998-06');
    assert.equal(h.stats.anchors, 1);
    assert.equal(h.stats.cells, 1);
    assert.equal(h.stats.accepted, 1);
  });
});

test('birth month accepts through the editor bridge after the panel unmounts', async () => {
  await run({ removeOnClick: true }, (h, result) => {
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(h.panel.isConnected, false);
    assert.equal(h.input.value, '1998-06');
    assert.equal(h.stats.accepted, 1);
  });
});

test('painted birth month fails readback when closing restores the unaccepted model', async () => {
  await run({ noVue: true }, (h, result) => {
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'basic_readback_mismatch');
    assert.equal(h.input.value, '1997-04');
    assertNameGender(h, result);
  });
});

test('birth month fails closed on a model mismatch or unexpected year jump', async () => {
  await run({ refuseModel: true }, (_h, result) => {
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'basic_readback_mismatch');
  });
  await run({ badYearStep: true }, (h, result) => {
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'basic_month_navigation_unknown');
    assert.equal(h.stats.anchors, 0);
    assertNameGender(h, result);
  });
});

test('preexisting matching month verifies without reopening or model acceptance', async () => {
  await run({ initial: '1998-06' }, (h, result) => {
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.fields.find(row => row.question === '出生年月').reason, 'preexisting_same_value');
    assert.equal(h.stats.anchors, 0);
    assert.equal(h.stats.years, 0);
    assert.equal(h.stats.accepted, 0);
    assertNameGender(h, result);
  });
});

test('matching basic facts with site validation failures are never verified', async () => {
  // Reuse the probed month controls and the validation states already exercised
  // by the GTH work/education fixtures. Matching DOM text is insufficient.
  for (const [onlyField, question] of [['fullName', '姓名'], ['gender', '性别'], ['birthDate', '出生年月'],
    ['degree', '最高学历'], ['workStart', '参加工作时间']]) {
    for (const validation of ['is-error', 'is-validating', 'aria-invalid', 'native-invalid']) {
      await run({ onlyField, validation, initial: '1998-06', workStart: '2022-09' }, (h, result) => {
        assert.equal(result.ok, false, `${question}: ${validation}`);
        assert.equal(result.reason, 'basic_site_validation_failed');
        assert.equal(result.activeField, onlyField);
        assert.equal(result.writeStarted, false);
        assert.equal(result.fields.some(row => row.question === question && row.status === 'verified'), false);
        assert.deepEqual(h.stats.opened, []);
        assert.equal(h.stats.accepted, 0);
        assert.equal(h.input.value, '1998-06');
        assert.equal(h.workInput.value, '2022-09');
      });
    }
  }
});

test('valid matching text, radio, select, and month facts remain verified without reopening', async () => {
  for (const [onlyField, question] of [['fullName', '姓名'], ['gender', '性别'], ['birthDate', '出生年月'],
    ['degree', '最高学历'], ['workStart', '参加工作时间']]) {
    await run({ onlyField, initial: '1998-06', workStart: '2022-09' }, (h, result) => {
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.fields.find(row => row.question === question).reason, 'preexisting_same_value');
      assert.equal(result.writeStarted, false);
      assert.deepEqual(h.stats.opened, []);
      assert.equal(h.stats.accepted, 0);
    });
  }
});

test('a verified birth month changed during the final binding await cannot return success', async () => {
  for (const finalReadbackMutation of ['value', 'validation', 'foreign-editor']) {
    await run({ onlyField: 'birthDate', finalReadbackMutation }, (h, result) => {
      assert.equal(h.stats.finalMutations, 1);
      assert.equal(h.stats.accepted, 1);
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'basic_other_values_changed');
      assert.equal(result.writeStarted, true);
      assert.equal(result.supportedComplete, false);
      assert.equal(result.operableComplete, false);
      assert.equal(result.fields.some(row => row.status === 'verified'), false);
      assert.equal(result.coverage.some(row => row.status === 'verified'), false);
      assert.equal(result.completedFields.some(row => row.status === 'verified'), false);
    });
  }
});


test('birth dates normalize to a calendar month and invalid days never open the picker', async () => {
  await run({ answer: '2000-02-29' }, (h, result) => {
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(h.input.value, '2000-02');
    assert.equal(result.fields.find(row => row.question === '出生年月').status, 'verified');
  });
  await run({ answer: '1998-02-30' }, (h, result) => {
    assert.equal(result.fields.find(row => row.question === '出生年月').reason, 'invalid_profile_value');
    assert.equal(h.stats.anchors, 0);
    assert.equal(h.stats.years, 0);
    assert.equal(h.stats.accepted, 0);
    assertNameGender(h, result);
  });
});

test('confirmed workStart shares the birth-month path and 取消 restores the observed 2022.09 display', async () => {
  await run({ workStart: '2022-01' }, async (h, result) => {
    assert.equal(result.ok, true, JSON.stringify(result));
    assertNameGender(h, result);
    assert.equal(h.input.value, '1998-06');
    assert.equal(h.workInput.value, '2022-01');
    const work = result.fields.find(row => row.question === '参加工作时间');
    assert.equal(work.path, 'workStart');
    assert.equal(work.status, 'verified');
    assert.equal(work.reason, 'readback_reapplied');
    assert.deepEqual(h.stats.opened, ['birth', 'work-start']);
    assert.deepEqual(h.stats.acceptedFields, ['birth', 'work-start']);
    const beforeCancel = h.window.__gthFullLive.read(0, ['出生年月', '参加工作时间']);
    assert.deepEqual(Array.from(beforeCancel.readback, row => row.value), ['1998-06', '2022-01']);
    const cancel = await h.window.__gthFullLive.cancel(0);
    assert.equal(cancel.ok, true);
    assert.equal(cancel.closed, true);
    assert.equal(h.document.querySelector('form'), null);
    assert.equal(h.document.getElementById('original-display').textContent, '2022.09');
    assert.equal(h.document.getElementById('original-display').style.display, 'block');
  });
});

test('missing or unconfirmed workStart never opens its month picker', async () => {
  for (const [options, reason] of [[{}, 'missing_profile_value'], [{ workStart: '2022-01', confirmWorkStart: false }, 'profile_fact_unconfirmed']]) {
    await run(options, (h, result) => {
      assert.equal(result.ok, true, JSON.stringify(result));
      const work = result.fields.find(row => row.question === '参加工作时间');
      assert.equal(work.status, 'skipped');
      assert.equal(work.reason, reason);
      assert.equal(h.workInput.value, '2022-09');
      assert.deepEqual(h.stats.opened, ['birth']);
      assertNameGender(h, result);
    });
  }
});

test('workStart requires a valid explicit YYYY-MM source and does not normalize a full date', async () => {
  for (const workStart of ['2022-00', '2022-13', '2022-01-15', '2022.01', '1899-01', '2100-01']) {
    await run({ workStart, initial: '1998-06' }, (h, result) => {
      assert.equal(result.ok, true, JSON.stringify(result));
      const work = result.fields.find(row => row.question === '参加工作时间');
      assert.equal(work.status, 'skipped');
      assert.equal(work.reason, 'invalid_profile_value');
      assert.equal(h.workInput.value, '2022-09');
      assert.deepEqual(h.stats.opened, []);
      assertNameGender(h, result);
    });
  }
});

// Reuse the checked-in basic editor and its name input. These mutations happen
// while the profile-binding check is pending, after the earlier field guard.
async function nameActionTrial({ initial = '', replaceExisting = false, bindingAt = 2, mutate, refuseBinding = false } = {}, verify) {
  const h = await boot({ replaceExisting, onlyField: 'fullName' });
  const name = h.document.getElementById('name');
  const answer = 'Synthetic Customer B';
  name.value = initial;
  h.request.profile.fullName = answer;
  const events = [];
  for (const type of ['input', 'change']) name.addEventListener(type, () => events.push(type));
  const sendMessage = h.window.chrome.runtime.sendMessage;
  let bindingChecks = 0;
  h.window.chrome.runtime.sendMessage = async message => {
    if (message?.type === 'RESUME_PROFILE_BINDING_CHECK' && ++bindingChecks === bindingAt) {
      mutate?.(h, name);
      if (refuseBinding) return { allowed: false };
    }
    return sendMessage(message);
  };
  try {
    const result = await h.window.ResumeGthBasic.trial(h.request);
    await verify({ ...h, name, answer, events, bindingChecks }, result);
    assert.equal(result.complete, false);
    assert.equal(result.liveSupportClaimed, false);
    assert.equal(result.softwareClickedSave, false);
    assert.equal(result.softwareClickedSubmit, false);
    assert.equal(result.softwareClickedDelete, false);
    assert.equal(h.window.__gthFullLive.clicks().some(row => row.allowed !== true), false);
    assert.equal(h.window.__gthFullLive.clicks().some(row => /保存|提交|投递|删除/u.test(row.label)), false);
    if (!result.ok) {
      assert.equal(result.fields.some(row => row.path === 'fullName' && row.status === 'verified'), false);
      assert.equal(result.coverage.some(row => row.path === 'fullName' && row.status === 'verified'), false);
      assert.equal(result.completedFields.some(row => row.key === 'fullName' && row.status === 'verified'), false);
    }
  } finally {
    h.window.__gthFullLive.restore();
    h.window.__gthFullResumeChromeRestore();
    h.dom.window.close();
  }
}

test('name binding checks preserve applicant edits before an empty fill or overwrite', async () => {
  for (const options of [{ initial: '', replaceExisting: false }, { initial: 'Previous name', replaceExisting: true }]) {
    await nameActionTrial({ ...options, mutate: (_h, name) => { name.value = 'Applicant manual edit'; } }, (h, result) => {
      assert.equal(result.ok, false);
      assert.equal(result.writeStarted, false);
      assert.equal(h.name.value, 'Applicant manual edit');
      assert.deepEqual(h.events, []);
    });
  }
});

test('name binding checks preserve a peer edited before the native setter', async () => {
  await nameActionTrial({ mutate: h => { h.workInput.value = '2024-03'; } }, (h, result) => {
    assert.equal(result.ok, false);
    assert.equal(result.writeStarted, false);
    assert.equal(h.name.value, '');
    assert.equal(h.workInput.value, '2024-03');
    assert.deepEqual(h.events, []);
  });
});

test('name binding checks revalidate disabled, readonly, and length constraints before writing', async () => {
  for (const mutate of [(_h, name) => { name.disabled = true; }, (_h, name) => { name.readOnly = true; },
    (_h, name) => { name.maxLength = 3; }]) {
    await nameActionTrial({ mutate }, (h, result) => {
      assert.equal(result.ok, false);
      assert.equal(result.writeStarted, false);
      assert.equal(h.name.value, '');
      assert.deepEqual(h.events, []);
    });
  }
});

test('name binding checks refuse a replaced or reparented input without starting a write', async () => {
  for (const mutate of [(_h, name) => { name.replaceWith(name.cloneNode(true)); },
    (h, name) => { h.document.querySelectorAll('.r-section')[1].append(name); }]) {
    await nameActionTrial({ mutate }, (h, result) => {
      assert.equal(result.ok, false);
      assert.equal(result.writeStarted, false);
      assert.equal(h.name.value, '');
      assert.equal(h.document.getElementById('name').value, '');
      assert.deepEqual(h.events, []);
    });
  }
});

test('name binding checks preserve edits before input and change events', async () => {
  for (const [bindingAt, expectedEvents] of [[3, []], [4, ['input']]]) {
    await nameActionTrial({ bindingAt, mutate: (_h, name) => { name.value = 'Applicant manual edit'; } }, (h, result) => {
      assert.equal(result.ok, false);
      assert.equal(result.writeStarted, true);
      assert.equal(h.name.value, 'Applicant manual edit');
      assert.deepEqual(h.events, expectedEvents);
    });
  }
});

test('name binding refusal before the setter reports no write', async () => {
  await nameActionTrial({ refuseBinding: true }, (h, result) => {
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'profile_binding_changed');
    assert.equal(result.writeStarted, false);
    assert.equal(h.name.value, '');
    assert.deepEqual(h.events, []);
  });
});

test('name native fills still verify blank and explicitly overwritten values', async () => {
  for (const options of [{ initial: '', replaceExisting: false }, { initial: 'Previous name', replaceExisting: true }]) {
    await nameActionTrial(options, (h, result) => {
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.writeStarted, true);
      assert.equal(h.name.value, h.answer);
      assert.deepEqual(h.events, ['input', 'change']);
      assert.equal(result.fields.find(row => row.path === 'fullName').reason,
        options.initial ? 'readback_reapplied' : 'readback_matched');
    });
  }
});

// Reuse the same checked-in gender group. A binding check may yield after the
// field decision but before the radio label click, just as for the name setter.
async function genderActionTrial({ initial = '', replaceExisting = false, mutate, refuseBinding = false } = {}, verify) {
  const h = await boot({ replaceExisting, onlyField: 'gender' });
  const radios = [...h.document.querySelectorAll('input[type="radio"]')];
  const [male, female] = radios;
  const label = male.closest('label.el-radio');
  for (const control of radios) control.checked = control.value === initial;
  h.request.profile.gender = '男';
  let clicks = 0, bindingChecks = 0;
  label.addEventListener('click', () => { clicks += 1; });
  const sendMessage = h.window.chrome.runtime.sendMessage;
  h.window.chrome.runtime.sendMessage = async message => {
    if (message?.type === 'RESUME_PROFILE_BINDING_CHECK' && ++bindingChecks === 2) {
      mutate?.({ ...h, male, female, label });
      if (refuseBinding) return { allowed: false };
    }
    return sendMessage(message);
  };
  try {
    const result = await h.window.ResumeGthBasic.trial(h.request);
    await verify({ ...h, male, female, label, clicks, bindingChecks }, result);
    assert.equal(result.complete, false);
    assert.equal(result.liveSupportClaimed, false);
    assert.equal(result.softwareClickedSave, false);
    assert.equal(result.softwareClickedSubmit, false);
    assert.equal(result.softwareClickedDelete, false);
    assert.equal(h.window.__gthFullLive.clicks().some(row => row.allowed !== true), false);
    assert.equal(h.window.__gthFullLive.clicks().some(row => /保存|提交|投递|删除/u.test(row.label)), false);
    if (!result.ok) {
      assert.equal(result.fields.some(row => row.path === 'gender' && row.status === 'verified'), false);
      assert.equal(result.coverage.some(row => row.path === 'gender' && row.status === 'verified'), false);
      assert.equal(result.completedFields.some(row => row.key === 'gender' && row.status === 'verified'), false);
    }
  } finally {
    h.window.__gthFullLive.restore();
    h.window.__gthFullResumeChromeRestore();
    h.dom.window.close();
  }
}

function assertGenderStopped(h, result) {
  assert.equal(result.ok, false);
  assert.equal(result.writeStarted, false);
  assert.equal(result.activeField, 'gender');
  assert.equal(result.selectorStep, 'gender_option_click');
  assert.equal(h.clicks, 0);
}

test('gender binding checks preserve a new selection before empty fill or overwrite', async () => {
  for (const options of [
    { initial: '', replaceExisting: false, next: '女' },
    { initial: '女', replaceExisting: true, next: '' },
    { initial: '', replaceExisting: false, next: '男' },
  ]) {
    await genderActionTrial({ ...options, mutate: ({ male, female }) => {
      male.checked = options.next === '男';
      female.checked = options.next === '女';
    } }, (h, result) => {
      assertGenderStopped(h, result);
      assert.equal(h.male.checked, options.next === '男');
      assert.equal(h.female.checked, options.next === '女');
      assert.equal(result.reason, 'basic_other_values_changed');
    });
  }
});

test('gender binding checks preserve a peer edited before the option click', async () => {
  await genderActionTrial({ mutate: h => { h.workInput.value = '2024-03'; } }, (h, result) => {
    assertGenderStopped(h, result);
    assert.equal(h.workInput.value, '2024-03');
    assert.equal(h.male.checked, false);
    assert.equal(result.reason, 'basic_other_values_changed');
  });
});

test('gender binding checks revalidate option state and captions before clicking', async () => {
  for (const mutate of [
    h => { h.male.disabled = true; },
    h => { h.label.classList.add('is-disabled'); },
    h => { h.label.setAttribute('aria-disabled', 'true'); },
    h => { h.label.style.display = 'none'; },
    h => {
      h.label.querySelector('.el-radio__label').textContent = '女';
      h.female.closest('label').querySelector('.el-radio__label').textContent = '男';
    },
  ]) {
    await genderActionTrial({ mutate }, (h, result) => {
      assertGenderStopped(h, result);
      assert.equal(h.male.checked, false);
    });
  }
});

test('gender binding checks refuse replaced or reparented options before clicking', async () => {
  for (const mutate of [
    h => { h.label.replaceWith(h.label.cloneNode(true)); },
    h => { h.document.querySelectorAll('.r-section')[1].append(h.label); },
    h => {
      const replacement = h.label.cloneNode(true);
      replacement.querySelector('input').replaceWith(h.male);
      h.label.replaceWith(replacement);
    },
  ]) {
    await genderActionTrial({ mutate }, (h, result) => {
      assertGenderStopped(h, result);
      assert.equal(h.male.checked, false);
    });
  }
});

test('gender binding refusal before the click reports no write', async () => {
  await genderActionTrial({ refuseBinding: true }, (h, result) => {
    assertGenderStopped(h, result);
    assert.equal(result.reason, 'profile_binding_changed');
    assert.equal(h.male.checked, false);
  });
});

test('gender radio fills still verify blank and explicitly overwritten values', async () => {
  for (const options of [{ initial: '', replaceExisting: false }, { initial: '女', replaceExisting: true }]) {
    await genderActionTrial(options, (h, result) => {
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.writeStarted, true);
      assert.ok(h.clicks > 0);
      assert.equal(h.male.checked, true);
      assert.equal(h.female.checked, false);
      assert.equal(result.fields.find(row => row.path === 'gender').reason,
        options.initial ? 'readback_reapplied' : 'readback_matched');
    });
  }
});

// Highest qualification reuses the checked-in basic editor select shell. These
// cases stop at the opener: no new degree menu or option DOM is introduced.
async function degreeOpenTrial({ initial = '', replaceExisting = false, mutate, refuseBinding = false } = {}, verify) {
  const h = await boot({ replaceExisting, onlyField: 'degree' });
  const degree = h.document.querySelector('.el-select input');
  const select = degree.closest('.el-select');
  const item = degree.closest('.el-form-item');
  const form = degree.closest('form');
  const answer = h.request.profile.education[0].degree;
  degree.value = initial;
  let clicks = 0, bindingChecks = 0;
  degree.addEventListener('click', () => { clicks += 1; });
  const sendMessage = h.window.chrome.runtime.sendMessage;
  h.window.chrome.runtime.sendMessage = async message => {
    if (message?.type === 'RESUME_PROFILE_BINDING_CHECK' && ++bindingChecks === 2) {
      mutate?.({ ...h, degree, select, item, form, answer });
      if (refuseBinding) return { allowed: false };
    }
    return sendMessage(message);
  };
  try {
    const result = await h.window.ResumeGthBasic.trial(h.request);
    await verify({ ...h, degree, select, item, form, answer, clicks, bindingChecks }, result);
    assert.equal(result.complete, false);
    assert.equal(result.liveSupportClaimed, false);
    assert.equal(result.softwareClickedSave, false);
    assert.equal(result.softwareClickedSubmit, false);
    assert.equal(result.softwareClickedDelete, false);
    assert.equal(h.window.__gthFullLive.clicks().some(row => row.allowed !== true), false);
    assert.equal(h.window.__gthFullLive.clicks().some(row => /保存|提交|投递|删除/u.test(row.label)), false);
    assert.equal(result.fields.some(row => row.path === 'education.0.degree' && row.status === 'verified'), false);
    assert.equal(result.coverage.some(row => row.path === 'education.0.degree' && row.status === 'verified'), false);
    assert.equal(result.completedFields.some(row => row.key === 'degree' && row.status === 'verified'), false);
  } finally {
    h.window.__gthFullLive.restore();
    h.window.__gthFullResumeChromeRestore();
    h.dom.window.close();
  }
}

function assertDegreeOpenStopped(h, result) {
  assert.equal(result.ok, false);
  assert.equal(result.writeStarted, false);
  assert.equal(result.activeField, 'degree');
  assert.equal(result.selectorStep, 'degree_open');
  assert.equal(h.bindingChecks, 2);
  assert.equal(h.clicks, 0);
}

test('degree opener binding checks preserve applicant edits before empty fill or overwrite', async () => {
  for (const options of [
    { initial: '', replaceExisting: false, next: '博士' },
    { initial: '本科', replaceExisting: true, next: '博士' },
    { initial: '本科', replaceExisting: true, next: '' },
    { initial: '', replaceExisting: false, next: '硕士' },
  ]) {
    await degreeOpenTrial({ ...options, mutate: ({ degree }) => { degree.value = options.next; } }, (h, result) => {
      assertDegreeOpenStopped(h, result);
      assert.equal(h.degree.value, options.next);
    });
  }
});

test('degree opener binding checks preserve a peer edited before the click', async () => {
  await degreeOpenTrial({ mutate: h => { h.workInput.value = '2024-03'; } }, (h, result) => {
    assertDegreeOpenStopped(h, result);
    assert.equal(h.degree.value, '');
    assert.equal(h.workInput.value, '2024-03');
  });
});

test('degree opener binding checks refuse replaced, reparented, or rewrapped targets', async () => {
  for (const mutate of [
    h => { h.degree.replaceWith(h.degree.cloneNode(true)); },
    h => { h.document.querySelectorAll('.r-section')[1].append(h.degree); },
    h => {
      const replacement = h.select.cloneNode(true);
      replacement.querySelector('input').replaceWith(h.degree);
      h.select.replaceWith(replacement);
    },
  ]) {
    await degreeOpenTrial({ mutate }, (h, result) => {
      assertDegreeOpenStopped(h, result);
      assert.equal(h.degree.value, '');
    });
  }
});

test('degree opener binding checks revalidate disabled state on control and ancestors', async () => {
  for (const target of ['degree', 'item', 'select', 'form']) {
    for (const state of ['disabled', 'aria-disabled', 'is-disabled', 'disabled-class']) {
      await degreeOpenTrial({ mutate: h => {
        if (state === 'is-disabled' || state === 'disabled-class') h[target].classList.add(state === 'is-disabled' ? state : 'disabled');
        else h[target].setAttribute(state, state === 'disabled' ? '' : 'true');
      } }, (h, result) => {
        assertDegreeOpenStopped(h, result);
        assert.equal(h.degree.value, '');
      });
    }
  }
});

test('degree opener binding checks revalidate hidden ancestors and readonly state', async () => {
  for (const mutate of [
    h => { h.select.style.display = 'none'; },
    h => { h.item.style.display = 'none'; },
    h => { h.form.style.display = 'none'; },
    h => { h.degree.readOnly = false; },
  ]) {
    await degreeOpenTrial({ mutate }, (h, result) => {
      assertDegreeOpenStopped(h, result);
      assert.equal(h.degree.value, '');
    });
  }
});

test('degree opener binding checks refuse a menu opened during the await', async () => {
  await degreeOpenTrial({ mutate: h => { h.panel.style.display = 'block'; } }, (h, result) => {
    assertDegreeOpenStopped(h, result);
    assert.equal(h.degree.value, '');
    assert.equal(h.panel.style.display, 'block');
  });
});

test('degree opener binding refusal before the click reports no write', async () => {
  await degreeOpenTrial({ refuseBinding: true }, (h, result) => {
    assertDegreeOpenStopped(h, result);
    assert.equal(result.reason, 'profile_binding_changed');
    assert.equal(h.degree.value, '');
  });
});

test('degree opener still opens unchanged blank or explicitly overwritten targets', async () => {
  for (const options of [{ initial: '', replaceExisting: false }, { initial: '本科', replaceExisting: true }]) {
    await degreeOpenTrial({ ...options, mutate: h => {
      // Reuse the existing month panel to stop at the writer's wrong-menu
      // guard after a real opener click. This adds no degree dropdown evidence.
      h.degree.addEventListener('click', () => {
        h.panel.style.display = h.panel.style.display === 'none' ? 'block' : 'none';
      });
    } }, (h, result) => {
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'basic_wrong_menu');
      assert.equal(result.writeStarted, false);
      assert.equal(h.clicks, 2, 'opener and existing dismissal both remain reachable');
      assert.equal(h.degree.value, options.initial);
      assert.equal(h.panel.style.display, 'none');
    });
  }
});
