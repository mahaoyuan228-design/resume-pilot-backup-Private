# 招行 CMB 第一切片 · NEXT（2026-10-19）

时区：Asia/Shanghai  
状态：**offline scaffold only** — 未宣称客户可填；未 live fill  
对齐：`EXPAND_CMB_ADAPTER_DESIGN.md` · `cmb-field-map-20261019.md` · `CMB_FINGERPRINT_REFRESH_20261019.md`

## 1. Fingerprint

| 项 | 值 |
| --- | --- |
| `siteId` | **`cmb`** |
| 简历 URL | https://career.cmbchina.com/center/resume |
| 栈 | React + ant-design（`main.d37c8446.js`）；非 hotjob；非 Vue |
| vs 招商证券 | **不同源**（证券=`wecruit.hotjob.cn`） |

## 2. First-slice fields

| 页标签 | Profile | 状态 |
| --- | --- | --- |
| 姓名 | fullName | scaffold + offline synthetic |
| 手机号 | phone | scaffold + offline synthetic |
| 邮箱 | email | scaffold + offline synthetic |

DOM 合同：**CSS-confirmed** `.ant-form-item` / `input.ant-input`（`main.02cda64a.css`）。Live 结构未采。

## 3. How to run

```bash
MODE=readiness node scripts/auto-cmb-basic.mjs --synthetic
MODE=fill node scripts/auto-cmb-basic.mjs --synthetic
node --test tests/cmb-basic.test.mjs
```

证据：`dist/auto-runs/cmb-basic-{readiness|fill}-latest.json`  
**Never Save**。SW/popup **未**接线（`--extension` → refused）。

## 4. Live blockers

Jeremy 登录招行招聘账号并停在 `/center/resume` 后，才能 harvest live DOM 再 fill-wo-save。

## 5. Safety

- Never 保存/提交（姓名/证件保存后锁死）。  
- Fail-closed profile。  
- 不改 cms/gth/citics。  
- 对外仍仅 CMS + GTH 可卖。

## 6. Second-slice plan

离线分析草稿 only（未实现 fill；SW/popup 未接线；未宣称已支持招行；Never Save）：`dist/site-probes/CMB_SECOND_SLICE_PLAN_20261019.md`。
