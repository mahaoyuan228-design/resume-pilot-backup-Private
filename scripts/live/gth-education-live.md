# GTH 教育经历复杂控件 · Never-Save 验收入口

本次 harness 修复基线：`947e318`（`cursor/expand-night-ats-f861`，含 PR #76 复杂控件 runner）。
本次交付是可试填、回读、输出 DOM 诊断的 runner；`liveSupportClaimed=false`。
开发验证只使用离线合成 DOM / fake CDP，没有连接真机 9239，没有新的 live PASS。
当前基线没有 `handover/GTH_EDUCATION_LIVE_TRY_2026-10-22.md`，本次未引用其未获取内容。

## PowerShell 跑法（由真机验收方执行）

在仓库根目录运行；现有 Edge CDP 9239 中需已登录并打开
`https://hr.gtht.com/resume/edit/`。runner 不登录、不导航，只附加已有标签页。
下列值由验收方输入，属于本轮试填值，不会保存为站点教育记录。

```powershell
$env:PORT = '9239'
$env:OUTDIR = Join-Path $PWD '_temp-scripts/gth-education-complex'
$env:TARGET_MODE = 'existing'
$env:ROW_INDEX = '0'
$env:STEP_TIMEOUT_MS = '120000'
$env:FIELDS = '学历,是否统招,在校时间,专业类别'
$env:DEGREE = Read-Host '学历：页面精确选项名称'
$env:UNIFIED_ADMISSIONS = Read-Host '是否统招：是 或 否'
$env:START_DATE = Read-Host '在校开始：YYYY-MM'
$env:END_DATE = Read-Host '在校结束：YYYY-MM'
$env:MAJOR_CATEGORY = Read-Host '专业类别：精确叶子名称 或 父级/叶子路径'
node scripts/live/gth-education-live.mjs
$LASTEXITCODE
Get-Content (Join-Path $env:OUTDIR 'gth-education-live.json') -Raw
```

可把 `FIELDS` 缩到单项，例如 `学历` 或 `在校时间`；只校验、确认、试填所选项的参数。
在校时间必须同时给开始和结束，且开始不晚于结束。类别路径最多六层，不能含空层。
未提供对应参数时在附加 CDP 之前报错，避免猜测学历、统招或日期。

无教育行时可显式设 `$env:TARGET_MODE='new'`，走现有 writer 的“添加/新增”，最后仍取消。
已有行模式仍使用行内编辑图标，不依赖标题栏“编辑”。

回归 PR #74 plain 路径可移除 `FIELDS`；默认七个 plain 试填值保持原样：

```powershell
Remove-Item Env:FIELDS -ErrorAction SilentlyContinue
node scripts/live/gth-education-live.mjs
```

## 证据与判定

| 项目 | 通过条件 / 失败证据 |
| --- | --- |
| 学历 | 真实下拉操作后 writer verified，关闭态 input 精确回读；disabled 的学历即使值相同也保持 `control_not_supported` |
| 是否统招 | 只操作教育表单内唯一“是/否”组的可见标签，以 native radio.checked 回读 |
| 在校时间 | 开始、结束两个 writer 结果都 verified，最终按 DOM 顺序回读为 `YYYY-MM 至 YYYY-MM` 并精确比对；一端失败或后续漂移均不能通过 |
| 专业类别 | 已打开的所属弹层内按精确路径/叶子和 UID 操作；关闭态可显示完整路径或最终叶子；仅本弹层内受约束的“确定”可点击 |
| 不支持 | `fields[].reason=control_not_supported`，`detail` 保留 writer/reader 原因，`dom` 提供标签匹配数、控件类型、class、可见性、disabled/readOnly、弹层结构等有界描述 |

如果 writer 在预检失败后自行取消，证据保留取消前的结构并标注
`dom.stage=before_cancel`；其值置空，不能把已关闭表单的旧值当作成功回读。
合成测试中的 UID/选项/结构仅用于测试，不是采集的 live DOM。

2026-10-22 验收方反馈：专业类别 writer 已 `verified/readback_reapplied`，但 harness
在嵌套 `.cascader-wrap` / `.professional-category`（`categoryCount=2`）时误报
`category_structure_changed`。回读现按同一祖先链上的唯一控件判断：最内层 wrapper
须直接拥有唯一 trigger 和唯一 popup，且 trigger 内只有一个可见、只读、可用的显示 input。
独立 wrapper、trigger/popup 分属不同层、重复 trigger/popup 仍拒绝，原始 `categoryCount`
诊断保留。修复仅经合成夹具验证，没有新增 live PASS，也不提升支持声明。

输出还包括实际 `tipSha`、所选 `fillQuestions`、参数、逐项 writer 结果、点击审计、请求审计、
取消结果，以及 `fill.activeField` / `fill.selectorStep`。所有结果保持
`neverSave=true`、`liveSupportClaimed=false`；这不等于宣称控件已获真机支持。
未选中的复杂字段继续保留 `control_not_supported`，不会因已有显示值而冒充试填成功。

退出码：`0` 表示本轮所选字段与回读通过、plain 只读检查通过、取消确认、审计完整；
`1` 表示连接/协议/超时问题；`2` 表示控件不支持、回读失败、writer 失败、取消或审计未完成；
`3` 表示禁用点击或非 GET 请求被记录。退出码 0 仍不提升 live support 声明。

## Never-Save 边界

- 点击守卫覆盖 `.click()`、派发 click 和捕获事件；拒绝保存、提交、投递、删除、导航链接、submit 控件和表单级“确定”。
- degree/month 的 body 弹层只有在对应教育控件先触发后才可操作；已打开的无主弹层、多弹层、外部区块控件会停止。类别弹层必须属于教育项。
- 拦截注入后的页面 fetch/XHR/beacon 写请求和 form submit；没有字典 POST 放行名单。CDP 额外观察到的非 GET 请求也使本轮失败。CDP 观察本身不是请求拦截，缓存的旧 API 引用或 worker 不属于页面 hook 的拦截保证。
- 如果 writer 的 CDP 调用失败/超时（页面异步任务可能未结束），或取消未确认，保留守卫，输出 `hooksRestored=false`。验收方应手动刷新标签页后重试，不要在该标签页继续保存。
- 不改 CMS 核心、打包入口或支持状态；没有读取或使用私钥。

## 离线检查

```powershell
npm ci --ignore-scripts
node --test (Get-ChildItem tests/gth-*.test.mjs).FullName
npm run test:paid-rebuild
npm run test:paid-qa
npm run test:live-harvest
```

新增测试覆盖实际 shipped `fullTrial` 与 runner 守卫组合、四项复杂控件、日期单端失败/最终漂移、
禁用学历、类别 UID/文字/链接攻击、重复选项、不支持结构、保存/提交/全局确定拒绝、字典 POST 拦截、
取消前结构保留，以及 `categoryCount=2` 嵌套 wrapper 的完整试填/回读/取消和歧义结构拒绝。
测试不会打开真机浏览器。
