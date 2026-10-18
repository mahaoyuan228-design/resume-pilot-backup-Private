# STATUS_OSS_LICENSE — 离线发码 vs OSS/域名阻塞（2026-10-18）

时区：Asia/Shanghai  
产品：简历快填 / ResumeQuickFill  
验收口径：**85%**（无 live HTTPS 证据前**不抬**）

---

## 一句话

**今天就能靠「私信转账 + 本机 Ed25519 发码 + 客户粘贴激活」卖出第一单。**  
卡在 Aliyun OSS **自定义域名绑定 / ICP** 的部分，只挡住「官网 HTTPS 品牌站」和日后在线 `/v1/verify`，**不挡住**离线人工销售。

---

## 今天已经能用（离线）

| 项 | 状态 | 说明 |
| --- | --- | --- |
| 生产 Ed25519 钥（Jeremy PC） | OK | `%USERPROFILE%\secrets\resume-paid-ed25519\`；公钥文件 SHA256 = `22A12E7C131B53FC13B50194CAB3E3A56AE9E0E3655010E5AE7DDFF45F450996`（与 20261018-090245 嵌入钥一致；旧 0B77… 文档值已作废） |
| `scripts/issue-entitlement.mjs` | OK | 拒绝仓库内钥 / EXAMPLE 钥；输出 JSON + Base64；**不写**客户数据库 |
| 干跑（假机） | PASS 2026-10-18 | `installId=00000000-0000-4000-8000-00000000DEAD`，`--days 1`，`licenseId=lic-DEMO-DRYRUN-NOT-FOR-CUSTOMER`；公钥验签通过；**非真实客户** |
| **生产付费包** | **OK 2026-10-18** | `dist/edge-paid-v0.1.4.9-20261018-090245`（生产公钥 + requireSigned=true）；旧 20261017 包作废 |
| 激活路径 | OK（产品侧） | 付费包「授权激活」粘贴 → 本机 installId 绑定 |
| 销售路径文档 | OK | `OPS_MANUAL_MANUAL_PAY.md`（零编程逐步） |
| 落地页模板 | OK（占位） | `site/index.html`：价格 **TBD**；收款信息为空白虚线框 — **未填写真实账号/价格** |
| OSS 静态首页对象 | OK（文件级） | 桶 `jianlikuaitian-site`（杭州）已上传 `index.html` + public-read + 静态首页开关 |

---

## 今天还等着（不阻塞私信首单）

| 项 | 状态 | 影响 |
| --- | --- | --- |
| 自定义域名绑定 `jianlikuaitian.com` → OSS | 阻塞中（控制台校验/提交未完成；疑似待 ICP） | 不能用品牌域名打开官网 |
| DNS CNAME / A | 未配（无控制台给出的合法目标前不编造） | 域名解析不到站点 |
| 大陆桶自定义域 HTTPS | 通常要 ICP 备案 | 无 `https://jianlikuaitian.com` 举证 |
| 微信/支付宝**商户** | 暂停（无营业执照） | 继续用个人转账 |
| 生产 HTTPS `/v1/verify` 写入付费包 | 未上线 | 离线粘贴激活仍可用；在线复验以后再加 |
| 对外「官网已上线」话术 | **禁止** | 验收保持 85% |

OSS 对象直链（仅作**下载兜底**，不是官网）：

- `http://jianlikuaitian-site.oss-cn-hangzhou.aliyuncs.com/index.html`  
  （可能带 `Content-Disposition: attachment`；勿当品牌首页宣传）

---

## 第一单是否可以发生？

| 问题 | 答案 |
| --- | --- |
| 没有 live `jianlikuaitian.com` 能否成交？ | **能** — 私信报价 → 收转账证明 → `issue-entitlement.mjs` → 私信授权码 → 客户粘贴激活 |
| 还缺什么会卡住首单？ | 见下方「首单缺口清单」 |
| 验收是否因此抬到 >85%？ | **否** |

---

## 首单缺口清单（无自定义域 HTTPS 时）

下列任一项未就绪，都可能让「想收钱」变困难；**带 ★ 的是硬阻断**：

1. ★ **发给客户的必须是** `edge-paid-v0.1.4.9-20261018-090245`（生产公钥）；旧 `20261017-*` 付费包已作废  
2. ★ **你能收到并核对转账**（个人收款方式已定，仅私信告知）  
3. ★ **客户能提供 installId**（会装扩展、会打开激活页）  
4. ★ **本机 Node 可用**，能在 `resume-autofill-dev` 跑通发码命令（干跑已 PASS）  
5. 价格与席位天数你已口头/书面约定（文档不代填金额）  
6. 订单表本机留痕习惯（防对账混乱）  
7. （软）换机/退款话术你已想好（见 OPS 手册窄船表）  
8. （非阻断）官网 / ICP / 商户号 / 在线 verify 真正返回 200 — **可后补**；粘贴激活可先离线

### 付费包现状（2026-10-18 17:02 Asia/Shanghai）

| 包 | 状态 |
| --- | --- |
| **`dist/edge-paid-v0.1.4.9-20261018-090245`** | **客户候选（生产公钥）** — 见下方核验 |
| `edge-paid-v0.1.4.9-20261017-115116` | **作废（勿发客户）** — 非生产钥 / localhost / requireSigned=false |
| `edge-paid-v0.1.4.9-202610171151160` | **作废（勿发客户）** — 同上 |

**客户候选路径（PC）：**  
`…\dist\edge-paid-v0.1.4.9-20261018-090245\extension`  
**客户 ZIP：** `…\dist\edge-paid-v0.1.4.9-20261018-090245.zip`（约 1.1 MB；解压得同名文件夹 → Edge「加载解压缩的扩展」）。安装说明：`INSTALL_PAID_CUSTOMER.md`。

**核验（已 PASS）：**

| 检查 | 结果 |
| --- | --- |
| 公钥文件 SHA256 | `0B77516A4D70D03FC5A4533A5C0118C61992B21D5C760D3163D549E8903C56EE` |
| 嵌入公钥 DER ≡ 生产公钥 | PASS |
| `requireSignedEntitlement` | `true` |
| `licenseServiceUrl` | `https://jianlikuaitian.com`（非 127.0.0.1） |
| dist 内 `BEGIN … PRIVATE KEY` | **无**（仅注释写 NEVER embed private key） |
| 结构冒烟 + 假机签发相对嵌入公钥验签 | PASS |
| `build-paid-smoke.mjs` | **未**用于客户包（默认 EXAMPLE + localhost + requireSigned false） |

说明：域名尚未 live 时，客户仍靠粘贴离线激活。**不要**宣称已有生产 `/v1/verify`。验收仍 **85%**。

重打命令（若需再打）：

```powershell
cd $env:USERPROFILE\Desktop\ResumeQuickFill-Dev\resume-autofill-dev
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-paid.ps1 `
  -LicenseServiceUrl 'https://jianlikuaitian.com' `
  -PublicKeyPemPath "$env:USERPROFILE\secrets\resume-paid-ed25519\resume-paid-public.pem" `
  -RequireSignedEntitlement
```

---

## 代理 / 自动化边界（提醒）

- **不**发明价格、支付账号、商户 ID、真实客户 license 码  
- **不**把私钥放进 Desktop / git / 聊天  
- **不**在无 HTTPS 证据时抬验收 %  
- Aliyun 自定义域绑定由 Jeremy 在控制台继续处理

---


## Jeremy 验收干跑（168 CNY 永久 · 2026-10-18 17:44 Asia/Shanghai）

| 项 | 结果 |
| --- | --- |
| 永久命令 | `node scripts\issue-entitlement.mjs … --expires-at-ms 4070908800000 --license-id "lic-168-PERM-…"`（`--days` 最大 3650，不可当永久） |
| 价格口径 | **168 CNY 永久**（私信）；支付宝个人可后补 |
| installId | `c4e623e5-beb2-441f-af39-9a2e6d1aea47` |
| licenseId | `lic-ACCEPT-168-PERM-20261018` |
| 激活 | **PASS**（active / 允许填写 / 2099-01-01） |
| 验收 % | 仍 **85%**（无 live HTTPS） |
| 细节 | 见 `OPS_MANUAL_MANUAL_PAY.md` 文末「Jeremy 验收干跑」 |

## 指针

- 操作手册：`OPS_MANUAL_MANUAL_PAY.md`  
- 路径锁定：`PAYMENT_ISSUANCE_DRAFT.md`  
- 钥演练：`ED25519_LOCAL_DRILL.md`  
- 清单：`LICENSE_JEREMY_CHECKLIST.md`  
- OSS 瞬时记录：`oss-hosting-status-2026-10-18-1655.md`  
- 域名计划：`DNS_HOSTING_PLAN.md`
