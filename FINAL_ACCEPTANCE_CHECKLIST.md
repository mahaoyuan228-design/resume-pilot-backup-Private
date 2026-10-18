# FINAL_ACCEPTANCE_CHECKLIST — 窄版 0.1.4.9

日期：2026-10-18（Asia/Shanghai）  
验收整数：**85%**（不抬；离线 smoke / 文档不抬 %）  
政策：**Never Save** on GTH auto；**不发明**生产域名 / 支付 / 钥。

---

## 已 OK（live / 离线已举证）

| 项 | 状态 | 证据指针 |
| --- | --- | --- |
| **CMS 个人基本信息 basic fill** | **OK** | MODE=fill `verified_partial`; ready 10/10; `writeAttempted=true`; **saveAttempted=false**. `dist/auto-runs/cms-basic-fill-latest.json` |
| **GTH 求职意向 intent** | **preexisting OK** | five-of-five ready; fill outcome `verified_preexisting`; **Never Save**. `dist/auto-runs/gth-intent-latest.json` |
| **GTH other + skills** | **placeholders** | 其他信息 / 职业技能与特长：storage 测试占位 + page soft-skip / preexisting；wrap fill-wo-save completed；**Never Save** |
| **付费包离线冒烟** | **OK（DEV only）** | `node scripts/build-paid-smoke.mjs` → productFileCount **96** + license 11; URL **`https://127.0.0.1:8787` only**；`dist/edge-paid-v0.1.4.9-202610180035106`；mock `/v1/verify` 7/7 PASS |

---

## 剩余（Jeremy 侧 / 运营资产 — 非 agent 代办）

| 项 | 说明 |
| --- | --- |
| **domain + pay + keys** | 生产 HTTPS / 支付发码 / Ed25519 生产钥 — 见 `LICENSE_JEREMY_CHECKLIST.md`。域名 **`jianlikuaitian.com` 已购且实名**（Aliyun）。**仍缺** live HTTPS 落地/校验举证与生产发码闭环；**禁止**在无 HTTPS 证据时抬验收 % 或伪称已上线校验域。 |
| **replace placeholders** | GTH other/skills 测试占位 → 真实文案（确认后 MODE=fill；**No invent**） |
| **optional GTH Save** | 政策暂缓；仅 Jeremy 按 `GTH_EDUCATION_READINESS.md` one-shot；auto **永不** Save |

---

## 验收 % 口径

- **当前：85%**
- 抬高条件：live rubric 新证据，或生产 HTTPS+支付+钥三项勾选后计入约 15%
- 离线 unit / paid-smoke / 文档更新：**不**抬整数 %

指针：`WAKE_JEREMY.md` · `STATUS_OVERNIGHT.md` · `验收清单.md` · `LICENSE_JEREMY_CHECKLIST.md`
