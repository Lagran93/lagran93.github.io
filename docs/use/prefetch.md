# 刷新与预热

## 缓存刷新

控制台：

```text
缓存刷新 → 选择域名 → 输入 URL / 路径 / 标签
→ 提交
```

刷新会通知在线 Edge 删除匹配对象。

## 缓存预热

控制台：

```text
缓存预热
→ 手动预热 / 定时预热
```

预热是 Edge 通过本地 Pingora 执行的**真实 GET**，会走普通缓存、Range、大缓存路径，不是只写元数据。

### 预热请求头

可以选择填写：

```text
Accept-Language
Origin
```

用于命中源站 `Vary` 变体。留空表示请求不带该头。

### 大对象自动 Range

如果响应 `Content-Length` 大于：

```ini
RANGE_FILL_MAX_BYTES=33554432
```

预热会自动改为：

```http
Range: bytes=0-33554431
```

只预热前缀，避免 1.5 GB 对象导致 Control 回调超时。

### 超时

```ini
PREFETCH_TIMEOUT_SECS=300
```

默认 300 秒，范围 30–1800。

### 查看结果

```text
预热任务 → warmed / failed
```

成功日志：

```text
prefetch warmed content_length=... use_range=true range_limit=...
```

## 常见失败

| 现象 | 排查 |
| --- | --- |
| 回调超时 | 大对象是否启用 Range，Control 到 Edge 网络 |
| warmed=0 | 域名未同步、源站不可达、404、路径错误 |
| 预热后仍 MISS | cache key 不一致、节点不同、对象已过期 |
| 大文件无缓存 | 大缓存关闭、阈值、源站 Range 不支持 |
| `x-cache: MISS` | 预热只影响对应 Edge；确认请求落到同一节点 |

## 检查 meta

```bash
find /var/lib/lagran/large-cache -name '*.meta.json' | head
cat /var/lib/lagran/large-cache/xx/xxxx.meta.json
```

重点看：

```text
key
content_length
complete
segments
fresh_until
```
