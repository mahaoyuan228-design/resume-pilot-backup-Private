/**
 * hotjob-mc Never-Save offline fill against the existing fixture DOM.
 * 待真机 Never-Save，未宣称已支持. Does not claim the live site is supported.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import {
  HOTJOB_MC_LIVE_SUPPORT_CLAIMED,
  HOTJOB_MC_NEVER_SAVE_NOTE,
  HOTJOB_MC_FORBIDDEN_ACTIONS,
  HOTJOB_MC_SELECT_OUT_OF_SCOPE,
  planHotjobMcNeverSave
} from '../src/content/hotjob-mc-profile-map.mjs';

const root = resolve('.');
const source = readFileSync(resolve(root, 'src/content/hotjob-mc-basic.js'), 'utf8');
const fixture = readFileSync(resolve(root, 'tests/fixtures/hotjob-mc-basic-form.html'), 'utf8');
const PAGE = 'http://127.0.0.1/SU661f37091eb8053acd6cdf3d/mc/deliver/operationResumer';

function installLayout(window) {
  window.Element.prototype.getClientRects = function getClientRects() {
    let node = this;
    while (node && node.nodeType === 1) {
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return [];
      node = node.parentElement;
    }
    return [{ x: 0, y: 0, width: 20, height: 20, top: 0, left: 0, bottom: 20, right: 20 }];
  };
}

function boot() {
  const dom = new JSDOM(fixture, { url: PAGE, pretendToBeVisual: true, runScripts: 'dangerously' });
  installLayout(dom.window);
  dom.window.chrome = { runtime: { onMessage: { addListener() {}, removeListener() {} } } };
  vm.runInContext(source, dom.getInternalVMContext());
  return dom;
}

const explicitValues = () => ({
  allowExplicitValues: true,
  fullName: '测试甲',
  mobile: '13800138000',
  email: 'mc.user@example.com',
  gender: '女',
  idType: '中国护照'
});

function itemByLabel(document, label) {
  return [...document.querySelectorAll('.my-list-item')].find((node) => {
    const title = node.querySelector('.header-title');
    return title && (title.textContent || '').includes(label);
  }) || null;
}

function snapshot(document) {
  const input = (label) => itemByLabel(document, label)?.querySelector('.am-input-control input')?.value ?? null;
  return {
    name: input('姓名'),
    mobile: input('移动电话'),
    email: input('电子邮箱'),
    neighbor: input('证件号码'),
    gender: document.getElementById('gender-extra')?.textContent?.trim() ?? null,
    idType: document.getElementById('idtype-extra')?.textContent?.trim() ?? null,
    commits: document.defaultView.__hotjobMcCommitClicks,
    popupOpen: document.getElementById('mc-select-popup-wrap')?.classList.contains('open') === true
  };
}

function assertNeverSave(result) {
  assert.equal(result.liveSupportClaimed, false);
  assert.equal(result.supportClaimed, false);
  assert.equal(result.saved, false);
  assert.equal(result.skippedSave, true);
  assert.equal(result.neverSave, true);
  assert.equal(result.neverClickedNext, true);
  assert.equal(result.softwareClickedNext, false);
  assert.equal(result.softwareClickedSave, false);
  assert.equal(result.softwareClickedSubmit, false);
  assert.equal(result.softwareClickedDeliver, false);
  assert.equal(result.softwareClickedDelete, false);
  assert.equal(result.note, HOTJOB_MC_NEVER_SAVE_NOTE);
}

test('map stays unclaimed and refuses 国籍/地区, empty values, and unknown keys', () => {
  assert.equal(HOTJOB_MC_LIVE_SUPPORT_CLAIMED, false);
  assert.equal(HOTJOB_MC_NEVER_SAVE_NOTE, '待真机 Never-Save，未宣称已支持');
  assert.deepEqual([...HOTJOB_MC_FORBIDDEN_ACTIONS], ['下一步', '保存', '提交', '投递', '删除']);
  assert.ok(HOTJOB_MC_SELECT_OUT_OF_SCOPE.includes('国籍/地区'));
  assert.match(source, /待真机 Never-Save，未宣称已支持/);
  assert.match(source, /INPUT_SEL = '\.am-input-control input'/);
  assert.doesNotMatch(source, /input\[type="tel"\]/);
  assert.doesNotMatch(source, /liveSupportClaimed\s*[:=]\s*true/);
  assert.match(fixture, /class="my-list-item"/);
  assert.match(fixture, /select-am-list-extra/);
  assert.match(fixture, /待真机 Never-Save，未宣称已支持/);

  const ready = planHotjobMcNeverSave(explicitValues());
  assert.equal(ready.ok, true);
  assert.equal(ready.reason, 'never_save_plan_ready');
  assert.equal(ready.liveSupportClaimed, false);
  assert.equal(ready.values.gender, '女');
  assert.equal(ready.values.idType, '中国护照');

  const nationality = planHotjobMcNeverSave({ ...explicitValues(), '国籍/地区': '中国' });
  assert.equal(nationality.ok, false);
  assert.equal(nationality.reason, 'select_out_of_scope_search_or_cascader');
  assert.equal(nationality.liveSupportClaimed, false);

  const empty = planHotjobMcNeverSave({ ...explicitValues(), gender: '   ' });
  assert.equal(empty.ok, false);
  assert.equal(empty.reason, 'empty_value');

  const unknown = planHotjobMcNeverSave({ ...explicitValues(), hobby: '钢琴' });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.reason, 'field_not_allowed');

  const notAllowed = planHotjobMcNeverSave({ ...explicitValues(), idType: '军官证' });
  assert.equal(notAllowed.ok, false);
  assert.equal(notAllowed.reason, 'select_option_not_allowed');
});

test('offline fill readback matches allowed text + 性别/证件类型 and never saves', async () => {
  const dom = boot();
  const { document } = dom.window;
  const before = snapshot(document);
  const result = await dom.window.ResumeHotjobMcBasic.fillNeverSave(explicitValues(), { synthetic: true });
  const after = snapshot(document);
  assertNeverSave(result);
  assert.equal(result.ok, true);
  assert.equal(result.reason, 'readback_matched');
  assert.equal(result.writeAttempted, true);
  assert.equal(result.restored, false);
  assert.equal(result.readback['姓名'], '测试甲');
  assert.equal(result.readback['移动电话'], '13800138000');
  assert.equal(result.readback['电子邮箱'], 'mc.user@example.com');
  assert.equal(result.readback['性别'], '女');
  assert.equal(result.readback['证件类型'], '中国护照');
  assert.equal(after.name, '测试甲');
  assert.equal(after.mobile, '13800138000');
  assert.equal(after.email, 'mc.user@example.com');
  assert.equal(after.gender, '女');
  assert.equal(after.idType, '中国护照');
  assert.equal(after.neighbor, 'NEIGHBOR_KEEP');
  assert.equal(before.neighbor, after.neighbor);
  assert.equal(after.commits, 0);
  assert.equal(after.popupOpen, false);
  assert.equal(result.neighbor.value, 'NEIGHBOR_KEEP');
  const selects = result.results.filter((row) => row.label === '性别' || row.label === '证件类型');
  assert.equal(selects.length, 2);
  assert.ok(selects.every((row) => row.ok === true && row.liveSupportClaimed === false && row.clickedOption === true));
});

test('empty, unknown, 国籍/地区, and drifted targets stay untouched while other fields fill', async () => {
  const dom = boot();
  const api = dom.window.ResumeHotjobMcBasic;
  const { document } = dom.window;

  const empty = await api.fillNeverSave({ ...explicitValues(), fullName: '  ' }, { synthetic: true });
  assert.equal(empty.ok, false);
  assert.equal(empty.reason, 'empty_value');
  assert.equal(empty.writeAttempted, false);
  assertNeverSave(empty);
  assert.deepEqual(snapshot(document), {
    name: '', mobile: '', email: '', neighbor: 'NEIGHBOR_KEEP', gender: '男', idType: '居民身份证', commits: 0, popupOpen: false
  });

  const directEmpty = await api.fillText('姓名', '');
  assert.equal(directEmpty.ok, false);
  assert.equal(directEmpty.reason, 'empty_value');
  assert.equal(directEmpty.writeAttempted, false);
  assert.equal(snapshot(document).name, '');

  const nationality = await api.fillNeverSave({ ...explicitValues(), nationality: '中国' }, { synthetic: true });
  assert.equal(nationality.ok, false);
  assert.equal(nationality.reason, 'select_out_of_scope_search_or_cascader');
  assert.equal(nationality.writeAttempted, false);
  assertNeverSave(nationality);

  const region = await api.fillSelect('国籍/地区', '中国', { synthetic: true });
  assert.equal(region.ok, false);
  assert.equal(region.reason, 'select_out_of_scope_search_or_cascader');
  assert.equal(region.clickedOption, false);
  assert.equal(region.liveSupportClaimed, false);
  assert.equal(snapshot(document).popupOpen, false);

  const nativePlace = await api.fillSelect('籍贯', '上海', { synthetic: true });
  assert.equal(nativePlace.reason, 'select_out_of_scope_search_or_cascader');
  const unknownLabel = await api.fillSelect('爱好', '阅读', { synthetic: true });
  assert.equal(unknownLabel.reason, 'label_not_allowed');
  const badOption = await api.fillSelect('性别', '未知', { synthetic: true });
  assert.equal(badOption.ok, false);
  assert.equal(badOption.reason, 'select_option_not_allowed');
  assert.equal(badOption.clickedOption, false);

  const unknownKey = await api.fillNeverSave({ ...explicitValues(), hobby: '钢琴' }, { synthetic: true });
  assert.equal(unknownKey.reason, 'field_not_allowed');
  assert.equal(unknownKey.writeAttempted, false);

  const ambiguousDom = boot();
  const ambiguousDoc = ambiguousDom.window.document;
  const nameItem = itemByLabel(ambiguousDoc, '姓名');
  nameItem.parentElement.appendChild(nameItem.cloneNode(true));
  const ambiguous = await ambiguousDom.window.ResumeHotjobMcBasic.fillNeverSave(explicitValues(), { synthetic: true });
  assert.equal(ambiguous.ok, false);
  assert.equal(ambiguous.reason, 'control_drift');
  assert.equal(ambiguous.writeAttempted, false);
  assert.equal(ambiguous.results.find((row) => row.label === '姓名')?.reason, 'field_ambiguous');
  assert.equal(snapshot(ambiguousDoc).name, '');
  assert.equal(snapshot(ambiguousDoc).gender, '男');
  assert.equal(snapshot(ambiguousDoc).commits, 0);

  const missingDom = boot();
  const missingDoc = missingDom.window.document;
  itemByLabel(missingDoc, '电子邮箱').querySelector('.am-input-control input').remove();
  const missing = await missingDom.window.ResumeHotjobMcBasic.fillNeverSave(explicitValues(), { synthetic: true });
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, 'control_drift');
  assert.equal(missing.writeAttempted, false);
  assert.equal(missing.results.find((row) => row.label === '电子邮箱')?.reason, 'control_not_found');
  assert.equal(snapshot(missingDoc).name, '');
  assert.equal(snapshot(missingDoc).mobile, '');
  assert.equal(snapshot(missingDoc).gender, '男');

  const selectDom = boot();
  const selectDoc = selectDom.window.document;
  const genderExtra = selectDoc.getElementById('gender-extra');
  const extraCopy = genderExtra.cloneNode(true);
  extraCopy.removeAttribute('id');
  genderExtra.parentElement.appendChild(extraCopy);
  const selectDrift = await selectDom.window.ResumeHotjobMcBasic.fillNeverSave(explicitValues(), { synthetic: true });
  assert.equal(selectDrift.ok, false);
  assert.equal(selectDrift.reason, 'control_drift');
  assert.equal(selectDrift.writeAttempted, false);
  assert.equal(selectDrift.results.find((row) => row.label === '性别')?.reason, 'select_extra_ambiguous');
  assert.equal(selectDoc.getElementById('gender-extra').textContent.trim(), '男');
  assert.equal(snapshot(selectDoc).name, '');
  assert.equal(snapshot(selectDoc).commits, 0);

  const strayDom = boot();
  const strayDoc = strayDom.window.document;
  const stray = strayDoc.createElement('input');
  stray.type = 'text';
  stray.value = 'STRAY';
  itemByLabel(strayDoc, '姓名').appendChild(stray);
  const drifted = await strayDom.window.ResumeHotjobMcBasic.fillBasic({
    allowExplicitValues: true,
    fullName: '测试甲',
    mobile: '13800138000',
    email: 'mc.user@example.com'
  }, { synthetic: true, restore: false });
  assert.equal(drifted.ok, false);
  assert.equal(drifted.reason, 'control_drift');
  assert.equal(drifted.writeAttempted, true);
  assert.equal(itemByLabel(strayDoc, '移动电话').querySelector('input').value, '13800138000');
  assert.equal(itemByLabel(strayDoc, '电子邮箱').querySelector('input').value, 'mc.user@example.com');
  assert.equal(drifted.liveSupportClaimed, false);
  assert.equal(drifted.results.find((row) => row.label === '姓名')?.reason, 'control_drift');
  assert.equal(itemByLabel(strayDoc, '姓名').querySelector('.am-input-control input').value, '');
  assert.equal(stray.value, 'STRAY');
  assert.equal(snapshot(strayDoc).commits, 0);
  assert.equal(snapshot(strayDoc).neighbor, 'NEIGHBOR_KEEP');
  assert.equal(snapshot(document).commits, 0);
  assert.equal(snapshot(document).neighbor, 'NEIGHBOR_KEEP');
});

test('forbidden 下一步/保存/提交/投递/删除 clicks are refused', async () => {
  const dom = boot();
  const { document } = dom.window;
  const api = dom.window.ResumeHotjobMcBasic;
  const next = document.getElementById('next-btn');
  let heard = 0;
  next.addEventListener('click', () => { heard += 1; });
  assert.equal(api.pointerClick(next), false);
  assert.equal(heard, 0);
  for (const label of ['保存', '提交', '投递', '删除']) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'my-button';
    button.textContent = label;
    document.body.appendChild(button);
    let clicks = 0;
    button.addEventListener('click', () => { clicks += 1; });
    assert.equal(api.pointerClick(button), false, label);
    assert.equal(clicks, 0, label);
  }
  assert.equal(document.defaultView.__hotjobMcCommitClicks, 0);
  const result = await api.fillNeverSave(explicitValues(), { synthetic: true });
  assert.equal(result.ok, true);
  assert.equal(snapshot(document).commits, 0);
  assertNeverSave(result);
});

test('unconfirmed profile does not write and a confirmed profile readback matches', async () => {
  const dom = boot();
  const api = dom.window.ResumeHotjobMcBasic;
  const blocked = await api.fillNeverSave({
    profile: {
      fullName: '测试甲',
      phone: '13800138000',
      email: 'mc.user@example.com',
      confirmedFields: ['fullName']
    },
    gender: '女'
  }, { synthetic: true });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'profile_fields_unavailable');
  assert.equal(blocked.writeAttempted, false);
  assert.equal(blocked.liveSupportClaimed, false);
  assert.equal(snapshot(dom.window.document).name, '');

  const filled = await api.fillNeverSave({
    profile: {
      fullName: '测试甲',
      phone: '13800138000',
      email: 'mc.user@example.com',
      confirmedFields: ['fullName', 'phone', 'email']
    },
    gender: '女',
    idType: '港澳居民来往内地通行证'
  }, { synthetic: true });
  assert.equal(filled.ok, true);
  assert.equal(filled.reason, 'readback_matched');
  assert.equal(filled.liveSupportClaimed, false);
  assert.equal(snapshot(dom.window.document).name, '测试甲');
  assert.equal(snapshot(dom.window.document).gender, '女');
  assert.equal(snapshot(dom.window.document).idType, '港澳居民来往内地通行证');
  assert.equal(snapshot(dom.window.document).neighbor, 'NEIGHBOR_KEEP');
  assert.equal(snapshot(dom.window.document).commits, 0);
});
