# 项目介绍

Lagran CDN 是一个面向企业场景的 CDN 控制面与边缘节点系统，包含：

```text
Control  控制台、API、配置、数据库
Edge     Pingora + 传统数据面，负责缓存与回源
DNS      自研权威 DNS，负责 GeoDNS 调度
Web      Nuxt 控制台
```

## 核心能力

- 多域名、多项目、多租户
- 缓存规则、Cache Key、TTL、SWR
- 普通缓存与大对象 Range 缓存
- 缓存刷新、缓存预热、配置发布与灰度
- WAF、CC 防护、签名 URL、防盗链
- GeoDNS：国家 / 省 / 市 / ISP 调度
- 健康检查、指标、访问日志、登录日志、审计

## 推荐阅读顺序

| 目标 | 页面 |
| --- | --- |
| 第一次安装 | [快速开始](/guide/quick-start) |
| 理解组件关系 | [系统架构](/guide/architecture) |
| 正式上线 | [部署总览](/deploy/) |
| 日常使用 | [使用总览](/use/) |
| 出问题 | [故障排查](/ops/troubleshooting) |
| 二次开发 | [开发总览](/dev/) |

## 版本与兼容性

- 生产部署建议使用 GitHub Release 中的 Linux amd64 构建。
- 旧系统 glibc 不兼容时使用 musl 构建。
- Edge 升级依赖 `install.sh edge` 安装的 root 更新助手。
- 配置发布、GeoDNS、缓存预热等功能需要 Control、Edge、DNS 的版本匹配。

## 相关链接

- [GitHub 仓库](https://github.com/Lagran93/Lagran)
- [完整使用手册](/reference/manual)
- [完整部署手册](/reference/deployment)
