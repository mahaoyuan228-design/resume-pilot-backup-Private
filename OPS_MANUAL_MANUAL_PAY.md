# OPS_MANUAL_MANUAL_PAY — 一单销售操作手册（个人转账 + 人工发码）

日期：2026-10-18（Asia/Shanghai）  
产品：简历快填 / ResumeQuickFill  
域名：jianlikuaitian.com（**自定义域名绑定 / ICP 备案进行中，尚未 live HTTPS**）  
验收：保持 **85%**（无 live HTTPS 前不抬）

---

## 你现在能卖吗？（一句话）

**能。** 通过私信收款 → 本机运行发码脚本 → 把授权码粘贴给客户 → 客户在扩展里激活并本机绑定。  
**不需要** `jianlikuaitian.com` 已经打开；网站只是以后的展示入口。  
**不要**把阿里云 OSS 的长链接当作「官网」对外宣传（可作临时下载兜底，见文末）。

---

## 适用范围

| 做 | 不做（本阶段） |
| --- | --- |
| 个人银行 / 支付宝个人 / 微信个人收款 | 微信商户、支付宝商户、自动 webhook |
| 你确认到账后离线签发 entitlement | 编造价格、收款账号、商户号、真实客户码 |
| 客户粘贴激活 + 本机 installId 绑定 | 把私钥 / 真实卡号写进 git 或公开页 |

---

## 售前准备（只做一次）

用勾选确认：

1. [ ] 生产钥在本机：`C:\Users\admin\secrets\resume-paid-ed25519\`  
   - `resume-paid-private.pem`（**只你能碰，永不发给客户、永不贴聊天**）  
   - `resume-paid-public.pem`（给打包付费扩展用）  
   - 公钥文件 SHA256 应为：`22A12E7C131B53FC13B50194CAB3E3A56AE9E0E3655010E5AE7DDFF45F450996`（DER of SPKI；与 20261018-090245 嵌入钥一致）
2. [ ] 发码脚本在仓库：`scripts\issue-entitlement.mjs`  
   工作目录示例：`Desktop\ResumeQuickFill-Dev\resume-autofill-dev`
3. [x] **客户付费包（生产公钥）已打好：** `dist\edge-paid-v0.1.4.9-20261018-090245\extension`  
   - **客户 ZIP：** `dist\edge-paid-v0.1.4.9-20261018-090245.zip`（解压得同名文件夹；Edge 加载该文件夹）  
   - 安装说明：`INSTALL_PAID_CUSTOMER.md`  
   - 嵌入公钥 = 生产 `resume-paid-public.pem`；`requireSignedEntitlement=true`；URL=`https://jianlikuaitian.com`（域名未 live 亦可离线粘贴激活）  
   - **作废勿发：** `edge-paid-v0.1.4.9-20261017-115116`、`…202610171151160`（localhost / 非生产钥）  
   - 内部试用 `edge-internal-*` **不能**当付费版发给客户
4. [ ] 价格、收款方式：**只在私信/报价单**写；落地页空白处你自己填后再上传（**禁止**让代理编造）
5. [ ] 本机有一张「订单表」（Excel / 记事本均可）：成交时间、客户昵称、金额、installId、licenseId、到期日、备注。**文件放本机，不入库。**

---

## 每一单（零编程背景 · 逐步照做）

### 第 1 步：报价（私信）

跟客户说清楚：

- 这是 **Edge 付费扩展**，授权绑定**这一台电脑**。
- 请客户先安装你发的**付费包**，打开扩展 → **「授权激活」** → 把页面上的 **installId**（一串带横杠的 UUID）复制发给你。
- 约定：**价格、有效天数、是否单机**（写进你的订单表）。价格由你定，文档里不写死金额。

### 第 2 步：收款

- **私发**收款方式（银行 / 支付宝 / 微信个人）。
- 要求转账备注：短码或昵称（方便你对账）。
- **不要**在群公告长期公开完整账号；可用限时收款码。

### 第 3 步：确认到账

核对：金额、时间、备注是否对得上。  
**未到账 → 不发码。**

### 第 4 步：签发授权码（在你电脑上）

1. 打开 **PowerShell**（开始菜单搜「PowerShell」即可）。
2. 进入仓库目录（路径按你本机实际，下面是常见位置）：

```powershell
cd $env:USERPROFILE\Desktop\ResumeQuickFill-Dev\resume-autofill-dev
```

3. **整段复制**下面命令，只改三处尖括号内容，然后回车：

```powershell
node scripts\issue-entitlement.mjs `
  --private-key "$env:USERPROFILE\secrets\resume-paid-ed25519\resume-paid-private.pem" `
  --install-id "<这里粘贴客户发来的 installId>" `
  --days <天数数字，例如 365> `
  --license-id "lic-<年月日>-<序号，例如 001>"
```

**天数上限：** `--days` 只能填 **1～3650**（约十年）。再长会报错，不要用超大 `--days`。

### 168 元「永久」怎么签（正式销售用这条）

「永久」**不要**靠 `--days`。用 `--expires-at-ms` 指定远未来时刻（覆盖 `--days`）。  
推荐到期：**2099-01-01 00:00:00 UTC** → 毫秒时间戳 **`4070908800000`**（激活页上海时区显示约 `2099/1/1 08:00:00`）。

**Jeremy 正式卖 168 永久时，整段复制（只改 installId / licenseId）：**

```powershell
cd $env:USERPROFILE\Desktop\ResumeQuickFill-Dev\resume-autofill-dev

node scripts\issue-entitlement.mjs `
  --private-key "$env:USERPROFILE\secrets\resume-paid-ed25519\resume-paid-private.pem" `
  --install-id "<客户发来的 installId>" `
  --expires-at-ms 4070908800000 `
  --license-id "lic-168-PERM-<年月日>-<序号>"
```

可选：只要一行 Base64 给客户，末尾加 `--base64-only`。  
价格约定：**168 CNY 永久**（私信报价；本页只记命令，不代替收款）。支付宝个人收款可后补，当前不阻塞发码。

**示例（演示用，勿发给真实客户）：**

```powershell
node scripts\issue-entitlement.mjs `
  --private-key "$env:USERPROFILE\secrets\resume-paid-ed25519\resume-paid-private.pem" `
  --install-id "00000000-0000-4000-8000-00000000DEAD" `
  --days 1 `
  --license-id "lic-DEMO-DRYRUN-NOT-FOR-CUSTOMER"
```

4. 成功时窗口会打印：
   - `licenseId` / `installId` / 到期时间  
   - **JSON** 一段  
   - **Base64** 一行  
   把 **JSON 或 Base64 二选一**发给客户即可（推荐 Base64，一行好复制）。
5. 若出现 `REFUSED`：说明私钥路径在仓库里或像测试钥 — **立刻停**，检查是否指到 `secrets\resume-paid-ed25519\`。
6. 可选开关：只要 JSON 加 `--json-only`；只要 Base64 加 `--base64-only`。

**脚本不会**自动写入任何「客户数据库」；你自己在订单表记一行即可。演示码用假 installId + 短天数，勿当真实订单。

### 第 5 步：交付（私信模板可参考）

```text
已确认到账。请按下面激活：
1）确认安装的是「付费包」扩展（不是内部试用包）
2）打开扩展 →「授权激活」
3）粘贴下面整段授权码 → 确认

（这里粘贴 Base64 或 JSON）

注意：此码只绑定你发来的那台电脑的 installId；换机请再联系我。
```

### 第 6 步：客户激活与本机绑定

客户侧成功标志：激活页提示成功 / 扩展可正常用授权功能。  
令牌里的 `installId` 必须与客户机器一致，否则会报「与本机不匹配」——那时用**正确** UUID 重签一发即可。

### 第 7 步：留痕

- 订单表写一行。  
- **禁止**把私钥内容、完整 PEM 贴进聊天、截图发群、或提交 git。

---

## 换机 / 撤销（窄船）

| 情况 | 做法 |
| --- | --- |
| 客户换机 | 要新 installId；旧令牌作废；按你政策决定是否免费重签 |
| 退款 | 人工退款；订单表标记该 licenseId 已撤销 |
| 怀疑泄露 | 缩短默认天数；必要时轮换钥并对未过期客户重签（见 `ANTI_RESALE.md`） |

---

## 常见错误

| 现象 | 处理 |
| --- | --- |
| 激活「与本机不匹配」 | installId 签错机；用客户当前 UUID 重签 |
| 激活「已过期」 | 检查 `--days` / 到期时间 |
| 签名无效 | 付费包里的公钥与签发私钥不是一对；用生产公钥重打付费包 |
| 误用 EXAMPLE / 测试钥 | 作废该令牌；只用 `secrets\resume-paid-ed25519\` |
| `Private key file not found` | 确认文件在 `C:\Users\admin\secrets\resume-paid-ed25519\` |
| 客户用了内部试用包 | 改发付费包 ZIP，再激活 |

---

## 与网站 / OSS 的关系（避免说错话）

| 状态 | 对外怎么说 |
| --- | --- |
| `jianlikuaitian.com` 自定义域尚未绑定 / 无 ICP HTTPS | **不要**宣称官网已上线 |
| OSS 桶 `jianlikuaitian-site` 已有公开 `index.html` | 仅可作**临时文件下载兜底**；不要当官网品牌入口 |
| 销售主路径 | **私信 + 转账证明 + 粘贴激活**（本手册） |

详见 `STATUS_OSS_LICENSE.md`。

---

## 相关文件

- `STATUS_OSS_LICENSE.md` — 今天离线能卖什么 / 还等 ICP·域名什么  
- `PAYMENT_ISSUANCE_DRAFT.md` — 路径锁定说明  
- `ED25519_LOCAL_DRILL.md` — 钥与 build-paid  
- `LICENSE_JEREMY_CHECKLIST.md` — HTTPS / 支付 / 钥三件套  
- `site/index.html` — 中文落地页模板（价格/收款仍为空白占位）  
- `DNS_HOSTING_PLAN.md` — 域名 / OSS / HTTPS 点击清单  


---

## Jeremy 验收干跑（168 永久 · 无 ICP）

时间：**2026-10-18 17:44 Asia/Shanghai**  
验收口径仍 **85%**（无 live HTTPS）。

| 项 | 结果 |
| --- | --- |
| 永久签发方式 | `--expires-at-ms 4070908800000`（2099-01-01 UTC）；**不是**超大 `--days`（上限 3650） |
| 付费包 | `dist\edge-paid-v0.1.4.9-20261018-090245\extension`（生产公钥；`requireSignedEntitlement=true`） |
| Edge 加载 | 单独调试配置加载授权版（勿与仅试用包的 `--disable-extensions-except` 会话混用） |
| installId | `c4e623e5-beb2-441f-af39-9a2e6d1aea47` |
| licenseId | `lic-ACCEPT-168-PERM-20261018`（验收标签，勿当客户订单号） |
| 公钥验签 | PASS（私钥签 → 嵌入公钥验） |
| 激活 | **PASS** — 状态 `active`；可否填写 **允许填写**；到期 `2099/1/1 08:00:00（上海时区）`；提示「激活成功：授权已保存到本机。」 |
| 可用证明 | 激活页 gate = 允许填写；`chrome.storage` 已存 signed entitlement；弹窗「授权激活」入口可见。填写按钮因未开招聘编辑页而灰（站点未开，非闸门拒绝） |
| 站点试填 | **未做** — CMS/GTH 登录会话在试用包 Edge(9237)；授权版验收会话为新 profile，未要求 Jeremy 再登录 |
| 支付 | **未编造**；无商户宣称；支付宝偏好仅作后续备注 |

**客户侧要点击：** Edge → `edge://extensions/` → 开开发人员模式 → 加载解压缩的 `…\20261018-090245\extension` → 点扩展图标 → **授权激活** → 复制 installId 给你 → 你发码 → 粘贴 → **激活并保存到本机** → 看到「允许填写」。
