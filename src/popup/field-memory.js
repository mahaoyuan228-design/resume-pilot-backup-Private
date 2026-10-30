import '../core/matcher.js';
import '../core/domain-memory.js';

const M = globalThis.ResumeMatcher;
const memory = globalThis.ResumeDomainMemory;
const fieldLabels = {
  fullName: '姓名', identityNumber: '证件号码', gender: '性别', birthDate: '出生日期', email: '邮箱', phone: '手机号码',
  height: '身高', selfEvaluation: '自我评价', currentCity: '现居城市', desiredRoles: '意向岗位', desiredCities: '意向城市',
  expectedSalary: '期望薪资', availableDate: '到岗时间', availabilityNote: '到岗说明', workStart: '参加工作时间',
  school: '学校', degree: '学历', major: '专业', startDate: '开始时间', endDate: '结束时间', majorCategory: '专业类别',
  unifiedAdmissions: '是否统招', campusActivities: '校园活动', gradeRank: '专业排名', majorDescription: '专业描述', gpa: '平均绩点',
  schoolLocation: '学校所在地', type: '经历类型', organization: '公司或单位', position: '职位', description: '内容描述',
  jobCategory: '职位类别', industry: '所属行业', workArea: '工作地点', companyIntro: '公司介绍', department: '部门',
  reportTo: '汇报对象', subordinateCount: '下属人数', leaveReason: '离职原因', salary: '月薪', name: '项目名称', role: '项目角色'
};
export function profileKeyLabel(path) {
  const parts = path.split('.');
  if (parts.length === 1) return fieldLabels[path];
  const collection = { education: '教育', experience: '工作／实习', projects: '项目' }[parts[0]];
  return `${collection}第 ${Number(parts[1]) + 1} 段 · ${fieldLabels[parts[2]]}`;
}

export function mappingChoices(profile, metadata) {
  const kind = M.sectionKind(metadata?.section);
  if (kind === 'certificate') return [];
  const index = metadata?.index;
  const collection = kind === 'education' ? 'education' : kind === 'project' ? 'projects'
    : ['work', 'internship'].includes(kind) ? 'experience' : null;
  return [...new Set(profile?.confirmedFields || [])].filter(path => {
    if (!M.isProfileKey(path)) return false;
    if (collection) return Number.isInteger(index) && path.startsWith(`${collection}.${index}.`);
    return memory.mappingFits(metadata, path);
  });
}

// A blank choice and an explicit button keep inspection/filling from training
// memory. Option labels contain schema paths, never the applicant's answers.
export function appendFieldMemoryControl(parent, { field, profile, confirm, document: doc = document }) {
  if (!field?.mappingContext || !['input', 'textarea', 'select', 'radio'].includes(field.kind)
    || (!['unknown_question', 'unmapped_repeat_field', 'section_unconfirmed'].includes(field.reason)
      && field.semanticSource !== 'confirmed_domain_mapping')) return null;
  const choices = mappingChoices(profile, field.mappingContext);
  if (!choices.length) return null;
  const wrapper = doc.createElement('div'); wrapper.className = 'field-memory';
  const label = doc.createElement('label'); label.textContent = '此题对应哪项资料';
  const select = doc.createElement('select'); select.setAttribute('aria-label', `${field.labels?.[0] || field.id}对应的资料`);
  const blank = doc.createElement('option'); blank.value = ''; blank.textContent = '请选择资料项'; select.append(blank);
  for (const path of choices) {
    const option = doc.createElement('option'); option.value = path; option.textContent = profileKeyLabel(path); select.append(option);
  }
  const button = doc.createElement('button'); button.type = 'button'; button.className = 'add-question';
  button.textContent = '确认并记住本页对应'; button.disabled = true;
  const note = doc.createElement('small'); note.textContent = '只记题目和资料项对应，确认后请重新识别。';
  let pending = false;
  select.addEventListener('change', () => { button.disabled = pending || !choices.includes(select.value); });
  button.addEventListener('click', async () => {
    if (pending || !choices.includes(select.value)) return;
    pending = true; button.disabled = true; select.disabled = true;
    try { await confirm(select.value); note.textContent = '对应已确认，请重新识别。'; }
    catch (error) { note.textContent = error?.message || '对应未保存，请重新识别后再确认。'; pending = false; select.disabled = false; button.disabled = false; }
  });
  label.append(select); wrapper.append(label, button, note); parent.append(wrapper);
  return { wrapper, select, button, note };
}

export async function confirmFieldMapping(api, { tabId, url, field, profileKey }) {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (tab?.id !== tabId || tab.url !== url) throw Error('网页已变化，请重新识别。');
  const record = await api.storage.local.get('resumeProfile');
  const profile = record.resumeProfile;
  if (!mappingChoices(profile, field.mappingContext).includes(profileKey)) throw Error('资料项尚未确认或已变化。');
  const reply = await api.tabs.sendMessage(tabId, { type: 'RESUME_INSPECT', profile });
  const peers = reply?.ok && reply.data?.url === url ? reply.data.fields?.filter(item => item.id === field.id) : [];
  if (peers?.length !== 1 || !peers[0].mappingContext
    || memory.fieldSignature(peers[0].mappingContext) !== memory.fieldSignature(field.mappingContext)) throw Error('网站题目或选项已变化，请重新识别。');
  const [stillActive] = await api.tabs.query({ active: true, currentWindow: true });
  if (stillActive?.id !== tabId || stillActive.url !== url) throw Error('网页已变化，请重新识别。');
  await memory.confirm(api.storage.local, url, field.mappingContext, profileKey, { confirmed: true, source: 'user' });
}
