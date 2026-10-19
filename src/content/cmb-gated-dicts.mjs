// Harvested CMB gated-field codes. Source: dist/site-probes/cmb-live-gated-harvest-20261019.json
// GET /api/socialRecruitmentWebsite/common/getCommonDictMap on 2026-10-19.
// Text+code only. Not a live fill contract. Never Save. 招行 is not supported.

const norm = (value) => String(value ?? '')
  .normalize('NFKC')
  .replace(/[\u200b-\u200d\ufeff]/gu, '')
  .replace(/[\s\u00a0]+/gu, ' ')
  .trim();

export const CMB_MARITAL_OPTIONS = Object.freeze([
  Object.freeze({"text":"未婚","code":"MS001"}),
  Object.freeze({"text":"已婚","code":"MS002"}),
  Object.freeze({"text":"离异","code":"MS004"}),
  Object.freeze({"text":"已育","code":"MS007"})
]);

export const CMB_POLITICS_OPTIONS = Object.freeze([
  Object.freeze({"text":"中国共产党党员","code":"PA001"}),
  Object.freeze({"text":"九三学社社员","code":"PA0010"}),
  Object.freeze({"text":"台湾民主自治同盟盟员","code":"PA0011"}),
  Object.freeze({"text":"无党派民主人士","code":"PA0012"}),
  Object.freeze({"text":"群众","code":"PA0013"}),
  Object.freeze({"text":"中国共产党预备党员","code":"PA002"}),
  Object.freeze({"text":"中国共产主义青年团团员","code":"PA003"}),
  Object.freeze({"text":"成员/中国国民党革命委员会","code":"PA004"}),
  Object.freeze({"text":"中国民主同盟盟员","code":"PA005"}),
  Object.freeze({"text":"成员/中国民主建国会","code":"PA006"}),
  Object.freeze({"text":"成员/中国民主促进会","code":"PA007"}),
  Object.freeze({"text":"党员/中国农工民主党","code":"PA008"}),
  Object.freeze({"text":"中国致公党党员","code":"PA009"})
]);

export const CMB_ETHNICITY_OPTIONS = Object.freeze([
  Object.freeze({"text":"汉族","code":"NA0017"}),
  Object.freeze({"text":"阿昌族","code":"NA001"}),
  Object.freeze({"text":"独龙族","code":"NA0010"}),
  Object.freeze({"text":"达翰尔族","code":"NA0011"}),
  Object.freeze({"text":"东乡族","code":"NA0012"}),
  Object.freeze({"text":"鄂温克族","code":"NA0013"}),
  Object.freeze({"text":"京族","code":"NA0014"}),
  Object.freeze({"text":"仡佬族","code":"NA0015"}),
  Object.freeze({"text":"高山族","code":"NA0016"}),
  Object.freeze({"text":"回族","code":"NA0018"}),
  Object.freeze({"text":"赫哲族","code":"NA0019"}),
  Object.freeze({"text":"白族","code":"NA002"}),
  Object.freeze({"text":"基诺族","code":"NA0020"}),
  Object.freeze({"text":"景颇族","code":"NA0021"}),
  Object.freeze({"text":"柯尔克孜族","code":"NA0022"}),
  Object.freeze({"text":"哈萨克族","code":"NA0023"}),
  Object.freeze({"text":"珞巴族","code":"NA0024"}),
  Object.freeze({"text":"拉祜族","code":"NA0025"}),
  Object.freeze({"text":"黎族","code":"NA0026"}),
  Object.freeze({"text":"傈僳族","code":"NA0027"}),
  Object.freeze({"text":"满族","code":"NA0028"}),
  Object.freeze({"text":"门巴族","code":"NA0029"}),
  Object.freeze({"text":"布朗族","code":"NA003"}),
  Object.freeze({"text":"蒙古族","code":"NA0030"}),
  Object.freeze({"text":"苗族","code":"NA0031"}),
  Object.freeze({"text":"仫佬族","code":"NA0032"}),
  Object.freeze({"text":"毛南族","code":"NA0033"}),
  Object.freeze({"text":"怒族","code":"NA0034"}),
  Object.freeze({"text":"纳西族","code":"NA0035"}),
  Object.freeze({"text":"鄂伦春族","code":"NA0036"}),
  Object.freeze({"text":"普米族","code":"NA0037"}),
  Object.freeze({"text":"羌族","code":"NA0038"}),
  Object.freeze({"text":"俄罗斯族","code":"NA0039"}),
  Object.freeze({"text":"保安族","code":"NA004"}),
  Object.freeze({"text":"畲族","code":"NA0040"}),
  Object.freeze({"text":"萨拉族","code":"NA0041"}),
  Object.freeze({"text":"水族","code":"NA0042"}),
  Object.freeze({"text":"塔吉克族","code":"NA0043"}),
  Object.freeze({"text":"土家族","code":"NA0044"}),
  Object.freeze({"text":"塔塔尔族","code":"NA0045"}),
  Object.freeze({"text":"土族","code":"NA0046"}),
  Object.freeze({"text":"维吾尔族","code":"NA0047"}),
  Object.freeze({"text":"乌孜别克族","code":"NA0048"}),
  Object.freeze({"text":"佤族","code":"NA0049"}),
  Object.freeze({"text":"布依族","code":"NA005"}),
  Object.freeze({"text":"锡伯族","code":"NA0050"}),
  Object.freeze({"text":"瑶族","code":"NA0051"}),
  Object.freeze({"text":"裕固族","code":"NA0052"}),
  Object.freeze({"text":"彝族","code":"NA0053"}),
  Object.freeze({"text":"藏族","code":"NA0054"}),
  Object.freeze({"text":"壮族","code":"NA0055"}),
  Object.freeze({"text":"其他","code":"NA0056"}),
  Object.freeze({"text":"哈尼族","code":"NA0057"}),
  Object.freeze({"text":"朝鲜族","code":"NA006"}),
  Object.freeze({"text":"傣族","code":"NA007"}),
  Object.freeze({"text":"德昂族","code":"NA008"}),
  Object.freeze({"text":"侗族","code":"NA009"})
]);

export const CMB_MARITAL_SELECT_ID = 'resume_basicInfo_maritalStatus';
export const CMB_MARITAL_LIST_ID = 'resume_basicInfo_maritalStatus_list';
export const CMB_POLITICS_SELECT_ID = 'resume_basicInfo_politicalAffinity';
export const CMB_POLITICS_LIST_ID = 'resume_basicInfo_politicalAffinity_list';
export const CMB_ETHNICITY_SELECT_ID = 'resume_basicInfo_nation';
export const CMB_ETHNICITY_LIST_ID = 'resume_basicInfo_nation_list';

/** IdCardType from cmb-dictmap-full-20261019.json. No 请选择 row. Text+code only. */
export const CMB_ID_CARD_TYPE_OPTIONS = Object.freeze([
  Object.freeze({"text":"身份证","code":"ID001"}),
  Object.freeze({"text":"非公务赴台证","code":"ID0010"}),
  Object.freeze({"text":"台胞证","code":"ID0011"}),
  Object.freeze({"text":"签证 1","code":"ID0012"}),
  Object.freeze({"text":"签证 2","code":"ID0013"}),
  Object.freeze({"text":"签证 3","code":"ID0014"}),
  Object.freeze({"text":"其他证件","code":"ID0015"}),
  Object.freeze({"text":"暂住证","code":"ID002"}),
  Object.freeze({"text":"人才居住证","code":"ID003"}),
  Object.freeze({"text":"因公护照","code":"ID004"}),
  Object.freeze({"text":"因私护照","code":"ID005"}),
  Object.freeze({"text":"公务赴港澳长证(多次)","code":"ID006"}),
  Object.freeze({"text":"非公务赴港澳长证","code":"ID007"}),
  Object.freeze({"text":"临时赴港澳证","code":"ID008"}),
  Object.freeze({"text":"公务赴台证","code":"ID009"})
]);

/** Harvested 2026-10-19. Select class has no show-search. Live click is not claimed. */
export const CMB_ID_CARD_TYPE_SELECT_ID = 'resume_basicInfo_idCardType';
export const CMB_ID_CARD_TYPE_LIST_ID = 'resume_basicInfo_idCardType_list';

/**
 * Education from cmb-dictmap-full-20261019.json.
 * ED000（博士后）is dropped as a placeholder. Text+code only.
 * Only education history row 0 was harvested.
 */
export const CMB_EDUCATION_LEVEL_OPTIONS = Object.freeze([
  Object.freeze({"text":"博士研究生","code":"ED001"}),
  Object.freeze({"text":"MBA","code":"ED002"}),
  Object.freeze({"text":"硕士研究生","code":"ED003"}),
  Object.freeze({"text":"本科","code":"ED004"}),
  Object.freeze({"text":"大专","code":"ED005"}),
  Object.freeze({"text":"中技（中专/技校/职高）","code":"ED006"}),
  Object.freeze({"text":"高中","code":"ED007"})
]);

/** Harvested 2026-10-19. List id comes from aria-controls. Live click is not claimed. */
export const CMB_EDUCATION_LEVEL_SELECT_ID = 'resume_educationHistoryList_0_educationLevelCode';
export const CMB_EDUCATION_LEVEL_LIST_ID = 'resume_educationHistoryList_0_educationLevelCode_list';

/**
 * RelationshipType from cmb-dictmap-full-20261019.json.
 * Eight rows, no 请选择 and no placeholder code. Text+code only.
 * Row 0 and row 1 are separate harvested selects. A value for one index
 * is never written to the other.
 */
export const CMB_RELATIONSHIP_TYPE_OPTIONS = Object.freeze([
  Object.freeze({"text":"配偶","code":"RT0001"}),
  Object.freeze({"text":"父亲","code":"RT0002"}),
  Object.freeze({"text":"母亲","code":"RT0003"}),
  Object.freeze({"text":"子女","code":"RT0004"}),
  Object.freeze({"text":"紧急联络人","code":"RT0005"}),
  Object.freeze({"text":"兄弟","code":"RT0006"}),
  Object.freeze({"text":"姐妹","code":"RT0007"}),
  Object.freeze({"text":"其他相关人员","code":"RT0008"})
]);

/** Harvested 2026-10-19. List ids come from aria-controls. Live click is not claimed. */
export const CMB_RELATIONSHIP_TYPE_SELECT_ID = 'resume_familyList_0_relationship';
export const CMB_RELATIONSHIP_TYPE_LIST_ID = 'resume_familyList_0_relationship_list';
export const CMB_RELATIONSHIP_TYPE_ROW1_SELECT_ID = 'resume_familyList_1_relationship';
export const CMB_RELATIONSHIP_TYPE_ROW1_LIST_ID = 'resume_familyList_1_relationship_list';

/**
 * AwardsLevel from cmb-dictmap-full-20261019.json.
 * Five rows, AL002–AL006. No 请选择 and no AL000/AL001 placeholder.
 * Level is never inferred from an award name. Only award row 0 was harvested.
 */
export const CMB_AWARD_LEVEL_OPTIONS = Object.freeze([
  Object.freeze({"text":"院校级","code":"AL002"}),
  Object.freeze({"text":"县市级","code":"AL003"}),
  Object.freeze({"text":"省区级","code":"AL004"}),
  Object.freeze({"text":"国家级","code":"AL005"}),
  Object.freeze({"text":"国际级","code":"AL006"})
]);

/** Harvested 2026-10-19. List id comes from aria-controls. Live click is not claimed. */
export const CMB_AWARD_LEVEL_SELECT_ID = 'resume_awardList_0_awardLevel';
export const CMB_AWARD_LEVEL_LIST_ID = 'resume_awardList_0_awardLevel_list';

/**
 * EnglishLevel from cmb-dictmap-full-20261019.json.
 * Ten rows, EL001–EL010. No 请选择 and no EL000. EL010（其他）is a real row.
 * A colloquial name or a score is not converted into one of these exams.
 * Only skill row 0 was harvested.
 */
export const CMB_ENGLISH_LEVEL_OPTIONS = Object.freeze([
  Object.freeze({"text":"TOEFL","code":"EL001"}),
  Object.freeze({"text":"GRE","code":"EL002"}),
  Object.freeze({"text":"GMAT","code":"EL003"}),
  Object.freeze({"text":"IELTS","code":"EL004"}),
  Object.freeze({"text":"CET-4","code":"EL005"}),
  Object.freeze({"text":"CET-6","code":"EL006"}),
  Object.freeze({"text":"TEM-4","code":"EL007"}),
  Object.freeze({"text":"TEM-8","code":"EL008"}),
  Object.freeze({"text":"海外高中成绩","code":"EL009"}),
  Object.freeze({"text":"其他","code":"EL010"})
]);

/** Harvested 2026-10-19. List id comes from aria-controls. Live click is not claimed. */
export const CMB_ENGLISH_LEVEL_SELECT_ID = 'resume_skill_0_englishLevel';
export const CMB_ENGLISH_LEVEL_LIST_ID = 'resume_skill_0_englishLevel_list';

/**
 * ChannelType from cmb-dictmap-full-20261019.json.
 * Fifteen rows. No 请选择 and no CT000. CT0016（其他）is a real row.
 * Names stay exact, including the quotation marks on the WeChat row.
 * A shorter name is not merged into a longer one. Live click is not claimed.
 */
export const CMB_CHANNEL_TYPE_OPTIONS = Object.freeze([
  Object.freeze({"text":"招商银行官网","code":"CT0014"}),
  Object.freeze({"text":"\"招商银行招聘\"微信公众号","code":"CT002"}),
  Object.freeze({"text":"招商银行员工推荐","code":"CT0015"}),
  Object.freeze({"text":"院校老师推荐","code":"CT007"}),
  Object.freeze({"text":"校园宣讲会","code":"CT0012"}),
  Object.freeze({"text":"学校就业网站","code":"CT0010"}),
  Object.freeze({"text":"校友/朋友推荐","code":"CT008"}),
  Object.freeze({"text":"智联招聘","code":"CT0017"}),
  Object.freeze({"text":"牛客网","code":"CT0011"}),
  Object.freeze({"text":"刺猬实习","code":"CT0019"}),
  Object.freeze({"text":"51job/应届生网","code":"CT005"}),
  Object.freeze({"text":"qq群/微信群消息","code":"CT009"}),
  Object.freeze({"text":"猎头","code":"CT0013"}),
  Object.freeze({"text":"一网通","code":"CT001"}),
  Object.freeze({"text":"其他","code":"CT0016"})
]);

/** Harvested 2026-10-19. List id comes from aria-controls. Live click is not claimed. */
export const CMB_CHANNEL_TYPE_SELECT_ID = 'resume_basicInfo_channelType';
export const CMB_CHANNEL_TYPE_LIST_ID = 'resume_basicInfo_channelType_list';

/** Kind + fill hint only. No synthetic DatePicker DOM. */
export const CMB_BIRTHDATE_HINT = Object.freeze({
  key: 'birthDate',
  label: '出生日期',
  kind: 'DatePicker',
  selectId: 'resume_basicInfo_birthday',
  placeholder: '请选择日期',
  readOnly: true,
  fillHint: 'antd DatePicker readonly; format likely YYYY-MM-DD; Never Save',
  syntheticDom: false,
  liveFillClaimed: false
});

/** Exact harvested Chinese text or exact code. 请选择 and abbreviations do not match. */
export function resolveCmbCodedOption(options, raw) {
  const text = norm(raw);
  if (!text || text === '请选择') return null;
  const hit = options.find((row) => norm(row.text) === text || row.code === text);
  return hit ? { text: hit.text, code: hit.code } : null;
}
