# 中信适配器设计（第一切片）· 不破坏 CMS/GTH

日期：2026-10-18（Asia/Shanghai）  
状态：**设计稿** — 未实现、未宣称支持  
输入：`dist/site-probes/citics-field-map-20261018.md` · `probe-20261018-summary.md`

## 1. 目标与非目标

| 做 | 不做 |
| --- | --- |
| 新站点 id，独立匹配 careers.citics.com 简历编辑页 | 不改 CMS/GTH 现有 match、脚本列表、授权闸门 |
| 最小闭环：个人信息/联系方式 5～8 项 fill-without-save | 不点保存/提交；不碰易盾；不接教育/实习 |
| host_permissions 仅加中信域名 | 不把中信逻辑塞进 `cms-*` / `gth-*` 文件 |

## 2. 站点身份（建议）

| 项 | 值 |
| --- | --- |
| `siteId` | `citics`（字符串常量；与 `cms` / `gth` 并列） |
| 匹配 origin | `https://careers.citics.com` |
| 简历编辑 path | `/my/jl`（query 可含 `resumeType` / `type=edit` / `name=xiaozhao-cn` 等，**匹配时忽略 query** 或仅要求 `type=edit`） |
| 标题线索 | `完善简历`（辅助，不作硬依赖） |
| 明确排除 | `wecruit.hotjob.cn`、`hr.gtht.com`、`career.cmbchina.com` |

建议探测函数（伪代码，独立文件如 `src/popup/site-detect.mjs` 或局部函数）：

```js
function isCiticsResumeEditPage(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:"
      && u.hostname === "careers.citics.com"
      && u.pathname === "/my/jl";
  } catch { return false; }
}
```

**禁止**扩展现有：

- `isCmsResumePage`（必须仍仅 `wecruit.hotjob.cn` + `…/pb/resumeOperation.html`）
- GTH `hr.gtht.com/resume/edit/` 探针

## 3. Manifest / 权限

在 `manifest.json` `host_permissions` **追加**一行：

- `https://careers.citics.com/*`

保留原有：

- `https://hr.gtht.com/*`
- `https://wecruit.hotjob.cn/*`

不引入 `<all_urls>`。内容脚本继续走 popup/background `scripting.executeScript` 按 tab 注入（与现网一致），新站单独 `files: ['src/content/citics-basic.js', …]`。

## 4. 代码落点（与 CMS/GTH 隔离）

```
src/content/citics-basic.js          # 标签定位 + text/radio/date 写入与读回
src/background/citics-basic-auto.mjs # 可选：自动任务编排（仿 gth-basic-auto，但独立）
src/auto/citics-basic-auto.html/.js  # 可选启动页
src/popup/popup.js                   # 仅增加「若 isCitics… 则走 citics 分支」；CMS/GTH 分支原样
```

命名全部 `citics-*`，**禁止**在 `cms-session.js` / `gth-basic.js` 内加 `if (citics)`。

授权/绑定：沿用现有 license gate；新站动作同样 fail-closed。不在本切片发明支付或新 HTTPS 端点。

## 5. 第一切片字段映射

来源：字段图「最小闭环」。优先纯文本，再 radio，日期最后。

| Profile 路径（建议） | 页标签 | 控件策略 |
| --- | --- | --- |
| `basic.lastName` / 现有姓字段 | 姓 | input value + input/change |
| `basic.firstName` | 名 | 同上 |
| `basic.idNumber`（或 custom） | 证件号码 | 文本；证件类型若页上已有值则跳过 |
| `basic.mobile` | 手机 | 文本 |
| `basic.email` | 电子邮箱 | 文本 |
| （同值写回） | 确认邮箱 | 文本 |
| `basic.gender` | 性别 | Ant Radio：按「男/女」点 label |
| `basic.birthDate`（可选第 8） | 出生日期 | Ant DatePicker；可第二拍再做 |

读回：写后用同一 label → control 取值，与 CMS 一样做逐项比对；失败只报该项，不级联点保存。

## 6. 安全阀：永不保存

- 内容脚本**不**查询/点击文案含「保存」「提交」「暂存」的主流程按钮。
- 自动任务结束条件 = 读回报告；不调用任何 submit API。
- 若后续误加保存，必须独立 review + 产品确认（本设计明确默认关闭）。

## 7. 回归清单（合并前必做）

1. 授权版 Edge：招商 `resumeOperation.html` 教育/基本信息试填路径仍可点开且无新报错。  
2. 国泰 `hr.gtht.com/resume/edit/` 基本信息/教育试填仍可走。  
3. 中信切片仅在 `careers.citics.com/my/jl` 注入；在 CMS/GTH 页执行 citics 探测应为 false。  
4. 未授权/无绑定：中信动作与现网一样被 gate 拦住。

## 8. 与 hotjob 租户扩容的关系

- 中信是 **new-adapter**，与 `hotjob-tenants-20261018.md` 的 reuse 路线并行、互不替代。  
- hotjob 其它 SU：只扩 CMS 白名单/SU 校验，**不要**复用 citics 适配器。

## 9. 实现顺序（建议）

1. manifest host + `isCiticsResumeEditPage` + 空壳 content 探针（只读标签列表）  
2. 6 项文本 fill + 读回  
3. 性别 radio  
4. （可选）出生日期  
5. 回归 CMS/GTH  
6. 文档「已支持」**仅在**稳定后才改客户口径；此前只留在 EXPAND_PROGRESS

## 10. 阻塞

- 会话过期需重新登录中信时：对用户说 **我需要帮助！** 并给出 `https://careers.citics.com/my/jl?…`  
- Ant Select（国籍/民族等）不在第一切片；避免一上来啃级联。
