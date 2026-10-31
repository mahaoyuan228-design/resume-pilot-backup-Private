# 北森 Beisen-2022 · 登录后 DOM 采包（offline 草稿 · 2026-10-19）

Never Save · 未宣称已支持 · provisional fixture ≠ live

1. 登录北森账号，首选君乐宝 `junlebaoruye.zhiye.com`，停在真实简历编辑页（非空 `#bsMain`）。
2. 一次一变量采 姓名→手机→邮箱：容器/标签/input/匹配数；证据 `beisen-01-name.*` 等。
3. 排除 `CmsPortal`/`is-old` legacy。不把公开 `phoenix-input` 等近邻升格为表单选择器。
4. 采齐后再考虑替换 provisional `.bs-form-item`；此前 live fill 禁止。
