# 付费交付 QA 阻断（2026-10-18 18:15 Asia/Shanghai）

**Overall: FAIL**（激活门通过，8 段 fill 未跑通）  
验收 %：**不调高**（仍按既有政策，无 HTTPS 不加分）。

## 激活门 PASS

- Edge CDP **9239**，授权版 id `decggijdlhflkjkgmofbclglilpaooij`
- 状态 **active** / **允许填写**
- installId `c4e623e5-beb2-441f-af39-9a2e6d1aea47`
- licenseId `lic-ACCEPT-168-PERM-20261018`（到期约 2099）
- 证据：`dist/auto-runs/paid-entitlement-probe-20261018.json`（在 Jeremy Windows 开发根）

## 端口事实（重要）

| 端口 | 扩展 | 站点登录 | 结论 |
|------|------|----------|------|
| **9239** | 付费包可用（`--load-extension` paid） | CMS/GTH **未登录** | 应用此端口做付费 fill |
| **9237** | 仅试用/内部包（`--disable-extensions-except` internal）；付费页 `ERR_BLOCKED_BY_CLIENT` | CMS resumeOperation + GTH resume/edit **已登录** | **不能**用于付费 QA |

授权与 installId 绑定在 9239 配置目录 `resume-edge-paid-accept-20261018`，不能直接复用 9237 的站点 Cookie。

## 8 段 fill 矩阵

全部 **FAIL / blocked_login**（非授权拦截）：

1. cms-basic  
2. cms-education  
3. cms-internship  
4. gth-basic  
5. gth-education  
6. gth-intent  
7. gth-other  
8. gth-simple  

汇总：Windows `dist/auto-runs/paid-handoff-qa-20261018.json`

## 我需要帮助！

请 Jeremy 在 **授权版 Edge（CDP 9239）** 窗口登录：

1. 招商 CMS：进入可编辑的 `resumeOperation.html`
2. 国泰 GTH：进入可编辑的 `https://hr.gtht.com/resume/edit/`

登录后回复，再用付费 id 继续 MODE=fill（不点网站保存）。
