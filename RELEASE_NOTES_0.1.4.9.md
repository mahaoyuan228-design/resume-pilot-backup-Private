# 内部窄版发布说明 — v0.1.4.9

日期：2026-10-17（Asia/Shanghai）  
对象：Jeremy / 内部试用；**非**对外商店发布。

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
- 不把 `src/license/` 打进内部 003753 试用树  

## 安装

见 `INSTALL_INTERNAL.md`：加载 `edge-internal-v0.1.4.9-…/extension`（日常 **003753** / 孪生 **011002**），改码后「重新加载」。

## 请 Jeremy 醒后决定的事

生产 license HTTPS、签发钥、可选 GTH 登录多段 Save 核对。Ask Jeremy？**仅当上述决策需要时**。
