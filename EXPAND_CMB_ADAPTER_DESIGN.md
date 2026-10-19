# 招行适配器设计（第一切片）· 不破坏 CMS/GTH

日期：2026-10-19（Asia/Shanghai）  
状态：**设计稿 + offline scaffold** — 未宣称客户可填；未 live fill  
输入：`dist/site-probes/probe-cmb-*.json` · `probe-20261018-summary.md` · `CMB_FINGERPRINT_REFRESH_20261019.md` · `cmb-field-map-20261019.md`

## 1. 目标与非目标

| 做 | 不做 |
| --- | --- |
| 新站点 id，独立匹配 `career.cmbchina.com` 简历页 | 不改 CMS/GTH/citics/feishu 现有 match、脚本、授权闸门 |
| 最小闭环：个人信息 姓名/手机号/邮箱 fill-without-save | **永不**点保存/提交（页明示姓名/证件保存后不可改） |
| host_permissions 仅加招行域名 | 不把招行逻辑塞进 `cms-*` / `gth-*`；**勿**与招商证券 hotjob 混称 |

## 2. 站点身份

| 项 | 值 |
| --- | --- |
| `siteId` | `cmb` |
| 匹配 origin | `https://career.cmbchina.com` |
| 简历编辑 path | `/center/resume`（CDP 2026-10-18） |
| 登录 path | `/login?redirect=%2Fcenter%2Fresume` |
| 栈（2026-10-19 刷新） | **React** `createRoot` + **ant-design**（`main.d37c8446.js` / `main.02cda64a.css`）；**非** Vue；**非** hotjob |
| 明确排除 | `wecruit.hotjob.cn`、`hr.gtht.com`、`careers.citics.com`、民生 `career.cmbc.com.cn` |

```js
function isCmbResumeEditPage(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:"
      && u.hostname === "career.cmbchina.com"
      && (u.pathname === "/center/resume" || u.pathname.startsWith("/center/resume/"));
  } catch { return false; }
}
```

## 3. Manifest / 权限

追加：`https://career.cmbchina.com/*`  
不引入 `<all_urls>`。内容脚本按 tab 注入 `src/content/cmb-basic.js`（与现网一致）。

## 4. 代码落点（隔离）

```
src/content/cmb-basic.js
src/content/cmb-profile-map.mjs
scripts/auto-cmb-basic.mjs          # --synthetic 优先；--extension 本刀未接线
tests/fixtures/cmb-basic-form.html
tests/cmb-basic.test.mjs
```

命名全部 `cmb-*`。授权闸门沿用现网 fail-closed。本切片**不**接线 SW `CMB_BASIC_AUTO` / popup（留给下一刀）。

## 5. 第一切片字段

| Profile | 页标签 | 控件策略 |
| --- | --- | --- |
| `fullName` | 姓名 | text + input/change；**保存后不可改** → 只 dry-fill |
| `phone` | 手机号 | text |
| `email` | 邮箱 | text |

DOM 合同（CSS-confirmed，live 未证实）：`.ant-form-item` / `.ant-form-item-label` / `input.ant-input`（公开 CSS 有大量 ant-*；非发明类名）。登录后若结构不同，只改选择器。

刻意不做：证件类型/号、政治面貌/民族 select、日期、级联地区、家庭、教育、上传 PDF。性别 radio 仅有后续 **offline synthetic**（公开 CSS 候选 fixture，live DOM 未采，未宣称已支持）— 见 `CMB_NEXT.md`。

## 6. 安全阀：永不保存

- 内容脚本不查询/点击「保存」「提交」。
- 自动任务结束 = 读回报告。
- 页文案：「请仔细核对…姓名、证件类型和证件号，简历保存后无法再次修改」→ 比中信更忌误点保存。

## 7. 回归清单

1. 招商证券 CMS / 国泰 GTH 路径不受影响。  
2. `isCmbResumeEditPage` 在 CMS/GTH/中信为 false。  
3. 未授权动作 fail-closed。

## 8. 实现顺序

1. [x] 指纹刷新 + 字段图 + 本设计  
2. [x] offline scaffold（map + content + fixture + harness + test）  
3. [ ] manifest host（本刀一并加）  
4. [ ] SW/popup 接线（可选下一刀）  
5. [ ] Jeremy 登录后 live DOM harvest → fill-wo-save  
6. [ ] 稳定后才改客户「已支持」口径

## 9. 阻塞

- 会话过期 / 需验证码登录：对用户说 **我需要帮助！** 并给 `https://career.cmbchina.com/center/resume`
