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
| 体重 | weight（数字公斤；调用方传入。标签可带 KG。未写入 emptyProfile） | **offline synthetic only**。公开 CSS 候选 `input.ant-input`；value **不含** KG。**live 标签精确串仍未采** |
| 是否参加过正式工作 | formalWork（是/否；调用方传入。未写入 emptyProfile） | **offline synthetic only**。标签作用域 `.ant-form-item`；选项来自字段图，**不是** live 合同 |

DOM 合同：**CSS-confirmed** `.ant-form-item` / `input.ant-input`（`main.02cda64a.css`）。Live 结构未采。

性别单选 **不是** live 合同。Fixture 只用公开 CSS 候选 `.ant-form-item` / `.ant-radio-wrapper` / `.ant-radio`，并标明 synthetic。读回只在该 fixture 上断言「男」或「女」。`--only 性别` 拒绝 live fill（`live_gender_radio_unharvested`）。**未**宣称已支持招行。

身高文本 **不是** live 合同。同一 fixture 上复用 `.ant-form-item` + `input.ant-input`（公开 CSS 候选）。标签可以是「身高」或带 CM 后缀（字段图写「身高 CM」）。读回只有数字，**不**把 CM 写入 value。`--only 身高 --live` 拒绝（`live_height_text_unharvested`）。**未**宣称已支持招行。

体重文本 **不是** live 合同。同一 fixture 上复用 `.ant-form-item` + `input.ant-input`（公开 CSS 候选）。标签可以是「体重」或带 KG 后缀（字段图写「体重 KG」）。读回只有数字公斤，**不**把 KG 写入 value（`60kg` / `60KG` 拒填）。`--only 体重 --live` 拒绝（`live_weight_text_unharvested`）。**未**宣称已支持招行。

是否参加过正式工作 **不是** live 合同。同一 fixture 上按标签锁一个 `.ant-form-item`，选项只有字段图里的「是 / 否」。读回是 `input.checked`。`--only 是否参加过正式工作 --live` 拒绝（`live_formal_work_radio_unharvested`）。**未**宣称已支持招行。

## 3. How to run

```bash
MODE=readiness node scripts/auto-cmb-basic.mjs --synthetic
MODE=fill node scripts/auto-cmb-basic.mjs --synthetic
node scripts/auto-cmb-basic.mjs --only 性别
node scripts/auto-cmb-basic.mjs --only 身高
node scripts/auto-cmb-basic.mjs --only 体重
node scripts/auto-cmb-basic.mjs --only 是否参加过正式工作
node scripts/auto-cmb-basic.mjs --only 婚姻状况
node scripts/auto-cmb-basic.mjs --only 政治面貌
node scripts/auto-cmb-basic.mjs --only 民族
node scripts/auto-cmb-basic.mjs --only 出生日期
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

其中 **性别**、**身高**、**体重** 与 **是否参加过正式工作** 已有 offline synthetic。婚姻状况 / 政治面貌 / 民族另有采到的中文名+code 离线 Select；出生日期只记 DatePicker 提示。这些合成 **不是** live 支持。

体重 offline 已落地（同身高：`.ant-form-item` + `input.ant-input`；只写数字公斤；拒 `60kg`/`60KG`；`--live` 拒 `live_weight_text_unharvested`；套件 34/34；Never Save）。是否参加过正式工作 offline radio 已落地（对齐性别：标签作用域 `.ant-form-item`；字段图 是/否；`--live` 拒 `live_formal_work_radio_unharvested`；未改 emptyProfile；Never Save；套件 37/37）。未宣称已支持招行。验收仍 **85%**。

下一刀 live 采数顺序见 `CMB_LIVE_GATED_FIELDS_DRAFT_20261019.md`：婚姻状况 → 政治面貌 → 民族 → 出生日期。这四字段的真实选项不能离线合成。未宣称已支持招行。验收仍 **85%**。

2026-10-19 live gated 四字段已采齐（`CMB_LIVE_GATED_HARVEST_20261019.md`，Never Save）。婚姻状况 / 政治面貌 / 民族已按采到的中文名+code 做离线合成 Select；出生日期只记 DatePicker kind+填法提示，未硬编假 DOM，未 live 填。未宣称已支持招行。验收仍 **85%**。
