# 飞书 ATSX · mioffice 孪生扫描（2026-10-18）

时区：Asia/Shanghai  
状态：**docs only** — 无新代码、无 Edge、无 live fill、无客户可填宣称  
对齐：`FEISHU_ATSX_NEXT.md` · `NON_HOTJOB_FINGERPRINT_20261018.md` · `feishu-2027-campus-scrape-20261018.md` · `feishu-atsx-basic.js` host matcher

---

## 1. Adapter host families（已接线）

| Host family | 样例雇主 / 证据 URL | 接线状态 | 备注 |
| --- | --- | --- | --- |
| `*.jobs.feishu.cn` | 广发 `https://gffunds.jobs.feishu.cn/index`；中科创达 `https://thundersoft.jobs.feishu.cn/campus` | 已匹配 `feishu-atsx` | 同 `saas-career` JS；登录后才有简历 DOM |
| `jobs.bytedance.com` | `https://jobs.bytedance.com/campus`（E4） | 已匹配 | 飞书 ATSX 族门户；非 hotjob |
| `*.jobs.f.mioffice.cn` | 小米 `https://xiaomi.jobs.f.mioffice.cn/newretailing/?spread=M1SXHJC` | **host 已接线 2026-10-18**（manifest + content matcher） | 同 `pc.4481de59.js` / `8825.0e3d5ab8.js`；**live DOM 仍 login-gated** |

证据：`src/content/feishu-atsx-basic.js`（`jobs.f.mioffice.cn` / `*.jobs.f.mioffice.cn`）；`manifest.json` `host_permissions`；指纹 `NON_HOTJOB_FINGERPRINT_20261018.md` · `FEISHU_ATSX_NEXT.md` §8。

---

## 2. mioffice 租户扫描结果

| 项 | 结论 |
| --- | --- |
| 搜索范围 | `feishu-2027-campus-scrape-20261018.md` · `FEISHU_EXPAND_SOURCE.md` · `EXPAND_PROGRESS.md` · `dist/site-probes/*.{md,json}` · `_temp-scripts/*.md` · `rg -i 'mioffice\|jobs\.f\.'`（排除巨大 `_raw*`） |
| 命中 apply URL | **仅 1 条**：小米零售 `https://xiaomi.jobs.f.mioffice.cn/newretailing/?spread=M1SXHJC` |
| 其它 `*.jobs.f.mioffice.cn` 租户 | **无** — **only Xiaomi in current scrape** |
| 发明 URL | **否** — 未构造其它 mioffice 子域 |
| 轻量 curl | **跳过** — 飞书 scrape 无第二家 mioffice；已知 `jobs.feishu.cn` 租户已指纹，不重复 |
| duomian / Redsea | skip（scrape 无具体 https） |

---

## 3. 扩站含义（一夜）

1. mioffice **host family 已够用**（通配 `*.jobs.f.mioffice.cn`）；当前线索表里只有小米一家需登录采 DOM。
2. 若日后 bitable / 销售名单出现其它 `*.jobs.f.mioffice.cn` 子域，**无需再改 host matcher** — 仍属同一 ATSX saas-career 族候选；先公开 curl 确认 `atsx-throne`/`saas-career`，再排登录 harvest。
3. **勿**抬验收 %；**勿**写客户已支持小米/广发/字节。

---

## 4. 相关路径

| 文件 | 路径 |
| --- | --- |
| 本笔记 | `dist/site-probes/FEISHU_ATSX_MIOFFICE_TWINS_20261018.md` |
| 小米指纹 | `dist/site-probes/NON_HOTJOB_FINGERPRINT_20261018.md` |
| ATSX NEXT | `dist/site-probes/FEISHU_ATSX_NEXT.md` |
| 校招 scrape | `dist/site-probes/feishu-2027-campus-scrape-20261018.md` |

*探针/扫描时刻：约 2026-10-18 22:23 Asia/Shanghai。*
