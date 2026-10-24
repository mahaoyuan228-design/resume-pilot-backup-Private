# CMB 试用扩展 CDP CLI（Never Save）

`scripts/auto-cmb-basic.mjs --extension` attach 已运行浏览器的 loopback CDP，
打开或复用 `src/auto/cmb-basic-auto.html`，由该页通过 `requestBackground`
触发现有 `CMB_BASIC_AUTO`。默认 readiness；fill 只填不存。
CLI 不启动 Edge，不自动 reload 扩展，不点击保存、提交或投递。
本次验证为离线验证，**招行未宣称支持**；exit 0 只表示 runner 本次返回 ok。

## 调用

仓库内先运行 `npm ci`。浏览器及试用扩展的启动、登录由操作者管理；
本次 Cloud 验收无需运行真实 Edge。试用 CDP 默认端口为 **9237**。

```sh
# 默认 readiness；CDP_PORT 也可以指定端口
node scripts/auto-cmb-basic.mjs --extension --port 9237

# Never-Save 试填（CMD / PowerShell 同样可以使用这些 CLI 参数）
node scripts/auto-cmb-basic.mjs --extension --port 9237 --mode fill

# 多个开发扩展同时存在，或 service worker 休眠时，明确给出扩展 ID
node scripts/auto-cmb-basic.mjs --extension --extension-id <32位扩展ID> --mode readiness
```

扩展 ID 也可以由 `RESUME_EXT_ID` 提供；未提供时，只从本项目已知的 worker、
popup、options 或 CMB auto 页发现扩展。零个候选或多个候选均拒绝；不会猜 ID。
有明确 ID 时可以直接打开 auto 页，唤醒休眠 worker。

默认 `OPEN_IF_MISSING=0`，缺已登录简历 tab 时记录 `cmb_basic_tab_missing`。
只有 `--open-if-missing` 或 `OPEN_IF_MISSING=1` 才允许现有后台尝试打开简历页。
`CMB_PAGE` 沿用现有 `resolveCmbTarget` 合约，只接受 HTTPS 的
`career.cmbchina.com/center/resume` 路径。登录、profile 确认、权限和已有
`cmb-basic.js` 的限制仍由后台处理；CLI 不添加任何招行表单选择器。
`--extension` 与 `--synthetic`、`--live`、`--only` 混用会拒绝。

## 超时和证据

| 参数 | 环境变量 | 默认 | 范围（毫秒） |
| --- | --- | --- | --- |
| `--timeout-ms` | `AUTO_TIMEOUT_MS` | 180000 | 1–600000 |
| `--step-timeout-ms` | `CDP_STEP_TIMEOUT_MS` | 5000 | 1–60000 |

CLI 参数优先于环境变量；`--mode` 优先于 `MODE`，仅接受 readiness / fill。
每个 HTTP/CDP 调用均受每步超时和总截止时间约束，沿用 live-harvest 的
CDP client；超时会终止 WebSocket。auto 页的后台 ACK / response 也有界。
CLI 同步读取 auto 页的 `#out`，不调用 `chrome.storage`，不使用
`Runtime.evaluate(awaitPromise: true)`。每次导航带独立 runId，并校验完整 URL，
旧结果不能结束新运行。导航期间只重试瞬时失效的读取，不重试填表请求。

证据写入 `AUTO_RUNS_DIR` 或默认 `dist/auto-runs`：

- `cmb-basic-extension-<mode>-<时间>-<runId>.json`
- `cmb-basic-extension-<mode>-latest.json`

stdout 为一份 JSON，含 `file` / `latest` 路径。证据包含 `runId`、
`port`、`extensionId`、`autoUrl`、`targetAction`、`steps`、`step`、
`reason`、`exitCode`、`timedOut`、`backgroundResult` 和完成时间。
配置在连接前被拒绝时，不会有尚未确定的 CDP 字段。
所有包均带 Never Save 和未宣称支持标记。
fill 已发出而响应未确认时，`writeUnconfirmed=true`、`writeAttempted=null`，
不能据此断言页面没有写入；原始后台响应保留在 `backgroundResult`。
不要自动重试这样的 fill。

| 退出码 | 含义 / 示例 |
| --- | --- |
| 0 | 后台 runner 返回 ok；不表示招行已支持 |
| 1 | 传输/执行异常、`cdp_unreachable`、`timeout`、`BG_NO_RESPONSE` |
| 2 | 已取得负面结果，如 `cmb_basic_tab_missing`、登录页、部分字段失败 |
| 3 | fail-closed，如 `cmb_host_permission_missing`、无/多扩展候选、参数错误、旧 worker 需 reload、结果合约或保存策略异常 |

## 离线回归

```sh
node --test tests/cmb-basic-auto.test.mjs tests/cmb-basic.test.mjs tests/auto-cmb-extension-cdp.test.mjs
node --test tests/bg-auto-messaging.test.mjs tests/live-harvest-timeout.test.mjs
```

新增 CDP 测试用 loopback HTTP/WebSocket stand-in，不访问招行，不依赖招行页面
DOM。现有 `cmb-basic.test.mjs` 使用仓库 synthetic fixture 和 headless Chromium；
Cloud 中可通过 `CHROME_PATH` 指向已有 Chromium，无需 Edge。
