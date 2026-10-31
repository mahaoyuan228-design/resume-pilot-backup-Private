# 内部窄版发布说明 — v0.1.4.9

日期：2026-10-17（Asia/Shanghai）  
对象：内部试用；**非**对外商店发布。

安装说明于2026-10-25更新：请先读 [内部包安装与本地资料核对](INSTALL_INTERNAL.md)。当前已核459批次为完整133文件内部包，身份按交付manifest的来源提交、精确文件清单与hash核对；版本号 `0.1.4.9` 不足以识别它。当前本批次未安装、未真用，软件/文档验收不等于网站验收，不新增CMS/GTH支持宣称，`liveSupportClaimed=false`。本地资料确认保存与招聘网站保存严格区分；受控试验仍Never-Save、不覆盖不同值、原生取消及恢复核对，技术门未满足不执行。

下面的85%、功能/许可状态与live记录均为2026-10-17历史说明，不作当前商业分数或459批次真用结论。

## 一句话

CMS + GTH 窄站内部包可装、付费闸门可冒烟；验收约 **85%**。Auto 路径 **永不 Save**；GTH 实站 Save 仍政策暂缓。

## 本版状态（85%）

| 项 | 状态 |
| --- | --- |
| CMS 教育两端 live 闭环 | 已举证（学校 fail-soft，不 invent） |
| CMS 实习 fill 序列化 | 已举证 |
| GTH 教育 / 基本信息 fill-wo-save | 已举证；多段 edu-scope 硬化 |
| GTH basic/simple/other/**intent** auto readiness | 脚手架齐；intent 走产品 `GTH_INTENT_TEST`；Save 干跑中文澄清 ready≠会点保存 |
| 付费包 fail-closed 冒烟 | 离线 PASS；生产 HTTPS/支付 **未**接 |
| GTH Save | **永不**从 auto；实站仅 Jeremy one-shot |

本版增量（睡眠中 agent）：`GTH_INTENT_AUTO` 脚手架 + **live readiness PASS 21:37**（intentSource 1/5 → fill 跳过，无 invent）+ Save dry-run 中文 UI；验收仍 **85%**。

## 明确不做

- 不 invent HTTPS / 支付域名 / 选项映射  
- 不扩大站点、不自动投递  
- 不把 `src/license/` 打进内部试用包；003753仅为历史目录

## 安装

见 [INSTALL_INTERNAL.md](INSTALL_INTERNAL.md)：加载交付清单对应的完整 `internal-extension` 或内部ZIP解压后直接含 `manifest.json` 的目录。开发构建则用本次完整 `dist/edge-internal-v0.1.4.9-…/extension`。003753/011002和不完整旧开发镜像不是本批次入口，不推荐增量复制几个文件到旧包后重载。后续不同批次按各自清单核验，不固定永久文件数。

## 请 Jeremy 醒后决定的事

生产 license HTTPS、签发钥、可选 GTH 登录多段 Save 核对。Ask Jeremy？**仅当上述决策需要时**。
