# 项目介绍

Lagran CDN 是一个可自托管、多租户的 CDN 系统，由四个可独立部署的部分组成：

```text
Control   lagran-control   控制面：API、PostgreSQL、配置发布、证书、统计、告警
Edge      lagran-edge      边缘：Pingora 数据面、缓存、WAF/CC、回源、TLS
DNS       lagran-dns       自研权威 DNS：EDNS0/ECS + GeoIP 调度
Console   apps/frontend    Nuxt 4 SPA 控制台（构建为静态站点）
```

- 边缘：Rust + Pingora，HTTP/1.1、HTTP/2、TLS/SNI 动态证书、反向代理
- 控制面：Rust + Axum + sqlx/PostgreSQL（Redis 可选）
- 控制台：Nuxt 4 + Pinia，SPA 模式，支持深色模式、中英文导航、PWA
- 许可：AGPL-3.0-only

## 核心能力

### 边缘节点

- Pingora 公共监听，按 Host/SNI 路由到域名配置；WebSocket 隧道
- 多源站池：优先级分组、组内加权轮询、健康检查、故障切换
- 内存 / 磁盘 / 混合缓存，Redis L2 共享缓存（可选）；ETag、304、SWR、single-flight
- 大对象 L3 缓存：固定分片 Range、只回源缺失分片、多段 `multipart/byteranges`、容量硬上限与文件系统预留
- WAF：托管规则、自定义 DSL、IP/CIDR 黑白名单、Geo/ASN 黑白名单（MaxMind GeoLite2）
- CC：IPv4 `/24`、IPv6 `/64` 聚合，路径预算，全局阈值 + 攻击模式，PoW 质询
- 共享封禁、签名 URL、回源鉴权、防盗链（含签名）、CORS、自定义头、压缩

### 控制面

- JWT 登录、图片验证码、注册开关、用户 / 用户组 / 项目 / 多租户
- 模块级权限（`domain:read`、`waf:write` 等），与项目成员范围叠加
- 域名、源站池、缓存规则、高级设置、签名 URL、回源鉴权
- 证书：上传、Let's Encrypt ACME HTTP-01、自动续期
- 边缘节点：预注册、节点令牌、心跳、启停、升级、Geo/ISP 调度元数据
- 缓存刷新（URL / 目录 / 标签 / 全站，失败重试）、预热任务与定时预热
- 配置版本、Diff、审批、灰度发布、自动回滚
- 统计、访问日志、操作审计、登录日志、源站健康
- 告警：SMTP / Webhook（可选 HMAC 签名）/ Telegram

### DNS

- 自研权威 DNS：UDP/TCP、SOA/NS/A/AAAA、glue 记录
- EDNS0 + ECS；调度由控制面 `/api/v1/schedule` 完成
- 本地调度缓存、控制面故障时的 stale 降级、兜底 IP、按来源限速

### Origin Shield

- 管理员在「系统 → Shield 节点」登记内部地址，域名只能从白名单下拉选择
- 普通 Edge 未命中时向区域 Shield 汇聚，Shield 仍未命中才回源

## 能力边界

以下事项需要提前知道，避免上线后误判：

- CC 是 L7 防护，SYN/UDP/连接耗尽等 L4 攻击需要云清洗或上游联动
- 带普通 Cookie 的请求默认绕过缓存；缓存响应不保存 `Set-Cookie`
- 大缓存是**节点本地**状态，不同 Edge 的补全进度互不共享
- Edge–Control 通信使用 HTTP + JSON（`crates/lagran-proto` 与 `proto/` 仍是 gRPC 占位）
- 行为评分是启发式功能，默认关闭
- 控制台目前只内置中文界面，导航支持中英文切换

## 推荐阅读顺序

| 你的目标 | 页面 |
| --- | --- |
| 第一次安装 | [快速开始](/guide/quick-start) |
| 理解组件与数据流 | [系统架构](/guide/architecture) |
| 正式上线 | [部署总览](/deploy/) |
| 日常使用 | [使用总览](/use/) |
| 出问题 | [故障排查](/ops/troubleshooting) |
| 二次开发 | [开发总览](/dev/) |
| 查细节 | [完整参考](/reference/) |

## 版本与兼容性

- 生产部署建议使用 GitHub Release 的 Linux amd64 构建；最新标签见 [Releases](https://github.com/Lagran93/Lagran/releases)
- 旧系统 glibc 不兼容时使用 musl 构建（`x86_64-unknown-linux-musl`）
- 控制面与边缘的系统内升级依赖 `install.sh` 安装的 root 更新助手（`lagran-update.path`、`lagran-edge-update.path`）
- 配置发布的灰度回执、GeoDNS 调度协议、预热的 Range 行为都要求 Control / Edge / DNS 版本匹配，升级时请按 [升级与回滚](/deploy/upgrade) 的顺序进行

## 相关链接

- [GitHub 仓库](https://github.com/Lagran93/Lagran)
- [在线演示控制台](https://console.lagrancdn.com)
- [Telegram 交流群](https://t.me/lagranedge)
- [完整使用手册](/reference/manual)
- [完整部署手册](/reference/deployment)

