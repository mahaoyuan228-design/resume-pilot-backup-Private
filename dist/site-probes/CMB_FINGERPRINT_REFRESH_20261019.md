# 招行 career.cmbchina.com 指纹刷新 · 2026-10-19（Asia/Shanghai）

**范围**：公开 HTTP（box curl）+ 对照 E1 CDP（2026-10-18）。无 Jeremy 打断；**未** login；**未** Save；验收仍 **85%**。  
**原始**：`dist/site-probes/_raw-cmb-20261019/` · hints：`_cmb-js-class-hints-20261019.txt`

## 结果

| 项 | 2026-10-18 CDP | 2026-10-19 公开刷新 |
| --- | --- | --- |
| 根/简历/登录 HTML | SPA shell | 同壳 **594 B**；`#root`；title 招商银行招聘 |
| JS | `main.d37c8446.js` | **同 hash**（~896 KB）；`createRoot`；react 串密集 |
| CSS | chunk.css | `main.02cda64a.css`（~579 KB）；**大量** `ant-form-item` / `ant-input` / `ant-select` / `ant-picker` |
| 框架 | probe `vue:true` | **更正为 React + ant-design**（vue 命中为误报） |
| ATS | 非 hotjob/beisen/moka/feishu | **确认** JS 无这些串 |
| 路由线索（JS） | `/center/resume`、`/login` | 另见 `campus/home` · `social/home` · `resumeList` · `fintechresume` |
| 简历表单 DOM | CDP bodyText 有完整标签 | 公开 HTML **无** SSR 字段；表单仍需登录会话 |

## 结论

- 难度仍 **new-adapter**（银行自建，≠ 招商证券 CMS）。  
- 适配器设计 + offline 第一切片已开（见 `EXPAND_CMB_ADAPTER_DESIGN.md` · `CMB_NEXT.md`）。  
- **勿**对外写已支持招行。

## 下一刀（需 Jeremy 时再说）

登录 `https://career.cmbchina.com/center/resume` → 采 live `.ant-form-item` 是否与 CSS 合同一致 → fill-wo-save（Never Save）。

体重 offline 已落地（同身高：`.ant-form-item` + `input.ant-input`；只写数字公斤；拒 `60kg`/`60KG`；`--live` 拒 `live_weight_text_unharvested`；套件 34/34；Never Save）。性别/身高/体重合成齐；下一刀需 live 的四字段：婚姻、政治面貌、民族、出生日期。未宣称已支持招行。验收仍 **85%**。
