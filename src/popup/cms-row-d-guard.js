// This page calls the installed worker through the ordinary extension bridge.
// No profile/storage/DOM-of-recruiting-page or endpoint access occurs here.
const PHASES=new Set(['idle','arming','armed_read_only','stopped_retained','orphaned_retained','closed_tab_rules_removed']);
const STATES=new Set(['not_requested','installation_requested','installation_acknowledged','readback_verified','unknown','orphan_rules_present','removed_after_tab_closed']);
const REASONS=new Set(['not_armed','permission_or_api_missing','active_cms_target_not_unique','target_changed_retained',
 'rules_changed_or_unknown','worker_context_lost_rules_retained','orphan_rules_unknown','preexisting_rules_conflict',
 'command_timeout_unknown','api_outcome_unknown_retained','lease_expired_retained','rules_installed_no_live_pass',
 'match_owner_conflict','match_schema_invalid','journal_limit','unknown_request_blocked','new_channel_blocked',
 'target_closed_rules_retained','history_schema_or_limit','remove_not_verified','operation_invalid',
 'document_probe_invalid','document_changed_retained']);
const METHODS=new Set(['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS','CONNECT','OTHER']);
const CATEGORIES=new Set(['other_non_get','new_channel_blocked','cms_info_edit_blocked']);
const BOOLS=['ruleReadBackVerified','installAttempted','retentionRequested','rulesRemovedAfterTabClosed','tabClosedByBrowserEvent',
 'commandPending','recordsTruncated','networkEvidenceAvailable','currentDocumentEvidenceVerified'];
const COUNTS=['debugMatchCount','historyMatchCount'];
export function publicGuardEvidence(value){
 if(value?.kind!=='cms_d_network_guard_v1'||!PHASES.has(value.phase)||!STATES.has(value.protectionState)||!REASONS.has(value.reason))throw Error('response_invalid');
 const out={kind:value.kind,phase:value.phase,reason:value.reason,protectionState:value.protectionState};
 for(const key of BOOLS){if(typeof value[key]!=='boolean')throw Error('response_invalid');out[key]=value[key];}
 if(out.currentDocumentEvidenceVerified&&(out.phase!=='armed_read_only'||!out.ruleReadBackVerified||out.commandPending||out.protectionState!=='readback_verified'))throw Error('response_invalid');
 for(const key of COUNTS){if(!Number.isInteger(value[key])||value[key]<0||value[key]>128)throw Error('response_invalid');out[key]=value[key];}
 if(!Array.isArray(value.records)||value.records.length>128)throw Error('response_invalid');
 out.records=value.records.map(row=>{
  if(!Number.isInteger(row.sequence)||row.sequence<1||row.sequence>128||!METHODS.has(row.method)||!CATEGORIES.has(row.category)
   ||row.action!=='block'||row.source!=='rule_match_debug'||typeof row.observedAtUtc!=='string'
   ||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(row.observedAtUtc))throw Error('response_invalid');
  return {sequence:row.sequence,observedAtUtc:row.observedAtUtc,source:'rule_match_debug',method:row.method,category:row.category,action:'block'};
 });
 out.coverage='target_tab_network_stack_only';out.documentIdentityScope='last_top_frame_probe_only';
 out.existingChannelsCovered=false;out.noTabWorkersCovered=false;out.beforeArmRequestsCovered=false;out.getSideEffectsCovered=false;
 out.nativeCancellationAvailable=false;out.interactionAllowed=false;out.liveSupportClaimed=false;out.livePassClaimed=false;out.booked=53;
 return out;
}
if(typeof document!=='undefined'&&typeof chrome!=='undefined'){
 let last=null,busy=false;const message=document.getElementById('message'),result=document.getElementById('result');
 const operations={arm:'arm',status:'status',evidence:'evidence','remove-closed':'remove_closed'};
 for(const [id,operation] of Object.entries(operations))document.getElementById(id).addEventListener('click',async()=>{
  if(busy)return;busy=true;message.textContent='正在读取正式扩展接口；仍禁止控件操作。';
  try{
   const response=await chrome.runtime.sendMessage({type:'CMS_ROW_D_NETWORK_GUARD',operation});
   last=publicGuardEvidence(response);result.textContent=JSON.stringify(last,null,2);
   message.textContent=last.networkEvidenceAvailable?'已取得Chrome规则命中记录；尚非D验收PASS。':'未取得实际命中证据；不能认为保护已验收。';
   document.getElementById('export').disabled=false;
  }catch{last=null;result.textContent='';document.getElementById('export').disabled=true;message.textContent='接口或证据格式不可确认。停止操作，不代表规则已撤除。';}
  finally{busy=false;}
 });
 document.getElementById('export').addEventListener('click',()=>{
  if(!last)return;const raw=JSON.stringify(last,null,2),url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='cms-row-d-network-evidence.json';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
}
