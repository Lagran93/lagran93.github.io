# 系统架构

## 组件与流量路径

```text
浏览器 / 客户端
      │  DNS 查询（A / CNAME）
      ▼
lagran-dns（权威 DNS）          仅 GeoDNS 模式
      │  GET /api/v1/schedule → lagran-control
      │  返回按地理位置与负载打分最高的 Edge IP
      ▼
lagran-edge（Pingora 数据面）
      │  缓存命中 → 直接返回
      │  未命中   → Origin Shield（可选）→ 源站池
      ▼
源站 / Origin Shield
```

控制面不参与业务流量，只负责配置、数据、证书、任务与告警。

| 组件 | 二进制 | 职责 |
| --- | --- | --- |
| 控制面 | `lagran-control` | Axum API、PostgreSQL、认证与权限、域名/规则、证书与 ACME、节点管理、刷新与预热、配置发布、统计、告警、审计 |
| 边缘 | `lagran-edge` | Pingora 公共监听与 TLS、缓存（L1/L2/L3）、回源与故障切换、WAF/CC/限流、访问日志、指标 |
| 权威 DNS | `lagran-dns` | Zone/NS/SOA、UDP/TCP、EDNS0+ECS、调度缓存与降级、来源限速 |
| 控制台 | Nuxt 静态站点 | 登录、配置、诊断、监控大屏；由 Caddy/Nginx 反向代理到 `lagran-control` |

## 通信关系

Edge 与 Control 之间是 **HTTP + JSON**，不是 gRPC：

```text
Edge → Control
  GET  /api/v1/config              每 15s 拉取全量配置（带 ETag/304、x-lagran-node-id）
  POST /api/v1/nodes/heartbeat     每 HEARTBEAT_INTERVAL(15s)：版本、CPU/内存、Agent 地址
  POST /api/v1/metrics/report      指标上报（批量接口 /metrics/report/batch）
  POST /api/v1/access-logs/report  访问日志（gzip）
  POST /api/v1/waf/events          WAF 事件（每 WAF_REPORT_INTERVAL=5s）
  POST /api/v1/origin-health/report 源站健康（逐源站）
  POST /api/v1/config/apply-report 灰度发布回执
  GET  /api/v1/certs/edge-sync     证书同步（含 PEM）

Control → Edge（反向调用 agent_url）
  POST /__lagran/purge            刷新
  POST /__lagran/prefetch         预热
  POST /__lagran/cache-diagnose   缓存诊断
  PUT  /__lagran/acme/challenge   ACME HTTP-01
  POST /__lagran/certs/load       证书热加载
  POST /__lagran/config/reload    配置重载
  POST /__lagran/update           节点升级

DNS → Control
  GET  /api/v1/schedule           全局 AGENT_TOKEN
```

- 所有 Control → Edge 调用都走 `EDGE_ADMIN_LISTEN`（默认 `127.0.0.1:8082`），不应暴露公网。
- Edge 侧的 `/__lagran/*` 需要令牌（`X-Lagran-Agent-Token`）；`/__lagran/health` 与 `/__lagran/metrics` 的开放程度取决于配置。
- `crates/lagran-proto` 与 `proto/` 是未来 gRPC 的占位，当前未接入。

## 请求流水线

Pingora 原生数据面与 Legacy 兜底数据面共用 `RequestPipeline`，避免策略漂移：

```text
请求
→ Host / SNI → 域名注册表（未接入域名返回提示页）
→ HTTPS 跳转（域名开启 HTTPS 时，先于 WAF/缓存）
→ 限流 / Bot / CC 质询
→ WAF（IP 白名单/黑名单 → Geo/ASN → 托管规则 → 自定义规则 → 安全级别）
→ 防盗链
→ 规则匹配（路径通配 + 方法 + Query；Content-Type 在响应阶段）
→ 请求分类 Cacheable / StrictRevalidation / Bypass / Websocket / Dynamic
→ Cache Key
→ L1 内存 → L2 磁盘/Redis → L3 大缓存
→ 回源（single-flight 合并、多源站池、可选 Origin Shield）
→ 响应策略 / TTL / SWR / 存储 → 响应头 / 日志 / 指标
```

WebSocket 与管理接口走 Legacy 路径；少量无法构建原生计划的请求也会兜底到 Legacy，日志中会打印 `legacy GET/HEAD fallback reached`。细节见 [请求流水线](/dev/request-pipeline)。

## 缓存层次

| 层 | 实现 | 说明 |
| --- | --- | --- |
| L1 | 进程内 `MemoryCache`（DashMap + LRU） | 命中最快，容量由 `CACHE_MAX_BYTES` 控制 |
| L2 | 磁盘（`disk`/`hybrid`）或 Redis 共享缓存 | 磁盘按 mtime 淘汰；Redis 需 `CACHE_REDIS_URL`/`REDIS_URL` |
| L3 | 大对象缓存 `LARGE_CACHE_DIR` | 固定分片，独立容量与文件系统预留 |

普通缓存与 L3 按对象大小分工：小于 `LARGE_CACHE_MIN_OBJECT_BYTES` 走普通缓存，大于等于该值走 L3，L3 不受 `MAX_CACHEABLE_BODY` 限制。两者阈值建议严格衔接（`MAX_CACHEABLE_BODY = LARGE_CACHE_MIN_OBJECT_BYTES - 1`），详见 [缓存规则](/use/cache#普通缓存与大对象缓存)。

## 配置发布

```text
保存域名 / 规则 / WAF / 高级设置
→ 生成 config_version（含字段级 Diff）
→ 新建发布单（选择域名与版本，可选灰度节点）
→ 提交审批
→ 管理员审批
→ publishing（灰度节点先下发并等待 apply-report）
→ published
→ 写入 domains.published_version_id
```

- 域名一旦绑定 `published_version_id`，后续修改**不会**直接影响线上，必须发布新版本。
- 灰度节点失败或 120 秒未回执时，发布单自动回滚，旧配置继续生效。
- 配置发布菜单仅管理员可见，发布单必须经过审批。

## 数据模型

主要表（PostgreSQL，迁移位于 `apps/control/migrations`）：

```text
users / user_groups / user_group_members / projects / project_members
domains / cache_rules
edge_nodes / shield_nodes
certificates / acme_challenges
config_versions / config_releases / config_release_reports
prefetch_tasks / prefetch_schedules / purge_retries
waf_settings / waf_rules / waf_ip_rules / waf_geo_rules / waf_events / waf_rulepacks
alert_channels / alert_rules / alert_events
access_logs / edge_metrics / origin_health / login_logs / audit_logs
```

完整字段说明见 [架构参考](/reference/architecture)。

## 鉴权与多租户

```text
全局角色      admin / user
用户组        模块权限（domain:read … user:write），多组取并集
项目成员      owner / admin 读写，member 只读
```

- 模块权限只决定“能否进入某个功能”，数据范围仍由项目成员关系限定。
- 全局 `admin` 不受用户组限制，可见全部项目与审计。
- 未归属任何项目的域名仅 admin 可见可改。

## 设计取舍

- Control 只做配置与数据，不转发业务流量。
- Edge 优先 Pingora 原生路径，Legacy 只做兜底，两条路径共享同一套策略实现。
- Cache Key 使用确定性字符串，便于诊断与跨节点复用。
- 配置发布用版本快照保证可回滚。
- GeoDNS 查询失败时使用本地缓存或兜底 IP，不阻塞解析。
- 大缓存是节点本地状态，跨节点一致性交给 Origin Shield 而不是分布式锁。

