import { parseResumeProfile } from './parser.mjs';
import { mergeResumeCandidates } from './candidates.mjs';
import { loadProfile, saveProfile } from '../profile/store.js';
import { clearAttachment, loadAttachment, MAX_ATTACHMENT_BYTES, saveAttachment } from './attachment-store.js';
import {createSelectionOwner} from './selection-owner.mjs';

const $ = (id) => document.getElementById(id);
let candidates = [];
let busy = false;
let selectedFile = null,selectionToken=null,storedAttachmentToken=null;
const owner=createSelectionOwner({onInvalidate:clearSelection});
function clearSelection(){selectedFile=null;selectionToken=null;storedAttachmentToken=null;candidates=[];busy=false;$('resume-file').value='';$('file-name').textContent='';$('extracted-text').value='';renderCandidates([]);renderWarnings([]);$('save-attachment').disabled=true;$('clear-attachment').disabled=true;setStatus('status','资料已变化，请重新选择当前客户的简历。');}
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&(changes.resumeProfile||changes.resumeProfileLifecycle))owner.changed().catch(()=>{});});

function setStatus(id, message, kind = '') {
  const element = $(id);
  element.textContent = message;
  element.className = id === 'status' ? 'status' : 'import-status';
  if (kind) element.classList.add(kind);
}

function renderWarnings(warnings) {
  const box = $('warnings');
  box.replaceChildren();
  box.hidden = warnings.length === 0;
  if (!warnings.length) return;
  const list = document.createElement('ul');
  for (const warning of warnings) {
    const item = document.createElement('li');
    item.textContent = warning;
    list.append(item);
  }
  box.append(list);
}

function renderCandidates(items) {
  candidates = items;
  $('candidate-count').textContent = `${items.length} 项`;
  const list = $('candidate-list');
  list.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = '没有找到能够明确对应的字段。可对照下方文字，在资料库手动填写。';
    list.append(empty);
  }
  for (let index = 0; index < items.length; index += 1) {
    const candidate = items[index];
    const label = document.createElement('label');
    label.className = 'candidate';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.index = String(index);
    const body = document.createElement('span');
    body.className = 'candidate-body';
    for (const [className, value] of [['candidate-title', candidate.label], ['candidate-value', candidate.value], ['candidate-evidence', `${candidate.basis}：${candidate.evidence}`]]) {
      const span = document.createElement('span');
      span.className = className;
      span.textContent = value;
      body.append(span);
    }
    label.append(checkbox, body);
    list.append(label);
  }
  $('import-button').disabled = true;
}

$('candidate-list').addEventListener('change', () => {
  $('import-button').disabled = busy || !document.querySelector('#candidate-list input:checked');
});

$('resume-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file || busy) return;
  const token=await owner.replace();selectionToken=token;selectedFile = file;
  $('save-attachment').disabled = file.size > MAX_ATTACHMENT_BYTES;
  if (file.size > MAX_ATTACHMENT_BYTES) $('attachment-state').textContent = '此文件超过本机附件 5 MB 上限，可继续提取文字，但不能保存为后续上传附件。';
  busy = true;
  $('file-name').textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB`;
  $('import-button').disabled = true;
  $('extracted-text').value = '';
  renderCandidates([]);
  renderWarnings([]);
  setStatus('import-status', '');
  setStatus('status', '正在本机提取文字…');
  try {
    const result = await owner.parse(token,file,parseResumeProfile);
    $('extracted-text').value = result.text;
    renderWarnings(result.warnings);
    renderCandidates(result.candidates);
    setStatus('status', `已读取 ${result.format}，提取 ${result.text.length} 个文字，找到 ${result.candidates.length} 项候选。`, 'success');
  } catch (error) {
    if(selectionToken===token)setStatus('status', error?.message || '简历读取失败，请检查文件。', 'error');
  } finally {
    if(selectionToken===token){busy = false;event.target.value = '';}
  }
});

async function refreshAttachmentState() {
  try {
    const token=await owner.ensure(),file = await loadAttachment();await owner.assert(token);
    $('attachment-state').textContent = file ? `本机已存：${file.name}（${(file.size / 1024).toFixed(1)} KB）` : '本机尚未保存简历文件。';
    storedAttachmentToken=file?token:null;
    $('clear-attachment').disabled = !file;
  } catch (error) {
    $('attachment-state').textContent = error?.message || '无法读取本机附件。';
    $('clear-attachment').disabled = true;
  }
}

$('save-attachment').addEventListener('click', async () => {
  if (!selectedFile || busy) return;
  busy = true;
  $('save-attachment').disabled = true;
  try {
    const file=selectedFile,token=selectionToken;
    await owner.run(token,async({binding,assert,ownProfile})=>{
      const profile=await loadProfile();await assert();
      await saveAttachment(file,{profileBinding:binding});await assert();
      profile.resumeAttachment={name:file.name,size:file.size,type:file.type,source:'stored-local'};
      profile.sources['resumeAttachment.name']='manual';profile.confirmedFields=profile.confirmedFields.filter(path=>path!=='resumeAttachment.name');
      await ownProfile(await saveProfile(profile));
      const readBack=await loadAttachment();if(!readBack||readBack.name!==file.name||readBack.size!==file.size)throw Error('attachment_readback_failed');
    });
    await refreshAttachmentState();
  } catch (error) {
    $('attachment-state').textContent = error?.message || '本机附件保存失败。';
  } finally {
    busy = false;
    $('save-attachment').disabled = !selectedFile || selectedFile.size > MAX_ATTACHMENT_BYTES;
  }
});

$('clear-attachment').addEventListener('click', async () => {
  if (busy) return;
  const token=storedAttachmentToken;if(!token)return;
  if (!window.confirm('删除本机保存的简历文件？资料 JSON 备份不包含文件正文，删除后需重新选择文件。')) return;
  busy = true;
  try {
    await owner.run(token,async({assert,ownProfile})=>{
      const profile=await loadProfile();await assert();await clearAttachment();await assert();
      if(profile.resumeAttachment?.source==='stored-local'){
        profile.resumeAttachment=null;profile.confirmedFields=profile.confirmedFields.filter(path=>path!=='resumeAttachment.name');
        delete profile.sources['resumeAttachment.name'];await ownProfile(await saveProfile(profile));
      }
    });
    await refreshAttachmentState();
  } catch (error) {
    $('attachment-state').textContent = error?.message || '删除本机附件失败。';
  } finally {
    busy = false;
  }
});

refreshAttachmentState();

$('import-button').addEventListener('click', async () => {
  if (busy) return;
  const selected = [...document.querySelectorAll('#candidate-list input:checked')]
    .map((input) => candidates[Number(input.dataset.index)]).filter(Boolean);
  if (!selected.length) {
    setStatus('import-status', '先勾选需要导入的候选。', 'error');
    return;
  }
  busy = true;
  $('import-button').disabled = true;
  try {
    const token=selectionToken;
    const merged=await owner.run(token,async({assert,ownProfile})=>{
      const current=await loadProfile();await assert();const result=mergeResumeCandidates(current,selected);
      if(result.added.length){await ownProfile(await saveProfile(result.profile));const readBack=await loadProfile();
        if(!result.added.every(path=>readBack.sources[path]==='resume'&&!readBack.confirmedFields.includes(path)))throw Error('resume_import_readback_failed');}
      return result;
    });
    const pieces = [];
    if (merged.added.length) pieces.push(`已加入 ${merged.added.length} 项待核对资料`);
    if (merged.conflicts.length) pieces.push(`${merged.conflicts.length} 项与现有资料冲突（${merged.conflicts.slice(0, 3).map((item) => item.label).join('、')}），已保留原值`);
    if (!pieces.length) pieces.push('所选内容已在资料库，无需重复导入');
    setStatus('import-status', `${pieces.join('；')}。请返回资料库逐项核对。`, merged.conflicts.length ? 'error' : 'success');
  } catch (error) {
    setStatus('import-status', error?.message || '资料保存失败，请重试。', 'error');
  } finally {
    busy = false;
    $('import-button').disabled = !document.querySelector('#candidate-list input:checked');
  }
});
