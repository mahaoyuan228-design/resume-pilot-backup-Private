# 简历快填 0.1.4.9 开发源码

本包包含 WHITELIST 产品白名单 84 个可编辑产品源/vendor文件、严格构建脚本及明确列举的精选虚构回归闭包。没有客户资料、真实网站驱动、TEMP私存、密钥或日志。SOURCE_INVENTORY.json逐项记录SHA（frozen-product = 当前 84）。旧147 controller与146 reader仅作为公开行为反例，不用于产品。

## 构建

需要Windows、Microsoft Edge、Node.js24、PowerShell/.NET；无需npm下载。在解压根执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-internal.ps1
```

输出新的dist目录，不覆盖旧版本；当前内部产品白名单恰好84文件（见 WHITELIST productPaths / build-internal.ps1）。不同PowerShell/.NET压缩容器的ZIP SHA可能不同，应比较全部产品源字节。修改产品源或白名单后重新生成清单：

```powershell
node scripts/regen-source-inventory.mjs
```

`sumsSha256` = 对 84 个 frozen-product 按路径排序的 `sha256  path` 行（末尾换行）再 SHA-256。

## 149必要回归

```powershell
node --test tests/cms-known-partial.test.mjs tests/cms-known-partial-internship.test.mjs
node tests/cms-text-blur-commit.test.mjs
node tests/cms-school-cleanup.test.mjs
node tests/e2e/cms-cross-world-keycode-edge.mjs
```

前两套验证教育/实习真实worker合同：仅已settled且完整DOM/MAIN读回可证明的已知不完整结果为partial，保留失败详情并安全释放本任务；真正未知、换客、文档改变等仍保锁。blur测试匹配公开文本控件的父数据提交机制。跨world测试启动独立临时Edge随机端口，用about:blank的MAIN监听器观察ISOLATED事件，重现旧getter键码0并核对新三个构造器27；不访问招聘服务器或原Edge。测试报告仅为工程证据。

精选历史测试供修改相应代码时使用，未要求每次重跑：reader等价引用、结构化导入、资料映射、备份、国泰刷新以及CMS三个普通入口组合。组合测试仍使用明确虚构夹具，运行时显式给新构建extension和新输出目录；不代表招聘服务器保存。

## 产品边界

客户从空资料库导入自己的PDF/DOCX/TXT，候选选择后补齐并逐项确认，不会自动确认。先准备全部本地事实、完整实习日期和照片/附件，最后确认每段教育的本站补充；修改本人资料会使旧补充失效。招商证券通用填写、明确来源的教育、明确来源的实习仍为三个入口，不能称一次总按钮。国泰连续批量只覆盖教育。不同客户须使用自己的资料与来源绑定。

149修复CMS三个Escape构造器的跨world原生键码、教育/实习文本真实blur提交、已知partial与未知状态的区别；不结算旧unknown，不扩大站点、AI、全站、OCR或支付范围。实际真实网站完整填写、保存刷新、普通客户独立安装和商业防转售尚未验收；内部包可复制。最终岗位申请不会自动提交。

当前84产品文件SUMS：3a1803f6bc771479faa7d470b2b510e8790dc4d0178f7aa8e0c74904b7a9503b（见 SOURCE_INVENTORY.json）。
