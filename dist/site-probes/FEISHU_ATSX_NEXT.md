# 飞书 ATSX 第一切片 · NEXT（2026-10-18）

时区：Asia/Shanghai  
状态：**offline scaffold only** — 未宣称客户可填；未 live fill  
对齐：`shared-ats-fingerprint-zhiye-moka-feishu-20261018.md` · `FEISHU_EXPAND_SOURCE.md` · `EXPAND_PROGRESS.md`

---

## 1. Fingerprint summary

| 项 | 值 |
| --- | --- |
| `siteId` | **`feishu-atsx`**（族级；广发 ≈ 字节同壳，非 `gf-atsx` 单租户） |
| 公开样例门户 | https://gffunds.jobs.feishu.cn/index （HTTP 200；SPA） |
| 同族对照 | `jobs.bytedance.com`（E4）；`thundersoft.jobs.feishu.cn`（同广发 saas-career JS） |
| 栈 | 飞书招聘 **ATSX saas-career**；CDN `lf-package-cn.feishucdn.com/obj/atsx-throne/.../saas-career/` |
| vs hotjob | **不可** CMS 复用（无 `wecruit.hotjob.cn`） |
| 未登录简历表单 | **否** — 门户有「简历」导航配置，无 `<form>`/`<input>` SSR；`/resume` 等裸 path 404（客户端路由） |
| Schema 证据 | 广发 index HTML 嵌入简历字段树：`姓名`(text) · `手机号码`(text) · `邮箱`(text) · … · `性别`(select) |

---

## 2. First-slice fields（本切片）

| 页标签 | Profile | 控件 | 状态 |
| --- | --- | --- | --- |
| 姓名 | `fullName` | text | scaffold + offline fill PASS |
| 手机号码 | `phone` | text | scaffold + offline fill PASS |
| 邮箱 | `email` | text | scaffold + offline fill PASS |

**刻意不做**：性别/婚姻 select、证件、教育、保存/投递、popup 接线、对外「已支持」。

**DOM 合同（JS-confirmed · live unproven）**：fixture 使用 `.atsx-form` / `.atsx-form-item` / `.atsx-form-item-label` / `.atsx-form-item-control` / `input.atsx-input`。  
这些类名在公开门户 JS/CSS 中已证实（`pc.4481de59.js`、`8825.0e3d5ab8.js` Ant Design `prefixCls=atsx`），**不是**凭空发明。  
**缺口**：`/index` SSR 仅 `#bd` 空挂载；简历编辑表单仍登录墙，**未见** live 字段 DOM。登录后若结构不同，只改 content 选择器，保持 siteId / 标签语义。  
Fixture 另加公开 chrome：`#bd` · `portal-pc` · `topbar*` · `footer`（来自同 pc 包）。证据：`_feishu-atsx-js-class-hints-20261018.txt`。

---

## 3. How to run

```bash
# Offline readiness (fixture)
MODE=readiness node scripts/auto-feishu-atsx-basic.mjs --synthetic

# Offline fill-without-save (fixture; never Save)
MODE=fill node scripts/auto-feishu-atsx-basic.mjs --synthetic

# Unit + harness tests
node --test tests/feishu-atsx-basic.test.mjs

# Optional: live portal fingerprint only (needs Edge CDP; does NOT claim form fill)
MODE=readiness CDP_PORT=9237 node scripts/auto-feishu-atsx-basic.mjs --live
```

证据：`dist/auto-runs/feishu-atsx-basic-{readiness|fill}-latest.json`  
内容脚本：`src/content/feishu-atsx-basic.js` · 映射：`src/content/feishu-atsx-profile-map.mjs`  
Fixture：`tests/fixtures/feishu-atsx-basic-form.html`

---

## 4. Live blockers（Jeremy）

1. **Feishu / 广发（或字节）账号登录**后打开真实简历编辑页，才能采 live 简历编辑 DOM（校验/微调 JS-confirmed `.atsx-form-item`；勿宣称已 live）。
2. 试用 Edge **CDP 9237** 可用时，可先跑 `--live` readiness 确认门户仍为 ATSX；**不要**对 live 跑 fill 直到表单 DOM 对齐。
3. 扩展：`FEISHU_ATSX_BASIC_AUTO` 已接线；试用 Edge 需 reload 后才进 SW。Live fill 仍待登录+DOM harvest。
4. 中信 marital live / hotjob 租户 live **并行阻塞**，本切片不插队那些队列。

---

## 5. Safety

- Never click 保存 / 提交 / 投递。
- Fail-closed profile（无确认字段不写）。
- 不改 `cms-*` / `gth-*` / citics 逻辑。
- 对外口径：仍仅 CMS + GTH 可卖；飞书 ATSX = 实验脚手架。

*本文件：`dist/site-probes/FEISHU_ATSX_NEXT.md`*

## Extension wiring (2026-10-18 Asia/Shanghai)

extension wired; live still needs login+DOM harvest

## 6. Fixture realism refresh (2026-10-18 21:20 Asia/Shanghai)

- Re-fetched `https://gffunds.jobs.feishu.cn/index` (HTTP 200, ~174KB) via box curl; refreshed `_raw-zhiye-moka-feishu-20261018/feishu-gffunds-index.html`.
- Compared provisional fixture classes → **match** public saas-career bundles (`atsx-form-item` / `atsx-form-item-label` / `atsx-form-item-control` / `atsx-input`); no class rename needed.
- Updated fixture with portal chrome + `atsx-form` wrapper + nested label/control/children mirroring Ant Design ATSX markup; neighbor 工作年限 unchanged.
- **Still docs+offline only**: form invisible without login — no invented live selectors; no live fill claim.

## 7. Extra fingerprint reuse candidates (2026-10-18 ~21:43 Asia/Shanghai)

Public Extra batch same saas-career JS as 广发 `gffunds.jobs.feishu.cn` (hosts already `*.jobs.feishu.cn` wildcards — **no adapter behavior change**):

| 雇主 | 公开样例 | 结论 |
| --- | --- | --- |
| 中科创达 | `thundersoft.jobs.feishu.cn` | reuse → **feishu-atsx** |

Login still required for resume-form DOM harvest. Docs-only; **no live claim**. Evidence: `shared-ats-fingerprint-zhiye-moka-feishu-20261018.md` Extra §4.2–4.4.
