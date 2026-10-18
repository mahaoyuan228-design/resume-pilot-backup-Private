# 扩站进度（EXPAND）

日期起点：2026-10-18（Asia/Shanghai）  
计划文件：`EXPAND_SITES_PLAN.md`  
探针产出：`dist/site-probes/`

图例：`[ ]` 未做 · `[~]` 进行中 · `[x]` 本阶段完成 · `-` 不适用

## 实验批次

| ID | 内容 | 状态 | 更新 |
| --- | --- | --- | --- |
| E0 | 授权版 Edge 上 CMS+GTH 不回退 | [ ] | 本任务未跑验收；勿与扩站指纹混淆 |
| E1 | 中信 + 招行站点指纹 | [x] | 2026-10-18：CDP 实页完成，见 `probe-20261018-summary.md` |
| E2 | 腾讯 + 阿里公开入口摸底 | [x] | 2026-10-18：公开页完成；**登录后简历编辑未探** |
| E3 | 抽样共用 ATS / hotjob 租户 | [x] | 2026-10-18：`hotjob-tenants-20261018.md` 候选 11（不含招商基线） |

## E1 明细

- [x] 中信 `careers.citics.com` 指纹（自建 Vue+Ant；非 hotjob；简历编辑页已开）
- [x] 招行 `career.cmbchina.com` 指纹（自建 SPA；非 CMS hotjob；简历页 + 登录页）
- [x] 中信字段图（CDP 只读）→ `dist/site-probes/citics-field-map-20261018.md`
- [x] 中信适配器设计（第一切片）→ `EXPAND_CITICS_ADAPTER_DESIGN.md`
- [~] 中信适配器：仅「婚姻状况」Ant Select fill-without-save 代码已落地（`src/content/citics-basic.js`、`scripts/auto-citics-basic.mjs`）。备份树原先没有 `citics-basic.js`。实页 Edge 证据仍待（试用 CDP 9237；扩展 reload 可能仍需要）。未点保存。未宣称已支持中信。
- [ ] 招行适配器开发
- [ ] 任一新站「可填」客户文档收录

## E2 明细

- [x] 腾讯入口 URL + 自建判断（`join.qq.com` / `careers.tencent.com`）
- [x] 阿里入口 URL + 自建判断（`campus-talent.alibaba.com` / `talent.alibaba.com`）
- [ ] 腾讯登录后简历/投递表单指纹
- [ ] 阿里登录后申请表单指纹

## E3 明细

- [x] hotjob/wecruit 同壳租户清单（≥8）→ `dist/site-probes/hotjob-tenants-20261018.md`
- [ ] 候选租户登录后确认 `pb/resumeOperation.html` 形态
- [ ] 任一新 SU 白名单试填（fill-without-save）
- [ ] 北森 / Moka / 飞书招聘抽样指纹

## 系统族看板

| 系统族 | 已指纹 | 开发中 | 可填（对外可写） |
| --- | --- | --- | --- |
| hotjob/wecruit（招商 CMS） | [x] + 11 候选租户 | [ ] 扩 SU | [x] 仅招商证券 CMS |
| 国泰自建 GTH | [x] | - | [x] 国泰海通 |
| 中信自建 | [x] 指纹+字段图+设计 | [~] 婚姻状况 Select 代码已落地；实页证据待 9237 | [ ] |
| 招行自建 | [x] 2026-10-18 | [ ] | [ ] |
| 腾讯自建 | [~] 仅门户 | [ ] | [ ] |
| 阿里 CPO 自建 | [~] 仅门户 | [ ] | [ ] |
| 北森 / Moka / 飞书招聘 | [ ] | [ ] | [ ] |

## 本轮产出路径

| 文件 | 位置 |
| --- | --- |
| hotjob 租户 | `dist/site-probes/hotjob-tenants-20261018.md` (+ `.json`) |
| 中信字段图 | `dist/site-probes/citics-field-map-20261018.md` (+ `.json`) |
| 中信适配设计 | `EXPAND_CITICS_ADAPTER_DESIGN.md` |
| 婚姻状况 Select 代码 | `src/content/citics-basic.js` · `scripts/auto-citics-basic.mjs` |
| 婚姻状况证据（gitignore，跑 harness 才有） | `dist/auto-runs/citics-ant-select-婚姻状况-*.json` |
| 本进度 | `EXPAND_PROGRESS.md` |

## 销售口径（勿改）

- 现在能卖：**招商 CMS + 国泰 GTH**；Windows+Edge；授权绑定。  
- **不要**说「大厂/大品牌大多能填」或「已支持中信/hotjob 其它公司」。  
- 扩站进度用本文件勾选，窄版验收 % 不因实验上调。
