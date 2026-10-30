# 通用手动清单与本地错误报告

基线：`cursor/expand-night-ats-f861`，`1adc85359a38240b29dab55ae5a4dc495fac9b6d`。

识别结果中的未知、待处理项，以及失败、跳过、未支持项进入「手动清单」。填写后所有未验证项也进入清单；按原始字段序号区分重名题目。这里只汇总现有结果，不推断字段 ID，不改站点适配器或选择器。`liveSupportClaimed=false`，Never-Save。

「导出本地错误报告」通过本地 Blob 和浏览器下载生成 JSON 文件。报告只含版本、阶段、固定结果类别、字段总数、手动项序号及受限诊断码；没有题目原文、字段 ID、答案、页面 URL、资料、DOM、异常正文。没有网络发送、上传或遥测。浏览器取消下载时不会生成文件，可检查下载列表后重试。

清单不写入持久存储；开始新操作、切换客户资料后清空，页面切换会拒绝导出旧报告。重新识别会替换清单。操作异常时生成固定 `operation_failed` 报告，不沿用旧字段，也不声称已完成读回。

改动文件：

- `src/popup/recent-result.js`：纯函数聚合及报告投影，保留原有历史收据格式。
- `src/popup/popup.js`、`popup.html`：清单、失效处理和本地下载按钮，复用现有样式。
- `tests/product-aftercare.test.mjs`：聚合、脱敏、渲染、下载与失效回归。
- `tests/e2e/product-aftercare-local-download.mjs`：真实 Chromium 加载构建后的 popup，仅用离线 zoo fixture，确认文件落盘。

在仓库根目录复现（缺依赖时先执行 `npm ci --ignore-scripts --no-audit --no-fund`）：

```powershell
node --test tests/product-aftercare.test.mjs tests/engine-manual-controls.test.mjs "tests/l1-*.test.mjs" tests/product-paths-whitelist.test.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-internal.ps1
npm run test:zoo
node tests/e2e/product-aftercare-local-download.mjs
```

本轮结果：160 项 Node 测试、69 项 zoo 测试全部通过；内部构建仍为 148 文件。下载验证生成 `test-results/aftercare-download/resume-quick-fill-error-report.json`、截图及本地 `verification.json`，验证导出请求为 0、非 GET 请求为 0、业务保存/提交点击为 0。全部使用合成资料；没有真实站点支持声明。
