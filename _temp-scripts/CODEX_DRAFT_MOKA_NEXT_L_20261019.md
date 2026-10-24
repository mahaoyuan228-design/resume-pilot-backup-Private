**离线下一刀（草稿，待主脑裁剪）**

1. **字段**：沿用 `fullName / phone / email`；补空值、缺字段、重复标签的离线用例，暂不扩字段。
2. **同壳契约**：族级 `siteId=moka`；`ti / 143986` 保留为租户、门户信息，优先复用同壳映射。
3. **DOM 契约**：现有 `.moka-*` 仅属 provisional fixture；公开 CSS 的 BEM 提示不能直接升格为 live 选择器。
4. **失败码建议**：`FIELD_NOT_FOUND`、`FIELD_AMBIGUOUS` 跳过对应字段；`DOM_CONTRACT_UNVERIFIED` 阻止真实填充。均为拟议，未宣称已实现。
5. **验收边界**：仅离线 readiness／fill-without-save；结果标明 synthetic，完成不等于已支持。

**需 Jeremy**：登录 TI Moka 并打开真实简历编辑页，采字段容器、标签及 input markup，再据此替换临时 DOM 契约。

**不要做**：Never Save，不投递；不改 cms/gth；不编造未见 class；暂不扩 select、证件、教育或 popup 接线；不对外宣称已支持。