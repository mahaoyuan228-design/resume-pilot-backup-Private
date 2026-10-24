// Real package assets and exclusively owned synthetic Chrome; no user browser or site.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CITICS_TEST_ASSETS, SELECT_FIXTURES, loadCiticsFixtureAssets, startFixtureServer,
  injectAndFill } from '../scripts/auto-citics-basic.mjs';
import { connectCdp } from '../tools/live-harvest/cdp-client.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LABELS = ['婚姻状况','政治面貌','户口类型','证件类型','民族'];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const sri = body => 'sha256-' + createHash('sha256').update(body).digest('base64');

test('installed full Vue and Ant assets match exact source sizes, SRI, compiler and retained licenses', () => {
  const assets = loadCiticsFixtureAssets();
  assert.equal(assets.size, 3);
  for (const spec of CITICS_TEST_ASSETS) {
    const body = assets.get(spec.route).body;
    assert.equal(body.length, spec.size); assert.equal(sri(body), spec.sri);
    assert.ok(fs.existsSync(path.join(ROOT,'node_modules',spec.package,'LICENSE')));
  }
  const vue = assets.get('/__citics_assets__/vue-2.7.16.js').body.toString();
  assert.match(vue, /Vue\.compile = compileToFunctions/); // Full compiler build; not runtime-only main.
});

const metadataCases = [
  ['missing Vue package', 'node_modules/vue/package.json', null],
  ['wrong Vue version', 'node_modules/vue/package.json', value => ({...value,version:'2.7.15'})],
  ['wrong Ant version', 'node_modules/ant-design-vue/package.json', value => ({...value,version:'1.7.7'})],
  ['missing compiler', 'node_modules/vue-template-compiler/package.json', null],
  ['wrong paired compiler', 'node_modules/vue-template-compiler/package.json', value => ({...value,version:'2.6.14'})],
  ['unofficial tarball', 'package-lock.json', value => { value.packages['node_modules/vue'].resolved='https://example.invalid/vue.tgz';return value; }],
  ['wrong package integrity', 'package-lock.json', value => { value.packages['node_modules/ant-design-vue'].integrity='sha512-invalid';return value; }],
  ['wrong locked compiler', 'package-lock.json', value => { value.packages['node_modules/vue-template-compiler'].version='2.6.14';return value; }]
];
for (const [name, relative, change] of metadataCases) test('asset preflight refuses ' + name, () => {
  const target=path.join(ROOT,relative);
  const reader=(filename,encoding) => {
    if(filename===target){
      if(!change)throw new Error('synthetic_missing');
      return JSON.stringify(change(JSON.parse(fs.readFileSync(filename,'utf8'))));
    }
    return fs.readFileSync(filename,encoding);
  };
  assert.throws(()=>loadCiticsFixtureAssets(reader),/fixture_asset_/);
});
for (const spec of CITICS_TEST_ASSETS) for (const variant of ['missing','truncated','same-size-corruption']) {
  test(`asset preflight refuses ${variant}: ${spec.package}/${spec.file}`,()=>{
    const target=path.join(ROOT,'node_modules',spec.package,spec.file);
    const reader=(filename,encoding)=>{
      if(filename!==target)return fs.readFileSync(filename,encoding);
      if(variant==='missing')throw new Error('synthetic_missing');
      const body=Buffer.from(fs.readFileSync(filename));
      if(variant==='truncated')return body.subarray(1);
      body[0]^=1;return body;
    };
    assert.throws(()=>loadCiticsFixtureAssets(reader),/fixture_asset_content_/);
  });
}

test('five happy fixtures use only the three local assets; CSS contains no external subresource imports',()=>{
  for(const label of LABELS){
    const html=fs.readFileSync(path.join(ROOT,'tests/fixtures',SELECT_FIXTURES[label].happy),'utf8');
    const sources=[...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/gu)].map(match=>match[1]);
    assert.deepEqual(new Set(sources),new Set(CITICS_TEST_ASSETS.map(spec=>spec.route)));
    assert.equal(sources.length,3);
  }
  const css=loadCiticsFixtureAssets().get('/__citics_assets__/antd-1.7.8.css').body.toString();
  assert.doesNotMatch(css,/@import\b/iu);
  for(const match of css.matchAll(/url\(\s*([^)]+)\)/giu)){
    const value=match[1].replace(/^['"]|['"]$/gu,'');
    assert.ok(value.startsWith('data:')||value.startsWith('#'),'unexpected CSS subresource; do not add an exception');
  }
});

function request(port,target,method='GET'){
  return new Promise((resolve,reject)=>{
    const req=http.request({host:'127.0.0.1',port,path:target,method,agent:false},res=>{
      const chunks=[];res.on('data',chunk=>chunks.push(chunk));
      res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));
    });req.on('error',reject);req.end();
  });
}
test('real loopback server serves only exact raw asset targets with correct MIME and HEAD semantics',async()=>{
  const {server,port}=await startFixtureServer();
  try{
    for(const spec of CITICS_TEST_ASSETS){
      const get=await request(port,spec.route);assert.equal(get.status,200);
      assert.equal(get.headers['content-type'],spec.type);assert.equal(get.body.length,spec.size);assert.equal(sri(get.body),spec.sri);
      const head=await request(port,spec.route,'HEAD');assert.equal(head.status,200);assert.equal(head.body.length,0);
      assert.equal(Number(head.headers['content-length']),spec.size);
      for(const method of ['POST','PUT','DELETE'])assert.equal((await request(port,spec.route,method)).status,405);
      for(const target of [spec.route+'?x=1',spec.route+'/',spec.route.replace('vue','%76ue'),spec.route.replace('antd','%61ntd')]){
        if(target!==spec.route)assert.equal((await request(port,target)).status,404);
      }
    }
    for(const target of ['/__citics_assets__/../citics-marital-select.html','/__citics_assets__/%2e%2e/package.json',
      '/__citics_assets__/missing.js','/__citics_assets__/https://unpkg.com/vue@2.7.16/dist/vue.js']){
      assert.equal((await request(port,target)).status,404);
    }
  }finally{await new Promise(resolve=>server.close(resolve));}
});

function offlineGuard(origin,send){
  const paths=new Set(['/favicon.ico',...CITICS_TEST_ASSETS.map(spec=>spec.route)]);
  for(const label of LABELS)for(const key of ['happy','double','badOptions','noReadback'])paths.add('/'+SELECT_FIXTURES[label][key]);
  let failed=false;const pending=new Set();const seen=[];
  const allowed=raw=>{
    if(typeof raw!=='string'||raw.length>262144)return false;
    if(/^data:image\/(?:svg\+xml|png|gif|x-icon)(?:;[^,]*)?,/u.test(raw))return true;
    try{const url=new URL(raw);return url.origin===origin&&!url.username&&!url.password&&!url.search&&!url.hash&&
      paths.has(url.pathname)&&raw===origin+url.pathname;}catch{return false;}
  };
  const paused=params=>{
    const ok=params.request.method==='GET'&&allowed(params.request.url);
    if(!ok)failed=true;
    seen.push(ok?'allowed':'blocked');
    const command=send(ok?'Fetch.continueRequest':'Fetch.failRequest',ok?{requestId:params.requestId}:
      {requestId:params.requestId,errorReason:'BlockedByClient'});
    pending.add(command);
    command.catch(()=>{failed=true;}).finally(()=>pending.delete(command));
    return command;
  };
  return {paused,seen,assertClear(){assert.equal(failed,false,'unlisted request attempted; sticky offline failure');},
    async drain(){await Promise.allSettled([...pending]);this.assertClear();}};
}
for(const blocked of ['https://unpkg.com/vue@2.7.16/dist/vue.js','http://127.0.0.1:9999/citics-marital-select.html',
  'http://127.0.0.1:1234/__citics_assets__/vue-2.7.16.js?x=1','data:text/html,unsafe']){
  test('request guard aborts first unlisted request and remains sticky: '+blocked.split(':')[0],async()=>{
    const commands=[];const guard=offlineGuard('http://127.0.0.1:1234',async(method,params)=>{commands.push({method,params});});
    await guard.paused({requestId:'synthetic',request:{url:blocked,method:'GET'}});
    assert.equal(commands[0].method,'Fetch.failRequest');assert.equal(commands[0].params.errorReason,'BlockedByClient');
    await guard.paused({requestId:'allowed-later',request:{url:'http://127.0.0.1:1234/citics-marital-select.html',method:'GET'}});
    assert.equal(commands[1].method,'Fetch.continueRequest');
    assert.throws(()=>guard.assertClear(),/sticky offline failure/);
  });
}

async function ownedChrome(){
  const executable=process.env.CHROME_PATH;assert.ok(executable&&fs.existsSync(executable),'CHROME_PATH is required');
  const tempRoot=fs.realpathSync(os.tmpdir());
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'citics-local-contract-'));const resolved=fs.realpathSync(profile);
  const active=path.join(resolved,'DevToolsActivePort');assert.equal(fs.existsSync(active),false);
  const child=spawn(executable,['--headless=new','--disable-gpu','--disable-background-networking','--no-first-run',
    '--no-default-browser-check','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1',
    '--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let launchError;child.on('error',error=>{launchError=error;});
  const alive=()=>assert.ok(!launchError&&child.exitCode===null&&child.signalCode===null&&!child.killed,'owned Chrome exited');
  const close=async()=>{
    child.kill();if(child.exitCode===null&&child.signalCode===null)await Promise.race([new Promise(resolve=>child.once('exit',resolve)),pause(2000)]);
    assert.ok(child.exitCode!==null||child.signalCode!==null||launchError,'owned Chrome did not exit');
    const actual=fs.realpathSync(profile);assert.equal(actual,resolved);assert.equal(path.dirname(actual),tempRoot);
    assert.ok(path.basename(actual).startsWith('citics-local-contract-'));assert.equal(actual,path.resolve(profile));
    fs.rmSync(actual,{recursive:true,force:true});
  };
  try{
    for(let i=0;!fs.existsSync(active)&&i<100;i++){alive();await pause(80);}
    alive();const stat=fs.lstatSync(active);assert.ok(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<=512);
    assert.equal(fs.realpathSync(active),active);const raw=fs.readFileSync(active,'utf8');
    const match=/^([1-9][0-9]{0,4})\r?\n(\/devtools\/browser\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\r?\n?$/u.exec(raw);assert.ok(match);
    const port=Number(match[1]);assert.ok(port>=1024&&port<=65535);
    const owner=()=>{alive();assert.equal(fs.realpathSync(active),active);assert.equal(fs.readFileSync(active,'utf8'),raw);};
    const version=await fetch(`http://127.0.0.1:${port}/json/version`).then(res=>res.json());owner();
    assert.equal(version.webSocketDebuggerUrl,`ws://127.0.0.1:${port}${match[2]}`);
    const targets=await fetch(`http://127.0.0.1:${port}/json/list`).then(res=>res.json());owner();
    const pages=targets.filter(row=>row.type==='page'&&row.url==='about:blank');assert.equal(pages.length,1);
    assert.match(pages[0].id,/^[A-Za-z0-9_-]{1,128}$/u);
    const socket=`ws://127.0.0.1:${port}/devtools/page/${encodeURIComponent(pages[0].id)}`;
    assert.equal(pages[0].webSocketDebuggerUrl,socket);return {socket,owner,close};
  }catch(error){await close();throw error;}
}

test('owned native Chrome loads all five exact components and preserves original positive/negative behavior without external requests',
  {timeout:120000},async t=>{
    loadCiticsFixtureAssets(); // Verify package bytes before creating any browser.
    const {server,port}=await startFixtureServer();const origin=`http://127.0.0.1:${port}`;
    let browser,session,guard,loaded,loadTimer;
    try{
      browser=await ownedChrome();
      session=await connectCdp(browser.socket,{timeoutMs:10000,onEvent:event=>{
        if(event.method==='Fetch.requestPaused')void guard.paused(event.params);
        if(event.method==='Page.loadEventFired'&&loaded){clearTimeout(loadTimer);loaded();loaded=null;}
      }});browser.owner();
      guard=offlineGuard(origin,(method,params)=>session.send(method,params));
      await session.send('Page.enable');await session.send('Runtime.enable');
      await session.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]}); // Before first navigation.
      const evaluate=async expression=>{const reply=await session.send('Runtime.evaluate',{expression,returnByValue:true});
        assert.equal(reply.exceptionDetails,undefined);return reply.result.value;};
      let completed=0;
      for(const label of LABELS){
        const fixture=SELECT_FIXTURES[label];
        for(const [kind,key,reason] of [['happy','happy',null],['double-select','double','select_structure_unexpected'],
          ['option-selector-miss','badOptions','select_option_selector_missing'],['readback-missing','noReadback','select_readback_missing']]){
          guard.assertClear();const ready=new Promise((resolve,reject)=>{loaded=resolve;loadTimer=setTimeout(()=>reject(new Error('fixture_load_timeout')),20000);});
          ready.catch(()=>{});
          const nav=await session.send('Page.navigate',{url:origin+'/'+fixture[key]});assert.equal(nav.errorText,undefined);await ready;
          if(kind==='happy'){
            let versions;for(let i=0;i<100;i++){
              versions=await evaluate(`({vue:typeof Vue==='function'&&Vue.version==='2.7.16',antd:typeof antd==='object'&&antd.version==='1.7.8',
                rendered:!!document.querySelector('.ant-select-selection-selected-value')})`);
              if(versions.vue&&versions.antd&&versions.rendered)break;await pause(50);
            }
            assert.deepEqual(versions,{vue:true,antd:true,rendered:true});
          }else await pause(150);
          guard.assertClear();
          const filled=await injectAndFill((method,params)=>session.send(method,params),
            {label,expected:fixture.expectedDefault,synthetic:true,restore:kind==='happy',pickAlternate:false});
          const row=filled.result;
          if(kind==='happy'){
            assert.equal(row.ok,true);assert.equal(row.before,fixture.before);assert.equal(row.after,fixture.expectedDefault);
            assert.equal(row.final,fixture.before);assert.equal(row.restored,true);assert.equal(row.neighborsUnchanged,true);
          }else{assert.equal(row.ok,false);assert.equal(row.reason,reason);assert.equal(row.clickedOption,false);}
          assert.equal(filled.commitClicks,0);await guard.drain();completed++;
        }
      }
      await pause(100);await guard.drain();assert.equal(completed,20);
      t.diagnostic('five real Vue2.7.16/Ant1.7.8 fixtures; original writer positive/negative cases=20; external attempts=0; no user browser');
    }finally{
      clearTimeout(loadTimer);
      try{if(browser)await browser.close();}finally{session?.close();await new Promise(resolve=>server.close(resolve));}
    }
  });
