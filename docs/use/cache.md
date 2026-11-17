# 缓存规则与 Cache Key

每个域名有独立的规则集。规则匹配分**请求阶段**和**响应阶段**，理解这一点是配置缓存的关键。

## 规则字段

控制台「缓存规则 → 新建规则」：

| 字段 | 对应 API 字段 | 说明 |
| --- | --- | --- |
| 所属域名 | `domain_id` | 每个域名独立规则集 |
| 匹配路径 | `path_pattern` | 通配 `/static/*`、`/img*`，或正则 |
| 匹配方式 | `match_type` | `wildcard` / `regex` |
| 请求方法 | `match_methods` | 不选=全部方法 |
| 查询串包含 | `match_query` | 可选，进一步缩小命中范围 |
| Content-Type 包含 | `match_content_type` | 可选，**只在响应阶段生效** |
| 缓存动作 | `action` | `cache` / `bypass` / `no_store` |
| 优先级 | `priority` | 数值越大越优先；同优先级按配置顺序取先配置的 |
| 边缘 TTL | `ttl_seconds` | 规则级 TTL |
| SWR | `swr_seconds` | `stale-while-revalidate` 秒数 |
| 浏览器 TTL | `browser_ttl_seconds` | 下发给浏览器的 `Cache-Control` |
| 忽略 Cookie | `ignore_cookie` | 允许带 Cookie 的请求共享缓存（仅公共静态资源） |
| 备注 | `note` | 便于团队识别 |

快速模板（CSS/JS 7 天、静态资源 7 天、图片 30 天、HTML 5 分钟、API 不缓存、下载 1 天）可直接套用后微调。

## 两阶段匹配（重要）

```text
请求阶段：已知 路径 / 方法 / Query / 请求头
    ├─ bypass / no_store → 不读缓存，直接回源
    └─ cache             → 查缓存 / 回源

响应阶段：源站返回后，再叠加 Content-Type 等响应头
    ├─ cache             → 保存，使用该规则的 TTL/SWR
    └─ bypass / no_store → 不保存
```

由此得到几条必须记住的结论：

- Content-Type 规则**不能**决定是否读取缓存，只能在响应阶段决定是否保存
- 请求阶段命中 `bypass` 后，即使响应阶段有 `cache` 规则也不会保存
- 缓存命中后，若响应 Content-Type 与规则不符，Edge 会强制 miss，避免类型不符的旧对象继续被使用
- 带 `match_content_type` 的规则不能同时配置 Cache Key 忽略请求头（控制台会提示）

示例：

```text
规则 A: /*                  bypass  priority 0
规则 B: /api/file/stream*   cache   priority 20    （无 Content-Type）
规则 C: /api/file/stream*   cache   priority 30    Content-Type=video/mp4
规则 D: /api/file/stream*   bypass  priority 30    Content-Type=text/html
```

`/api/file/stream?code=x` 的处理：

```text
请求阶段：A 与 B 参与，B 优先 → cache
响应 video/mp4：C 优先 → 保存，使用 C 的 TTL
响应 text/html：D 优先 → 不保存
```

如果删掉 B：请求阶段只剩 A（bypass），即使响应是 `video/mp4` 也不会读写缓存。这就是“规则测试显示 Content-Type 命中 cache，但实际不缓存”的原因。

## 缓存动作

| 动作 | 行为 |
| --- | --- |
| `cache` | 读缓存、回源、保存 |
| `bypass` | 不读不写，直接回源（当前实现中 `no_store` 也按此处理） |
| `no_store` | 不写入缓存 |

::: warning 改规则不会清旧对象
修改规则或 TTL 后，已缓存的对象仍按旧策略存在。需要[刷新缓存](/use/prefetch)或等待过期。
:::

## Cache Key

```text
METHOD:host:path?query
可选后缀：|lang=<hash>（Accept-Language）、|origin=<hash>（Origin）
```

- 默认包含 Query；域名/规则可开启「忽略 URL 查询串」
- `Accept-Language` 与 `Origin` 是否进入 key 由域名设置 + 规则覆盖决定（三态：继承域名 / 忽略 / 区分）
- `Access-Control-Request-*` 属于 OPTIONS 预检头，不进入 GET/HEAD 的 key
- 全局 `CACHE_KEY_IGNORE_HEADERS` 可排除指定头，规则与域名设置优先

### 带 Cookie 的请求

| 情况 | 行为 |
| --- | --- |
| 存在非 `lagran_clearance` 的 Cookie | 默认绕过缓存 |
| 规则开启 `ignore_cookie` | 允许共享缓存 |
| 响应带 `Vary: Cookie` | 仍然拒绝缓存（Cookie 不在 key 中） |
| 只有 `lagran_clearance`（WAF 质询通过标记） | 不影响缓存，且不会转发给源站 |

### 其他绕过条件

- `Authorization` 请求头存在
- 客户端发送 `Cache-Control: no-store` 或 `no-cache`、`max-age=0`、`Pragma: no-cache` → 走条件回源（有 ETag/Last-Modified 时 304 复用缓存）
- 非 GET/HEAD 方法 → 动态请求，直接转发

所有绕过/未存储的原因都会写入 `X-Lagran-Cache-Reason`，例如 `cookie`、`authorization`、`no-store`、`no-cache`、`vary:user-agent`、`rule-bypass`、`content-type-bypass`、`set-cookie`。

## TTL 优先级

对可缓存的响应：

```text
1. 规则 ttl_seconds（>0）
2. 源站 s-maxage
3. 源站 max-age
4. Expires - Date
5. 域名/全局默认 TTL（CACHE_TTL，默认 60）
```

SWR：

```text
规则 swr_seconds → 源站 stale-while-revalidate → 0
```

以下情况**不会被规则 TTL 覆盖**：

- `no-store`、`private`、`no-cache`、`max-age=0`/`s-maxage=0`
- 响应带 `Set-Cookie`
- 不可缓存的 `Vary`（见下）
- `s-maxage`、`must-revalidate`、`proxy-revalidate` 会禁用 stale（即关闭 SWR 效果）

## 支持的 Vary

| Vary 字段 | 行为 |
| --- | --- |
| `Accept-Encoding` | 允许，只缓存 identity 表示（压缩在边缘完成） |
| `Accept-Language` | 参与 Cache Key |
| `Origin` | 参与 Cache Key |
| `Access-Control-Request-*` | 忽略，不影响 GET/HEAD 缓存 |
| `User-Agent` | 拒绝缓存（`vary:user-agent`） |
| `Cookie` | 拒绝缓存（`vary:cookie`） |
| `*` | 拒绝缓存 |
| 其他字段 | 拒绝缓存（`vary`） |

若某头被配置为「忽略」，对应的 Vary 也按忽略处理。例如站点对所有响应都加了 CORS 的 `Vary: origin, access-control-request-method, access-control-request-headers`，GET/HEAD 仍可缓存，但 Origin 是否区分取决于域名/规则设置。

## 普通缓存与大对象缓存

| 层 | 条件 | 配置 |
| --- | --- | --- |
| 普通缓存 | 响应体 ≤ `MAX_CACHEABLE_BODY`（默认 8 MiB） | `CACHE_BACKEND`、`CACHE_MAX_BYTES`、`DISK_CACHE_*` |
| 大对象 L3 | 响应体 ≥ `LARGE_CACHE_MIN_OBJECT_BYTES`（默认 8 MiB） | `LARGE_CACHE_*` |

启用大缓存后，大对象**不受** `MAX_CACHEABLE_BODY` 限制。推荐让两段严格衔接：

```ini
MAX_CACHEABLE_BODY=8388607            # MIN - 1
LARGE_CACHE_MIN_OBJECT_BYTES=8388608
```

### Range 行为

- 固定分片（`LARGE_CACHE_CHUNK_BYTES`，默认 1 MiB），只有**完整覆盖**的分片才算已缓存
- 首次 Range 从分片边界开始填充，客户端只收到自己请求的字节
- 后续请求只回源缺失分片
- 支持单段、后缀（`bytes=-N`）以及 ≤16 段的多段 Range（`multipart/byteranges`）
- `If-Range` 请求不参与大对象多段拼接，交给源站
- 超过 `LARGE_CACHE_MAX_OBJECT_BYTES` 的对象不缓存完整 GET，但 Range 片段仍可缓存
- fill 可能因单 fill 队列、进程预算、逻辑容量或 `LARGE_CACHE_MIN_FREE_BYTES` 被丢弃/拒绝：客户端响应不受影响，缓存保持 partial

## 响应头

| 头 | 含义 |
| --- | --- |
| `X-Powered-By` | 固定为 `lagran-edge` |
| `X-Cache` | `HIT` / `MISS` / `BYPASS` / `STALE` |
| `X-Cache-Status` | 与 `X-Cache` 相同的兼容头 |
| `X-Lagran-Cache-Reason` | 未命中/绕过原因（仅未命中相关场景出现） |
| `Age` | 对象已在缓存中存活的秒数 |
| `X-Lagran-Cache-TTL` | 剩余新鲜秒数（区别于 `Age`） |
| `X-Lagran-Datapath` | `pingora` / `legacy`，标识实际处理的数据面 |
| `ETag` | 源站 ETag 优先，否则按内容计算 |

::: tip 缓存来源不在响应头里
L1/L2/L3 的命中来源（`l1`、`l2`、`l3`、`l3+origin`）不会加到业务响应头上，而是通过「缓存诊断」接口或访问日志查看，避免对终端用户泄露内部结构。
:::

## 调试建议

1. 用 `X-Lagran-Datapath` 确认请求走了 Pingora 数据面
2. 用 `X-Cache` + `X-Lagran-Cache-Reason` 判断是命中、过期还是被绕过
3. 对照 Vary 与 Cache Key 设置（尤其是 `Origin` 和 `Accept-Language`）
4. 大对象检查 L3 目录下的 `*.meta.json` 与 `complete` 字段
5. 使用「缓存诊断」按 URL 查看各节点命中层级

更多排查见 [故障排查](/ops/troubleshooting)。

