# ATS engine major select value r1

单名：`ats-engine-major-select-value-r1`。
Base：`fda541c8b354e622c12e8667e39edf9bf3977d04`（PR #270 head）。
目标分支：`cursor/expand-night-ats-f861`。本单继续叠在 #270 上，保留 #269 和 #270 的全部改动。

教育行的专业下拉现在先输入档案值进行检索，再点击唯一、可用且精确匹配的真实选项。查询框中的临时文字不再代表选择成功；必须从所属控件的独立已选展示读回档案专业，并确认菜单关闭。空态、添加提示、隐藏展示、未提交查询和最终回退都不能算成功。

等待依赖或异步选项后，若仍没有可用选项，可以点击所属菜单中唯一的“添加专业全称”入口。只有入口明确切换为普通文本编辑器，且原位置、问题、档案路径和教育记录身份均保持一致，才继续写入并提交本地输入事件。未知弹窗、其它选择器、跨记录替换或不明确归属均转 manual。没有 Enter、保存、提交、编辑简历、新建简历或新增记录动作。

范围限于已绑定的 `education.N.major`。学校、学历、工作、实习和最高学历保留原有路由。readiness 保持 advisory；登录表单零写、占位符不作标签、教育标签关联及记录索引守卫继续生效。`liveSupportClaimed=false`，不按域名或站点 ID 特判，不增加现场模型识别。

改动文件：

| 文件 | 内容 |
| --- | --- |
| `src/content/engine.js` | 专业查询、真实选项与自定义输入路径，所属关系及逐次写前守卫，独立展示读回；revision 29 |
| `src/content/controls/native.js` | 通用 dropdown 查询框不得降级为 native-text；异步变成查询框时停止原文本计划 |
| `tests/engine-major-select-value.test.mjs` | 34 项脱敏专业、依赖、菜单生命周期、异步换绑与 Never-Save 回归 |
| `tests/l1-select-value-bind.test.mjs` | 4 项查询框防降级测试，保留普通文本、原生 select 及已确认 ARIA combobox |
| `tests/cms-basic-info-gaps.test.mjs`、`tests/engine-edu-select-label.test.mjs`、`tests/l1-write-route.test.mjs` | 同步 reinjection revision 断言 |
| `SOURCE_INVENTORY.json` | 仅更新本单涉及的现有条目及产品摘要；产品源码、构建和对应摘要已核对一致 |
| `docs/ATS_ENGINE_MAJOR_SELECT_VALUE_R1.md` | 本交接记录 |

验证命令（PowerShell）：

```powershell
$env:CHROME_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'

# 相关 unit：553 passed / 0 failed / 0 skipped，含新专业测试
node --test "tests/engine-*.test.mjs" tests/matcher-basic-degree.test.mjs tests/matcher.test.mjs tests/l2-semantics-memory.test.mjs tests/l3-ats-profiles.test.mjs tests/ats-content-advisory.test.mjs tests/auto-form-readiness.test.mjs tests/form-readiness.test.mjs tests/resume-form-flow.test.mjs tests/cms-basic-info-gaps.test.mjs tests/basic-task-readiness.test.mjs tests/ats-basic-auto-wiring.test.mjs tests/product-paths-whitelist.test.mjs tests/guard-worker-auto-runners.test.mjs tests/never-save-guard.test.mjs

# 专业专项独立复核：34 passed / 0 failed / 0 skipped
node --test tests/engine-major-select-value.test.mjs

# L1 + batch/readback：936 passed / 0 failed / 0 skipped
node --test "tests/l1-*.test.mjs" "tests/paid-ats-*.test.mjs"

# build-internal：通过，155 个文件
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-internal.ps1

# 使用本次最终产品源码的内部构建
$env:ZOO_EXTENSION=(Resolve-Path 'dist/edge-internal-v0.1.4.9-20261031-021502/extension').Path
npm run test:zoo

git diff --check
```

完整 zoo：**131 passed / 0 failed / 0 skipped**。
构建目录：`dist/edge-internal-v0.1.4.9-20261031-021502/extension`。
ZIP：同目录上层 `resume-autofill-edge-v0.1.4.9.zip`。
ZIP SHA-256：`dbdbf2e703ba5988d3ae92a0aacc01206333fa54704870ab51f38aa8eca1a449`。

新增夹具使用虚构占位资料，正向检索和自定义场景均验证学校、学历、专业各一次写后读回，加一个基础字段共 4 次成功；并断言零网络请求、零保存/提交/编辑/新建动作及邻居值不变。这些是离线工程证据，不代表真站验收通过。

本单只读附着两个获准页面，读取专业控件结构；没有新建标签、点击、输入、派发事件或设置 Fetch 拦截。未执行真实填写、保存或提交。用户原有 5 个无关改动保留且不纳入提交。

Dev 待验：在两个获准页面执行 Never-Save 一键填写，学校 AND 学历 AND 专业各至少一次写后读回；专业读回匹配档案且不含“暂无选项”；关键字段成功数大于 3/12；非 GET 为 0。这里不自报真站通过。
