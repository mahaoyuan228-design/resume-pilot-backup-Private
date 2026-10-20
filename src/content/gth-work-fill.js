// Shipped GTH 工作经验 fill for the single already-open editor.
// Message: GTH_WORK_FILL. Requires src/content/gth-open-fill.js.
// The caller opens the editor. This script never opens one and never clicks
// 保存 / 提交 / 投递 / 删除.
// 任职时间 reuses the education dual el-date-editor--month writer (YYYY-MM | YYYY-MM).
// The shared writer binds the .el-picker-panel that this editor's open click shows
// (Element-UI teleports it to document.body; not closest(.el-date-editor)).
// Education may reuse one panel node. Work's two editors do not: a quiet start
// husk on body poisons the end open, so that open is dismissed, every quiet husk
// is detached, and the end editor is opened again with zero quiet panels before
// a.cell. It waits out el-zoom-in-top-enter*. End readback must be the requested
// YYYY-MM. A husk that cannot be removed, a second pending panel, or a year step
// other than ±1 fails closed.
// 职位类别 and 公司所属行业 use the intent cascader: exact 一级||二级, L1 click, then L2.
// 薪资 is an el-input/select-l hybrid with no option list in the census, so it stays
// 'control_not_supported'. liveSupportClaimed stays false.
(() => {
  const engine = globalThis.ResumeGthOpenFill;
  if (typeof engine?.install !== 'function') return;
  engine.install({
    globalName: 'ResumeGthWorkOpen',
    messageType: 'GTH_WORK_FILL',
    statusType: 'GTH_WORK_FILL_STATUS',
    section: '工作经验',
    sectionIndex: 3,
    scope: 'gth_work_open',
    fact: 'experience',
    fields: [
      { question: '职位名称', key: 'position', kind: 'text', required: true, max: 200 },
      { question: '职位类别', key: 'jobCategory', kind: 'cascader', required: true, max: 200 },
      { question: '公司名称', key: 'organization', kind: 'text', required: true, max: 200 },
      { question: '任职时间', key: 'startDate', kind: 'monthRange', required: true, max: 7, shape: 'month', keys: ['startDate', 'endDate'] },
      { question: '工作地区', key: 'workArea', kind: 'text', required: false, max: 200 },
      { question: '职责与业绩', key: 'description', kind: 'textarea', required: true, max: 4000 },
      { question: '公司所属行业', key: 'industry', kind: 'cascader', required: true, max: 200 },
      { question: '公司介绍', key: 'companyIntro', kind: 'textarea', required: false, max: 4000 },
      { question: '所属部门', key: 'department', kind: 'text', required: false, max: 200 },
      { question: '汇报对象', key: 'reportTo', kind: 'text', required: false, max: 200 },
      { question: '下属人数', key: 'subordinateCount', kind: 'text', required: false, max: 200 },
      { question: '薪资', key: 'salary', kind: 'unsupported', required: false, max: 80, shape: 'salary', keys: ['salary'] },
      { question: '离职原因', key: 'leaveReason', kind: 'textarea', required: false, max: 4000 }
    ]
  });
})();
