# ATS engine label resolve r1

基于 PR #267 head `37390bf52094ceb25547ff63f393a0645bb2fd1e`，目标分支 `cursor/expand-night-ats-f861`。

## 改动

- `src/content/engine.js`：按 form-item 自有问题标签、关联/包装 label、aria-labelledby、aria-label、前置兄弟文本、唯一控件的分组标题解析。覆盖 Ant、Element、iView 和通用多层包装；检查标签与控件归属，避免借用嵌套或共享题目。placeholder/title 属性、提示文字、选中值展示文本均不参与字段映射。保留原标签文字，继续使用现有同义词表；未知题目、未知分区和未确认的重复记录索引保持 manual。
- 同一原生/ARIA form 或局部区域含密码、验证码输入或获取验证码/登录按钮时，区域内全部字段保持 manual，reason 为 `login_form_detected`，不写值、不派发输入事件、不点击按钮。导航中的登录按钮不借用其他简历区域。
- `src/background/controls-write.mjs`：MAIN 写入前同步复查登录区域，覆盖后台等待期间才出现登录控件的情况；ISOLATED 及专用控件写入路径也在每次效果前复查。
- `src/popup/popup.js`：字段原因和汇总提示显示“请先登录”；同页独立简历表单继续显示自己的填写结果。
- 引擎 revision 更新为 26，替换工作页上仍存活的旧 listener。
- `tests/engine-label-resolve.test.mjs`、`tests/engine-login-guard.test.mjs`、`tests/popup-login-hint.test.mjs`：新增脱敏离线回归。七个旧测试文件更新标签定位、真实 DOM harness 或 revision 断言，保留原安全断言。`SOURCE_INVENTORY.json` 更新相关源码与回归测试摘要。

readiness 继续仅作 advisory；扫描和双读回继续面向当前页面；没有新增自动进入编辑/新建入口。Never-Save 守卫和 `liveSupportClaimed=false` 保持不变。工作区原有五个无关改动未纳入本单提交。

## 验证命令

在本 worktree 的 PowerShell 中执行，依赖 Chrome 的测试统一设置：

```powershell
$env:CHROME_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'

# 相关 unit：直接引用 engine 的非 L1 测试，加本单及守卫回归（37 文件）。
$unitFiles=@(git grep -l -e 'engine.js' -- ':(top,glob)tests/*.test.mjs' |
  Where-Object { $_ -notmatch '/l1-' })
$unitFiles+=@(
  'tests/engine-label-resolve.test.mjs','tests/engine-login-guard.test.mjs',
  'tests/popup-login-hint.test.mjs','tests/ats-content-advisory.test.mjs',
  'tests/basic-task-readiness.test.mjs','tests/auto-form-readiness.test.mjs',
  'tests/never-save-guard.test.mjs','tests/guard-worker-auto-runners.test.mjs',
  'tests/product-paths-whitelist.test.mjs','tests/pack-side-effect-import.test.mjs',
  'tests/cms-row-d-network-guard.test.mjs')
node --test --test-concurrency=2 @($unitFiles | Sort-Object -Unique)

# L1 全批次（35 文件）。
node --test --test-concurrency=1 'tests/l1-*.test.mjs'

powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-internal.ps1
$env:ZOO_EXTENSION=(Resolve-Path 'dist/edge-internal-v0.1.4.9-20261031-005129/extension').Path
npm run test:zoo
git diff --check
```

最终结果（2026-10-31）：

| 验证 | 结果 |
| --- | --- |
| 相关 unit（37 文件） | 988 通过，0 失败，0 跳过 |
| L1 全批次（35 文件） | 757 通过，0 失败，0 跳过 |
| 完整 zoo（包含 Batch B） | 131 通过，0 失败 |
| build-internal | 成功；155 个产品文件，ZIP 条目与源码字节检查通过 |
| git diff --check | 通过 |

新增标签、登录区域及提示渲染测试合计 170 项。一次完整 zoo 运行在测试结束清理临时浏览器目录时出现 Windows `EPERM`（130 通过、1 清理失败）；待其他浏览器测试结束后，使用同一构建完整重跑，最终 131/131 通过，未修改或跳过失败断言。

加载目录：`dist/edge-internal-v0.1.4.9-20261031-005129/extension`。
ZIP：同构建目录下的 `resume-autofill-edge-v0.1.4.9.zip`。
ZIP SHA256：`2c6fd74735bb914d8eb66e41d9774aac737936c7046293bf98aaeac66e060fb9`。
三个修改的产品文件已核对工作区源码、构建字节与 inventory 摘要一致。

## 真站交接

只读检查了获准的三个已打开页面的 DOM 结构，启用 Fetch 非 GET 拦截；没有点击、输入、派发事件或执行真实填写。检查期间非 GET 为 0，没有新建浏览器标签。

离线回归不能代替 Dev 的真站验收。请加载本 worktree 构建，在 9239 Edge 上复测两个简历页的一键填写与双读回，关键字段要求大于 2/11；登录页要求 0 写入；三个页面均要求非 GET 为 0。未声称已达到真站门槛。
