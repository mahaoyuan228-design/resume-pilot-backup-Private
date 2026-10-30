# 本地简历导入骨架

`src/import/parser.mjs` 的 `parseResumeProfile(file)` 接受本地 `File`，返回
`{ text, format, warnings, candidates, profile, conflicts, neverSave: true, liveSupportClaimed: false }`。
复用现有 PDF / DOCX / TXT 文字提取；扫描件不做 OCR，旧版 DOC 不支持。
文件上限 10 MB，提取文字上限 200,000 字，PDF 最多读取 20 页。

姓名、岗位、城市的明确标签通过 `src/core/matcher.js` 的
`ResumeMatcher.resolveField({ labels })` 解析共享同义词，使用同一 profile 路径。
传递明确章节上下文，防止经历中的工作地点串入期望城市。
仅保留历史 `Name`、`求职意向` 标签兼容；岗位和城市只生成第一个待核对值。
邮箱、手机号沿用全文唯一值规则；教育、工作沿用独立完整记录候选及合并护栏。
未知字段、不同值冲突和无法确定的记录保留为人工核对，不调用 LLM，不识别站点或猜测 ID。

返回的 `profile` 是内存草稿，所有新事实均未确认，`sources[path] === 'resume'`。
`conflicts` 保留候选记录无法合入草稿的原因；全部候选仍供用户逐项选择。
解析不读写存储、不访问网络，也不触发招聘页面操作。导入页调用同一函数展示候选，
用户勾选后才按原流程合入本机资料库：只补空值，保留已有值，仍需逐项确认。
现有域名记忆映射继续要求用户显式确认；导入不学习映射、不启用引擎写入开关。
Never-Save；`liveSupportClaimed=false`，本地测试不构成公开 live support 声明。

Node 24 可在仓库根目录直接复现 TXT 文件解析：

```javascript
import { readFile } from 'node:fs/promises';
import { parseResumeProfile } from './src/import/parser.mjs';
const file = new File([await readFile('resume.txt')], 'resume.txt');
const result = await parseResumeProfile(file);
console.log(result.profile, result.warnings);
```

验证（PowerShell，Node 24；zoo 使用已安装的本地 Playwright 浏览器及隔离临时 profile）：

```powershell
node --test tests/import/*.test.mjs tests/l2-semantics-memory.test.mjs tests/l3-ats-profiles.test.mjs tests/site-option-mapping-profile.test.mjs
node --test --test-concurrency=1 "tests/l1-*.test.mjs" tests/engine-manual-controls.test.mjs tests/product-paths-whitelist.test.mjs tests/guard-worker-auto-runners.test.mjs tests/pack-side-effect-import.test.mjs tests/never-save-guard.test.mjs tests/cms-row-d-network-guard.test.mjs tests/build-paid-rebuild.test.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-internal.ps1
# 将 ZOO_EXTENSION 指向上一步输出目录下的 extension
npm run test:zoo
```

产品文件沿用原打包清单，不新增权限、站点分支或运行时依赖。
