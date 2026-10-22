// Shipped GTH 工作经验 fill for the single already-open editor.
// Message: GTH_WORK_FILL. Requires src/content/gth-open-fill.js.
// The caller opens the editor. This script never opens one and never clicks
// 保存 / 提交 / 投递 / 删除.
// 任职时间 reuses the education dual el-date-editor--month writer (YYYY-MM | YYYY-MM).
// The shared writer binds the .el-picker-panel that this editor's open click shows
// (Element-UI teleports it to document.body; not closest(.el-date-editor)).
// A quiet start panel may stay connected while the end panel is the only pending
// one. Two pending panels and a year step other than ±1 fail closed. A month click
// may paint the input while the model stays empty, or leave the input empty, and
// may close or remove the panel, or replace the editor input, before the gate
// runs. Painted DOM is not acceptance. After that click, while the editor's
// current input is connected, the extension worker still accepts the month in
// the page world (handleMonthPick / emitInput,
// no inserted script), including when the panel stays connected, the input is
// still empty, and a start husk is still pending. That husk is dismissed before
// the ask whether or not this panel is connected, and it is not a reason to
// skip the ask. A panel still connected after the dismiss is marked for
// handleMonthPick. A missing panel is not marked; MAIN uses the editor Vue.
// Two active month panels fail closed.
// picked and emitted stay. dual, bad-year, mismatch, neither pick nor
// emit, and a blank readback after close fail closed. It waits out
// el-zoom-in-top-enter*. The range form-item is site-validated only after
// both months match; a half-filled 请选择任职时间 error is not a start-month failure.
// 职位类别 and 公司所属行业 use the intent cascader: exact 一级||二级, L1 click, then L2.
// 薪资 writes digits from experience.N.salary into the 2026-10-22 probe control:
// div.el-input.select-l > input.el-input__inner (type=text, maxlength=10),
// sibling text 元/月. It is not .el-select.select-l. The probe click produced
// options=[], so this path does not open a dropdown and does not POST.
// A missing input or any other shape stays 'control_not_supported'.
// Pending live Never-Save. liveSupportClaimed stays false. This does not claim the site is supported.
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
      { question: '薪资', key: 'salary', kind: 'salaryText', required: false, max: 10, shape: 'salaryText', keys: ['salary'] },
      { question: '离职原因', key: 'leaveReason', kind: 'textarea', required: false, max: 4000 }
    ]
  });
})();
