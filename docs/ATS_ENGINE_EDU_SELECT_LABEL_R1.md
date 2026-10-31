# ATS engine education/select labels r1

Base: `f3f1a41a64889d80b62980d0a1390bf0095053a7`。目标分支：`cursor/expand-night-ats-f861`。

## 行为与文件

- `src/content/engine.js`：以 select/cascader/combobox 的答案根隔离内部展示、影子文本与选项；前置真实标题继续走现有同义词。支持组件根的关联标签，未确认的多编辑器不共享标签。普通 DIV 的前置分区标题可提供上下文，遇到未知分区立即停止向外借用。只有页面内一个教育区、资料内一条教育记录、学校/学历/专业各一个明确控件，且三个题目属于共同记录下三个独立分支时，才推断 `education.0.*`；其余保持 manual。原生 select 直接读取当前索引的 option，避免缓存的 selectedOptions 产生旧读回。engine revision 27 替换旧 listener。
- `src/background/controls-write.mjs`：连通现有 Element/Ant 单选与 cascader 适配器；确认组件版本及 model 后，以组件根去重并屏蔽内部编辑器。无 input 的单选 combobox 仍须 MAIN 确认；最终结果展示成功的 MAIN 独立读回文本。
- `src/content/controls/extended-controls.js`：已确认的 iView 搜索单选从唯一所属输入框独立读展示值，与组件 model 比较；待定查询、多个展示编辑器及未知版本拒绝写入。`registry.js` revision 23 确保重新注入安装新读回规则。
- 新增 `tests/engine-edu-select-label.test.mjs`、`tests/engine-edu-section-boundary.test.mjs`、`tests/l1-edu-control-candidates.test.mjs`、`tests/l1-ivu-filterable-readback.test.mjs`。使用脱敏占位值和 pinned 真实组件，覆盖三字段写后独立读回、分区/记录歧义、默认关闭、未知版本、读回损坏与重新注入。
- 七个既有测试文件仅同步 revision 断言及提取真实标签函数的 harness；`SOURCE_INVENTORY.json` 只更新本单文件的摘要。

readiness 保持 advisory，登录区域零写入，placeholder/title/提示文字不作标签。未增加自动进入编辑/新建简历、现场大模型识别或按公司域名/站点 ID 的分支。Never-Save 与 `liveSupportClaimed=false` 保持不变。用户原有五个无关改动未纳入提交。

## 验证

```powershell
$env:CHROME_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
$unitFiles=@(git grep -l -e 'engine.js' -- ':(top,glob)tests/*.test.mjs' |
  Where-Object { $_ -notmatch '/l1-' })
$unitFiles+=@(
  'tests/engine-edu-select-label.test.mjs','tests/engine-edu-section-boundary.test.mjs',
  'tests/engine-label-resolve.test.mjs','tests/engine-login-guard.test.mjs',
  'tests/popup-login-hint.test.mjs','tests/ats-content-advisory.test.mjs',
  'tests/basic-task-readiness.test.mjs','tests/auto-form-readiness.test.mjs',
  'tests/never-save-guard.test.mjs','tests/guard-worker-auto-runners.test.mjs',
  'tests/product-paths-whitelist.test.mjs','tests/pack-side-effect-import.test.mjs',
  'tests/cms-row-d-network-guard.test.mjs')
node --test --test-concurrency=2 @($unitFiles | Sort-Object -Unique)
node --test --test-concurrency=1 'tests/l1-*.test.mjs'
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-internal.ps1
$env:ZOO_EXTENSION=(Resolve-Path 'dist/edge-internal-v0.1.4.9-20261031-012417/extension').Path
npm run test:zoo
git diff --check
```

最终源码验证（2026-10-31）：

| 验证 | 结果 |
| --- | --- |
| 相关 unit（39 文件） | 1034 通过，0 失败，0 跳过 |
| L1 全批次（37 文件） | 778 通过，0 失败，0 跳过 |
| 完整 zoo（含 Batch B） | 131 通过，0 失败 |
| build-internal | 成功，155 个产品文件 |
| git diff --check | 通过 |

新增回归合计 67 项。四个修改产品文件已核对源码、构建字节与本单 inventory 摘要一致；其余 inventory 行保持原值。原始日志保存在本地验证目录，不纳入提交。

加载目录：`dist/edge-internal-v0.1.4.9-20261031-012417/extension`。
ZIP：同目录上层 `resume-autofill-edge-v0.1.4.9.zip`。
ZIP SHA256：`298745a054f9f491be21fba4170b1b9e03b9921c038a43f060f0fed7545f3767`。

## 证据边界与 Dev 交接

只读附着两个获准页面，启用 Fetch 非 GET abort；未新建标签、点击、输入、派发事件或执行真实填写。离线 fixture 不含真实个人资料或公司 URL/站点 ID。

真实 iView 组件在普通多层包装中验证写入与两次独立读回。若整个组件被原生 label 包裹，点击选项可能触发 label 的默认激活、重开浮层；测试保留既有失败结果，禁止假报成功。

离线通过不代表真站通过。Dev 仍须在两个获准页面执行 Never-Save 一键填写：学校、学历、专业分别至少一次写后读回成功；关键字段读回大于 3/11；非 GET 为 0。多记录或未知结构继续 manual。
