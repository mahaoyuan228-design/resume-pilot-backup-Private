// CMB (招商银行 career.cmbchina.com) first-slice basic fill (fill-without-save).
// Isolated siteId: cmb. Never clicks 保存/提交. Never touches CMS/GTH/citics/feishu.
//
// First slice fields (labels from CDP bodyText 2026-10-18 /center/resume):
//   姓名 (text) · 手机号 (text) · 邮箱 (text)
// 姓名 is the basicInfo control when the label is unique.
// Live /center/resume has three 姓名 labels (basicInfo + family rows 0 and 1).
// Several hits scope to the harvested id resume_basicInfo_name only.
// Family ids resume_familyList_0_name and resume_familyList_1_name are never written.
// Zero or several basicInfo hits fail closed (no write). Never Save.
// Gender (性别) is offline/synthetic only: 男 / 女 inside one label-scoped form item.
// Live radio DOM was NOT harvested. Class names are public CSS candidates only.
// Height (身高) is offline/synthetic text only. The label may include a CM suffix.
// The written value is numeric centimeters. Never write a CM suffix into the value.
// Live height label string and input DOM were NOT harvested.
// Weight (体重) is offline/synthetic text only. The label may include a KG suffix.
// The written value is numeric kilograms. Never write a KG suffix into the value.
// Live weight label string and input DOM were NOT harvested.
// Formal work (是否参加过正式工作) is offline/synthetic radio only: 是 / 否.
// Those two words come from the field map, not a harvested live option list.
// Label scope is one .ant-form-item. Live radio DOM was NOT harvested.
//
// Marital / politics / ethnicity selects are offline synthetic stand-ins.
// Option text and codes come from the 2026-10-19 getCommonDictMap harvest.
// The option-row markup is not a live dropdown contract. --live still refuses.
// Birth date (#resume_basicInfo_birthday) is an Ant Design DatePicker.
// The input is readonly. The fill opens that picker and clicks the documented
// panel. It does not type a date and it does not claim the site is supported.
//
// DOM contract (CSS-confirmed in public main.02cda64a.css; live form layout unproven):
//   `.ant-form-item` + `.ant-form-item-label` + `input.ant-input`
// Gender candidates (public CSS only, synthetic fixture, not a live contract):
//   `.ant-form-item` scoped by label 性别 + `.ant-radio-wrapper` + `.ant-radio`
// Height reuses the text path above (synthetic fixture, not a live contract):
//   `.ant-form-item` scoped by label 身高, optional CM suffix, + `input.ant-input`
// Weight reuses the text path above (synthetic fixture, not a live contract):
//   `.ant-form-item` scoped by label 体重, optional KG suffix, + `input.ant-input`
// Formal-work candidates (public CSS only, synthetic fixture, not a live contract):
//   `.ant-form-item` scoped by label 是否参加过正式工作 + `.ant-radio-wrapper` + `.ant-radio`
// CDP fingerprint wrongly flagged vue; public bundle is React createRoot + ant-design.
// Hard warning: page copy says 姓名/证件* 保存后不可再改 — Never Save is mandatory.
(() => {
  const previous = globalThis.ResumeCmbBasic;
  if (previous?.listener) {
    try { chrome.runtime.onMessage.removeListener(previous.listener); } catch {}
  }

  const SITE_ID = 'cmb';
  const TEXT_LABELS = ['姓名', '手机号', '邮箱'];
  const BASIC_NAME_LABEL = '姓名';
  // Harvested ids. cmb-remaining-dom-ids-20261019.json labelText is 姓名 on each.
  // Not a new selector. Family name controls stay out of the basic fill.
  const BASIC_NAME_INPUT_ID = 'resume_basicInfo_name';
  const FAMILY_NAME_INPUT_IDS = Object.freeze([
    'resume_familyList_0_name',
    'resume_familyList_1_name'
  ]);
  const GENDER_LABEL = '性别';
  const GENDER_VALUES = ['男', '女'];
  const HEIGHT_LABEL = '身高';
  /** Digits only. A CM suffix is rejected so the unit is never written into the value. */
  const HEIGHT_VALUE_RE = /^\d+(?:\.\d+)?$/u;
  /** 身高, or 身高 plus an optional CM suffix. Not a harvested live label string. */
  const HEIGHT_LABEL_RE = /^身高(?:\s*(?:[（(]\s*)?cm(?:\s*[）)])?)?$/iu;
  const WEIGHT_LABEL = '体重';
  /** Digits only. A KG suffix is rejected so the unit is never written into the value. */
  const WEIGHT_VALUE_RE = /^\d+(?:\.\d+)?$/u;
  /** 体重, or 体重 plus an optional KG suffix. Not a harvested live label string. */
  const WEIGHT_LABEL_RE = /^体重(?:\s*(?:[（(]\s*)?kg(?:\s*[）)])?)?$/iu;
  const FORMAL_WORK_LABEL = '是否参加过正式工作';
  const FORMAL_WORK_VALUES = ['是', '否'];
  // Requested values that are ambiguous, unsupported, or unsettled.
  // They stay failed rows. They are not omitted from a successful fill.
  const REQUESTED_FILL_FAIL_CLOSED = new Set([
    'item_ambiguous',
    'radio_readback_ambiguous',
    'select_readback_ambiguous',
    'datepicker_hint_only',
    'birthdate_unparseable',
    'birthdate_input_missing',
    'birthdate_target_ambiguous',
    'birthdate_panel_missing',
    'birthdate_panel_multiple',
    'birthdate_cell_missing',
    'birthdate_cell_disabled',
    'birthdate_readback_mismatch',
    'profile_fact_unconfirmed',
    'invalid_profile_value'
  ]);
  /** Harvested text+code tables. Same data as cmb-gated-dicts.mjs. Not a live click contract. */
  const GATED_DICTS = JSON.parse('{"maritalStatus":[{"text":"未婚","code":"MS001"},{"text":"已婚","code":"MS002"},{"text":"离异","code":"MS004"},{"text":"已育","code":"MS007"}],"politics":[{"text":"中国共产党党员","code":"PA001"},{"text":"九三学社社员","code":"PA0010"},{"text":"台湾民主自治同盟盟员","code":"PA0011"},{"text":"无党派民主人士","code":"PA0012"},{"text":"群众","code":"PA0013"},{"text":"中国共产党预备党员","code":"PA002"},{"text":"中国共产主义青年团团员","code":"PA003"},{"text":"成员/中国国民党革命委员会","code":"PA004"},{"text":"中国民主同盟盟员","code":"PA005"},{"text":"成员/中国民主建国会","code":"PA006"},{"text":"成员/中国民主促进会","code":"PA007"},{"text":"党员/中国农工民主党","code":"PA008"},{"text":"中国致公党党员","code":"PA009"}],"ethnicity":[{"text":"汉族","code":"NA0017"},{"text":"阿昌族","code":"NA001"},{"text":"独龙族","code":"NA0010"},{"text":"达翰尔族","code":"NA0011"},{"text":"东乡族","code":"NA0012"},{"text":"鄂温克族","code":"NA0013"},{"text":"京族","code":"NA0014"},{"text":"仡佬族","code":"NA0015"},{"text":"高山族","code":"NA0016"},{"text":"回族","code":"NA0018"},{"text":"赫哲族","code":"NA0019"},{"text":"白族","code":"NA002"},{"text":"基诺族","code":"NA0020"},{"text":"景颇族","code":"NA0021"},{"text":"柯尔克孜族","code":"NA0022"},{"text":"哈萨克族","code":"NA0023"},{"text":"珞巴族","code":"NA0024"},{"text":"拉祜族","code":"NA0025"},{"text":"黎族","code":"NA0026"},{"text":"傈僳族","code":"NA0027"},{"text":"满族","code":"NA0028"},{"text":"门巴族","code":"NA0029"},{"text":"布朗族","code":"NA003"},{"text":"蒙古族","code":"NA0030"},{"text":"苗族","code":"NA0031"},{"text":"仫佬族","code":"NA0032"},{"text":"毛南族","code":"NA0033"},{"text":"怒族","code":"NA0034"},{"text":"纳西族","code":"NA0035"},{"text":"鄂伦春族","code":"NA0036"},{"text":"普米族","code":"NA0037"},{"text":"羌族","code":"NA0038"},{"text":"俄罗斯族","code":"NA0039"},{"text":"保安族","code":"NA004"},{"text":"畲族","code":"NA0040"},{"text":"萨拉族","code":"NA0041"},{"text":"水族","code":"NA0042"},{"text":"塔吉克族","code":"NA0043"},{"text":"土家族","code":"NA0044"},{"text":"塔塔尔族","code":"NA0045"},{"text":"土族","code":"NA0046"},{"text":"维吾尔族","code":"NA0047"},{"text":"乌孜别克族","code":"NA0048"},{"text":"佤族","code":"NA0049"},{"text":"布依族","code":"NA005"},{"text":"锡伯族","code":"NA0050"},{"text":"瑶族","code":"NA0051"},{"text":"裕固族","code":"NA0052"},{"text":"彝族","code":"NA0053"},{"text":"藏族","code":"NA0054"},{"text":"壮族","code":"NA0055"},{"text":"其他","code":"NA0056"},{"text":"哈尼族","code":"NA0057"},{"text":"朝鲜族","code":"NA006"},{"text":"傣族","code":"NA007"},{"text":"德昂族","code":"NA008"},{"text":"侗族","code":"NA009"}],"idCardType":[{"text":"身份证","code":"ID001"},{"text":"非公务赴台证","code":"ID0010"},{"text":"台胞证","code":"ID0011"},{"text":"签证 1","code":"ID0012"},{"text":"签证 2","code":"ID0013"},{"text":"签证 3","code":"ID0014"},{"text":"其他证件","code":"ID0015"},{"text":"暂住证","code":"ID002"},{"text":"人才居住证","code":"ID003"},{"text":"因公护照","code":"ID004"},{"text":"因私护照","code":"ID005"},{"text":"公务赴港澳长证(多次)","code":"ID006"},{"text":"非公务赴港澳长证","code":"ID007"},{"text":"临时赴港澳证","code":"ID008"},{"text":"公务赴台证","code":"ID009"}],"educationLevel":[{"text":"博士后","code":"ED000"},{"text":"博士研究生","code":"ED001"},{"text":"MBA","code":"ED002"},{"text":"硕士研究生","code":"ED003"},{"text":"本科","code":"ED004"},{"text":"大专","code":"ED005"},{"text":"中技（中专/技校/职高）","code":"ED006"},{"text":"高中","code":"ED007"}],"relationshipType":[{"text":"配偶","code":"RT0001"},{"text":"父亲","code":"RT0002"},{"text":"母亲","code":"RT0003"},{"text":"子女","code":"RT0004"},{"text":"紧急联络人","code":"RT0005"},{"text":"兄弟","code":"RT0006"},{"text":"姐妹","code":"RT0007"},{"text":"其他相关人员","code":"RT0008"}],"awardLevel":[{"text":"院校级","code":"AL002"},{"text":"县市级","code":"AL003"},{"text":"省区级","code":"AL004"},{"text":"国家级","code":"AL005"},{"text":"国际级","code":"AL006"}],"englishLevel":[{"text":"TOEFL","code":"EL001"},{"text":"GRE","code":"EL002"},{"text":"GMAT","code":"EL003"},{"text":"IELTS","code":"EL004"},{"text":"CET-4","code":"EL005"},{"text":"CET-6","code":"EL006"},{"text":"TEM-4","code":"EL007"},{"text":"TEM-8","code":"EL008"},{"text":"海外高中成绩","code":"EL009"},{"text":"其他","code":"EL010"}],"channelType":[{"text":"招商银行官网","code":"CT0014"},{"text":"\\"招商银行招聘\\"微信公众号","code":"CT002"},{"text":"招商银行员工推荐","code":"CT0015"},{"text":"院校老师推荐","code":"CT007"},{"text":"校园宣讲会","code":"CT0012"},{"text":"学校就业网站","code":"CT0010"},{"text":"校友/朋友推荐","code":"CT008"},{"text":"智联招聘","code":"CT0017"},{"text":"牛客网","code":"CT0011"},{"text":"刺猬实习","code":"CT0019"},{"text":"51job/应届生网","code":"CT005"},{"text":"qq群/微信群消息","code":"CT009"},{"text":"猎头","code":"CT0013"},{"text":"一网通","code":"CT001"},{"text":"其他","code":"CT0016"}],"interviewCity":[{"text":"北京市","code":"P00271"},{"text":"长春市","code":"C0035"},{"text":"长沙市","code":"C00164"},{"text":"成都市","code":"C00216"},{"text":"大连市","code":"C10002"},{"text":"东莞市","code":"C00194"},{"text":"佛山市","code":"C00182"},{"text":"福州市","code":"C0097"},{"text":"广州市","code":"C00178"},{"text":"贵阳市","code":"C00237"},{"text":"哈尔滨市","code":"C0044"},{"text":"海口市","code":"C00213"},{"text":"杭州市","code":"C0070"},{"text":"合肥市","code":"C0081"},{"text":"呼和浩特市","code":"C0023"},{"text":"济南市","code":"C00117"},{"text":"昆明市","code":"C00246"},{"text":"兰州市","code":"C00279"},{"text":"南昌市","code":"C00106"},{"text":"南京市","code":"C0057"},{"text":"南宁市","code":"C00199"},{"text":"南通市","code":"C0062"},{"text":"宁波市","code":"C0071"},{"text":"青岛市","code":"C00118"},{"text":"泉州市","code":"C0099"},{"text":"上海市","code":"P00281"},{"text":"深圳市","code":"C00179"},{"text":"沈阳市","code":"C10001"},{"text":"石家庄市","code":"C001"},{"text":"苏州市","code":"C0061"},{"text":"太原市","code":"C0012"},{"text":"唐山市","code":"C002"},{"text":"天津市","code":"P00301"},{"text":"温州市","code":"C0072"},{"text":"乌鲁木齐市","code":"C00306"},{"text":"无锡市","code":"C0058"},{"text":"武汉市","code":"C00151"},{"text":"西安市","code":"C00269"},{"text":"西宁市","code":"C00293"},{"text":"厦门市","code":"C00100"},{"text":"烟台市","code":"C00122"},{"text":"银川市","code":"C00301"},{"text":"郑州市","code":"C00134"},{"text":"重庆市","code":"P00291"}]}');
  /** CSS-confirmed ant-design classes in public main.02cda64a.css — live resume DOM may still differ. */
  const ITEM_SEL = '.ant-form-item';
  const LABEL_SEL = '.ant-form-item-label, label';
  const INPUT_SEL = 'input.ant-input, input[type="text"], input[type="tel"], input[type="email"], input:not([type])';
  /** Public CSS candidates only. Not harvested from a logged-in resume. */
  const RADIO_WRAP_SEL = '.ant-radio-wrapper';
  const RADIO_MARK_SEL = '.ant-radio';

  const norm = (value) => String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200d\ufeff]/gu, '')
    .replace(/[\s\u00a0]+/gu, ' ')
    .trim();
  const cleanLabel = (value) => norm(value).replace(/^\*\s*/u, '').replace(/\s*\*$/u, '').replace(/[：:]\s*$/u, '').trim();
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function isCmbHost(hostname = location.hostname) {
    return String(hostname || '').toLowerCase() === 'career.cmbchina.com';
  }

  function onCmbResumeEditPage(url = location.href) {
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
      if (!isCmbHost(u.hostname)) return false;
      return u.pathname === '/center/resume' || u.pathname.startsWith('/center/resume/');
    } catch {
      return false;
    }
  }

  function pageAllowed(options) {
    if (onCmbResumeEditPage()) return true;
    if (options?.synthetic !== true) return false;
    return location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  }

  function labelText(node) {
    if (!node) return '';
    const clone = node.cloneNode(true);
    clone.querySelectorAll('span,i,svg,em').forEach((child) => {
      const t = norm(child.textContent);
      if (!t || t === '*' || t === '：') child.remove();
    });
    return cleanLabel(clone.textContent);
  }

  function formItems() {
    return [...document.querySelectorAll(ITEM_SEL)];
  }

  function matchingItems(wanted) {
    const want = cleanLabel(wanted);
    return formItems().filter((item) => {
      const label = item.querySelector(LABEL_SEL);
      return label && labelText(label) === want;
    });
  }

  function associatedIds(item) {
    const ids = new Set();
    if (item?.id) ids.add(item.id);
    item?.querySelectorAll?.('[id]').forEach((node) => {
      if (node.id) ids.add(node.id);
    });
    item?.querySelectorAll?.('label').forEach((node) => {
      const forId = node.getAttribute('for');
      if (forId) ids.add(forId);
    });
    return ids;
  }

  function isFamilyNameItem(item) {
    const ids = associatedIds(item);
    return FAMILY_NAME_INPUT_IDS.some((id) => ids.has(id));
  }

  function isBasicNameItem(item) {
    return associatedIds(item).has(BASIC_NAME_INPUT_ID);
  }

  /**
   * One 姓名 label is the basic field unless that item is a harvested family name.
   * Several 姓名 labels scope to the single harvested basicInfo id.
   * Still zero or many after that scope → no item. Never write a family 姓名.
   */
  function resolveBasicName(hits) {
    if (hits.length === 0) return { item: null, reason: 'item_not_found', scoped: false };
    const notFamily = hits.filter((item) => !isFamilyNameItem(item));
    if (hits.length === 1) {
      if (notFamily.length === 1) return { item: notFamily[0], reason: null, scoped: false };
      return { item: null, reason: 'item_not_found', scoped: false };
    }
    const scoped = notFamily.filter((item) => isBasicNameItem(item));
    if (scoped.length === 1) return { item: scoped[0], reason: null, scoped: true };
    return { item: null, reason: 'item_ambiguous', scoped: true };
  }

  function locateItem(wanted) {
    const hits = matchingItems(wanted);
    if (cleanLabel(wanted) === BASIC_NAME_LABEL) return resolveBasicName(hits);
    if (hits.length === 1) return { item: hits[0], reason: null, scoped: false };
    return { item: null, reason: 'item_not_found', scoped: false };
  }

  function findItem(wanted) {
    return locateItem(wanted).item;
  }

  function isHeightLabel(text) {
    return HEIGHT_LABEL_RE.test(cleanLabel(text));
  }

  function findHeightItem() {
    const hits = formItems().filter((item) => {
      const label = item.querySelector(LABEL_SEL);
      return label && isHeightLabel(labelText(label));
    });
    return hits.length === 1 ? hits[0] : null;
  }

  function isWeightLabel(text) {
    return WEIGHT_LABEL_RE.test(cleanLabel(text));
  }

  function findWeightItem() {
    const hits = formItems().filter((item) => {
      const label = item.querySelector(LABEL_SEL);
      return label && isWeightLabel(labelText(label));
    });
    return hits.length === 1 ? hits[0] : null;
  }

  function textControl(item) {
    const inputs = [...item.querySelectorAll(INPUT_SEL)].filter((node) => {
      if (node.type === 'hidden' || node.type === 'radio' || node.type === 'checkbox') return false;
      if (node.disabled) return false;
      const style = getComputedStyle(node);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
    return inputs.length === 1 ? inputs[0] : null;
  }

  function setNativeValue(input, value) {
    const proto = Object.getPrototypeOf(input);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value')
      || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (desc?.set) desc.set.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function readText(item) {
    const control = textControl(item);
    return control ? norm(control.value) : '';
  }

  // Check the existing control and its ancestors before any control click.
  // These guards do not supply a new live DOM contract.
  function controlAvailable(node) {
    if (!node?.isConnected) return false;
    for (let current = node; current?.nodeType === 1; current = current.parentElement) {
      if (current.hidden || current.disabled || current.hasAttribute('inert')
        || current.getAttribute('aria-hidden') === 'true' || current.getAttribute('aria-disabled') === 'true') return false;
      const style = getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    }
    return true;
  }

  function genderOptions(item) {
    return [...item.querySelectorAll(RADIO_WRAP_SEL)].map((wrap) => {
      const mark = wrap.querySelector(RADIO_MARK_SEL);
      const control = wrap.querySelector('input[type="radio"]');
      const clone = wrap.cloneNode(true);
      clone.querySelectorAll(RADIO_MARK_SEL).forEach((node) => node.remove());
      return { wrap, mark, control, text: norm(clone.textContent) };
    });
  }

  function genderStructureOk(options) {
    if (options.length !== 2) return false;
    const texts = new Set(options.map((row) => row.text));
    if (texts.size !== 2 || !texts.has('男') || !texts.has('女')) return false;
    return options.every((row) => row.mark && row.control && row.control.type === 'radio'
      && row.wrap.tagName === 'LABEL' && row.wrap.control === row.control
      && norm(row.control.value) === row.text
      && row.wrap.querySelectorAll(RADIO_MARK_SEL).length === 1
      && row.wrap.querySelectorAll('input[type="radio"]').length === 1
      && controlAvailable(row.wrap) && controlAvailable(row.control)) && radioGroupIsolated(options);
  }

  function radioGroupIsolated(options) {
    const controls = options.map((row) => row.control);
    if (new Set(controls.map((control) => control.name)).size !== 1) return false;
    if (new Set(controls.map((control) => control.form)).size !== 1) return false;
    return controls.every((control) => !control.name || ![...document.querySelectorAll('input[type="radio"]')]
      .some((other) => !controls.includes(other) && other.name === control.name && other.form === control.form));
  }

  function readGender(item) {
    const options = genderOptions(item);
    if (!genderStructureOk(options)) return { ok: false, value: '', reason: 'radio_structure_changed' };
    const checked = options.filter((row) => row.control.checked);
    if (checked.length > 1) return { ok: false, value: '', reason: 'radio_readback_ambiguous' };
    return { ok: true, value: checked[0]?.text || '', reason: checked.length ? 'checked' : 'empty' };
  }

  async function fillGender(value, options = {}) {
    const want = norm(value);
    const base = {
      label: GENDER_LABEL,
      saved: false,
      skippedSave: true,
      supported: false,
      liveSupportClaimed: false,
      writeAttempted: false,
      expected: want,
      before: '',
      after: ''
    };
    if (!pageAllowed(options)) return { ...base, ok: false, reason: 'wrong_page' };
    if (!GENDER_VALUES.includes(want)) {
      return { ...base, ok: false, reason: 'invalid_profile_value' };
    }
    const hits = matchingItems(GENDER_LABEL);
    if (hits.length !== 1) return { ...base, ok: false, reason: hits.length ? 'item_ambiguous' : 'item_not_found' };
    const item = hits[0];
    const radios = genderOptions(item);
    if (!genderStructureOk(radios)) {
      return { ...base, ok: false, reason: 'radio_structure_changed' };
    }
    const beforeRead = readGender(item);
    if (!beforeRead.ok) return { ...base, ok: false, reason: beforeRead.reason };
    const before = beforeRead.ok ? beforeRead.value : '';
    const target = radios.find((row) => row.text === want);
    if (!target) {
      return { ...base, ok: false, reason: 'option_not_found', before, after: before };
    }
    if (isUnsafeClick(target.wrap) || isUnsafeClick(target.control)) {
      return { ...base, ok: false, reason: 'unsafe_control', before, after: before };
    }
    if (before === want) return { ...base, ok: true, reason: 'matched', before, after: before };
    target.control.click();
    await pause(80);
    const afterItems = matchingItems(GENDER_LABEL);
    if (afterItems.length !== 1) {
      return { ...base, ok: false, reason: afterItems.length ? 'item_ambiguous' : 'item_not_found', before, writeAttempted: true };
    }
    const afterRead = readGender(afterItems[0]);
    const after = afterRead.ok ? afterRead.value : '';
    const matched = afterRead.ok && after === want;
    return {
      ...base,
      writeAttempted: true,
      ok: matched,
      reason: matched ? 'matched' : (afterRead.ok ? 'readback_mismatch' : afterRead.reason),
      before,
      after
    };
  }

  function formalWorkOptions(item) {
    return [...item.querySelectorAll(RADIO_WRAP_SEL)].map((wrap) => {
      const mark = wrap.querySelector(RADIO_MARK_SEL);
      const control = wrap.querySelector('input[type="radio"]');
      const clone = wrap.cloneNode(true);
      clone.querySelectorAll(RADIO_MARK_SEL).forEach((node) => node.remove());
      return { wrap, mark, control, text: norm(clone.textContent) };
    });
  }

  function formalWorkStructureOk(options) {
    if (options.length !== 2) return false;
    const texts = new Set(options.map((row) => row.text));
    if (texts.size !== 2 || !texts.has('是') || !texts.has('否')) return false;
    return options.every((row) => row.mark && row.control && row.control.type === 'radio'
      && row.wrap.tagName === 'LABEL' && row.wrap.control === row.control
      && norm(row.control.value) === row.text
      && row.wrap.querySelectorAll(RADIO_MARK_SEL).length === 1
      && row.wrap.querySelectorAll('input[type="radio"]').length === 1
      && controlAvailable(row.wrap) && controlAvailable(row.control)) && radioGroupIsolated(options);
  }

  function readFormalWork(item) {
    const options = formalWorkOptions(item);
    if (!formalWorkStructureOk(options)) return { ok: false, value: '', reason: 'radio_structure_changed' };
    const checked = options.filter((row) => row.control.checked);
    if (checked.length > 1) return { ok: false, value: '', reason: 'radio_readback_ambiguous' };
    return { ok: true, value: checked[0]?.text || '', reason: checked.length ? 'checked' : 'empty' };
  }

  async function fillFormalWork(value, options = {}) {
    const want = norm(value);
    const base = {
      label: FORMAL_WORK_LABEL,
      saved: false,
      skippedSave: true,
      supported: false,
      liveSupportClaimed: false,
      writeAttempted: false,
      expected: want,
      before: '',
      after: ''
    };
    if (!pageAllowed(options)) return { ...base, ok: false, reason: 'wrong_page' };
    if (!FORMAL_WORK_VALUES.includes(want)) {
      return { ...base, ok: false, reason: 'invalid_profile_value' };
    }
    const hits = matchingItems(FORMAL_WORK_LABEL);
    if (hits.length !== 1) return { ...base, ok: false, reason: hits.length ? 'item_ambiguous' : 'item_not_found' };
    const item = findItem(FORMAL_WORK_LABEL);
    const radios = formalWorkOptions(item);
    if (!formalWorkStructureOk(radios)) {
      return { ...base, ok: false, reason: 'radio_structure_changed' };
    }
    const beforeRead = readFormalWork(item);
    if (!beforeRead.ok) return { ...base, ok: false, reason: beforeRead.reason };
    const before = beforeRead.ok ? beforeRead.value : '';
    const target = radios.find((row) => row.text === want);
    if (!target) {
      return { ...base, ok: false, reason: 'option_not_found', before, after: before };
    }
    if (isUnsafeClick(target.wrap) || isUnsafeClick(target.control)) {
      return { ...base, ok: false, reason: 'unsafe_control', before, after: before };
    }
    if (before === want) return { ...base, ok: true, reason: 'matched', before, after: before };
    target.control.click();
    await pause(80);
    const afterItems = matchingItems(FORMAL_WORK_LABEL);
    if (afterItems.length !== 1) {
      return { ...base, ok: false, reason: afterItems.length ? 'item_ambiguous' : 'item_not_found', before, writeAttempted: true };
    }
    const afterRead = readFormalWork(afterItems[0]);
    const after = afterRead.ok ? afterRead.value : '';
    const matched = afterRead.ok && after === want;
    return {
      ...base,
      writeAttempted: true,
      ok: matched,
      reason: matched ? 'matched' : (afterRead.ok ? 'readback_mismatch' : afterRead.reason),
      before,
      after
    };
  }

  async function fillHeight(value, options = {}) {
    const raw = norm(value);
    const want = HEIGHT_VALUE_RE.test(raw) ? raw : '';
    const base = {
      label: HEIGHT_LABEL,
      saved: false,
      skippedSave: true,
      expected: want || raw,
      before: '',
      after: ''
    };
    if (!pageAllowed(options)) return { ...base, ok: false, reason: 'wrong_page' };
    if (!want) return { ...base, ok: false, reason: 'invalid_profile_value', expected: raw };
    const item = findHeightItem();
    if (!item) return { ...base, ok: false, reason: 'item_not_found' };
    const control = textControl(item);
    if (!control) return { ...base, ok: false, reason: 'control_not_found' };
    const before = norm(control.value);
    control.focus();
    setNativeValue(control, want);
    await pause(80);
    const after = readText(item);
    const matched = after === want && !/cm/iu.test(after);
    return {
      ...base,
      ok: matched,
      reason: matched ? 'matched' : 'readback_mismatch',
      before,
      after,
      expected: want
    };
  }

  async function fillWeight(value, options = {}) {
    const raw = norm(value);
    const want = WEIGHT_VALUE_RE.test(raw) ? raw : '';
    const base = {
      label: WEIGHT_LABEL,
      saved: false,
      skippedSave: true,
      expected: want || raw,
      before: '',
      after: ''
    };
    if (!pageAllowed(options)) return { ...base, ok: false, reason: 'wrong_page' };
    if (!want) return { ...base, ok: false, reason: 'invalid_profile_value', expected: raw };
    const item = findWeightItem();
    if (!item) return { ...base, ok: false, reason: 'item_not_found' };
    const control = textControl(item);
    if (!control) return { ...base, ok: false, reason: 'control_not_found' };
    const before = norm(control.value);
    control.focus();
    setNativeValue(control, want);
    await pause(80);
    const after = readText(item);
    const matched = after === want && !/kg/iu.test(after);
    return {
      ...base,
      ok: matched,
      reason: matched ? 'matched' : 'readback_mismatch',
      before,
      after,
      expected: want
    };
  }

  const MARITAL_LABEL = '婚姻状况';
  const MARITAL_LABEL_RE = /^婚姻状况(?:（可选）|\(可选\))?$/u;
  const POLITICS_LABEL = '政治面貌';
  const ETHNICITY_LABEL = '民族';
  const ID_CARD_TYPE_LABEL = '证件类型';
  // Harvested ids. selectClass has no show-search. Live click evidence is on file.
  // 证件号 resume_basicInfo_idCard is a text field and is not filled here.
  const ID_CARD_TYPE_SELECT_ID = 'resume_basicInfo_idCardType';
  const ID_CARD_TYPE_LIST_ID = 'resume_basicInfo_idCardType_list';
  const EDUCATION_LEVEL_LABEL = '学历';
  // Harvested row 0 only. List id is the aria-controls value. Live click evidence is on file.
  // Live options keep 博士后 ED000. The synthetic fixture may omit it and is not the live full set.
  // School name and the other education controls are not filled.
  const EDUCATION_LEVEL_SELECT_ID = 'resume_educationHistoryList_0_educationLevelCode';
  const EDUCATION_LEVEL_LIST_ID = 'resume_educationHistoryList_0_educationLevelCode_list';
  const RELATIONSHIP_TYPE_LABEL = '关系类型';
  // Harvested family rows 0 and 1. Each select id is filled only by its own key.
  // Eight RelationshipType rows. No placeholder. Family name and phone are not filled.
  // Basic 姓名 never writes resume_familyList_0_name or resume_familyList_1_name.
  // Live click confirms resume_familyList_0_relationship and resume_familyList_1_relationship.
  const RELATIONSHIP_TYPE_SELECT_ID = 'resume_familyList_0_relationship';
  const RELATIONSHIP_TYPE_LIST_ID = 'resume_familyList_0_relationship_list';
  const RELATIONSHIP_TYPE_ROW1_SELECT_ID = 'resume_familyList_1_relationship';
  const RELATIONSHIP_TYPE_ROW1_LIST_ID = 'resume_familyList_1_relationship_list';
  const AWARD_LEVEL_LABEL = '获奖级别';
  // Harvested award row 0 only. Level is exact text or code, never an award name.
  // Award name, honor type, and award date are not filled.
  // Live click confirms resume_awardList_0_awardLevel.
  const AWARD_LEVEL_SELECT_ID = 'resume_awardList_0_awardLevel';
  const AWARD_LEVEL_LIST_ID = 'resume_awardList_0_awardLevel_list';
  const ENGLISH_LEVEL_LABEL = '最高英语水平';
  // Harvested skill row 0 only. Exact exam name or code. No score conversion.
  // EL010（其他）is kept. The score control is not filled.
  // Live click confirms resume_skill_0_englishLevel.
  const ENGLISH_LEVEL_SELECT_ID = 'resume_skill_0_englishLevel';
  const ENGLISH_LEVEL_LIST_ID = 'resume_skill_0_englishLevel_list';
  const CHANNEL_TYPE_LABEL = '招聘信息来源';
  // Harvested basicInfo select. Exact name or code. No abbreviation merge.
  // CT0016（其他）is kept. The quoted WeChat name stays exact. Live click evidence is on file.
  const CHANNEL_TYPE_SELECT_ID = 'resume_basicInfo_channelType';
  const CHANNEL_TYPE_LIST_ID = 'resume_basicInfo_channelType_list';
  const INTERVIEW_CITY_LABEL = '面试期望城市';
  // Harvested basicInfo select. Exact full city name or code. 北京 does not match 北京市.
  // Forty-four InterviewCity rows. No placeholder. Live click evidence is on file.
  const INTERVIEW_CITY_SELECT_ID = 'resume_basicInfo_expectedInterviewCity';
  const INTERVIEW_CITY_LIST_ID = 'resume_basicInfo_expectedInterviewCity_list';
  const BIRTHDATE_HINT = Object.freeze({
    key: 'birthDate',
    label: '出生日期',
    kind: 'DatePicker',
    selectId: 'resume_basicInfo_birthday',
    placeholder: '请选择日期',
    readOnly: true,
    fillHint: 'antd DatePicker readonly; format likely YYYY-MM-DD; Never Save',
    syntheticDom: false,
    liveFillClaimed: false,
    saveAllowed: false
  });
  const SELECT_SPECS = {
    maritalStatus: {
      label: MARITAL_LABEL,
      labelTest: (text) => MARITAL_LABEL_RE.test(text),
      selectId: 'resume_basicInfo_maritalStatus',
      listId: 'resume_basicInfo_maritalStatus_list',
      options: GATED_DICTS.maritalStatus,
      showSearch: false
    },
    politics: {
      label: POLITICS_LABEL,
      labelTest: (text) => text === POLITICS_LABEL,
      selectId: 'resume_basicInfo_politicalAffinity',
      listId: 'resume_basicInfo_politicalAffinity_list',
      options: GATED_DICTS.politics,
      showSearch: false
    },
    ethnicity: {
      label: ETHNICITY_LABEL,
      labelTest: (text) => text === ETHNICITY_LABEL,
      selectId: 'resume_basicInfo_nation',
      listId: 'resume_basicInfo_nation_list',
      options: GATED_DICTS.ethnicity,
      // Live click 2026-10-19: the control has ant-select-show-search.
      showSearch: true
    },
    idCardType: {
      label: ID_CARD_TYPE_LABEL,
      labelTest: (text) => text === ID_CARD_TYPE_LABEL,
      selectId: ID_CARD_TYPE_SELECT_ID,
      listId: ID_CARD_TYPE_LIST_ID,
      options: GATED_DICTS.idCardType,
      showSearch: false
    },
    educationLevel: {
      label: EDUCATION_LEVEL_LABEL,
      labelTest: (text) => text === EDUCATION_LEVEL_LABEL,
      selectId: EDUCATION_LEVEL_SELECT_ID,
      listId: EDUCATION_LEVEL_LIST_ID,
      options: GATED_DICTS.educationLevel,
      showSearch: false,
      allowOptionSubset: true
    },
    relationshipType: {
      label: RELATIONSHIP_TYPE_LABEL,
      labelTest: (text) => text === RELATIONSHIP_TYPE_LABEL,
      selectId: RELATIONSHIP_TYPE_SELECT_ID,
      listId: RELATIONSHIP_TYPE_LIST_ID,
      options: GATED_DICTS.relationshipType,
      showSearch: false,
      rowScoped: true,
      rowIndex: 0
    },
    relationshipTypeRow1: {
      label: RELATIONSHIP_TYPE_LABEL,
      labelTest: (text) => text === RELATIONSHIP_TYPE_LABEL,
      selectId: RELATIONSHIP_TYPE_ROW1_SELECT_ID,
      listId: RELATIONSHIP_TYPE_ROW1_LIST_ID,
      options: GATED_DICTS.relationshipType,
      showSearch: false,
      rowScoped: true,
      rowIndex: 1
    },
    awardLevel: {
      label: AWARD_LEVEL_LABEL,
      labelTest: (text) => text === AWARD_LEVEL_LABEL,
      selectId: AWARD_LEVEL_SELECT_ID,
      listId: AWARD_LEVEL_LIST_ID,
      options: GATED_DICTS.awardLevel,
      showSearch: false
    },
    englishLevel: {
      label: ENGLISH_LEVEL_LABEL,
      labelTest: (text) => text === ENGLISH_LEVEL_LABEL,
      selectId: ENGLISH_LEVEL_SELECT_ID,
      listId: ENGLISH_LEVEL_LIST_ID,
      options: GATED_DICTS.englishLevel,
      showSearch: false
    },
    channelType: {
      label: CHANNEL_TYPE_LABEL,
      labelTest: (text) => text === CHANNEL_TYPE_LABEL,
      selectId: CHANNEL_TYPE_SELECT_ID,
      listId: CHANNEL_TYPE_LIST_ID,
      options: GATED_DICTS.channelType,
      showSearch: false
    },
    interviewCity: {
      label: INTERVIEW_CITY_LABEL,
      labelTest: (text) => text === INTERVIEW_CITY_LABEL,
      selectId: INTERVIEW_CITY_SELECT_ID,
      listId: INTERVIEW_CITY_LIST_ID,
      options: GATED_DICTS.interviewCity,
      showSearch: false
    }
  };
  // Residual selects from cmb-remaining-dom-ids-20261019.json. Observe only
  // these existing controls; this does not supply portal dropdown markup.
  const PRIMARY_SELECT_IDS = new Set([
    EDUCATION_LEVEL_SELECT_ID, RELATIONSHIP_TYPE_SELECT_ID, RELATIONSHIP_TYPE_ROW1_SELECT_ID,
    AWARD_LEVEL_SELECT_ID, ENGLISH_LEVEL_SELECT_ID, CHANNEL_TYPE_SELECT_ID, INTERVIEW_CITY_SELECT_ID
  ]);

  function primarySelectNeighbors(excludedId) {
    return [...document.querySelectorAll('[id]')]
      .filter((node) => node.id !== excludedId && PRIMARY_SELECT_IDS.has(node.id))
      .map((node) => {
        const root = node.closest('.ant-select');
        const item = root?.closest(ITEM_SEL);
        const spec = Object.values(SELECT_SPECS).find((candidate) => candidate.selectId === node.id);
        return {
          id: node.id, node, root,
          state: JSON.stringify(root ? {
            structureOk: Boolean(item && selectStructureOk(item, spec)),
            controls: node.getAttribute('aria-controls'),
            lists: [...root.querySelectorAll('[role="listbox"]')].map((list) => list.id),
            available: controlAvailable(root),
            disabled: root.classList.contains('ant-select-disabled'),
            shown: [...root.querySelectorAll('.ant-select-selection-item')]
              .map((shown) => [shown.textContent, shown.getAttribute('data-code')]),
            rows: [...root.querySelectorAll('[role="option"]')]
              .map((row) => [row.textContent, row.getAttribute('data-code'), row.getAttribute('aria-selected')]),
            search: [...root.querySelectorAll('input.ant-select-selection-search-input')]
              .map((search) => [search.value, search.disabled, search.readOnly])
          } : null)
        };
      });
  }

  function changedPrimarySelectNeighbors(before, excludedId) {
    const after = primarySelectNeighbors(excludedId);
    const oldNodes = new Map(before.map((row, index) => [row.node, { row, index }]));
    const newNodes = new Map(after.map((row, index) => [row.node, { row, index }]));
    const changed = [];
    for (const [index, row] of before.entries()) {
      const current = newNodes.get(row.node);
      if (!current || current.index !== index || current.row.root !== row.root || current.row.state !== row.state) changed.push(row.id);
    }
    for (const row of after) if (!oldNodes.has(row.node)) changed.push(row.id);
    // Report IDs only. Neighbor values stay private to this readback check.
    return [...new Set(changed)];
  }

  function resolveCodedOption(options, raw) {
    const text = norm(raw);
    if (!text || text === '请选择') return null;
    const hit = options.find((row) => norm(row.text) === text || row.code === text);
    return hit ? { text: hit.text, code: hit.code } : null;
  }

  function findItemByLabel(labelTest) {
    const hits = formItems().filter((item) => {
      const label = item.querySelector(LABEL_SEL);
      return label && labelTest(labelText(label));
    });
    return hits.length === 1 ? hits[0] : null;
  }

  function selectIdMatches(item, selectId) {
    const root = item.querySelector('.ant-select');
    if (!root) return false;
    if (root.id === selectId) return true;
    return [...root.querySelectorAll('[id]')].some((node) => node.id === selectId);
  }

  function locateCodedItem(spec) {
    const hits = formItems().filter((item) => {
      const label = item.querySelector(LABEL_SEL);
      if (!label || !spec.labelTest(labelText(label))) return false;
      if (!spec.rowScoped) return true;
      return selectIdMatches(item, spec.selectId);
    });
    return hits.length === 1
      ? { item: hits[0], reason: null }
      : { item: null, reason: hits.length ? 'item_ambiguous' : 'item_not_found' };
  }

  function selectRows(item) {
    return [...item.querySelectorAll('[role="option"]')].map((node) => ({
      node,
      text: norm(node.textContent),
      code: norm(node.getAttribute('data-code'))
    }));
  }

  function optionSetMatches(found, expected, allowSubset) {
    if (found.length === 0) return false;
    const keys = new Set(found.map((row) => `${row.text}\t${row.code}`));
    if (keys.size !== found.length) return false;
    if (!allowSubset) {
      if (found.length !== expected.length) return false;
      return expected.every((row) => keys.has(`${norm(row.text)}\t${row.code}`));
    }
    if (found.length > expected.length) return false;
    const expectedKeys = new Set(expected.map((row) => `${norm(row.text)}\t${row.code}`));
    return [...keys].every((key) => expectedKeys.has(key));
  }

  function selectStructureOk(item, spec) {
    const root = item.querySelector('.ant-select');
    if (!root || item.querySelectorAll('.ant-select').length !== 1 || !selectIdMatches(item, spec.selectId)) return false;
    if ([...document.querySelectorAll('[id]')].filter((node) => node.id === spec.selectId).length !== 1) return false;
    const showSearch = root.classList.contains('ant-select-show-search') || root.dataset.showSearch === 'true';
    if (showSearch !== spec.showSearch) return false;
    const list = item.querySelector('[role="listbox"]');
    if (!list || list.id !== spec.listId || item.querySelectorAll('[role="listbox"]').length !== 1) return false;
    if (!root.contains(list) || [...document.querySelectorAll('[id]')].filter((node) => node.id === spec.listId).length !== 1) return false;
    if (item.querySelectorAll('.ant-select-selection-item').length !== 1
      || !root.contains(item.querySelector('.ant-select-selection-item'))) return false;
    const search = [...item.querySelectorAll('input.ant-select-selection-search-input')];
    if (spec.showSearch) {
      if (search.length !== 1 || search[0].type !== 'search' || !root.contains(search[0])) return false;
    } else if (search.length !== 0) return false;
    const rows = selectRows(item);
    return rows.every((row) => list.contains(row.node))
      && optionSetMatches(rows, spec.options, spec.allowOptionSubset === true);
  }

  function readCodedSelect(item, spec) {
    if (!selectStructureOk(item, spec)) {
      return { ok: false, value: '', code: '', reason: 'select_structure_changed' };
    }
    const shown = item.querySelector('.ant-select-selection-item');
    const text = norm(shown.textContent);
    const code = norm(shown.getAttribute('data-code'));
    const selected = selectRows(item).filter((row) => row.node.getAttribute('aria-selected') === 'true');
    if (!text && !code && selected.length === 0) return { ok: true, value: '', code: '', reason: 'empty' };
    const row = spec.options.find((option) => norm(option.text) === text && option.code === code);
    if (!row || selected.length !== 1 || norm(selected[0].text) !== text || selected[0].code !== code) {
      return { ok: false, value: text, code, reason: 'select_readback_ambiguous' };
    }
    return { ok: true, value: row.text, code: row.code, reason: 'selected' };
  }

  async function fillCodedSelect(spec, value, options = {}) {
    const resolved = resolveCodedOption(spec.options, value);
    const base = {
      label: spec.label,
      ...(PRIMARY_SELECT_IDS.has(spec.selectId) ? { selectId: spec.selectId } : {}),
      ...(spec.rowScoped ? { rowIndex: spec.rowIndex } : {}),
      saved: false,
      skippedSave: true,
      supported: false,
      liveSupportClaimed: false,
      writeAttempted: false,
      expected: resolved?.text || norm(value),
      code: resolved?.code || '',
      before: '',
      beforeCode: '',
      after: '',
      afterCode: ''
    };
    if (!pageAllowed(options)) return { ...base, ok: false, reason: 'wrong_page' };
    if (!resolved) return { ...base, ok: false, reason: 'invalid_profile_value', code: '' };
    const located = locateCodedItem(spec);
    const item = located.item;
    if (!item) return { ...base, ok: false, reason: located.reason };
    if (!selectStructureOk(item, spec)) return { ...base, ok: false, reason: 'select_structure_changed' };
    const root = item.querySelector('.ant-select');
    if (!controlAvailable(root) || root.classList.contains('ant-select-disabled')) {
      return { ...base, ok: false, reason: 'select_disabled' };
    }
    const beforeRead = readCodedSelect(item, spec);
    if (!beforeRead.ok) return { ...base, ok: false, reason: beforeRead.reason };
    const before = beforeRead.ok ? beforeRead.value : '';
    const beforeCode = beforeRead.ok ? beforeRead.code : '';
    const search = item.querySelector('input.ant-select-selection-search-input');
    if (search && norm(search.value)) {
      return {
        ...base,
        ok: false,
        reason: 'search_input_written',
        before,
        beforeCode,
        after: before,
        afterCode: beforeCode
      };
    }
    if (search && !controlAvailable(search)) return { ...base, ok: false, reason: 'select_disabled', before, beforeCode };
    const target = selectRows(item).find((row) => row.code === resolved.code && row.text === norm(resolved.text));
    if (!target) return { ...base, ok: false, reason: 'option_not_found', before, beforeCode, after: before, afterCode: beforeCode };
    if (!controlAvailable(target.node) || target.node.classList.contains('ant-select-item-option-disabled')) {
      return { ...base, ok: false, reason: 'select_disabled', before, beforeCode, after: before, afterCode: beforeCode };
    }
    if (isUnsafeClick(target.node)) return { ...base, ok: false, reason: 'unsafe_control', before, beforeCode, after: before, afterCode: beforeCode };
    if (before === resolved.text && beforeCode === resolved.code) {
      return { ...base, ok: true, reason: 'matched', before, beforeCode, after: before, afterCode: beforeCode };
    }
    // The page (or the explicitly synthetic fixture) must accept the click.
    // Never manufacture a successful readback by rewriting display or ARIA state.
    const neighbors = PRIMARY_SELECT_IDS.has(spec.selectId) ? primarySelectNeighbors(spec.selectId) : null;
    target.node.click();
    const immediateChanges = neighbors ? changedPrimarySelectNeighbors(neighbors, spec.selectId) : [];
    await pause(80);
    const changedSelectIds = [...new Set([...immediateChanges,
      ...(neighbors ? changedPrimarySelectNeighbors(neighbors, spec.selectId) : [])])];
    const isolation = changedSelectIds.length ? {
      neighborCheck: { ok: false, reason: 'neighbor_changed', changedSelectIds }
    } : {};
    if (neighbors && !pageAllowed(options)) {
      return { ...base, ...isolation, ok: false, reason: 'wrong_page', before, beforeCode, writeAttempted: true };
    }
    const afterLocated = locateCodedItem(spec);
    const afterItem = afterLocated.item;
    if (!afterItem) return { ...base, ...isolation, ok: false, reason: changedSelectIds.length ? 'neighbor_changed' : afterLocated.reason, before, beforeCode, writeAttempted: true };
    const afterRoot = afterItem.querySelector('.ant-select');
    if (!controlAvailable(afterRoot) || afterRoot.classList.contains('ant-select-disabled')) {
      return { ...base, ...isolation, ok: false, reason: changedSelectIds.length ? 'neighbor_changed' : 'select_disabled', before, beforeCode, writeAttempted: true };
    }
    const afterSearch = afterItem.querySelector('input.ant-select-selection-search-input');
    if (afterSearch && !controlAvailable(afterSearch)) return { ...base, ...isolation, ok: false, reason: changedSelectIds.length ? 'neighbor_changed' : 'select_disabled', before, beforeCode, writeAttempted: true };
    if (afterSearch && norm(afterSearch.value)) {
      return { ...base, ...isolation, ok: false, reason: changedSelectIds.length ? 'neighbor_changed' : 'search_input_written', before, beforeCode, writeAttempted: true };
    }
    const afterRead = readCodedSelect(afterItem, spec);
    const after = afterRead.ok ? afterRead.value : '';
    const afterCode = afterRead.ok ? afterRead.code : '';
    const matched = afterRead.ok && after === resolved.text && afterCode === resolved.code;
    return {
      ...base,
      ...isolation,
      writeAttempted: true,
      ok: matched && changedSelectIds.length === 0,
      reason: changedSelectIds.length ? 'neighbor_changed' : (matched ? 'matched' : (afterRead.ok ? 'readback_mismatch' : afterRead.reason)),
      before,
      beforeCode,
      after,
      afterCode,
      code: resolved.code
    };
  }

  function fillMaritalStatus(value, options) {
    return fillCodedSelect(SELECT_SPECS.maritalStatus, value, options);
  }

  function fillPolitics(value, options) {
    return fillCodedSelect(SELECT_SPECS.politics, value, options);
  }

  function fillEthnicity(value, options) {
    return fillCodedSelect(SELECT_SPECS.ethnicity, value, options);
  }

  function fillIdCardType(value, options) {
    return fillCodedSelect(SELECT_SPECS.idCardType, value, options);
  }

  function fillEducationLevel(value, options) {
    return fillCodedSelect(SELECT_SPECS.educationLevel, value, options);
  }

  function fillRelationshipType(value, options) {
    return fillCodedSelect(SELECT_SPECS.relationshipType, value, options);
  }

  function fillRelationshipTypeRow1(value, options) {
    return fillCodedSelect(SELECT_SPECS.relationshipTypeRow1, value, options);
  }

  function fillAwardLevel(value, options) {
    return fillCodedSelect(SELECT_SPECS.awardLevel, value, options);
  }

  function fillEnglishLevel(value, options) {
    return fillCodedSelect(SELECT_SPECS.englishLevel, value, options);
  }

  function fillChannelType(value, options) {
    return fillCodedSelect(SELECT_SPECS.channelType, value, options);
  }

  function fillInterviewCity(value, options) {
    return fillCodedSelect(SELECT_SPECS.interviewCity, value, options);
  }

  function refuseHintSave(options) {
    const bag = options && typeof options === 'object' ? options : null;
    if (bag) {
      void bag.save;
      void bag.onSave;
      void bag.submit;
      void bag.onSubmit;
    }
    return {
      saveAllowed: false,
      saveRefused: true,
      saved: false,
      skippedSave: true
    };
  }

  /* CMB_BIRTHDATE_PICKER_START */
  const CMB_BIRTHDATE_INPUT_ID = 'resume_basicInfo_birthday';
  const CMB_BIRTHDATE_FILL_FAIL_REASONS = Object.freeze([
    'birthdate_unparseable',
    'birthdate_input_missing',
    'birthdate_target_ambiguous',
    'birthdate_panel_missing',
    'birthdate_panel_multiple',
    'birthdate_cell_missing',
    'birthdate_cell_disabled',
    'birthdate_readback_mismatch'
  ]);
  const BIRTH_DATE_RE = /^(\d{4})([-/])(\d{2})\2(\d{2})$/u;
  const MONTH_NAME_TO_NUMBER = Object.freeze({
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
  });
  const PICKER_STEP_LIMIT = 36;

  function pickerNorm(value) {
    return String(value ?? '')
      .normalize('NFKC')
      .replace(/[\u200b-\u200d\ufeff]/gu, '')
      .replace(/[\s\u00a0]+/gu, ' ')
      .trim();
  }

  function parseCmbBirthDate(raw) {
    const text = pickerNorm(raw);
    const match = text.match(BIRTH_DATE_RE);
    if (!match) return { ok: false, reason: 'birthdate_unparseable', iso: '' };
    const year = Number(match[1]);
    const month = Number(match[3]);
    const day = Number(match[4]);
    if (year < 1900 || year > 2100) return { ok: false, reason: 'birthdate_unparseable', iso: '' };
    const iso = `${match[1]}-${match[3]}-${match[4]}`;
    const stamp = new Date(Date.UTC(year, month - 1, day));
    if (stamp.getUTCFullYear() !== year || stamp.getUTCMonth() !== month - 1 || stamp.getUTCDate() !== day) {
      return { ok: false, reason: 'birthdate_unparseable', iso: '' };
    }
    return { ok: true, reason: null, iso, year, month, day };
  }

  function normalizeCmbBirthDateValue(raw) {
    const parsed = parseCmbBirthDate(raw);
    return parsed.ok ? parsed.iso : '';
  }

  function pickerView(doc) {
    return doc?.defaultView || globalThis;
  }

  function saveLikeText(el) {
    if (!el) return '';
    const aria = typeof el.getAttribute === 'function' ? (el.getAttribute('aria-label') || '') : '';
    const value = el.tagName === 'INPUT' || el.tagName === 'BUTTON' ? String(el.value || '') : '';
    return pickerNorm(`${el.textContent || ''} ${value} ${aria}`);
  }

  function isSaveLike(el) {
    const text = saveLikeText(el);
    if (/保存|提交|删除|投递|下一步|下一页|\b(?:save|submit|delete|deliver)\b/iu.test(text)) return true;
    return [el?.textContent, el?.getAttribute?.('aria-label'), el?.value]
      .some((value) => /^next(?:step|page)?$/iu.test(pickerNorm(value).replace(/\s+/gu, '')));
  }

  function pickerNodeUnavailable(el) {
    if (!el || el.isConnected === false) return true;
    for (let node = el; node; node = node.parentElement) {
      if (node.disabled === true || node.getAttribute?.('aria-disabled') === 'true') return true;
      if (node.hasAttribute?.('hidden') || node.hasAttribute?.('inert') || node.getAttribute?.('aria-hidden') === 'true') return true;
      const style = node.ownerDocument?.defaultView?.getComputedStyle?.(node) || node.style;
      if (style?.display === 'none' || style?.visibility === 'hidden' || style?.visibility === 'collapse') return true;
    }
    return false;
  }

  function isUnsafeClick(el) {
    if (pickerNodeUnavailable(el) || isSaveLike(el)) return true;
    for (let node = el; node; node = node.parentElement) {
      if (node.tagName === 'A' && node.hasAttribute('href')) return true;
      if (node.tagName === 'LABEL' && node.control) {
        const control = node.control;
        const type = String(control.getAttribute('type') || '').toLowerCase();
        if (!node.contains(control) || control.tagName === 'BUTTON'
            || ['submit', 'image', 'button', 'reset', 'file'].includes(type)
            || pickerNodeUnavailable(control) || isSaveLike(control)) return true;
        // A label can activate its associated control after a descendant click.
        // Only a direct control click or the validated radio wrapper may do so.
        if (node !== el && control !== el && !control.contains(el)) return true;
      }
      if (node.tagName === 'BUTTON') {
        const type = String(node.getAttribute('type') || '').toLowerCase();
        if (type !== 'button' || isSaveLike(node)) return true;
      }
      if (node.getAttribute?.('role') === 'button' && isSaveLike(node)) return true;
    }
    if (el.tagName === 'INPUT') {
      const type = String(el.getAttribute('type') || 'text').toLowerCase();
      if (['submit', 'image', 'button', 'reset', 'file', 'hidden'].includes(type)) return true;
    }
    return false;
  }

  function dispatchMouse(doc, el, type) {
    const View = pickerView(doc);
    el.dispatchEvent(new View.MouseEvent(type, { bubbles: true, cancelable: true, button: 0 }));
  }

  function pressPicker(doc, el) {
    if (isUnsafeClick(el)) return false;
    dispatchMouse(doc, el, 'mousedown');
    if (isUnsafeClick(el)) return false;
    dispatchMouse(doc, el, 'mouseup');
    if (isUnsafeClick(el)) return false;
    if (typeof el.click === 'function') el.click();
    return true;
  }

  function pressEscape(doc, input) {
    const View = pickerView(doc);
    for (const type of ['keydown', 'keyup']) {
      const event = new View.KeyboardEvent(type, {
        key: 'Escape',
        code: 'Escape',
        bubbles: true,
        cancelable: true
      });
      if (input && typeof input.dispatchEvent === 'function') input.dispatchEvent(event);
      if (typeof doc.dispatchEvent === 'function') doc.dispatchEvent(event);
    }
  }

  function visibleDropdowns(doc) {
    return [...doc.querySelectorAll('.ant-picker-dropdown')].filter((node) => {
      if (!node || !node.classList) return false;
      if (node.classList.contains('ant-picker-dropdown-hidden')) return false;
      return !pickerNodeUnavailable(node);
    });
  }

  function singlePanel(doc) {
    const open = visibleDropdowns(doc);
    if (open.length === 0) return { ok: false, reason: 'birthdate_panel_missing' };
    if (open.length > 1) return { ok: false, reason: 'birthdate_panel_multiple' };
    const panels = pickerNodes(open[0], '.ant-picker-panel');
    if (panels.length > 1) return { ok: false, reason: 'birthdate_panel_multiple' };
    const panel = panels[0] || open[0];
    const modes = pickerNodes(panel, '.ant-picker-decade-panel, .ant-picker-year-panel, .ant-picker-month-panel, .ant-picker-date-panel');
    if (modes.length > 1) return { ok: false, reason: 'birthdate_panel_multiple' };
    return { ok: true, panel: modes[0] || panel };
  }

  function pickerNodes(panel, selector) {
    return [...panel.querySelectorAll(selector)].filter((node) => !pickerNodeUnavailable(node));
  }

  function singlePickerNode(panel, selector) {
    const nodes = pickerNodes(panel, selector);
    return nodes.length === 1 ? nodes[0] : null;
  }

  function cellsByTitle(panel, title) {
    return pickerNodes(panel, '.ant-picker-cell').filter((cell) => cell.getAttribute('title') === title);
  }

  function clickCell(doc, cell) {
    if (!cell) return 'missing';
    if (cell.classList.contains('ant-picker-cell-disabled')) return 'disabled';
    const inners = pickerNodes(cell, '.ant-picker-cell-inner');
    if (inners.length > 1) return 'unsafe';
    const inner = inners[0];
    const target = inner || cell;
    if (isUnsafeClick(target)) return 'unsafe';
    return pressPicker(doc, target) ? 'clicked' : 'unsafe';
  }

  function readHeaderYear(panel) {
    const button = singlePickerNode(panel, '.ant-picker-year-btn');
    if (!button) return null;
    const match = pickerNorm(button.textContent).match(/^(\d{4})(?:年)?$/u);
    if (!match) return null;
    const year = Number(match[1]);
    return year >= 1900 && year <= 2100 ? year : null;
  }

  function readHeaderMonth(panel) {
    const button = singlePickerNode(panel, '.ant-picker-month-btn');
    if (!button) return null;
    const text = pickerNorm(button.textContent);
    const numeric = text.match(/^(\d{1,2})\s*月$/u);
    if (numeric) {
      const month = Number(numeric[1]);
      return month >= 1 && month <= 12 ? month : null;
    }
    const key = text.slice(0, 3).toLowerCase();
    return MONTH_NAME_TO_NUMBER[key] || null;
  }

  function visibleYears(panel) {
    return pickerNodes(panel, '.ant-picker-cell')
      .map((cell) => cell.getAttribute('title') || '')
      .filter((title) => /^\d{4}$/u.test(title))
      .map((title) => Number(title));
  }

  function panelMode(panel) {
    if (panel.matches('.ant-picker-decade-panel')) return 'decade';
    if (panel.matches('.ant-picker-year-panel')) return 'year';
    if (panel.matches('.ant-picker-month-panel')) return 'month';
    if (panel.matches('.ant-picker-date-panel')) return 'date';
    if (singlePickerNode(panel, '.ant-picker-year-btn') && singlePickerNode(panel, '.ant-picker-month-btn')) return 'date';
    if (singlePickerNode(panel, '.ant-picker-decade-btn')) return 'year';
    const titles = pickerNodes(panel, '.ant-picker-cell').map((cell) => cell.getAttribute('title') || '');
    if (titles.some((title) => /^\d{4}-\d{2}-\d{2}$/u.test(title))) return 'date';
    if (titles.some((title) => /^\d{4}-\d{2}$/u.test(title))) return 'month';
    if (titles.some((title) => /^\d{4}$/u.test(title))) return 'year';
    return 'unknown';
  }

  function panelSignature(panel) {
    const titles = pickerNodes(panel, '.ant-picker-cell')
      .map((cell) => cell.getAttribute('title') || '')
      .join(',');
    return [
      panelMode(panel),
      readHeaderYear(panel),
      readHeaderMonth(panel),
      titles
    ].join('|');
  }

  function closedPickerResult(partial) {
    return {
      ok: false,
      status: 'failed',
      saved: false,
      skippedSave: true,
      saveAllowed: false,
      supported: false,
      liveSupportClaimed: false,
      liveFillClaimed: false,
      inputId: CMB_BIRTHDATE_INPUT_ID,
      before: '',
      after: '',
      expected: '',
      writeAttempted: false,
      ...partial
    };
  }

  async function waitForPanelChange(doc, previousSig, wait) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const located = singlePanel(doc);
      if (!located.ok) return located;
      if (panelSignature(located.panel) !== previousSig) return { ok: true, panel: located.panel };
      if (typeof wait === 'function') await wait();
    }
    return { ok: false, reason: 'birthdate_panel_missing' };
  }

  async function openBirthDatePanel(doc, input, wait) {
    if (visibleDropdowns(doc).length > 0) return { ok: false, reason: 'birthdate_panel_multiple' };
    if (!pressPicker(doc, input)) return { ok: false, reason: 'birthdate_input_missing' };
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const located = singlePanel(doc);
      if (located.ok) return located;
      if (located.reason === 'birthdate_panel_multiple') return located;
      if (attempt < 7 && typeof wait === 'function') await wait();
    }
    return { ok: false, reason: 'birthdate_panel_missing' };
  }

  async function driveBirthDatePanel(doc, parsed, wait) {
    let previousSig = '';
    for (let step = 0; step < PICKER_STEP_LIMIT; step += 1) {
      const target = assessCmbBirthDatePickerTarget(doc);
      if (!target.ok) return { ok: false, reason: target.reason };
      const located = singlePanel(doc);
      if (!located.ok) return located;
      const panel = located.panel;
      const signature = panelSignature(panel);
      if (signature === previousSig) return { ok: false, reason: 'birthdate_panel_missing' };
      previousSig = signature;
      const mode = panelMode(panel);
      if (mode === 'unknown' || mode === 'decade') return { ok: false, reason: 'birthdate_panel_missing' };

      if (mode === 'date') {
        const dateCells = cellsByTitle(panel, parsed.iso);
        if (dateCells.length > 1) return { ok: false, reason: 'birthdate_panel_missing' };
        if (dateCells.length === 1) {
          const clicked = clickCell(doc, dateCells[0]);
          if (clicked === 'disabled') return { ok: false, reason: 'birthdate_cell_disabled' };
          if (clicked !== 'clicked') return { ok: false, reason: 'birthdate_panel_missing' };
          return { ok: true, picked: true };
        }
        const year = readHeaderYear(panel);
        const month = readHeaderMonth(panel);
        if (year == null || month == null) return { ok: false, reason: 'birthdate_panel_missing' };
        if (year !== parsed.year) {
          const button = singlePickerNode(panel, '.ant-picker-year-btn');
          if (!button || !pressPicker(doc, button)) return { ok: false, reason: 'birthdate_panel_missing' };
          const changed = await waitForPanelChange(doc, signature, wait);
          if (!changed.ok) return changed;
          continue;
        }
        if (month !== parsed.month) {
          const button = singlePickerNode(panel, '.ant-picker-month-btn');
          if (!button || !pressPicker(doc, button)) return { ok: false, reason: 'birthdate_panel_missing' };
          const changed = await waitForPanelChange(doc, signature, wait);
          if (!changed.ok) return changed;
          continue;
        }
        return { ok: false, reason: 'birthdate_cell_missing' };
      }

      if (mode === 'year') {
        const years = visibleYears(panel);
        if (!years.length) return { ok: false, reason: 'birthdate_panel_missing' };
        if (years.includes(parsed.year)) {
          const cells = cellsByTitle(panel, String(parsed.year));
          if (cells.length !== 1) return { ok: false, reason: 'birthdate_panel_missing' };
          const clicked = clickCell(doc, cells[0]);
          if (clicked === 'disabled') return { ok: false, reason: 'birthdate_cell_disabled' };
          if (clicked !== 'clicked') return { ok: false, reason: 'birthdate_panel_missing' };
          const changed = await waitForPanelChange(doc, signature, wait);
          if (!changed.ok) return changed;
          continue;
        }
        const button = parsed.year < Math.min(...years)
          ? singlePickerNode(panel, '.ant-picker-header-super-prev-btn')
          : singlePickerNode(panel, '.ant-picker-header-super-next-btn');
        if (!button || !pressPicker(doc, button)) return { ok: false, reason: 'birthdate_panel_missing' };
        const changed = await waitForPanelChange(doc, signature, wait);
        if (!changed.ok) return changed;
        continue;
      }

      const monthTitle = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
      const monthCells = cellsByTitle(panel, monthTitle);
      if (monthCells.length > 1) return { ok: false, reason: 'birthdate_panel_missing' };
      if (monthCells.length === 1) {
        const clicked = clickCell(doc, monthCells[0]);
        if (clicked === 'disabled') return { ok: false, reason: 'birthdate_cell_disabled' };
        if (clicked !== 'clicked') return { ok: false, reason: 'birthdate_panel_missing' };
        const changed = await waitForPanelChange(doc, signature, wait);
        if (!changed.ok) return changed;
        continue;
      }
      const headerYear = readHeaderYear(panel);
      const yearButton = singlePickerNode(panel, '.ant-picker-year-btn');
      if (yearButton && headerYear != null && headerYear !== parsed.year) {
        if (!pressPicker(doc, yearButton)) return { ok: false, reason: 'birthdate_panel_missing' };
        const changed = await waitForPanelChange(doc, signature, wait);
        if (!changed.ok) return changed;
        continue;
      }
      return { ok: false, reason: 'birthdate_cell_missing' };
    }
    return { ok: false, reason: 'birthdate_panel_missing' };
  }

  function classifyCmbBirthDatePickerTarget(snapshot) {
    const count = Number(snapshot?.count);
    const oneInput = count === 1 && snapshot?.input === true;
    if (oneInput) return { count: 1, unique: true, reason: null };
    if (Number.isFinite(count) && count > 1) {
      return { count, unique: false, reason: 'birthdate_target_ambiguous' };
    }
    return { count: 0, unique: false, reason: 'birthdate_input_missing' };
  }

  function assessCmbBirthDatePickerTarget(doc) {
    if (!doc || typeof doc.querySelectorAll !== 'function') {
      return { ...classifyCmbBirthDatePickerTarget({ count: 0, input: false }), ok: false, node: null };
    }
    const nodes = [...doc.querySelectorAll(`[id="${CMB_BIRTHDATE_INPUT_ID}"]`)];
    const input = nodes.length === 1 && nodes[0].tagName === 'INPUT'
      && nodes[0].type === 'text' && !isUnsafeClick(nodes[0]);
    const classified = classifyCmbBirthDatePickerTarget({ count: nodes.length, input });
    return {
      ...classified,
      ok: classified.unique === true,
      node: classified.unique === true ? nodes[0] : null
    };
  }

  async function fillCmbBirthDatePicker(doc, rawDate, options = {}) {
    const parsed = parseCmbBirthDate(rawDate);
    if (!parsed.ok) return closedPickerResult({ reason: 'birthdate_unparseable' });
    const target = assessCmbBirthDatePickerTarget(doc);
    if (!target.ok) {
      return closedPickerResult({ reason: target.reason, expected: parsed.iso });
    }
    const input = target.node;
    const before = normalizeCmbBirthDateValue(input.value);
    if (before === parsed.iso) {
      return {
        ok: true,
        status: 'verified',
        reason: 'preexisting_same_value',
        saved: false,
        skippedSave: true,
        saveAllowed: false,
        supported: false,
        liveSupportClaimed: false,
        liveFillClaimed: false,
        inputId: CMB_BIRTHDATE_INPUT_ID,
        before,
        after: before,
        expected: parsed.iso,
        writeAttempted: false
      };
    }
    const wait = typeof options.wait === 'function' ? options.wait : async () => {};
    const opened = await openBirthDatePanel(doc, input, wait);
    if (!opened.ok) {
      pressEscape(doc, input);
      return closedPickerResult({
        reason: opened.reason,
        expected: parsed.iso,
        before,
        after: pickerNorm(input.value),
        writeAttempted: false
      });
    }
    const driven = await driveBirthDatePanel(doc, parsed, wait);
    if (!driven.ok) {
      pressEscape(doc, input);
      return closedPickerResult({
        reason: driven.reason,
        expected: parsed.iso,
        before,
        after: pickerNorm(input.value),
        writeAttempted: true
      });
    }
    await wait();
    const pickedTarget = assessCmbBirthDatePickerTarget(doc);
    if (!pickedTarget.ok) {
      pressEscape(doc, input);
      return closedPickerResult({
        reason: pickedTarget.reason,
        expected: parsed.iso,
        before,
        writeAttempted: true
      });
    }
    const pickedInput = pickedTarget.node;
    const afterPick = normalizeCmbBirthDateValue(pickedInput.value);
    if (afterPick !== parsed.iso) {
      pressEscape(doc, input);
      return closedPickerResult({
        reason: 'birthdate_readback_mismatch',
        expected: parsed.iso,
        before,
        after: pickerNorm(pickedInput.value),
        writeAttempted: true
      });
    }
    const stillOpen = singlePanel(doc);
    if (stillOpen.ok) pressEscape(doc, pickedInput);
    const verifiedTarget = assessCmbBirthDatePickerTarget(doc);
    if (!verifiedTarget.ok) {
      return closedPickerResult({
        reason: verifiedTarget.reason,
        expected: parsed.iso,
        before,
        writeAttempted: true
      });
    }
    const after = normalizeCmbBirthDateValue(verifiedTarget.node.value);
    if (after !== parsed.iso) {
      return closedPickerResult({
        reason: 'birthdate_readback_mismatch',
        expected: parsed.iso,
        before,
        after: pickerNorm(verifiedTarget.node.value),
        writeAttempted: true
      });
    }
    return {
      ok: true,
      status: 'verified',
      reason: 'matched',
      saved: false,
      skippedSave: true,
      saveAllowed: false,
      supported: false,
      liveSupportClaimed: false,
      liveFillClaimed: false,
      inputId: CMB_BIRTHDATE_INPUT_ID,
      before,
      after,
      expected: parsed.iso,
      writeAttempted: true
    };
  }
/* CMB_BIRTHDATE_PICKER_END */

  function birthDateHint() {
    return {
      ...BIRTHDATE_HINT,
      ok: false,
      reason: 'datepicker_hint_only',
      ...refuseHintSave(null),
      writeAttempted: false
    };
  }

  async function fillBirthDate(value) {
    const result = await fillCmbBirthDatePicker(document, value, { wait: () => pause(40) });
    return {
      label: BIRTHDATE_HINT.label,
      path: 'birthDate',
      ok: result.ok === true,
      status: result.ok === true ? 'verified' : 'failed',
      reason: result.reason,
      before: result.before || '',
      after: result.after || '',
      expected: result.expected || '',
      saved: false,
      skippedSave: true,
      saveAllowed: false,
      supported: false,
      liveSupportClaimed: false,
      liveFillClaimed: false,
      writeAttempted: result.writeAttempted === true
    };
  }

  function closedText(label, value, reason) {
    return {
      label,
      ok: false,
      reason,
      before: '',
      after: '',
      expected: value,
      saved: false,
      skippedSave: true,
      writeAttempted: false
    };
  }

  async function fillText(label, value) {
    const located = locateItem(label);
    const item = located.item;
    if (!item) return closedText(label, value, located.reason || 'item_not_found');
    const control = textControl(item);
    if (!control) return { label, ok: false, reason: 'control_not_found', before: '', after: '', expected: value };
    if (cleanLabel(label) === BASIC_NAME_LABEL && FAMILY_NAME_INPUT_IDS.includes(control.id)) {
      return closedText(label, value, 'item_not_found');
    }
    if (cleanLabel(label) === BASIC_NAME_LABEL && located.scoped === true && control.id !== BASIC_NAME_INPUT_ID) {
      return closedText(label, value, 'item_ambiguous');
    }
    const before = norm(control.value);
    control.focus();
    setNativeValue(control, String(value ?? ''));
    await pause(80);
    const after = readText(item);
    return {
      label,
      ok: after === norm(value),
      reason: after === norm(value) ? 'matched' : 'readback_mismatch',
      before,
      after,
      expected: norm(value)
    };
  }

  function planFromProfile(profile, pickerCensus = null) {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
      return { ok: false, reason: 'profile_missing', values: null, fields: [], blockers: [{ reason: 'profile_missing' }] };
    }
    if (!Array.isArray(profile.confirmedFields)) {
      return {
        ok: false,
        reason: 'profile_missing',
        values: null,
        fields: [],
        blockers: [{ reason: 'confirmed_fields_missing' }]
      };
    }
    const confirmed = new Set(profile.confirmedFields.filter((path) => typeof path === 'string'));
    const fullName = norm(profile.fullName || '');
    const mobile = norm(profile.phone || '');
    const email = norm(profile.email || '');
    const genderRaw = norm(profile.gender || '');
    const heightRaw = norm(profile.height || '');
    const weightRaw = norm(profile.weight || '');
    const formalWorkRaw = norm(profile.formalWork || '');
    const maritalRaw = norm(profile.maritalStatus || '');
    const politicsRaw = norm(profile.politics || '');
    const ethnicityRaw = norm(profile.ethnicity || '');
    const idCardTypeRaw = norm(profile.idCardType || '');
    const educationLevelRaw = norm(profile.educationLevel || '');
    const relationshipTypeRaw = norm(profile.relationshipType || '');
    const relationshipTypeRow1Raw = norm(profile.relationshipTypeRow1 || '');
    const awardLevelRaw = norm(profile.awardLevel || '');
    const englishLevelRaw = norm(profile.englishLevel || '');
    const channelTypeRaw = norm(profile.channelType || '');
    const interviewCityRaw = norm(profile.interviewCity || '');
    const birthRaw = norm(profile.birthDate || '');
    const core = [
      { label: '姓名', path: 'fullName', value: fullName },
      { label: '手机号', path: 'phone', value: mobile },
      { label: '邮箱', path: 'email', value: email }
    ].map((row) => {
      let reason = null;
      if (!row.value) reason = 'missing_profile_value';
      else if (!confirmed.has(row.path)) reason = 'profile_fact_unconfirmed';
      return { ...row, ready: reason === null, reason };
    });
    const genderFields = [];
    if (genderRaw) {
      let reason = null;
      if (!confirmed.has('gender')) reason = 'profile_fact_unconfirmed';
      else if (!GENDER_VALUES.includes(genderRaw)) reason = 'invalid_profile_value';
      genderFields.push({
        label: GENDER_LABEL,
        path: 'gender',
        value: genderRaw,
        ready: reason === null,
        reason
      });
    }
    const heightFields = [];
    if (heightRaw) {
      let reason = null;
      if (!confirmed.has('height')) reason = 'profile_fact_unconfirmed';
      else if (!HEIGHT_VALUE_RE.test(heightRaw)) reason = 'invalid_profile_value';
      heightFields.push({
        label: HEIGHT_LABEL,
        path: 'height',
        value: heightRaw,
        ready: reason === null,
        reason
      });
    }
    const weightFields = [];
    if (weightRaw) {
      let reason = null;
      if (!confirmed.has('weight')) reason = 'profile_fact_unconfirmed';
      else if (!WEIGHT_VALUE_RE.test(weightRaw)) reason = 'invalid_profile_value';
      weightFields.push({
        label: WEIGHT_LABEL,
        path: 'weight',
        value: weightRaw,
        ready: reason === null,
        reason
      });
    }
    const formalWorkFields = [];
    if (formalWorkRaw) {
      let reason = null;
      if (!confirmed.has('formalWork')) reason = 'profile_fact_unconfirmed';
      else if (!FORMAL_WORK_VALUES.includes(formalWorkRaw)) reason = 'invalid_profile_value';
      formalWorkFields.push({
        label: FORMAL_WORK_LABEL,
        path: 'formalWork',
        value: formalWorkRaw,
        ready: reason === null,
        reason
      });
    }
    const codedPlan = (raw, path, spec) => {
      if (!raw) return [];
      const resolved = resolveCodedOption(spec.options, raw);
      let reason = null;
      if (!confirmed.has(path)) reason = 'profile_fact_unconfirmed';
      else if (!resolved) reason = 'invalid_profile_value';
      return [{
        label: spec.label,
        path,
        value: resolved?.text || raw,
        code: resolved?.code || '',
        ready: reason === null,
        reason
      }];
    };
    const maritalFields = codedPlan(maritalRaw, 'maritalStatus', SELECT_SPECS.maritalStatus);
    const politicsFields = codedPlan(politicsRaw, 'politics', SELECT_SPECS.politics);
    const ethnicityFields = codedPlan(ethnicityRaw, 'ethnicity', SELECT_SPECS.ethnicity);
    const idCardTypeFields = codedPlan(idCardTypeRaw, 'idCardType', SELECT_SPECS.idCardType);
    const educationLevelFields = codedPlan(educationLevelRaw, 'educationLevel', SELECT_SPECS.educationLevel);
    const relationshipTypeFields = codedPlan(relationshipTypeRaw, 'relationshipType', SELECT_SPECS.relationshipType);
    const relationshipTypeRow1Fields = codedPlan(relationshipTypeRow1Raw, 'relationshipTypeRow1', SELECT_SPECS.relationshipTypeRow1);
    const awardLevelFields = codedPlan(awardLevelRaw, 'awardLevel', SELECT_SPECS.awardLevel);
    const englishLevelFields = codedPlan(englishLevelRaw, 'englishLevel', SELECT_SPECS.englishLevel);
    const channelTypeFields = codedPlan(channelTypeRaw, 'channelType', SELECT_SPECS.channelType);
    const interviewCityFields = codedPlan(interviewCityRaw, 'interviewCity', SELECT_SPECS.interviewCity);
    const birthFields = [];
    if (birthRaw) {
      const parsedBirth = parseCmbBirthDate(birthRaw);
      let reason = null;
      if (!confirmed.has('birthDate')) reason = 'profile_fact_unconfirmed';
      else if (!parsedBirth.ok) reason = 'birthdate_unparseable';
      birthFields.push({
        label: BIRTHDATE_HINT.label,
        path: 'birthDate',
        value: reason === null ? parsedBirth.iso : '',
        ready: reason === null,
        reason,
        kind: BIRTHDATE_HINT.kind,
        fillHint: BIRTHDATE_HINT.fillHint,
        fillVia: reason === null ? 'datepicker' : null,
        saveAllowed: false,
        saved: false,
        skippedSave: true
      });
    }
    const fields = [
      ...core,
      ...genderFields,
      ...heightFields,
      ...weightFields,
      ...formalWorkFields,
      ...maritalFields,
      ...politicsFields,
      ...ethnicityFields,
      ...idCardTypeFields,
      ...educationLevelFields,
      ...relationshipTypeFields,
      ...relationshipTypeRow1Fields,
      ...awardLevelFields,
      ...englishLevelFields,
      ...channelTypeFields,
      ...interviewCityFields,
      ...birthFields
    ];
    const coreBlockers = core.filter((row) => !row.ready);
    const genderBlockers = genderFields.filter((row) => !row.ready);
    const heightBlockers = heightFields.filter((row) => !row.ready);
    const weightBlockers = weightFields.filter((row) => !row.ready);
    const formalWorkBlockers = formalWorkFields.filter((row) => !row.ready);
    const maritalBlockers = maritalFields.filter((row) => !row.ready);
    const politicsBlockers = politicsFields.filter((row) => !row.ready);
    const ethnicityBlockers = ethnicityFields.filter((row) => !row.ready);
    const idCardTypeBlockers = idCardTypeFields.filter((row) => !row.ready);
    const educationLevelBlockers = educationLevelFields.filter((row) => !row.ready);
    const relationshipTypeBlockers = relationshipTypeFields.filter((row) => !row.ready);
    const relationshipTypeRow1Blockers = relationshipTypeRow1Fields.filter((row) => !row.ready);
    const awardLevelBlockers = awardLevelFields.filter((row) => !row.ready);
    const englishLevelBlockers = englishLevelFields.filter((row) => !row.ready);
    const channelTypeBlockers = channelTypeFields.filter((row) => !row.ready);
    const interviewCityBlockers = interviewCityFields.filter((row) => !row.ready);
    const birthBlockers = birthFields.filter((row) => !row.ready);
    const optionalBlockers = [
      ...genderBlockers,
      ...heightBlockers,
      ...weightBlockers,
      ...formalWorkBlockers,
      ...maritalBlockers,
      ...politicsBlockers,
      ...ethnicityBlockers,
      ...idCardTypeBlockers,
      ...educationLevelBlockers,
      ...relationshipTypeBlockers,
      ...relationshipTypeRow1Blockers,
      ...awardLevelBlockers,
      ...englishLevelBlockers,
      ...channelTypeBlockers,
      ...interviewCityBlockers,
      ...birthBlockers
    ];
    if (coreBlockers.length) {
      return applyBirthDatePickerCensus({
        ok: false,
        reason: 'profile_fields_unavailable',
        values: null,
        fields,
        blockers: [...coreBlockers, ...optionalBlockers]
      }, pickerCensus);
    }
    return applyBirthDatePickerCensus({
      ok: true,
      reason: 'profile_ready',
      values: {
        fullName,
        mobile,
        email,
        gender: genderFields.find((row) => row.ready)?.value || '',
        height: heightFields.find((row) => row.ready)?.value || '',
        weight: weightFields.find((row) => row.ready)?.value || '',
        formalWork: formalWorkFields.find((row) => row.ready)?.value || '',
        maritalStatus: maritalFields.find((row) => row.ready)?.value || '',
        politics: politicsFields.find((row) => row.ready)?.value || '',
        ethnicity: ethnicityFields.find((row) => row.ready)?.value || '',
        idCardType: idCardTypeFields.find((row) => row.ready)?.value || '',
        educationLevel: educationLevelFields.find((row) => row.ready)?.value || '',
        relationshipType: relationshipTypeFields.find((row) => row.ready)?.value || '',
        relationshipTypeRow1: relationshipTypeRow1Fields.find((row) => row.ready)?.value || '',
        awardLevel: awardLevelFields.find((row) => row.ready)?.value || '',
        englishLevel: englishLevelFields.find((row) => row.ready)?.value || '',
        channelType: channelTypeFields.find((row) => row.ready)?.value || '',
        interviewCity: interviewCityFields.find((row) => row.ready)?.value || '',
        birthDate: birthFields.find((row) => row.ready)?.value || ''
      },
      fields,
      blockers: optionalBlockers,
      birthDateHint: BIRTHDATE_HINT
    }, pickerCensus);
  }

  function birthDateReadinessView(plan) {
    const field = (plan?.fields || []).find((row) => row && row.path === 'birthDate') || null;
    const blocker = (plan?.blockers || []).find((row) => row && row.path === 'birthDate') || null;
    if (!field) {
      return { path: 'birthDate', present: false, ready: false, fillVia: null, reason: null, blocker: false };
    }
    const ready = field.ready === true && !blocker;
    return {
      path: 'birthDate',
      present: true,
      ready,
      fillVia: ready ? 'datepicker' : null,
      reason: blocker?.reason || null,
      blocker: Boolean(blocker)
    };
  }

  function applyBirthDatePickerCensus(plan, census) {
    // No page census: keep the profile plan. A confirmed date stays fillable
    // via the DatePicker and is not datepicker_hint_only. Zero or many
    // #resume_basicInfo_birthday targets fail closed only when a census is passed.
    if (census == null) {
      return { ...plan, birthDateReadiness: birthDateReadinessView(plan) };
    }
    const classified = classifyCmbBirthDatePickerTarget({
      count: census.count,
      input: census.input === true || census.ok === true || census.unique === true
    });
    const fields = (plan.fields || []).map((row) => ({ ...row }));
    const birth = fields.find((row) => row.path === 'birthDate');
    if (!birth || birth.ready !== true) {
      return { ...plan, fields, birthDateReadiness: birthDateReadinessView({ ...plan, fields }) };
    }
    if (classified.unique === true) {
      birth.fillVia = 'datepicker';
      const next = { ...plan, fields };
      return { ...next, birthDateReadiness: birthDateReadinessView(next) };
    }
    birth.ready = false;
    birth.reason = classified.reason;
    birth.value = '';
    birth.fillVia = null;
    const blockers = [
      ...(plan.blockers || []).filter((row) => row.path !== 'birthDate'),
      {
        label: birth.label,
        path: 'birthDate',
        value: '',
        ready: false,
        reason: classified.reason,
        kind: birth.kind,
        fillHint: birth.fillHint,
        fillVia: null,
        saveAllowed: false,
        saved: false,
        skippedSave: true
      }
    ];
    const values = plan.values && typeof plan.values === 'object'
      ? { ...plan.values, birthDate: '' }
      : plan.values;
    const next = { ...plan, fields, blockers, values };
    return { ...next, birthDateReadiness: birthDateReadinessView(next) };
  }

  function probeFingerprint() {
    const html = document.documentElement?.innerHTML || '';
    const title = document.title || '';
    const hints = {
      antDesign: /\bant-(?:form|input|select|btn)\b/i.test(html) || !!document.querySelector('.ant-form-item, .ant-input, .ant-btn'),
      reactRoot: !!document.getElementById('root'),
      cmbStatic: /\/static\/js\/main\./i.test(html) || /career\.cmbchina\.com/i.test(location.href),
      hotjob: /wecruit\.hotjob\.cn|hotjob\.cn/i.test(html),
      citics: /careers\.citics\.com/i.test(html)
    };
    return {
      ...hints,
      looksCmb: hints.cmbStatic && !hints.hotjob && !hints.citics,
      inputCount: document.querySelectorAll('input:not([type=hidden])').length,
      formItemCount: formItems().length,
      foundLabels: TEXT_LABELS.filter((label) => !!findItem(label)),
      title
    };
  }

  async function probeLabels(options = {}) {
    const fp = probeFingerprint();
    const labels = TEXT_LABELS.map((label) => {
      const item = findItem(label);
      return {
        label,
        found: !!item,
        hasTextControl: !!item && !!textControl(item),
        value: item ? readText(item) : ''
      };
    });
    const foundCount = labels.filter((row) => row.found && row.hasTextControl).length;
    const onPage = pageAllowed(options);
    return {
      ok: onPage && (foundCount >= 1 || fp.looksCmb || options?.synthetic === true),
      siteId: SITE_ID,
      href: location.href,
      title: document.title,
      onCmbResumeEdit: onCmbResumeEditPage(),
      synthetic: options?.synthetic === true,
      fingerprint: fp,
      labels,
      foundCount,
      reason: !onPage
        ? 'wrong_page'
        : foundCount >= 3
          ? 'labels_ready'
          : foundCount >= 1
            ? 'labels_partial'
            : fp.looksCmb
              ? 'cmb_shell_no_form_dom'
              : 'labels_missing',
      saved: false,
      skippedSave: true
    };
  }

  async function fillBasic(rawValues = {}, options = {}) {
    if (!pageAllowed(options)) {
      return {
        ok: false,
        siteId: SITE_ID,
        reason: 'wrong_page',
        href: location.href,
        results: [],
        saved: false,
        skippedSave: true
      };
    }

    const profile = rawValues.profile;
    const allowExplicit = rawValues.allowExplicitValues === true;
    let values = null;
    let plan = null;

    if (allowExplicit && (rawValues.fullName || rawValues.mobile || rawValues.email)) {
      const gender = rawValues.gender == null ? '' : norm(rawValues.gender);
      const height = rawValues.height == null ? '' : norm(rawValues.height);
      const weight = rawValues.weight == null ? '' : norm(rawValues.weight);
      const formalWork = rawValues.formalWork == null ? '' : norm(rawValues.formalWork);
      const maritalRaw = rawValues.maritalStatus == null ? '' : norm(rawValues.maritalStatus);
      const politicsRaw = rawValues.politics == null ? '' : norm(rawValues.politics);
      const ethnicityRaw = rawValues.ethnicity == null ? '' : norm(rawValues.ethnicity);
      const idCardTypeRaw = rawValues.idCardType == null ? '' : norm(rawValues.idCardType);
      const educationLevelRaw = rawValues.educationLevel == null ? '' : norm(rawValues.educationLevel);
      const relationshipTypeRaw = rawValues.relationshipType == null ? '' : norm(rawValues.relationshipType);
      const relationshipTypeRow1Raw = rawValues.relationshipTypeRow1 == null ? '' : norm(rawValues.relationshipTypeRow1);
      const awardLevelRaw = rawValues.awardLevel == null ? '' : norm(rawValues.awardLevel);
      const englishLevelRaw = rawValues.englishLevel == null ? '' : norm(rawValues.englishLevel);
      const channelTypeRaw = rawValues.channelType == null ? '' : norm(rawValues.channelType);
      const interviewCityRaw = rawValues.interviewCity == null ? '' : norm(rawValues.interviewCity);
      const marital = resolveCodedOption(SELECT_SPECS.maritalStatus.options, maritalRaw);
      const politics = resolveCodedOption(SELECT_SPECS.politics.options, politicsRaw);
      const ethnicity = resolveCodedOption(SELECT_SPECS.ethnicity.options, ethnicityRaw);
      const idCardType = resolveCodedOption(SELECT_SPECS.idCardType.options, idCardTypeRaw);
      const educationLevel = resolveCodedOption(SELECT_SPECS.educationLevel.options, educationLevelRaw);
      const relationshipType = resolveCodedOption(SELECT_SPECS.relationshipType.options, relationshipTypeRaw);
      const relationshipTypeRow1 = resolveCodedOption(SELECT_SPECS.relationshipTypeRow1.options, relationshipTypeRow1Raw);
      const awardLevel = resolveCodedOption(SELECT_SPECS.awardLevel.options, awardLevelRaw);
      const englishLevel = resolveCodedOption(SELECT_SPECS.englishLevel.options, englishLevelRaw);
      const channelType = resolveCodedOption(SELECT_SPECS.channelType.options, channelTypeRaw);
      const interviewCity = resolveCodedOption(SELECT_SPECS.interviewCity.options, interviewCityRaw);
      const birthRawExplicit = norm(rawValues.birthDate || '');
      let explicitBirthDate = '';
      if (birthRawExplicit) {
        const parsedBirth = parseCmbBirthDate(birthRawExplicit);
        if (!parsedBirth.ok) {
          return {
            ok: false,
            siteId: SITE_ID,
            status: 'failed',
            reason: 'birthdate_unparseable',
            href: location.href,
            results: [],
            writeAttempted: false,
            ...refuseHintSave(options)
          };
        }
        explicitBirthDate = parsedBirth.iso;
      }
      if (gender && !GENDER_VALUES.includes(gender)) {
        return {
          ok: false,
          siteId: SITE_ID,
          reason: 'invalid_gender',
          href: location.href,
          results: [],
          saved: false,
          skippedSave: true,
          writeAttempted: false
        };
      }
      if (height && !HEIGHT_VALUE_RE.test(height)) {
        return {
          ok: false,
          siteId: SITE_ID,
          reason: 'invalid_height',
          href: location.href,
          results: [],
          saved: false,
          skippedSave: true,
          writeAttempted: false
        };
      }
      if (weight && !WEIGHT_VALUE_RE.test(weight)) {
        return {
          ok: false,
          siteId: SITE_ID,
          reason: 'invalid_weight',
          href: location.href,
          results: [],
          saved: false,
          skippedSave: true,
          writeAttempted: false
        };
      }
      if (formalWork && !FORMAL_WORK_VALUES.includes(formalWork)) {
        return {
          ok: false,
          siteId: SITE_ID,
          reason: 'invalid_formal_work',
          href: location.href,
          results: [],
          saved: false,
          skippedSave: true,
          writeAttempted: false
        };
      }
      if (maritalRaw && !marital) {
        return {
          ok: false,
          siteId: SITE_ID,
          reason: 'invalid_marital_status',
          href: location.href,
          results: [],
          saved: false,
          skippedSave: true,
          writeAttempted: false
        };
      }
      if (politicsRaw && !politics) {
        return {
          ok: false,
          siteId: SITE_ID,
          reason: 'invalid_politics',
          href: location.href,
          results: [],
          saved: false,
          skippedSave: true,
          writeAttempted: false
        };
      }
      if (ethnicityRaw && !ethnicity) {
        return {
          ok: false,
          siteId: SITE_ID,
          reason: 'invalid_ethnicity',
          href: location.href,
          results: [],
          saved: false,
          skippedSave: true,
          writeAttempted: false
        };
      }
      if (idCardTypeRaw && !idCardType) {
        return {
          ok: false,
          siteId: SITE_ID,
          reason: 'invalid_id_card_type',
          href: location.href,
          results: [],
          saved: false,
          skippedSave: true,
          writeAttempted: false
        };
      }
      if (educationLevelRaw && !educationLevel) {
        return {
          ok: false,
          siteId: SITE_ID,
          reason: 'invalid_education_level',
          href: location.href,
          results: [],
          saved: false,
          skippedSave: true,
          writeAttempted: false
        };
      }
      if (relationshipTypeRaw && !relationshipType) {
        return {
          ok: false,
          siteId: SITE_ID,
          reason: 'invalid_relationship_type',
          href: location.href,
          results: [],
          saved: false,
          skippedSave: true,
          writeAttempted: false
        };
      }
      if (relationshipTypeRow1Raw && !relationshipTypeRow1) {
        return {
          ok: false,
          siteId: SITE_ID,
          reason: 'invalid_relationship_type_row1',
          href: location.href,
          results: [],
          saved: false,
          skippedSave: true,
          writeAttempted: false
        };
      }
      if (awardLevelRaw && !awardLevel) {
        return {
          ok: false,
          siteId: SITE_ID,
          reason: 'invalid_award_level',
          href: location.href,
          results: [],
          saved: false,
          skippedSave: true,
          writeAttempted: false
        };
      }
      if (englishLevelRaw && !englishLevel) {
        return {
          ok: false,
          siteId: SITE_ID,
          reason: 'invalid_english_level',
          href: location.href,
          results: [],
          saved: false,
          skippedSave: true,
          writeAttempted: false
        };
      }
      if (channelTypeRaw && !channelType) {
        return {
          ok: false,
          siteId: SITE_ID,
          reason: 'invalid_channel_type',
          href: location.href,
          results: [],
          saved: false,
          skippedSave: true,
          writeAttempted: false
        };
      }
      if (interviewCityRaw && !interviewCity) {
        return {
          ok: false,
          siteId: SITE_ID,
          reason: 'invalid_interview_city',
          href: location.href,
          results: [],
          saved: false,
          skippedSave: true,
          writeAttempted: false
        };
      }
      values = {
        fullName: norm(rawValues.fullName || ''),
        mobile: norm(rawValues.mobile || rawValues.phone || ''),
        email: norm(rawValues.email || ''),
        gender,
        height,
        weight,
        formalWork,
        maritalStatus: marital?.text || '',
        politics: politics?.text || '',
        ethnicity: ethnicity?.text || '',
        idCardType: idCardType?.text || '',
        educationLevel: educationLevel?.text || '',
        relationshipType: relationshipType?.text || '',
        relationshipTypeRow1: relationshipTypeRow1?.text || '',
        awardLevel: awardLevel?.text || '',
        englishLevel: englishLevel?.text || '',
        channelType: channelType?.text || '',
        interviewCity: interviewCity?.text || '',
        birthDate: explicitBirthDate
      };
      if (!values.fullName || !values.mobile || !values.email) {
        return {
          ok: false,
          siteId: SITE_ID,
          reason: 'explicit_values_incomplete',
          href: location.href,
          results: [],
          saved: false,
          skippedSave: true
        };
      }
    } else {
      plan = planFromProfile(profile, assessCmbBirthDatePickerTarget(document));
      if (!plan.ok) {
        const birthBlocked = (plan.blockers || []).some((row) => row.path === 'birthDate');
        return {
          ok: false,
          siteId: SITE_ID,
          reason: plan.reason,
          href: location.href,
          title: document.title,
          results: (plan.fields || []).map((row) => ({
            label: row.label,
            ok: false,
            reason: row.reason || plan.reason,
            before: '',
            after: '',
            expected: row.value || '',
            path: row.path
          })),
          blockers: plan.blockers,
          saved: false,
          skippedSave: true,
          writeAttempted: false,
          ...(birthBlocked ? refuseHintSave(options) : {})
        };
      }
      values = plan.values;
    }

    const textPlan = [
      ['姓名', values.fullName],
      ['手机号', values.mobile],
      ['邮箱', values.email]
    ];
    const results = [];
    for (const [label, value] of textPlan) {
      results.push(await fillText(label, value));
    }
    if (GENDER_VALUES.includes(values.gender)) {
      results.push(await fillGender(values.gender, options));
    }
    if (HEIGHT_VALUE_RE.test(values.height || '')) {
      results.push(await fillHeight(values.height, options));
    }
    if (WEIGHT_VALUE_RE.test(values.weight || '')) {
      results.push(await fillWeight(values.weight, options));
    }
    if (FORMAL_WORK_VALUES.includes(values.formalWork || '')) {
      results.push(await fillFormalWork(values.formalWork, options));
    }
    if (values.maritalStatus) results.push(await fillMaritalStatus(values.maritalStatus, options));
    if (values.politics) results.push(await fillPolitics(values.politics, options));
    if (values.ethnicity) results.push(await fillEthnicity(values.ethnicity, options));
    if (values.idCardType) results.push(await fillIdCardType(values.idCardType, options));
    const residualSelectPlan = [
      ['educationLevel', fillEducationLevel], ['relationshipType', fillRelationshipType],
      ['relationshipTypeRow1', fillRelationshipTypeRow1], ['awardLevel', fillAwardLevel],
      ['englishLevel', fillEnglishLevel], ['channelType', fillChannelType], ['interviewCity', fillInterviewCity]
    ];
    let residualBlockedBy = null;
    const notRun = (path, label, selectId) => ({
      path, label, selectId, ok: false, status: 'failed', reason: 'not_run', blockedBy: residualBlockedBy,
      expected: values[path], before: '', after: '', writeAttempted: false,
      saved: false, skippedSave: true, supported: false, liveSupportClaimed: false
    });
    for (const [path, fill] of residualSelectPlan) {
      if (!values[path]) continue;
      const spec = SELECT_SPECS[path];
      if (residualBlockedBy) {
        results.push(notRun(path, spec.label, spec.selectId));
        continue;
      }
      const result = await fill(values[path], options);
      results.push({ ...result, path });
      residualBlockedBy = result.reason === 'neighbor_changed' || result.reason === 'wrong_page' ? result.reason : null;
    }
    if (values.birthDate) results.push(residualBlockedBy
      ? notRun('birthDate', BIRTHDATE_HINT.label, BIRTHDATE_HINT.selectId)
      : await fillBirthDate(values.birthDate));
    const blocked = (plan?.blockers || []).filter((row) => REQUESTED_FILL_FAIL_CLOSED.has(row?.reason));
    for (const row of blocked) {
      const present = results.some((item) => item && (item.path === row.path || item.label === row.label));
      if (present) continue;
      results.push({
        label: row.label,
        path: row.path,
        ok: false,
        status: 'failed',
        reason: row.reason,
        before: '',
        after: '',
        expected: row.value || '',
        saved: false,
        skippedSave: true,
        writeAttempted: false
      });
    }
    const failed = results.find((row) => !row || row.ok !== true);
    const ok = !failed;
    const birthRow = plan?.blockers?.find((row) => row.path === 'birthDate');
    const birthHintOnly = birthRow?.reason === 'datepicker_hint_only';
    const birthRequested = Boolean(values?.birthDate) || Boolean(birthRow);
    return {
      ok,
      ...(failed ? { reason: failed.reason || 'cmb_fill_partial', status: 'failed' } : {}),
      siteId: SITE_ID,
      href: location.href,
      title: document.title,
      saved: false,
      skippedSave: true,
      writeAttempted: true,
      supported: false,
      liveSupportClaimed: false,
      profileSource: allowExplicit ? 'explicit' : 'resumeProfile',
      planSummary: plan
        ? { reason: plan.reason, readyCount: plan.fields.filter((f) => f.ready).length, blockerCount: plan.blockers.length }
        : { reason: 'explicit_override' },
      results,
      ...(birthRequested ? refuseHintSave(options) : {}),
      ...(birthHintOnly ? { birthDateHint: birthDateHint() } : {})
    };
  }

  const api = {
    siteId: SITE_ID,
    TEXT_LABELS,
    BASIC_NAME_LABEL,
    BASIC_NAME_INPUT_ID,
    FAMILY_NAME_INPUT_IDS,
    GENDER_LABEL,
    GENDER_VALUES,
    HEIGHT_LABEL,
    HEIGHT_VALUE_RE,
    WEIGHT_LABEL,
    WEIGHT_VALUE_RE,
    FORMAL_WORK_LABEL,
    FORMAL_WORK_VALUES,
    ITEM_SEL,
    RADIO_WRAP_SEL,
    RADIO_MARK_SEL,
    isCmbHost,
    onCmbResumeEditPage,
    findItem,
    textControl,
    fillText,
    fillGender,
    fillFormalWork,
    fillHeight,
    fillWeight,
    fillMaritalStatus,
    fillPolitics,
    fillEthnicity,
    fillIdCardType,
    fillEducationLevel,
    fillRelationshipType,
    fillRelationshipTypeRow1,
    fillAwardLevel,
    fillEnglishLevel,
    fillChannelType,
    fillInterviewCity,
    fillBirthDate,
    parseCmbBirthDate,
    assessBirthDatePicker() {
      const assessed = assessCmbBirthDatePickerTarget(document);
      return {
        count: assessed.count,
        unique: assessed.unique === true,
        input: assessed.ok === true,
        reason: assessed.reason
      };
    },
    birthDateHint,
    BIRTHDATE_HINT,
    GATED_DICTS,
    fillBasic,
    probeLabels,
    probeFingerprint,
    planFromProfile,
    listener: null
  };

  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    api.listener = (message, _sender, sendResponse) => {
      if (!message || (message.siteId && message.siteId !== SITE_ID)) return false;
      if (message.type === 'CMB_BASIC_PROBE') {
        probeLabels(message.options || {}).then(sendResponse);
        return true;
      }
      if (message.type === 'CMB_BASIC_FILL') {
        fillBasic(message.values || { profile: message.profile }, message.options || {}).then(sendResponse);
        return true;
      }
      return false;
    };
    chrome.runtime.onMessage.addListener(api.listener);
  }

  globalThis.ResumeCmbBasic = api;
})();
