# ATS engine suggestion select ownership / custom-add r1

单名：`ats-engine-select-ownership-custom-add-r1`。
Base：`d1fec79d83b5137d5c083ac7c694bda926250927`（PR #271 head）。
目标分支：`cursor/expand-night-ats-f861`。继续叠在 #271 上，保留 #269、#270、#271 的完整改动。

异步联想控件可能在输入查询后才挂载菜单。原实现先等待菜单、后输入查询，导致已确认局部结构的控件也提前返回 `select_ownership_unconfirmed`；同时写入路径仅限教育专业。同类学校控件走普通文本路径时，查询文字也不能证明实际选择已经提交。

现在按单输入 suggestion 控件结构选路，继续使用原有标签、已确认档案值及重复记录绑定门槛。先在已确认的局部组件中聚焦并输入查询，再确认唯一所属菜单；显式 ARIA 引用不允许借用附近或其它控件的菜单。缺失目标可以等待挂载，共享归属、多目标、多输入、多展示、嵌套选择器均保持 manual。

优先点击唯一、可用、精确匹配的选项，兼容没有 ARIA 的 common-item 结构及独立副标题。查询文字、空展示、“暂无选项”、提示文案和仍打开的菜单不能作为成功读回。等候异步建议后，没有精确匹配项时可点击所属菜单中唯一的“添加××全称”动作；名称来自已确认的问题标签，不按字段名或站点特判。其它非匹配建议不会阻止明确的自定义添加入口。

自定义动作可以是按钮或局部 span/div，逐次检查动作及其交互祖先，阻止保存、提交、编辑、新建及带写请求属性的动作。异步替换编辑器时只在原 slot 内等待，确认同一档案路径、问题、表单、记录身份及仍为 ready 后，才向普通文本编辑器发送 input/change/blur。不点击确认弹窗，不发送 Enter。未知弹窗、跨记录替换、另一选择器或归属不明一律 manual。

L1 开启时仍只使用 MAIN 已确认的搜索控件，替换框不借 legacy 可见性进入扫描，原 field_changed 契约保留。

readiness 继续为 advisory；登录表单零写、占位符不作标签、教育标签关联、记录索引及 profile guard 保留。工作、实习、最高学历的语义支持范围不扩展。Never-Save 保持，不自动进入编辑/新建页面，不使用现场模型识别，`liveSupportClaimed=false`。

改动文件：

| 文件 | 内容 |
| --- | --- |
| `src/content/engine.js` | 通用 suggestion ownership、query 后菜单挂载、真实选项与异步 custom-add、独立读回及写前守卫；revision 30 |
| `tests/engine-select-ownership-custom-add.test.mjs` | 23 项脱敏控件回归，交换学校/专业/自定义问题，验证异步依赖与 Never-Save 边界 |
| `tests/cms-basic-info-gaps.test.mjs` | 更新 reinjection revision 断言 |
| `tests/engine-edu-select-label.test.mjs` | 更新 reinjection revision 断言 |
| `tests/l1-write-route.test.mjs` | 更新 reinjection revision 断言 |
| `SOURCE_INVENTORY.json` | 仅更新本单涉及的现有条目和产品摘要，保留其它条目 |
| `docs/ATS_ENGINE_SELECT_OWNERSHIP_CUSTOM_ADD_R1.md` | 本交接记录 |

验证命令（PowerShell）：

```powershell
$env:CHROME_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'

node --test "tests/engine-*.test.mjs" tests/matcher-basic-degree.test.mjs tests/matcher.test.mjs tests/l2-semantics-memory.test.mjs tests/l3-ats-profiles.test.mjs tests/ats-content-advisory.test.mjs tests/auto-form-readiness.test.mjs tests/form-readiness.test.mjs tests/resume-form-flow.test.mjs tests/cms-basic-info-gaps.test.mjs tests/basic-task-readiness.test.mjs tests/ats-basic-auto-wiring.test.mjs tests/product-paths-whitelist.test.mjs tests/guard-worker-auto-runners.test.mjs tests/never-save-guard.test.mjs

node --test "tests/l1-*.test.mjs" "tests/paid-ats-*.test.mjs"

powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-internal.ps1

$env:ZOO_EXTENSION=(Resolve-Path 'dist/edge-internal-v0.1.4.9-20261031-024253/extension').Path
npm run test:zoo

git diff --check
```

最终结果：相关 unit **576 passed / 0 failed / 0 skipped**（包含新增 23 项控件测试）；L1-batch **936 passed / 0 failed / 0 skipped**；完整 zoo **131 passed / 0 failed / 0 skipped**；build-internal **155 个文件，通过**；`git diff --check` 通过。额外针对 L1 替换控件的 zoo 子集 **6/6 通过**。

最终构建：`dist/edge-internal-v0.1.4.9-20261031-024253/extension`，155 个产品文件；与当前源码逐文件比较，差异为 0。
ZIP：同级上层 `resume-autofill-edge-v0.1.4.9.zip`。
ZIP SHA-256：`6d77cb610ec60736894d585ec4348cb1e896b5546a13eafc67ad2e9fbb650c64`。

夹具只使用虚构占位资料，真实 DOM 事件驱动查询、选项和自定义编辑器，不伪造组件成功回执。验证所有可填目标的写后读回，同时断言零网络调用、邻居值保留及零保存/提交/编辑/新建动作。原专业 34 项、教育标签和记录绑定回归继续纳入相关 unit。

真实页面仅只读附着两个获准标签，读取脱敏控件结构；每次附着期间使用 Fetch 放行 GET、abort 非 GET，没有点击、输入、派发事件或创建标签。没有真实填写、保存、提交或真实写请求。未读取冻结验收目录；没有创建或写入 `after-edu-r4`。用户原有 5 个无关改动保留且不提交。

这些结果属于离线工程验证，不代表真站验收通过。Dev 待验：两个获准页面 Never-Save 一键填写后，学校、学历、专业各至少一次写后读回成功；专业非空、不含“暂无选项”且匹配档案；关键字段读回大于 3/12；非 GET 为 0。`after-edu-r4` 由 Dev 写入。
