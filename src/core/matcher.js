/* Shared by the Edge content script and Node's built-in test runner. */
(function (root) {
  "use strict";

  const definitions = {
    fullName: ["姓名", "真实姓名", "中文姓名", "候选人姓名", "应聘者姓名"],
    identityNumber: ["证件号", "证件号码"],
    gender: ["性别"],
    birthDate: ["出生日期"],
    email: ["邮箱", "电子邮箱", "电子邮件", "邮箱地址", "联系邮箱", "电子邮件地址",
      "电子邮箱（请尽量使用163、qq等常见邮箱，尽量不要用gmail、hotmail等境外邮箱或学校邮箱）"],
    phone: ["手机号", "手机号码", "手机", "联系电话", "联系手机", "电话", "移动电话",
      "移动电话（请填写中国大陆移动电话，以便接收短信通知）"],
    height: ["身高"],
    selfEvaluation: ["自我评价"],
    desiredRoles: ["期望岗位", "意向岗位", "应聘岗位", "投递岗位", "目标岗位", "求职岗位"],
    desiredCities: ["期望城市", "意向城市", "工作城市", "工作地点", "期望工作地点", "意向工作地点", "期望工作城市"],
    expectedSalary: ["期望薪资", "期望月薪", "期望月薪（元）", "期望年薪", "薪资期望", "期望薪酬"],
    availableDate: ["可到岗时间", "到岗时间", "预计到岗时间", "预计到岗日期", "最早到岗日期", "可入职时间"],
    industryCategory: ["行业类别", "所属行业", "行业分类"],
    occupationCategory: ["职业类别", "职位类别", "岗位类别"],
    guardianOccupation: ["父母或监护人职业", "监护人职业", "父母职业"],
    fatherOccupation: ["父亲职业", "父亲工作", "父亲从事职业"],
    motherOccupation: ["母亲职业", "母亲工作", "母亲从事职业"],
    school: ["学校", "学校名称", "毕业院校", "就读学校", "院校名称"],
    // Profile degree currently stores 学历. 学位 is a different fact and must
    // remain unanswered until it has its own confirmed profile field.
    degree: ["学历", "最高学历", "学历层次"],
    major: ["专业", "专业名称", "所学专业"],
    startDate: ["开始时间", "入学时间", "起始时间", "开始日期"],
    endDate: ["结束时间", "毕业时间", "截止时间", "结束日期"],
    projectName: ["项目名称", "项目名"],
    projectDescription: ["项目描述", "项目经历", "项目内容", "项目职责", "项目说明"]
  };

  function normalize(value) {
    return String(value ?? "")
      .replace(/\(必填\)|（必填）|\(选填\)|（选填）/g, "")
      .replace(/[＊*：:！!？?，,。\.\s\u00a0]/g, "")
      .trim()
      .toLocaleLowerCase();
  }

  const aliasMap = new Map();
  for (const [key, aliases] of Object.entries(definitions)) {
    for (const alias of aliases) {
      const token = normalize(alias);
      const keys = aliasMap.get(token) || new Set();
      keys.add(key);
      aliasMap.set(token, keys);
    }
  }

  function classify(labels) {
    const candidates = new Set();
    for (const label of labels || []) {
      const keys = aliasMap.get(normalize(label));
      if (keys) for (const key of keys) candidates.add(key);
    }
    if (candidates.size === 1) return { key: [...candidates][0], reason: "exact_alias" };
    if (candidates.size > 1) return { key: null, reason: "ambiguous_label", candidates: [...candidates] };
    return { key: null, reason: "unknown_question" };
  }

  function selectOption(options, answers) {
    const values = (Array.isArray(answers) ? answers : [answers])
      .map(normalize).filter(Boolean);
    if (!values.length) return { index: -1, reason: "missing_profile_value" };
    const found = [];
    for (let i = 0; i < options.length; i += 1) {
      const option = options[i];
      if (option.disabled) continue;
      if (values.includes(normalize(option.label)) || values.includes(normalize(option.value))) found.push(i);
    }
    if (found.length === 1) return { index: found[0], reason: "exact_option" };
    return { index: -1, reason: found.length ? "ambiguous_option" : "option_not_found" };
  }

  function validValue(key, raw) {
    const value = String(raw ?? "").trim();
    if (!value) return { valid: false, reason: "missing_profile_value" };
    if (key === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { valid: false, reason: "invalid_profile_value" };
    if (key === "phone" && !/^1[3-9]\d{9}$/.test(value)) return { valid: false, reason: "invalid_profile_value" };
    if (/Date$/.test(key) && !/^\d{4}-\d{2}(-\d{2})?$/.test(value)) return { valid: false, reason: "invalid_profile_value" };
    return { valid: true, value };
  }

  const api = { definitions, normalize, classify, selectOption, validValue };
  root.ResumeMatcher = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
