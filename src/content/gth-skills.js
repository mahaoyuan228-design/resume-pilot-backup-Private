// Shipped GTH 职业技能与特长 fill. Message: GTH_SKILLS_FILL.
// Requires the already-open editor engine in src/content/gth-open-fill.js.
// One required textarea, maxlength 4000. Never clicks 保存 / 提交 / 投递 / 删除.
(() => {
  const engine = globalThis.ResumeGthOpenFill;
  if (typeof engine?.install !== 'function') return;
  engine.install({
    globalName: 'ResumeGthSkills',
    messageType: 'GTH_SKILLS_FILL',
    statusType: 'GTH_SKILLS_FILL_STATUS',
    section: '职业技能与特长',
    sectionIndex: 4,
    scope: 'gth_skills_one',
    fact: 'custom',
    fields: [
      { question: '职业技能与特长', key: 'skills', kind: 'textarea', required: true, max: 4000 }
    ]
  });
})();
