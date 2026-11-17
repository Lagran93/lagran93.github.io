---
layout: home

hero:
  name: Lagran CDN
  text: 可自托管的企业级 CDN
  tagline: Control 控制面 + Pingora 边缘 + 自研权威 DNS + Nuxt 控制台。从部署、接入、缓存策略到 WAF/CC、GeoDNS、运维排障，一套文档走完。
  image:
    src: /logo.svg
    alt: Lagran CDN
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/quick-start
    - theme: alt
      text: 部署总览
      link: /deploy/
    - theme: alt
      text: 在线演示
      link: https://console.lagrancdn.com

features:
  - icon: 🚀
    title: 边缘加速
    details: Pingora 数据面，HTTP/1.1/2、TLS/SNI 动态证书、多源站池；内存 / 磁盘 / Redis L2 缓存，含 ETag、304、SWR 与 single-flight。
  - icon: 📦
    title: 大对象与 Range
    details: 独立 L3 大缓存，1 MiB 固定分片、只回源缺失分片、最多 16 段 multipart/byteranges、容量水位与文件系统预留。
  - icon: 🌍
    title: GeoDNS 调度
    details: 自研权威 DNS（UDP/TCP、EDNS0+ECS），基于 ip2region 的国家 / 省 / 市 / ISP 加权评分，含缓存与降级。
  - icon: 🛡️
    title: 安全防护
    details: WAF 托管规则 + 自定义 DSL + IP/Geo/ASN 黑白名单、CC 聚合与 PoW 质询、签名 URL、回源鉴权、防盗链。
  - icon: 🧭
    title: 可治理
    details: 配置版本、Diff、强制审批、灰度发布与自动回滚；用户组模块权限、多租户项目隔离、操作审计。
  - icon: 🏢
    title: Origin Shield
    details: 管理员维护 Shield 白名单，域名只能下拉选择；区域汇聚回源，降低源站带宽与连接压力。
---

## 从这里开始

### 第一次部署

按 **Control → Edge → DNS（可选）** 的顺序安装，先跑通最小可用环境。

- [部署总览](/deploy/)：顺序、端口、目录、验收清单
- [部署 Control](/deploy/control)：PostgreSQL、密钥、管理员、前端与反向代理
- [部署 Edge](/deploy/edge)：节点令牌、缓存与大对象、管理口隔离
- [部署 DNS](/deploy/dns)：Zone/NS/SOA、限速、调度缓存与兜底

### 我在使用控制台

- [项目、权限与域名接入](/use/domains)：用户组模块权限、源站 SNI/回源 Host、接入向导
- [缓存规则与 Cache Key](/use/cache)：请求/响应两阶段匹配、TTL 优先级、Vary
- [刷新与预热](/use/prefetch)：URL / 目录 / 标签刷新、定时预热、大对象自动 Range
- [WAF 与 CC 防护](/use/waf)：模式、规则 DSL、Geo/ASN、共享封禁与质询
- [Origin Shield](/use/origin-shield)：白名单、部署顺序、防回源环

### 我在排查问题

- [监控与健康检查](/ops/monitoring)：端点、指标、日志、告警
- [故障排查](/ops/troubleshooting)：缓存不命中、大缓存不落盘、504、401、DNS
- [安全清单](/ops/security)：上线前必须逐项确认的配置
- [备份与恢复](/ops/backup)：数据库、环境文件、证书与 GeoIP

### 我要参与开发

- [本地开发与测试](/dev/development)：docker compose、cargo、npm、集成脚本
- [请求流水线](/dev/request-pipeline)：Pingora / Legacy 双数据面与共享策略
- [完整参考](/reference/)：与主仓库同步的原始手册

## 文档结构

| 区域 | 内容 |
| --- | --- |
| [指南](/guide/introduction) | 项目定位、能力边界、版本策略、系统架构 |
| [部署](/deploy/) | Control、Edge、DNS、HTTPS/TLS、升级与回滚 |
| [使用](/use/) | 域名、缓存、刷新预热、WAF/CC、证书、配置发布、GeoDNS、Origin Shield |
| [运维](/ops/) | 监控、备份、故障排查、安全基线 |
| [开发](/dev/) | 本地环境、测试脚本、请求流水线 |
| [参考](/reference/) | 从主仓库 `docs/` 自动同步的完整手册 |

::: tip 文档来源
导航页是按代码现状重新整理的；`参考` 页面由 `npm run docs:sync` 从主仓库同步，内容以 `main` 分支代码为准。
:::

