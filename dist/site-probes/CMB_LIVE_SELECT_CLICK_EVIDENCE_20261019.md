# 招行 live Select 点击证据（2026-10-19）

Never Save。未宣称招行已支持。一次一字段。试填 Edge CDP **9237**。停在 `https://career.cmbchina.com/center/resume`。

实测 **10/10**。Codex 矩阵草稿 E 已过时，以本表为准。见 [`CODEX_TRIM_CMB_LIVE_MATRIX_E_20261019.md`](CODEX_TRIM_CMB_LIVE_MATRIX_E_20261019.md)。

Cloud 检出仍看不到主脑 box 的原始 JSON 字节。同名文件因此仍是交接 stub（`source=trial-edge-9237-20261019`，`stub: true`）。本表只列交接已确认的字段和 select id，不编造选项全文、点击坐标或读回。主脑再贴真实 JSON 时，用原文覆盖同名文件。

## 10/10 实采表

| 字段 | 证据 | select id |
| --- | --- | --- |
| 婚姻状况 | `dist/auto-runs/cmb-live-select-marital-latest.json` | `resume_basicInfo_maritalStatus` |
| 政治面貌 | `dist/auto-runs/cmb-live-select-politics-latest.json` | `resume_basicInfo_politicalAffinity` |
| 民族 | `dist/auto-runs/cmb-live-select-ethnicity-latest.json` | `resume_basicInfo_nation`（live 有 `ant-select-show-search`） |
| 证件类型 | `dist/auto-runs/cmb-live-select-idCardType-latest.json` | `resume_basicInfo_idCardType` |
| 学历 | `dist/auto-runs/cmb-live-select-educationLevel-latest.json` | `resume_educationHistoryList_0_educationLevelCode` |
| 招聘信息来源 | `dist/auto-runs/cmb-live-select-channelType-latest.json` | `resume_basicInfo_channelType` |
| 面试期望城市 | `dist/auto-runs/cmb-live-select-interviewCity-latest.json` | `resume_basicInfo_expectedInterviewCity` |
| 获奖级别 | `dist/auto-runs/cmb-live-select-awardLevel-latest.json` | `resume_awardList_0_awardLevel` |
| 关系类型 | `dist/auto-runs/cmb-live-select-relationship-latest.json` | `resume_familyList_0_relationship`；row1 `resume_familyList_1_relationship` |
| 最高英语水平 | `dist/auto-runs/cmb-live-select-englishLevel-latest.json` | `resume_skill_0_englishLevel` |

学历 live 选项含「博士后」（ED000）。离线 fixture 仍是窄集，不是 live 全集。

检查：`node _temp-scripts/live-cmb-select-click.mjs --check`。该脚本不点保存。原始点击脚本正文仍不在这次检出里。

RankingMajor 仍是 `DOM_CONTROL_MISSING`。不做。
