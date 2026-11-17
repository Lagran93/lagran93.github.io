# 请求流水线

## 目标

Pingora 原生数据面与 Legacy 兜底数据面**共用同一套**：

- HTTPS 跳转、Bot、CC、限流、WAF、防盗链（`RequestPipeline::preflight`）
- 请求分类（`RequestClass`）
- 缓存策略解析与 Cache Key
- 条件请求（304 复用）

新增功能应进入共享层（`server/pipeline.rs`、`cache/policy.rs`），而不是任选一个数据面单独实现。

## 阶段

```text
1. 监听 / TLS / Host 解析 → 域名注册表（未接入域名返回提示页）
2. HTTPS 跳转（域名开启 HTTPS 时）
3. 限流（域名级令牌桶，可跨节点 Redis）
4. Bot / CC 质询（PoW + clearance Cookie）
5. WAF（IP 名单 → Geo/ASN → 托管规则 → 自定义规则 → 安全级别）
6. 防盗链（Referer / 签名）
7. 规则解析（路径、方法、Query）
8. 请求分类 → Cacheable / StrictRevalidation / Bypass / Websocket / Dynamic
9. Cache Key（含 ignore_query、忽略头、lang/origin 后缀）
10. L1 内存 → L2 磁盘/Redis → L3 大缓存
11. 回源（single-flight、多源站池、可选 Shield）或流式透传
12. 响应策略（TTL / SWR / Vary / Set-Cookie）决定是否保存
13. 响应头 / 访问日志 / 指标
```

## 请求分类

| 分类 | 场景 | 处理 |
| --- | --- | --- |
| `Cacheable` | 无 Cookie/Authorization、GET/HEAD、规则 cache | 查缓存 → 回源 → 保存 |
| `StrictRevalidation` | 客户端要求 no-cache / max-age=0 | 条件回源，304 复用 |
| `Bypass` | Cookie（非 clearance）、Authorization、规则 bypass | 流式转发，不读写缓存 |
| `Websocket` | Upgrade 请求 | 与源站完成 RFC 6455 握手后隧道 |
| `Dynamic` | POST/PUT 等非缓存方法 | 完整转发 method/body/headers |

每种分类都能通过 `reason()` 给出原因字符串，写入 `X-Lagran-Cache-Reason`。

## 数据面选择

| 场景 | 数据面 |
| --- | --- |
| 普通 GET/HEAD（缓存/绕过/条件请求） | Pingora |
| Range（小段切片、流式透传、多段） | Pingora |
| 预热请求 | Pingora（本地真实 GET） |
| 健康检查、ACME challenge、challenge verify、`/__lagran/*` 管理接口 | Pingora 直接响应 |
| WebSocket | Legacy 隧道 |
| 管理端口（`EDGE_ADMIN_LISTEN`） | 独立 Axum 监听 |
| 无法构建原生计划的请求 | Legacy 兜底 |

兜底发生时日志会打印：

```text
legacy GET/HEAD fallback reached
```

持续出现说明有请求没走原生路径，应排查（通常是新增的请求分支没有接入 `RequestPipeline`）。

## 数据面计数

```text
lagran_edge_datapath_pingora_total
lagran_edge_datapath_legacy_total
```

`legacy` 持续增长同样是排查信号。

## Cache Key

```text
METHOD:host:path?query            （ignore_query 时去掉 ?query）
|lang=<hash>                      （Accept-Language 参与时）
|origin=<hash>                    （Origin 参与时）
```

- 是否参与由域名设置 + 规则覆盖决定；全局 `CACHE_KEY_IGNORE_HEADERS` 可兜底排除
- `Access-Control-Request-*` 不进入 GET/HEAD key
- 带 `match_content_type` 的规则不参与请求阶段 key

## 关键不变量

- 一个请求只能经过一条缓存/超时/日志管线
- 不允许两个数据面各写一份缓存策略
- 请求阶段的 bypass 不能被响应阶段的 cache 规则“救回”
- 大对象 fill 失败不能影响已经开始的客户端响应

## 测试

```bash
cargo test -p edge
cargo test -p control
bash tests/integration/smoke.sh              # 断言普通 GET/Range/no-cache 都走 Pingora
bash tests/integration/cache-diagnostics.sh
bash tests/integration/no-cache-preflight.sh
bash tests/integration/http-optimizations.sh
bash tests/integration/ws-echo.sh            # WebSocket 走 Legacy
```

迁移阶段与剩余工作见 [请求流水线迁移](/reference/request-pipeline-migration)。

