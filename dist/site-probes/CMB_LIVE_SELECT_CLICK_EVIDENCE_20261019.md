# 招行 live Select 点击证据（2026-10-19）

Never Save。未宣称招行已支持。一次一字段。试填 Edge CDP **9237**。停在 `https://career.cmbchina.com/center/resume`。

Cloud 检出里没有试填 Edge 的原始 JSON。下面 10 份是按交接要点重建的 stub，`source` 为 `trial-edge-9237-20261019`。stub 只记录已知要点：字段、select id、点击已证明、Never Save、`formFillClaimed: false`。不编造选项全文、点击坐标或读回值。主脑若再贴真实 JSON，用原文覆盖同名文件。

## 10/10

| 字段 | 证据 | select id |
| --- | --- | --- |
| 婚姻状况 | `dist/auto-runs/cmb-live-select-marital-latest.json` | `resume_basicInfo_maritalStatus` |
| 政治面貌 | `dist/auto-runs/cmb-live-select-politics-latest.json` | `resume_basicInfo_politicalAffinity` |
| 民族 | `dist/auto-runs/cmb-live-select-ethnicity-latest.json` | `resume_basicInfo_nation`（live 有 `ant-select-show-search`，`showSearch: true`） |
| 证件类型 | `dist/auto-runs/cmb-live-select-idCardType-latest.json` | `resume_basicInfo_idCardType` |
| 学历 | `dist/auto-runs/cmb-live-select-educationLevel-latest.json` | `resume_educationHistoryList_0_educationLevelCode` |
| 招聘信息来源 | `dist/auto-runs/cmb-live-select-channelType-latest.json` | `resume_basicInfo_channelType` |
| 面试期望城市 | `dist/auto-runs/cmb-live-select-interviewCity-latest.json` | `resume_basicInfo_expectedInterviewCity` |
| 获奖级别 | `dist/auto-runs/cmb-live-select-awardLevel-latest.json` | `resume_awardList_0_awardLevel` |
| 关系类型 | `dist/auto-runs/cmb-live-select-relationship-latest.json` | `resume_familyList_0_relationship`；row1 `resume_familyList_1_relationship` |
| 最高英语水平 | `dist/auto-runs/cmb-live-select-englishLevel-latest.json` | `resume_skill_0_englishLevel` |

学历 live 选项含「博士后」（ED000）。字典对齐保留该项。离线 fixture 仍是窄集，不是 live 全集。

证据文件在时，`node scripts/auto-cmb-basic.mjs --only <页面标签> --live` 不再因 `live_*_select_fill_unclaimed` 退出。它在已打开的 `/center/resume` 页上做 CDP inject fill-wo-save，不点保存。本环境没有试填 Edge 时，退出原因为 `live_cdp_unavailable`，`formFillClaimed` 仍为 false。

检查：`node _temp-scripts/live-cmb-select-click.mjs --check`。该脚本不点保存。原始点击脚本正文不在这次检出里。

RankingMajor 仍是 `DOM_CONTROL_MISSING`。不做。
