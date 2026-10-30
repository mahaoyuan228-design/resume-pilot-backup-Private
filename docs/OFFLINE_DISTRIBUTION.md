# 私下收费：离线包与本地授权

本入口从当前源码构建完整试用/付费包；安装、授权和手工更新均不依赖域名或授权服务器。`liveSupportClaimed=false`，本地打包与验签不增加实站支持宣称。

## 本地构建

在仓库根目录用 Windows PowerShell 5.1 和 Node 执行。试用包沿用现有内部构建（授权闸关闭；不提供限时试用策略）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-internal.ps1
```

付费包先在仓库外生成并保管运营者 Ed25519 密钥对，生成方法见 [ED25519_LOCAL_DRILL.md](../ED25519_LOCAL_DRILL.md) 的“生成密钥对”。之后仅把公钥交给打包脚本：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-paid.ps1 `
  -Offline `
  -PublicKeyPemPath "$env:USERPROFILE\secrets\resume-paid-ed25519\resume-paid-public.pem"
```

`-Offline` 强制签名授权并拒绝 `-LicenseServiceUrl`。生成配置为 `buildFlavor:'paid'`、`verificationMode:'offline'`、`licenseServiceUrl:null`、`requireSignedEntitlement:true`；只内嵌公钥。旧的显式 HTTPS 构建入口保留，离线交付使用上面的命令。

每次构建创建新目录，不覆盖旧包：

```text
dist/edge-internal-v<version>-<UTC>/     # 试用
dist/edge-paid-v<version>-<UTC>/         # 付费
  extension/manifest.json               # 加载此 extension 目录
  extension/src/...
  resume-autofill-edge[-paid]-v<version>.zip
  SHA256SUMS.txt                        # extension 文件与 ZIP 的 SHA256
```

ZIP 根层直接含 `manifest.json`；只打包现有产品白名单及付费授权模块。测试、签发脚本、私钥不入包。交付 ZIP 和对应 `SHA256SUMS.txt`，收件方核对 ZIP 哈希后解压，从 Edge 扩展管理页加载含 `manifest.json` 的目录。

## 私下收款与激活

1. 客户安装付费包，从弹窗“授权激活”复制本机 `installId`，私下交给运营者。
2. 运营者线下确认付款，在本机使用仓库外的私钥签发有到期时间的授权码：

```powershell
node scripts/issue-entitlement.mjs `
  --private-key "$env:USERPROFILE\secrets\resume-paid-ed25519\resume-paid-private.pem" `
  --install-id '<客户激活页显示的 UUID>' `
  --days 365 --license-id 'lic-offline-001' --base64-only
```

3. 客户在激活页粘贴完整 JSON 或 Base64 授权码。本地验证签名、状态、有效期和设备绑定，成功后开通现有填写开关；每次填写前重新验签。无码、过期、伪造或设备不匹配均拒绝。当前权益只有绑定此 `installId`、在有效期内的付费填写许可，尚无套餐或单功能细分。
4. 续期使用同一运营者签名钥重新签发并粘贴。此骨架不含支付回调或在线撤销；纯离线授权的到期判断依赖本机时间，本地代码可被用户修改，不宣称完整 DRM。

## 手工更新约定

发布方从已核提交重新构建，私下交付完整新 ZIP 和哈希；客户核验后通过扩展管理页手工加载完整新目录，旧目录留档，不向旧包增量复制文件。更新前按现有资料导出流程备份；不要清空旧实例存储。若扩展身份或 `installId` 改变，应由运营者重新签发。没有域名更新源或自动下载器。

## 公开网站接口位

生成的 `paidConfig.publicWebsite = null` 是预留 stub。未来可在此提供公开下载/购买说明入口；当前没有 URL、HTTP 调用、支付接口或真实站点绑定。该字段不参与本地授权判断，离线流程不依赖它。
