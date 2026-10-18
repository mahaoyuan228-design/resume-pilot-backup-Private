# OSS hosting status 2026-10-18 ~16:55 Asia/Shanghai

Bucket: jianlikuaitian-site / oss-cn-hangzhou
Domain: jianlikuaitian.com (NS: dns15/16.hichina.com)

## Done
- index.html uploaded (public-read object, ~5031 bytes)
- Block public access OFF
- Bucket ACL: public-read
- Static website: default homepage = index.html (verified screenshot oss-static-final.png); subdirectory homepage on; 404 page also index.html

## Blocked / not done
- Custom domain bind: opened configuration/domain, filled jianlikuaitian.com in bind drawer; input showed red validation border; drawer had no usable submit button text in DOM (footer off-screen / empty). Table still empty. No CNAME target captured from console.
- DNS CNAME: not added (would invent values)
- HTTPS: not possible for custom domain without ICP 备案 on mainland bucket

## Verify (from Jeremy PC)
- http://jianlikuaitian-site.oss-cn-hangzhou.aliyuncs.com/index.html => 200, CD=attachment
- http://jianlikuaitian-site.oss-cn-hangzhou.aliyuncs.com/ => 200 index body, CD=attachment
- oss-website-cn-hangzhou endpoint => 502 (likely local proxy)
- jianlikuaitian.com / www => 502; no A/CNAME; NS only

## Direct URLs
- Static: https://oss.console.aliyun.com/bucket/oss-cn-hangzhou/jianlikuaitian-site/data-management/static
- Domain: https://oss.console.aliyun.com/bucket/oss-cn-hangzhou/jianlikuaitian-site/configuration/domain
