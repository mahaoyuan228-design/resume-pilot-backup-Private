# hotjob-mc 证件号码：离线 Never-Save 证据

待真机 Never-Save，未宣称已支持。`liveSupportClaimed=false`。

基线：`mahaoyuan228-design/resume-pilot-backup-Private`，分支
`cursor/expand-night-ats-f861`，提交 `3fd7a99d7044230f5210b8fa146dba5b67378cac`。
本切片分支：`codex/hotjob-mc-id-number-never-save`。

## DOM 来源

- `dist/site-probes/HOTJOB_MC_OPERATIONRESUMER_raw.json`，2026-10-18 中联
  `https://wecruit.hotjob.cn/SU661f37091eb8053acd6cdf3d/mc/deliver/operationResumer`，
  `probe.placeholders` 已记录 `请填写证件号码`。
- 同目录 `HOTJOB_MC_OPERATIONRESUMER_20261018.md` 已记录该页为 antd-mobile
  H5 基本信息页，含证件号码；pb 是另一套 DOM。
- 现有 `tests/fixtures/hotjob-mc-basic-form.html` 已有 `.my-list-item#29_ref`、
  `.header-title` 文本 `证件号码`、`.am-input-control input`、`type="text"`、
  `placeholder="请填写证件号码"`。原始夹具 SHA-256：
  `9bf1f9317697355f3742fcb51e8fad11117d37d3edbeb1afe1bf9d45acee62ad`。
- 新夹具 `tests/fixtures/hotjob-mc-id-number-form.html` 直接截取该原始夹具从文首到
  popup 之前的内容，保留六个原有字段与下一步按钮，补上文档闭合标签。
  未增加网站控件、字段、选项或事件模型。原有姓名、性别、证件类型、移动电话、
  电子邮箱仅作为邻居。测试逐一比较这六个字段与原夹具的 DOM。

原夹具中证件号码的值是合成保护标记 `NEIGHBOR_KEEP`。默认调用必须跳过它。
成功场景仅由测试将该控件的运行时值设为空，以检验只填空值的行为；此运行时准备
不表示采集时网站为空，也不改变保存下来的 DOM 证据。

## 独立 API 与边界

新脚本：`src/content/hotjob-mc-id-number.js`，全局对象 `ResumeHotjobMcIdNumber`。

```js
await ResumeHotjobMcIdNumber.fillField('证件号码', 'SYNTHETIC-ID-001');
await ResumeHotjobMcIdNumber.fillProfile({
  identityNumber: 'SYNTHETIC-ID-001',
  confirmedFields: ['identityNumber']
});
```

`fillField` 是显式单字段调用，仅接受精确字段名与非空字符串。
`fillProfile` 仅读取用户已确认的 `identityNumber`；`idNumber` 不会被当作已确认事实。
接口要求 HTTPS `wecruit.hotjob.cn`、精确 mc 路由、唯一可见的基本信息标题，
并拒绝 pb、Ant/CMS 混入、控件变化、重复字段、缺失输入、只读、禁用或隐藏输入。

原始输入值非空就不写入，包括纯空格。与请求相同的已有值直接核验；其他已有值
返回 `existing_value`。空输入经 focus 后再次定位并检查空值与邻居状态，随后使用
原生 value setter，依次派发 input/change/blur，并在 80 ms 后检查相同控件的读回值。
读回失败或其他输入、选择显示值发生变化时返回失败。并发调用返回 `control_busy`。

脚本没有任何 click/submit/save 路径，没有恢复或覆盖已有值的路径。所有结果均含：

```json
{
  "neverSave": true,
  "saved": false,
  "skippedSave": true,
  "saveClicks": 0,
  "liveSupportClaimed": false,
  "supportClaimed": false,
  "softwareClickedNext": false,
  "softwareClickedSave": false,
  "softwareClickedSubmit": false,
  "softwareClickedDeliver": false,
  "softwareClickedDelete": false
}
```

未修改 `hotjob-mc-basic.js`、profile map、旧夹具、CMS、engine、manifest 或产品入口。
此切片需单独加载，不能作为已上线支持声明。另一 Codex 的身高/体重分支不在本切片内。

## 离线验证

环境：Node.js v24.20.0，jsdom 26.1.0。命令：

```sh
node --test tests/hotjob-mc-id-number.test.mjs
```

结果：10 个测试通过，0 个失败。成功用例的实际断言：

| 项目 | 读回结果 |
|---|---|
| before | 空字符串 |
| expected / after | `SYNTHETIC-ID-001` |
| reason / status | `readback_matched` / `verified` |
| writeAttempted | true |
| neighborsUnchanged | true，姓名、性别、证件类型、移动电话、电子邮箱快照一致 |
| input / change / blur / focus 事件数 | 各 1 次 |
| 所有 click 事件数 | 0 |
| saved / skippedSave / saveClicks | false / true / 0 |
| liveSupportClaimed | false |

其余用例覆盖：默认非空夹具、已有相同值/不同值/纯空格、未确认或缺失的资料、
空值/非字符串/未知字段、错误站点/协议/路由/标题/隐藏页面、16 种控件变化、
focus 期间出现新值、并发调用、受控组件重置导致的读回失败、邻居变化导致的失败，
以及原有 `ResumeHotjobMcBasic` / `CMS_BASIC` 全局对象保持原样。

这些是离线 DOM 与代码行为证据。尚未补采新的真机 DOM，也未进行真机填写、保存、
刷新持久化或产品入口验收；站点可能自行响应输入事件。仍为待真机 Never-Save。
