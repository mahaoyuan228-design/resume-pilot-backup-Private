# 飞书 ATSX · 登录后 DOM 采包（offline 草稿 · 2026-10-19）

状态：offline only · Never Save · **未**宣称已支持 · 停页 URL **待 live**

## 停页假设
登录后停在 ATSX 简历编辑/申请表。飞书实际 path **待 live**；小米孪生假设 `https://<子域>.jobs.f.mioffice.cn/<path待 live>`。不能只凭域名判定页面身份。

## 一次一变量顺序
| 序 | 字段 | 证据 |
| --- | --- | --- |
| 0 | 页上下文 | `00-page-context.json`（URL、登录态、表单身份依据） |
| 1 | 姓名 | `01-name.dom.html` · `01-name.probe.json` |
| 2 | 手机 | `02-phone.dom.html` · `02-phone.probe.json` |
| 3 | 邮箱 | `03-email.dom.html` · `03-email.probe.json` |

每轮：只采当前字段容器/标签/input 属性/匹配数/只读；未知写「待 live」。默认只读；确认无自动保存后才允许单字段试填+回读并恢复。无法排除自动保存则停写。

## 已知合同（JS-confirmed，live 未证）
`.atsx-form` / `.atsx-form-item` / `input.atsx-input`。不符 → `DOM_CONTRACT_MISMATCH` / `FIXTURE_DRIFT`，交主脑，不猜 class。

## 建议失败码
`AUTH_REQUIRED` · `PAGE_UNVERIFIED` · `DOM_CONTRACT_MISMATCH` · `FIELD_NOT_FOUND` · `FIELD_AMBIGUOUS` · `FIELD_NOT_EDITABLE` · `READBACK_MISMATCH` · `CROSS_FIELD_CHANGE` · `AUTOSAVE_UNVERIFIED` · `FIXTURE_DRIFT`

任一失败停当前轮。不扩性别/婚姻 select；不改 cms/gth。
