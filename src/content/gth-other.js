// Shipped GTH 其他信息 fill. Message: GTH_OTHER_FILL.
// Requires the already-open editor engine in src/content/gth-open-fill.js.
// 标题 is a required el-input. 描述 is a required textarea.
// Never clicks 保存 / 提交 / 投递 / 删除.
(() => {
  const engine = globalThis.ResumeGthOpenFill;
  if (typeof engine?.install !== 'function') return;
  engine.install({
    globalName: 'ResumeGthOther',
    messageType: 'GTH_OTHER_FILL',
    statusType: 'GTH_OTHER_FILL_STATUS',
    section: '其他信息',
    sectionIndex: 6,
    scope: 'gth_other_two',
    fact: 'custom',
    fields: [
      { question: '标题', key: 'title', kind: 'text', required: true, max: 4000 },
      { question: '描述', key: 'description', kind: 'textarea', required: true, max: 4000 }
    ]
  });
})();
