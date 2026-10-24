1. **登录后停页假设**：停在 ATSX 简历编辑／申请表页。飞书实际 URL **待 live**；小米假设为 `https://<子域>.jobs.f.mioffice.cn/<路径待 live>`。登录后仍需确认页面身份，不能仅凭域名判定。

2. **三字段顺序与证据文件名**：

| 顺序 | 字段 | 单字段证据文件 |
|---|---|---|
| 1 | 姓名 | `01-name.dom.html`、`01-name.probe.json` |
| 2 | 手机 | `02-phone.dom.html`、`02-phone.probe.json` |
| 3 | 邮箱 | `03-email.dom.html`、`03-email.probe.json` |

另存脱敏停页信息：`00-page-context.json`，记录 URL、登录状态及表单身份依据。

3. **每轮采集步骤**：先采当前字段所属容器、标签、关联关系、input 属性、匹配数量及禁用／只读状态；未知关联结构写「待 live」。已知合同仅为 `.atsx-form`／`.atsx-form-item`／`input.atsx-input`，其 live 命中情况仍需验证。默认只读；确认无自动保存后，才允许单字段填入测试值并回读，记录预期值、实际值及其他字段是否变化，恢复基线后再进入下一字段。**Never Save：不触发保存、投递；无法排除自动保存则停止写入验证。**

4. **建议失败码（草稿，非现有码）**：`AUTH_REQUIRED` 登录墙；`PAGE_UNVERIFIED` 页面身份未确认；`DOM_CONTRACT_MISMATCH` 合同结构不符；`FIELD_NOT_FOUND` 未找到字段；`FIELD_AMBIGUOUS` 无法唯一定位；`FIELD_NOT_EDITABLE` 不可编辑；`READBACK_MISMATCH` 回读不符；`CROSS_FIELD_CHANGE` 其他字段变化；`AUTOSAVE_UNVERIFIED` 无法排除自动保存；`FIXTURE_DRIFT` 与 fixture 不一致。任一失败均停止当前轮，不继续后续字段。

5. **与 offline scaffold 对照**：逐项核对姓名／手机／邮箱的容器结构、字段归属、唯一定位及文本回读语义。Offline 三字段 PASS 只作为基线；live 不一致时保留脱敏证据、记录 `FIXTURE_DRIFT`，交主脑决定 fixture／适配修订，不猜 class、不放宽匹配、不宣称 live 已支持。不扩展性别／婚姻 select，不改 cms/gth。