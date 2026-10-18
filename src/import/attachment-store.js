// File bodies live only in the extension origin's IndexedDB, never in JSON backups.
// The caller must obtain a File from an explicit user selection before saving.
import {captureProfileBinding,assertProfileBinding} from '../profile/profile-lifecycle.js';
const DATABASE_NAME = 'resume-autofill-attachments';
const STORE_NAME = 'files';
const RESUME_KEY = 'resume';
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

function validateFile(file) {
  if (!file || typeof file.name !== 'string' || typeof file.size !== 'number' || typeof file.slice !== 'function') {
    throw new Error('请先手动选择本机简历文件。');
  }
  if (!file.size) throw new Error('不能保存空文件。');
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error('附件超过 5 MB；请选择较小的简历文件。');
  if (!/\.(?:pdf|docx?|txt)$/i.test(file.name)) throw new Error('简历附件仅支持 PDF、DOC、DOCX 或 TXT。');
}

function openDatabase() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('当前环境没有 IndexedDB，无法保存简历文件。'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('无法打开本机附件存储。'));
    request.onblocked = () => reject(new Error('附件存储正在被其他页面占用，请关闭其他简历快填页面后重试。'));
  });
}

async function inStore(mode, action) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      let value;
      let settled = false;
      transaction.oncomplete = () => { settled = true; resolve(value); };
      transaction.onerror = () => { settled = true; reject(transaction.error || new Error('本机附件操作失败。')); };
      transaction.onabort = () => { settled = true; reject(transaction.error || new Error('本机附件操作已中止。')); };
      try {
        const request = action(transaction.objectStore(STORE_NAME));
        if (request) request.onsuccess = () => { value = request.result; };
      } catch (error) {
        if (!settled) {
          try { transaction.abort(); } catch { /* already finished */ }
          reject(error);
        }
      }
    });
  } finally {
    database.close();
  }
}

export async function saveAttachment(file, {profileBinding=null}={}) {
  validateFile(file);
  const binding=profileBinding||await captureProfileBinding(chrome.storage.local);
  await assertProfileBinding(chrome.storage.local,binding);
  const metadata = {
    id: RESUME_KEY,
    name: file.name,
    size: file.size,
    type: file.type || '',
    lastModified: Number.isFinite(file.lastModified) ? file.lastModified : Date.now(),
    savedAt: new Date().toISOString(),
    ownerBinding:binding,
    blob: file.slice(0, file.size, file.type || undefined)
  };
  await inStore('readwrite', (store) => store.put(metadata));
  await assertProfileBinding(chrome.storage.local,binding);
  return { name: metadata.name, size: metadata.size, type: metadata.type, savedAt: metadata.savedAt };
}

export async function loadAttachment() {
  const binding=await captureProfileBinding(chrome.storage.local);
  const record = await inStore('readonly', (store) => store.get(RESUME_KEY));
  await assertProfileBinding(chrome.storage.local,binding);
  if (!record) return null;
  // Legacy or another owner's bytes are never silently assigned to this client.
  if(record.ownerBinding?.version!==binding.version||record.ownerBinding?.epoch!==binding.epoch||record.ownerBinding?.profileHash!==binding.profileHash)return null;
  if (!(record.blob instanceof Blob) || typeof record.name !== 'string' || record.blob.size !== record.size) {
    throw new Error('本机简历文件已损坏，请重新选择并保存。');
  }
  return new File([record.blob], record.name, { type: record.type || '', lastModified: record.lastModified || Date.now() });
}

export async function rebindAttachmentOwner(before,after){
  if(before.epoch!==after.epoch)return;
  await assertProfileBinding(chrome.storage.local,after);
  const record=await inStore('readonly',store=>store.get(RESUME_KEY));
  const same=value=>value?.version===before.version&&value.epoch===before.epoch&&value.profileHash===before.profileHash;
  if(!record||!same(record.ownerBinding))return;
  await assertProfileBinding(chrome.storage.local,after);
  await inStore('readwrite',store=>store.put({...record,ownerBinding:after}));
  await assertProfileBinding(chrome.storage.local,after);
}

export async function clearAttachment() {
  await inStore('readwrite', (store) => store.delete(RESUME_KEY));
}
