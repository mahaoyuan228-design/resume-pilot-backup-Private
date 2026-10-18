# 站点指纹实验摘要 · 2026-10-18（Asia/Shanghai）

**范围**：E1（中信、招行）CDP 实页摸底 + E2（腾讯、阿里）公开页研究。  
**机器**：DESKTOP-UBHDGV5 · Edge CDP `9237`（试用多标签）/ `9239`（授权侧，本次未改页）。  
**原则**：只读 Runtime.evaluate；**未**点站点保存；**未**宣称支持；**未**改 CMS/GTH 适配器。

原始 JSON：同目录 `probe-citics.json` / `probe-cmb-*.json` / `probe-cms-*.json` / `probe-gth-edit.json`。

---

## E1 · 中信证券 `careers.citics.com`

| 项 | 结果 |
| --- | --- |
| 最终 URL | `https://careers.citics.com/my/jl?resumeType=0&type=edit&name=xiaozhao-cn` |
| 标题 | 完善简历-总部校园招聘 |
| 登录墙 | **否**（当前会话已登录；页顶有手机号脱敏 + 退出） |
| ATS 指纹 | **未见** beisen / moka / hotjob / wecruit / feishu。自托管 Vue CLI 风格：`/js/chunk-vendors.*.js` + `/js/app.*.js` |
| 其他脚本 | 网易易盾验证码 `cstaticdun.126.net`；空 src 的 `yidun_cover-frame` / `NECaptchaSafeWindow` iframe |
| 表单字段（约） | inputs **157** · textareas **10** · buttons **21** · selects **0**（下拉多为自定义组件） |
| 分区线索 | 个人信息 / 联系方式 / 教育经历 / 工作实习 / 证书技能 / 语言 / 家庭 / 其他 / 声明；支持简历上传解析 |
| 难度判断 | **new-adapter**（新适配器）。与 CMS hotjob **不同源**，不能靠加 host 白名单复用。 |

---

## E1 · 招商银行 `career.cmbchina.com`

| 项 | 结果 |
| --- | --- |
| 简历页 URL | `https://career.cmbchina.com/center/resume` |
| 登录页 URL | `https://career.cmbchina.com/login?redirect=%2Fcenter%2Fresume` |
| 标题 | 招商银行招聘 |
| 登录墙 | 简历页当前会话 **可进**；另开登录页：手机号/邮箱/微信 + 验证码（`loginHints=true`，3 个 input） |
| ATS 指纹 | **未见** hotjob/wecruit/beisen/moka。自托管 SPA：`/static/js/main.d37c8446.js`（CRA/webpack 单包形态） |
| 表单字段（约） | inputs **71** · textareas **5** · buttons **11** |
| 分区线索 | 个人信息 / 教育（从高中）/ 家庭近亲属 / 技能 / 实践 / 荣誉 / 社团；PDF 解析上传 |
| 与「招商证券 CMS」关系 | **不是同一套**。证券走 `wecruit.hotjob.cn`；银行走自建 `career.cmbchina.com`。 |
| 难度判断 | **new-adapter**。 |

移动端另有 `cmb-recruitment-mobile.paas.cmbchina.com`（公开资料），桌面适配以官网为准即可。

---

## 对照基线（只读，确认未伤现网）

| 站 | URL | 指纹要点 | 字段约 |
| --- | --- | --- | --- |
| CMS resumeOperation | `wecruit.hotjob.cn/.../resumeOperation.html?...` | 域名即 hotjob/wecruit；`pb/js/resumeOperation.js` | inputs 104 · ta 10 |
| CMS index | `wecruit.hotjob.cn/.../pb/index.html#/` | fingerprints: hotjob + wecruit | 门户 |
| GTH edit | `https://hr.gtht.com/resume/edit/` | 自建 Vue + `sources/standardproduct`；原生 input≈0（自定义弹层） | 分区「编辑/添加」模式 |

---

## E2 · 腾讯 / 阿里（公开页，未进登录后简历编辑）

### 腾讯

- **校招主入口**：`https://join.qq.com/`（岗位例：`join.qq.com/post.html?...`）
- **招聘门户校招页**：`https://careers.tencent.com/zh-cn/campusrecruit.html`（2027 校园招聘 / 实习入口导航）
- **形态**：明显**自建**。静态资源在 `cdn.multilingualres.hr.tencent.com`（`manifest.build.js` / `vendor.build.js` / 页面 chunk），无北森/Moka/hotjob 痕迹。
- **难度**：一家一套 **new-adapter**；投递/简历编辑多半要校招账号或登录态。公开页只能摸门户，**未**打开个人简历表单。
- **白话**：腾讯校招是自己的站，不是买来的招聘云；接它≈单独做一套，且要能登录才看得到填表页。

### 阿里

- **校招**：`https://campus-talent.alibaba.com/`（岗位列表 `/campus/position`）
- **社招/集团门户**：`https://talent.alibaba.com/`
- **形态**：明显**自建** CPO 招聘门户。`g.alicdn.com/CPO-platform/recruit-portal`、`platform/campus-application`、React 16、icestark 微模块；cookie/`__sysconfig.circle` 指向阿里内部招聘域。
- **难度**：**new-adapter** + 登录（阿里账号体系）；公开页无完整简历编辑 DOM。
- **白话**：阿里校招/社招都是自家 HR 前台，和券商用的 hotjob 不是一路货；要单独排期，还得有可登录身份才能做字段映射。

---

## 难度总表

| 目标 | 猜测栈 | 难度 | 备注 |
| --- | --- | --- | --- |
| 中信 careers.citics.com | 自建 Vue + 易盾 | new-adapter | 简历编辑已打开，字段多，优先做最小闭环 |
| 招行 career.cmbchina.com | 自建 SPA | new-adapter | 简历页已打开；注意「保存后证件不可改」类约束 |
| 复用 CMS hotjob 其它租户 | wecruit.hotjob.cn/SU* | **reuse-existing-adapter**（仅白名单） | E1 两家**不是**此栈；需另找同栈大客户 |
| 腾讯 join.qq / careers.tencent | 腾讯自建 HR CDN | new-adapter / 偏 blocked（缺登录） | 先要登录态再指纹表单 |
| 阿里 campus-talent / talent | 阿里 CPO 自建 | new-adapter / 偏 blocked（缺登录） | 同上 |

---

## 建议下一适配目标（按杠杆排序，不承诺工期）

1. **同 hotjob/wecruit 的其它大客户租户**（若能从客户名单或公开站认出 `wecruit.hotjob.cn/SU…`）——复用 CMS 引擎，杠杆最大；本次 E1 **未**撞上。  
2. **中信 `careers.citics.com`**——会话已在编辑页、字段齐全、金融客群匹配；新适配器但摸底成本已付。  
3. **招行 `career.cmbchina.com`**——同上，表单已开；与证券 CMS 分开排期，勿混称「招商一家」。

腾讯/阿里列入后续大厂自建队列，**不**建议插队到「本周可卖故事」里。

---

## 阻塞 / 需要帮助

- E1 两家当前**不需要**新登录（试用 Edge 已进简历页）。若会话过期再测，父代理再说「我需要帮助！」并给出：  
  - 中信：`https://careers.citics.com/my/jl?...`  
  - 招行：`https://career.cmbchina.com/center/resume`（登录：`.../login?redirect=%2Fcenter%2Fresume`）  
- E2 要做填表指纹需要：腾讯 `join.qq.com` 登录后简历/投递页、阿里 `campus-talent.alibaba.com` 个人中心/申请表 URL（待打开后再记）。  
- **未发现**「加一条 host_permissions 就能填」的 30 分钟热路径（中信/招行均非 hotjob）。

---

*探针时刻（ISO/UTC 存于 JSON）：约 2026-10-18 18:22 CST。勿对外说「已支持」。*
