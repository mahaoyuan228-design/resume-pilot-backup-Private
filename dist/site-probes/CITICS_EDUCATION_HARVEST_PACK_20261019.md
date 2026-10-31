# 中信 学历/学位 选项采收包（离线）· 2026-10-19（Asia/Shanghai）

**状态**：`live_education_options_unharvested`（离线包就绪；live 仍待 Jeremy 登录）  
**页**：`https://careers.citics.com/my/jl`（教育经历分区）  
**控件**：Ant Select（字段图仅见标签抽样「学历/学位」，**无** CSS/DOM 选择器 → **待 live 定位**）  
**隔离**：独立 siteId（CITICS）；**禁止**复用招行 Education dict  
**硬约束**：全程 **Never Save**（不点保存/暂存/提交）；一次只采一个变量；不发明选项；不改 CMS/GTH；**不宣称中信已支持**

参照：`citics-field-map-20261018.md` · `CITICS_ANT_SELECT_REFUSED_20261018.md` · `_temp-scripts/CODEX_DRAFT_CITICS_EDU_HARVEST_G_20261019.md`

---

## 目标

登录后一次性采出 **学历**（另轮 **学位**）Ant Select 的完整 `text` + 原始 `value`，落盘证据后停止。采完 ≠ 接线；接线另议。

---

## 步骤（1–5）

1. **打开页**  
   登录 `careers.citics.com` → 打开 `/my/jl` → 滚到「教育经历」。定位「学历」控件（选择器 **待 live 定位**）。全程 Never Save；不碰私钥；不改引擎/CMS/GTH。

2. **仅展开**  
   本轮只处理「学历」：点击展开 Ant Select，**不选中任何项**、不改其他字段。「学位」另起一轮，同样流程。

3. **滚虚拟列表**  
   若下拉为虚拟列表：分段滚动，逐段读选项，确认已到底；**不得**把首屏当全集。

4. **Dump JSON**  
   逐项记录实际文案与原始 `value`（读不到记 `null`，保持阻塞）。禁止用文案/序号/招行 Education 映射推算 value。建议字段：`site`、`sourceUrl`、`capturedAt`、`fieldLabel`、`options[{text,value}]`、`valueSource`、`complete`、`evidenceFiles`。只留选项相关证据，避开简历个人信息。

5. **停止**  
   证据落盘即停。不选值、不保存、不接线、不宣称支持。学位用独立文件名另跑一轮。

---

## 证据文件名

| 用途 | 学历 | 学位（另轮） |
| --- | --- | --- |
| 选项 JSON | `citics-education-options.live.json` | `citics-degree-options.live.json` |
| 下拉截图 | `citics-education-dropdown.live.png` | `citics-degree-dropdown.live.png` |
| 采集笔记 | `citics-education-capture.live.md` | `citics-degree-capture.live.md` |

建议落在 `dist/site-probes/` 或同级 live 证据目录；笔记写步骤、完整性依据、缺失项。

---

## 失败码

| 码 | 含义 |
| --- | --- |
| `live_education_options_unharvested` | 学历尚未取得完整、可核验的文案/value（**当前默认**） |
| `live_login_required` | 未登录或登录失效 |
| `live_education_dropdown_unavailable` | 未定位到或无法展开学历下拉 |
| `live_education_options_incomplete` | 虚拟列表未采全或无法确认到底 |
| `live_education_option_value_unavailable` | 文案可读，原始 value 不可得 |
| `live_degree_…` | 学位对应失败码（不复用学历结果） |

---

## 明确不做

- 不发明选项列表或未核验的 DOM 选择器  
- 不复用招行 Education dict / CMB siteId  
- 不扩展 allowlist、不改 `selectControl` / CMS / GTH  
- 采集完成 ≠ 中信已支持；勿对外宣称
