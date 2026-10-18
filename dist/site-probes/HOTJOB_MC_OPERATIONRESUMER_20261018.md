# 中联重科 hotjob mc/operationResumer · live DOM fingerprint

日期：2026-10-18（Asia/Shanghai）  
SU：`SU661f37091eb8053acd6cdf3d`（中联重科）  
CDP：9237 · 试用扩展 `hhembhoojafdefnkonmgoejfedgloanc`（v0.1.4.9；旧 `hdek…` 已 blocked）  
动作：`Page.bringToFront` only — **未 reload**（避免踢登录）  
证据 JSON：`HOTJOB_MC_OPERATIONRESUMER_raw.json` · `HOTJOB_MC_OPERATIONRESUMER_deep.json`（同目录 / PC dist）

---

## 1. Live URL（登录后真实编辑页）

```
https://wecruit.hotjob.cn/SU661f37091eb8053acd6cdf3d/mc/deliver/operationResumer
  ?recruitType=1&postId=undefined&templateId=60a646cf0dcad46f8591096f
  &isHaveSite=undefined&isHaveVolunteer=undefined&isPostQuestion=undefined
  &lang=1&isFast=0&resumeId=6ad4bbb3df99e734cc4d81cd
```

| 项 | 值 |
| --- | --- |
| pathname | `/SU661f…/mc/deliver/operationResumer` |
| title | `基本信息` |
| resumeId | `6ad4bbb3df99e734cc4d81cd`（draft 存在） |
| loginHints | false |
| loading「正在加载中…」 | false（mc 已就绪） |
| pb `…/pb/resumeOperation.html` | 仍停在「正在加载中…」（不可用） |

先前 harness 用 `CMS_PAGE=…/pb/resumeOperation.html` → SW 找 tab 只认 pb → 命中 mc 相关 tab → `cms_basic_login_or_wrong_page`。

---

## 2. DOM fingerprint vs 招商 / pb CMS

| 信号 | pb CMS（招商基线 / CMS_BASIC） | 中联 mc live |
| --- | --- | --- |
| 路由 | `/SU*/pb/resumeOperation.html` | `/SU*/mc/deliver/operationResumer` |
| UI 壳 | Ant Design desktop（`.ant-form-item` / `.form-cell` / `.tit-wrap .tit`） | **antd-mobile H5**（`.am-list` / `.am-input-item` / `.my-list-item`） |
| 分区标题 | `个人基本信息必填` 等（`probePageFunc` SIGNATURE） | `基本信息`（`.resume-info-title`） |
| 进度 | 无 H5 进度条 | `填写进度：1/9` +「自动保存于…」 |
| 文本控件 | `.ant-input` | `.am-input-control input` + placeholder「请填写姓名」等 |
| 选择控件 | `.ant-select` | `.am-list-extra.select-am-list-extra`（请选择性别/国籍/…） |
| 主按钮 | Ant button | `.my-button`「下一步」（非站点 Save 标签） |
| styled-components | 少 | `sc-bwzfXH` 等 |
| `hasFormCell` / `hasTitWrap` / `hasAntFormItem` | true | **false** |

字段样本（基本信息页）：个人寸照(file)、姓名、性别、出生日期、国籍/地区、证件类型、证件号码、籍贯、英语等级、移动电话、电子邮箱、身高、体重。

**结论：不是同一 Ant shell。**

---

## 3. 路径选择 → **B（thin adapter）**

| 选项 | 说明 | 决定 |
| --- | --- | --- |
| **A** | 扩 `CMS_PAGE` / `isCmsResumePage` / `resolveCmsBasicTarget` 允许 mc URL，复用 CMS_BASIC | **否** — DOM 控件与 probe/fill 选择器全不匹配；扩 URL 只会把错误壳送进 Ant fill |
| **B** | 独立 thin adapter（mc URL 校验 + am-list 读写） | **是** — fail-closed；CMS_BASIC 继续只认 pb |

已落最小闸：

- `scripts/lib/cms-page-target.mjs`：`parseHotjobMcPage` / 中联 `shell:'mc'`；`CMS_SU=zhonglian` 默认 mc URL；显式 pb 仍可解析
- `scripts/auto-cms-basic.mjs`：`shell==='mc'` → **exit 4** `hotjob_mc_shell_requires_adapter`（不写页、不点 Save）
- `resolveCmsBasicTarget` / `isCmsResumePage`：**故意不**接受 mc（Path A 拒绝）
- `scripts/run-hotjob-tenant.cmd zhonglian`：设 `CMS_PAGE` 为 mc；遇 exit 4 停、不 fill

下一步（已做第一切片）：mc readiness + 三文本字段 fill-wo-save + restore — 见 §6。再下：select/am-list（性别等）。

---

## 4. Save 政策

站点显示「自动保存于…」——产品侧 **Never Save**：adapter **不得**点「下一步」/保存/提交；fill-wo-save 仅写控件值并默认 **restore** 回填前值。§6 live fill **PASS**（restored）。

---

## 5. Extension id

试用 working：`hhembhoojafdefnkonmgoejfedgloanc`  
旧 `hdek…`（blocked）— 文档/脚本默认已改 `hhembhoojafdefnkonmgoejfedgloanc`。


---

## 6. First-slice adapter `siteId=hotjob-mc`（2026-10-18 20:44 Asia/Shanghai）

| 项 | 值 |
| --- | --- |
| Fields（live verified） | **姓名** · **移动电话** · **电子邮箱**（`.header-title` + `.am-input-control input`） |
| Content | `src/content/hotjob-mc-basic.js` + `hotjob-mc-profile-map.mjs` |
| Harness | `scripts/auto-hotjob-mc-basic.mjs` MODE=readiness\|fill；CDP_PORT=9237；CMS_SU/CMS_PAGE；`--synthetic` offline；`--live` self-inject；**Never Save**；fill 默认 restore |
| Tenant cmd | `scripts/run-hotjob-tenant.cmd zhonglian` → mc harness（不再走 CMS_BASIC exit 4） |
| Offline | `tests/hotjob-mc-basic.test.mjs` **10/10 PASS** + fixture `tests/fixtures/hotjob-mc-basic-form.html` |
| Live readiness | **PASS** `labels_ready` foundCount=3 · `dist/auto-runs/hotjob-mc-basic-readiness-latest.json` |
| Live fill-wo-save | **PASS** `live_fill_wo_save_restored` 3/3 matched + 3/3 restored；neighbor 证件号码 untouched；下一步 **未点** · `dist/auto-runs/hotjob-mc-basic-fill-latest.json` |
| SW | 未接线（第一切片 harness self-inject OK） |
| 对外口径 | 仍 **勿**写「已支持中联客户可填」— 仅实验 fill-wo-save |

Restore 政策：live/synthetic fill 后写回填前值（空→空）；`--no-restore` 可留下填写值，仍永不点下一步。
