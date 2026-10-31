# hotjob 壳分类 · 台积电(南京) / TCL茂佳科技 / 地平线（公开 HTTP）

日期：2026-10-18 21:50（Asia/Shanghai）  
方法：box `curl` 公开 GET；**无登录**；**未**开 Jeremy PC Edge 多标签。  
对照：招商（live **pb**）· 中联（live **mc**）· 欧普/隆基/海天（公开壳猜 **mc**，门户 `/mc/position/campus`）。原始：`dist/site-probes/_shell-class-20261018/`（`tsmc_*` / `tcl_*` / `horizon_*`）· `summary.json`。

## 结论（一句话）

三租户公开侧都是 **双壳可开**（`/pb/resumeOperation.html` + `/mc/deliver/operationResumer` 均 200），**不是** login-wall-only。  
**台积电(南京)**、**TCL茂佳科技**、**地平线**对外门户均常 `/mc/position/campus`（同族欧普/隆基/海天/中联 mc）→ 主猜 **mc** → `tsmc` / `tclmj`（别名 `tcl`）/ `horizon` 键走 **hotjob-mc** Path B。  
公开 HTTP **无法**证明登录后壳；若 live 停 pb resumeOp → CMS_BASIC 复用候选。

## 对照：公开页无法区分招商 vs 中联

| 路径 | 招商 | 中联 | 台积电 | TCL茂佳 | 地平线 |
| --- | --- | --- | --- | --- | --- |
| `/pb/resumeOperation.html` | 200 · hash `a1541cf6…` · body md5 `5e54d402…` | 同左 | 同左 | 同左 | 同左 |
| `/mc/deliver/operationResumer` | 200 · hash `352df1b0…` · body md5 `c21b558e…` | 同左 | 同左 | 同左 | 同左 |

pb / mc HTML 与隆基/海天/欧普/信通院/南粤批、招商、中联 **byte 相同**。  
（地平线 `mc_opResumer` 首次 curl 超时，重试 200；`mc_index`/`mc_campus` 首次即 200 同 hash。）

## 分租户

| 公司 | SU | 壳猜测 | 证据 | Harness |
| --- | --- | --- | --- | --- |
| **台积电(南京)** | `SU61075bbabef57c43d825d671` | **mc**（中置信） | 门户常 `/mc/position/campus`；operationResumer 200=中联 mc hash；兼开 pb | `tsmc` → hotjob-mc **ready** |
| **TCL茂佳科技** | `SU6491506a2f9d24316e91b81b` | **mc**（中置信） | 门户常 `/mc/position/campus`；operationResumer 200=中联 mc hash；兼开 pb | `tclmj` / `tcl` → hotjob-mc **ready** |
| **地平线** | `SU62d915040dcad43c775ec12c` | **mc**（中置信） | 门户常 `/mc/position/campus`；operationResumer 200=中联 mc hash；兼开 pb | `horizon` → hotjob-mc **ready** |

**非**「仅登录墙」：未登录公开 HTML 已出完整 SPA 壳（空 `#root` + vendor），无 HTTP 级强制登录跳转。

**门户偏好**：三租户均对外 **mc campus**（同欧普/隆基/海天/中联族）→ 故主猜 **mc**（非信通院 pb 族）。

## Live 注意（队列）

台积电 / TCL茂佳 / 地平线为备选同批（非 Top3）；本轮**不** live、**不**宣称客户可填。Acceptance 仍 85%。  
登录后：若仍 mc `…/mc/deliver/operationResumer` → `run-hotjob-tenant.cmd tsmc|tclmj|horizon`；若 pb → CMS_BASIC 候选。

*本文件：`dist/site-probes/HOTJOB_SHELL_CLASS_台积电TCL地平线_20261018.md`*
