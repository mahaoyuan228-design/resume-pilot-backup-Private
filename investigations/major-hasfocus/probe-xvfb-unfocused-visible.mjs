/**
 * Headed Chrome under Xvfb: try hasFocus=false while visibilityState=visible
 * by focusing another window, then run textAdapter-equivalent sequence.
 */
import {spawn} from 'node:child_process';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CdpSession} from '../../tests/e2e/cdp.mjs';
const home=dirname(fileURLToPath(import.meta.url)),pause=ms=>new Promise(r=>setTimeout(r,ms));
const html=`<!doctype html><meta charset=utf-8><title>major-site</title><input id=major value=old10chars><script>
window.obs=[];window.parentV={major:'old10chars'};window.localV={major:'old10chars'};
const i=document.getElementById('major');
for(const t of['focus','focusin','blur','focusout','input','change'])i.addEventListener(t,e=>{obs.push({type:t,trusted:e.isTrusted,hasFocus:document.hasFocus(),visible:document.visibilityState});if(t==='input'||t==='change')localV.major=i.value;if(t==='blur'||t==='focusout')parentV.major=e.target.value;});
</script>`;
const profile=await mkdtemp(join(tmpdir(),'resume-xvfb-hf-'));let proc,port;const sessions=[];
const connect=async t=>{const s=new CdpSession(t.webSocketDebuggerUrl);await s.ready;await s.send('Runtime.enable');await s.send('Page.enable');sessions.push(s);return s;};
const wait=async(c,l,n=120)=>{for(let i=0;i<n;i++){if(await c())return;await pause(50);}throw Error(l);};
const runAdapter=async(session)=>{
  return session.evaluate(`(async()=>{obs.splice(0);parentV.major='old10chars';localV.major='old10chars';
    const i=document.getElementById('major');const v='NEW42________________________________';
    const before={hasFocus:document.hasFocus(),visible:document.visibilityState,activeTag:document.activeElement&&document.activeElement.tagName};
    i.focus({preventScroll:true});
    const af={activeIsInput:document.activeElement===i,hasFocus:document.hasFocus(),visible:document.visibilityState};
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,v);
    i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));
    i.blur();await new Promise(r=>setTimeout(r,40));
    const ab={activeIsInput:document.activeElement===i,hasFocus:document.hasFocus(),visible:document.visibilityState};
    const types=obs.map(o=>o.type);
    return {before,af,ab,events:obs.map(o=>o.type+':t='+o.trusted+';hf='+o.hasFocus+';v='+o.visible),
      focusSeen:types.includes('focus'),blurSeen:types.includes('blur'),focusoutSeen:types.includes('focusout'),
      parent:parentV.major,local:localV.major,dom:i.value,
      adapterWouldPassDom:i.value===v&&af.activeIsInput&&!ab.activeIsInput,
      parentCommitted:parentV.major===v,
      fillLegalVisible:before.visible==='visible',
      targetCondition:before.hasFocus===false&&before.visible==='visible'};})()`);
};
try{
  proc=spawn('google-chrome',[
    '--disable-gpu','--no-first-run','--no-default-browser-check',
    '--disable-background-networking','--remote-debugging-port=0',
    '--user-data-dir='+profile,'--window-size=900,700','about:blank'
  ],{stdio:'ignore',env:{...process.env,DISPLAY:process.env.DISPLAY}});
  await wait(async()=>{try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split(/\r?\n/)[0]);return!!port;}catch{return false;}},'port');
  const ver=await fetch('http://127.0.0.1:'+port+'/json/version').then(r=>r.json());
  const browser=new CdpSession(ver.webSocketDebuggerUrl);await browser.ready;sessions.push(browser);
  const data='data:text/html;charset=utf-8,'+encodeURIComponent(html);
  const {targetId:siteId}=await browser.send('Target.createTarget',{url:data,newWindow:true});
  await wait(async()=>(await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json())).some(t=>t.url?.includes('major-site')),'site');
  const siteInfo=(await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json())).find(t=>t.url?.includes('major-site'));
  const site=await connect(siteInfo);
  await wait(()=>site.evaluate('document.readyState==="complete"'),'load');
  await site.send('Page.bringToFront');await pause(150);
  const A=await runAdapter(site);

  const {targetId:thiefId}=await browser.send('Target.createTarget',{url:'data:text/html,<title>thief</title>thief',newWindow:true});
  await wait(async()=>(await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json())).some(t=>t.title==='thief'),'thief');
  const thiefInfo=(await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json())).find(t=>t.title==='thief');
  const thief=await connect(thiefInfo);
  const siteWin=await browser.send('Browser.getWindowForTarget',{targetId:siteId});
  const thiefWin=await browser.send('Browser.getWindowForTarget',{targetId:thiefId});
  // Position windows apart; activate thief
  await browser.send('Browser.setWindowBounds',{windowId:siteWin.windowId,bounds:{left:20,top:20,width:500,height:400,windowState:'normal'}});
  await browser.send('Browser.setWindowBounds',{windowId:thiefWin.windowId,bounds:{left:540,top:20,width:500,height:400,windowState:'normal'}});
  await browser.send('Target.activateTarget',{targetId:thiefId});
  await thief.send('Page.bringToFront');
  await pause(300);
  const mid=await site.evaluate('({hasFocus:document.hasFocus(),visible:document.visibilityState})');
  const B=await runAdapter(site);

  // Also try clicking into thief via Input.dispatchMouseEvent on thief to ensure OS focus
  await thief.send('Input.dispatchMouseEvent',{type:'mousePressed',x:10,y:10,button:'left',clickCount:1});
  await thief.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:10,y:10,button:'left',clickCount:1});
  await pause(200);
  const mid2=await site.evaluate('({hasFocus:document.hasFocus(),visible:document.visibilityState})');
  const C=await runAdapter(site);

  const report={status:'PROBE_COMPLETED',chrome:ver.Browser,display:process.env.DISPLAY,windows:{siteWin,thiefWin},
    notes:[{step:'after-thief-activate',mid},{step:'after-thief-click',mid2}],
    cases:{A_baseline:A,B_thief_activated:B,C_thief_clicked:C},
    achievedTarget: [A,B,C].some(c=>c.targetCondition),
    silentUnderTarget: [A,B,C].filter(c=>c.targetCondition&&c.adapterWouldPassDom&&!c.blurSeen)};
  await writeFile(join(home,'result-xvfb-unfocused-visible.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}catch(e){
  const report={status:'PROBE_FAILED',error:String(e&&e.stack||e)};
  await writeFile(join(home,'result-xvfb-unfocused-visible.json'),JSON.stringify(report,null,2)+'\n');
  console.error(report.error);process.exitCode=1;
}finally{for(const s of sessions)try{s.close();}catch{}proc?.kill('SIGKILL');await pause(150);try{await rm(profile,{recursive:true,force:true});}catch{}}
