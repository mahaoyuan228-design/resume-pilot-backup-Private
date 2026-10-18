// Local-only text extraction. Results are evidence for review, never confirmed facts.
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 200_000;
const MAX_PDF_PAGES = 20;
const MAX_XML_CHARS = 5_000_000;

function extensionOf(name = '') {
  return String(name).split('.').at(-1)?.toLowerCase() || '';
}

function finish(text, warnings = []) {
  const clean = text.replace(/\r\n?/g, '\n').replace(/[\t ]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
  if (clean.length > MAX_TEXT_CHARS) {
    warnings.push(`文字超过 ${MAX_TEXT_CHARS} 字，已截断。请自行核对后半部分。`);
  }
  if (!clean) warnings.push('未提取到可复制文字；扫描件或图片简历需要手动录入。');
  return { text: clean.slice(0, MAX_TEXT_CHARS), warnings };
}

async function extractPdf(bytes) {
  const pdfjs = await import('./vendor/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.mjs', import.meta.url).href;
  const task = pdfjs.getDocument({ data: bytes, useSystemFonts: true, verbosity: 0 });
  const warnings = [];
  try {
    const document = await task.promise;
    const limit = Math.min(document.numPages, MAX_PDF_PAGES);
    if (limit < document.numPages) warnings.push(`PDF 共 ${document.numPages} 页，仅提取前 ${limit} 页。`);
    const pages = [];
    for (let number = 1; number <= limit; number += 1) {
      const page = await document.getPage(number);
      const { items } = await page.getTextContent();
      let text = '';
      for (const item of items) {
        if (typeof item.str !== 'string') continue;
        text += item.str;
        text += item.hasEOL ? '\n' : ' ';
        if (text.length > MAX_TEXT_CHARS) break;
      }
      pages.push(text.trim());
      page.cleanup();
      if (pages.join('\n').length > MAX_TEXT_CHARS) break;
    }
    if (pages.length < limit) warnings.push('PDF 文字过长，已停止读取后续页面。');
    if (pages.some((page) => page.length < 8)) warnings.push('部分页面提取的文字极少，可能有图片内容或复杂排版。');
    return finish(pages.join('\n\n'), warnings);
  } finally {
    await task.destroy();
  }
}

function decodeXmlEntities(value) {
  return value.replace(/&(?:amp|lt|gt|quot|apos|#x[0-9a-fA-F]+|#\d+);/g, (entity) => {
    const fixed = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
    if (Object.hasOwn(fixed, entity)) return fixed[entity];
    const codePoint = entity.startsWith('&#x') ? Number.parseInt(entity.slice(3, -1), 16) : Number.parseInt(entity.slice(2, -1), 10);
    return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint) : '';
  });
}

// DOCX is XML in ZIP. Read only visible text runs, paragraph breaks and table cells.
// No HTML/XML from the document is inserted into the extension DOM.
export function extractDocxXmlText(xml) {
  const source = xml.replace(/<w:del\b[^>]*>[\s\S]*?<\/w:del>/g, '');
  const tokens = source.match(/<w:t\b[^>]*>[\s\S]*?<\/w:t>|<w:(?:tab|br|cr)\b[^>]*\/?\s*>|<\/w:(?:p|tc)>/g) || [];
  let text = '';
  for (const token of tokens) {
    if (/^<w:t(?:\s|>)/.test(token)) text += decodeXmlEntities(token.slice(token.indexOf('>') + 1, token.lastIndexOf('<')));
    else if (token.startsWith('</w:p')) text += '\n';
    else if (token.startsWith('</w:tc')) text += '\t';
    else if (token.startsWith('<w:tab')) text += '\t';
    else text += '\n';
  }
  return text;
}

async function extractDocx(bytes) {
  const module = await import('./vendor/jszip.min.js');
  const JSZip = module.default || globalThis.JSZip;
  if (!JSZip) throw new Error('DOCX 解析组件未能加载。');
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  const main = zip.file('word/document.xml');
  if (!main) throw new Error('DOCX 缺少正文文件 word/document.xml。');
  const names = [main.name, ...Object.keys(zip.files).filter((name) => /^word\/(?:header|footer)\d+\.xml$/.test(name)).sort()];
  const warnings = [];
  const parts = [];
  for (const name of names) {
    const entry = zip.file(name);
    if (entry?._data?.uncompressedSize > MAX_XML_CHARS) {
      warnings.push(`${name} 太大，已跳过；请手动核对。`);
      continue;
    }
    const xml = await entry.async('string');
    if (xml.length > MAX_XML_CHARS) {
      warnings.push(`${name} 太大，已跳过；请手动核对。`);
      continue;
    }
    parts.push(extractDocxXmlText(xml));
  }
  return finish(parts.join('\n\n'), warnings);
}

function extractTxt(bytes) {
  let text;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) text = new TextDecoder('utf-16le').decode(bytes);
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) text = new TextDecoder('utf-16be').decode(bytes);
  else {
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { text = new TextDecoder('gb18030').decode(bytes); }
  }
  return finish(text);
}

export async function extractResumeText(file) {
  if (!file || typeof file.arrayBuffer !== 'function') throw new Error('请先选择本机简历文件。');
  if (file.size > MAX_FILE_BYTES) throw new Error('文件超过 10 MB；请使用较小的 PDF、DOCX 或 TXT 简历。');
  const extension = extensionOf(file.name);
  if (!['pdf', 'docx', 'txt'].includes(extension)) {
    throw new Error(extension === 'doc' ? '旧版 .doc 暂不支持；请在 Word 中另存为 .docx 或 PDF。' : '仅支持 PDF、DOCX 或 TXT 文件。');
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (extension === 'pdf') return { ...(await extractPdf(bytes)), format: 'PDF' };
  if (extension === 'docx') return { ...(await extractDocx(bytes)), format: 'DOCX' };
  return { ...extractTxt(bytes), format: 'TXT' };
}
