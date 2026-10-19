# 广东南粤银行 · CMS basic live · 2026-10-19

SU：`SU670a291d6202cc7666c744bc`  
页：`https://wecruit.hotjob.cn/SU670a291d6202cc7666c744bc/pb/resumeOperation.html`  
壳：hotjob pb（与招商同壳）。标题里没有 `自我评价必填`。  
环境：Jeremy 试用 Edge CDP **9237**。  
扩展实际 `--load-extension`：`Desktop\简历投递器\dist\edge-internal-v0.1.0-20261013-130219\extension`（不是 ResumeQuickFill-Dev 003753）。  
政策：MODE=fill = fill-without-save。**Never Save / 提交。**  
验收仍 **85%**。对外可卖仍只招商 CMS + 国泰 GTH。**不是**全站支持。

证据文件名（试用机 auto-runs，本提交不附 JSON）：`hotjob-tenant-670a29-cms-basic-20261019-090052.json`。

---

## 结果

| 轮次 | 结果 |
| --- | --- |
| Readiness | **PASS** |
| 较早 fill（姓名门未开） | Never Save；`personalVerified=6`（birthDate / 民族 / 证件类型等）。姓名、联系电话当时是 `duplicate_target` |
| ~09:00 Asia/Shanghai fill | Never Save；`personalVerified=8`；`failed=0`。DOM 读回：姓名=马颢原，移动电话=15811077639 |

## 代码闸（已在本 PR）

- `TENANT_SIGNATURE=['个人基本信息必填']`。招商基线仍用三段标题（含 `自我评价必填`）。
- `cmsSection` 的 `tenantMin`：有 `个人基本信息必填` 且有 `教育经历必填` 即可绑定（`自我评价` 可缺）。
- `cmsDecision`：`fullName` 只进 `个人基本信息必填`（`家庭关系必填` 姓名不再撞车）；同区同时有 `移动电话` 与 `联系电话` 时只绑移动电话；基本信息 `专业` / `专业名称` 为 `section_requires_mapping`；教育经历 `专业` 与 `专业名称` 都可作 education major。

未改 DOM 选择器。未点保存。
