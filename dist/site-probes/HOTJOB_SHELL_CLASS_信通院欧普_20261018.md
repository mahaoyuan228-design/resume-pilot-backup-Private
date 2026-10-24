# hotjob 壳分类 · 中国信通院 / 欧普照明（公开 HTTP）

日期：2026-10-18 21:34（Asia/Shanghai）  
方法：box `curl` 公开 GET；**无登录**；**未**开 Jeremy PC Edge 多标签。  
对照：招商（live **pb**）· 中联（live **mc**）· 南粤/Celebright/国盛（公开双壳、主猜 pb）。原始：`dist/site-probes/_shell-class-20261018/`（`caict_*` / `opple_*`）· `summary.json`。

## 结论（一句话）

两租户公开侧都是 **双壳可开**（`/pb/resumeOperation.html` + `/mc/deliver/operationResumer` 均 200），**不是** login-wall-only。  
**中国信通院**对外门户 `/pb/index.html` → 主猜 **pb** → `caict` 键走 **CMS_BASIC**。  
**欧普照明**对外门户常 `/mc/position/campus`（同族中联 `/mc/index`）→ 主猜 **mc** → `opple` 键走 **hotjob-mc** Path B。  
公开 HTTP **无法**证明登录后壳；若信通院 live 落 `operationResumer` → hotjob-mc 复用；若欧普 live 停 pb resumeOp → CMS_BASIC 复用。

## 对照：公开页无法区分招商 vs 中联

| 路径 | 招商 | 中联 | 信通院 | 欧普 |
| --- | --- | --- | --- | --- |
| `/pb/resumeOperation.html` | 200 · hash `a1541cf6…` · body md5 `5e54d402…` | 同左 | 同左 | 同左 |
| `/mc/deliver/operationResumer` | 200 · hash `352df1b0…` · body md5 `c21b558e…` | 同左 | 同左 | 同左 |

pb / mc HTML 与南粤批、招商、中联 **byte 相同**。

## 分租户

| 公司 | SU | 壳猜测 | 证据 | Harness |
| --- | --- | --- | --- | --- |
| **中国信通院** | `SU642fbf5fbef57c1e269fa798` | **pb**（中置信） | 门户 `/pb/index.html`；resumeOp 200=招商 CMS hash；兼开 mc | `caict` → CMS_BASIC **ready** |
| **欧普照明** | `SU646ed9920dcad45af14821b4` | **mc**（中置信） | 门户常 `/mc/position/campus`；operationResumer 200=中联 mc hash；兼开 pb | `opple` → hotjob-mc **ready** |

**非**「仅登录墙」：未登录公开 HTML 已出完整 SPA 壳（空 `#root` + vendor），无 HTTP 级强制登录跳转。

**门户偏好差异**：信通院对外 **pb**（同 Celebright/招商族）；欧普对外 **mc campus**（同中联族）→ 故主猜测分叉。

## Live 注意（队列）

信通院 / 欧普 **排在南粤队列之后**；本轮**不** live、**不**宣称客户可填。  
登录后：信通院若仍 pb → `run-hotjob-tenant.cmd caict`；若 mc → hotjob-mc。  
欧普若仍 mc `…/mc/deliver/operationResumer` → `run-hotjob-tenant.cmd opple`；若 pb → CMS_BASIC 候选。

*本文件：`dist/site-probes/HOTJOB_SHELL_CLASS_信通院欧普_20261018.md`*
