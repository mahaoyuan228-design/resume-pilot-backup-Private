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
  const stats = { anchors: 0, cells: 0, accepted: 0, dismissed: 0, years: 0, opened: [], acceptedFields: [] };
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
