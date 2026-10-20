// Offline census of the GTH 求职意向 editor probe. The fixture is a stub, not
// product DOM. Never Save: 保存 / 提交 / 投递 are present and must stay unclicked.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { connectCdp } from '../tools/live-harvest/cdp-client.mjs';
import {
  DEFAULT_PORT,
  DEFAULT_URL_MATCH,
  EDIT_PAGE,
  HELP,
  buildProbeExpression,
  buildReport,
  clickFlags,
  isSavePost,
  looksLikeLogin,
  networkReport,
  openUrlFor,
  parseProbeArgs,
  probeIntentEditor,
  redactUrl,
  runGthIntentProbe,
  selectResumeTarget
} from '../scripts/probe-gth-intent.mjs';

const source = readFileSync(new URL('../scripts/probe-gth-intent.mjs', import.meta.url), 'utf8');
const PAGE = EDIT_PAGE;

function editorForm({ cancelType = 'button' } = {}) {
  return `<form id="intent-form">
    <div class="el-form-item" id="cat-item">
      <label class="el-form-item__label">期望从事职位类别</label>
      <div class="el-form-item__content">
        <div class="el-cascader">
          <div class="el-input"><input id="cat-trigger" class="el-input__inner" readonly placeholder="请选择职位类别" value="投资/证券/基金"></div>
        </div>
      </div>
    </div>
    <div class="el-form-item" id="salary-item">
      <label class="el-form-item__label">期望薪资</label>
      <div class="el-form-item__content">
        <input id="salary" type="text" value="12000" placeholder="请输入期望薪资">
      </div>
    </div>
    <div class="el-form-item" id="ind-item">
      <label class="el-form-item__label">现从事行业</label>
      <div class="el-form-item__content">
        <div class="el-select">
          <div class="el-input"><input id="ind-trigger" class="el-input__inner" readonly placeholder="请选择行业" value="证券"></div>
        </div>
      </div>
    </div>
    <div class="el-form-item" id="role-item">
      <label class="el-form-item__label">现从事职位类别</label>
      <div class="el-form-item__content">
        <div class="el-cascader">
          <div class="el-input"><input id="role-trigger" class="el-input__inner" readonly placeholder="请选择职位类别" value="研究员"></div>
        </div>
      </div>
    </div>
    <div class="el-form-item" id="current-salary-item">
      <label class="el-form-item__label">现薪资</label>
      <div class="el-form-item__content">
        <input id="current-salary" type="text" readonly value="8000">
      </div>
    </div>
    <div class="el-form-item" id="date-item">
      <label class="el-form-item__label">到岗月份</label>
      <div class="el-form-item__content">
        <div class="el-date-editor el-date-editor--month">
          <input class="el-input__inner" readonly placeholder="选择月份" value="2024-01">
        </div>
      </div>
    </div>
    <div class="el-form-item" id="arrival-item">
      <label class="el-form-item__label">到岗时间</label>
      <div class="el-form-item__content">
        <label class="el-radio"><input type="radio" name="arrival" checked> 随时</label>
        <label class="el-radio"><input type="radio" name="arrival"> 一周内</label>
      </div>
    </div>
    <div class="el-form-item" id="adjust-item">
      <label class="el-form-item__label">接受调剂</label>
      <div class="el-form-item__content">
        <label class="el-checkbox is-checked"><input type="checkbox" checked> 接受</label>
      </div>
    </div>
    <div class="el-form-item" id="note-item">
      <label class="el-form-item__label">备注</label>
      <div class="el-form-item__content only-hint">说明文字</div>
    </div>
    <button type="button" id="intent-save">保存</button>
    <button type="button" id="intent-draft">保存草稿</button>
    <button type="button" id="intent-submit">提交</button>
    <button type="button" id="intent-deliver">投递</button>
    <button type="${cancelType}" id="intent-cancel">取消</button>
  </form>`;
}

function menus() {
  return `<div id="cat-menu" class="el-cascader-panel" style="display:none"><div class="el-cascader-node">分析师</div></div>
    <div id="ind-menu" class="el-select-dropdown" style="display:none"><div class="el-select-dropdown__item">证券业</div></div>
    <div id="role-menu" class="el-cascader-panel" style="display:none"><div class="el-cascader-node">研究员</div></div>`;
}

const BASIC_LABELS = ['姓名', '性别', '手机号码', '出生年月', '电子邮件', '现居住地', '最高学历', '照片', '参加工作时间'];
const STATIC_VALUE = 'STATIC_FORM_VALUE_DO_NOT_RECORD';
const LIVE_BEFORE = ['教育经历'];
const LIVE_AFTER = ['工作经验', '职业技能与特长', '附件简历', '其他信息'];

function staticBasicSection() {
  const items = BASIC_LABELS.map((label) => {
    const modify = label === '手机号码' || label === '电子邮件'
      ? '<a class="h-e-btn" href="javascript:;">修改</a>'
      : '';
    const control = label === '照片'
      ? '<div class="photo"></div>'
      : `<input type="text" value="${label === '姓名' ? STATIC_VALUE : ''}">`;
    return `<div class="el-form-item"><label class="el-form-item__label">${label}</label><div class="el-form-item__content">${control}${modify}</div></div>`;
  }).join('');
  return `<section class="r-section" id="basic"><div class="title_">基本信息</div><form class="el-form sec-form" id="basic-form">${items}<button type="button" class="el-button el-button--default is-plain" id="basic-cancel">取消</button><button type="button" id="basic-save">保存</button></form></section>`;
}

function liveSection(title, index, openTitle) {
  const id = `live-${index}`;
  if (title === openTitle) {
    return `<section class="r-section" id="${id}"><div class="title_">${title}<a class="h-e-btn el-link--primary" href="javascript:;">编辑</a></div><form class="el-form" id="open-form"><div class="el-form-item"><label class="el-form-item__label">学校</label><div class="el-form-item__content"><input type="text" value="示例学校"></div></div><button type="button" class="el-button el-button--default is-plain" id="open-cancel">取消</button><button type="button" id="open-save">保存</button></form></section>`;
  }
  return `<section class="r-section" id="${id}"><div class="title_">${title}<a class="h-e-btn el-link--primary" href="javascript:;">编辑</a></div><div class="sec-view">查看</div></section>`;
}

function card(id, { edits = 1, open = false, cancelType = 'button', editClass = 'h-e-btn' } = {}) {
  const links = Array.from({ length: edits }, () => `<a class="${editClass}" href="javascript:;">编辑</a>`).join('');
  const form = open ? editorForm({ cancelType }) : '';
  return `<section class="r-section" id="${id}"><div class="title_">求职意向${links}</div>${form}</section>`;
}

function mount({ cards = 1, edits = 1, open = false, foreign = false, cancelType = 'button', fallback = false, staticBasic = false, toggledOpen = null } = {}) {
  const intent = fallback
    ? `<div id="intent"><span>求职意向</span><a class="h-e-btn" href="javascript:;">编辑</a><button type="button" id="intent-save">保存</button></div>`
    : Array.from({ length: cards }, (_, index) => card(index === 0 ? 'intent' : `intent-${index}`, {
      edits: index === 0 ? edits : 1,
      open: index === 0 ? open : false,
      cancelType,
      editClass: staticBasic ? 'h-e-btn el-link--primary' : 'h-e-btn'
    })).join('');
  const basic = staticBasic
    ? staticBasicSection()
    : `<section class="r-section" id="basic"><div class="title_">基本信息<a class="h-e-btn" href="javascript:;">编辑</a></div><button type="button" id="basic-save">保存</button></section>`;
  const showLive = staticBasic || toggledOpen;
  const lead = showLive ? LIVE_BEFORE.map((title, index) => liveSection(title, index, toggledOpen)).join('') : '';
  const trail = showLive ? LIVE_AFTER.map((title, index) => liveSection(title, index + LIVE_BEFORE.length, toggledOpen)).join('') : '';
  const html = `<!DOCTYPE html><body>
    ${basic}
    ${lead}
    ${intent}
    ${trail}
    ${foreign ? `<div class="el-dialog" id="foreign"><form id="foreign-form"><div class="el-form-item"><label class="el-form-item__label">学校</label><input type="text" value="示例大学"></div><button type="button" id="foreign-save">保存</button><button type="button" id="foreign-cancel">取消</button></form></div>` : ''}
    ${menus()}
  </body>`;
  const dom = new JSDOM(html, { url: PAGE, pretendToBeVisual: true, runScripts: 'dangerously' });
  const { document } = dom.window;
  dom.window.Element.prototype.getClientRects = () => [{ width: 8, height: 8, top: 0, left: 0, bottom: 8, right: 8 }];
  const clicks = { edit: 0, cancel: 0, save: 0, submit: 0, deliver: 0, basicEdit: 0, basicSave: 0, basicCancel: 0, modify: 0, otherEdit: 0, option: 0, escape: 0, formSubmit: 0, trigger: 0, foreign: 0 };
  const titleOf = (section) => {
    const title = section.querySelector('.title_');
    if (!title) return '';
    const clone = title.cloneNode(true);
    clone.querySelectorAll('a,button').forEach((node) => node.remove());
    return (clone.textContent || '').replace(/\s+/gu, ' ').trim();
  };
  document.addEventListener('click', (event) => {
    const control = event.target.closest('a, button, input, [role="button"], .el-cascader-node, .el-select-dropdown__item');
    if (!control) return;
    if (control.classList.contains('el-input__inner')) clicks.trigger += 1;
    if (control.classList.contains('el-cascader-node') || control.classList.contains('el-select-dropdown__item')) clicks.option += 1;
    const name = (control.textContent || '').replace(/\s+/gu, ' ').trim();
    const section = control.closest('.r-section');
    const title = section ? titleOf(section) : '';
    if (name === '编辑' && title === '求职意向') clicks.edit += 1;
    if (name === '编辑' && title === '基本信息') clicks.basicEdit += 1;
    if (name === '编辑' && title && title !== '求职意向' && title !== '基本信息') clicks.otherEdit += 1;
    if (name === '编辑' && !section) clicks.edit += 1;
    if (name === '修改') clicks.modify += 1;
    if (name.includes('保存')) clicks.save += 1;
    if (name === '提交') clicks.submit += 1;
    if (name === '投递') clicks.deliver += 1;
    if (name === '取消') {
      if (control.closest('form.sec-form')) clicks.basicCancel += 1;
      else clicks.cancel += 1;
    }
    if (control.closest('#foreign')) clicks.foreign += 1;
    if (name === '取消' && control.tagName === 'BUTTON' && (control.getAttribute('type') || '').toLowerCase() === 'button' && !control.closest('form.sec-form')) {
      const form = control.closest('form');
      if (form) form.style.display = 'none';
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    clicks.escape += 1;
    for (const menu of document.querySelectorAll('.el-cascader-panel, .el-select-dropdown')) menu.style.display = 'none';
  });
  const wire = (root) => {
    for (const form of root.querySelectorAll('#intent-form, #basic-form, #open-form, #foreign-form')) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        clicks.formSubmit += 1;
      });
    }
    for (const [triggerId, menuId] of [['#cat-trigger', '#cat-menu'], ['#ind-trigger', '#ind-menu'], ['#role-trigger', '#role-menu']]) {
      root.querySelector(triggerId)?.addEventListener('click', () => {
        const menu = document.querySelector(menuId);
        if (menu) menu.style.display = 'block';
      });
    }
  };
  wire(document);
  for (const link of document.querySelectorAll('#intent .h-e-btn, #intent > a.h-e-btn')) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const host = document.getElementById('intent');
      if (host.querySelector('#intent-form')) return;
      host.insertAdjacentHTML('beforeend', editorForm({ cancelType }));
      wire(host);
    });
  }
  return { dom, clicks, document };
}

function kinds(result) {
  return Object.fromEntries(result.fields.map((field) => [field.label, field.controlKind]));
}

test('probe source clicks once, never navigates, and never claims support', () => {
  assert.equal((source.match(/\.click\s*\(/g) || []).length, 1);
  assert.doesNotMatch(source, /Page\.navigate/);
  assert.doesNotMatch(source, /Input\.dispatch/);
  assert.doesNotMatch(source, /\.submit\s*\(/);
  assert.doesNotMatch(source, /supported:\s*true/);
  assert.doesNotMatch(source, /claimedSupported:\s*true/);
  assert.doesNotMatch(source, /liveSupportClaimed:\s*true/);
  assert.doesNotMatch(source, /GTH_INTENT_FILL/);
  assert.match(source, /from '\.\.\/tools\/live-harvest\/cdp-client\.mjs'/);
  assert.match(HELP, /node scripts\/probe-gth-intent\.mjs --port 9239/);
  assert.match(HELP, /--open-options/);
  assert.match(HELP, /Never Save/);
  assert.match(source, /staticInlineForms/);
});

test('args default to CDP 9239 and reject a second port', () => {
  assert.equal(parseProbeArgs([]).port, DEFAULT_PORT);
  assert.equal(parseProbeArgs([]).urlMatch, DEFAULT_URL_MATCH);
  assert.equal(parseProbeArgs(['--port', '9240', '--open-options']).openOptions, true);
  assert.throws(() => parseProbeArgs(['--port', '1', '--port', '2']), /duplicate --port/);
  assert.throws(() => parseProbeArgs(['--navigate']), /unknown argument/);
});

test('save posts are recognized without keeping query secrets', () => {
  const secret = 'https://hr.gtht.com/api/resume/edit.json?token=secret';
  assert.equal(isSavePost('POST', secret), true);
  assert.equal(isSavePost('GET', secret), false);
  assert.equal(isSavePost('POST', 'https://hr.gtht.com/api/resume/resumeeditinfo.json'), true);
  assert.equal(isSavePost('POST', 'https://example.test/collect'), false);
  const report = networkReport([{ via: 'cdp', method: 'POST', url: secret }, { via: 'cdp', method: 'GET', url: secret }]);
  assert.equal(report.savePostObserved, true);
  assert.equal(JSON.stringify(report).includes('token'), false);
  assert.equal(redactUrl(secret), 'https://hr.gtht.com/api/resume/edit.json');
  assert.deepEqual(clickFlags([{ type: 'click', label: '取消', name: '取消' }]), {
    softwareClickedSave: false,
    softwareClickedSubmit: false,
    softwareClickedDeliver: false
  });
});

test('tab selection attaches one resume tab and does not invent a login URL', () => {
  const one = selectResumeTarget([{ type: 'page', id: 'a', url: EDIT_PAGE, title: '简历' }], DEFAULT_URL_MATCH);
  assert.equal(one.action, 'attach');
  const two = selectResumeTarget([
    { type: 'page', id: 'a', url: `${EDIT_PAGE}?token=secret`, title: '一' },
    { type: 'page', id: 'b', url: EDIT_PAGE, title: '二' }
  ], DEFAULT_URL_MATCH);
  assert.equal(two.action, 'stop');
  assert.equal(two.reason, 'tab_ambiguous');
  assert.equal(openUrlFor(DEFAULT_URL_MATCH), EDIT_PAGE);
  assert.equal(openUrlFor('hr.gtht.com/resume'), null);
  assert.equal(openUrlFor('https://hr.gtht.com/resume/edit/?from=probe'), 'https://hr.gtht.com/resume/edit/?from=probe');
  assert.equal(openUrlFor('https://evil.test/resume/edit/'), null);
  assert.equal(looksLikeLogin({ password: true, href: EDIT_PAGE }), true);
  assert.equal(looksLikeLogin({ password: false, href: EDIT_PAGE }), false);
});

test('opened editor census clicks 编辑 and 取消, never 保存 提交 or 投递', async () => {
  const { document, clicks } = mount();
  const result = await probeIntentEditor(document, { openOptions: false });
  assert.equal(result.ok, true);
  assert.equal(result.reason, null);
  assert.equal(result.editorLeftOpen, false);
  assert.deepEqual(result.clickedLabels, ['编辑', '取消']);
  assert.equal(result.softwareClickedSave, false);
  assert.equal(result.softwareClickedSubmit, false);
  assert.equal(result.softwareClickedDeliver, false);
  assert.equal(result.supported, false);
  assert.equal(result.claimedSupported, false);
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.network.savePostObserved, false);
  assert.deepEqual(clicks, {
    edit: 1, cancel: 1, save: 0, submit: 0, deliver: 0, basicEdit: 0, basicSave: 0,
    basicCancel: 0, modify: 0, otherEdit: 0,
    option: 0, escape: 0, formSubmit: 0, trigger: 0, foreign: 0
  });
  assert.deepEqual(kinds(result), {
    期望从事职位类别: 'el-cascader',
    期望薪资: 'input',
    现从事行业: 'el-select',
    现从事职位类别: 'el-cascader',
    现薪资: 'input',
    到岗月份: 'el-date-editor',
    到岗时间: 'radio',
    接受调剂: 'checkbox',
    备注: 'custom'
  });
  const salary = result.fields.find((field) => field.label === '期望薪资');
  assert.equal(salary.placeholder, '请输入期望薪资');
  assert.equal(salary.value, '12000');
  assert.equal(salary.readOnly, false);
  assert.equal(salary.dropdownTrigger, null);
  assert.equal(salary.supportClaimed, false);
  const current = result.fields.find((field) => field.label === '现薪资');
  assert.equal(current.readOnly, true);
  assert.equal(current.value, '8000');
  const category = result.fields.find((field) => field.label === '期望从事职位类别');
  assert.equal(category.dropdownTrigger, '.el-cascader .el-input__inner');
  assert.equal(document.querySelector('#cat-item').querySelector(category.dropdownTrigger), document.querySelector('#cat-trigger'));
  assert.equal(JSON.parse(JSON.stringify(result)).supported, false);
});

test('the CDP expression bundle is the same census and still only cancels', async () => {
  const { dom, clicks } = mount();
  const result = await vm.runInContext(buildProbeExpression({ openOptions: false }), dom.getInternalVMContext());
  assert.equal(result.ok, true);
  assert.deepEqual([...result.clickedLabels].map((label) => String(label)), ['编辑', '取消']);
  assert.equal(clicks.save, 0);
  assert.equal(clicks.submit, 0);
  assert.equal(clicks.deliver, 0);
  assert.equal(clicks.cancel, 1);
  assert.equal(result.liveSupportClaimed, false);
});

test('an ambiguous 求职意向 card stops before any click', async () => {
  const { document, clicks } = mount({ cards: 2 });
  const result = await probeIntentEditor(document, { openOptions: true });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'intent_card_ambiguous');
  assert.equal(result.detail.cardCount, 2);
  assert.deepEqual(result.clickedLabels, []);
  assert.equal(result.optionsOpened, false);
  assert.equal(clicks.edit, 0);
  assert.equal(clicks.cancel, 0);
  assert.equal(clicks.save, 0);
  assert.equal(clicks.submit, 0);
  assert.equal(clicks.deliver, 0);
  assert.equal(clicks.trigger, 0);
});

test('two 编辑 affordances in one card stop before any click', async () => {
  const { document, clicks } = mount({ edits: 2 });
  const result = await probeIntentEditor(document);
  assert.equal(result.reason, 'intent_edit_not_unique');
  assert.equal(result.detail.editCount, 2);
  assert.deepEqual(result.actions, []);
  assert.equal(clicks.edit, 0);
  assert.equal(clicks.save, 0);
  assert.equal(clicks.cancel, 0);
});

test('a submit-typed 取消 is not clicked and neither is 保存', async () => {
  const { document, clicks } = mount({ cancelType: 'submit' });
  const result = await probeIntentEditor(document);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'cancel_not_found');
  assert.equal(result.editorLeftOpen, true);
  assert.deepEqual(result.clickedLabels, ['编辑']);
  assert.equal(clicks.cancel, 0);
  assert.equal(clicks.save, 0);
  assert.equal(clicks.formSubmit, 0);
  assert.equal(clicks.submit, 0);
  assert.equal(clicks.deliver, 0);
});

test('an already-open intent editor is censused and closed without 编辑 or 保存', async () => {
  const { document, clicks } = mount({ open: true });
  const result = await probeIntentEditor(document);
  assert.equal(result.ok, true);
  assert.equal(result.editorAlreadyOpen, true);
  assert.deepEqual(result.clickedLabels, ['取消']);
  assert.equal(clicks.edit, 0);
  assert.equal(clicks.save, 0);
  assert.equal(clicks.cancel, 1);
});

test('another section editor stops the probe before 求职意向 is clicked', async () => {
  const { document, clicks } = mount({ foreign: true });
  const result = await probeIntentEditor(document);
  assert.equal(result.reason, 'other_editor_open');
  assert.deepEqual(result.clickedLabels, []);
  assert.equal(clicks.edit, 0);
  assert.equal(clicks.cancel, 0);
  assert.equal(clicks.save, 0);
  assert.equal(clicks.foreign, 0);
  assert.deepEqual(result.staticInlineForms, []);
});

test('a permanent 基本信息 form without 编辑 is recorded and does not block', async () => {
  const { document, clicks } = mount({ staticBasic: true });
  assert.equal(document.querySelectorAll('#intent a.h-e-btn.el-link--primary').length, 1);
  assert.equal(document.querySelector('#intent form'), null);
  assert.equal(document.querySelector('#basic-form').className, 'el-form sec-form');
  assert.equal(document.querySelector('#basic-cancel').className, 'el-button el-button--default is-plain');
  assert.equal([...document.querySelectorAll('#basic a, #basic button')].some((node) => (node.textContent || '').trim() === '编辑'), false);
  assert.equal(document.querySelectorAll('#basic a').length, 2);
  document.querySelector('#basic-cancel').click();
  assert.equal(document.querySelector('#basic-form').style.display, '');
  assert.equal(document.querySelector('#basic-form').isConnected, true);
  assert.equal(clicks.formSubmit, 0);
  assert.equal(clicks.save, 0);
  assert.equal(clicks.basicCancel, 1);
  clicks.basicCancel = 0;

  const result = await probeIntentEditor(document, { openOptions: false });
  assert.equal(result.ok, true);
  assert.equal(result.reason, null);
  assert.equal(result.editorLeftOpen, false);
  assert.deepEqual(result.clickedLabels, ['编辑', '取消']);
  assert.deepEqual(result.staticInlineForms, [{ section: '基本信息', labels: BASIC_LABELS }]);
  assert.equal(result.fields.some((field) => field.label === '姓名'), false);
  assert.equal(result.fields.some((field) => field.label === '期望薪资'), true);
  assert.equal(JSON.stringify(result).includes(STATIC_VALUE), false);
  assert.equal(result.supported, false);
  assert.equal(result.claimedSupported, false);
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.network.savePostObserved, false);
  assert.deepEqual(result.network.posts, []);
  assert.equal(clicks.edit, 1);
  assert.equal(clicks.cancel, 1);
  assert.equal(clicks.basicCancel, 0);
  assert.equal(clicks.modify, 0);
  assert.equal(clicks.otherEdit, 0);
  assert.equal(clicks.save, 0);
  assert.equal(clicks.submit, 0);
  assert.equal(clicks.deliver, 0);
  assert.equal(clicks.formSubmit, 0);
  assert.equal(document.querySelector('#basic-form').style.display, '');
  assert.equal(document.querySelector('#basic-form input').value, STATIC_VALUE);
  const report = buildReport(result, {
    probedAt: '2026-10-20T08:41:00.000Z',
    port: DEFAULT_PORT,
    urlMatch: DEFAULT_URL_MATCH,
    openOptions: false,
    tabAction: 'attached',
    cdpPosts: [],
    cdpNetwork: true
  });
  assert.equal(report.ok, true);
  assert.equal(report.supported, false);
  assert.equal(report.claimedSupported, false);
  assert.equal(report.liveSupportClaimed, false);
  assert.equal(report.productSupportUnchanged, true);
  assert.equal(report.softwareClickedSave, false);
  assert.equal(report.softwareClickedSubmit, false);
  assert.equal(report.softwareClickedDeliver, false);
  assert.deepEqual(report.staticInlineForms, [{ section: '基本信息', labels: BASIC_LABELS }]);
  assert.equal(JSON.stringify(report).includes(STATIC_VALUE), false);

  const again = mount({ staticBasic: true });
  const bundled = await vm.runInContext(buildProbeExpression({ openOptions: false }), again.dom.getInternalVMContext());
  assert.equal(bundled.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(bundled.staticInlineForms)), [{ section: '基本信息', labels: BASIC_LABELS }]);
  assert.deepEqual([...bundled.clickedLabels].map((label) => String(label)), ['编辑', '取消']);
  assert.equal(again.clicks.save, 0);
  assert.equal(again.clicks.basicCancel, 0);
  assert.equal(again.clicks.submit, 0);
  assert.equal(again.clicks.deliver, 0);
});

test('a section with 编辑 and an open form still blocks, and the static form does not add to the count', async () => {
  const { document, clicks } = mount({ staticBasic: true, toggledOpen: '教育经历' });
  const result = await probeIntentEditor(document);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'other_editor_open');
  assert.equal(result.detail.editorCount, 1);
  assert.deepEqual(result.staticInlineForms, [{ section: '基本信息', labels: BASIC_LABELS }]);
  assert.deepEqual(result.clickedLabels, []);
  assert.equal(clicks.edit, 0);
  assert.equal(clicks.otherEdit, 0);
  assert.equal(clicks.cancel, 0);
  assert.equal(clicks.basicCancel, 0);
  assert.equal(clicks.save, 0);
  assert.equal(clicks.submit, 0);
  assert.equal(clicks.deliver, 0);
  assert.equal(clicks.formSubmit, 0);
  assert.equal(document.querySelector('#open-form').style.display, '');
  assert.equal(document.querySelector('#basic-form').style.display, '');
  assert.equal(JSON.stringify(result).includes(STATIC_VALUE), false);
});

test('a drawer in a section without 编辑 still blocks as a toggled editor', async () => {
  const { document, clicks } = mount({ staticBasic: true });
  document.body.insertAdjacentHTML('beforeend', `<section class="r-section" id="drawer-sec"><div class="title_">弹层</div><div class="el-drawer" id="drawer"><form id="drawer-form"><div class="el-form-item"><label class="el-form-item__label">公司</label><input type="text" value="示例"></div><button type="button" id="drawer-cancel">取消</button><button type="button" id="drawer-save">保存</button></form></div></section>`);
  const result = await probeIntentEditor(document);
  assert.equal(result.reason, 'other_editor_open');
  assert.equal(result.detail.editorCount, 2);
  assert.deepEqual(result.staticInlineForms, [{ section: '基本信息', labels: BASIC_LABELS }]);
  assert.deepEqual(result.clickedLabels, []);
  assert.equal(clicks.edit, 0);
  assert.equal(clicks.cancel, 0);
  assert.equal(clicks.basicCancel, 0);
  assert.equal(clicks.save, 0);
  assert.equal(document.querySelector('#drawer-form').style.display, '');
});

test('an already-open 求职意向 editor closes only itself when 基本信息 stays inline', async () => {
  const { document, clicks } = mount({ staticBasic: true, open: true });
  const result = await probeIntentEditor(document);
  assert.equal(result.ok, true);
  assert.equal(result.editorAlreadyOpen, true);
  assert.deepEqual(result.clickedLabels, ['取消']);
  assert.deepEqual(result.staticInlineForms, [{ section: '基本信息', labels: BASIC_LABELS }]);
  assert.equal(clicks.edit, 0);
  assert.equal(clicks.cancel, 1);
  assert.equal(clicks.basicCancel, 0);
  assert.equal(clicks.save, 0);
  assert.equal(document.querySelector('#basic-form').style.display, '');
  assert.equal(document.querySelector('#intent-form').style.display, 'none');
});

test('two 求职意向 编辑 triggers still stop before any click when 基本信息 is inline', async () => {
  const { document, clicks } = mount({ staticBasic: true, edits: 2 });
  const result = await probeIntentEditor(document);
  assert.equal(result.reason, 'intent_edit_not_unique');
  assert.equal(result.detail.editCount, 2);
  assert.deepEqual(result.clickedLabels, []);
  assert.deepEqual(result.staticInlineForms, [{ section: '基本信息', labels: BASIC_LABELS }]);
  assert.equal(clicks.edit, 0);
  assert.equal(clicks.cancel, 0);
  assert.equal(clicks.basicCancel, 0);
  assert.equal(clicks.save, 0);
});

test('a missing 求职意向 section still stops before any click when 基本信息 is inline', async () => {
  const { document, clicks } = mount({ staticBasic: true, cards: 0 });
  const result = await probeIntentEditor(document);
  assert.equal(result.reason, 'intent_card_not_found');
  assert.equal(result.detail.cardCount, 0);
  assert.deepEqual(result.clickedLabels, []);
  assert.equal(clicks.edit, 0);
  assert.equal(clicks.basicCancel, 0);
  assert.equal(clicks.save, 0);
  assert.equal(clicks.modify, 0);
});

test('a dialog still blocks when 基本信息 has a static form', async () => {
  const { document, clicks } = mount({ staticBasic: true, foreign: true });
  const result = await probeIntentEditor(document);
  assert.equal(result.reason, 'other_editor_open');
  assert.equal(result.detail.editorCount, 2);
  assert.deepEqual(result.staticInlineForms, [{ section: '基本信息', labels: BASIC_LABELS }]);
  assert.deepEqual(result.clickedLabels, []);
  assert.equal(clicks.edit, 0);
  assert.equal(clicks.cancel, 0);
  assert.equal(clicks.foreign, 0);
  assert.equal(clicks.save, 0);
  assert.equal(clicks.basicCancel, 0);
});

test('a missing editor does not fall through to 保存', async () => {
  const { document, clicks } = mount();
  const link = document.querySelector('#intent .h-e-btn');
  link.replaceWith(link.cloneNode(true));
  const result = await probeIntentEditor(document, { editorWaitMs: 80 });
  assert.equal(result.reason, 'editor_not_opened');
  assert.equal(clicks.edit, 1);
  assert.equal(clicks.save, 0);
  assert.equal(clicks.cancel, 0);
  assert.equal(clicks.basicSave, 0);
});

test('--open-options reads dropdown text, presses Escape, and does not click options or 保存', async () => {
  const { document, clicks } = mount();
  const result = await probeIntentEditor(document, { openOptions: true });
  assert.equal(result.ok, true);
  assert.equal(result.optionsOpened, true);
  assert.equal(clicks.option, 0);
  assert.equal(clicks.save, 0);
  assert.equal(clicks.submit, 0);
  assert.equal(clicks.deliver, 0);
  assert.equal(clicks.cancel, 1);
  assert.ok(clicks.escape >= 1);
  assert.equal(clicks.trigger, 3);
  assert.deepEqual(result.optionReads.map((row) => row.options.map((option) => option.text)), [
    ['分析师'],
    ['证券业'],
    ['研究员']
  ]);
  assert.equal(result.optionReads.every((row) => row.escapePressed === true && row.optionsClicked === false), true);
  assert.equal(result.clickedLabels.includes('保存'), false);
  assert.equal(result.clickedLabels.includes('提交'), false);
  assert.equal(result.clickedLabels.includes('投递'), false);
});

test('visible 求职意向 text can identify the card when it is not an r-section', async () => {
  const { document, clicks } = mount({ fallback: true });
  const result = await probeIntentEditor(document);
  assert.equal(result.cardVia, 'visible-label');
  assert.equal(result.ok, true);
  assert.deepEqual(result.clickedLabels, ['编辑', '取消']);
  assert.equal(clicks.basicEdit, 0);
  assert.equal(clicks.save, 0);
});

test('CDP attach does not navigate, and a save POST fails the report without its query', async () => {
  const outDir = mkdtempSync(join(tmpdir(), 'gth-intent-probe-'));
  const calls = [];
  const report = await runGthIntentProbe({
    port: 9239,
    outDir,
    now: () => new Date('2026-10-20T08:14:00.000Z'),
    getJson: async () => [{
      type: 'page', id: 'p', url: `${EDIT_PAGE}?token=secret`, title: '简历编辑',
      webSocketDebuggerUrl: 'ws://127.0.0.1:9239/devtools/page/p'
    }],
    connectCdp: async (_wsUrl, opts) => ({
      async send(method, params) {
        calls.push({ method, expression: params?.expression || '', targetUrl: params?.url || '' });
        if (method === 'Network.enable') {
          opts.onEvent?.({
            method: 'Network.requestWillBeSent',
            params: { request: { method: 'POST', url: 'https://hr.gtht.com/api/resume/edit.json?token=secret' } }
          });
        }
        if (method === 'Runtime.evaluate' && String(params?.expression || '').includes('probeIntentEditor')) {
          return { result: { value: {
            ok: true, reason: null, editorLeftOpen: false, editorAlreadyOpen: false, openedByUs: true,
            supported: true, claimedSupported: true, liveSupportClaimed: true,
            fields: [{ label: '期望薪资', controlKind: 'input', value: '12000', supportClaimed: true }],
            actions: [{ type: 'click', label: '编辑', name: '编辑' }, { type: 'click', label: '取消', name: '取消' }],
            network: { feasible: true, posts: [], savePostObserved: false }
          } } };
        }
        if (method === 'Runtime.evaluate') {
          return { result: { value: { href: EDIT_PAGE, title: '简历编辑', readyState: 'complete', password: false } } };
        }
        return {};
      },
      close() {}
    })
  });
  assert.equal(calls.some((call) => call.method === 'Page.navigate'), false);
  assert.equal(calls.some((call) => call.method === 'Target.createTarget'), false);
  assert.equal(calls.some((call) => call.expression.includes('probeIntentEditor')), true);
  assert.equal(report.ok, false);
  assert.equal(report.reason, 'save_post_observed');
  assert.equal(report.exitCode, 3);
  assert.equal(report.supported, false);
  assert.equal(report.claimedSupported, false);
  assert.equal(report.liveSupportClaimed, false);
  assert.equal(report.productSupportUnchanged, true);
  assert.equal(report.fields[0].supportClaimed, false);
  assert.equal(report.tabAction, 'attached');
  const file = JSON.parse(readFileSync(report.path, 'utf8'));
  assert.equal(file.path, report.path);
  assert.equal(JSON.stringify(file).includes('token'), false);
  assert.equal(JSON.stringify(file).includes('webSocketDebuggerUrl'), false);
  assert.equal(file.neverSave, true);
});

test('ambiguous tabs and a login wall do not open the editor or create a tab', async () => {
  const outDir = mkdtempSync(join(tmpdir(), 'gth-intent-probe-'));
  let connected = false;
  const ambiguous = await runGthIntentProbe({
    port: 9239,
    outDir,
    now: () => new Date('2026-10-20T08:14:01.000Z'),
    getJson: async () => [
      { type: 'page', id: 'a', url: `${EDIT_PAGE}?token=secret`, title: '一', webSocketDebuggerUrl: 'ws://127.0.0.1:9239/devtools/page/a' },
      { type: 'page', id: 'b', url: EDIT_PAGE, title: '二', webSocketDebuggerUrl: 'ws://127.0.0.1:9239/devtools/page/b' }
    ],
    connectCdp: async () => { connected = true; throw new Error('should_not_connect'); }
  });
  assert.equal(connected, false);
  assert.equal(ambiguous.reason, 'tab_ambiguous');
  assert.equal(ambiguous.tabAction, 'none');
  assert.equal(JSON.parse(readFileSync(ambiguous.path, 'utf8')).reason, 'tab_ambiguous');
  assert.equal(readFileSync(ambiguous.path, 'utf8').includes('token'), false);

  const calls = [];
  const login = await runGthIntentProbe({
    port: 9239,
    outDir,
    now: () => new Date('2026-10-20T08:14:02.000Z'),
    getJson: async () => [{
      type: 'page', id: 'p', url: EDIT_PAGE, title: '登录',
      webSocketDebuggerUrl: 'ws://127.0.0.1:9239/devtools/page/p'
    }],
    connectCdp: async () => ({
      async send(method, params) {
        calls.push(String(params?.expression || method));
        if (method === 'Runtime.evaluate') {
          return { result: { value: { href: 'https://hr.gtht.com/login', title: '登录', readyState: 'complete', password: true } } };
        }
        return {};
      },
      close() {}
    })
  });
  assert.equal(login.reason, 'needs_login');
  assert.equal(calls.some((expression) => expression.includes('probeIntentEditor')), false);
});

test('no matching tab opens only the resume edit URL and never a login form', async () => {
  const outDir = mkdtempSync(join(tmpdir(), 'gth-intent-probe-'));
  const calls = [];
  let created = false;
  const broad = await runGthIntentProbe({
    port: 9239,
    urlMatch: 'hr.gtht.com/resume',
    outDir,
    now: () => new Date('2026-10-20T08:14:03.000Z'),
    getJson: async () => [],
    connectCdp: async () => { throw new Error('should_not_connect'); }
  });
  assert.equal(broad.reason, 'tab_not_found');
  assert.equal(broad.tabAction, 'none');

  const opened = await runGthIntentProbe({
    port: 9239,
    outDir,
    now: () => new Date('2026-10-20T08:14:04.000Z'),
    getJson: async (port, pathname) => {
      if (pathname === '/json/version') return { webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/browser/b` };
      if (!created) return [];
      return [{
        id: 'new1', type: 'page', url: EDIT_PAGE, title: '简历编辑',
        webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/page/new1`
      }];
    },
    connectCdp: async (wsUrl) => ({
      async send(method, params) {
        calls.push({ method, url: params?.url || '', expression: params?.expression || '' });
        if (method === 'Target.createTarget') {
          assert.equal(params.url, EDIT_PAGE);
          created = true;
          return { targetId: 'new1' };
        }
        if (method === 'Runtime.evaluate' && String(params?.expression || '').includes('probeIntentEditor')) {
          return { result: { value: {
            ok: true, reason: null, editorLeftOpen: false, fields: [],
            actions: [{ type: 'click', label: '编辑', name: '编辑' }, { type: 'click', label: '取消', name: '取消' }],
            network: { feasible: true, posts: [] }
          } } };
        }
        if (method === 'Runtime.evaluate') {
          return { result: { value: { href: EDIT_PAGE, title: '简历编辑', readyState: 'complete', password: false } } };
        }
        return {};
      },
      close() {}
    })
  });
  assert.equal(opened.tabAction, 'created');
  assert.equal(opened.ok, true);
  assert.equal(calls.some((call) => call.method === 'Page.navigate'), false);
  assert.equal(calls.filter((call) => call.method === 'Target.createTarget').length, 1);
});

test('connectCdp reports a network event without dropping the command reply', async () => {
  const http = await import('node:http');
  const { WebSocketServer } = await import('ws');
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('[]');
  });
  const wss = new WebSocketServer({ server });
  wss.on('connection', (socket) => {
    socket.on('message', (buf) => {
      const msg = JSON.parse(String(buf));
      if (msg.method === 'Network.enable') {
        socket.send(JSON.stringify({
          method: 'Network.requestWillBeSent',
          params: { request: { method: 'POST', url: 'https://hr.gtht.com/api/resume/edit.json?token=secret' } }
        }));
      }
      if (msg.id != null) socket.send(JSON.stringify({ id: msg.id, result: { enabled: true } }));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const seen = [];
  try {
    const session = await connectCdp(`ws://127.0.0.1:${port}/devtools/page/x`, {
      timeoutMs: 2000,
      onEvent: (msg) => seen.push(msg)
    });
    const reply = await session.send('Network.enable');
    assert.equal(reply.enabled, true);
    assert.equal(seen.length, 1);
    assert.equal(isSavePost('POST', seen[0].params.request.url), true);
    assert.equal(redactUrl(seen[0].params.request.url).includes('token'), false);
    session.close();
  } finally {
    for (const client of wss.clients) client.terminate();
    await new Promise((resolve) => wss.close(() => server.close(resolve)));
  }
});

test('buildReport cannot be talked into a support claim', () => {
  const report = buildReport({
    ok: true,
    reason: null,
    editorLeftOpen: false,
    supported: true,
    claimedSupported: true,
    liveSupportClaimed: true,
    fields: [{ label: '期望从事职位类别', controlKind: 'el-cascader', supportClaimed: true }],
    actions: [{ type: 'click', label: '取消', name: '取消' }]
  }, {
    probedAt: '2026-10-20T08:14:00.000Z',
    port: 9239,
    urlMatch: DEFAULT_URL_MATCH,
    openOptions: false,
    tabAction: 'attached',
    cdpPosts: [],
    cdpNetwork: true
  });
  assert.equal(report.supported, false);
  assert.equal(report.claimedSupported, false);
  assert.equal(report.liveSupportClaimed, false);
  assert.equal(report.productSupportUnchanged, true);
  assert.deepEqual(report.stillUnsupportedInProduct, ['期望从事职位类别', '现从事行业', '现从事职位类别', '现薪资']);
  assert.equal(report.evidence.find((row) => row.question === '期望从事职位类别').supportClaimed, false);
  assert.equal(report.fields[0].supportClaimed, false);
  assert.deepEqual(report.staticInlineForms, []);
  const leaked = buildReport({
    ok: true,
    reason: null,
    editorLeftOpen: false,
    staticInlineForms: [{ section: '基本信息', labels: ['姓名'], value: 'secret-value' }]
  }, {
    probedAt: '2026-10-20T08:14:00.000Z',
    port: 9239,
    urlMatch: DEFAULT_URL_MATCH,
    openOptions: false,
    tabAction: 'attached',
    cdpPosts: [],
    cdpNetwork: false
  });
  assert.deepEqual(leaked.staticInlineForms, [{ section: '基本信息', labels: ['姓名'] }]);
  assert.equal(JSON.stringify(leaked.staticInlineForms).includes('secret-value'), false);
  assert.equal(leaked.supported, false);
});
