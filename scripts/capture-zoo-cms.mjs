#!/usr/bin/env node
/** Explicit read-only capture. No navigation, activation, input, page fetch, or control opens. */
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { connectCdp, getJson } from '../tools/live-harvest/cdp-client.mjs';
import { createRowDNetworkGuard, selectRowDTarget } from './live/cms-row-d-live.mjs';
import { ROW_D_PAGE } from './lib/cms-row-d-options.mjs';
import { readCmsSnapshot } from './lib/zoo-cms-read.mjs';
import { scrubText, sanitizeHtml, safeSourceUrl } from './lib/zoo-sanitize.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'tests/zoo/real/cms-hotjob-pb');
const hash = value => createHash('sha256').update(value).digest('hex');

export function getStaticAsset(raw, redirects = 0) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || redirects > 5
    || !/\.(?:css|js|woff2?|ttf|eot|svg|png|jpe?g|gif|webp|ico)$/iu.test(url.pathname)) {
    return Promise.reject(new Error('static_get_only'));
  }
  return new Promise((resolve, reject) => {
    // No browser cookies, authorization, storage or referrer are copied.
    const req = https.get(url, { timeout: 15000, headers: { 'User-Agent': 'ResumePilot-ReadOnly-Snapshot/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume(); getStaticAsset(new URL(res.headers.location,url).href,redirects+1).then(resolve,reject); return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`http_${res.statusCode}`)); return; }
      const chunks = []; let length = 0;
      res.on('data', chunk => { length += chunk.length; if (length > 15 * 1024 * 1024) res.destroy(new Error('asset_limit')); else chunks.push(chunk); });
      res.on('error',reject);
      res.on('end',() => resolve({ body: Buffer.concat(chunks), mimeType: String(res.headers['content-type'] || '').split(';')[0], status:res.statusCode }));
    });
    req.on('timeout',() => req.destroy(new Error('get_timeout'))); req.on('error',reject);
  });
}

export async function archiveAssets(sources, privateStrings, checkGuard, get = getStaticAsset) {
  const byUrl = new Map();
  const archive = async (raw, base, required = false) => {
    if (/^(?:data:|#)/iu.test(raw)) return null;
    const url = new URL(raw,base); url.hash = '';
    const originalUrl = url.href;
    if (byUrl.has(originalUrl)) return byUrl.get(originalUrl);
    if (byUrl.size >= 150) throw new Error('asset_count_limit');
    const safeUrl = safeSourceUrl(originalUrl,base);
    // Refuse an asset whose URL needs credentials/identifier stripping.
    if (safeUrl !== originalUrl) throw new Error('private_asset_url');
    const extension = path.posix.extname(url.pathname).toLowerCase();
    const baseName = path.posix.basename(url.pathname).replace(/[^a-z\d._-]/giu,'_');
    const entry = { originalUrl, url: scrubText(safeUrl,privateStrings), method:'GET', required,
      path:`assets/${hash(safeUrl).slice(0,12)}-${baseName}`, mimeType:'', status:0 };
    byUrl.set(originalUrl,entry);
    checkGuard();
    try {
      const reply = await get(originalUrl); checkGuard();
      entry.status = reply.status; entry.mimeType = reply.mimeType;
      if (['.css','.js','.svg'].includes(extension)) {
        let content = scrubText(reply.body.toString('utf8'),privateStrings);
        if (extension === '.css') {
          const refs = [];
          for (const match of content.matchAll(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/giu)) refs.push({ whole:match[0],url:match[2] });
          for (const match of content.matchAll(/@import\s+(['"])([^'"]+)\1/giu)) refs.push({ whole:match[0],url:match[2],import:true });
          for (const ref of refs) {
            if (/^(?:data:|#)/iu.test(ref.url)) continue;
            const dependency = await archive(ref.url,originalUrl);
            const local = dependency?.body ? path.posix.basename(dependency.path) : null;
            content = content.split(ref.whole).join(local ? (ref.import ? `@import "${local}"` : `url("${local}")`) : (ref.import ? '/* unavailable import */' : 'none'));
          }
        }
        entry.body = Buffer.from(content,'utf8');
      } else entry.body = reply.body;
      entry.bytes = entry.body.length; entry.sha256 = hash(entry.body);
    } catch (error) {
      if (error.message === 'guard_failure') throw error;
      // No raw exception/URL/header/body is copied into evidence.
      entry.error = /^http_\d{3}$/u.test(error.message) ? error.message : 'get_unavailable';
      delete entry.path;
      if (required) throw new Error('required_asset_unavailable');
    }
    return entry;
  };
  for (const source of sources) await archive(source.url,ROW_D_PAGE,true);
  return [...byUrl.values()];
}

export async function captureCms() {
  const startedAt = new Date().toISOString();
  const before = await getJson(9239,'/json/list',{timeoutMs:5000});
  const choice = selectRowDTarget(before,9239);
  if (!choice.ok) throw new Error(choice.reason);
  let session, snapshot, contextId;
  const contexts = new Map();
  const guard = createRowDNetworkGuard((method,params) => session.send(method,params));
  // A GET continuation can briefly be pending while a host-side GET completes.
  // The final drain below awaits those decisions; pending GETs are not writes.
  const checkGuard = () => { if (guard.failed()) throw new Error('guard_failure'); };
  let assets, finishedAt;
  try {
    session = await connectCdp(choice.target.webSocketDebuggerUrl,{timeoutMs:30000,onEvent(event) {
      guard.onEvent(event);
      if (event.method === 'Runtime.executionContextCreated') contexts.set(event.params.context.id,event.params.context);
      else if (event.method === 'Runtime.executionContextDestroyed') contexts.delete(event.params.executionContextId);
      else if (event.method === 'Runtime.executionContextsCleared') contexts.clear();
    }});
    await session.send('Network.enable');
    await session.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
    await guard.drain(); checkGuard();
    await session.send('Runtime.enable');
    const frame = (await session.send('Page.getFrameTree')).frameTree.frame;
    if (frame.url.split(/[?#]/u)[0] !== ROW_D_PAGE) throw new Error('wrong_frame');
    const mains = [...contexts.values()].filter(c => c.auxData?.isDefault === true && c.auxData.frameId === frame.id);
    if (mains.length !== 1) throw new Error('main_world_ambiguous');
    contextId = mains[0].id;
    const reply = await session.send('Runtime.evaluate',{ expression:`(${readCmsSnapshot.toString()})()`,
      contextId,returnByValue:true,awaitPromise:false,userGesture:false,throwOnSideEffect:true,timeout:25000 });
    if (reply.exceptionDetails || !reply.result?.value?.schema?.mainWorld) throw new Error('strict_read_rejected');
    snapshot = reply.result.value;
    if (!snapshot.controls.length || !snapshot.sections.length || !snapshot.privateStrings.length) throw new Error('capture_incomplete');
    checkGuard();
    assets = await archiveAssets(snapshot.assets,snapshot.privateStrings,checkGuard);
    if (!contexts.has(contextId)) throw new Error('main_world_invalidated');
    await delay(500); await guard.drain(); checkGuard();
    const after = await getJson(9239,'/json/list',{timeoutMs:5000});
    if (JSON.stringify(before.map(t=>t.id).sort()) !== JSON.stringify(after.map(t=>t.id).sort())
      || !after.some(t=>t.id === choice.target.id && t.url === choice.target.url)) throw new Error('targets_changed');
    finishedAt = new Date().toISOString();
  } catch(error) {
    error.traffic = { ...guard.traffic, assessment:guard.assessment() };
    throw error;
  } finally {
    if (session) { await guard.drain(); session.close(); }
    // Deliberately never call Fetch.disable or change any pre-existing keeper/hooks.
  }
  checkGuard();
  const safeAssets = assets.map(({body,originalUrl,...entry})=>entry);
  const html = sanitizeHtml(snapshot.html,{sourceUrl:ROW_D_PAGE,privateStrings:snapshot.privateStrings,assets});
  const sanitize = object => `${scrubText(JSON.stringify(object,null,2),snapshot.privateStrings)}\n`;
  const manifest = {
    version:1,site:'cms-hotjob-pb',sourceUrl:ROW_D_PAGE,capturedAt:startedAt,captureFinishedAt:finishedAt,
    baseTip:'f07879e1caa24e6f7f09bf6c59e30b7098d89b6b',
    safety:{neverSave:true,liveSupportClaimed:false,livePassClaimed:false,readOnly:true,clicks:0,typing:0,controlOpens:0,
      navigation:0,login:0,submit:0,save:0,existingGuardPreserved:true,throwOnSideEffect:true},
    mainWorld:{status:'pinned',contextId},traffic:{...guard.traffic,assessment:guard.assessment()},
    assets:{requested:assets.length,saved:assets.filter(a=>a.body).length,missing:assets.filter(a=>!a.body).length,requestMethod:'GET',cookiesSent:false,authorizationSent:false},
    schema:snapshot.schema,
    counts:{sections:snapshot.sections.length,infoItems:snapshot.sections.reduce((n,s)=>n+s.infoItemList.length,0),controls:snapshot.controls.length,dictionaries:snapshot.dictionaries.length},
    replay:{entry:'index.html',outerHTML:'outerHTML.html',scripts:'archived_inert',hydration:false,selectedValues:'removed',
      calendarPanelEvidence:false,claim:'structure_and_metadata_only'},
    privacy:{rawCapturePersisted:false,personalValuesRemoved:true,namePhoneEmailIdentityAndResumeIdentifiersRemoved:true,
      inputValuesCleared:true,selectedLabelsCleared:true,photosAndAttachmentsRemoved:true,cookiesOrStorageCaptured:false}
  };
  // All serialization/sanitization and guard checks complete before the first disk write.
  const outputs = new Map([
    ['index.html',html],['outerHTML.html',html],['manifest.json',sanitize(manifest)],
    ['controls.json',sanitize({source:'MAIN-world committed React metadata and rendered choice labels',controls:snapshot.controls})],
    ['infoItemList.json',sanitize({source:'MAIN-world committed React resumeTpl[].infoItemList; metadata allowlist only',requiredRule:'isNeed === 0 (required: !isNeed in production bundle)',sections:snapshot.sections})],
    ['dictionaries.json',sanitize({source:'MAIN-world current component props.dataSource; referenced template dictionaries only',dictionaries:snapshot.dictionaries})],
    ['assets.json',sanitize({assets:safeAssets})]
  ]);
  fs.mkdirSync(path.join(out,'assets'),{recursive:true});
  for (const asset of assets) if(asset.body) fs.writeFileSync(path.join(out,asset.path),asset.body);
  for (const [name,content] of outputs) fs.writeFileSync(path.join(out,name),content,'utf8');
  return {site:manifest.site,capturedAt:startedAt,counts:manifest.counts,assets:manifest.assets,traffic:manifest.traffic,schema:manifest.schema};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3 || process.argv[2] !== '--capture-readonly') {
    console.error('Explicit invocation: node scripts/capture-zoo-cms.mjs --capture-readonly'); process.exitCode=2;
  } else {
    try { console.log(JSON.stringify(await captureCms(),null,2)); }
    catch(error) { console.error(JSON.stringify({ok:false,reason:/^[a-z_]+$/u.test(error.message)?error.message:'capture_failed',...(error.traffic?{traffic:error.traffic}:{})})); process.exitCode=2; }
  }
}
