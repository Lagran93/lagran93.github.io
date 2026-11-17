# 刷新与预热

两个操作都能让“新版本内容”尽快生效，但机制不同：

| 操作 | 作用 | 备注 |
| --- | --- | --- |
| 刷新（purge） | 删除匹配的缓存对象 | 下次请求回源并重新缓存 |
| 预热（prefetch） | 主动请求 URL，把内容提前写入缓存 | 走真实 GET 路径，受规则/缓存限制 |

## 缓存刷新

控制台「缓存刷新」：

```text
选择域名 → 选择刷新方式 → 提交 → 查看每个节点的结果
```

四种方式：

| 方式 | 输入 | 说明 |
| --- | --- | --- |
| 按 URL | 完整 URL 列表（每行一条） | 精确删除对象，含 Query 变体 |
| 按目录 | 路径前缀（如 `/static/`） | 删除前缀下所有对象 |
| 按标签 | 源站 `Surrogate-Key` / `Cache-Tag` | 只清理带对应标签的对象，**不会**退化为全站清理 |
| 全站刷新 | 确认域 | 清空该域名在该节点的缓存 |

执行过程：

```text
Control 接收刷新请求
→ 下发到所有在线 Edge：POST /__lagran/purge
→ Edge 删除 L1/L2/L3 中匹配的对象
→ 返回每个节点的成功/失败
→ 失败节点进入重试队列（purge_retries）
```

要注意：

- 刷新只影响**在线且有结果的节点**，离线节点恢复后仍可能有旧对象；必要时对该节点单独刷新
- 大对象的 partial 分片也会被删除，刷新后首次 Range 会重新填充
- 刷新不会改变源站 `Cache-Control`，若源站仍返回长 TTL，对象会再次被长时间缓存

## 缓存预热

控制台「缓存预热 → 新建预热」：

```text
选择域名
→ 填写 URL 列表（或选择定时任务）
→ 可选填写请求头：Accept-Language、Origin
→ 提交
```

预热实现：Control 调用 Edge 的 `POST /__lagran/prefetch`，Edge 用**本地 Pingora 数据面**发起一次真实 GET：

- 会经过限流、WAF、规则、Cache Key，与真实用户请求一致
- 命中缓存则不再回源
- 结果写入预热任务：`warmed` / `failed`

### 请求头与 Vary

浏览器带 `Accept-Language`、`Origin` 时 Cache Key 会带 `|lang` / `|origin` 后缀。如果预热任务没有填写同样的头，预热出来的对象与用户请求的 key 不同，仍然会 MISS。

```text
浏览器：Accept-Language: zh-CN,zh;q=0.9  → key 带 |lang
预热未填该头                            → key 不带 |lang
```

### 大对象自动 Range

若响应 `Content-Length` 大于 `RANGE_FILL_MAX_BYTES`（默认 32 MiB），预热自动改为前缀 Range：

```http
Range: bytes=0-33554431
```

只预热前缀，避免 1.5 GB 对象导致 Control 回调超时；后续用户 Range 请求会按分片继续补齐。

### 超时

```ini
# control.env
PREFETCH_TIMEOUT_SECS=300     # 30–1800
```

### 查看结果

```text
缓存预热 → 预热任务 → 状态 / warmed / failed / 错误信息
```

成功时 Edge 日志会出现 `prefetch warmed content_length=... use_range=true range_limit=...`。

## 定时预热

「缓存预热 → 定时预热」可配置周期性任务：

```text
域名 + URL 列表 + 执行周期（cron 风格）+ 启用状态
```

适合每日固定的首页、榜单、活动页。定时任务与手动任务共用同一套执行与记录逻辑。

## 常见失败

| 现象 | 排查 |
| --- | --- |
| 回调超时 / `callback timeout` | Control 到 Edge 管理口网络；`PREFETCH_TIMEOUT_SECS`；是否对大对象启用了 Range |
| `warmed=0` | 域名未同步到该节点；源站 404/5xx；URL 路径错误；WAF 拦截了预热请求 |
| 预热成功但用户仍 MISS | Cache Key 不一致（语言/Origin/Query）；请求落到别的节点；对象已过期 |
| 大文件没有缓存 | `LARGE_CACHE_ENABLED=false`；对象小于 `MIN_OBJECT_BYTES` 或大于 `MAX_OBJECT_BYTES`；空间不足导致 fill 被拒绝 |
| 刷新后仍是旧内容 | 源站自身缓存/上游 CDN 未刷新；刷新未覆盖该节点；源站返回长 TTL |

## 检查大缓存元数据

```bash
# 查看某个对象的 meta
find /var/lib/lagran/large-cache -name '*.meta.json' | head
cat /var/lib/lagran/large-cache/<xx>/<key>.meta.json
```

重点字段：

```text
key
content_length
complete        # 是否已完整覆盖全部分片
segments        # 已缓存的分片区间
fresh_until     # 新鲜截止时间
```

`complete=false` 表示只缓存了部分 Range，属于正常状态，后续请求会继续补齐缺失分片。

## 相关

- [缓存规则与 Cache Key](/use/cache)
- [故障排查 · 大文件缓存没有文件](/ops/troubleshooting#大文件缓存没有文件)
- [完整手册 · 缓存刷新与预热](/reference/manual)

