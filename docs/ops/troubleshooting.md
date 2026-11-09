# 故障排查

## 推荐顺序

```text
1. 请求是否经过 Edge
2. 域名是否匹配
3. 规则是否命中
4. 缓存 key 是否一致
5. 响应是否可缓存
6. 缓存层级 / TTL
7. 源站与网络
```

## 确认请求经过 Edge

```bash
curl -skD - -o /dev/null https://cdn.example.com/
```

看：

```http
x-lagran-datapath: pingora
x-powered-by: lagran-edge
```

没有这些头，检查 DNS / CNAME / NS / Caddy。

## 缓存不命中

检查：

1. `x-cache`、`x-lagran-cache-source`
2. `x-lagran-cache-reason`
3. 响应 `Cache-Control` / `Vary`
4. 请求方法、Cookie、Authorization、Range
5. Cache Key：query、`Accept-Language`、`Origin`
6. 域名/规则是否忽略对应头
7. 是否落到不同 Edge 节点
8. TTL 是否过期

### 浏览器有 lang，预热没有

预热请求不带语言，key 本来就不带 `|lang`。给预热任务填写同样的：

```text
Accept-Language: zh-CN,zh;q=0.9
```

再观察。

### 规则忽略不生效

检查：

```sql
SELECT
  path_pattern,
  priority,
  match_content_type,
  ignore_key_headers
FROM cache_rules
WHERE domain_id = (SELECT id FROM domains WHERE name='cdn.example.com');
```

重点：

- `ignore_key_headers` 是否为 `origin=ignore,accept-language=ignore`
- 是否被更高优先级规则覆盖
- `match_content_type` 非空的规则不参与请求阶段 key
- 域名是否启用了配置发布但未发布新版本

## 大文件缓存没有文件

检查：

```ini
LARGE_CACHE_ENABLED=true
LARGE_CACHE_MIN_OBJECT_BYTES=8388608
LARGE_CACHE_MAX_OBJECT_BYTES=1073741824
RANGE_FILL_MAX_BYTES=33554432
```

```bash
find /var/lib/lagran/large-cache -name '*.meta.json' | head
```

如果对象大于 `MAX_CACHEABLE_BODY` 且大缓存关闭，不会缓存。

## CORS Vary 导致 Range 不缓存

响应：

```http
vary: origin, access-control-request-method, access-control-request-headers
```

GET/HEAD 会忽略 ACR*；`Origin` 仍按配置。若固定 ACAO，可按域名/规则忽略 Origin。

## 预热失败

```text
warmed=0
callback timeout
```

检查：

- Control → Edge `agent_url`
- 域名配置是否同步
- 源站是否 404 / 超时
- 大对象是否自动 Range
- `PREFETCH_TIMEOUT_SECS`

## 边缘 Agent 401

- `AGENT_TOKEN` 不一致
- 节点 `auth_token` 覆盖
- 管理口是否被代理改写
- 系统时间

## DNS

```bash
dig @<dns-ip> -p 8053 cdn.example.com A +short
```

如果返回 DNS 服务器 IP：

- CNAME 指错
- A 记录指错
- Zone 未委派

## 504

- 源站慢
- `ORIGIN_READ_TIMEOUT_MS`
- `ORIGIN_STREAM_READ_TIMEOUT_MS`
- 大文件 Range
- Caddy / 网络

## 数据库 / 迁移

```bash
journalctl -u lagran-control -n 100 --no-pager
```

检查 `DATABASE_URL`、权限、迁移锁。

## 端口 / 防火墙

```bash
ss -lntp | grep -E '8080|8081|8082|8053|443'
```
