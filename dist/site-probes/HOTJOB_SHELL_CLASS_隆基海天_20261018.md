# hotjob 壳分类 · 隆基绿能 / 海天味业（公开 HTTP）

日期：2026-10-18 21:47（Asia/Shanghai）  
方法：box `curl` 公开 GET；**无登录**；**未**开 Jeremy PC Edge 多标签。  
对照：招商（live **pb**）· 中联（live **mc**）· 欧普（公开壳猜 **mc**，门户 `/mc/position/campus`）· 信通院（公开壳猜 **pb**）。原始：`dist/site-probes/_shell-class-20261018/`（`longi_*` / `haitian_*`）· `summary.json`。

## 结论（一句话）

两租户公开侧都是 **双壳可开**（`/pb/resumeOperation.html` + `/mc/deliver/operationResumer` 均 200），**不是** login-wall-only。  
**隆基绿能**与**海天味业**对外门户均常 `/mc/position/campus`（同族欧普/中联 mc）→ 主猜 **mc** → `longi` / `haitian` 键走 **hotjob-mc** Path B。  
公开 HTTP **无法**证明登录后壳；若 live 停 pb resumeOp → CMS_BASIC 复用候选。

## 对照：公开页无法区分招商 vs 中联

| 路径 | 招商 | 中联 | 隆基 | 海天 |
| --- | --- | --- | --- | --- |
| `/pb/resumeOperation.html` | 200 · hash `a1541cf6…` · body md5 `5e54d402…` | 同左 | 同左 | 同左 |
| `/mc/deliver/operationResumer` | 200 · hash `352df1b0…` · body md5 `c21b558e…` | 同左 | 同左 | 同左 |

pb / mc HTML 与信通院/欧普批、南粤批、招商、中联 **byte 相同**。

## 分租户

| 公司 | SU | 壳猜测 | 证据 | Harness |
| --- | --- | --- | --- | --- |
| **隆基绿能** | `SU649d30920dcad4644b43e39b` | **mc**（中置信） | 门户常 `/mc/position/campus`；operationResumer 200=中联 mc hash；兼开 pb | `longi` → hotjob-mc **ready** |
| **海天味业** | `SU6322ee8c0dcad46a862dcbe5` | **mc**（中置信） | 门户常 `/mc/position/campus`；operationResumer 200=中联 mc hash；兼开 pb | `haitian` → hotjob-mc **ready** |

**非**「仅登录墙」：未登录公开 HTML 已出完整 SPA 壳（空 `#root` + vendor），无 HTTP 级强制登录跳转。

**门户偏好**：两租户均对外 **mc campus**（同欧普/中联族）→ 故主猜 **mc**（非信通院 pb 族）。

## Live 注意（队列）

隆基 / 海天为备选同批（非 Top3）；本轮**不** live、**不**宣称客户可填。Acceptance 仍 85%。  
登录后：若仍 mc `…/mc/deliver/operationResumer` → `run-hotjob-tenant.cmd longi|haitian`；若 pb → CMS_BASIC 候选。

*本文件：`dist/site-probes/HOTJOB_SHELL_CLASS_隆基海天_20261018.md`*
