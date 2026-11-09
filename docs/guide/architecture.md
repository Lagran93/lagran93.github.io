# 系统架构

## 组件

```text
浏览器 / 客户端
      │
      ▼
   权威 DNS（GeoDNS）
      │  返回最近、评分最高的 Edge IP
      ▼
   Edge 数据面（Pingora）
      │  缓存命中 → 直接返回
      │  未命中   → 回源站
      ▼
    源站 / Origin Shield
```

控制面负责配置、数据、证书、告警与任务；Edge 负责请求处理与缓存；DNS 负责调度。

| 组件 | 职责 |
| --- | --- |
| `lagran-control` | API、控制台后端、PostgreSQL、配置版本、预热、告警 |
| `lagran-edge` | Pingora 公共监听、缓存、回源、WAF/CC、证书 |
| `lagran-dns` | 权威 DNS、GeoIP 查询、节点打分 |
| 前端 | Nuxt 控制台 |

## 通信关系

```text
Edge   → Control   心跳、指标、日志、配置拉取
DNS    → Control   调度查询
Control→ Edge      刷新缓存、证书、配置重载、预热
```

所有 Control → Edge 管理调用走 `EDGE_ADMIN_LISTEN`，只应允许 Control 来源访问。

## 请求流水线

Edge 的 GET/HEAD 请求优先走 Pingora 原生数据面：

```text
请求
→ Host / 域名配置
→ 规则匹配（路径、方法、Query、Content-Type）
→ WAF / CC / 限速 / 防盗链
→ Cache Key
→ L1/L2 普通缓存
→ L3 大对象缓存
→ 源站
```

需要 WebSocket、管理接口或无法使用原生路径的请求进入 Legacy 兜底数据面。

## 缓存层次

| 层 | 说明 |
| --- | --- |
| L1 | 进程内 MemoryCache |
| L2 | Redis 共享缓存（可选） |
| L3 | 大对象 / Range 磁盘缓存 |

普通缓存适合小对象；大对象按 Range 分段写入，支持前缀、后缀和源站剩余区间拼接。

## 配置发布

```text
修改域名 / 规则 / WAF
→ 自动生成 config_version
→ 创建 release
→ 审批
→ 灰度或全量发布
→ 节点 apply-report
→ published
```

域名一旦绑定 `published_version_id`，后续修改不会直接生效，必须发布新版本。

## 数据模型

主要表：

```text
users / projects / project_members
domains / cache_rules
edge_nodes
certificates
config_versions / config_releases
prefetch_tasks / prefetch_schedules
access_logs / login_logs / audit_logs
waf_* / alert_* 
```

完整说明见 [架构参考](/reference/architecture)。

## 设计取舍

- Control 管配置，不转发业务流量。
- Edge 数据面优先 Pingora，Legacy 仅兜底。
- 缓存 key 使用确定性字符串，便于诊断和大缓存复用。
- 配置发布通过版本快照保证可回滚。
- GeoDNS 查询失败时降级到可用节点，不阻塞解析。
