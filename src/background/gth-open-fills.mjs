// Dispatch for the shipped open-editor GTH fills. Injects gth-open-fill.js
// and the section script, then sends GTH_SKILLS_FILL / GTH_OTHER_FILL /
// GTH_EDUCATION_FILL / GTH_WORK_FILL. Never Save/submit/delete.
// Unsupported controls fail closed and are not a completed fill.
// A writer does not claim live support.
import {gthAutoSiteClaims,gthAutoSiteClaimed} from './gth-save-policy.mjs';

export const GTH_SKILLS_FILL_TYPE='GTH_SKILLS_FILL';
export const GTH_OTHER_FILL_TYPE='GTH_OTHER_FILL';
export const GTH_EDUCATION_FILL_TYPE='GTH_EDUCATION_FILL';
export const GTH_WORK_FILL_TYPE='GTH_WORK_FILL';
export const GTH_OPEN_FILL_FILES={
  skills:['src/content/gth-open-fill.js','src/content/gth-skills.js'],
  other:['src/content/gth-open-fill.js','src/content/gth-other.js'],
  education:['src/content/gth-open-fill.js','src/content/gth-education-fill.js'],
  work:['src/content/gth-open-fill.js','src/content/gth-work-fill.js']
};
const VERIFIED=['readback_matched','readback_reapplied','preexisting_same_value'];
const SKILLS=['职业技能与特长'];
const OTHER=['标题','描述'];
const EDUCATION=[
  ['毕业学校','school',true],
  ['专业名称','major',true],
  ['在校活动/职务','campusActivities',false],
  ['在校成绩排名','gradeRank',false],
  ['专业描述','majorDescription',false],
  ['绩点','gpa',false],
  ['学校所在地','schoolLocation',false],
  ['学历','degree',true],
  ['是否统招','unifiedAdmissions',false],
  ['在校时间','startDate',false],
  ['专业类别','majorCategory',false]
];
const WORK=[
  ['职位名称','position',true],
  ['职位类别','jobCategory',true],
  ['公司名称','organization',true],
  ['任职时间','startDate',true],
  ['工作地区','workArea',false],
  ['职责与业绩','description',true],
  ['公司所属行业','industry',true],
  ['公司介绍','companyIntro',false],
  ['所属部门','department',false],
  ['汇报对象','reportTo',false],
  ['下属人数','subordinateCount',false],
  ['薪资','salary',false],
  ['离职原因','leaveReason',false]
];
const safe=value=>{const text=typeof value==='string'?value:(value?.message||'');return /^[a-z0-9_]{2,100}$/u.test(text)?text:'gth_open_fill_invalid';};

function flagsOk(response,scope){
  return response?.complete===false&&response?.scope===scope
    &&response?.savedOnSite==null&&response?.submitted==null
    &&response?.softwareClickedSave===false&&response?.softwareClickedSubmit===false
    &&response?.softwareClickedDelete!==true&&response?.editorLeftOpen===true
    &&response?.liveSupportClaimed!==true;
}
function rowOk(row,question,path){
  return row?.question===question&&row.path===path&&Array.isArray(row.labels)
    &&row.labels.length===1&&row.labels[0]===question;
}
function assessFixed(response,{scope,questions,path,invalidReason,policyReason}){
  const claims=gthAutoSiteClaims(response);
  const claimed=gthAutoSiteClaimed(claims);
  const fields=Array.isArray(response?.fields)?response.fields:[];
  const aligned=fields.length===questions.length&&questions.every((question,index)=>rowOk(fields[index],question,path(question)));
  const verified=row=>row?.status==='verified'&&VERIFIED.includes(row.reason);
  const allVerified=aligned&&fields.every(verified);
  const wrote=fields.some(row=>row?.reason==='readback_matched'||row?.reason==='readback_reapplied');
  const writeStarted=response?.writeStarted===true;
  const supportedComplete=response?.supportedComplete===true&&allVerified;
  const operableComplete=response?.operableComplete===true&&allVerified;
  const flags=flagsOk(response,scope);
  const unmet=row=>row&&row.status!=='verified'&&row.reason!=='not_run';
  const failed=fields.find(unmet);
  const writeAgrees=writeStarted===wrote;
  let reason=null;
  if(claimed)reason=policyReason;
  else if(!aligned||!writeAgrees||response?.ok!==allVerified||!flags&&allVerified)reason=safe(response?.reason||response?.error||invalidReason);
  else if(!allVerified||!supportedComplete||!operableComplete)reason=safe(failed?.reason||response?.reason||response?.error||invalidReason);
  const ok=reason==null&&allVerified&&supportedComplete&&operableComplete&&response?.ok===true;
  return {ok,reason,fields,writeStarted,supportedComplete:ok&&supportedComplete,operableComplete:ok&&operableComplete,
    complete:false,outcome:ok?(wrote?'verified':'verified_preexisting'):(writeStarted?'unknown':'failed_before_write'),...claims};
}
export function assessGthSkillsFill(response){
  return assessFixed(response,{
    scope:'gth_skills_one',questions:SKILLS,
    path:question=>`customAnswers.${question}`,
    invalidReason:'gth_skills_fill_invalid',policyReason:'gth_skills_save_policy_violated'
  });
}
export function assessGthOtherFill(response){
  return assessFixed(response,{
    scope:'gth_other_two',questions:OTHER,
    path:question=>`customAnswers.${question}`,
    invalidReason:'gth_other_fill_invalid',policyReason:'gth_other_save_policy_violated'
  });
}
function assessRecord(response,{scope,rows,prefix,invalidReason,policyReason}){
  const claims=gthAutoSiteClaims(response);
  const claimed=gthAutoSiteClaimed(claims);
  const fields=Array.isArray(response?.fields)?response.fields:[];
  const index=response?.profileIndex;
  const indexOk=Number.isInteger(index)&&index>=0&&index<=29;
  let cursor=0;
  const ordered=indexOk&&fields.every(row=>{
    const at=rows.findIndex((item,itemAt)=>itemAt>=cursor&&item[0]===row?.question);
    if(at<0)return false;
    cursor=at+1;
    return rowOk(row,rows[at][0],`${prefix}.${index}.${rows[at][1]}`);
  });
  const required=rows.filter(item=>item[2]).map(item=>item[0]);
  const hasRequired=required.every(question=>fields.some(row=>row.question===question));
  const verified=row=>row?.status==='verified'&&VERIFIED.includes(row.reason)&&row.supported!==false;
  const allVerified=ordered&&hasRequired&&fields.length>0&&fields.every(verified);
  const wrote=fields.some(row=>row?.reason==='readback_matched'||row?.reason==='readback_reapplied');
  const writeStarted=response?.writeStarted===true;
  const supportedComplete=response?.supportedComplete===true&&allVerified;
  const operableComplete=response?.operableComplete===true&&allVerified;
  const flags=flagsOk(response,scope);
  const unmet=row=>row&&row.status!=='verified'&&row.reason!=='not_run';
  const failed=fields.find(unmet);
  const writeAgrees=writeStarted===wrote;
  let reason=null;
  if(claimed)reason=policyReason;
  else if(!ordered||!hasRequired||!indexOk||!writeAgrees||response?.ok!==allVerified||!flags&&allVerified)reason=safe(response?.reason||response?.error||invalidReason);
  else if(!allVerified||!supportedComplete||!operableComplete)reason=safe(failed?.reason||response?.reason||response?.error||invalidReason);
  const ok=reason==null&&allVerified&&supportedComplete&&operableComplete&&response?.ok===true;
  return {ok,reason,fields,writeStarted,supportedComplete:ok&&supportedComplete,operableComplete:ok&&operableComplete,
    complete:false,outcome:ok?(wrote?'verified':'verified_preexisting'):(writeStarted?'unknown':'failed_before_write'),...claims};
}
export function assessGthEducationOpenFill(response){
  return assessRecord(response,{
    scope:'gth_education_open',rows:EDUCATION,prefix:'education',
    invalidReason:'gth_education_open_fill_invalid',policyReason:'gth_education_open_save_policy_violated'
  });
}
export function assessGthWorkOpenFill(response){
  return assessRecord(response,{
    scope:'gth_work_open',rows:WORK,prefix:'experience',
    invalidReason:'gth_work_open_fill_invalid',policyReason:'gth_work_open_save_policy_violated'
  });
}
function ship(api,tab,files,message){
  return api.scripting.executeScript({target:{tabId:tab.id},files}).then(()=>api.tabs.sendMessage(tab.id,message));
}
export function shippedGthSkillsFill({api,tab,requestId,binding,profile,replaceExisting}){
  return ship(api,tab,GTH_OPEN_FILL_FILES.skills,{
    type:GTH_SKILLS_FILL_TYPE,requestId,profileBinding:binding,profile,replaceExisting:replaceExisting===true
  });
}
export function shippedGthOtherFill({api,tab,requestId,binding,profile,replaceExisting}){
  return ship(api,tab,GTH_OPEN_FILL_FILES.other,{
    type:GTH_OTHER_FILL_TYPE,requestId,profileBinding:binding,profile,replaceExisting:replaceExisting===true
  });
}
export function shippedGthEducationOpenFill({api,tab,requestId,binding,profile,profileIndex,replaceExisting}){
  return ship(api,tab,GTH_OPEN_FILL_FILES.education,{
    type:GTH_EDUCATION_FILL_TYPE,requestId,profileBinding:binding,profile,profileIndex,replaceExisting:replaceExisting===true
  });
}
export function shippedGthWorkOpenFill({api,tab,requestId,binding,profile,profileIndex,replaceExisting}){
  return ship(api,tab,GTH_OPEN_FILL_FILES.work,{
    type:GTH_WORK_FILL_TYPE,requestId,profileBinding:binding,profile,profileIndex,replaceExisting:replaceExisting===true
  });
}
