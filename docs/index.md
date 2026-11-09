---
layout: home

hero:
  name: Lagran CDN
  text: 企业级边缘加速与调度
  tagline: 从 Control、Edge、DNS 到缓存、WAF、GeoDNS，一份可落地的部署、使用与运维手册。
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/quick-start
    - theme: alt
      text: 部署总览
      link: /deploy/
    - theme: alt
      text: GitHub
      link: https://github.com/Lagran93/Lagran

features:
  - icon: 🚀
    title: 边缘加速
    details: Pingora 数据面、普通缓存与大对象 Range 缓存，覆盖静态资源、下载与视频。
  - icon: 🌍
    title: GeoDNS 调度
    details: 基于 ip2region 的国家/省/市/ISP 解析，结合权重、负载与在线状态选择节点。
  - icon: 🔐
    title: 安全防护
    details: WAF、CC 防护、签名 URL、Origin 鉴权、防盗链和多租户权限。
  - icon: 🧭
    title: 可运维
    details: 配置版本、审批发布、灰度回滚、缓存预热、健康检查与故障排查。
---

## 从这里开始

<div class="vp-features">

### 我是第一次部署

从 [部署总览](/deploy/) 开始，按 Control → Edge → DNS 的顺序安装。

- [部署 Control](/deploy/control)
- [部署 Edge](/deploy/edge)
- [部署 DNS](/deploy/dns)

### 我在使用控制台

- [项目与域名](/use/domains)
- [缓存规则与 Cache Key](/use/cache)
- [刷新与预热](/use/prefetch)
- [WAF 与 CC 防护](/use/waf)

### 我在排查问题

- [监控与健康检查](/ops/monitoring)
- [故障排查](/ops/troubleshooting)
- [缓存不命中](/ops/troubleshooting#缓存不命中)
- [大文件缓存没有文件](/ops/troubleshooting#大文件缓存没有文件)

### 我要参与开发

- [本地开发与测试](/dev/development)
- [请求流水线](/dev/request-pipeline)
- [完整架构说明](/reference/architecture)

</div>

## 文档结构

| 区域 | 内容 |
| --- | --- |
| [指南](/guide/introduction) | 项目定位、快速开始、系统架构 |
| [部署](/deploy/) | Control、Edge、DNS、TLS、升级 |
| [使用](/use/) | 域名、缓存、预热、WAF、证书、发布、GeoDNS |
| [运维](/ops/) | 监控、备份、故障排查、安全 |
| [开发](/dev/) | 本地环境、测试、请求流水线 |
| [参考](/reference/) | 完整原始手册与深度说明 |

> 本站内容整理自主项目 `docs/` 目录。遇到与代码不一致时，以仓库中的最新代码和完整手册为准。
