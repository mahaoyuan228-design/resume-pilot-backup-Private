# hotjob-mc · 中联 operationResumer 第一切片

日期：2026-10-18（Asia/Shanghai）  
状态：**第一切片，不是客户可售支持。**  
来源：Jeremy PC 上对中联重科已登录页的 offline+live fill-without-save。本仓库没有那台机器的源码树；本文件和 `src/content/hotjob-mc-basic.js` 按该次通过的合同回写。

---

## 1. 页面

| 项 | 值 |
| --- | --- |
| `siteId` | `hotjob-mc` |
| 公司 | 中联重科 |
| SU | `SU661f37091eb8053acd6cdf3d` |
| 简历页 | https://wecruit.hotjob.cn/SU661f37091eb8053acd6cdf3d/mc/operationResumer |
| 壳 | antd-mobile `mc`，**不是**招商 CMS 的 `/pb/resumeOperation.html` |
| 试用扩展 | `hhembhoojafdefnkonmgoejfedgloanc`（不要用旧的 `hdek…` 默认） |
| CDP | 9237 |

`scripts/run-hotjob-tenant.cmd zhonglian` 走 `scripts/auto-hotjob-mc-basic.mjs --live`。  
把这条 mc URL 交给 `scripts/auto-cms-basic.mjs` 会 **exit 4**（`cms_mc_shell`），不会打开 Edge。

## 2. 字段（本切片）

| 页标签 | Profile | 控件 |
| --- | --- | --- |
| 姓名 | `fullName` | text |
| 移动电话 | `phone` | text |
| 电子邮箱 | `email` | text |

DOM（live 已对上，fixture 同合同）：

- 行：`.my-list-item`
- 标签：`.header-title`
- 输入：`.am-input-control input`

未做：证件、教育、照片、保存、提交、popup。邻居字段不得被这三刀改写。

## 3. Live

Jeremy PC 上，中联已登录的 `operationResumer` 对上述三字段 **fill-without-save 读回 PASS**。  
`saved` 保持 false。没有点保存。

这不表示 hotjob-mc 已对客户开放。换租户、换 DOM、或未登录，都要重新采页面。重跑 live fill 必须自己提供 `HOTJOB_MC_FULL_NAME` / `HOTJOB_MC_PHONE` / `HOTJOB_MC_EMAIL`；harness 不写占位姓名。

```bat
set RESUME_EXT_ID=hhembhoojafdefnkonmgoejfedgloanc
set HOTJOB_MC_FULL_NAME=…
set HOTJOB_MC_PHONE=…
set HOTJOB_MC_EMAIL=…
scripts\run-hotjob-tenant.cmd zhonglian
```

离线：

```bash
MODE=fill node scripts/auto-hotjob-mc-basic.mjs --synthetic
node --test tests/hotjob-mc-basic.test.mjs
```

证据：`dist/auto-runs/hotjob-mc-basic-{readiness|fill}-latest.json`（gitignore）。

## 4. 安全

- 不点 保存 / 提交 / 投递。
- `liveSupportClaimed` 为 false。
- 照片和教育仍钉在招商 pb 基线。
- 南粤 / Celebright / 国盛仍走 CMS pb harness。
