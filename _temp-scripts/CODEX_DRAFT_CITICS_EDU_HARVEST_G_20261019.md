当前状态：`live_education_options_unharvested`。以下仅为操作草稿，不表示中信已支持；仓内没有选项全文，不预填任何选项。

1. **打开页**：人工登录 `https://careers.citics.com/my/jl`，定位学历/学位字段。全程 **Never Save**，不点击保存或提交，不访问私钥，不改 CMS/GTH。
2. **点开学历下拉**：一次只处理“学历”这一个变量，仅展开 Ant Select，不选择选项、不修改其他字段。“学位”另起一轮，重复同样流程。
3. **导出文案/value**：逐项读取实际选项文案及原始 `value`，保留顺序。若为虚拟列表，逐段滚动采集并确认到底；不得把首屏当作全集。`value` 只接受实际读取的值，禁止用文案、序号或招行 Education 映射推算；读不到则记 `null` 并保持阻塞。
4. **落盘字段**：建议记录 `site`、`sourceUrl`、`capturedAt`、`fieldLabel`、`options[{text,value}]`、`valueSource`、`complete`、`evidenceFiles`。学历、学位分别落盘；只保留选项相关证据，避开简历个人信息。
5. **再接线**：确认选项完整、文案与 value 对应且来源可核验后，再按证据接入中信对应字段。与招行 Education 隔离，不扩展为完整插件；采集完成不等于接线验证通过。

证据文件名建议（均为拟定名称）：

- `citics-education-options.live.json`
- `citics-education-dropdown.live.png`
- `citics-education-capture.live.md`：记录采集步骤、完整性依据及缺失项。
- 学位对应使用 `citics-degree-…`，独立保存。

失败码建议：

- `live_education_options_unharvested`：学历尚未取得完整、可核验的选项文案/value。
- `live_login_required`：未登录或登录已失效。
- `live_education_dropdown_unavailable`：未定位到或无法展开学历下拉。
- `live_education_options_incomplete`：虚拟列表未采全或无法确认到底。
- `live_education_option_value_unavailable`：文案可读，但原始 value 不可取得。
- 学位失败码使用对应的 `live_degree_…`，不复用学历采集结果。
