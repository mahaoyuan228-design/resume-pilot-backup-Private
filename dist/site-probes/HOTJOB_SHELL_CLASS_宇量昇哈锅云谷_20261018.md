# hotjob 壳分类 · 上海宇量昇 / 哈尔滨锅炉厂 / 中科云谷(社招)（公开 HTTP）

日期：2026-10-18 21:56（Asia/Shanghai）  
方法：box `curl` 公开 GET；**无登录**；**未**开 Jeremy PC Edge 多标签。  
对照：招商（live **pb**）· 中联（live **mc**）· 欧普/隆基/海天/台积电批（公开壳猜 **mc**）· 信通院/南粤批（公开壳猜 **pb**）。原始：`dist/site-probes/_shell-class-20261018/`（`yuliangsheng_*` / `haguo_*` / `yunigu_*`）· `summary.json`。

## 结论（一句话）

三租户公开侧都是 **双壳可开**（`/pb/resumeOperation.html` + `/mc/deliver/operationResumer` 均 200），**不是** login-wall-only。  
**上海宇量昇**、**哈尔滨锅炉厂**对外门户偏 **mc**（`/mc/position/campus` · `/mc/index`）→ 主猜 **mc** → `yls` / `haguo` 键走 **hotjob-mc** Path B。  
**中科云谷(社招)** 对外门户 **`/pb/social.html`**（verify 标题「中联重科招聘」；**勿**与中联校招 `SU661f…` 混用）→ 主猜 **pb** → `yunigu` 键走 **CMS_BASIC**。  
公开 HTTP **无法**证明登录后壳；若 live 与猜测相反 → 互换 Path B / CMS_BASIC。

## 对照：公开页无法区分招商 vs 中联

| 路径 | 招商 | 中联 | 宇量昇 | 哈锅 | 中科云谷 |
| --- | --- | --- | --- | --- | --- |
| `/pb/resumeOperation.html` | 200 · hash `a1541cf6…` · body md5 `5e54d402…` | 同左 | 同左 | 同左 | 同左 |
| `/mc/deliver/operationResumer` | 200 · hash `352df1b0…` · body md5 `c21b558e…` | 同左 | 同左 | 同左 | 同左 |

pb / mc HTML 与台积电/隆基/欧普/信通院/南粤批、招商、中联 **byte 相同**。  
中科云谷 `/pb/social.html` 200 · hash `a1541…` · body md5 `5242e440…`（social 壳，仍 pb 资产族）。

## 分租户

| 公司 | SU | 壳猜测 | 证据 | Harness |
| --- | --- | --- | --- | --- |
| **上海宇量昇** | `SU63847447bef57c649c3505b5` | **mc**（中置信） | 门户常 `/mc/position/campus`；operationResumer 200=中联 mc hash；兼开 pb | `yls` → hotjob-mc **ready** |
| **哈尔滨锅炉厂** | `SU65f3a7421eb8054100a07870` | **mc**（中置信） | 门户常 `/mc/index`（同中联门户形态）；operationResumer 200=中联 mc hash；兼开 pb | `haguo` → hotjob-mc **ready** |
| **中科云谷(社招)** | `SU60a6449a2f9d2430fdc11a19` | **pb**（中置信） | 门户常 `/pb/social.html`；resumeOp 200=招商 CMS hash；兼开 mc | `yunigu` → CMS_BASIC **ready** |

**非**「仅登录墙」：未登录公开 HTML 已出完整 SPA 壳（空 `#root` + vendor），无 HTTP 级强制登录跳转。

**门户偏好**：宇量昇/哈锅对外 **mc**（同欧普/中联族）→ 主猜 **mc**；云谷对外 **pb social**（同信通院 pb 族变体）→ 主猜 **pb**。

## Live 注意（队列）

宇量昇 / 哈锅 / 云谷为备选同批（非 Top3）；本轮**不** live、**不**宣称客户可填。Acceptance 仍 85%。  
登录后：若仍 mc `…/mc/deliver/operationResumer` → `run-hotjob-tenant.cmd yls|haguo`；若 pb → CMS_BASIC（`yunigu` 默认即此；另两键若 live 落 pb 亦改走 CMS_BASIC）。

## Verify-list shell-class complete

`hotjob-tenant-verify-20261018.md` 表内候选（不含招商基线）**11/11** 现均有 `run-hotjob-tenant.cmd` 键与公开壳猜测：  
中联 `zhonglian`(mc live) · 隆基 `longi` · 欧普 `opple` · 海天 `haitian` · 信通院 `caict` · 台积电 `tsmc` · TCL茂佳 `tclmj`/`tcl` · 宇量昇 `yls` · 哈锅 `haguo` · 地平线 `horizon` · 中科云谷 `yunigu`。  
（飞书扩站南粤/Celebright/国盛另键，不在本 verify 表。）**仍非客户可填**；登录后 fill-wo-save 未做。

*本文件：`dist/site-probes/HOTJOB_SHELL_CLASS_宇量昇哈锅云谷_20261018.md`*
