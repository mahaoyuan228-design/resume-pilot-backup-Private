# 北森 Beisen-2022 第一切片 · NEXT（2026-10-18）

时区：Asia/Shanghai  
状态：**offline scaffold only** — 未宣称客户可填；未 live fill  
对齐：`shared-ats-fingerprint-zhiye-moka-feishu-20261018.md` · `EXPAND_PROGRESS.md`

---

## 1. Fingerprint summary

| 项 | 值 |
| --- | --- |
| `siteId` | **`beisen-2022`**（族级；君乐宝 ≈ 英威腾 ≈ 金山云同壳，非单租户） |
| 公开样例门户 | https://junlebaoruye.zhiye.com/campus/jobs （HTTP 200；SPA） |
| 同族对照 | `invt.zhiye.com` · `jssoft.zhiye.com`（同 `pc-e2be192404257687c4d1` chunk） |
| 栈 | 北森 **ux-recruitment-portal-2022**；CDN `acdn.bstatics.com`；嵌入 BSGlobal + 站点地图 |
| vs hotjob | **不可** CMS 复用（无 `wecruit.hotjob.cn`） |
| vs 北森 legacy | **不可**混用（新华 `nci.zhiye.com` = CmsPortal / `is-old`；与 2022 壳不同代） |
| 未登录简历表单 | **否** — `/personal/resume` 等同壳 0 input；表单需登录后客户端渲染 |

---

## 2. First-slice fields（本切片）

| 页标签 | Profile | 控件 | 状态 |
| --- | --- | --- | --- |
| 姓名 | `fullName` | text | scaffold + offline fill PASS |
| 手机号码 | `phone` | text | scaffold + offline fill PASS |
| 邮箱 | `email` | text | scaffold + offline fill PASS |

**刻意不做**：性别/婚姻 select、证件、教育、保存/投递、popup 接线、对外「已支持」。

**DOM 合同（provisional · public JS mismatch）**：fixture 仍用 `.bs-form-item` + `.bs-form-item-label` + `input.bs-input`（offline only）。  
公开 `ux-recruitment-portal-2022` 包（entry `pc-e2be192404257687c4d1` + phoenix/app/personal-center 等）**未出现**这些类名；近邻仅有 `form-item__control`（富文本）/`phoenix-input`（搜索壳）。  
**缺口**：`/campus/jobs` 与 `/personal/resume` SSR 皆空 `#bsMain`（0 input）；简历编辑仍登录墙。  
**未**把公开近邻类名当成 live 表单选择器（避免发明 DOM）。登录后若不同，只改 content 选择器。证据：`_beisen-2022-js-class-hints-20261018.txt`。

---

## 3. How to run

```bash
# Offline readiness (fixture)
MODE=readiness node scripts/auto-beisen-2022-basic.mjs --synthetic

# Offline fill-without-save (fixture; never Save)
MODE=fill node scripts/auto-beisen-2022-basic.mjs --synthetic

# Unit + harness tests
node --test tests/beisen-2022-basic.test.mjs

# Optional: live portal fingerprint only (needs Edge CDP; does NOT claim form fill)
MODE=readiness CDP_PORT=9237 node scripts/auto-beisen-2022-basic.mjs --live
```

证据：`dist/auto-runs/beisen-2022-basic-{readiness|fill}-latest.json`  
内容脚本：`src/content/beisen-2022-basic.js` · 映射：`src/content/beisen-2022-profile-map.mjs`  
Fixture：`tests/fixtures/beisen-2022-basic-form.html`

---

## 4. Live blockers（Jeremy）

1. **北森/zhiye 账号登录**后打开真实简历编辑页（首选君乐宝 `junlebaoruye.zhiye.com`），才能采 live DOM（替换 provisional `.bs-form-item`）。
2. 试用 Edge **CDP 9237** 可用时，可先跑 `--live` readiness 确认门户仍为 portal-2022；**不要**对 live 跑 fill 直到表单 DOM 对齐。
3. 扩展 reload：本切片尚未挂 SW/`BEISEN_2022_BASIC_AUTO`（content + harness 自注入即可）；接线 popup 前需 reload；`host_permissions` 已含 `https://*.zhiye.com/*`。
4. 中信 marital live / hotjob 租户 live / 飞书 ATSX live **并行阻塞**，本切片不插队那些队列。
5. 注意：`*.zhiye.com` 亦覆盖 legacy CmsPortal（新华）；content fingerprint 会排除 `CmsPortal`/`is-old`，勿对 legacy 宣称 2022 适配。

---

## 5. Safety

- Never click 保存 / 提交 / 投递。
- Fail-closed profile（无确认字段不写）。
- 不改 `cms-*` / `gth-*` / citics / feishu-atsx 逻辑。
- 对外口径：仍仅 CMS + GTH 可卖；Beisen-2022 = 实验脚手架。

*本文件：`dist/site-probes/BEISEN_2022_NEXT.md`*

## Extension wiring (2026-10-18 Asia/Shanghai)

extension wired; live still needs login+DOM harvest

## 6. Fixture realism refresh (2026-10-18 21:25 Asia/Shanghai)

- Re-fetched `https://junlebaoruye.zhiye.com/campus/jobs` (HTTP 200, ~22KB) and `/personal/resume` (same empty shell, 0 inputs) via box curl; refreshed `_raw-zhiye-moka-feishu-20261018/junlebao-*.html`.
- Searched portal-2022 entry + lazy `.chk.js` / CSS for provisional `.bs-form-item` → **no match** (not renamed).
- Updated fixture with public chrome (`#bsMain` / `.views` / `.view-main` / chunk fingerprint); form nodes stay provisional offline stand-ins.
- **Still docs+offline only**: form invisible without login — no invented live selectors; no live fill claim.
