/* Shared by the Edge content script and Node's built-in test runner. */
(function (root) {
  "use strict";

  const definitions = {
    fullName: ["姓名", "真实姓名", "中文姓名", "候选人姓名", "应聘者姓名", "本人姓名"],
    identityNumber: ["证件号", "证件号码"],
    gender: ["性别"],
    birthDate: ["出生日期", "出生年月", "出生年月日", "生日"],
    email: ["邮箱", "电子邮箱", "电子邮件", "邮箱地址", "联系邮箱", "电子邮件地址",
      "电子邮箱（请尽量使用163、qq等常见邮箱，尽量不要用gmail、hotmail等境外邮箱或学校邮箱）"],
    phone: ["手机号", "手机号码", "手机", "联系电话", "联系手机", "电话", "移动电话",
      "移动电话（请填写中国大陆移动电话，以便接收短信通知）"],
    height: ["身高"],
    selfEvaluation: ["自我评价", "自我介绍", "个人评价"],
    desiredRoles: ["期望岗位", "意向岗位", "应聘岗位", "投递岗位", "目标岗位", "求职岗位"],
    desiredCities: ["期望城市", "意向城市", "工作城市", "工作地点", "期望工作地点", "意向工作地点", "期望工作城市"],
    expectedSalary: ["期望薪资", "期望月薪", "期望月薪（元）", "期望年薪", "薪资期望", "期望薪酬"],
    availableDate: ["可到岗时间", "到岗时间", "预计到岗时间", "预计到岗日期", "最早到岗日期", "可入职时间"],
    industryCategory: ["行业类别", "所属行业", "行业分类"],
    occupationCategory: ["职业类别", "职位类别", "岗位类别"],
    guardianOccupation: ["父母或监护人职业", "监护人职业", "父母职业"],
    fatherOccupation: ["父亲职业", "父亲工作", "父亲从事职业"],
    motherOccupation: ["母亲职业", "母亲工作", "母亲从事职业"],
    school: ["学校", "学校名称", "毕业院校", "就读学校", "院校名称", "就读院校", "院校"],
    // Profile degree currently stores 学历. 学位 is a different fact and must
    // remain unanswered until it has its own confirmed profile field.
    degree: ["学历", "最高学历", "学历层次"],
    major: ["专业", "专业名称", "所学专业", "就读专业"],
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

  // L2 uses the profile's existing schema. A section and an explicit record
  // index are required before a repeated question can become a profile path.
  // The legacy one-argument classify contract above remains available.
  const sectionNames = {
    basic: ["基本信息", "个人信息", "个人基本信息", "个人资料", "联系方式"],
    education: ["教育经历", "教育背景", "学习经历", "学历信息"],
    work: ["工作经历", "工作经验", "任职经历", "工作信息"],
    internship: ["实习经历", "实习经验", "实习信息"],
    project: ["项目经历", "项目经验", "项目介绍"],
    intent: ["求职意向", "应聘意向", "岗位意向"],
    certificate: ["证书", "证书信息", "证书资格", "资格证书", "获奖证书"]
  };
  const basicKeys = ["fullName", "identityNumber", "gender", "birthDate", "email", "phone", "height", "selfEvaluation", "currentCity"];
  const intentKeys = ["desiredRoles", "desiredCities", "expectedSalary", "availableDate", "availabilityNote"];
  const repeatedFields = {
    education: ["school", "degree", "major", "startDate", "endDate", "majorCategory", "unifiedAdmissions", "campusActivities", "gradeRank", "majorDescription", "gpa", "schoolLocation"],
    experience: ["type", "organization", "position", "startDate", "endDate", "description", "jobCategory", "industry", "workArea", "companyIntro", "department", "reportTo", "subordinateCount", "leaveReason", "salary"],
    projects: ["name", "role", "description"]
  };
  const sectionDefinitions = {
    basic: Object.fromEntries(basicKeys.filter(key => definitions[key]).map(key => [key, definitions[key]])),
    intent: Object.fromEntries(intentKeys.filter(key => definitions[key]).map(key => [key, definitions[key]])),
    education: {
      school: definitions.school, degree: definitions.degree, major: definitions.major,
      startDate: ["开始时间", "开始日期", "起始时间", "入学时间", "入学日期", "就读开始时间"],
      endDate: ["结束时间", "结束日期", "截止时间", "毕业时间", "毕业日期", "预计毕业时间"],
      gpa: ["GPA", "平均学分绩点", "平均绩点"], gradeRank: ["专业排名", "成绩排名"],
      schoolLocation: ["学校所在地", "院校所在地"], majorDescription: ["专业描述", "专业介绍"]
    },
    work: {
      organization: ["企业名称", "公司名称", "任职公司", "工作单位", "单位名称", "雇主名称"],
      position: ["职位名称", "担任职位", "任职岗位", "工作岗位", "职务"],
      startDate: ["开始时间", "开始日期", "起始时间", "入职时间", "入职日期", "任职开始时间"],
      endDate: ["结束时间", "结束日期", "截止时间", "离职时间", "离职日期", "任职结束时间"],
      description: ["工作描述", "工作职责", "职责描述", "主要职责", "工作内容"],
      department: ["所在部门", "任职部门", "部门名称"], industry: ["所属行业", "公司行业", "企业行业"],
      workArea: ["工作地点", "工作城市", "任职地点"], leaveReason: ["离职原因"],
      salary: ["月薪", "税前月薪"]
    },
    project: { name: definitions.projectName, role: ["项目角色", "担任角色"], description: definitions.projectDescription }
  };
  sectionDefinitions.internship = {
    ...sectionDefinitions.work,
    organization: [...sectionDefinitions.work.organization, "实习单位", "实习公司"],
    position: [...sectionDefinitions.work.position, "实习岗位", "实习职位"],
    startDate: [...sectionDefinitions.work.startDate, "实习开始时间"],
    endDate: [...sectionDefinitions.work.endDate, "实习结束时间"],
    description: [...sectionDefinitions.work.description, "实习内容", "实习职责", "实习描述"]
  };
  sectionDefinitions.basic.currentCity = ["现居住地", "现居城市", "当前居住城市"];
  sectionDefinitions.intent.availabilityNote = ["到岗说明", "到岗时间说明"];

  function sectionKind(section) {
    const token = semanticNormalize(section).replace(/必填$|选填$/u, "");
    return Object.keys(sectionNames).find(kind => kind === section || sectionNames[kind].some(name => semanticNormalize(name) === token)) || null;
  }

  function semanticNormalize(value) { return normalize(String(value ?? "").normalize("NFKC")); }

  function isProfileKey(path) {
    if (typeof path !== "string") return false;
    if ([...basicKeys, ...intentKeys, "workStart"].includes(path)) return true;
    const match = /^(education|experience|projects)\.(0|[1-9]\d?)\.([A-Za-z]+)$/u.exec(path);
    return !!match && Number(match[2]) < 30 && repeatedFields[match[1]].includes(match[3]);
  }

  function resolveField({ labels, section = "", index = null } = {}) {
    const manual = reason => ({ status: "manual", key: null, profileKey: null, reason });
    if (!Array.isArray(labels) || !labels.length || labels.some(label => typeof label !== "string")) return manual("unlabelled_field");
    const kind = sectionKind(section);
    if (section && !kind) return manual("section_unconfirmed");
    if (kind === "certificate") return manual("profile_field_unavailable");
    const tables = kind ? [sectionDefinitions[kind]] : [sectionDefinitions.basic, sectionDefinitions.intent];
    const candidates = new Set();
    for (const table of tables) for (const [key, aliases] of Object.entries(table || {})) {
      if (labels.some(label => aliases.some(alias => semanticNormalize(alias) === semanticNormalize(label)))) candidates.add(key);
    }
    if (candidates.size !== 1) return manual(candidates.size ? "ambiguous_label" : "unknown_question");
    const key = [...candidates][0];
    if (["education", "work", "internship", "project"].includes(kind)) {
      if (!Number.isInteger(index) || index < 0 || index >= 30) return manual("ambiguous_repeat_group");
      const collection = kind === "education" ? "education" : kind === "project" ? "projects" : "experience";
      return { status: "mapped", key, profileKey: `${collection}.${index}.${key}`, context: { kind, index }, reason: "section_alias" };
    }
    return { status: "mapped", key, profileKey: key, reason: "exact_alias" };
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

  const api = { definitions, sectionDefinitions, sectionNames, normalize, classify, sectionKind, resolveField, isProfileKey, selectOption, validValue };
  root.ResumeMatcher = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
