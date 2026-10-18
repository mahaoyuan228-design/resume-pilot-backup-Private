/**
 * Offline Chromium probe for major blur-commit under document.hasFocus()===false.
 * Goal: achieve hasFocus=false WHILE visibilityState==='visible' (the fill-legal
 * state: requirePage only checks visible), then see if input.focus()/blur() fire
 * events or only mutate activeElement — matching textAdapter's checks.
 */
import {spawn} from 'node:child_process';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {CdpSession} from '../../tests/e2e/cdp.mjs';

const home = dirname(fileURLToPath(import.meta.url));
const chrome = process.env.CHROME_PATH || 'google-chrome';
const pause = ms => new Promise(r => setTimeout(r, ms));
const fixtureHtml = `<!doctype html><meta charset=utf-8>
<title>major-site</title>
<input id=major type=text value="old10chars">
<script>
window.observations=[];
window.parentValues={major:'old10chars'};
window.localValues={major:'old10chars'};
const input=document.getElementById('major');
for (const type of ['focus','focusin','blur','focusout','input','change']) {
  input.addEventListener(type, e => {
    observations.push({
      type, trusted:e.isTrusted,
      hasFocus:document.hasFocus(),
      visible:document.visibilityState,
      activeTag:document.activeElement&&document.activeElement.tagName
    });
    if (type==='input'||type==='change') localValues.major=input.value;
    if (type==='focusout'||type==='blur') parentValues.major=e.target.value;
  });
}
</script>`;

const profile = await mkdtemp(join(tmpdir(), 'resume-major-hasfocus-'));
let proc, port;
const sessions = [];
const report = {status:'RUNNING', cases:[], notes:[], chromeVersion:null};

async function connect(t) {
  const s = new CdpSession(t.webSocketDebuggerUrl);
  await s.ready;
  await s.send('Runtime.enable');
  await s.send('Page.enable');
  sessions.push(s);
  return s;
}
async function wait(check, label, n=100) {
  for (let i=0;i<n;i++) { if (await check()) return; await pause(50); }
  throw new Error(label);
}
async function list() {
  return fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json());
}

async function resetModel(session) {
  await session.evaluate(`(()=>{
    const input=document.getElementById('major');
    observations.splice(0);
    parentValues.major='old10chars';
    localValues.major='old10chars';
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(input,'old10chars');
    if(document.activeElement===input) input.blur();
  })()`);
}

async function adapterSequence(session, name) {
  await resetModel(session);
  const result = await session.evaluate(`(async()=>{
    const input=document.getElementById('major');
    const value='new-confirmed-major-value-forty-two-chars!!';
    const before={hasFocus:document.hasFocus(),visible:document.visibilityState,activeTag:document.activeElement&&document.activeElement.tagName};
    input.focus({preventScroll:true});
    const afterFocus={hasFocus:document.hasFocus(),visible:document.visibilityState,activeTag:document.activeElement&&document.activeElement.tagName,activeIsInput:document.activeElement===input};
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(input,value);
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
    input.blur();
    await new Promise(r=>setTimeout(r,40));
    const afterBlur={hasFocus:document.hasFocus(),visible:document.visibilityState,activeTag:document.activeElement&&document.activeElement.tagName,activeIsInput:document.activeElement===input};
    const types=observations.map(o=>o.type);
    const nativeFB=['focus','blur','focusout'].map(t=>{
      const hit=observations.find(o=>o.type===t);
      return {type:t,seen:!!hit,trusted:hit?hit.trusted:null};
    });
    return {
      before, afterFocus, afterBlur, events:observations.slice(), nativeFocusBlurFocusout:nativeFB,
      parent:parentValues.major, local:localValues.major, dom:input.value, desired:value,
      adapterWouldPassDom:input.isConnected&&input.value===value&&afterFocus.activeIsInput&&!afterBlur.activeIsInput,
      parentCommitted:parentValues.major===value,
      fillLegal:before.visible==='visible' // requirePage gate
    };
  })()`);
  const row = {name, ...result};
  report.cases.push(row);
  return row;
}

try {
  proc = spawn(chrome, [
    '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
    '--disable-background-networking','--remote-debugging-port=0',
    '--user-data-dir='+profile,'about:blank'
  ], {stdio:['ignore','ignore','pipe']});
  await wait(async () => {
    try {
      port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split(/\r?\n/)[0]);
      return !!port;
    } catch { return false; }
  }, 'chrome_port_missing');

  const version = await fetch('http://127.0.0.1:'+port+'/json/version').then(r=>r.json());
  report.chromeVersion = version.Browser || version['Browser'];
  const browser = new CdpSession(version.webSocketDebuggerUrl);
  await browser.ready;
  sessions.push(browser);

  // Create site page as its own window
  const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(fixtureHtml);
  const {targetId: siteTargetId} = await browser.send('Target.createTarget', {url: dataUrl, newWindow: true});
  await wait(async () => (await list()).some(t => t.id === siteTargetId || t.url?.includes('major-site')), 'site_target');
  let siteInfo = (await list()).find(t => t.url?.includes('major-site') || t.id === siteTargetId);
  // /json/list uses id; createTarget returns targetId — match by url
  siteInfo = (await list()).find(t => t.url?.includes('major-site')) || siteInfo;
  const site = await connect(siteInfo);
  await wait(() => site.evaluate('document.readyState==="complete"'), 'site_loading');
  await site.send('Page.bringToFront');
  await pause(100);

  await adapterSequence(site, 'A-baseline-focused');

  // Create thief window and activate it; site window should stay "visible" if separate window
  const {targetId: thiefId} = await browser.send('Target.createTarget', {url: 'data:text/html,<title>thief</title>thief', newWindow: true});
  await wait(async () => (await list()).some(t => t.url?.includes('thief') || t.title==='thief'), 'thief_target');
  const thiefInfo = (await list()).find(t => t.title==='thief' || t.url?.includes('thief'));
  const thief = await connect(thiefInfo);
  await thief.send('Page.bringToFront');
  await browser.send('Target.activateTarget', {targetId: thiefId});
  await pause(200);

  const mid = await site.evaluate('({hasFocus:document.hasFocus(),visible:document.visibilityState})');
  report.notes.push({step:'thief-window-activated', ...mid, thiefId, siteTargetId});
  await adapterSequence(site, 'B-other-window-activated');

  // Also try: site bringToFront then immediately activate thief WITHOUT Page.bringToFront on thief
  await site.send('Page.bringToFront');
  await pause(80);
  await browser.send('Target.activateTarget', {targetId: thiefId});
  await pause(150);
  const mid2 = await site.evaluate('({hasFocus:document.hasFocus(),visible:document.visibilityState})');
  report.notes.push({step:'site-front-then-activate-thief-only', ...mid2});
  await adapterSequence(site, 'C-activate-thief-after-site-front');

  // Try Browser.getWindowForTarget + set focused via bounds trick: focus thief window
  try {
    const siteWin = await browser.send('Browser.getWindowForTarget', {targetId: siteTargetId});
    const thiefWin = await browser.send('Browser.getWindowForTarget', {targetId: thiefId});
    report.notes.push({step:'windows', siteWin, thiefWin});
    // Bring site to front then set thief window focused by activating + bringToFront thief
    await browser.send('Target.activateTarget', {targetId: siteTargetId});
    await site.send('Page.bringToFront');
    await pause(80);
    // Minimize site? That would hide. Instead leave site normal and focus thief.
    await browser.send('Browser.setWindowBounds', {windowId: thiefWin.windowId, bounds: {windowState: 'normal'}});
    await browser.send('Target.activateTarget', {targetId: thiefId});
    await thief.send('Page.bringToFront');
    await pause(200);
    const mid3 = await site.evaluate('({hasFocus:document.hasFocus(),visible:document.visibilityState})');
    report.notes.push({step:'setWindowBounds-thief-focus', ...mid3});
    await adapterSequence(site, 'D-window-bounds-thief-focus');
  } catch (e) {
    report.notes.push({step:'window-bounds', error: String(e.message||e)});
  }

  // Summaries
  const interesting = report.cases.filter(c =>
    c.before?.hasFocus === false || c.nativeFocusBlurFocusout?.some(x => !x.seen)
  );
  report.achievedHasFocusFalseWhileVisible = report.cases.some(c =>
    c.before?.hasFocus === false && c.before?.visible === 'visible'
  );
  report.silentActiveElementCases = report.cases.filter(c =>
    c.adapterWouldPassDom && c.nativeFocusBlurFocusout?.some(x => x.type === 'blur' && !x.seen)
  ).map(c => ({
    name: c.name,
    before: c.before,
    afterFocus: c.afterFocus,
    afterBlur: c.afterBlur,
    nativeFocusBlurFocusout: c.nativeFocusBlurFocusout,
    parentCommitted: c.parentCommitted,
    parent: c.parent,
    local: c.local,
    fillLegal: c.fillLegal
  }));
  report.status = 'PROBE_COMPLETED';
  report.interpretation = report.achievedHasFocusFalseWhileVisible
    ? 'Achieved hasFocus=false with visible=visible; see cases for whether blur events fired and parent committed.'
    : 'Did not achieve hasFocus=false while visible=visible on headless Chrome. Silent activeElement-without-events observed only when also hidden (if any). Real Edge: focus another OS window while CMS tab stays selected and visible.';
  report.probeSha256 = createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex');

  await writeFile(join(home, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({
    status: report.status,
    achievedHasFocusFalseWhileVisible: report.achievedHasFocusFalseWhileVisible,
    silentActiveElementCases: report.silentActiveElementCases,
    caseSummary: report.cases.map(c => ({
      name: c.name,
      before: c.before,
      blurSeen: c.nativeFocusBlurFocusout?.find(x => x.type==='blur'),
      adapterWouldPassDom: c.adapterWouldPassDom,
      parentCommitted: c.parentCommitted,
      fillLegal: c.fillLegal
    })),
    notes: report.notes
  }, null, 2));
} catch (e) {
  report.status = 'PROBE_FAILED';
  report.error = String(e && e.stack || e);
  await writeFile(join(home, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  console.error(report.error);
  process.exitCode = 1;
} finally {
  for (const s of sessions) try { s.close(); } catch {}
  proc?.kill('SIGKILL');
  await pause(200);
  try { await rm(profile, {recursive: true, force: true}); } catch {}
}
