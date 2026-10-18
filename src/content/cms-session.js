(function () {
  'use strict';
  const PAGE='https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';
  const ENDPOINT='https://wecruit.hotjob.cn/wecruit/isLogin/SU629dbc0c0dcad452299bc0f7';
  const TIMEOUT_MS=5000;
  const result=(authenticated,reason,requestSent=false)=>({ok:authenticated,authenticated,
    state:authenticated?'authenticated':'not_started',reason,requestSent,domWrites:0,
    message:authenticated?'招聘网站登录有效。':reason==='site_session_expired'
      ?'招聘网站登录已过期，请重新登录后继续。当前表单内容已保留。'
      :reason==='license_required'?'软件授权尚未通过，本次没有开始填写。'
        :'暂时无法确认招聘网站的登录状态，本次没有开始填写。当前表单内容已保留。'});
  async function onlineAllowed(){
    try{
      if(typeof chrome==='undefined'||chrome.runtime?.getManifest?.()?.background?.service_worker!=='src/license/guard-worker.mjs')return true;
      return (await chrome.runtime.sendMessage({type:'RESUME_PAID_VERIFY'}))?.allowed===true;
    }catch{return false;}
  }
  async function check(){
    // This direct entry is shared by trial and paid builds. A paid caller must
    // pass its existing online license gate before any site request is made.
    if(!await onlineAllowed())return result(false,'license_required');
    const href=location.href,timeOrigin=performance.timeOrigin;
    if(location.origin+location.pathname!==PAGE)return result(false,'wrong_site');
    const url=new URL(ENDPOINT);url.searchParams.set('iSaJAx','isAjax');url.searchParams.set('request_locale','zh_CN');url.searchParams.set('t',String(Date.now()));
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
    try{
      const response=await fetch(url.href,{method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',
        headers:{Accept:'application/json'},signal:controller.signal});
      if(performance.timeOrigin!==timeOrigin)return result(false,'site_document_changed',true);
      if(!response.ok)return result(false,'site_session_unverified',true);
      let payload;try{payload=await response.json();}catch{return result(false,'site_session_unverified',true);}
      if(performance.timeOrigin!==timeOrigin)return result(false,'site_document_changed',true);
      // The actual frontend accepts both scalar representations. Neither an
      // HTTP 200 nor a local username proves a server authenticated session.
      if(payload?.state===200||payload?.state==='200')return result(true,'site_session_authenticated',true);
      if(payload?.state===809||payload?.state==='809')return result(false,'site_session_expired',true);
      return result(false,'site_session_unverified',true);
    }catch(error){return result(false,error?.name==='AbortError'?'site_session_check_timeout':'site_session_unverified',true);}
    finally{clearTimeout(timer);}
  }
  globalThis.ResumeCmsSession=Object.freeze({check});
})();
