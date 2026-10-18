# PAYMENT_ISSUANCE_DRAFT — 窄版收款与付款后发码（已锁定路径）

日期：2026-10-18（Asia/Shanghai）  
范围：窄版可装可收费（CMS+GTH）；**不**宣称已上线 HTTPS 收款页；**不**发明商户号 / API Secret。  
验收口径：保持 **85%**（无 live HTTPS 证据前不抬 %）。  
域名：`jianlikuaitian.com`（已购、已实名；Aliyun 万网 DNS）。

---

## 一句话（锁定）

**本阶段主路径 = 个人转账（银行 / 支付宝个人 / 微信个人）+ Jeremy 人工确认到账 + 离线 Ed25519 发码 + 客户在激活页粘贴。**  
微信商户 / 支付宝商户：**暂停**，直至取得营业执照后再进件。  
Stripe：不作中国大陆人民币主路径。

---

## 四方案对比（归档备查）

| 维度 | 微信商户 | 支付宝商户 | Stripe | **个人转账 + 人工发码（锁定）** |
| --- | --- | --- | --- | --- |
| 大陆客户习惯 | 优 | 优 | 弱 | 可（小量订单） |
| solo 门槛 | 高（执照/进件） | 高 | 高 | **低** |
| 与现有代码 | 需 webhook | 同左 | 同左 | **高**：粘贴 entitlement |
| 本月成本 | 进件+开发 | 同左 | 主体不确定 | **最低** |
| 本阶段状态 | **暂停** | **暂停** | 不主用 | **进行中** |

**禁止：** 编造 mch_id、app_id、API Key、回调 URL。

---

## 每单流程（运营照此执行）

详见可执行手册：`OPS_MANUAL_MANUAL_PAY.md`。

摘要：

1. 报价（席位、天数、价格 TBD）→ 客户提供 `installId`  
2. 客户按你私发的收款信息转账（**收款信息勿提交 git**）  
3. 你核对到账  
4. 本机运行 `scripts/issue-entitlement.mjs`（私钥在 `%USERPROFILE%\secrets\resume-paid-ed25519\`）  
5. 把 JSON 或 Base64 私发给客户 → 激活页粘贴  
6. 本地订单表留痕（勿贴私钥）

---

## 签发命令（Windows）

```powershell
cd <repo-root>   # 例如 Desktop\ResumeQuickFill-Dev\resume-autofill-dev 或 box 同步树
node scripts\issue-entitlement.mjs `
  --private-key "$env:USERPROFILE\secrets\resume-paid-ed25519\resume-paid-private.pem" `
  --install-id "<客户激活页显示的 UUID>" `
  --days 365 `
  --license-id "lic-YYYYMMDD-001"
```

脚本会拒绝：仓库内路径、EXAMPLE/fixtures 钥。私钥**永不** commit / Desktop 公开夹 / 聊天。

公钥路径（仅给 `build-paid`）：

`%USERPROFILE%\secrets\resume-paid-ed25519\resume-paid-public.pem`

---

## 与仓库文档

| 文件 | 关系 |
| --- | --- |
| `OPS_MANUAL_MANUAL_PAY.md` | **一单一单照做** |
| `LICENSE_JEREMY_CHECKLIST.md` | HTTPS / 支付 / 钥三件套 |
| `ED25519_LOCAL_DRILL.md` | 钥生成与 build-paid |
| `ANTI_RESALE.md` | 非完整 DRM；密钥政策 |
| `site/index.html` | 落地页（收款空白留给你填） |
| `DNS_HOSTING_PLAN.md` | 域名 → 静态托管 / HTTPS |

---

## Ask Jeremy？

收款账号、价格 TBD、是否开 OSS（可能产生按量费用）需你确认。  
**验收保持 85%**，直至 `https://jianlikuaitian.com`（或 license 子域）live 可举证。
