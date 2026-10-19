# hotjob 同壳 · Celebright/国盛 一键试填准备（2026-10-19）

草稿 · Never Save · 不构成已支持 · 南粤 PASS 不代替本租户

## 已核对键（来自 `scripts/run-hotjob-tenant.cmd`）

| 键 | 租户 | SU | 停页（登录后） | 路径 |
| --- | --- | --- | --- | --- |
| `celebright` | Celebright 曼领 | `SU6279c916bef57c3ac0d49671` | `…/SU6279…/pb/resumeOperation.html` | CMS_BASIC（pb） |
| `guosheng` | 国盛证券 | `SU6879a7b3e57172288b60df9d` | `…/SU6879…/pb/resumeOperation.html`（wecruit host） | CMS_BASIC（pb） |

命令：`scripts\run-hotjob-tenant.cmd celebright` 或 `guosheng`  
默认 CDP **9237**；EXT 默认试填 `hhembhoojafdefnkonmgoejfedgloanc`。

## 前置
- 账号与试填资料已备；自动保存不明则不试填
- 壳分类见 `HOTJOB_SHELL_CLASS_南粤Celebright国盛_20261018.md`（公开猜 pb，**非** live PASS）

## 步骤
1. 登录后停在上表 resumeOperation 表单（非列表/预览）
2. 确认 URL 含对应 SU；不借南粤键
3. 记初值与预计 skip；观察请求
4. 跑一键脚本一次：只看回填/skip，不保存/提交
5. 记本租户成功/skip/误填 + Never Save 证据；缺口进 customScopedAnswers

## 判据
停页合格 · 字段可核对 · Never Save 无持久化请求 · 证据与南粤隔离 · `personalVerified` 按本租户实测，不沿用南粤的 8

## 禁止
不放宽 scope · 不复用南粤答案 · 不点保存/投递 · 不改仓/不宣称支持 · 可卖仍仅 CMS+GTH
