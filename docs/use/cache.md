# 缓存规则与 Cache Key

## 规则匹配

一条缓存规则包含：

```text
路径 / 正则
请求方法
查询串包含
响应 Content-Type 包含
缓存动作
TTL / SWR / 浏览器 TTL
优先级
Cache Key 组成
Cookie 策略
```

优先级数值越大越优先；同优先级按配置顺序。

## 缓存动作

| 动作 | 行为 |
| --- | --- |
| `cache` | 读缓存、回源、写缓存 |
| `bypass` | 不读也不写共享缓存 |
| `no_store` | 允许读，但不写 |

## Cache Key

基础格式：

```text
METHOD:host:path[?query]
```

可选后缀：

```text
|lang=<hash>    来自 Accept-Language
|origin=<hash>  来自 Origin
```

`Access-Control-Request-*` 是 OPTIONS 预检专用，当前不进入 GET/HEAD key。未来启用预检缓存后再按方法加入。

### 按域名/规则忽略请求头

域名高级设置和缓存规则都支持三态：

```text
继承域名 / 忽略 / 区分
```

规则显式设置覆盖域名；`null` 表示继承，空字符串表示明确不忽略。

### 忽略 Query

规则可选择：

```text
继承域名 / 忽略 Query / 区分 Query
```

忽略后 `/a?x=1` 与 `/a?x=2` 共用缓存。

## TTL 优先级

```text
规则 ttl_seconds
  → 源站 s-maxage
  → 源站 max-age
  → Expires
  → 域名/全局默认 TTL
```

SWR：

```text
规则 swr_seconds
  → 源站 stale-while-revalidate
  → 0
```

`no-store`、`private`、`no-cache` 不会被规则强制覆盖。

## 支持的 Vary

| Vary 字段 | 行为 |
| --- | --- |
| `Accept-Encoding` | 允许，只缓存 identity |
| `Accept-Language` | 参与 key |
| `Origin` | 参与 key |
| `Access-Control-Request-*` | GET/HEAD 忽略，不阻止缓存 |
| `Cookie` | 拒绝缓存 |
| `User-Agent` | 拒绝缓存 |
| `*` | 拒绝缓存 |

如果某个头被配置为忽略，对应 `Vary` 也按忽略处理。

## 大对象与 Range

- 普通对象上限：`MAX_CACHEABLE_BODY`，默认 8 MiB。
- 大对象：`LARGE_CACHE_*`，默认 8 MiB 起，最大完整对象 1 GiB。
- Range 前缀/后缀：`RANGE_FILL_MAX_BYTES`，默认 32 MiB。
- 完整对象已在 L3 时，小 Range 可直接切片。
- 未覆盖区间可以“已缓存前缀 + 源站剩余区间”拼接为一个 206。

## 常见响应头

| 头 | 含义 |
| --- | --- |
| `x-cache` | `HIT` / `MISS` / `STALE` / `REVALIDATED` |
| `x-lagran-cache-source` | `l1` / `l2` / `l3` / `origin` |
| `x-lagran-cache-lookup-ms` | 缓存查找耗时 |
| `x-lagran-cache-ttl` | 剩余 TTL |
| `age` | 对象年龄 |
| `x-lagran-cache-reason` | 绕过/不存储原因 |

## 调试建议

- 先确认 `x-lagran-datapath`。
- 再确认 `x-cache` 和 `x-lagran-cache-source`。
- 对照 `Vary` 与 cache key。
- 大对象检查 L3 meta。
- 使用 [缓存诊断](/ops/troubleshooting#缓存不命中)。
