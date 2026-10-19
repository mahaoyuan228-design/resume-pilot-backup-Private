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
| 性别 | gender（男/女） | **offline synthetic only**。公开 CSS 候选 fixture；**live radio DOM 仍未采** |
| 身高 | height（数字厘米；标签可带 CM） | **offline synthetic only**。公开 CSS 候选 `input.ant-input`；value **不含** CM。**live 标签精确串仍未采** |

DOM 合同：**CSS-confirmed** `.ant-form-item` / `input.ant-input`（`main.02cda64a.css`）。Live 结构未采。

性别单选 **不是** live 合同。Fixture 只用公开 CSS 候选 `.ant-form-item` / `.ant-radio-wrapper` / `.ant-radio`，并标明 synthetic。读回只在该 fixture 上断言「男」或「女」。`--only 性别` 拒绝 live fill（`live_gender_radio_unharvested`）。**未**宣称已支持招行。

身高文本 **不是** live 合同。同一 fixture 上复用 `.ant-form-item` + `input.ant-input`（公开 CSS 候选）。标签可以是「身高」或带 CM 后缀（字段图写「身高 CM」）。读回只有数字，**不**把 CM 写入 value。`--only 身高 --live` 拒绝（`live_height_text_unharvested`）。**未**宣称已支持招行。

## 3. How to run

```bash
MODE=readiness node scripts/auto-cmb-basic.mjs --synthetic
MODE=fill node scripts/auto-cmb-basic.mjs --synthetic
node scripts/auto-cmb-basic.mjs --only 性别
node scripts/auto-cmb-basic.mjs --only 身高
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

离线分析草稿（SW/popup 未接线；未宣称已支持招行；Never Save）：`dist/site-probes/CMB_SECOND_SLICE_PLAN_20261019.md`。

其中 **性别** 与 **身高** 已有 offline synthetic。出生日期 / 政治面貌 / 民族 / 婚姻状况 **未**做。Live 性别 radio DOM、以及身高标签精确串，仍要登录后 harvest。身高 **不是** live 支持。
