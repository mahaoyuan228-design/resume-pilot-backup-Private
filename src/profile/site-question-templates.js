// Public website questions only. No applicant answers or default selections.
import {questionScopesOverlap} from './store.js';
export const CMS_QUESTION_PAGE = 'https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html';
export const RESEARCH_CHOICES = Object.freeze([
  '非研究类岗位，不涉及', '宏观', '策略', '债券', '银行', '非银行金融', '房地产',
  '量化', '基金评价', '金属及材料（有色金属）', '化工', '交通运输', '生物医药',
  '汽车', '机械', '军工', '电力设备及新能源', '建材', '食品饮料', '轻工纺服',
  '纺服化妆品', '农林牧渔', '家电', '商业（零售+社会服务）', '电子', '传媒',
  '通信', '计算机', '中小盘', '环保及公用事业', '煤炭开采', '智库研究'
]);
const make = (sectionName, question, kind = 'text', alias = question) =>
  Object.freeze({ sectionName, question, kind, alias, sitePageUrl: CMS_QUESTION_PAGE, rowContext: 'single' });
export const CMS_QUESTION_TEMPLATES = Object.freeze([
  make('个人基本信息必填', '学位', 'text', '__cms_basic_academic_degree'),
  make('个人基本信息必填', '学历', 'text', '__cms_basic_education_level'),
  make('个人基本信息必填', '毕业院校'),
  make('个人基本信息必填', '专业名称', 'text', '__cms_basic_major'),
  make('个人基本信息必填', '毕业时间', 'date', '__cms_basic_graduation_date'),
  make('个人基本信息必填', '现居住地', 'region'),
  make('个人基本信息必填', '籍贯', 'region'),
  make('个人基本信息必填', '国籍/地区'),
  make('个人基本信息必填', '婚姻状况'),
  make('个人基本信息必填', '期望面试地点（供参考，实际安排将根据笔试通过名单确定）'),
  make('求职意向必填', '期望工作性质'),
  make('求职意向必填', '期望年薪'),
  make('求职意向必填', '到岗时间'),
  make('求职意向必填', '期望工作地是否服从分配'),
  make('求职意向必填', '意向一期望工作地点', 'region'),
  make('求职意向必填', '意向二期望工作地点', 'region'),
  make('求职意向必填', '如应聘研究发展中心行业研究类岗位请勾选（建议仅勾选3~5项）', 'checkbox'),
  make('教育经历必填', '学位', 'text', '__cms_education_academic_degree'),
  make('教育经历必填', '专业排名'),
  make('教育经历必填', '城市', 'region'),
  make('英语能力必填', '英语证书名称'),
  make('英语能力必填', '获得时间', 'date', '__cms_english_certificate_date'),
  ...['证券从业资格考试', '注册会计师考试', '国家司法考试', 'FRM', 'CFA']
    .map(question => make('获取的资格或通过的考试必填', question))
]);

export function templateForFact(fact) {
  return CMS_QUESTION_TEMPLATES.find(item => item.alias === fact?.question
    && item.sitePageUrl === fact.sitePageUrl && item.sectionName === fact.sectionName
    && item.rowContext === fact.rowContext) || null;
}

// Explicit user action only; opening/upgrading the extension must not change facts.
export function appendCmsQuestionDrafts(facts, limit = 100) {
  const result = structuredClone(facts || []);
  let added = 0, skipped = 0;
  for (const item of CMS_QUESTION_TEMPLATES) {
    const draft={question:item.alias,answer:'',sitePageUrl:item.sitePageUrl,sectionName:item.sectionName,rowContext:item.rowContext};
    if(result.some(row=>questionScopesOverlap(row,draft)))continue;
    if (result.length >= limit) { skipped++; continue; }
    result.push(draft);added++;
  }
  return { facts: result, added, skipped };
}

export function regionAnswer(province, city) {
  const values = [province, city].map(value => String(value || '').trim());
  return values.some(Boolean) ? JSON.stringify({ province: values[0], city: values[1] }) : '';
}
export function researchAnswer(selected) {
  if (!Array.isArray(selected) || selected.some(value => !RESEARCH_CHOICES.includes(value))
    || new Set(selected).size !== selected.length) throw Error('invalid_research_choices');
  return selected.length ? JSON.stringify(selected) : '';
}
export function templateAnswerError(fact) {
  const spec = templateForFact(fact), answer = String(fact?.answer || '').trim();
  if (!spec || !answer) return '';
  if (spec.kind === 'region') {
    try {
      const pair = JSON.parse(answer);
      if (pair && !Array.isArray(pair) && Object.keys(pair).sort().join('|') === 'city|province'
        && ['province', 'city'].every(key => typeof pair[key] === 'string' && pair[key].trim()
          && pair[key].length <= 160 && !/[\u0000-\u001f]/u.test(pair[key]))) return '';
    } catch { /* Shown as a normal validation message. */ }
    return `${spec.question}：请把省份和城市都填全，或同时留空。`;
  }
  if (spec.kind === 'checkbox') {
    try {
      const selected = JSON.parse(answer);
      researchAnswer(selected);
      if (selected.length && !(selected.includes(RESEARCH_CHOICES[0]) && selected.length > 1)) return '';
    } catch { /* No speculative correction. */ }
    return '研究方向：请选择网站实际选项；“非研究类岗位，不涉及”须单独选择。';
  }
  if (spec.kind === 'date') {
    const date = /^\d{4}-\d{2}-\d{2}$/u.test(answer) ? new Date(`${answer}T00:00:00Z`) : null;
    if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== answer)
      return `${spec.question}：请填写完整有效日期，不能自动猜测日。`;
  }
  return '';
}
