// Offline census of the generalized GTH section probe. Fixtures are stubs.
// Never Save: 保存 / 提交 / 投递 / 删除 stay unclicked. No support claim.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { EDIT_PAGE } from '../scripts/probe-gth-intent.mjs';
import {
  HELP,
  SECTION_NAMES,
  buildProbeExpression,
  buildReport,
  isKnownDictEndpoint,
  isUnexpectedWrite,
  KNOWN_DICT_FILES,
  parseProbeArgs,
  probeOutputPath,
  probeSectionEditor
} from '../scripts/probe-gth-section.mjs';

const source = readFileSync(new URL('../scripts/probe-gth-section.mjs', import.meta.url), 'utf8');
const PAGE = EDIT_PAGE;
const SECRET = 'STATIC_FORM_VALUE_DO_NOT_RECORD';

function norm(value) {
  return String(value ?? '').replace(/[\s\u00a0]+/gu, ' ').trim();
}

function editorForm({ rich = false, options = false } = {}) {
  const richFields = rich || options ? `
    <div class="el-form-item is-required" id="school-item">
      <label class="el-form-item__label">学校</label>
      <div class="el-form-item__content"><div class="el-input"><input class="el-input__inner" placeholder="请输入学校" value="示例大学"></div></div>
    </div>
    <div class="el-form-item" id="degree-item">
      <label class="el-form-item__label">学历</label>
      <div class="el-form-item__content"><div class="el-select"><div class="el-input"><input id="degree-trigger" class="el-input__inner" readonly placeholder="请选择" value="硕士"></div>
        <div class="el-select-dropdown" style="display:none"><div class="el-select-dropdown__item">本科</div><div class="el-select-dropdown__item">硕士</div></div>
      </div></div>
    </div>
    <div class="el-form-item" id="date-item">
      <label class="el-form-item__label">在校时间</label>
      <div class="el-form-item__content">
        <div class="el-date-editor el-date-editor--month"><input class="el-input__inner" readonly value="2020-09"></div>
        <div class="el-date-editor el-date-editor--month"><input class="el-input__inner" readonly value="2024-06"></div>
      </div>
    </div>
    <div class="el-form-item" id="cat-item">
      <label class="el-form-item__label">专业类别</label>
      <div class="el-form-item__content cascader-wrap">
        <div class="input-l pointer"><input id="cat-trigger" class="el-input__inner" readonly value="经济学"></div>
        <div class="dialog-wrap plugin-dialog-wrap" style="display:none">
          <div class="eo-cascader-panel">
            <div class="eo-cascader-menu simple-tree-outer"><ul class="simple-tree-wrapper">
              <li class="branch has-child"><span>经济学</span></li>
              <li class="branch has-child"><span>法学</span></li>
            </ul></div>
            <div class="eo-cascader-menu simple-tree-outer"><ul class="simple-tree-wrapper">
              <li class="branch"><label><input type="checkbox">理论经济学</label></li>
            </ul></div>
          </div>
          <a class="confirm pop-btn">确定</a>
          <a class="cancel pop-btn">取消</a>
        </div>
      </div>
    </div>
    <div class="el-form-item" id="note-item">
      <label class="el-form-item__label">在校活动</label>
      <div class="el-form-item__content"><textarea placeholder="请填写">社团</textarea></div>
    </div>
    <div class="el-form-item" id="file-item">
      <label class="el-form-item__label">成绩单</label>
      <div class="el-form-item__content"><div class="el-upload"><input type="file"></div></div>
    </div>
    <div class="el-form-item" id="pay-item">
      <label class="el-form-item__label">现薪资</label>
      <div class="el-form-item__content"><div class="el-input is-disabled"><input class="el-input__inner" readonly value="8000"></div></div>
    </div>
    ${options ? `
      <div class="el-form-item" id="bare-item">
        <label class="el-form-item__label">备用学历</label>
        <div class="el-form-item__content"><div class="el-select"><div class="el-input"><input id="bare-trigger" class="el-input__inner" readonly placeholder="请选择" value=""></div></div></div>
      </div>
      <div class="el-form-item" id="bare2-item">
        <label class="el-form-item__label">第二备用</label>
        <div class="el-form-item__content"><div class="el-select"><div class="el-input"><input id="bare2-trigger" class="el-input__inner" readonly value=""></div></div></div>
      </div>` : ''}` : `
    <div class="el-form-item is-required"><label class="el-form-item__label">学校</label><div class="el-form-item__content"><div class="el-input"><input class="el-input__inner" placeholder="请输入学校" value="示例大学"></div></div></div>`;
  return `<form id="editor-form">${richFields}
    <button type="button" id="editor-save">保存</button>
    <button type="button" id="editor-submit">提交</button>
    <button type="button" id="editor-deliver">投递</button>
    <button type="button" id="editor-delete">删除</button>
    <button type="button" id="editor-cancel">取消</button>
  </form>`;
}

function basicSection() {
  return `<section class="r-section" id="basic"><div class="title_">基本信息</div><form id="basic-form" class="el-form sec-form"><div class="el-form-item"><label class="el-form-item__label">姓名</label><input value="${SECRET}"></div><div class="el-form-item"><label class="el-form-item__label">手机号码</label><input value=""></div><button type="button" id="basic-cancel">取消</button><button type="button" id="basic-save">保存</button></form></section>`;
}

function editLink({ hidden = false, removed = false } = {}) {
  if (removed) return '';
  const style = hidden ? ' style="display:none"' : '';
  return `<a class="h-e-btn" href="javascript:;"${style}>编辑</a>`;
}

function harness(html, { insertOn, postUrl, postMethod = 'POST' } = {}) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}<div id="late-menu" class="el-select-dropdown" style="display:none"><div class="el-select-dropdown__item">稍后</div></div></body>`, {
    url: PAGE,
    pretendToBeVisual: true
  });
  const { window } = dom;
  const { document } = window;
  window.Element.prototype.getClientRects = () => [{ width: 8, height: 8, top: 0, left: 0, bottom: 8, right: 8 }];
  window.fetch = async () => ({ ok: true });
  const clicks = {
    edit: 0, add: 0, cancel: 0, save: 0, submit: 0, deliver: 0, delete: 0,
    basicCancel: 0, trigger: 0, branch: 0, option: 0, confirm: 0, panelCancel: 0,
    escape: 0, byEntry: [], bare: 0, bare2: 0
  };
  document.addEventListener('click', (event) => {
    const node = event.target;
    if (node.id === 'bare-trigger') {
      clicks.bare += 1;
      document.getElementById('late-menu').style.display = 'block';
    }
    if (node.id === 'bare2-trigger') clicks.bare2 += 1;
    if (node.classList?.contains('el-input__inner')) clicks.trigger += 1;
    if (node.closest?.('li.branch')) clicks.branch += 1;
    if (node.closest?.('.el-select-dropdown__item, .el-cascader-node')) clicks.option += 1;
    if (node.closest?.('a.confirm')) clicks.confirm += 1;
    const control = node.closest?.('a, button');
    if (!control) return;
    const name = norm(control.textContent);
    const iconEdit = !!control.querySelector('.el-icon-edit-outline');
    if (name === '编辑' || iconEdit) {
      clicks.edit += 1;
      const entry = control.closest('.sec-detail');
      if (entry) clicks.byEntry.push(entry.dataset.entry);
    }
    if (name === '添加' || name === '新增') clicks.add += 1;
    if (name.includes('保存')) clicks.save += 1;
    if (name === '提交') clicks.submit += 1;
    if (name === '投递') clicks.deliver += 1;
    if (name === '删除') clicks.delete += 1;
    if (name === '取消') {
      if (control.closest('.plugin-dialog-wrap, .eo-cascader-panel')) clicks.panelCancel += 1;
      else if (control.closest('#basic-form')) clicks.basicCancel += 1;
      else {
        clicks.cancel += 1;
        const form = control.closest('form');
        if (form) form.style.display = 'none';
      }
    }
    const opened = name === '编辑' || iconEdit || name === '添加' || name === '新增';
    if (opened && insertOn && !document.getElementById('editor-form')) {
      document.getElementById(insertOn).insertAdjacentHTML('beforeend', editorForm({ rich: true }));
    }
    if (opened && postUrl) window.fetch(postUrl, { method: postMethod });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    clicks.escape += 1;
    const menu = document.getElementById('late-menu');
    if (menu) menu.style.display = 'none';
  });
  return { document, clicks };
}

function closedSection(title, { hidden = false, removed = false, open = false, rich = false, options = false } = {}) {
  return `<section class="r-section" id="target"><div class="title_">${title}${editLink({ hidden, removed })}</div>${open ? editorForm({ rich, options }) : ''}</section>`;
}

function untouched(clicks, extra = {}) {
  assert.equal(clicks.save, 0);
  assert.equal(clicks.submit, 0);
  assert.equal(clicks.deliver, 0);
  assert.equal(clicks.delete, 0);
  assert.equal(clicks.basicCancel, 0);
  assert.equal(clicks.panelCancel, 0);
  assert.equal(clicks.branch, 0);
  assert.equal(clicks.confirm, 0);
  for (const [key, value] of Object.entries(extra)) assert.equal(clicks[key], value, key);
}

test('probe source clicks once, never navigates, and never claims support', () => {
  assert.equal((source.match(/\.click\s*\(/g) || []).length, 1);
  assert.doesNotMatch(source, /Page\.navigate/);
  assert.doesNotMatch(source, /Input\.dispatch/);
  assert.doesNotMatch(source, /\.submit\s*\(/);
  assert.doesNotMatch(source, /supported:\s*true/);
  assert.doesNotMatch(source, /claimedSupported:\s*true/);
  assert.doesNotMatch(source, /liveSupportClaimed:\s*true/);
  assert.match(source, /Page\.setWebLifecycleState/);
  assert.match(HELP, /--section/);
  assert.match(HELP, /--add/);
  assert.match(HELP, /--open-options/);
  assert.match(HELP, /Never Save/);
  for (const name of SECTION_NAMES) assert.match(source, new RegExp(name));
  for (const file of KNOWN_DICT_FILES) assert.match(isKnownDictEndpoint.toString(), new RegExp(file.replace(/\./g, '\\.')));
});

test('args require a known section and reject a second flag', () => {
  assert.equal(parseProbeArgs(['--section', '教育经历']).port, 9239);
  assert.equal(parseProbeArgs(['--section', '工作经验']).entry, 0);
  assert.equal(parseProbeArgs(['--section', '工作经验']).entryExplicit, false);
  assert.equal(parseProbeArgs(['--section', '教育经历', '--entry', '2', '--open-options']).entry, 2);
  assert.equal(parseProbeArgs(['--section', '教育经历', '--add']).add, true);
  assert.throws(() => parseProbeArgs([]), /missing --section/);
  assert.throws(() => parseProbeArgs(['--section', '基本信息']), /unknown section/);
  assert.throws(() => parseProbeArgs(['--section', '附件简历']), /unknown section/);
  assert.throws(() => parseProbeArgs(['--section', '教育经历', '--section', '工作经验']), /duplicate --section/);
  assert.throws(() => parseProbeArgs(['--section', '教育经历', '--add', '--entry', '1']), /cannot combine --add and --entry/);
  assert.throws(() => parseProbeArgs(['--section', '教育经历', '--navigate']), /unknown argument/);
  const stamp = probeOutputPath('/tmp/out', '职业技能与特长', new Date('2026-10-20T09:41:00.000Z'));
  assert.match(stamp, /probe-gth-section-职业技能与特长-20261020T094100000Z\.json$/u);
});

test('writes other than a known dictionary POST are failures, and queries stay off the report', () => {
  const secret = 'https://hr.gtht.com/api/resume/edit.json?token=secret';
  const dict = 'https://hr.gtht.com/api/dict/getsalaryunit.json?token=secret';
  assert.equal(isUnexpectedWrite('POST', secret), true);
  assert.equal(isUnexpectedWrite('POST', dict), false);
  assert.equal(isUnexpectedWrite('GET', secret), false);
  assert.equal(isUnexpectedWrite('GET', dict), false);
  assert.equal(isUnexpectedWrite('PUT', dict), true);
  assert.equal(isUnexpectedWrite('DELETE', dict), true);
  assert.equal(isKnownDictEndpoint(dict), true);
  assert.equal(isKnownDictEndpoint(secret), false);
});

test('an opened section editor is censused and closed without 保存 提交 投递 or 删除', async () => {
  const { document, clicks } = harness(`${basicSection()}${closedSection('教育经历')}`, { insertOn: 'target' });
  const result = await probeSectionEditor(document, { section: '教育经历' });
  assert.equal(result.ok, true);
  assert.equal(result.reason, null);
  assert.equal(result.editorLeftOpen, false);
  assert.equal(result.supported, false);
  assert.equal(result.claimedSupported, false);
  assert.equal(result.liveSupportClaimed, false);
  assert.deepEqual(result.clickedLabels, ['编辑', '取消']);
  assert.deepEqual(result.staticInlineForms, [{ section: '基本信息', labels: ['姓名', '手机号码'] }]);
  const school = result.fields.find((field) => field.label === '学校');
  const dates = result.fields.find((field) => field.label === '在校时间');
  const category = result.fields.find((field) => field.label === '专业类别');
  const activity = result.fields.find((field) => field.label === '在校活动');
  const file = result.fields.find((field) => field.label === '成绩单');
  const pay = result.fields.find((field) => field.label === '现薪资');
  const degree = result.fields.find((field) => field.label === '学历');
  assert.equal(school.controlKind, 'el-input');
  assert.equal(school.required, true);
  assert.equal(school.placeholder, '请输入学校');
  assert.equal(school.value, '示例大学');
  assert.equal(school.classes.includes('el-input'), true);
  assert.equal(school.supportClaimed, false);
  assert.equal(degree.controlKind, 'el-select');
  assert.equal(dates.controlKind, 'el-date-editor');
  assert.equal(dates.value, '2020-09 | 2024-06');
  assert.equal(category.controlKind, 'cascader-wrap');
  assert.equal(category.value, '经济学');
  assert.equal(activity.controlKind, 'textarea');
  assert.equal(activity.placeholder, '请填写');
  assert.equal(activity.value, '社团');
  assert.equal(file.controlKind, 'upload');
  assert.equal(file.value, '');
  assert.equal(file.note, 'upload_not_read');
  assert.equal(pay.controlKind, 'el-input');
  assert.equal(pay.readOnly, true);
  assert.equal(pay.value, '8000');
  assert.equal(JSON.stringify(result).includes(SECRET), false);
  untouched(clicks, { edit: 1, cancel: 1, add: 0 });
  assert.equal(document.querySelector('#basic-form').style.display, '');
  assert.equal(document.querySelector('#basic-form input').value, SECRET);
});

test('every allowed section name opens its own 编辑 and then 取消', async () => {
  for (const section of SECTION_NAMES) {
    const { document, clicks } = harness(closedSection(section), { insertOn: 'target' });
    const result = await probeSectionEditor(document, { section });
    assert.equal(result.ok, true, section);
    assert.equal(result.supported, false, section);
    assert.deepEqual(result.clickedLabels, ['编辑', '取消'], section);
    untouched(clicks, { edit: 1, cancel: 1 });
  }
});

test('a hidden 编辑 link means that section editor is already open', async () => {
  const { document, clicks } = harness(`${basicSection()}${closedSection('工作经验', { hidden: true, open: true })}`);
  const result = await probeSectionEditor(document, { section: '工作经验' });
  assert.equal(result.ok, true);
  assert.equal(result.editorAlreadyOpen, true);
  assert.equal(result.editorLeftOpen, false);
  assert.deepEqual(result.clickedLabels, ['取消']);
  assert.equal(result.fields.some((field) => field.label === '学校'), true);
  untouched(clicks, { edit: 0, cancel: 1 });
});

test('求职意向 with the 编辑 link removed is still the open editor', async () => {
  const { document, clicks } = harness(closedSection('求职意向', { removed: true, open: true }));
  const result = await probeSectionEditor(document, { section: '求职意向' });
  assert.equal(result.ok, true);
  assert.equal(result.editorAlreadyOpen, true);
  assert.deepEqual(result.clickedLabels, ['取消']);
  assert.equal(result.supported, false);
  untouched(clicks, { edit: 0, cancel: 1 });
});

test('a permanent 基本信息 form is recorded and does not block', async () => {
  const { document, clicks } = harness(`${basicSection()}${closedSection('其他信息')}`, { insertOn: 'target' });
  const result = await probeSectionEditor(document, { section: '其他信息' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.staticInlineForms, [{ section: '基本信息', labels: ['姓名', '手机号码'] }]);
  assert.equal(result.fields.some((field) => field.label === '姓名'), false);
  assert.equal(JSON.stringify(result).includes(SECRET), false);
  untouched(clicks, { edit: 1, cancel: 1, basicCancel: 0 });
  assert.equal(document.querySelector('#basic-form').style.display, '');
});

test('multi-entry sections open only the requested entry, default the first', async () => {
  const entries = [0, 1].map((index) => `<div class="sec-detail" data-entry="${index}"><a href="javascript:;"><i class="el-icon-edit-outline"></i></a></div>`).join('');
  const html = `${basicSection()}<section class="r-section" id="target"><div class="title_">教育经历<a class="h-e-btn" href="javascript:;">添加</a></div><div class="sec-context">${entries}</div></section>`;
  const first = harness(html, { insertOn: 'target' });
  const opened = await probeSectionEditor(first.document, { section: '教育经历' });
  assert.equal(opened.ok, true);
  assert.equal(opened.entry, 0);
  assert.deepEqual(opened.clickedLabels, ['编辑', '取消']);
  assert.deepEqual(first.clicks.byEntry, ['0']);
  untouched(first.clicks, { edit: 1, add: 0, cancel: 1 });

  const second = harness(html, { insertOn: 'target' });
  const picked = await probeSectionEditor(second.document, { section: '教育经历', entry: 1, entryExplicit: true });
  assert.equal(picked.ok, true);
  assert.deepEqual(picked.clickedLabels, ['编辑', '取消']);
  assert.deepEqual(second.clicks.byEntry, ['1']);
  untouched(second.clicks, { edit: 1, add: 0, cancel: 1 });

  const missing = harness(html, { insertOn: 'target' });
  const out = await probeSectionEditor(missing.document, { section: '教育经历', entry: 5, entryExplicit: true });
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'entry_not_found');
  assert.deepEqual(out.clickedLabels, []);
  untouched(missing.clicks, { edit: 0, add: 0, cancel: 0 });
});

test('a hidden entry 编辑 is that entry\'s open editor, and a different entry blocks', async () => {
  const entries = [0, 1].map((index) => {
    const style = index === 0 ? ' style="display:none"' : '';
    return `<div class="sec-detail" data-entry="${index}"><a href="javascript:;"${style}><i class="el-icon-edit-outline"></i></a></div>`;
  }).join('');
  const html = `<section class="r-section" id="target"><div class="title_">工作经验</div><div class="sec-context">${entries}</div>${editorForm()}</section>`;
  const own = harness(html);
  const result = await probeSectionEditor(own.document, { section: '工作经验', entry: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.editorAlreadyOpen, true);
  assert.deepEqual(result.clickedLabels, ['取消']);
  untouched(own.clicks, { edit: 0, cancel: 1 });

  const other = harness(html);
  const blocked = await probeSectionEditor(other.document, { section: '工作经验', entry: 1, entryExplicit: true });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'entry_editor_mismatch');
  assert.deepEqual(blocked.clickedLabels, []);
  assert.equal(other.document.querySelector('#editor-form').style.display, '');
  untouched(other.clicks, { edit: 0, cancel: 0 });
});

test('--add clicks the unique 添加 trigger and not an entry 编辑', async () => {
  const entries = `<div class="sec-detail" data-entry="0"><a href="javascript:;"><i class="el-icon-edit-outline"></i></a></div>`;
  const html = `<section class="r-section" id="target"><div class="title_">教育经历<a class="h-e-btn" href="javascript:;">添加</a></div><div class="sec-context">${entries}</div></section>`;
  const { document, clicks } = harness(html, { insertOn: 'target' });
  const result = await probeSectionEditor(document, { section: '教育经历', add: true });
  assert.equal(result.ok, true);
  assert.equal(result.add, true);
  assert.deepEqual(result.clickedLabels, ['添加', '取消']);
  assert.deepEqual(clicks.byEntry, []);
  untouched(clicks, { add: 1, edit: 0, cancel: 1 });

  const two = harness(`<section class="r-section" id="target"><div class="title_">教育经历<a href="javascript:;">添加</a><a href="javascript:;">新增</a></div></section>`);
  const ambiguous = await probeSectionEditor(two.document, { section: '教育经历', add: true });
  assert.equal(ambiguous.reason, 'add_not_unique');
  assert.deepEqual(ambiguous.clickedLabels, []);
  untouched(two.clicks, { add: 0, edit: 0, cancel: 0 });

  const none = harness(closedSection('职业技能与特长'));
  const missing = await probeSectionEditor(none.document, { section: '职业技能与特长', add: true });
  assert.equal(missing.reason, 'add_not_found');
  assert.deepEqual(missing.clickedLabels, []);
  untouched(none.clicks, { edit: 0, cancel: 0 });
});

test('an already-open editor blocks --add before any click', async () => {
  const { document, clicks } = harness(closedSection('教育经历', { hidden: true, open: true }));
  const result = await probeSectionEditor(document, { section: '教育经历', add: true });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'editor_already_open');
  assert.deepEqual(result.clickedLabels, []);
  assert.equal(document.querySelector('#editor-form').style.display, '');
  untouched(clicks, { edit: 0, add: 0, cancel: 0 });
});

test('another section\'s open editor blocks before the target is clicked', async () => {
  const foreign = `<section class="r-section" id="foreign"><div class="title_">求职意向<a href="javascript:;" style="display:none">编辑</a></div><form id="foreign-form"><div class="el-form-item"><label class="el-form-item__label">期望薪资</label><input value="1"></div><button type="button" id="foreign-cancel">取消</button><button type="button" id="foreign-save">保存</button></form></section>`;
  const { document, clicks } = harness(`${basicSection()}${foreign}${closedSection('教育经历')}`, { insertOn: 'target' });
  const result = await probeSectionEditor(document, { section: '教育经历' });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'other_editor_open');
  assert.equal(result.detail.editorCount, 1);
  assert.deepEqual(result.clickedLabels, []);
  assert.deepEqual(result.staticInlineForms, [{ section: '基本信息', labels: ['姓名', '手机号码'] }]);
  assert.equal(document.querySelector('#foreign-form').style.display, '');
  untouched(clicks, { edit: 0, cancel: 0 });
});

test('a resume POST fails the census and a dictionary POST does not', async () => {
  const saveUrl = 'https://hr.gtht.com/api/resume/edit.json?token=secret';
  const save = harness(closedSection('其他信息'), { insertOn: 'target', postUrl: saveUrl });
  const failed = await probeSectionEditor(save.document, { section: '其他信息' });
  assert.equal(failed.ok, false);
  assert.equal(failed.reason, 'unexpected_post');
  assert.equal(failed.network.unexpectedPostObserved, true);
  assert.equal(failed.network.savePostObserved, true);
  assert.equal(failed.network.posts[0].url, 'https://hr.gtht.com/api/resume/edit.json');
  assert.equal(JSON.stringify(failed).includes('token'), false);
  untouched(save.clicks, { edit: 1, cancel: 1 });

  const dictUrl = 'https://hr.gtht.com/api/dict/getsalaryunit.json?token=secret';
  const dict = harness(closedSection('其他信息'), { insertOn: 'target', postUrl: dictUrl });
  const allowed = await probeSectionEditor(dict.document, { section: '其他信息' });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.reason, null);
  assert.equal(allowed.network.unexpectedPostObserved, false);
  assert.equal(allowed.network.posts[0].url, 'https://hr.gtht.com/api/dict/getsalaryunit.json');
  assert.equal(JSON.stringify(allowed).includes('token'), false);
  untouched(dict.clicks, { edit: 1, cancel: 1 });

  const lookup = harness(closedSection('其他信息'), {
    insertOn: 'target',
    postUrl: saveUrl,
    postMethod: 'GET'
  });
  const got = await probeSectionEditor(lookup.document, { section: '其他信息' });
  assert.equal(got.ok, true);
  assert.equal(got.network.unexpectedPostObserved, false);
  assert.deepEqual(got.network.posts, []);
  assert.equal(JSON.stringify(got).includes('token'), false);
});

test('--open-options reads hidden lists and opens only one select that has no list', async () => {
  const { document, clicks } = harness(closedSection('教育经历', { hidden: true, open: true, options: true }));
  const result = await probeSectionEditor(document, { section: '教育经历', openOptions: true });
  assert.equal(result.ok, true);
  assert.equal(result.optionsOpened, true);
  const degree = result.optionReads.find((row) => row.label === '学历');
  const category = result.optionReads.find((row) => row.label === '专业类别');
  const bare = result.optionReads.find((row) => row.label === '备用学历');
  const second = result.optionReads.find((row) => row.label === '第二备用');
  assert.equal(degree.renderedInPlace, true);
  assert.deepEqual(degree.options.map((option) => option.text), ['本科', '硕士']);
  assert.equal(degree.openedSelect, false);
  assert.equal(category.renderedInPlace, true);
  assert.deepEqual(category.levels.find((level) => level.level === 1).options.map((option) => option.text), ['经济学', '法学']);
  assert.deepEqual(category.levels.find((level) => level.level === 2).options.map((option) => option.text), ['理论经济学']);
  assert.equal(bare.openedSelect, true);
  assert.equal(bare.escapePressed, true);
  assert.deepEqual(bare.options.map((option) => option.text), ['稍后']);
  assert.equal(second.reason, 'select_open_skipped');
  assert.equal(second.openedSelect, false);
  assert.equal(clicks.bare, 1);
  assert.equal(clicks.bare2, 0);
  assert.equal(clicks.trigger, 1);
  assert.equal(clicks.branch, 0);
  assert.equal(clicks.option, 0);
  assert.equal(clicks.confirm, 0);
  assert.ok(clicks.escape >= 1);
  untouched(clicks, { edit: 0, cancel: 1 });
  assert.equal(result.clickedLabels.includes('保存'), false);
  assert.equal(result.clickedLabels.includes('删除'), false);
});

test('the page bundle opens 求职意向 and only cancels', async () => {
  const dom = new JSDOM(`<!DOCTYPE html><body>${closedSection('求职意向')}</body>`, { url: PAGE, pretendToBeVisual: true, runScripts: 'dangerously' });
  dom.window.Element.prototype.getClientRects = () => [{ width: 8, height: 8, top: 0, left: 0, bottom: 8, right: 8 }];
  dom.window.fetch = async () => ({ ok: true });
  const clicks = { save: 0, cancel: 0 };
  dom.window.document.addEventListener('click', (event) => {
    const name = norm(event.target.closest?.('a, button')?.textContent);
    if (name.includes('保存')) clicks.save += 1;
    if (name === '编辑' && !dom.window.document.getElementById('editor-form')) {
      dom.window.document.getElementById('target').insertAdjacentHTML('beforeend', editorForm());
    }
    if (name === '取消') {
      clicks.cancel += 1;
      const form = event.target.closest('form');
      if (form) form.style.display = 'none';
    }
  });
  const result = await vm.runInContext(buildProbeExpression({ section: '求职意向', openOptions: false }), dom.getInternalVMContext());
  assert.equal(result.ok, true);
  assert.deepEqual([...result.clickedLabels].map((label) => String(label)), ['编辑', '取消']);
  assert.equal(result.supported, false);
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(clicks.save, 0);
  assert.equal(clicks.cancel, 1);
});

test('buildReport cannot be talked into a support claim', () => {
  const report = buildReport({
    ok: true,
    reason: null,
    editorLeftOpen: false,
    supported: true,
    claimedSupported: true,
    liveSupportClaimed: true,
    section: '教育经历',
    fields: [{ label: '学校', controlKind: 'el-input', required: true, supportClaimed: true, value: '示例' }],
    actions: [{ type: 'click', label: '取消', name: '取消' }],
    staticInlineForms: [{ section: '基本信息', labels: ['姓名'], value: SECRET }]
  }, {
    probedAt: '2026-10-20T09:41:00.000Z',
    port: 9239,
    urlMatch: 'hr.gtht.com/resume/edit',
    section: '教育经历',
    entry: 0,
    add: false,
    openOptions: false,
    tabAction: 'attached',
    cdpPosts: [],
    cdpNetwork: true
  });
  assert.equal(report.supported, false);
  assert.equal(report.claimedSupported, false);
  assert.equal(report.liveSupportClaimed, false);
  assert.equal(report.supportClaimed, false);
  assert.equal(report.productSupportUnchanged, true);
  assert.equal(report.formFillClaimed, false);
  assert.equal(report.fields[0].supportClaimed, false);
  assert.equal(report.fields[0].required, true);
  assert.deepEqual(report.staticInlineForms, [{ section: '基本信息', labels: ['姓名'] }]);
  assert.equal(JSON.stringify(report.staticInlineForms).includes(SECRET), false);
});

test('CDP wakes the tab before the census and a save POST fails without its query', async () => {
  const outDir = mkdtempSync(join(tmpdir(), 'gth-section-probe-'));
  const calls = [];
  const { runGthSectionProbe } = await import('../scripts/probe-gth-section.mjs');
  const report = await runGthSectionProbe({
    port: 9239,
    section: '教育经历',
    outDir,
    now: () => new Date('2026-10-20T09:41:00.000Z'),
    getJson: async () => [{
      type: 'page', id: 'p', url: `${EDIT_PAGE}?token=secret`, title: '简历编辑',
      webSocketDebuggerUrl: 'ws://127.0.0.1:9239/devtools/page/p'
    }],
    connectCdp: async (_wsUrl, opts) => ({
      async send(method, params) {
        calls.push({ method, expression: params?.expression || '', state: params?.state || '' });
        if (method === 'Network.enable') {
          opts.onEvent?.({
            method: 'Network.requestWillBeSent',
            params: { request: { method: 'POST', url: 'https://hr.gtht.com/api/resume/edit.json?token=secret' } }
          });
        }
        if (method === 'Runtime.evaluate' && String(params?.expression || '').includes('probeSectionEditor')) {
          return { result: { value: {
            ok: true, reason: null, editorLeftOpen: false, supported: true, claimedSupported: true,
            fields: [{ label: '学校', controlKind: 'el-input', value: '示例', supportClaimed: true }],
            actions: [{ type: 'click', label: '编辑', name: '编辑' }, { type: 'click', label: '取消', name: '取消' }],
            network: { feasible: true, posts: [], unexpectedPostObserved: false }
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
  const lifecycle = calls.findIndex((call) => call.method === 'Page.setWebLifecycleState');
  const probed = calls.findIndex((call) => call.expression.includes('probeSectionEditor'));
  assert.ok(lifecycle >= 0 && lifecycle < probed);
  assert.equal(calls[lifecycle].state, 'active');
  assert.equal(calls.some((call) => call.method === 'Page.navigate'), false);
  assert.equal(report.ok, false);
  assert.equal(report.reason, 'unexpected_post');
  assert.equal(report.exitCode, 3);
  assert.equal(report.supported, false);
  assert.equal(report.fields[0].supportClaimed, false);
  assert.equal(report.section, '教育经历');
  assert.match(report.path, /probe-gth-section-教育经历-/u);
  const file = JSON.parse(readFileSync(report.path, 'utf8'));
  assert.equal(JSON.stringify(file).includes('token'), false);
  assert.equal(JSON.stringify(file).includes('webSocketDebuggerUrl'), false);
  assert.equal(file.neverSave, true);
});
