# Moka 第一切片 · NEXT（2026-10-18）

时区：Asia/Shanghai  
状态：**offline scaffold only** — 未宣称客户可填；未 live fill  
对齐：`shared-ats-fingerprint-zhiye-moka-feishu-20261018.md` · `EXPAND_PROGRESS.md`

---

## 1. Fingerprint summary

| 项 | 值 |
| --- | --- |
| `siteId` | **`moka`**（族级；德州仪器等 `*.mokahr.com` 同壳，非 `ti` 单租户） |
| 公开样例门户 | https://app.mokahr.com/campus-recruitment/ti/143986 （HTTP 200；需 cookie；SPA） |
| 同族对照 | `static-ats.mokahr.com/recruitment-web-client/*`（build `20261012-1723-f0ef3-release`）；另样例 `leniu/36041` · `chint/40745` |
| 栈 | **Moka ATS** recruitment-web-client；`org.id=ti` · `siteId=143986` · `mode=campus` · `useApplyForm=true` |
| vs hotjob | **不可** CMS 复用（无 `wecruit.hotjob.cn`） |
| 未登录简历表单 | **否** — 门户仅 hidden `init-data`；无字段 input；`/apply` 等裸 path 404（客户端路由） |

---

## 2. First-slice fields（本切片）

| 页标签 | Profile | 控件 | 状态 |
| --- | --- | --- | --- |
| 姓名 | `fullName` | text | scaffold + offline fill PASS |
| 手机号码 | `phone` | text | scaffold + offline fill PASS |
| 邮箱 | `email` | text | scaffold + offline fill PASS |

**刻意不做**：性别/婚姻 select、证件、教育、保存/投递、popup 接线、对外「已支持」。

**DOM 合同（provisional · public JS/CSS mismatch）**：fixture 仍用 `.moka-form-item` + `.moka-form-item-label` + `input.moka-input`（offline only）。  
公开 `recruitment-web-client`（build `20261012-1723-f0ef3-release`）**未出现**这些类名（0 hits）。CSS 另有稳定 BEM 提示：`.apply-form__field*` / `.campus-apply__item|label|input`，以及带 hash 的 `.sd-Input-*` / `.sd-Form-*`（不适合作选择器）。  
**缺口**：门户 SSR 仅 `#app` + hidden `#init-data`（`useApplyForm=true`）；无字段 input；申请/简历编辑仍登录墙。  
**未**把 CSS 提示升格为 content 选择器（避免发明 live 表单 DOM）。登录后采真实 markup 再改选择器；优先稳定 BEM 而非 hashed sd-*。证据：`_moka-js-class-hints-20261018.txt`。

---

## 3. How to run

```bash
# Offline readiness (fixture)
MODE=readiness node scripts/auto-moka-basic.mjs --synthetic

# Offline fill-without-save (fixture; never Save)
MODE=fill node scripts/auto-moka-basic.mjs --synthetic

# Unit + harness tests
node --test tests/moka-basic.test.mjs

# Optional: live portal fingerprint only (needs Edge CDP; does NOT claim form fill)
MODE=readiness CDP_PORT=9237 node scripts/auto-moka-basic.mjs --live
```

证据：`dist/auto-runs/moka-basic-{readiness|fill}-latest.json`  
内容脚本：`src/content/moka-basic.js` · 映射：`src/content/moka-profile-map.mjs`  
Fixture：`tests/fixtures/moka-basic-form.html`

---

## 4. Live blockers（Jeremy）

1. **Moka / 德州仪器账号登录**后打开真实简历编辑页（`app.mokahr.com` TI `org=ti` / `siteId=143986`），才能采 live DOM（替换 provisional `.moka-form-item`）。
2. 试用 Edge **CDP 9237** 可用时，可先跑 `--live` readiness 确认门户仍为 Moka ATS；**不要**对 live 跑 fill 直到表单 DOM 对齐。注意裸 curl 易 cookie redirect loop（`acw_tc` / `connect.sid` / `moka-apply`）。
3. 扩展 reload：本切片尚未挂 SW/`MOKA_BASIC_AUTO`（content + harness 自注入即可）；接线 popup 前需 reload；`host_permissions` 已含 `https://*.mokahr.com/*`。
4. 中信 marital live / hotjob 租户 live / 飞书 ATSX live / Beisen-2022 live **并行阻塞**，本切片不插队那些队列。

---

## 5. Safety

- Never click 保存 / 提交 / 投递。
- Fail-closed profile（无确认字段不写）。
- 不改 `cms-*` / `gth-*` / citics / feishu-atsx / beisen-2022 逻辑。
- 对外口径：仍仅 CMS + GTH 可卖；Moka = 实验脚手架。

*本文件：`dist/site-probes/MOKA_NEXT.md`*

## Extension wiring (2026-10-18 Asia/Shanghai)

extension wired; live still needs login+DOM harvest

## 6. Fixture realism refresh (2026-10-18 21:25 Asia/Shanghai)

- Re-fetched `https://app.mokahr.com/campus-recruitment/ti/143986` (HTTP 200, ~163KB, cookie jar) via box curl; refreshed `_raw-zhiye-moka-feishu-20261018/moka-ti-campus.html`.
- Compared provisional `.moka-form-item` / `.moka-input` → **absent** from public JS/CSS/vendor; documented CSS-confirmed `apply-form__*` / `campus-apply__*` hints without adopting them as selectors.
- Updated fixture with public chrome (`#app` / `#init-data` / `#moka-version` / forSEO footer); form nodes stay provisional offline stand-ins.
- **Still docs+offline only**: form invisible without login — no invented live selectors; no live fill claim.

## 7. Extra fingerprint reuse candidates (2026-10-18 ~21:43 Asia/Shanghai)

Public Extra batch same `static-ats` recruitment-web-client build as TI `ti/143986` (hosts already `*.mokahr.com` wildcards — **no adapter behavior change**):

| 雇主 | 公开样例 | 结论 |
| --- | --- | --- |
| 乐牛游戏 | `app.mokahr.com/.../leniu/36041` | reuse → **moka** |
| 正泰安能 | `app.mokahr.com/.../chint/40745` | reuse → **moka** |

Login still required for resume-form DOM harvest. Docs-only; **no live claim**. Evidence: `shared-ats-fingerprint-zhiye-moka-feishu-20261018.md` Extra §4.2–4.4.
