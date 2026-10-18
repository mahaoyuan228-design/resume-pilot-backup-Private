# ED25519_LOCAL_DRILL — Windows 生产钥演练（公钥进付费包）

日期：2026-10-18（Asia/Shanghai）  
对象：Jeremy 本机（Windows）生成 Ed25519；**私钥永不入库**；公钥仅给 `build-paid`。  
验收口径：保持 **85%**。EXAMPLE ≠ 生产。

---

## 一句话

在 Windows 上生成一对 Ed25519 钥 → **私钥**只放在本机机密目录 → **公钥 PEM** 交给  
`scripts/build-paid.ps1 -PublicKeyPemPath <公钥.pem> -RequireSignedEntitlement`。  
仓库里的 `tests/fixtures/license/EXAMPLE_*` **只能**测文档/单元测试，**禁止**签客户令牌。

---

## Windows：生成密钥对（任选一种）

### 方式 A — OpenSSL（推荐，若已安装）

在 **PowerShell** 或 **cmd**（勿把输出贴进公开聊天）：

```powershell
# 建议目录：在仓库外，例如
$dir = "$env:USERPROFILE\secrets\resume-paid-ed25519"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
cd $dir

openssl genpkey -algorithm Ed25519 -out resume-paid-private.pem
openssl pkey -in resume-paid-private.pem -pubout -out resume-paid-public.pem

# 确认公钥形态（SPKI PUBLIC KEY）
Get-Content resume-paid-public.pem
# 应类似：
# -----BEGIN PUBLIC KEY-----
# ...
# -----END PUBLIC KEY-----
```

权限建议：私钥文件仅你的用户可读；勿放进 OneDrive 公开同步夹（若同步，确保私密）。

### 方式 B — Node（本仓库已有 crypto）

在仓库根（仍把**输出文件写到仓库外**）：

```powershell
node -e "const {generateKeyPairSync}=require('crypto');const fs=require('fs');const p=process.env.USERPROFILE+'\\\\secrets\\\\resume-paid-ed25519';fs.mkdirSync(p,{recursive:true});const {privateKey,publicKey}=generateKeyPairSync('ed25519');fs.writeFileSync(p+'\\\\resume-paid-private.pem',privateKey.export({type:'pkcs8',format:'pem'}));fs.writeFileSync(p+'\\\\resume-paid-public.pem',publicKey.export({type:'spki',format:'pem'}));console.log('wrote',p);"
```

### 方式 C — 仅理解形状时用 EXAMPLE（不要当生产）

```powershell
# 仅看测试公钥长什么样 — 不要用于客户签发
Get-Content tests\fixtures\license\EXAMPLE_ed25519_public.pem
```

---

## 公钥放到哪里（build-paid）

**嵌入的是公钥，不是私钥。** `build-paid.ps1` 会拒绝含 `PRIVATE KEY` 的 PEM。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-paid.ps1 `
  -LicenseServiceUrl 'https://<你已拥有的域名>' `
  -PublicKeyPemPath "$env:USERPROFILE\secrets\resume-paid-ed25519\resume-paid-public.pem" `
  -RequireSignedEntitlement
```

| 项 | 正确 | 错误 |
| --- | --- | --- |
| `-PublicKeyPemPath` | `…\resume-paid-**public**.pem` | 任何 `*private*.pem` |
| `-LicenseServiceUrl` | 你已拥有的 `https://…` | `jianlikuaitian.com`（购域前）或 `127.0.0.1` 当客户包 |
| 私钥 | 仅本机签发用 | commit / 发给客户 / 贴进 paid-config |

脚本行为摘要（已实现）：读 PEM → 校验为 PUBLIC KEY → 写入付费包内 `paid-config.mjs` 的 `publicKeyPem` 字符串；**从不**打包私钥。

---

## NEVER commit 私钥

| 规则 | 说明 |
| --- | --- |
| **禁止** git add 生产 `*private*.pem` | 含误放进 `src/`、`dist/`、`scripts/` |
| **禁止** 把私钥写进 ISSUE / 聊天 / WAKE | 公钥路径可以写；私钥内容不行 |
| EXAMPLE 私钥 | `tests/fixtures/license/EXAMPLE_ed25519_private.pem` 仅测试；**不是**生产例外 |
| 泄露应对 | 立刻停用该钥；生成新对；用新公钥重打付费包；旧令牌视为不可信 |

`.gitignore` 建议（若尚未忽略个人机密目录）：不要把 `~/secrets/` 链进仓库。仓库内只允许 EXAMPLE 测试钥。

---

## 签发客户令牌（生产私钥 · 离线）

签名信封形状（与 `src/license/signed-entitlement.mjs` 一致）：

```text
{ "v":1, "alg":"Ed25519", "payload":{ "status":"active", "installId":"<uuid>", "profileHash":null, "licenseId":"<id>", "expiresAtMs":<ms> }, "signature":"<base64>" }
```

本机示例（**生产私钥路径**；勿用 EXAMPLE）：

```powershell
node scripts\dev-sign-example-entitlement.mjs `
  --private-key "$env:USERPROFILE\secrets\resume-paid-ed25519\resume-paid-private.pem" `
  --payload '{"status":"active","installId":"<客户installId>","profileHash":null,"licenseId":"lic-001","expiresAtMs":4102444800000}'
```

脚本名含 `example`：逻辑可复用，**密钥必须换成你的生产私钥**。付款后谁跑这条命令：见 `PAYMENT_ISSUANCE_DRAFT.md`。

### 推荐：生产发码包装脚本

Windows 一单签发请优先用：

```powershell
node scripts\issue-entitlement.mjs `
  --private-key "$env:USERPROFILE\secrets\resume-paid-ed25519\resume-paid-private.pem" `
  --install-id "<uuid>" `
  --days 365 `
  --license-id "lic-001"
```

该脚本拒绝仓库内路径与 EXAMPLE fixtures；输出 JSON + Base64 供客户粘贴。详见 `OPS_MANUAL_MANUAL_PAY.md`。


---

## Box 上 EXAMPLE-only 演练记录（2026-10-18）

**目的：** 确认 box 上 openssl + `dev-sign-example-entitlement.mjs` 可用；**不是**生产钥仪式。

| 步骤 | 结果 |
| --- | --- |
| `openssl genpkey -algorithm Ed25519` → `/tmp/ed25519-example-drill/` | OK；演练后**已删除**临时私钥 |
| `openssl pkey -pubout` | OK；得到 SPKI `BEGIN PUBLIC KEY` |
| `node scripts/dev-sign-example-entitlement.mjs`（默认 EXAMPLE 夹具，**未** `--write-fixtures`） | OK；打印 EXAMPLE 公钥 + 样例 signed token |
| 生产钥 | **未**在 box 生成；Jeremy 在 Windows 机密目录自行生成 |

可复现（EXAMPLE /tmp，用完即删）：

```bash
mkdir -p /tmp/ed25519-example-drill && cd /tmp/ed25519-example-drill
openssl genpkey -algorithm Ed25519 -out EXAMPLE_drill_private.pem
openssl pkey -in EXAMPLE_drill_private.pem -pubout -out EXAMPLE_drill_public.pem
# …确认后：
rm -f EXAMPLE_drill_private.pem EXAMPLE_drill_public.pem
cd /workspace/resume-autofill && node scripts/dev-sign-example-entitlement.mjs
```

---

---

## PC 生产钥干跑记录（2026-10-18 · Asia/Shanghai）

| 项 | 结果 |
| --- | --- |
| 钥目录 | `%USERPROFILE%\secrets\resume-paid-ed25519\`（非 Desktop、非仓库） |
| 公钥文件 SHA256 | `0B77516A4D70D03FC5A4533A5C0118C61992B21D5C760D3163D549E8903C56EE`（与约定一致） |
| 命令 | `node scripts/issue-entitlement.mjs` + 假 `installId` + `--days 1` + `lic-DEMO-DRYRUN-NOT-FOR-CUSTOMER` |
| 结果 | **PASS**：产出已签名 JSON；公钥验签通过；**未**写入真实客户记录 |
| 私钥 | **未**打印、**未**复制进聊天 |

真实客户签发仍按 `OPS_MANUAL_MANUAL_PAY.md`；演示码勿外发。

---

## 与清单勾选

完成后在 `LICENSE_JEREMY_CHECKLIST.md` 勾：

- [ ] 生产 Ed25519：公钥 PEM 可给构建  
- [ ] 私钥仅本机保管（确认未入库）

相关：`PAYMENT_ISSUANCE_DRAFT.md` · `LICENSE_STATUS.md` · `src/license/README.md` · `tests/fixtures/license/README.md`。
