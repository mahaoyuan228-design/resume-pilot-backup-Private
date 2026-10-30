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

ZIP 根层直接含 `manifest.json`；只打包现有产品白名单及付费授权模块。测试、签发脚本、私钥不入包。

## 私下交付与本地安装

付费包交付目录约定如下；发布方把本仓库的安装脚本和本文复制到本次构建目录外层，与现有 ZIP、校验文件一起交付。安装脚本不进入扩展白名单，不改变内部包。客户只需 Windows PowerShell 5.1/.NET，不需源码、Node、域名或在线下载器。

```text
delivery-v<version>/
  resume-autofill-edge-paid-v<version>.zip
  SHA256SUMS.txt
  install-offline.ps1                   # scripts/install-offline.ps1
  OFFLINE_DISTRIBUTION.md               # 本文
  PRODUCT_AFTERCARE.md                  # docs/PRODUCT_AFTERCARE.md
```

ZIP、校验文件和脚本均通过可信私下渠道交付；SHA256 校验用于发现损坏或文件错配，不代替发布者身份认证。客户在交付目录执行（版本文件名按实际替换）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-offline.ps1 `
  -ZipPath .\resume-autofill-edge-paid-v0.1.4.9.zip `
  -ChecksumPath .\SHA256SUMS.txt `
  -InstallRoot "$env:LOCALAPPDATA\ResumeQuickFillOffline"
```

脚本只接受本地磁盘路径，核验 ZIP 哈希后解包到独立 `stage-*`，拒绝路径穿越、重复条目、远端 `update_url` 及非离线付费配置，再安装到固定的 `<InstallRoot>\extension`。首次在 `edge://extensions` 开启开发人员模式，选择“加载解压缩的扩展”，加载此固定 `extension` 目录。首次安装流程止于扩展管理页和授权页，不打开招聘页面。

## 私下收款与激活

1. 客户安装付费包，从弹窗“授权激活”复制本机 `installId`，私下交给运营者。
2. 运营者线下确认付款，在本机使用仓库外的私钥逐席位签发有到期时间的激活码；`licenseId` 是运营者分配的唯一席位号，一号绑定一个客户 `installId`：

```powershell
node scripts/issue-entitlement.mjs `
  --private-key "$env:USERPROFILE\secrets\resume-paid-ed25519\resume-paid-private.pem" `
  --install-id '<客户激活页显示的 UUID>' `
  --days 365 --license-id 'seat-offline-001' --code-only
```

3. 输出为单行 `RQF1.<Base64URL>`，其中是 UTF-8 编码的原 Ed25519 签名 envelope。客户在现有激活页粘贴完整码，`activateLocalToken()` 本地验证格式、签名、状态、有效期和设备绑定，再保存原 entitlement；状态与每次填写前继续重新验签。新码必须有席位号、设备绑定和明确到期时间，无码、过期、伪造、错公钥或设备不匹配均拒绝；无效替换码不会覆盖已有 entitlement。旧 JSON / Base64 令牌及 `--json-only` / `--base64-only` 签发输出仍兼容。当前权益只有绑定此 `installId`、在有效期内的付费填写许可，尚无套餐或单功能细分。
4. 续期使用同一运营者签名钥重新签发并粘贴。此骨架不含支付回调或在线撤销；纯离线授权的到期判断依赖本机时间，本地代码可被用户修改，不宣称完整 DRM。

席位号唯一性由运营者的仓库外台账管理，签发脚本不建立订单库，也不联网查重；同一席位续期或换机需人工核对后重签。离线码无法远程回收旧机器上的有效码，不提供“一次兑换后全网失效”的承诺。脚本拒绝仓库内 / EXAMPLE 私钥、非 Ed25519 私钥、空席位号和已经过期的签发期限。私钥、收款信息与真实客户激活码均不入仓库。

## 手工更新约定

发布方从已核提交使用同一签发公钥重新构建，按上述目录私下交付完整新包。客户先按现有资料导出流程备份，记下激活页的 `installId`，关闭填写页面，在扩展管理页暂时停用原实例；不要卸载或清空浏览器存储。在新交付目录执行相同命令并加 `-Update`：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install-offline.ps1 `
  -ZipPath .\resume-autofill-edge-paid-v0.1.4.9.zip `
  -ChecksumPath .\SHA256SUMS.txt `
  -InstallRoot "$env:LOCALAPPDATA\ResumeQuickFillOffline" -Update
```

更新要求已存在离线安装，拒绝签发公钥或 `manifest.key` 变化；旧树整体移到 `<InstallRoot>\backup-*`，新树移到原 `extension` 路径，移入失败时恢复旧树。没有增量覆盖或域名更新源。校验/解包/身份检查失败不替换原扩展；失败的 `stage-*` 保留供本地排查，不自动删除目录。

随后在**同一浏览器资料、同一扩展实例**点击“重新加载”并启用，核对版本、原 `installId`、授权有效期和资料；本流程不执行填写、保存或提交。固定加载路径与同一身份用于保留浏览器现有存储；安装脚本不读取或搬迁浏览器资料。若换了浏览器资料、加载路径或扩展身份，`installId` 可能变化，需由运营者重签，不能复制别人的授权。回退时使用留存的可信旧 ZIP 和匹配哈希执行同一 `-Update` 流程并 Reload。

激活仍由现有 `activate.js` → `activateLocalToken()` → entitlement 本机验签处理，更新不重签、不迁移授权结构。售后沿用[本地错误报告](PRODUCT_AFTERCARE.md)，无上传接口。

## 本地复现验证

开发者在仓库根目录执行（Node 24、Windows PowerShell 5.1；缺依赖时先执行 `npm ci --ignore-scripts --no-audit --no-fund`，安装脚本本身无需 Node）：

```powershell
npm run test:windows-smoke
node --test tests/license-activation-code.test.mjs
node --test tests/product-aftercare.test.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-internal.ps1
```

其中 `tests/install-offline.test.mjs` 用临时目录和合成 ZIP 验证安装、原路径更新、备份、旧文件清除及拒绝分支；`tests/build-offline-package.test.mjs` 使用临时公钥实际构建离线包；`tests/license-activation-code.test.mjs` 用仓库外临时密钥复现 CLI 签发、激活、状态与填写前校验，并覆盖错设备、错公钥、篡改、过期、格式错误及旧输出兼容，网络调用为 0。以上均不访问招聘网站，不验证真实业务保存或公开实站支持。

## 公开网站接口位

生成的 `paidConfig.publicWebsite = null` 是预留 stub。域名、备案、收款仅留此接口说明，本轮不实现。该字段不参与本地授权判断，离线流程不依赖它。公开宣称保持不变，`liveSupportClaimed=false`，Never-Save。
