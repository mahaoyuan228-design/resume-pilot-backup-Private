# Codex 裁剪 F：付费 Edge QA（2026-10-19）

Never Save。未宣称招行已支持。本文不重报验收百分比。

Codex 草稿正文不在这次 Cloud 检出里。要点取自已入库的 [`PAID_HANDOFF_QA_BLOCKER_20261018.md`](../../PAID_HANDOFF_QA_BLOCKER_20261018.md)。

- 付费 QA 用授权版 Edge CDP **9239**（付费包）。试用 Edge **9237** 不能代替付费 QA。两边的站点 Cookie 不互通。
- 9239 上招商 CMS 与国泰 GTH 当时未登录。8 段 fill（cms-basic / cms-education / cms-internship / gth-basic / gth-education / gth-intent / gth-other / gth-simple）停在 `blocked_login`，不是授权拦截。
- 需要 Jeremy 时：在 9239 窗口登录招商 CMS 的可编辑 `resumeOperation.html`，以及国泰 `https://hr.gtht.com/resume/edit/`。登录后再做 MODE=fill。不点网站保存。
- 招行 live Select 10 字段是试填 Edge 9237 上的点击，不是 9239 付费 QA。招行仍未宣称已支持。
