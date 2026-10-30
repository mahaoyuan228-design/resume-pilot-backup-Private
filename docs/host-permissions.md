# 通用 host 权限门禁（Never-Save）

Batch B 的权限缺口属于引擎能力。实现复用
`src/background/auto-form-readiness.mjs`，无站点或字段判断。

改动文件：`manifest.json`、`src/background/auto-form-readiness.mjs`、
`src/popup/popup.js`、`scripts/lib/ats-extension-harness.mjs`；测试为
`tests/host-permissions.test.mjs`、`tests/ats-basic-auto-wiring.test.mjs`、
`tests/basic-task-readiness.test.mjs`、`tests/cmb-basic-auto.test.mjs`、
`tests/cms-basic-auto.test.mjs`、`tests/gth-basic-auto.test.mjs`、
`tests/zoo/write-route.spec.mjs`，另附本文档。

- `inspectHostPermissions(api, tabId)` 用 `permissions.getAll()` 返回
  `grantedOrigins`，再用 `tabs.get()` 和 `permissions.contains()` 探测当前
  HTTP(S) origin。manifest 声明、资料信任列表与 `activeTab` 均不能替代此检查。
- 无权限返回 `no_permission / host_permission_missing`；API 缺失、异常、
  无效 URL 或跨源待导航返回 `manual` 及明确 reason。探测不注入页面。
- `requireAutoFormReady()` 在页面 readiness 注入前调用权限门禁，既有
  ATS 报告保留 `formReadiness` 与 reason。popup 通用入口也先检查，
  拒绝时本机 `resumeHostPermissionStop` 只记 origin、状态、原因与安全标志。
  不存页面路径、查询参数或资料值。
- 早停保持 `fillNotStarted=true`、`writeStarted=false`、
  `writeAttempted=false`、`saveAttempted=false`、`liveSupportClaimed=false`。
  授权本身不代表表单 ready 或站点支持；仍须经过原有门禁。
- direct CDP 的只读 harness 显式使用 `requirePageFormReady()`，没有扩展
  权限上下文；扩展入口不会因权限 API 缺失而走该路径。

`optional_host_permissions` 仅声明 HTTP(S) 的可选申请范围，不自动授权。
`requestHostPermission(api, capturedTabUrl, { userGesture: true })` 仅是未来 UI
骨架，当前没有按钮、消息入口或 auto 调用。若接 UI，应先展示当前站点及用途，
再在用户明确点击的同步处理函数里调用；函数在首次 await 前调用原生 request，
由浏览器验证用户手势。每次只请求 URL 对应的单个 scheme/host pattern，
不请求全站通配符。默认不申请；拒绝或异常都不会启动填写、重试申请、保存或提交。

本地复现：

```powershell
npm.cmd ci --ignore-scripts --no-audit --no-fund
node --test tests/host-permissions.test.mjs tests/auto-form-readiness.test.mjs tests/ats-basic-auto-wiring.test.mjs tests/basic-task-readiness.test.mjs tests/cmb-basic-auto.test.mjs tests/cms-basic-auto.test.mjs tests/gth-basic-auto.test.mjs tests/cmb-popup-route.test.mjs tests/product-aftercare.test.mjs tests/bg-auto-messaging.test.mjs
node --test --test-concurrency=1 "tests/l1-*.test.mjs" tests/engine-manual-controls.test.mjs tests/form-readiness.test.mjs tests/auto-form-readiness.test.mjs tests/product-paths-whitelist.test.mjs tests/never-save-guard.test.mjs tests/guard-worker-auto-runners.test.mjs tests/pack-side-effect-import.test.mjs tests/cms-row-d-network-guard.test.mjs tests/build-paid-rebuild.test.mjs
npx.cmd playwright install chromium
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-internal.ps1
npm.cmd run test:zoo
```

zoo 新增用真实浏览器权限 API 拒绝未知离线源站的验证；所有页面与响应均由
离线 harness 提供。无业务表单保存/提交，无公开 live support 声明。
