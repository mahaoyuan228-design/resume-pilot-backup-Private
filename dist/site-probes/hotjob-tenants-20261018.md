# hotjob / wecruit 同壳租户候选 · 2026-10-18（Asia/Shanghai）

**目的**：找出可与招商 CMS **同壳复用**的 `wecruit.hotjob.cn/SU…` 租户，供后续白名单与试填。
**原则**：下列均为公开证据上的**候选**；未做登录后 `resumeOperation.html` 试填前，**不算已支持**。
**对照基线**：招商证券 `SU629dbc0c0dcad452299bc0f7`（现网可填）。

**候选数（不含基线）**：11

| # | 公司 | SU id | 证据 URL | 置信度 | 备注 |
| --- | --- | --- | --- | --- | --- |
| 1 | 招商证券 | `SU629dbc0c0dcad452299bc0f7` | https://wecruit.hotjob.cn/SU629dbc0c0dcad452299bc0f7/pb/resumeOperation.html | baseline | 现网已支持 CMS 基线；CDP 试用 Edge 仍开着简历编辑页。不算扩站候选，作对照。 |
| 2 | 中联重科 | `SU661f37091eb8053acd6cdf3d` | https://wecruit.hotjob.cn/SU661f37091eb8053acd6cdf3d/mc/index | high | 公开校招门户标题即「中联重科校园招聘」；CDN 路径含 zoomlion。 |
| 3 | 隆基绿能（LONGI） | `SU649d30920dcad4644b43e39b` | https://wecruit.hotjob.cn/SU649d30920dcad4644b43e39b/mc/position/campus | high | 职位页 CDN 资源路径含 /oline/LONGI/；另有 longi.hotjob.cn 入口，同属 hotjob 族。 |
| 4 | 欧普照明 | `SU646ed9920dcad45af14821b4` | https://wecruit.hotjob.cn/SU646ed9920dcad45af14821b4/mc/position/campus | high | 职位列表展示「欧普照明股份有限公司」岗位名。 |
| 5 | 海天味业 | `SU6322ee8c0dcad46a862dcbe5` | https://wecruit.hotjob.cn/SU6322ee8c0dcad46a862dcbe5/mc/position/campus | high | 高校就业网内推链接指向该 SU；文案为海天味业 2026 届校招。 |
| 6 | 中国信息通信研究院 | `SU642fbf5fbef57c1e269fa798` | https://wecruit.hotjob.cn/SU642fbf5fbef57c1e269fa798/pb/index.html | high | 门户标题「中国信通院招聘」；页面正文为信通院校招「智定者」计划。 |
| 7 | 台积电（南京） | `SU61075bbabef57c43d825d671` | https://wecruit.hotjob.cn/SU61075bbabef57c43d825d671/mc/position/campus | high | 职位列表岗位归属「台积电（南京）有限公司」。 |
| 8 | TCL茂佳科技 | `SU6491506a2f9d24316e91b81b` | https://wecruit.hotjob.cn/SU6491506a2f9d24316e91b81b/mc/position/campus | high | 职位列表明确标注 TCL茂佳科技 27 届岗位。 |
| 9 | 上海宇量昇科技 | `SU63847447bef57c649c3505b5` | https://wecruit.hotjob.cn/SU63847447bef57c649c3505b5/mc/position/campus | high | 高校就业网「应聘网址」直链该 SU；公司名上海宇量昇。 |
| 10 | 哈尔滨锅炉厂（哈锅） | `SU65f3a7421eb8054100a07870` | https://wecruit.hotjob.cn/SU65f3a7421eb8054100a07870/mc/index | high | 门户标题「哈锅2027校园招聘」；正文为哈尔滨锅炉厂。 |
| 11 | 地平线（Horizon） | `SU62d915040dcad43c775ec12c` | https://wecruit.hotjob.cn/SU62d915040dcad43c775ec12c/mc/position/campus | high | 第三方校招站将同名「AI芯片Linux/Android平台软件工程师」岗位归属北京地平线，并给出该 SU 投递链。另有 horizon-campus.hotjob.cn 入口，同属 hotjob 族。 |
| 12 | 中联重科 / 中科云谷（社招租户） | `SU60a6449a2f9d2430fdc11a19` | https://wecruit.hotjob.cn/SU60a6449a2f9d2430fdc11a19/pb/social.html | medium | 社招页公司列为中科云谷等；与校招 SU661f… 不同租户，复用时需单独验证简历编辑路径。 |

## 复用判断（工程）

- 现有 CMS 匹配：`hostname === wecruit.hotjob.cn` 且 path `^/SU[^/]+/pb/resumeOperation\.html$`（见 `popup.js` `isCmsResumePage`）。
- 照片等部分逻辑仍钉死招商 SU（`isCmsPhotoResumePage`）——扩租户时**不要**误开照片上传到未验证 SU。
- 下一动作：对高置信候选打开门户 → 登录后确认简历编辑是否仍为 `…/pb/resumeOperation.html` → 再做 fill-without-save。

## 不宣称

- 未写进客户「已支持列表」。
- `*.hotjob.cn` 子域（如 `longi.hotjob.cn`、`horizon-campus.hotjob.cn`、`cgn.hotjob.cn`）同属大易/hotjob 族，但是否与 `wecruit` SPA 同源需另指纹；本表以 `wecruit.hotjob.cn/SU*` 为主。

*JSON：同目录 `hotjob-tenants-20261018.json`。*
