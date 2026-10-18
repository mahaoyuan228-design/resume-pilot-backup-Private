# DNS_HOSTING_PLAN — jianlikuaitian.com → 静态站 / HTTPS

日期：2026-10-18（Asia/Shanghai）  
原则：**不代下单付费产品**；下列为控制台点击清单。验收 **85%** 不因本文抬升。

---

## 已观察到的现状（Edge CDP :9237，只读）

| 项 | 观察 |
| --- | --- |
| 域名控制台 | 已登录阿里云；域名列表含 **jianlikuaitian.com** |
| 注册/到期 | 注册约 2026-10-18 09:19；到期约 2027-10-18 09:19（控制台显示） |
| DNS | `dns15.hichina.com` / `dns16.hichina.com`（万网默认） |
| OSS | 可打开控制台；**账户尚未开通 OSS**（bucket 页提示先开通，默认**按量后付费**）；**未代开通、未建 Bucket** |
| CDN / 证书 | 当时无 CDN/CAS 页签打开 |
| 微信/支付宝商户页 | 浏览器里有进件相关页，但本阶段销售路径**不依赖**商户号 |

结论：域名与实名侧已可用；**静态托管与 HTTPS 证书尚未部署**。创建 OSS Bucket / CDN / 付费证书可能产生费用 → **需 Jeremy 确认后再点开通**。

---

## 推荐路径：OSS 静态网站 + 自定义域名 + HTTPS

适合落地页 `site/index.html`（体积小）。按量计费通常很低，但仍以控制台实时标价为准。

### A. 创建 Bucket（Jeremy 确认费用后）

1. 打开 [OSS 控制台](https://oss.console.aliyun.com/bucket) → **创建 Bucket**  
2. 名称全局唯一（例：`jianlikuaitian-site` — 可自定）  
3. 地域：选离你近的（如华东）  
4. 读写权限：先 **私有**，再用「静态网站 + 自定义域名」或「公共读」按阿里云当前向导（静态托管常需公共读或签名；以向导为准）  
5. 版本控制/加密：按默认即可  
6. **不要**在未确认计费时开「无影/其它捆绑」

### B. 上传站点

1. Bucket → 文件管理 → 上传 `index.html`（来源：仓库 `site/index.html`，填好收款空白后再传）  
2. （可选）自定义 404.html  

### C. 静态网站托管

1. Bucket → 基础设置 / 传输管理 → **静态页面**（文案以控制台为准）  
2. 默认首页：`index.html`  
3. 记下 Bucket 网站 Endpoint（形如 `https://<bucket>.<region>.oss-website.aliyuncs.com`）— **该 HTTP/HTTPS 端点可先自测，再绑域名**

### D. DNS 解析（域名解析控制台）

1. 阿里云 → 域名 → **jianlikuaitian.com** → 解析设置  
2. 新增记录（示例，以 OSS 控制台「绑定自定义域名」提示为准）：

| 主机记录 | 类型 | 记录值 |
| --- | --- | --- |
| `@` 或 `www` | CNAME | OSS/CDN 提供的目标域名 |

3. 若只用 OSS 网站域名作 CNAME，按绑定向导复制精确值（勿手编造）  
4. TTL 默认 10 分钟即可  

### E. HTTPS

可选两条（均需你确认是否免费额度/是否扣费）：

1. **OSS 绑定自定义域名 + 证书**  
   - 数字证书管理（CAS）申请免费 DV 证书（若账户仍提供「免费证书」名额）或上传已有证书  
   - 在 OSS 域名管理里开启 HTTPS  
2. **CDN 加速域名**  
   - 开通 CDN → 添加加速域名 → 源站指向 OSS → 配置 HTTPS  
   - CDN 有流量费；小站通常很低，但**不是零配置零费用保证**

**未完成 HTTPS 前：** 对外可先用「私信成交 + 粘贴激活」；**不要**把未就绪的 `https://jianlikuaitian.com` 写进客户付费包当已 live 校验域，除非你已能打开该 URL 举证。

### F. （可选）license 子域

日后 `/v1/verify`：`license.jianlikuaitian.com` → 你的服务（ECS/FC/其它）。  
本阶段人工发码**不阻塞**于子域。

---

## 仅 DNS 检查清单（不创建付费资源也可做）

- [ ] 域名列表可见 jianlikuaitian.com（已见）  
- [ ] 实名状态正常（你已说明已实名）  
- [ ] 解析进「解析设置」页面，确认可添加记录  
- [ ] 决定 `@` 与 `www` 是否都要  
- [ ] **停在这里**直到你同意创建 OSS/CDN/证书  

---

## 代理停止线

- 已写好 `site/index.html` 与本计划  
- **未**代创建 Bucket、未买 CDN、未申请证书、未改 DNS 记录  
- 下一步需你：确认是否开通 OSS 静态托管（及是否接受按量）→ 填收款信息 → 上传 → 按向导绑域名/HTTPS  

相关：`OPS_MANUAL_MANUAL_PAY.md` · `site/index.html` · `PAYMENT_ISSUANCE_DRAFT.md`


## 2026-10-18 CDP 补充（OSS）

在已登录阿里云的 Edge（CDP `:9237`）打开 `https://oss.console.aliyun.com/bucket`：

- 页面提示：**尚未开通对象存储 OSS**，需先开通。
- 开通说明大意：默认**按量付费（后付费）**；也可对部分计费项购买资源包预付费。
- 另有「OSS Agent」等产品说明（与本落地页无关）。
- **代理未点击开通、未创建 Bucket、未修改 DNS。**

因此「免费 OSS」不能默认成立：即使流量很小，开通即进入按量计费体系；是否接受由 Jeremy 决定。


## 2026-10-18 执行进度（代理自动）

时间：2026-10-18 约 16:00 Asia/Shanghai

### 已完成
- **OSS 按量开通成功**（收银台 ¥0.00 支付完成页）
  - 订单：`2006208834540425`（对象存储OSS / 按量付费）、`2006208834550425`（深度冷归档容量 / 按量付费，¥0）
- **Bucket 已创建**
  - 名称：`jianlikuaitian-site`
  - 地域：华东1（杭州）`oss-cn-hangzhou`
  - Endpoint：`oss-cn-hangzhou.aliyuncs.com`
  - 冗余：本地冗余存储；ACL：私有；阻止公共访问：开启
  - 资源组：default resource group

### 未完成 / 需继续
- 上传 `site/index.html`（控制台被产品菜单遮挡 + CDP 文件选择器未稳定打通）
- 关闭「阻止公共访问」→ 设置公共读（或仅静态网站匿名读策略）
- 开启静态网站托管（默认首页 `index.html`）
- 绑定自定义域名 `jianlikuaitian.com` / `www` + 万网 DNS CNAME
- HTTPS / 免费 DV：大陆 Bucket 绑自有域名通常需 **ICP 备案**；域名刚注册，预计未备案 → 先用 OSS 网站 Endpoint HTTP 自测

### 预期网站 Endpoint（开通静态托管后）
- `http://jianlikuaitian-site.oss-website-cn-hangzhou.aliyuncs.com/`

### helpNeeded（Jeremy）
1. 若控制台卡住：手动打开 Bucket → 文件列表 → 上传 Desktop/`ResumeQuickFill-Dev/site/index.html`
2. 权限：关闭阻止公共访问 → 读写权限改为公共读（或按向导）
3. Bucket 配置 / 传输管理 → 静态页面 → 默认首页 index.html
4. 域名管理 → 绑定 `jianlikuaitian.com`（及 www）→ 按提示到云解析加 CNAME
5. 备案：若绑域名 HTTPS 提示未备案，先走备案或临时用 OSS Endpoint
6. 账户可用额度曾显示 ¥0.00：建议充值少量余额以免按量流量欠费影响访问
7. **不要**动微信商户；**不要**买 ECS/CDN（除非免费证书路径明确需要且费用极低）

## 2026-10-18 16:45 (Asia/Shanghai) 状态更新
- [x] index.html 已上传至 oss://jianlikuaitian-site/（4.9KB，CDP setFileInputFiles，无系统文件框）
- [x] 阻止公共访问：已关闭（Bucket 级）
- [x] Bucket ACL：公共读
- [~] 静态页面：已提交默认首页 index.html（保存已点，待复核截图）
- [ ] 绑定自定义域名 jianlikuaitian.com / www：未做
- [ ] 云解析 CNAME：未添加
- [ ] HTTPS：未做；中国内地 Bucket 绑自有域名需 ICP 备案，预计被拦
- 注：OSS 默认域名访问 HTML 会强制下载（Content-Disposition: attachment），浏览器正常浏览需自定义域名

## 2026-10-18 ~16:55 (Asia/Shanghai) OSS hosting continue
- [x] 静态页面默认首页：已确认为 index.html（截图 oss-static-final.png）；子目录首页已开通；404 页目前也是 index.html
- [ ] 自定义域名绑定：打开了 configuration/domain，点了绑定域名抽屉，填入 jianlikuaitian.com；输入框出现红色校验边框；抽屉内未找到可点的提交/确认按钮文案；域名表仍「暂无数据」。未拿到控制台展示的 CNAME 目标值（故未改云解析）。疑似 ICP 备案拦截或抽屉 UI 未完整露出底部按钮，需人工看抽屉红框旁提示。
- [ ] 云解析 CNAME：未添加（因未拿到 OSS 页展示的记录值）
- [ ] HTTPS：未做；内地 Bucket 绑自有域名需 ICP 备案后才能上证书
- 直链：静态页 data-management/static ；域名 configuration/domain
- 校验：见本次 curl/DNS 输出
