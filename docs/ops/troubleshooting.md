# 故障排查

## 推荐顺序

```text
1. 请求是否真的经过 Edge      → X-Powered-By / X-Lagran-Datapath
2. 域名是否已被 Edge 识别     → 未接入/同步延迟/配置发布
3. 安全层是否拦截            → WAF/CC/限流/防盗链/签名 URL
4. 规则是否命中              → 规则测试器
5. Cache Key 是否一致        → Query / Origin / Accept-Language / Cookie
6. 响应是否可缓存            → Cache-Control / Vary / Set-Cookie / 大小
7. 缓存层与 TTL              → 缓存诊断 + X-Lagran-Cache-Reason
8. 源站与网络                → 源站健康、超时、TLS/SNI
```

## 1. 确认请求经过 Edge

```bash
curl -sD - -o /dev/null https://cdn.example.com/
```

```http
X-Powered-By: lagran-edge
X-Cache: HIT
X-Lagran-Datapath: pingora
```

没有这些头，检查：

- DNS 是否指向 Edge/GeoDNS Zone（`dig cdn.example.com`）
- 是否命中了源站的 `Host` 或前置 CDN
- 是否被 HTTPS 跳转或 WAF 拦截（看 `x-lagran-error`）

## 2. 域名未被识别

症状：返回 Lagran 的提示页（未接入域名），或一直 404/默认页。

```text
域名是否已保存并在正确的项目下
Edge 是否在线（控制台节点列表）
Edge 配置同步是否正常：journalctl -u lagran-edge | grep -i config
域名是否启用了配置发布但未发布新版本
是否等待了 ≥15 秒
```

## 3. 缓存不命中

依次检查：

1. `X-Cache` 与 `X-Lagran-Cache-Reason`
2. 响应 `Cache-Control` / `Vary` / `Set-Cookie`
3. 请求方法、Cookie、Authorization、Range
4. Cache Key 组成：Query、`Accept-Language`、`Origin`
5. 域名/规则是否忽略对应头
6. 是否落到不同 Edge 节点（多节点时）
7. 对象是否已过期

常见 reason 与含义：

| Reason | 含义 | 处理 |
| --- | --- | --- |
| `cookie` | 请求带非 clearance Cookie | 静态资源启用规则「忽略 Cookie」 |
| `authorization` | 请求带 Authorization | 不回源鉴权的静态资源不要带 |
| `no-store` / `no-cache` | 客户端或响应要求不缓存 | 检查 `Cache-Control` |
| `set-cookie` | 响应带 `Set-Cookie` | 源站去掉 |
| `vary:user-agent` / `vary:cookie` / `vary:*` | Vary 不允许缓存 | 修改源站 Vary |
| `vary` | 其他不可缓存的 Vary 字段 | 同上 |
| `rule-bypass` | 命中 bypass 规则 | 检查规则优先级 |
| `content-type-bypass` | 响应 Content-Type 命中 bypass | 同上 |
| `method` | 非 GET/HEAD | 正常 |

### 浏览器有 lang，预热没有

预热请求不带语言时 Cache Key 不含 `|lang`。给预热任务填写相同的头：

```text
Accept-Language: zh-CN,zh;q=0.9
```

### 规则忽略不生效

```sql
SELECT path_pattern, priority, match_content_type, ignore_key_headers
FROM cache_rules
WHERE domain_id = (SELECT id FROM domains WHERE name = 'cdn.example.com');
```

重点：

- `ignore_key_headers` 是否包含 `origin=ignore` / `accept-language=ignore`
- 是否被更高优先级规则覆盖
- `match_content_type` 非空的规则不参与请求阶段 key，也不能配置 key 忽略
- 域名是否启用了配置发布但未发布新版本

### CORS Vary 导致 Range 不缓存

响应：

```http
vary: origin, access-control-request-method, access-control-request-headers
```

GET/HEAD 会忽略 `Access-Control-Request-*`；`Origin` 仍按配置。若 `Access-Control-Allow-Origin` 固定，可在域名/规则上忽略 Origin。

## 4. 大文件缓存没有文件

```ini
LARGE_CACHE_ENABLED=true
LARGE_CACHE_MIN_OBJECT_BYTES=8388608
LARGE_CACHE_MAX_OBJECT_BYTES=1073741824
LARGE_CACHE_MIN_FREE_BYTES=1073741824
RANGE_FILL_MAX_BYTES=33554432
```

```bash
find /var/lib/lagran/large-cache -name '*.meta.json' | head
df -h /var/lib/lagran/large-cache
```

排查顺序：

1. 大缓存是否开启（默认 `false`）
2. 对象大小是否落在 `[MIN_OBJECT_BYTES, MAX_OBJECT_BYTES]`
3. 完整 GET 是否因超过 `MAX_OBJECT_BYTES` 而不缓存（此时 Range 片段仍可缓存）
4. 是否因 `LARGE_CACHE_MAX_BYTES`（逻辑上限）或 `LARGE_CACHE_MIN_FREE_BYTES`（fs 预留）导致 fill 被拒绝
5. `chunk_fill_rejects_total` / `chunk_fill_drops_total` 是否增长

::: tip partial 对象是正常的
`complete=false` 表示只缓存了部分分片，后续 Range 请求会继续补齐，并不是故障。
:::

## 5. 预热失败

```text
warmed=0
callback timeout
```

检查：

- Control → Edge `agent_url` 是否可达（8082）
- 域名配置是否已同步到该节点
- 源站是否 404/超时/TLS 失败
- 大对象是否自动 Range（`RANGE_FILL_MAX_BYTES`）
- `PREFETCH_TIMEOUT_SECS`
- WAF 是否拦截了预热请求

## 6. Edge Agent 401 / 节点离线

- Edge 用的是**节点令牌**，不是 Control 的全局 `AGENT_TOKEN`
- `NODE_ID` 是否与控制台节点一致
- 管理口是否被反向代理改写/拦截
- 系统时间偏差是否过大
- `ALLOW_INSECURE_AGENT` 是否被误开却又与 HTTPS 混用

## 7. DNS

```bash
dig @<dns-ip> cdn.example.com A +short
dig @<dns-ip> cdn.example.com A +subnet=1.2.3.0/24 +short
```

返回 DNS 服务器 IP 时：

- CNAME 指错，或 Zone 未委派
- 调度没有可用节点（`public_ip` 为空 / 全部 offline）

`SERVFAIL` 时：

- `AGENT_TOKEN` 是否与控制面一致
- `DNS_FALLBACK_IP` 是否配置
- Control 是否可达（`DNS_CONTROL_TIMEOUT_MS`）

## 8. 504 / 回源超时

```ini
ORIGIN_CONNECT_TIMEOUT_MS=3000
ORIGIN_READ_TIMEOUT_MS=30000
ORIGIN_STREAM_READ_TIMEOUT_MS=120000
```

域名级「回源连接超时」优先于全局。常见原因：

- 源站首字节慢（数据库查询、动态渲染）
- 源站不支持 Range，大文件整包传输
- 源站 TLS 握手慢（SNI 配错会先失败再重试）
- 回源 DNS 解析慢（`ORIGIN_DNS_TTL_SECS`）
- 多源站池中有不健康源站，failover 期间耗时增加

## 9. 403 权限问题

| 现象 | 检查 |
| --- | --- |
| 接口返回 403 | 用户组是否缺少对应模块权限（如 `waf:write`） |
| 能看到菜单但看不到数据 | 项目成员关系是否缺失（模块权限不扩大数据范围） |
| 管理员能看，普通用户看不到 | 该域名未归属普通用户所在项目（仅 admin 可见） |
| 菜单项消失 | 配置发布/用户组/Shield 节点等为管理员菜单 |

## 10. HTTPS / 证书

```bash
openssl s_client -connect cdn.example.com:443 -servername cdn.example.com </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -dates
```

- 443 不通：Edge 未配置 `EDGE_HTTPS_LISTEN`
- 证书不对：证书未下发、SAN 不匹配、同节点有更具体证书
- ACME 失败：80 端口不可达、域名未指向 Edge

## 11. JWT 失效 / 前端不退出

- 修改密码或角色后 `token_version` 变化，旧 JWT 立即失效
- 多标签页会话：前端使用 `lagran_session_v2` 单键存储，旧标签页不会覆盖新会话
- 浏览器时间偏差会导致 JWT 校验失败

## 12. 数据库 / 迁移

```bash
journalctl -u lagran-control -n 200 --no-pager
curl -sS http://127.0.0.1:8080/ready
```

检查 `DATABASE_URL`、网络、账号权限、`max_connections`（多副本总连接数 = 副本数 × `DATABASE_MAX_CONNECTIONS`）、迁移锁。

## 13. 端口 / 防火墙

```bash
ss -lntup | grep -E ':(8080|8081|8082|443|53)\b'
```

确认：

- `8082` 只对内网开放
- Edge 的 443 与前置代理不冲突
- DNS 的 53 未被 `systemd-resolved` 占用

