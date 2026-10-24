import { validExperienceSalary, MAX_CUSTOM_FACTS, clearProfile, emptyProfile, listFilledPaths, loadProfile, normalizeProfile, normalizeQuestionKey, saveProfile, sitePageUrl, customAnswerPath, scopedAnswerPath, questionIdentity, questionScopesOverlap, customAnswersProjection, preserveUniqueScopedConfirmations } from './store.js';
import { clearAttachment, loadAttachment, saveAttachment } from '../import/attachment-store.js';
import {captureProfileBinding,assertProfileBinding,canonicalProfileHash,withProfileBinding,withProfileLifecycleLock,replaceProfileLifecycle,PROFILE_EPOCH_KEY} from './profile-lifecycle.js';
import {SITE_FACTS_KEY,activeSiteFacts,confirmRecordSiteFacts,createProfileBackup,restoreProfileBackup} from './cms-education-site-facts.mjs';
import {ownerBindingFor,sourceSnapshot} from './cms-education-plan.mjs';
import {renderRecordSiteFacts,collectRecordSiteFacts} from './cms-education-site-facts-ui.mjs';
import { templateForFact, appendCmsQuestionDrafts, regionAnswer, researchAnswer, RESEARCH_CHOICES, templateAnswerError } from './site-question-templates.js';
import { seedCmsBasicFromEducation, CMS_BASIC_NEVER_SEED } from './cms-basic-seed-from-education.mjs';

const SECTION_ORDER = ['basic', 'preferences', 'education', 'experience', 'projects', 'family', 'custom', 'materials'];
const SECTION_INFO = {
  basic: ['基本资料', '请填写网站常见的联系方式；只保存你确认过的真实内容。'],
  preferences: ['求职意向', '岗位、城市、薪资和到岗时间可以在简历之外补充。'],
  education: ['教育经历', '逐段填写学校、专业及招聘网站可能询问的在校信息；时间以你确认的月份为准。'],
  experience: ['工作与实习', '正式工作和实习分别标明；描述应来自真实经历。'],
  projects: ['项目经历', '写清项目名称、你的职责与做过的工作。'],
  family: ['家庭信息（可选）', '仅当网站确实需要、且你愿意使用时填写。默认关闭自动使用。'],
  custom: ['网站补充问题', '从招聘网页收集的问题先作为空白草稿。你可以分批回答和核对；没有答案的问题仍会留空。'],
  materials: ['简历附件', '主动选择后，文件保存在此 Edge 的本机存储；网站是否接收仍需核对。']
};
const SECTION_PREFIXES = {
  basic: ['fullName', 'identityNumber', 'gender', 'height', 'selfEvaluation', 'birthDate', 'email', 'phone', 'currentCity'],
  preferences: ['desiredRoles.', 'desiredCities.', 'expectedSalary', 'availableDate', 'availabilityNote'],
  education: ['education.'], experience: ['experience.'], projects: ['projects.'],
  family: ['familyMembers.'], custom: ['customAnswers.', 'customScopedAnswers.', 'siteOptionMappings.'], materials: ['resumeAttachment.']
};
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (match) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[match]);
const sourceLabel = (value) => ({ manual: '本人填写', import: 'JSON 导入', resume: '简历导入' })[value] || '来源未标记';
const isSectionPath = (section, path) => SECTION_PREFIXES[section].some((prefix) => prefix.endsWith('.') ? path.startsWith(prefix) : path === prefix);

let profile = emptyProfile();
let activeSection = 'basic';
let saveTimer = 0;
let saveQueue = Promise.resolve(true);
let toastTimer = 0;
let pendingQuestionWork = Promise.resolve();
let lastPersistedFingerprint = '';
let profileEpoch='legacy',profileMutationInProgress=false,sitePanelRevision=0;
let externalConflict = false;
let deletingAll = false;
const localWriteFingerprints = new Set();

function fingerprint(input) {
  const normalized = normalizeProfile(input);
  normalized.updatedAt = '';
  return JSON.stringify(normalized);
}

function pauseForExternalConflict() {
  externalConflict = true;
  clearTimeout(saveTimer);
  saveTimer = 0;
  $('#save-state').textContent = '其他页面修改了资料，已暂停自动保存；请复制本页未保存内容后刷新。';
  showToast('另一页面修改了资料。为避免覆盖，已暂停本页保存。');
}

function invalidExperienceSalaryIndex() {
  return profile.experience.findIndex(row => Object.hasOwn(row, 'salary')
    && row.salary !== '' && !validExperienceSalary(row.salary));
}

function sectionPaths(section) {
  if (section === 'family' && !profile.familyDisclosureEnabled) return [];
  return listFilledPaths(profile).filter((path) => isSectionPath(section, path));
}

function fieldNote(path) {
  if (path === 'desiredRoles' || path === 'desiredCities') {
    const values = profile[path] || [];
    const confirmed = values.length > 0 && values.every((_, index) => profile.confirmedFields.includes(`${path}.${index}`));
    return `<small class="source-note">${confirmed ? '已核对' : '待核对'} · ${escapeHtml(sourceLabel(profile.sources[`${path}.0`]))}</small>`;
  }
  const confirmed = profile.confirmedFields.includes(path);
  return `<small class="source-note">${confirmed ? '已核对' : '待核对'} · ${escapeHtml(sourceLabel(profile.sources[path]))}</small>`;
}

function inputField(label, path, options = {}) {
  const value = options.value ?? profile[path] ?? '';
  const type = options.type || 'text';
  const placeholder = options.placeholder ? ` placeholder="${escapeHtml(options.placeholder)}"` : '';
  const wide = options.wide ? ' wide' : '';
  const maxlength = options.maxlength || 400;
  const control = type === 'textarea'
    ? `<textarea data-path="${escapeHtml(path)}" maxlength="${maxlength}"${placeholder}>${escapeHtml(value)}</textarea>`
    : `<input data-path="${escapeHtml(path)}" type="${type}" value="${escapeHtml(value)}" maxlength="${maxlength}"${placeholder}>`;
  return `<label class="field${wide}"><span>${escapeHtml(label)}</span>${control}${fieldNote(path)}</label>`;
}

function listField(label, list, index, key, options = {}) {
  const path = `${list}.${index}.${key}`;
  const value = profile[list][index][key] || '';
  const placeholder = options.placeholder ? ` placeholder="${escapeHtml(options.placeholder)}"` : '';
  let control;
  if (options.type === 'textarea') {
    control = `<textarea data-list="${list}" data-index="${index}" data-field="${key}" maxlength="4000"${placeholder}>${escapeHtml(value)}</textarea>`;
  } else if (options.type === 'select') {
    control = `<select data-list="${list}" data-index="${index}" data-field="${key}"><option value="">请选择</option>${options.choices.map(([optionValue, title]) => `<option value="${escapeHtml(optionValue)}"${value === optionValue ? ' selected' : ''}>${escapeHtml(title)}</option>`).join('')}</select>`;
  } else {
    const maxlength = options.maxlength === null ? '' : ` maxlength="${options.maxlength || 400}"`;
    control = `<input data-list="${list}" data-index="${index}" data-field="${key}" type="${options.type || 'text'}" value="${escapeHtml(value)}"${maxlength}${placeholder}>`;
  }
  const notePath = list === 'customFacts' ? customAnswerPath(profile.customFacts[index],profile.customFacts)
    : list === 'siteOptionMappings' ? `siteOptionMappings.${index}.optionText` : path;
  const showNote = (list !== 'customFacts' || Boolean(profile.customFacts[index].question.trim()))
    && (list !== 'siteOptionMappings' || key === 'optionText');
  return `<label class="field${options.wide ? ' wide' : ''}"><span>${escapeHtml(label)}</span>${control}${showNote ? fieldNote(notePath) : ''}</label>`;
}

function confirmedMappingSources() {
  const titles = {
    fullName:'姓名',identityNumber:'证件号码',gender:'性别',height:'身高',selfEvaluation:'自我评价',birthDate:'出生日期',email:'邮箱',phone:'电话',currentCity:'现居住地',expectedSalary:'期望薪资',availableDate:'到岗日期',availabilityNote:'到岗说明',
    school:'学校',degree:'学历',major:'专业',startDate:'开始日期',endDate:'结束日期',majorCategory:'专业类别',unifiedAdmissions:'是否统招',campusActivities:'在校活动／职务',gradeRank:'成绩排名',majorDescription:'专业描述',gpa:'绩点',schoolLocation:'学校所在地',
    type:'工作类型',organization:'单位',position:'岗位',description:'主要内容',jobCategory:'职位类别',industry:'公司所属行业',workArea:'工作地区',companyIntro:'公司介绍',department:'所属部门',reportTo:'汇报对象',subordinateCount:'下属人数',salary:'该段薪资（元/月）',leaveReason:'离职原因',name:'名称',role:'角色',relation:'关系',occupation:'职业',employer:'工作单位'
  };
  const preview = value => value.length > 160 ? value.slice(0,160)+'…' : value;
  return [...new Set(listFilledPaths(profile))].flatMap(path => {
    if(path.startsWith('siteOptionMappings.')||!profile.confirmedFields.includes(path))return [];
    const value=factAtPath(path);if(typeof value!=='string'||!value.trim())return [];
    let title=titles[path]||'';
    if(path.startsWith('customAnswers.')||path.startsWith('customScopedAnswers.')){
      const rows=profile.customFacts.filter(row=>customAnswerPath(row,profile.customFacts)===path);
      if(rows.length!==1||profile.customFacts.some(other=>other!==rows[0]&&questionScopesOverlap(other,rows[0])))return [];
      const row=rows[0];let site='未限定网站';try{const url=new URL(row.sitePageUrl);site=url.host+url.pathname;}catch{}
      title=`补充问题 · ${row.question} · ${row.sectionName||'未限定分区'} · ${row.rowContext==='single'?'当前唯一一行':row.rowContext==='none'?'非重复行':'未限定行'}`;
      return [{path,value,label:`${title}：${preview(value)} · ${site}`}];
    }else{
      const parts=path.split('.'),index=Number(parts[1]),field=parts[2];
      if(['education','experience','projects','familyMembers'].includes(parts[0])&&Number.isInteger(index)&&index>=0&&titles[field]){
        const row=profile[parts[0]]?.[index];if(!row)return [];
        const group={education:'教育经历',experience:'工作／实习',projects:'项目经历',familyMembers:'家庭信息'}[parts[0]],identity=parts[0]==='education'?row.school:parts[0]==='experience'?row.organization:parts[0]==='projects'?row.name:row.relation;
        title=`${group}第 ${index+1} 段${identity?' · '+identity:''} · ${titles[field]}`;
      }else if(['desiredRoles','desiredCities'].includes(parts[0])&&Number.isInteger(index)&&index>=0)title=`${parts[0]==='desiredRoles'?'期望岗位':'期望城市'}第 ${index+1} 项`;
      else if(path==='resumeAttachment.name')title='材料 · 简历附件文件名';
    }
    if(!title)return [];
    return [{path,value,label:`${title}：${preview(value)}`}];
  });
}

function mappingSourceField(index) {
  const mapping=profile.siteOptionMappings[index],sources=confirmedMappingSources(),current=sources.find(source=>source.path===mapping.fieldPath),stale=!!mapping.fieldPath&&(!current||current.value!==mapping.sourceValue);
  const retained=stale?`<option value="${escapeHtml(mapping.fieldPath)}" selected disabled>旧对应已保留，请重新选择已核对资料</option>`:'';
  const choices=sources.map(source=>`<option value="${escapeHtml(source.path)}"${!stale&&source.path===mapping.fieldPath?' selected':''}>${escapeHtml(source.label)}</option>`).join('');
  return `<label class="field wide"><span>原资料（仅显示已核对资料）</span><select data-list="siteOptionMappings" data-index="${index}" data-field="fieldPath"><option value=""${!mapping.fieldPath?' selected':''}>请选择本人已核对的资料</option>${retained}${choices}</select>${stale?'<small class="hint">原资料未核对、已变更或已删除。旧资料路径、值和网站选项均已保留；请重新选择后核对。</small>':''}</label>`;
}

function listEditor(list, title, fields, emptyText) {
  const rows = profile[list];
  const cards = rows.map((_, index) => `<div class="list-entry"><div class="entry-heading"><strong>${escapeHtml(title)} ${index + 1}</strong><button type="button" data-remove="${list}" data-index="${index}" aria-label="删除${escapeHtml(title)} ${index + 1}">删除这一段</button></div><div class="form-grid">${fields(index).join('')}</div>${list==='education'?`<div data-cms-site-panel="${index}"></div>`:''}</div>`).join('');
  return `<div class="group-heading"><h3>${escapeHtml(title)}</h3><button type="button" class="btn" data-add="${list}">＋ 添加${escapeHtml(title)}</button></div>${cards || `<div class="empty-entry">${escapeHtml(emptyText)}</div>`}`;
}

function customFactFields(index) {
  const fact = profile.customFacts[index], spec = templateForFact(fact);
  if (!spec) return [
    listField('网站问题原文', 'customFacts', index, 'question', { placeholder: '例如：是否接受岗位调剂？' }),
    listField('你的确定答案', 'customFacts', index, 'answer', { placeholder: '请使用本人确定的回答' }),
    listField('网站页面地址（不含查询参数）', 'customFacts', index, 'sitePageUrl', { wide: true }),
    listField('网站表单分区', 'customFacts', index, 'sectionName'),
    listField('重复行位置', 'customFacts', index, 'rowContext', { type: 'select', choices: [['none', '不在重复行'], ['single', '当前唯一一行']] })
  ];
  const heading = `<div class="hint wide"><strong>招商证券 · ${escapeHtml(spec.sectionName.replace(/必填$/, ''))}</strong><br>${escapeHtml(spec.question)}<br><small>只用于该网站当前唯一的一段记录；多段记录须先明确对应关系。</small></div>`;
  const note = fieldNote(customAnswerPath(fact,profile.customFacts));
  if (spec.kind === 'region') {
    let pair = {};
    try { const parsed = JSON.parse(fact.answer); if (parsed && !Array.isArray(parsed)) pair = parsed; } catch { /* Display empty fields; preserve original until edited. */ }
    return [heading, ...['province', 'city'].map(key => `<label class="field"><span>${key === 'province' ? '省份／地区（网站选项原文）' : '城市（网站选项原文）'}</span><input data-custom-region="${index}" data-part="${key}" value="${escapeHtml(pair[key] || '')}" maxlength="160">${note}</label>`)];
  }
  if (spec.kind === 'checkbox') {
    let selected = [];
    try { const parsed = JSON.parse(fact.answer); if (Array.isArray(parsed)) selected = parsed; } catch { /* Preserve invalid data for explicit review. */ }
    return [heading, `<div class="field wide"><span>选择你的研究方向（无默认选择）</span>${RESEARCH_CHOICES.map(choice => `<label class="switch-row"><input type="checkbox" data-custom-choice="${index}" value="${escapeHtml(choice)}"${selected.includes(choice) ? ' checked' : ''}><span>${escapeHtml(choice)}</span></label>`).join('')}${note}</div>`];
  }
  return [heading, listField('你的确定答案', 'customFacts', index, 'answer', { type: spec.kind === 'date' ? 'date' : 'text', placeholder: '下拉题请填写网站实际显示的选项文字', wide: true })];
}

function sectionMarkup(section) {
  switch (section) {
    case 'basic': return `<div class="form-grid">
      ${inputField('姓名', 'fullName', { placeholder: '与证件、简历一致' })}
      ${inputField('性别', 'gender', { placeholder: '按本人资料填写' })}
      ${inputField('出生日期', 'birthDate', { placeholder: '例如：2002-01-25' })}
      ${inputField('证件号码', 'identityNumber', { placeholder: '按有效证件填写' })}
      ${inputField('邮箱', 'email', { type: 'email', placeholder: '常用招聘邮箱' })}
      ${inputField('手机号', 'phone', { type: 'tel', placeholder: '常用联系电话' })}
      ${inputField('当前城市', 'currentCity', { placeholder: '例如：上海' })}
      ${inputField('身高（厘米）', 'height', { placeholder: '例如：182；含单位的旧值请先核对' })}
      ${inputField('自我评价', 'selfEvaluation', { type: 'textarea', wide: true, maxlength: 4000 })}
    </div><div class="hint">✳ 资料仅保存在此浏览器本机。每一页确认后，相关字段才可供自动填写。</div>`;
    case 'preferences': return `<div class="form-grid">
      ${inputField('期望岗位（多个用逗号分隔）', 'desiredRoles', { value: profile.desiredRoles.join('、'), placeholder: '例如：投行分析、证券研究' })}
      ${inputField('期望城市（多个用逗号分隔）', 'desiredCities', { value: profile.desiredCities.join('、'), placeholder: '例如：上海、北京' })}
      ${inputField('期望薪资', 'expectedSalary', { placeholder: '请写清金额与周期，例如 15,000 元/月' })}
      ${inputField('最早到岗日期', 'availableDate', { type: 'date' })}
      ${inputField('到岗补充说明', 'availabilityNote', { wide: true, placeholder: '例如：毕业后可到岗；若没有确定日期，可留空' })}
    </div><div class="hint">✳ 薪资口径因网站而异；软件只在明确匹配时填写，无法转换时会请你确认。</div>`;
    case 'education': return listEditor('education', '教育经历', (index) => [
      listField('学校', 'education', index, 'school'), listField('学历', 'education', index, 'degree'),
      listField('专业', 'education', index, 'major'), listField('开始月份', 'education', index, 'startDate', { type: 'month' }),
      listField('结束月份', 'education', index, 'endDate', { type: 'month' }),
      listField('专业类别', 'education', index, 'majorCategory', { placeholder: '按招聘网站实际类别核对' }),
      listField('是否统招', 'education', index, 'unifiedAdmissions', {
        type: 'select', choices: [['是', '是'], ['否', '否']]
      }),
      listField('在校活动／职务', 'education', index, 'campusActivities', { type: 'textarea', wide: true }),
      listField('在校成绩排名', 'education', index, 'gradeRank', { placeholder: '如无统计，可留空' }),
      listField('专业描述', 'education', index, 'majorDescription', { type: 'textarea', wide: true }),
      listField('绩点', 'education', index, 'gpa', { placeholder: '保留原评分制，不自动换算' }),
      listField('学校所在地', 'education', index, 'schoolLocation', { placeholder: '本段学校所在城市或地区' })
    ], '还没有教育经历。添加后逐项核对。')
      + '<div class="hint">✳ 下方补充项按每段教育独立保存。只填写确定的事实；空白项不会自动填写。网站的专业类别、学历等选项还需与实际候选对应。</div>';
    case 'experience': return listEditor('experience', '工作／实习经历', (index) => [
      listField('类型', 'experience', index, 'type', { type: 'select', choices: [['internship', '实习'], ['fulltime', '正式工作'], ['other', '其他']] }),
      listField('单位', 'experience', index, 'organization'),
      listField('岗位', 'experience', index, 'position'), listField('开始日期（须补零：YYYY-MM 或 YYYY-MM-DD）', 'experience', index, 'startDate', { maxlength: 10, placeholder: '例：2022-09 或 2022-09-01' }),
      listField('结束日期（须补零：YYYY-MM 或 YYYY-MM-DD）', 'experience', index, 'endDate', { maxlength: 10, placeholder: '例：2022-12 或 2022-12-01' }),
      listField('主要工作', 'experience', index, 'description', { type: 'textarea', wide: true }),
      listField('职位类别（一级||二级）', 'experience', index, 'jobCategory', { wide: true, placeholder: '与网站选项原文一致，例如 金融/保险||银行' }),
      listField('公司所属行业（一级||二级）', 'experience', index, 'industry', { wide: true, placeholder: '与网站选项原文一致，例如 金融||证券/投资/基金/信托' }),
      listField('工作地区', 'experience', index, 'workArea'),
      listField('公司介绍', 'experience', index, 'companyIntro', { type: 'textarea', wide: true }),
      listField('所属部门', 'experience', index, 'department'),
      listField('汇报对象', 'experience', index, 'reportTo'),
      listField('下属人数', 'experience', index, 'subordinateCount'),
      listField('该段薪资（元/月，纯数字，可不填）', 'experience', index, 'salary', { maxlength: null }),
      listField('离职原因', 'experience', index, 'leaveReason', { type: 'textarea', wide: true })
    ], '还没有工作或实习经历。没有经历可以保持空白。')
      + '<div class="hint">日期月、日须两位（如 2022-09-01，不要写成 2022-9-1）。离开输入框或点确认时会自动补零；无法识别的格式仍须你改正。国泰海通已打开的工作经验编辑器只接受 YYYY-MM 任职时间，职位类别和公司所属行业须为「一级||二级」。薪资可不填；填写时请按元/月填写1–10位数字，不要附带单位。</div>';
    case 'projects': return listEditor('projects', '项目经历', (index) => [
      listField('项目名称', 'projects', index, 'name'), listField('你的角色', 'projects', index, 'role'),
      listField('项目内容与成果', 'projects', index, 'description', { type: 'textarea', wide: true })
    ], '还没有项目经历。没有项目可以保持空白。');
    case 'family': return `<label class="switch-row"><input id="family-enabled" type="checkbox" ${profile.familyDisclosureEnabled ? 'checked' : ''}><span><strong>允许本软件使用本页已确认的家庭信息</strong><br>默认关闭。关闭后，本页资料不会用于自动填写；再次开启需重新核对。</span></label>${profile.familyDisclosureEnabled ? listEditor('familyMembers', '家庭成员', (index) => [
      listField('关系', 'familyMembers', index, 'relation', { placeholder: '例如：父亲' }),
      listField('职业', 'familyMembers', index, 'occupation'),
      listField('工作单位（可选）', 'familyMembers', index, 'employer', { wide: true })
    ], '此信息完全可选。网站要求时再决定是否补充。') : '<div class="empty-entry">家庭信息自动使用已关闭。此页不要求填写。</div>'}`;
    case 'custom': return `<div class="hint">✳ 网站新问题会同时记录页面和分区。缺少的答案会留空，填写后仍需由你核对。相同题目在不同分区的答案分别保存。</div>
    <div class="group-heading"><h3>已支持网站的问题清单</h3><button type="button" class="btn" id="add-cms-question-drafts">添加招商证券补充问题</button> <button type="button" class="btn" id="seed-cms-basic-from-education">从已核对教育经历填充个人基本信息</button></div><div class="hint">只添加空白问题，不替你回答、不覆盖已有答案。省市分别填写，研究方向直接勾选；请按网站实际选项填写。<br>「从已核对教育经历填充」仅复制已核对的学校/学历/专业/学位补充/完整毕业日到 CMS 个人基本信息别名并勾选已核对；<strong>不会</strong>填写或确认籍贯、婚姻、现居住地、期望面试地点、国籍/地区。</div>
    ${listEditor('customFacts', '补充问答', customFactFields, '第一次遇到网站新问题时，可在这里添加并确认。')}
    <div class="hint">✳ 问题原文用于精确匹配。不同网站表述相近但含义不明时，不会凭猜测自动套用。</div>
    ${listEditor('siteOptionMappings', '网站选项对应', (index) => [
      listField('招聘网站地址范围', 'siteOptionMappings', index, 'siteUrlPrefix', { wide: true, placeholder: '例如：https://career.example.cn/employer-id/' }),
      mappingSourceField(index),
      listField('原资料值', 'siteOptionMappings', index, 'sourceValue', { maxlength:4000, placeholder: '选择资料后自动带入，须与已核对的原资料完全一致' }),
      listField('网站选项原文', 'siteOptionMappings', index, 'optionText', { wide: true, placeholder: '填写网站实际显示的选项文字' })
    ], '网站选项和你的资料用词不同时，可添加一条对应关系。')}
    <div class="hint">✳ 地址请写到该招聘方专属路径，并以 / 结尾。只有原资料已核对、资料值一致、网站地址范围和选项原文完全匹配时，软件才会使用这条对应关系。</div>`;
    case 'materials': return `<div class="form-grid"><label class="field wide"><span>选择并保存在本机的简历文件</span><input id="resume-file" type="file" accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"><small>限 5 MB。文件正文只保存在此 Edge 扩展的本机存储中，JSON 备份不包含文件；网站是否收到文件须另行核对。</small></label></div>${profile.resumeAttachment ? `<div class="hint">${profile.resumeAttachment.source === 'stored-local' ? '本机已保存' : '仅有文件记录'}：${escapeHtml(profile.resumeAttachment.name)}（${Math.ceil(profile.resumeAttachment.size / 1024)} KB） · ${escapeHtml(sourceLabel(profile.sources['resumeAttachment.name']))} · ${profile.confirmedFields.includes('resumeAttachment.name') ? '已核对' : '待核对'}<br><button type="button" class="text-button" id="remove-resume">删除本机附件记录与文件</button></div>` : '<div class="empty-entry">尚未保存附件。可在此选择一次，供之后的网站使用。</div>'}`;
    default: return '';
  }
}

function unansweredCustomDrafts() {
  return profile.customFacts.filter((item) => item.question.trim() && !item.answer.trim()).length;
}

function renderMenu() {
  $('#section-buttons').innerHTML = SECTION_ORDER.map((section) => {
    const paths = sectionPaths(section);
    const count = paths.filter((path) => profile.confirmedFields.includes(path)).length;
    const pending = section === 'custom' ? unansweredCustomDrafts() : 0;
    const invalidSalary = section === 'experience' && invalidExperienceSalaryIndex() !== -1;
    const status = invalidSalary ? '待核对' : pending ? `待回答 ${pending}` : !paths.length ? '空白' : count === paths.length ? '已核对' : `${count}/${paths.length}`;
    return `<button type="button" data-section="${section}" class="${section === activeSection ? 'active' : ''}" ${section === activeSection ? 'aria-current="true"' : ''}><span>${escapeHtml(SECTION_INFO[section][0])}</span><small>${status}</small></button>`;
  }).join('');
}

function renderSummary() {
  const filled = listFilledPaths(profile).length;
  const confirmed = profile.confirmedFields.length;
  $('#profile-count').textContent = `${confirmed} / ${filled} 项资料已核对`;
  $('#profile-updated').textContent = profile.updatedAt ? `本机上次保存：${new Date(profile.updatedAt).toLocaleString('zh-CN')}` : '尚未保存资料';
  $('#section-summary').innerHTML = `<div><span>已核对字段</span><b>${confirmed}</b></div><div><span>待核对字段</span><b>${Math.max(0, filled - confirmed)}</b></div><div><span>家庭信息使用</span><b>${profile.familyDisclosureEnabled ? '开启' : '关闭'}</b></div>`;
}

function renderSection() {
  sitePanelRevision++;
  const [title, description] = SECTION_INFO[activeSection];
  $('#section-number').textContent = `${String(SECTION_ORDER.indexOf(activeSection) + 1).padStart(2, '0')} / ${title}`;
  $('#section-title').textContent = title;
  $('#section-description').textContent = description;
  $('#profile-form').innerHTML = sectionMarkup(activeSection);
  if(activeSection==='education')refreshSiteFactPanels(sitePanelRevision).catch(()=>{showToast('招聘网站补充资料读取失败，请刷新后重试。');});
  const paths = sectionPaths(activeSection);
  const done = paths.length > 0 && paths.every((path) => profile.confirmedFields.includes(path))
    && (activeSection !== 'custom' || !unansweredCustomDrafts())
    && (activeSection !== 'experience' || invalidExperienceSalaryIndex() === -1);
  $('#section-state').textContent = done ? '已核对' : '待核对';
  $('#section-state').classList.toggle('confirmed', done);
  $('#review-check').checked = done;
  $('#review-check').disabled = activeSection === 'family' && !profile.familyDisclosureEnabled;
  $('#confirm-button').disabled = activeSection === 'family' && !profile.familyDisclosureEnabled;
  renderMenu();
  renderSummary();
}

function updateStatus() {
  const paths = sectionPaths(activeSection);
  const done = paths.length > 0 && paths.every((path) => profile.confirmedFields.includes(path))
    && (activeSection !== 'custom' || !unansweredCustomDrafts())
    && (activeSection !== 'experience' || invalidExperienceSalaryIndex() === -1);
  $('#section-state').textContent = done ? '已核对' : '待核对';
  $('#section-state').classList.toggle('confirmed', done);
  renderMenu();
  renderSummary();
}

function refreshFieldNotes() {
  $('#profile-form').querySelectorAll('[data-path], [data-list]').forEach((element) => {
    if (element.dataset.list === 'siteOptionMappings' && element.dataset.field !== 'optionText') return;
    const path = element.dataset.path || (element.dataset.list === 'customFacts'
      ? customAnswerPath(profile.customFacts[Number(element.dataset.index)]||{},profile.customFacts)
      : element.dataset.list === 'siteOptionMappings'
        ? `siteOptionMappings.${element.dataset.index}.optionText`
        : `${element.dataset.list}.${element.dataset.index}.${element.dataset.field}`);
    const note = element.parentElement.querySelector('.source-note');
    const markup = path === 'customAnswers.' ? '' : fieldNote(path);
    if (note && markup) note.outerHTML = markup;
    else if (note) note.remove();
    else if (markup) element.insertAdjacentHTML('afterend', markup);
  });
  // A same-page answer edit may revoke a source confirmation. Do not keep a
  // previously confirmed answer selectable from a stale rendered option list.
  $('#profile-form').querySelectorAll('select[data-list="siteOptionMappings"][data-field="fieldPath"]').forEach(element=>{
    const index=Number(element.dataset.index);if(profile.siteOptionMappings[index])element.closest('label.field').outerHTML=mappingSourceField(index);
  });
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3500);
}

function enqueueSave() {
  if (externalConflict) return Promise.resolve(false);
  const snapshot = structuredClone(profile);
  const signature = fingerprint(snapshot);
  localWriteFingerprints.add(signature);
  if (localWriteFingerprints.size > 20) localWriteFingerprints.delete(localWriteFingerprints.values().next().value);
  saveQueue = saveQueue.then(() => withProfileLifecycleLock(async()=>{
    const binding=await captureProfileBinding(chrome.storage.local),current=await loadProfile();
    if(binding.epoch!==profileEpoch||fingerprint(current)!==lastPersistedFingerprint){
      pauseForExternalConflict();throw Error('profile_binding_changed');
    }
    return saveProfile(snapshot);
  })).then((saved) => {
    lastPersistedFingerprint = signature;
    profile.updatedAt = saved.updatedAt;
    $('#save-state').textContent = '草稿已保存在本机';
    renderSummary();
    return true;
  }).catch((error) => {
    console.error('保存资料失败', error);
    $('#save-state').textContent = '保存失败，请重试';
    showToast('资料保存失败，请检查浏览器存储空间。');
    return false;
  });
  return saveQueue;
}

function scheduleSave() {
  if (externalConflict) { $('#save-state').textContent = '其他页面修改了资料，已暂停自动保存；请刷新。'; return; }
  $('#save-state').textContent = '正在保存草稿…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { enqueueSave(); }, 350);
}

async function flushSave() {
  if (externalConflict) return false;
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = 0; await enqueueSave(); }
  return saveQueue;
}

function invalidate(path) {
  profile.confirmedFields = profile.confirmedFields.filter((item) => item !== path);
  profile.sources[path] = 'manual';
  for (const [index, mapping] of profile.siteOptionMappings.entries()) {
    if (mapping.fieldPath === path) {
      profile.confirmedFields = profile.confirmedFields.filter((item) => item !== `siteOptionMappings.${index}.optionText`);
    }
  }
  $('#review-check').checked = false;
}

function invalidatePrefix(prefix) {
  profile.confirmedFields = profile.confirmedFields.filter((item) => !item.startsWith(prefix));
  for (const key of Object.keys(profile.sources)) if (key.startsWith(prefix)) delete profile.sources[key];
  for (const [index, mapping] of profile.siteOptionMappings.entries()) {
    if (mapping.fieldPath.startsWith(prefix)) {
      profile.confirmedFields = profile.confirmedFields.filter((item) => item !== `siteOptionMappings.${index}.optionText`);
    }
  }
  $('#review-check').checked = false;
}

function parseList(value) { return value.split(/[,，、;；\n]+/).map((item) => item.trim()).filter(Boolean); }
function isCalendarDate(value) {
  if (!/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
// Accept common unpadded forms (2022-9-1 / 2022-9) and return zero-padded YYYY-MM or YYYY-MM-DD.
// Invalid calendars and non-dates are returned unchanged so confirm can name them.
function padLooseDate(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return '';
  let match = trimmed.match(/^(\d{4})-(\d{1,2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12) {
      return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
    }
    return trimmed;
  }
  match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const padded = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return isCalendarDate(padded) ? padded : trimmed;
    }
  }
  return trimmed;
}
function applyLooseExperienceDates() {
  let changed = false;
  for (const [index, row] of profile.experience.entries()) {
    for (const field of ['startDate', 'endDate']) {
      const raw = row[field] || '';
      const padded = padLooseDate(raw);
      if (padded === raw) continue;
      row[field] = padded;
      changed = true;
      const input = document.querySelector(`[data-list="experience"][data-index="${index}"][data-field="${field}"]`);
      if (input) input.value = padded;
      if (!profile.sources[`experience.${index}.${field}`]) profile.sources[`experience.${index}.${field}`] = 'manual';
    }
  }
  return changed;
}
function syncCustomAnswers() {
  profile.customAnswers = customAnswersProjection(profile.customFacts,profile.customAnswers);
}

function factAtPath(path) {
  if(path.startsWith('customScopedAnswers.')){const rows=profile.customFacts.filter(row=>scopedAnswerPath(row)===path);return rows.length===1?rows[0].answer:undefined;}
  if (path.startsWith('customAnswers.')) return profile.customAnswers[path.slice('customAnswers.'.length)];
  return path.split('.').reduce((value, key) => value?.[key], profile);
}

function validSiteUrlPrefix(value) {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
      && !url.username && !url.password && !url.search && !url.hash
      && url.pathname !== '/' && url.pathname.endsWith('/');
  } catch { return false; }
}

function handleFieldChange(event) {
  const element = event.target;
  if (element.dataset.customRegion !== undefined || element.dataset.customChoice !== undefined) {
    const index = Number(element.dataset.customRegion ?? element.dataset.customChoice);
    const fact = profile.customFacts[index], spec = templateForFact(fact);
    if (!spec) return;
    const answer = spec.kind === 'region' ? regionAnswer(
      $(`[data-custom-region="${index}"][data-part="province"]`)?.value,
      $(`[data-custom-region="${index}"][data-part="city"]`)?.value)
      : spec.kind === 'checkbox' ? researchAnswer([...document.querySelectorAll(`[data-custom-choice="${index}"]:checked`)].map(node => node.value)) : null;
    if (answer === null || fact.answer === answer) return;
    const path=customAnswerPath(fact,profile.customFacts);fact.answer = answer; syncCustomAnswers(); invalidate(path);
    const containers = spec.kind === 'region'
      ? [...document.querySelectorAll(`[data-custom-region="${index}"]`)].map(node => node.parentElement)
      : [element.closest('.field')];
    for (const container of containers) {
      const note = container?.querySelector('.source-note');
      if (note) note.outerHTML = fieldNote(customAnswerPath(fact,profile.customFacts));
    }
    updateStatus(); scheduleSave(); return;
  }
  const direct = element.dataset.path;
  if (direct) {
    const value = direct === 'desiredRoles' || direct === 'desiredCities' ? parseList(element.value) : element.value;
    if (JSON.stringify(profile[direct]) === JSON.stringify(value)) return;
    profile[direct] = value;
    if (Array.isArray(value)) {
      invalidatePrefix(`${direct}.`);
      value.forEach((_, index) => { profile.sources[`${direct}.${index}`] = 'manual'; });
    } else invalidate(direct);
  } else if (element.dataset.list) {
    const { list, field } = element.dataset;
    const index = Number(element.dataset.index);
    if(list==='siteOptionMappings'&&field==='fieldPath'&&profile.siteOptionMappings[index]){
      const mapping=profile.siteOptionMappings[index],source=confirmedMappingSources().find(item=>item.path===element.value);
      if(!source){element.value=mapping.fieldPath;showToast('请选择本人已核对且非空的资料。');return;}
      if(mapping.fieldPath===source.path&&mapping.sourceValue===source.value)return;
      mapping.fieldPath=source.path;mapping.sourceValue=source.value;mapping.optionText='';invalidate(`siteOptionMappings.${index}.optionText`);
      const sourceInput=$(`[data-list="siteOptionMappings"][data-index="${index}"][data-field="sourceValue"]`),optionInput=$(`[data-list="siteOptionMappings"][data-index="${index}"][data-field="optionText"]`);
      if(sourceInput)sourceInput.value=source.value;if(optionInput)optionInput.value='';refreshFieldNotes();updateStatus();$('#review-check').checked=false;scheduleSave();showToast('已带入原资料值，请填写网站选项原文后重新核对。');return;
    }
    if (!profile[list]?.[index] || profile[list][index][field] === element.value) return;
    const oldFact=list==='customFacts'?structuredClone(profile.customFacts[index]):null,oldPath=oldFact?customAnswerPath(oldFact,profile.customFacts):null;
    if(list==='customFacts')preserveUniqueScopedConfirmations(profile,profile.customFacts.map((row,i)=>i===index?{...row,[field]:element.value}:row));
    profile[list][index][field] = element.value;
    if (list === 'customFacts') {
      syncCustomAnswers();
      const changed=profile.customFacts[index],newPath=customAnswerPath(changed,profile.customFacts);
      for (const path of new Set([oldPath,scopedAnswerPath(oldFact),newPath,scopedAnswerPath(changed)])) {
        if (!path) continue;
        profile.confirmedFields = profile.confirmedFields.filter((item) => item !== path);
        delete profile.sources[path];
        for (const [mappingIndex, mapping] of profile.siteOptionMappings.entries()) {
          if (mapping.fieldPath === path) {
            profile.confirmedFields = profile.confirmedFields.filter((item) => item !== `siteOptionMappings.${mappingIndex}.optionText`);
          }
        }
      }
      if (changed.question&&newPath) profile.sources[newPath] = 'manual';
      $('#review-check').checked = false;
    } else if (list === 'siteOptionMappings') invalidate(`${list}.${index}.optionText`);
    else invalidate(`${list}.${index}.${field}`);
  } else return;
  refreshFieldNotes();
  updateStatus();
  scheduleSave();
}

function addEntry(list) {
  const templates = {
    education: {
      school: '', degree: '', major: '', startDate: '', endDate: '',
      majorCategory: '', unifiedAdmissions: '', campusActivities: '',
      gradeRank: '', majorDescription: '', gpa: '', schoolLocation: ''
    },
    experience: {
      type: '', organization: '', position: '', startDate: '', endDate: '', description: '',
      jobCategory: '', industry: '', workArea: '', companyIntro: '', department: '', reportTo: '',
      subordinateCount: '', salary: '', leaveReason: ''
    },
    projects: { name: '', role: '', description: '' },
    familyMembers: { relation: '', occupation: '', employer: '' },
    customFacts: { question: '', answer: '', sitePageUrl: '', sectionName: '', rowContext: '' },
    siteOptionMappings: { siteUrlPrefix: '', fieldPath: '', sourceValue: '', optionText: '' }
  };
  const maxRows = list === 'customFacts' ? MAX_CUSTOM_FACTS : 30;
  if (!templates[list] || profile[list].length >= maxRows) { showToast(`本页最多添加 ${maxRows} 段。`); return; }
  profile[list].push({ ...templates[list] });
  scheduleSave();
  renderSection();
  $('#profile-form [data-list="' + list + '"][data-index="' + (profile[list].length - 1) + '"]')?.focus();
}

function removeEntry(list, index) {
  if (!Array.isArray(profile[list]) || !profile[list][index]) return;
  const removed=list==='customFacts'?profile.customFacts[index]:null,removedPaths=removed?[customAnswerPath(removed,profile.customFacts),scopedAnswerPath(removed)]:[];
  profile[list].splice(index, 1);
  if (list === 'customFacts') { for(const path of removedPaths.filter(Boolean))invalidate(path);syncCustomAnswers();profile=normalizeProfile(profile); }
  else if (list === 'siteOptionMappings') invalidatePrefix('siteOptionMappings.');
  else invalidatePrefix(`${list}.`);
  // Index based paths changed: all remaining rows now require confirmation again.
  for (const path of sectionPaths(activeSection)) profile.sources[path] = 'manual';
  scheduleSave();
  renderSection();
}

async function confirmSection() {
  if (externalConflict) { showToast('资料在其他页面已改变，请刷新资料库后再确认。'); return; }
  if (!$('#review-check').checked) { showToast('请先勾选“我已逐项核对本页内容”。'); return; }
  // Validate the raw draft first: normalization must not discard an invalid
  // salary and then confirm the remaining section as though it were reviewed.
  if (activeSection === 'experience') {
    const invalid = invalidExperienceSalaryIndex();
    if (invalid !== -1) { showToast(`第${invalid + 1}段薪资请填写1–10位数字（元/月），或留空。`); return; }
  }
  profile = normalizeProfile(profile);
  if (activeSection === 'family' && !profile.familyDisclosureEnabled) { showToast('家庭信息使用已关闭。'); return; }
  if (activeSection === 'basic') {
    if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) { showToast('邮箱格式不正确，请修改后再确认。'); return; }
    if (profile.phone && !/^[+\d()\-\s]{6,25}$/.test(profile.phone)) { showToast('电话号码格式不正确，请修改后再确认。'); return; }
    if (profile.birthDate && !isCalendarDate(profile.birthDate)) { showToast('出生日期请填写真实的 YYYY-MM-DD 日期。'); return; }
    if (profile.height && !/^\d+(?:\.\d+)?$/.test(profile.height)) { showToast('身高请填写厘米数字，不要附带单位。'); return; }
  }
  if(activeSection==='experience'){
    applyLooseExperienceDates();
    const validDate=value=>!value||/^(?:19|20)\d{2}-(?:0[1-9]|1[0-2])$/u.test(value)||isCalendarDate(value);
    const bad=[];
    profile.experience.forEach((row,index)=>{
      for(const [field,label] of [['startDate','开始日期'],['endDate','结束日期']]){
        if(!validDate(row[field]))bad.push(`第${index+1}段${label}「${row[field]||''}」`);
      }
    });
    if(bad.length){showToast(`${bad.join('、')} 须为补零后的 YYYY-MM 或 YYYY-MM-DD（如 2022-09-01）。`);return;}
  }
  if (activeSection === 'education' || activeSection === 'experience') {
    if (profile[activeSection].some((row) => row.startDate && row.endDate && (activeSection==='experience'&&(row.startDate.length===7||row.endDate.length===7)?row.startDate.slice(0,7)>row.endDate.slice(0,7):row.startDate > row.endDate))) {
      showToast('有一段经历的结束月份早于开始月份，请核对。'); return;
    }
  }
  if (activeSection === 'custom') {
    if (profile.customFacts.some((item) => !item.question && item.answer)) {
      showToast('有答案缺少对应的网站问题原文，请补齐。'); return;
    }
    if(profile.customFacts.some((row,index)=>row.question&&profile.customFacts.some((other,otherIndex)=>otherIndex!==index&&questionScopesOverlap(row,other)))) { showToast('同一网站分区有重复问题，或同名问题范围不完整，请修改后再确认。'); return; }
    for (const fact of profile.customFacts) {
      const answerError = templateAnswerError(fact);
      if (answerError) { showToast(answerError); return; }
      const scope = [fact.sitePageUrl, fact.sectionName, fact.rowContext];
      if (!scope.some(Boolean)) continue;
      if (scope.some((value) => !value) || sitePageUrl(fact.sitePageUrl) !== fact.sitePageUrl
        || !['none', 'single'].includes(fact.rowContext)) {
        showToast('补充问答的网站页面、分区和重复行位置须完整且有效。'); return;
      }
    }
    const mappingKeys = new Set();
    for (const mapping of profile.siteOptionMappings) {
      const values = [mapping.siteUrlPrefix, mapping.fieldPath, mapping.sourceValue, mapping.optionText];
      if (!values.some(Boolean)) continue;
      if (values.some((value) => !value)) { showToast('每条网站选项对应都要填全四项。'); return; }
      if (!validSiteUrlPrefix(mapping.siteUrlPrefix)) {
        showToast('网站地址范围须是 HTTPS 地址、包含招聘方路径，并以 / 结尾。'); return;
      }
      if (mapping.fieldPath.startsWith('siteOptionMappings.')
        || !listFilledPaths(profile).includes(mapping.fieldPath)
        || !profile.confirmedFields.includes(mapping.fieldPath)
        || factAtPath(mapping.fieldPath) !== mapping.sourceValue) {
        showToast('原资料字段和值须与资料库中已核对的内容完全一致。'); return;
      }
      const key = JSON.stringify([mapping.siteUrlPrefix, mapping.fieldPath, mapping.sourceValue]);
      if (mappingKeys.has(key)) { showToast('同一网站、同一原资料只能有一个选项对应。'); return; }
      mappingKeys.add(key);
    }
  }
  if (activeSection === 'materials') {
    let file;
    try { file = await loadAttachment(); }
    catch (error) { showToast(error?.message || '本机附件读取失败，请重新选择。'); return; }
    if (!file || file.name !== profile.resumeAttachment?.name || file.size !== profile.resumeAttachment?.size || file.type !== profile.resumeAttachment?.type) {
      showToast('找不到与记录一致的本机文件，请重新选择后再确认。');
      return;
    }
  }
  const paths = sectionPaths(activeSection);
  if (!paths.length) { showToast('本页尚无可确认的资料。'); return; }
  const previousConfirmed = [...profile.confirmedFields];
  for (const path of paths) {
    if (!profile.confirmedFields.includes(path)) profile.confirmedFields.push(path);
    profile.sources[path] ||= 'manual';
  }
  clearTimeout(saveTimer);
  saveTimer = 0;
  const saved = await enqueueSave();
  if (!saved) { profile.confirmedFields = previousConfirmed; renderSection(); return; }
  renderSection();
  showToast('本页资料已确认，可供支持的网站使用。');
}

async function refreshSiteFactPanels(revision){
  if(!profile.education.length)return;
  const binding=await captureProfileBinding(chrome.storage.local),stored=await chrome.storage.local.get(['resumeProfile',SITE_FACTS_KEY]);
  if(await canonicalProfileHash(stored.resumeProfile)!==binding.profileHash)throw Error('profile_binding_changed');
  const active=await activeSiteFacts(stored.resumeProfile,binding,stored[SITE_FACTS_KEY]);
  await assertProfileBinding(chrome.storage.local,binding);
  if(activeSection!=='education'||revision!==sitePanelRevision||fingerprint(profile)!==fingerprint(stored.resumeProfile))return;
  for(let index=0;index<profile.education.length;index++){
    const panel=document.querySelector('[data-cms-site-panel="'+index+'"]');
    if(panel&&!panel.children.length)panel.innerHTML=renderRecordSiteFacts(profile,index,active.entries);
  }
}
async function saveCmsRecordFacts(index){
  const collected=collectRecordSiteFacts(document,index);
  if(!await flushSave())return;
  const binding=await captureProfileBinding(chrome.storage.local);
  const result=await withProfileBinding(chrome.storage.local,binding,async()=>{
    const stored=await chrome.storage.local.get(['resumeProfile',SITE_FACTS_KEY]);
    if(fingerprint(stored.resumeProfile)!==fingerprint(profile))throw Error('profile_binding_changed');
    const result=await confirmRecordSiteFacts(stored.resumeProfile,binding,index,collected.draft,stored[SITE_FACTS_KEY],{checked:collected.checked});
    if(!result.ok)return result;
    await chrome.storage.local.set({[SITE_FACTS_KEY]:result.store});return result;
  });
  const message=document.getElementById('cms-education-site-'+index+'-message');
  if(message)message.textContent=result.ok?'本段补充资料已核对并保存在本机。':({education_supplement_confirmation_required:'请先勾选已核对本段补充资料。',education_source_month_needs_review:'请先核对本段基础资料的年月格式。',education_full_date_must_match_source_month:'完整日期须有效，并与本段基础资料的年月一致。',education_date_order_invalid:'毕业日期不能早于入学日期。'}[result.reason]||'请检查省市是否填全，以及本段资料是否准确。');
}

async function persistAttachmentChange(snapshot,changeBody){
  const signature=fingerprint(snapshot);localWriteFingerprints.add(signature);
  const saved=await withProfileLifecycleLock(async()=>{
    const binding=await captureProfileBinding(chrome.storage.local),current=await loadProfile();
    if(binding.epoch!==profileEpoch||fingerprint(current)!==lastPersistedFingerprint){pauseForExternalConflict();throw Error('profile_binding_changed');}
    await changeBody();return saveProfile(snapshot);
  });
  profile=saved;lastPersistedFingerprint=fingerprint(saved);$('#save-state').textContent='草稿已保存在本机';
}

async function importJson(file) {
  if (!file) return;
  if (externalConflict) { showToast('资料在其他页面已改变，请刷新后再导入。'); return; }
  if (file.size > 1024 * 1024) { showToast('JSON 文件不能超过 1 MB。'); return; }
  try {
    const parsed = JSON.parse(await file.text());
    const fullBackup=parsed?.format==='resumeQuickFillProfileBackup'&&parsed.version===2;
    const preview=await restoreProfileBackup(parsed,crypto.randomUUID());
    if(!preview.ok||preview.profile.schemaVersion!==1)throw Error('backup_invalid');
    if (!window.confirm(fullBackup?'导入会替换当前资料。仅恢复本人备份，会保留该备份已核对状态及补充资料。附件文件正文不在备份中，需要重新选择。确认这是你的本人备份并继续吗？':'导入会替换当前资料。所有导入内容都会设为待核对，确认继续吗？')) return;
    if (!await flushSave()) return;
    profile = preview.profile;
    if (profile.resumeAttachment) profile.resumeAttachment.source = 'local-selection';
    profile.confirmedFields = fullBackup?profile.confirmedFields.filter(path=>path!=='resumeAttachment.name'):[];
    if(!fullBackup)profile.sources = Object.fromEntries(listFilledPaths(profile).map((path) => [path, 'import']));
    profileMutationInProgress=true;
    const signature=fingerprint(profile);localWriteFingerprints.add(signature);
    const replacement=await replaceProfileLifecycle(chrome.storage.local,'import',async({epoch})=>{
      const restored=await restoreProfileBackup(parsed,epoch);if(!restored.ok)throw Error('backup_invalid');
      await clearAttachment();const saved=await saveProfile(profile),ownerBinding=await ownerBindingFor(saved,epoch);
      const entries=fullBackup?await Promise.all(restored.store.entries.map(async entry=>({...entry,ownerBinding,
        sourceSnapshotHash:(await sourceSnapshot(saved,entry.profileIndex)).hash}))):[];
      await chrome.storage.local.set({[SITE_FACTS_KEY]:{version:1,entries}});return {saved,restoredFacts:entries.length};
    });
    profile=replacement.result.saved;profileEpoch=replacement.epoch;lastPersistedFingerprint=fingerprint(profile);
    profileMutationInProgress=false;externalConflict=false;
    renderSection();
    showToast(fullBackup?'导入完成：已恢复本人备份及 '+replacement.result.restoredFacts+' 条补充资料。附件需要重新选择。':'导入完成。请逐页核对后再用于填写。');
  } catch (error) {
    console.error('导入资料失败', error);
    showToast('导入失败：请使用有效的资料 JSON 文件。');
  } finally { profileMutationInProgress=false;$('#import-file').value = ''; }
}

async function exportJson() {
  if (!await flushSave()) { showToast('本机保存失败，请重试后再导出。'); return; }
  if (!window.confirm('导出的 JSON 包含个人资料。请妥善保管，继续导出吗？')) return;
  const binding=await captureProfileBinding(chrome.storage.local);
  const backup=await withProfileBinding(chrome.storage.local,binding,async()=>{
    const stored=await chrome.storage.local.get(['resumeProfile',SITE_FACTS_KEY]);
    return createProfileBackup(stored.resumeProfile,binding,stored[SITE_FACTS_KEY]);
  });
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = '简历快填-资料备份.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('已导出资料备份。');
}

async function deleteAll() {
  if (!window.confirm('确定删除此浏览器中的全部简历资料吗？此操作无法撤销；建议先导出备份。')) return;
  clearTimeout(saveTimer);
  saveTimer = 0;
  await saveQueue;
  deletingAll = true;
  try {
    await pendingQuestionWork;
    profileMutationInProgress=true;
    const replacement=await replaceProfileLifecycle(chrome.storage.local,'delete',async()=>{
      await clearAttachment();await clearProfile();
    });
    profileEpoch=replacement.epoch;
  }
  catch (error) { showToast(error?.message || '本机资料删除失败，请重试。'); return; }
  finally { deletingAll = false;profileMutationInProgress=false; }
  profile = emptyProfile();
  externalConflict = false;
  lastPersistedFingerprint = fingerprint(profile);
  activeSection = 'basic';
  renderSection();
  $('#save-state').textContent = '';
  showToast('本机资料已删除。');
}

function setView(view) {
  const showProfile = view === 'profile';
  $('#profile-view').hidden = !showProfile;
  $('#help-view').hidden = showProfile;
  document.querySelectorAll('[data-view]').forEach((button) => {
    const selected = button.dataset.view === view;
    button.classList.toggle('active', selected);
    if (selected) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
}

async function syncExternalProfile() {
  if (externalConflict || saveTimer) return;
  await saveQueue;
  if (externalConflict || saveTimer) return;
  try {
    const binding=await captureProfileBinding(chrome.storage.local),incoming = await loadProfile();
    const signature = fingerprint(incoming);
    if(binding.epoch!==profileEpoch){profileEpoch=binding.epoch;if(fingerprint(profile)!==lastPersistedFingerprint){pauseForExternalConflict();return;}}
    if (signature === fingerprint(profile)) return;
    if (fingerprint(profile) !== lastPersistedFingerprint) { pauseForExternalConflict(); return; }
    profile = incoming;
    lastPersistedFingerprint = signature;
    renderSection();
    showToast('已同步其他页面的新资料，请逐项核对。');
  } catch (error) { console.error('同步资料失败', error); }
}

function handleExternalProfileChange(incoming) {
  if(profileMutationInProgress||deletingAll)return;
  const signature = fingerprint(incoming);
  if (localWriteFingerprints.has(signature) || signature === fingerprint(profile)) return;
  if (saveTimer || fingerprint(profile) !== lastPersistedFingerprint) {
    pauseForExternalConflict();
    return;
  }
  syncExternalProfile();
}

function consumePendingQuestions() {
  if (deletingAll || typeof chrome === 'undefined' || !chrome.storage?.local) return Promise.resolve();
  pendingQuestionWork = pendingQuestionWork.then(async () => {
    if (deletingAll) return;
    const { resumePendingQuestions } = await chrome.storage.local.get('resumePendingQuestions');
    const questions = Array.isArray(resumePendingQuestions) ? resumePendingQuestions
      .map((item) => typeof item === 'string' ? { question: item } : item)
      .filter((item) => item && typeof item.question === 'string')
      .map((item) => ({
        question: item.question.replace(/[\s\u00a0]+/gu, ' ').trim(),
        sitePageUrl: sitePageUrl(item.sitePageUrl),
        sectionName: typeof item.sectionName === 'string' ? item.sectionName.trim().slice(0, 160) : '',
        rowContext: ['none', 'single'].includes(item.rowContext) ? item.rowContext : ''
      }))
      .filter((item) => item.question && item.question.length <= 200) : [];
    if (!questions.length) return;
    if (!await flushSave()) return;
    await syncExternalProfile();
    if (externalConflict) return;
    let added = 0;
    const remaining = [];
    for (const question of questions) {
      if (profile.customFacts.some(existing=>questionScopesOverlap(existing,question))) continue;
      if (profile.customFacts.length >= MAX_CUSTOM_FACTS) { remaining.push(question); continue; }
      preserveUniqueScopedConfirmations(profile,[...profile.customFacts,{...question,answer:''}]);
      profile.customFacts.push({ ...question, answer: '' });
      added += 1;
    }
    if (added) {
      activeSection = 'custom';
      setView('profile');
      if (!await enqueueSave()) { profile = await loadProfile(); renderSection(); return; }
      renderSection();
      showToast(`已记录 ${added} 个网站问题。请填写答案并确认本页资料。`);
    }
    if (remaining.length) {
      if (added) await chrome.storage.local.set({ resumePendingQuestions: remaining });
      else showToast(`补充问答已满 ${MAX_CUSTOM_FACTS} 条，请先整理资料库。`);
    } else {
      await chrome.storage.local.remove('resumePendingQuestions');
    }
  }).catch((error) => { console.error('读取待补充问题失败', error); });
  return pendingQuestionWork;
}

function consumeRequestedSection() {
  if (deletingAll || typeof chrome === 'undefined' || !chrome.storage?.local) return Promise.resolve();
  return chrome.storage.local.get('resumeRequestedSection').then(async ({ resumeRequestedSection }) => {
    if (!SECTION_ORDER.includes(resumeRequestedSection)) return;
    activeSection = resumeRequestedSection;
    setView('profile');
    renderSection();
    await chrome.storage.local.remove('resumeRequestedSection');
  }).catch((error) => { console.error('打开资料章节失败', error); });
}

function bindEvents() {
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
  $('#back-to-profile').addEventListener('click', () => setView('profile'));
  $('#section-buttons').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-section]');
    if (!button) return;
    await flushSave();
    activeSection = button.dataset.section;
    renderSection();
  });
  $('#go-materials').addEventListener('click', async () => { await flushSave(); activeSection = 'materials'; setView('profile'); renderSection(); });
  $('#profile-form').addEventListener('input', handleFieldChange);
  $('#profile-form').addEventListener('focusout', (event) => {
    const element = event.target;
    if (element?.dataset?.list !== 'experience' || !['startDate', 'endDate'].includes(element.dataset.field)) return;
    const padded = padLooseDate(element.value || '');
    if (padded === (element.value || '')) return;
    element.value = padded;
    handleFieldChange({ target: element });
  });
  $('#profile-form').addEventListener('change', async (event) => {
    if (event.target.id === 'family-enabled') {
      profile.familyDisclosureEnabled = event.target.checked;
      invalidatePrefix('familyMembers.');
      scheduleSave(); renderSection(); return;
    }
    if (event.target.id === 'resume-file') {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        await flushSave();
        const snapshot=structuredClone(profile);
        snapshot.confirmedFields=snapshot.confirmedFields.filter(path=>path!=='resumeAttachment.name');
        snapshot.resumeAttachment={name:file.name,size:file.size,type:file.type,source:'stored-local'};
        await persistAttachmentChange(snapshot,()=>saveAttachment(file));
      }
      catch (error) { showToast(error?.message || '本机附件保存失败。'); return; }
      renderSection(); return;
    }
    handleFieldChange(event);
  });
  $('#profile-form').addEventListener('click', async (event) => {
    const siteSave=event.target.closest('[data-cms-site-save]');if(siteSave){try{await saveCmsRecordFacts(Number(siteSave.dataset.cmsSiteSave));}catch{showToast('资料已改变，请刷新本页后重新核对补充资料。');}return;}
    if (event.target.closest('#add-cms-question-drafts')) {
      const result = appendCmsQuestionDrafts(profile.customFacts, MAX_CUSTOM_FACTS);preserveUniqueScopedConfirmations(profile,result.facts);
      if (result.added) { profile.customFacts = result.facts; syncCustomAnswers(); scheduleSave(); renderSection(); }
      showToast(result.added ? `已添加 ${result.added} 条空白问题${result.skipped ? '；已达本页容量，部分未添加' : ''}。已有答案保留，请填好后核对。` : '问题已在资料库中，或已达本页容量。');
      return;
    }
    if (event.target.closest('#seed-cms-basic-from-education')) {
      try {
        await flushSave();
        let siteFactEntries = [];
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          const stored = (await chrome.storage.local.get(SITE_FACTS_KEY))[SITE_FACTS_KEY];
          if (stored?.version === 1 && Array.isArray(stored.entries)) siteFactEntries = stored.entries;
        }
        const result = seedCmsBasicFromEducation(profile, { siteFactEntries });
        if (!result.ok && result.reason === 'education_row_not_ready') {
          showToast('没有已核对的教育经历（需学校+学历+专业均已核对），无法自动填充。');
          return;
        }
        profile = result.profile;
        syncCustomAnswers();
        scheduleSave();
        renderSection();
        const n = (result.seeded || []).filter((row) => row.status === 'seeded').length;
        const never = CMS_BASIC_NEVER_SEED.join('、');
        showToast(n
          ? `已从教育经历写入 ${n} 项个人基本信息并勾选已核对。仍需本人确认：${never}。`
          : `未写入新项（可能已存在或冲突）。仍需本人确认：${never}。`);
      } catch {
        showToast('从教育经历填充失败，请刷新资料页后重试。');
      }
      return;
    }
    const add = event.target.closest('[data-add]');
    const remove = event.target.closest('[data-remove]');
    if (add) addEntry(add.dataset.add);
    if (remove) removeEntry(remove.dataset.remove, Number(remove.dataset.index));
    if (event.target.id === 'remove-resume') {
      if (!window.confirm('删除本机保存的简历文件和附件记录？JSON 备份不含文件正文。')) return;
      try {
        if(!await flushSave())return;
        const snapshot=structuredClone(profile);snapshot.resumeAttachment=null;
        snapshot.confirmedFields=snapshot.confirmedFields.filter(path=>!path.startsWith('resumeAttachment.'));
        await persistAttachmentChange(snapshot,()=>clearAttachment());
      }catch(error){showToast('删除本机附件失败，请刷新资料后重试。');return;}
      renderSection();
    }
  });
  $('#save-draft-button').addEventListener('click', async () => { if (await flushSave()) showToast('草稿已保存在本机，尚未核对的资料不会自动填写。'); });
  $('#confirm-button').addEventListener('click', confirmSection);
  $('#import-button').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', (event) => importJson(event.target.files?.[0]));
  $('#export-button').addEventListener('click', exportJson);
  $('#clear-button').addEventListener('click', deleteAll);
}

async function init() {
  bindEvents();
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.resumePendingQuestions) consumePendingQuestions();
      if (area === 'local' && changes.resumeRequestedSection) consumeRequestedSection();
      if (area === 'local' && changes.resumeProfile) handleExternalProfileChange(changes.resumeProfile.newValue);
      if(area==='local'&&changes[PROFILE_EPOCH_KEY]&&!profileMutationInProgress&&!deletingAll){
        syncExternalProfile();
      }
    });
  }
  window.addEventListener('storage', (event) => {
    if (event.key === 'resumeProfile') {
      try { handleExternalProfileChange(JSON.parse(event.newValue || 'null')); }
      catch { syncExternalProfile(); }
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flushSave();
    else syncExternalProfile();
  });
  window.addEventListener('focus', syncExternalProfile);
  try { profile = await loadProfile(); }
  catch (error) { console.error('读取资料失败', error); showToast('读取本机资料失败，请检查扩展存储权限。'); }
  profileEpoch=(await captureProfileBinding(chrome.storage.local)).epoch;
  lastPersistedFingerprint = fingerprint(profile);
  renderSection();
  await consumeRequestedSection();
  await consumePendingQuestions();
}

init();
