/** Prove: when tab is backgrounded (hasFocus=false, often visible=hidden), focus()/blur() mutate activeElement without focus/blur/focusout events. Parent blur-commit then fails. */
import {spawn} from 'node:child_process';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CdpSession} from '../../tests/e2e/cdp.mjs';
const home=dirname(fileURLToPath(import.meta.url)),pause=ms=>new Promise(r=>setTimeout(r,ms));
const html=`<!doctype html><meta charset=utf-8><title>site</title><input id=major value=old10chars><script>
window.obs=[];window.parentV={major:'old10chars'};window.localV={major:'old10chars'};
const i=document.getElementById('major');
for(const t of['focus','focusin','blur','focusout','input','change'])i.addEventListener(t,e=>{obs.push({type:t,trusted:e.isTrusted,hasFocus:document.hasFocus(),visible:document.visibilityState});if(t==='input'||t==='change')localV.major=i.value;if(t==='blur'||t==='focusout')parentV.major=e.target.value;});
</script>`;
const profile=await mkdtemp(join(tmpdir(),'resume-silent-ae-'));let proc,port;const sessions=[];
const connect=async t=>{const s=new CdpSession(t.webSocketDebuggerUrl);await s.ready;await s.send('Runtime.enable');await s.send('Page.enable');sessions.push(s);return s;};
const wait=async(c,l)=>{for(let i=0;i<100;i++){if(await c())return;await pause(50);}throw Error(l);};
try{
 proc=spawn('google-chrome',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 await wait(async()=>{try{port=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split(/\r?\n/)[0]);return!!port;}catch{return false;}},'port');
 const ver=await fetch('http://127.0.0.1:'+port+'/json/version').then(r=>r.json());
 const browser=new CdpSession(ver.webSocketDebuggerUrl);await browser.ready;sessions.push(browser);
 const data='data:text/html;charset=utf-8,'+encodeURIComponent(html);
 const siteT=await fetch('http://127.0.0.1:'+port+'/json/new?'+encodeURIComponent(data),{method:'PUT'}).then(r=>r.json());
 const site=await connect(siteT);await wait(()=>site.evaluate('document.readyState==="complete"'),'load');
 await site.send('Page.bringToFront');await pause(80);
 // baseline
 const baseline=await site.evaluate(`(async()=>{obs.splice(0);parentV.major='old10chars';localV.major='old10chars';
  const i=document.getElementById('major');const v='NEW42________________________________';
  const before={hasFocus:document.hasFocus(),visible:document.visibilityState};
  i.focus({preventScroll:true});const af={activeIsInput:document.activeElement===i,hasFocus:document.hasFocus()};
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,v);
  i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));
  i.blur();await new Promise(r=>setTimeout(r,40));
  return {before,af,ab:{activeIsInput:document.activeElement===i},events:obs.map(o=>o.type+':'+o.trusted),parent:parentV.major,local:localV.major,dom:i.value};})()`);
 // background site by opening+activating other SAME-window-ish tab
 const otherT=await fetch('http://127.0.0.1:'+port+'/json/new?'+encodeURIComponent('data:text/html,<title>other</title>x'),{method:'PUT'}).then(r=>r.json());
 const other=await connect(otherT);await other.send('Page.bringToFront');await pause(150);
 const bgState=await site.evaluate('({hasFocus:document.hasFocus(),visible:document.visibilityState})');
 const backgrounded=await site.evaluate(`(async()=>{obs.splice(0);parentV.major='old10chars';localV.major='old10chars';
  const i=document.getElementById('major');const v='NEW42________________________________';
  const before={hasFocus:document.hasFocus(),visible:document.visibilityState};
  i.focus({preventScroll:true});const af={activeIsInput:document.activeElement===i,hasFocus:document.hasFocus(),visible:document.visibilityState};
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,v);
  i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));
  i.blur();await new Promise(r=>setTimeout(r,40));
  const ab={activeIsInput:document.activeElement===i,hasFocus:document.hasFocus(),visible:document.visibilityState};
  const types=obs.map(o=>o.type);
  return {before,af,ab,events:obs.map(o=>o.type+':trusted='+o.trusted+';hf='+o.hasFocus+';vis='+o.visible),
   focusSeen:types.includes('focus'),blurSeen:types.includes('blur'),focusoutSeen:types.includes('focusout'),
   parent:parentV.major,local:localV.major,dom:i.value,
   adapterWouldPassDom:i.value===v&&af.activeIsInput&&!ab.activeIsInput,
   parentCommitted:parentV.major===v};})()`);
 const report={status:'PROBE_COMPLETED',chrome:ver.Browser,baseline,bgState,backgrounded,
  silentActiveElementWithoutBlur:backgrounded.adapterWouldPassDom&&!backgrounded.blurSeen,
  parentStaleDespiteDomPass:backgrounded.adapterWouldPassDom&&!backgrounded.parentCommitted};
 await writeFile(join(home,'result-hidden-silent-ae.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}finally{for(const s of sessions)try{s.close();}catch{}proc?.kill('SIGKILL');await pause(100);try{await rm(profile,{recursive:true,force:true});}catch{}}
