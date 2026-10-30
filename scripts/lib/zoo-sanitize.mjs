import { JSDOM } from 'jsdom';

export const REPLAY_CSP = "default-src 'none'; script-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'; object-src 'none'";

/** Exact live identifiers are ephemeral inputs. Never write or report them. */
export function scrubText(value, privateStrings = []) {
  let result = String(value);
  for (const token of [...new Set(privateStrings)].filter(v => typeof v === 'string' && v.length > 1).sort((a,b) => b.length-a.length)) {
    for (const variant of new Set([token, encodeURIComponent(token), JSON.stringify(token).slice(1,-1),
      [...token].map(c => `\\u${c.charCodeAt(0).toString(16).padStart(4,'0')}`).join('')])) {
      result = result.split(variant).join('[REDACTED]');
    }
  }
  return result
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, '[REDACTED_EMAIL]')
    .replace(/(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/gu, '[REDACTED_PHONE]')
    .replace(/(?<![\dA-Za-z])\d{17}[\dXx](?![\dA-Za-z])/gu, '[REDACTED_ID]')
    .replace(/([?&](?:resumeId|candidateId|applicantId|email|mobile|phone|token|sessionid)=)[^&#"'\s]*/giu, '$1REDACTED');
}

export function safeSourceUrl(raw, base) {
  const url = new URL(raw, base);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('asset_url_rejected');
  for (const key of [...url.searchParams.keys()]) {
    if (/resume|candidate|applicant|email|phone|mobile|token|session|auth|signature|credential/iu.test(key)) url.searchParams.delete(key);
  }
  url.hash = '';
  return url.href;
}

/** Parse a copy in Node without script/resource execution. Never mutate the live document. */
export function sanitizeHtml(html, { sourceUrl, privateStrings = [], assets = [] }) {
  const dom = new JSDOM(html); // no runScripts and no resources loader
  const doc = dom.window.document;
  const comments = doc.createTreeWalker(doc, 128), remove = [];
  while (comments.nextNode()) remove.push(comments.currentNode);
  for (const node of remove) node.remove();
  for (const node of doc.querySelectorAll('base,iframe,object,embed,meta[http-equiv],link:not([rel="stylesheet"])')) node.remove();
  for (const node of doc.querySelectorAll('script')) {
    const src = node.getAttribute('src');
    node.removeAttribute('src'); node.removeAttribute('integrity'); node.removeAttribute('crossorigin');
    node.setAttribute('type','application/x-zoo-inert'); node.textContent = '';
    if (src) {
      const absolute = new URL(src, sourceUrl).href;
      const asset = assets.find(a => a.originalUrl === absolute);
      if (asset?.path) node.setAttribute('data-zoo-asset', asset.path);
    }
  }
  for (const node of doc.querySelectorAll('*')) {
    for (const attr of [...node.attributes]) {
      if (/^on/iu.test(attr.name) || /resume|candidate|applicant|token|session|auth/iu.test(attr.name)
        || ['nonce','integrity','crossorigin','srcset','srcdoc','ping'].includes(attr.name)) node.removeAttribute(attr.name);
    }
  }
  for (const node of doc.querySelectorAll('input')) {
    node.removeAttribute('checked');
    node.setAttribute('value','');
  }
  for (const node of doc.querySelectorAll('textarea,[contenteditable=true]')) node.textContent = '';
  for (const node of doc.querySelectorAll('option')) node.removeAttribute('selected');
  for (const node of doc.querySelectorAll('[aria-checked],[aria-selected]')) {
    if(node.hasAttribute('aria-checked')) node.setAttribute('aria-checked','false');
    if(node.hasAttribute('aria-selected')) node.setAttribute('aria-selected','false');
  }
  const selectionClasses = ['ant-radio-checked','ant-checkbox-checked','ant-radio-wrapper-checked','ant-checkbox-wrapper-checked',
    'ant-select-dropdown-menu-item-selected','ant-select-tree-checkbox-checked','ant-select-tree-node-selected',
    'ant-cascader-menu-item-active','ant-calendar-selected-day','ant-calendar-selected-date','ant-switch-checked'];
  for (const name of selectionClasses) for (const node of doc.querySelectorAll('.'+name)) node.classList.remove(name);
  for (const node of doc.querySelectorAll('.ant-select-selection-selected-value,.ant-select-selection__choice__content,.ant-cascader-picker-label,.ant-upload-list-item-name')) {
    node.textContent = ''; node.removeAttribute('title');
  }
  for (const node of doc.querySelectorAll('.ant-select-selection__choice')) node.remove();
  for (const node of doc.querySelectorAll('.ant-form-item-control [title]')) node.removeAttribute('title');
  for (const node of doc.querySelectorAll('form')) { node.removeAttribute('action'); node.removeAttribute('method'); }
  for (const node of doc.querySelectorAll('a[href]')) node.setAttribute('href','#');
  for (const node of doc.querySelectorAll('button,input[type=submit],input[type=reset]')) node.setAttribute('type','button');
  // Candidate photos, file URLs, inline SVG images and tracking pixels are not archived.
  for (const node of doc.querySelectorAll('img,video,audio,source,image')) {
    for (const key of ['src','href','xlink:href','poster']) node.removeAttribute(key);
  }
  for (const node of doc.querySelectorAll('link[rel="stylesheet"]')) {
    const href=node.getAttribute('href');
    const url = new URL(href,sourceUrl).href;
    const asset = assets.find(a => a.originalUrl === url || a.path === href);
    if (!asset?.path) throw new Error('stylesheet_missing');
    node.setAttribute('href',asset.path);
  }
  for (const node of doc.querySelectorAll('[style]')) {
    node.setAttribute('style',node.getAttribute('style').replace(/url\([^)]*\)/giu,'none'));
  }
  // Redact decoded text/attributes too, so '&amp;' and other entity encodings
  // cannot hide a known candidate name from an exact match after serialization.
  const texts = doc.createTreeWalker(doc, 4);
  while (texts.nextNode()) texts.currentNode.nodeValue = scrubText(texts.currentNode.nodeValue,privateStrings);
  for (const node of doc.querySelectorAll('*')) {
    for (const attr of [...node.attributes]) node.setAttribute(attr.name,scrubText(attr.value,privateStrings));
  }
  const csp = doc.createElement('meta'); csp.setAttribute('http-equiv','Content-Security-Policy'); csp.setAttribute('content',REPLAY_CSP);
  doc.head.prepend(csp);
  doc.documentElement.setAttribute('data-zoo-snapshot','cms-hotjob-pb');
  // HTML parsing moves whitespace after </html> into body. Keep local
  // sanitation idempotent without touching the captured content itself.
  while (doc.body.lastChild?.nodeType === 3 && /^\s*$/u.test(doc.body.lastChild.nodeValue)) doc.body.lastChild.remove();
  const result = scrubText(`<!DOCTYPE html>\n${doc.documentElement.outerHTML}\n`,privateStrings);
  dom.window.close();
  return result;
}
