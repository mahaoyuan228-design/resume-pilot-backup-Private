| 检查项 | 可裁剪草稿 |
|---|---|
| 登录隔离 | 飞书使用独立会话，不跨站共享登录；需登录时记 `AUTH_REQUIRED`。 |
| DOM 合同 | `.atsx-form` / `.atsx-form-item` / `input.atsx-input` 仅 JS-confirmed、待 live；现场不符记 `DOM_CONTRACT_MISMATCH`，不猜替代选择器。 |
| Never Save | 只读采包；不触发保存、提交或写接口，不碰私钥。 |
| 证据路径 | 建议 `dist/auto-runs/ats-live-dom/feishu-atsx/<run-id>/`；留脱敏 DOM、截图及核对结果，不含凭据。 |
| 漂移与失败 | 现场证据与 fixture 不符记 `FIXTURE_DRIFT`；失败留原因与证据路径，不补造 DOM。 |
| 状态边界 | 离线门禁绿≠已支持；飞书待 live 核验；可售仅招商 CMS＋国泰 GTH。 |