// Shipped GTH 教育经历 fill for the single already-open editor.
// Message: GTH_EDUCATION_FILL. Requires src/content/gth-open-fill.js.
// 学历 reuses the intent el-select rules (body dropdown after the first open,
// same-value decided from the input before a menu is required).
// 在校时间 fills two el-date-editor--month inputs when that live shape is present.
// That shared writer site-validates the form-item only after both months match,
// so a half-filled 请选择在校时间 error does not stop the start month.
// 专业类别 fills a readonly input-l.pointer / div.input-l.pointer picker.
// Any other shape stays control_not_supported. Never clicks 保存 / 提交 / 投递 / 删除.
(() => {
  const engine = globalThis.ResumeGthOpenFill;
  if (typeof engine?.install !== 'function') return;
  const DEGREE_LIST = ['请选择', '初中', '高中', '中技', '中专', '大专', '本科', '硕士', 'MBA', '博士', '其他'];
  engine.install({
    globalName: 'ResumeGthEducationOpen',
    messageType: 'GTH_EDUCATION_FILL',
    statusType: 'GTH_EDUCATION_FILL_STATUS',
    section: '教育经历',
    sectionIndex: 1,
    scope: 'gth_education_open',
    fact: 'education',
    fields: [
      { question: '毕业学校', key: 'school', kind: 'text', required: true, max: 200 },
      { question: '专业名称', key: 'major', kind: 'text', required: true, max: 200 },
      { question: '在校活动/职务', key: 'campusActivities', kind: 'textarea', required: false, max: 4000 },
      { question: '在校成绩排名', key: 'gradeRank', kind: 'text', required: false, max: 200, placeholder: '格式：排名/班级人数' },
      { question: '专业描述', key: 'majorDescription', kind: 'textarea', required: false, max: 4000 },
      { question: '绩点', key: 'gpa', kind: 'text', required: false, max: 200 },
      { question: '学校所在地', key: 'schoolLocation', kind: 'text', required: false, max: 200 },
      { question: '学历', key: 'degree', kind: 'select', required: true, max: 20, options: DEGREE_LIST, answers: DEGREE_LIST.slice(1) },
      { question: '是否统招', key: 'unifiedAdmissions', kind: 'radio', required: false, max: 1, answers: ['是', '否'] },
      { question: '在校时间', key: 'startDate', kind: 'monthRange', required: false, max: 7, shape: 'month', keys: ['startDate', 'endDate'] },
      { question: '专业类别', key: 'majorCategory', kind: 'picker', required: false, max: 500, shape: 'category', keys: ['majorCategory'] }
    ]
  });
})();
