// Offline Never-Save trials for GTH 现居住地. Markup follows the 2026-10-23
// probe (cascader-wrap, plugin-dialog, eo-cascader-menu, province span[uid]).
// A green run is not a live support claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { buildPageExpression } from '../scripts/live/lib/gth-full-page.mjs';
import { chromeShimExpression } from '../scripts/live/lib/gth-full-sections.mjs';
import {
  basicCoverage,
  basicCandidate,
  gthRequestedFillBlocksComplete,
  planGthBasicCoverage,
  sealGthJobCoverage,
  validResponse,
} from '../src/background/basic-task-runner.mjs';

const source = readFileSync(new URL('../src/content/gth-basic.js', import.meta.url), 'utf8');
const PAGE = 'https://hr.gtht.com/resume/edit/';
const TITLES = ['基本信息', '教育经历', '求职意向', '工作经验', '职业技能与特长', '附件简历', '其他信息'];
const binding = { version: 1, epoch: '00000000-0000-4000-8000-000000000001', profileHash: 'a'.repeat(64) };
const PROVINCES = [['北京', '86030000'], ['上海', '86031000'], ['天津', '86032000']];

const item = (label, body) => `<div class="el-form-item"><label class="el-form-item__label">${label}</label><div class="el-form-item__content">${body}</div></div>`;
const radio = (text, checked) => `<label class="el-radio"><span class="el-radio__input"><input type="radio" name="gender" value="${text}"${checked ? ' checked' : ''}></span><span class="el-radio__label">${text}</span></label>`;

function provinceRows(options) {
  if (options.leavesOnly) return '<li class="branch"><span uid="86031000">上海</span></li>';
  const rows = options.provinces || PROVINCES;
  const extra = options.duplicateShanghai ? '<li class="branch has-child"><span uid="86031999">上海</span></li>' : '';
  return rows.map(([text, uid]) => `<li class="branch has-child"><span title="${text}" uid="${uid}">${text}</span></li>`).join('') + extra;
}

function residence(options) {
  if (options.drift === 'plain') return item('现居住地', '<input type="text" id="city" value="">');
  const chip = options.chip
    ? `<li uid="${options.chip.uid}"><p>${options.chip.text}</p><i></i></li>` : '';
  const menu = options.drift === 'no-menu' ? '' : `<div class="eo-cascader-panel"><div class="eo-cascader-menu simple-tree-outer"><ul class="simple-tree-wrapper">${provinceRows(options)}</ul></div></div>`;
  const confirmText = options.confirmText || '确定';
  const confirmHref = options.confirmHref || 'javascript:;';
  return `<div class="el-form-item"><label for="resume_residence_area" class="el-form-item__label">现居住地</label><div class="el-form-item__content cascader-wrap"><div class="input-l pointer" id="city-trigger"><div class="input-l pointer el-input"><input class="el-input__inner" id="city" type="text" readonly placeholder="请选择" value="${options.value || ''}"></div></div><div class="dialog-wrap plugin-dialog-wrap popover blue" id="city-panel" style="display:none"><div class="eo-checked-wrap selected-view-outer"><ul class="selected-view-data">${chip}</ul><div class="selected-counter"><p>（${chip ? '1' : '0'}/1）</p></div></div><div class="search-outer"><input class="search-input" type="text" placeholder="请输入关键字"></div>${menu}<div class="pop-foot"><a class="confirm pop-btn" id="city-confirm" href="${confirmHref}">${confirmText}</a><a class="cancel pop-btn" id="city-cancel" href="javascript:;">取消</a></div></div></div></div>`;
}

function html(options) {
  const fields = [
    item('姓名', '<input type="text" id="name" value="旧姓名">'),
    item('性别', `<div class="el-radio-group">${radio('男', false)}${radio('女', true)}</div>`),
    item('手机号码', '<input type="text" value="13800138000">'),
    item('出生年月', '<div class="el-date-editor el-date-editor--month"><span class="el-input__prefix"><i class="el-input__icon el-icon-date" id="month-icon"></i></span><input class="el-input__inner" type="text" readonly id="birth" value="1998-06"></div>'),
    item('电子邮件', '<input type="text" value="synthetic@example.com">'),
    residence(options),
    item('最高学历', '<div class="el-select"><input class="el-input__inner" type="text" readonly value="硕士"></div>'),
    item('照片', ''),
    item('参加工作时间', '<div class="el-date-editor el-date-editor--month input-l"><span class="el-input__prefix"><i class="el-input__icon el-icon-date" id="work-start-icon"></i></span><input class="el-input__inner" type="text" readonly id="work-start" value="2022-09"></div>'),
  ].join('');
  return `<!doctype html><body>${TITLES.map((title, index) => `<section class="r-section"><div class="title_">${title}</div>${index === 0 ? `<form class="el-form sec-form">${fields}<button type="button" id="cancel">取消</button><button type="button" id="save">保存</button><button type="button">提交</button><button type="button">投递</button><button type="button">删除</button></form>` : ''}</section>`).join('')}</body>`;
}

function wire(document, options) {
  const stats = { open: 0, branch: 0, confirm: 0, cancel: 0, save: 0 };
  const panel = document.getElementById('city-panel');
  const input = document.getElementById('city');
  const trigger = document.getElementById('city-trigger');
  if (!panel || !trigger) return { stats, input, panel };
  trigger.addEventListener('click', () => {
    stats.open += 1;
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });
  panel.querySelector('.eo-cascader-menu')?.addEventListener('click', (event) => {
    const span = event.target.closest('span[uid]');
    const row = span?.closest('li.branch.has-child');
    if (!row || !panel.querySelector('.simple-tree-wrapper')?.contains(row)) return;
    stats.branch += 1;
    const uid = options.wrongChipUid ? '00000000' : span.getAttribute('uid');
    panel.querySelector('.selected-view-data').innerHTML = `<li uid="${uid}"><p>${span.textContent.trim()}</p><i></i></li>`;
    row.classList.add('selected');
  });
  document.getElementById('city-confirm')?.addEventListener('click', (event) => {
    event.preventDefault();
    stats.confirm += 1;
    const chip = panel.querySelector('.selected-view-data > li p');
    if (chip && input && !options.refuseReadback) input.value = chip.textContent.trim();
    panel.style.display = 'none';
  });
  document.getElementById('city-cancel')?.addEventListener('click', (event) => {
    event.preventDefault();
    stats.cancel += 1;
    panel.style.display = 'none';
  });
  document.getElementById('save').addEventListener('click', () => { stats.save += 1; });
  return { stats, input, panel };
}

async function boot(options = {}) {
  const dom = new JSDOM(html(options), { url: PAGE, pretendToBeVisual: true, runScripts: 'dangerously' });
  const { window } = dom;
  const { document } = window;
  window.Element.prototype.getClientRects = function () {
    for (let node = this; node?.nodeType === 1; node = node.parentElement) {
      if (node.style.display === 'none') return [];
    }
    return [{ width: 8, height: 8 }];
  };
  Object.defineProperty(document, 'readyState', { configurable: true, get: () => 'complete' });
  const wired = wire(document, options);
  window.eval(buildPageExpression({ waitTimeoutMs: 30, pollMs: 1 }));
  window.eval(chromeShimExpression());
  window.eval(source);
  assert.equal((await window.__gthFullLive.open(0)).ok, true);
  const confirmed = ['fullName', 'gender', 'birthDate', 'education.0.degree'];
  if (options.confirmCity !== false) confirmed.push('currentCity');
  const request = {
    requestId: 'basic-residence-trial-01', profileBinding: binding,
    replaceExisting: options.replaceExisting ?? true, educationIndex: 0,
    profile: {
      fullName: 'Synthetic Customer B', gender: '男', birthDate: '1998-06',
      currentCity: options.city === undefined ? '上海' : options.city,
      education: [{ degree: '硕士' }], confirmedFields: confirmed,
    },
  };
  return { dom, window, document, request, ...wired };
}

async function run(options, verify) {
  const h = await boot(options);
  try {
    const result = await h.window.ResumeGthBasic.trial(h.request);
    await verify(h, result);
    assert.equal(result.liveSupportClaimed, false);
    assert.equal(result.softwareClickedSave, false);
    assert.equal(result.softwareClickedSubmit, false);
    assert.equal(result.softwareClickedDelete, false);
    assert.equal(result.complete, false);
    assert.equal(h.stats.save, 0);
    assert.equal(h.window.__gthFullLive.clicks().some((row) => row.allowed !== true), false);
    assert.equal(h.window.__gthFullLive.clicks().some((row) => /保存|提交|投递|删除/u.test(row.label)), false);
    assert.equal(result.coverage.find((row) => row.question === '照片').reason, 'control_not_supported');
    assert.equal(result.coverage.find((row) => row.question === '照片').supported, false);
  } finally {
    h.window.__gthFullLive.restore();
    h.window.__gthFullResumeChromeRestore();
    h.dom.window.close();
  }
}

test('province branch click plus 确定 reads back 上海', async () => {
  await run({}, (h, result) => {
    assert.equal(result.ok, true, JSON.stringify({ reason: result.reason, step: result.selectorStep }));
    assert.equal(h.input.value, '上海');
    const city = result.fields.find((row) => row.question === '现居住地');
    assert.equal(city.status, 'verified');
    assert.equal(city.reason, 'readback_matched');
    assert.equal(city.path, 'currentCity');
    assert.equal(city.supported, undefined);
    assert.equal(result.coverage.find((row) => row.key === 'currentCity').supported, true);
    assert.equal(h.stats.open, 1);
    assert.equal(h.stats.branch, 1);
    assert.equal(h.stats.confirm, 1);
    assert.equal(h.stats.cancel, 0);
    assert.equal(h.panel.style.display, 'none');
    assert.equal(result.fields.length, 8);
  });
});

test('preexisting 北京 verifies without opening the menu', async () => {
  await run({ value: '北京', city: '北京', chip: { text: '北京', uid: '86030000' } }, (h, result) => {
    assert.equal(result.ok, true, result.reason);
    const city = result.fields.find((row) => row.question === '现居住地');
    assert.equal(city.reason, 'preexisting_same_value');
    assert.equal(city.status, 'verified');
    assert.equal(h.input.value, '北京');
    assert.equal(h.stats.open, 0);
    assert.equal(h.stats.confirm, 0);
  });
});

test('replaceExisting selects another province and reads it back', async () => {
  await run({
    value: '北京', city: '上海', chip: { text: '北京', uid: '86030000' },
  }, (h, result) => {
    assert.equal(result.ok, true, JSON.stringify({ reason: result.reason, step: result.selectorStep }));
    assert.equal(h.input.value, '上海');
    assert.equal(result.fields.find((row) => row.question === '现居住地').reason, 'readback_reapplied');
    assert.equal(h.stats.branch, 1);
    assert.equal(h.stats.confirm, 1);
    assert.equal(h.panel.style.display, 'none');
  });
});

test('a different province without replaceExisting stays untouched', async () => {
  await run({
    value: '北京', city: '上海', replaceExisting: false, chip: { text: '北京', uid: '86030000' },
  }, (h, result) => {
    assert.equal(result.ok, true, result.reason);
    assert.equal(result.fields.find((row) => row.question === '现居住地').reason, 'existing_value');
    assert.equal(h.input.value, '北京');
    assert.equal(h.stats.open, 0);
  });
});

test('structure drift fails closed before any basic write', async () => {
  for (const options of [{ drift: 'plain' }, { drift: 'no-menu' }]) {
    await run(options, (h, result) => {
      assert.equal(result.ok, false);
      assert.equal(result.reason, 'basic_residence_structure_changed');
      assert.equal(result.writeStarted, false);
      assert.equal(h.document.getElementById('name').value, '旧姓名');
      assert.equal(h.stats.confirm, 0);
      assert.equal(h.stats.open, 0);
      assert.equal(h.stats.save, 0);
    });
  }
});

test('a province row without has-child is not selected', async () => {
  await run({ leavesOnly: true }, (h, result) => {
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'basic_residence_option_missing');
    assert.equal(h.stats.branch, 0);
    assert.equal(h.stats.confirm, 0);
    assert.equal(h.stats.cancel, 1);
    assert.equal(h.input.value, '');
    assert.equal(h.panel.style.display, 'none');
  });
});

test('ambiguous provinces, a foreign chip uid, and a navigable 确定 do not confirm', async () => {
  await run({ duplicateShanghai: true }, (h, result) => {
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'basic_residence_option_ambiguous');
    assert.equal(h.stats.branch, 0);
    assert.equal(h.stats.confirm, 0);
    assert.equal(h.stats.cancel, 1);
    assert.equal(h.input.value, '');
    assert.equal(h.panel.style.display, 'none');
  });
  await run({ wrongChipUid: true }, (h, result) => {
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'basic_residence_selection_unknown');
    assert.equal(h.stats.confirm, 0);
    assert.equal(h.stats.cancel, 1);
    assert.equal(h.input.value, '');
  });
  await run({ confirmHref: '/resume/save/' }, (h, result) => {
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'basic_residence_confirm_unknown');
    assert.equal(h.stats.confirm, 0);
    assert.equal(h.stats.cancel, 1);
    assert.equal(h.input.value, '');
  });
});

test('missing and unconfirmed residence facts do not open the menu', async () => {
  await run({ city: '' }, (h, result) => {
    assert.equal(result.ok, true, result.reason);
    assert.equal(result.fields.find((row) => row.question === '现居住地').reason, 'missing_profile_value');
    assert.equal(h.stats.open, 0);
  });
  await run({ confirmCity: false }, (h, result) => {
    assert.equal(result.ok, true, result.reason);
    assert.equal(result.fields.find((row) => row.question === '现居住地').reason, 'profile_fact_unconfirmed');
    assert.equal(h.stats.open, 0);
  });
});

test('settled residence coverage survives sealing while photo prevents completion', () => {
  assert.equal(source.includes('已支持'), false);
  assert.match(source, /liveSupportClaimed:false/);
  assert.match(source, /kind:'eoCascader'/);
  assert.doesNotMatch(source, /el-cascader|cascader-plugins-wrap/);
  const echoed = basicCoverage({
    coverage: [{ key: 'currentCity', question: '现居住地', path: 'currentCity', status: 'verified', reason: 'readback_matched' }],
    fields: [{ question: '现居住地', path: 'currentCity', status: 'verified', reason: 'readback_matched' }],
  }, 0);
  assert.equal(echoed.find((row) => row.key === 'currentCity').supported, true);
  assert.equal(echoed.find((row) => row.key === 'currentCity').reason, 'readback_matched');
  const plan = planGthBasicCoverage({ currentCity: '上海', confirmedFields: ['currentCity'] }, { fillRequested: true });
  assert.equal(plan.liveSupportClaimed, false);
  assert.equal(plan.complete, false);
  assert.equal(plan.fillAllowed, false);
  assert.equal(plan.saveAllowed, false);
  assert.equal(plan.blocked, true);
  assert.equal(gthRequestedFillBlocksComplete(plan), true);
  const sealed = sealGthJobCoverage(echoed, plan);
  assert.equal(sealed.find((row) => row.key === 'currentCity').supported, true);
  assert.equal(sealed.find((row) => row.key === 'currentCity').status, 'verified');
  assert.equal(sealed.find((row) => row.key === 'currentCity').reason, 'readback_matched');
  assert.equal(sealed.find((row) => row.key === 'photo').status, 'failed');
  assert.equal(sealed.find((row) => row.key === 'photo').reason, 'control_not_supported');
  assert.equal(JSON.stringify(plan).includes('已支持'), false);
});

test('scoped province candidate fills empty only, reads back, and preserves neighbors', async () => {
  await run({ replaceExisting: false }, async (h, initial) => {
    // Run again from an empty residence using the candidate projection consumed
    // by both background entry points. Other basic values remain occupied.
    h.input.value = '';
    h.panel.querySelector('.selected-view-data').innerHTML = '';
    const source = {
      education: [{ degree: '硕士' }],
      customFacts: [{ question: '现居住地', answer: '上海', sitePageUrl: PAGE, sectionName: '基本信息', rowContext: 'single' }],
      customAnswers: { 现居住地: '上海' },
      confirmedFields: ['education.0.degree', 'customAnswers.现居住地'],
    };
    const request = { ...h.request, requestId: 'scoped-residence-0001', profile: basicCandidate(source, 0).profile };
    const neighbor = h.document.querySelectorAll('.r-section')[1];
    neighbor.insertAdjacentHTML('beforeend', '<input type="text" value="education neighbor"><p>Keep this education record</p>');
    const outsideBefore = neighbor.outerHTML;
    const values = () => [...h.document.querySelector('form').querySelectorAll('input,select,textarea')]
      .filter(node => node !== h.input && !h.panel.contains(node))
      .map(node => [node.type, node.value, node.checked]);
    const before = values();
    const result = await h.window.ResumeGthBasic.trial(request);
    assert.equal(initial.ok, true);
    assert.equal(result.ok, true, result.reason);
    assert.equal(result.fields.find(row => row.question === '现居住地').reason, 'readback_matched');
    assert.equal(h.input.value, '上海');
    assert.deepEqual(values(), before);
    assert.equal(neighbor.outerHTML, outsideBefore);
    assert.equal(validResponse(result, 0), true, 'real content response satisfies the planner contract');
    const sealed = sealGthJobCoverage(basicCoverage(result, 0), planGthBasicCoverage(source, { fillRequested: true }));
    assert.equal(sealed.find(row => row.key === 'currentCity').status, 'verified');
    assert.equal(sealed.find(row => row.key === 'photo').supported, false);
    assert.equal(result.complete, false);
    assert.equal(result.liveSupportClaimed, false);
    assert.equal(result.softwareClickedSave, false);
    assert.equal(result.softwareClickedSubmit, false);
    assert.equal(result.softwareClickedDelete, false);

    h.input.value = '北京';
    const beforeOccupied = h.stats.open;
    const occupied = await h.window.ResumeGthBasic.trial({ ...request, requestId: 'scoped-residence-0002' });
    assert.equal(occupied.ok, true, occupied.reason);
    assert.equal(occupied.fields.find(row => row.question === '现居住地').reason, 'existing_value');
    assert.equal(h.input.value, '北京');
    assert.equal(h.stats.open, beforeOccupied);
    assert.deepEqual(values(), before);
    assert.equal(neighbor.outerHTML, outsideBefore);
    assert.equal(validResponse(occupied, 0), true);
  });
});

test('a closed province menu without matching readback cannot be verified', async () => {
  await run({ replaceExisting: false, refuseReadback: true }, (h, result) => {
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'basic_readback_mismatch');
    assert.equal(h.input.value, '');
    assert.equal(h.stats.confirm, 1);
    assert.equal(result.fields.some(row => row.question === '现居住地' && row.status === 'verified'), false);
    assert.equal(validResponse(result, 0), false);
  });
});

test('residence response rejects mismatched path, duplicate row, or live support claim', async () => {
  await run({ replaceExisting: false }, (_h, result) => {
    assert.equal(validResponse(result, 0), true);
    const wrongPath = structuredClone(result);
    wrongPath.fields.find(row => row.question === '现居住地').path = 'desiredCities.0';
    assert.equal(validResponse(wrongPath, 0), false);
    const duplicate = structuredClone(result);
    duplicate.fields.push({ ...duplicate.fields.find(row => row.question === '现居住地') });
    assert.equal(validResponse(duplicate, 0), false);
    assert.equal(validResponse({ ...result, liveSupportClaimed: true }, 0), false);
  });
});
