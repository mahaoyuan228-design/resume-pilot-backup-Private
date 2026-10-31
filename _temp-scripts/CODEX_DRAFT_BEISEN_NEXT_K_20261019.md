仅据贴文的可裁剪草稿；失败码均为建议名，不表示仓内已有实现或已支持。

**离线下一刀**

| 字段或契约 | 为何可离线／建议补项 | 失败码 | 禁止项 |
|---|---|---|---|
| `fullName / phone / email` 白名单 | 已有 fixture PASS；补缺值、空值用例 | `PROFILE_FIELD_MISSING` | 扩到性别、证件、教育 |
| provisional DOM 唯一匹配 | 基于现有 fixture 构造空表单、缺控件、重复标签用例 | `FORM_NOT_READY` / `FIELD_AMBIGUOUS` | 把 fixture 类名、公开近邻类名认作 live DOM |
| 三字段写后回读 | 在现有离线 fill 上补值未落入的失败断言 | `VALUE_NOT_APPLIED` | 据此宣称 live 框架事件兼容 |
| Never Save | 离线监听保存点击及 submit，断言零触发 | `SAVE_OR_SUBMIT_ATTEMPT` | 保存、投递、popup 接线 |
| `beisen-2022` 族级边界 | 用已知 2022／legacy／hotjob 指纹做合成正反例，供同壳复用 | `SITE_FAMILY_MISMATCH` | 单凭域名或共享 chunk 判定可填；改 cms/gth |

**需 Jeremy**

| 待证契约 | Jeremy 所需动作／证据 | 未满足时 |
|---|---|---|
| 真实简历编辑 DOM | 登录北森账号，首选君乐宝；采三字段标签、控件及关联结构 | `LIVE_DOM_UNVERIFIED` |
| live readiness | Edge CDP 9237 可用时验证门户指纹；真实表单另须登录证据 | `LIVE_FORM_UNVERIFIED`；门户识别成功不代表可填 |

**不要做**

| 禁止项 | 边界 |
|---|---|
| 编造登录后 DOM | 空 `#bsMain`、0 input 不提供表单选择器证据 |
| 扩字段、保存或投递 | 本切片仅三字段，始终 Never Save |
| 混用 CMS／北森 legacy | 同壳复用优先；不动 cms/gth，不另起大厂适配 |
| 宣称北森已支持或可卖 | 当前仍是 offline scaffold；可卖仍仅招商 CMS + 国泰 GTH |