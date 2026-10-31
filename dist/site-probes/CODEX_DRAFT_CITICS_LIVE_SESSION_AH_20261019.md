待执行草稿，供主脑裁剪；以下为计划证据文件名，不表示已采集或已支持。

单次会话，证据根：`dist/auto-runs/citics/<run-id>/`

| 步骤 | live 顺序与边界 | 证据文件 |
|---|---|---|
| 01 登录 | Jeremy 完成 `careers.citics.com` 本站登录；禁止跨站复用登录态。 | `01-login.json` |
| 02 户口 | 核验现场控件、真实选项及依赖；仅记录可观察事实。 | `02-hukou.json` |
| 03 证件 | 核验现场证件控件及真实选项；不猜 DOM、值或映射。 | `03-document.json` |
| 04 民族 | 核验现场民族控件及真实选项；保留原文证据。 | `04-ethnicity.json` |
| 05 学历闸门 | 若仍为 `live_education_options_unharvested`，**停在学历控件前，不展开、不选择，仅记缺口**；转第 06 步。 | `05-education-gap.json` |
| 06 证据落盘 | 将本会话证据按 01→05 顺序写入并核验；记录停止原因及缺失项。 | `06-manifest.json` |

全程 **Never Save**：不保存、不提交，不触及私钥；证据不含凭据或会话令牌。`CITICS_EDUCATION_HARVEST_PACK` 与 AA 离线 synthetic guards 不得替代 live 学历选项。CITICS 不标记为已支持；可售范围仍仅招商 CMS + 国泰 GTH。