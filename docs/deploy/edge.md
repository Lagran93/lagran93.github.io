# 部署 Edge

Edge 承载真实用户流量：TLS 终止、缓存、回源、WAF/CC、限流、访问日志。它由 Pingora 公共监听 + 进程内管理接口组成。

## 1. 在控制台预注册节点

进入「边缘节点 → 新建节点」：

| 字段 | 说明 |
| --- | --- |
| 名称 / 区域 | 节点标识，用于列表与审计 |
| 公网 IP | GeoDNS 调度返回的 A 记录 |
| 国家 / 省 / 市 / ISP | 参与调度加权（见[GeoDNS](/use/geodns#节点打分)） |
| 权重 | 0–1000，作为基础分 |
| Agent URL | Control 回调地址，必须是**管理口**，如 `http://10.0.0.12:8082` |

保存后节点状态为 `pending`，并获得该节点专属令牌。

::: warning 节点令牌是独立的
安装时 `AGENT_TOKEN` 填**这个节点的令牌**，不要填控制面的全局 `AGENT_TOKEN`。控制面会按令牌绑定节点，用错令牌会导致心跳 401 或上报被拒绝。
:::

## 2. 安装

```bash
curl -fsSL https://raw.githubusercontent.com/Lagran93/Lagran/main/install.sh | sudo env LAGRAN_REPO=Lagran93/Lagran AGENT_TOKEN='<节点令牌>' NODE_ID='<节点 ID>' CONTROL_URL='http://<control>:8080' AGENT_URL='http://<节点公网 IP>:8081' PUBLIC_IP='<节点公网 IP>' NODE_REGION='<节点区域>' bash -s -- edge
```

安装内容：

```text
/opt/lagran/bin/lagran-edge
/opt/lagran/bin/lagran-edge-update           # root 更新助手
/etc/lagran/edge.env
/etc/systemd/system/lagran-edge.service
/etc/systemd/system/lagran-edge-update.path
```

## 3. 配置

```bash
sudoedit /etc/lagran/edge.env
```

### 节点与监听

```ini
EDGE_LISTEN=0.0.0.0:80
EDGE_ADMIN_LISTEN=0.0.0.0:8081

NODE_ID=edge-01
PUBLIC_IP=203.0.113.10
NODE_REGION=cn-east-1
CONTROL_URL=http://<控制面 IP>:8080
AGENT_URL=http://<节点 IP>:8081
AGENT_TOKEN=<节点令牌>
HEARTBEAT_INTERVAL=15
CONFIG_SYNC_INTERVAL_SECS=15

# 多节点共享质询/清零 Cookie 的 HMAC 密钥
CHALLENGE_SECRET=<openssl rand -hex 32>
```

### 缓存

```ini
# memory | disk | hybrid（hybrid = 内存 L1 + 磁盘 L2） | l2 | redis
CACHE_BACKEND=hybrid
CACHE_TTL=60
CACHE_CAPACITY=10000          # 内存条目数
CACHE_MAX_BYTES=536870912     # 内存近似字节上限，LRU 淘汰
DISK_CACHE_DIR=/var/lib/lagran/cache
DISK_CACHE_MAX_BYTES=1073741824

# 普通缓存单响应体上限（钳制 64 KiB–64 MiB）
MAX_CACHEABLE_BODY=8388607

# 可选：Redis L2 共享缓存
# CACHE_REDIS_URL=redis://127.0.0.1:6379/0
# CACHE_REDIS_PREFIX=lagran:cache
# CACHE_FLIGHT_TIMEOUT_MS=250

# 域名/规则之外的全局 key 忽略项（规则可覆盖）
# CACHE_KEY_IGNORE_HEADERS=accept-language,origin
```

### 大对象缓存

```ini
LARGE_CACHE_ENABLED=true
LARGE_CACHE_DIR=/var/lib/lagran/large-cache
LARGE_CACHE_MIN_OBJECT_BYTES=8388608     # 8 MiB 以下仍走普通缓存
LARGE_CACHE_MAX_OBJECT_BYTES=1073741824  # 完整对象上限 1 GiB
LARGE_CACHE_MAX_BYTES=21474836480        # 逻辑容量硬上限
LARGE_CACHE_FILL_MAX_BYTES=0             # 0 = 使用 MAX_OBJECT_BYTES
LARGE_CACHE_CHUNK_BYTES=1048576          # Range 固定分片 1 MiB
LARGE_CACHE_FILL_QUEUE_BYTES=134217728   # 单 fill 写队列
LARGE_CACHE_FILL_QUEUE_TOTAL_BYTES=268435456  # 进程总预算
LARGE_CACHE_MIN_FREE_BYTES=1073741824    # 文件系统必须保留的空闲空间

# 预热任务单次 Range 前缀上限（不影响客户端 Range）
RANGE_FILL_MAX_BYTES=33554432
```

::: tip 阈值衔接
`MAX_CACHEABLE_BODY` 与 `LARGE_CACHE_MIN_OBJECT_BYTES` 建议设成 `MAX = MIN - 1`。普通缓存判断用 `<=`、大缓存用 `>=`，两者相等时同一对象会同时满足两边；相差太多则 `(MAX, MIN)` 之间形成“不缓存空洞”。
:::

### 回源

```ini
ORIGIN_CONNECT_TIMEOUT_MS=3000
ORIGIN_READ_TIMEOUT_MS=30000
ORIGIN_STREAM_READ_TIMEOUT_MS=120000
ORIGIN_DNS_TTL_SECS=30
ORIGIN_HEALTH_FAIL_THRESHOLD=3
ORIGIN_HEALTH_RECOVER_THRESHOLD=2
ORIGIN_HEALTH_INTERVAL_SECS=30
```

域名级「回源连接超时」优先于全局值。

### 安全、CC 与 WAF

```ini
WAF_RULEPACK_SECRET=<与 Control 一致>
# WAF Geo/ASN 名单使用的 MaxMind 库（本地文件）
# GEOIP_COUNTRY_DB=./data/maxmind/GeoLite2-Country.mmdb
# GEOIP_ASN_DB=./data/maxmind/GeoLite2-ASN.mmdb
WAF_REPORT=true
WAF_REPORT_INTERVAL=5

# CC / 限流跨节点共享
# REDIS_URL=redis://127.0.0.1:6379/0
CC_SYNC_INTERVAL=5
CC_BEHAVIOR_ENABLED=false

# 前置可信代理时才开启，否则会信任伪造的 X-Forwarded-For
TRUST_PROXY_HEADERS=false
# TRUSTED_PROXIES=10.0.0.0/8
```

### Origin Shield

```ini
# 普通 Edge 保持 false
EDGE_SHIELD_DISABLED=false
# 专用 Shield 节点必须设为 true，否则会向自己回源形成环路
# EDGE_SHIELD_DISABLED=true
```

## 4. 启动

```bash
sudo systemctl enable --now lagran-edge
sudo systemctl status lagran-edge --no-pager
journalctl -u lagran-edge -f
```

## 5. 验证

```bash
# 管理口
curl -fsS http://127.0.0.1:8082/__lagran/health

# 指标（需要令牌）
curl -fsS -H "X-Lagran-Agent-Token: <节点令牌>" \
  http://127.0.0.1:8082/__lagran/metrics | head

# 数据面（替换 Host）
curl -sD - -o /dev/null -H 'Host: cdn.example.com' http://127.0.0.1:8081/
```

预期响应头：

```http
X-Powered-By: lagran-edge
X-Cache: MISS
X-Lagran-Datapath: pingora
```

同时控制台节点列表应显示 `online`，并出现版本号、CPU/内存与连接数。

## 6. 证书与 HTTPS

Edge 自己终止公共 TLS（`443`），证书来源：

- 控制台上传或 ACME 申请后，Edge 通过 `GET /api/v1/certs/edge-sync` 拉取并热加载
- 通配符证书同样支持，SNI 选择由 `CertStore` 完成

不需要单独为 Edge 配置证书文件路径。详见 [HTTPS 与证书](/deploy/tls)。

## 7. 多节点部署建议

- 每台 Edge 一个独立节点令牌与独立的 `NODE_ID`
- `CHALLENGE_SECRET`、`WAF_RULEPACK_SECRET` 在所有节点**完全一致**，否则质询/规则包验签会失败
- CC 共享封禁与全局限流需要各节点配置同一个 `REDIS_URL`
- 大缓存容量按磁盘规划，`LARGE_CACHE_MIN_FREE_BYTES` 至少保留 1 GiB
- Shield 节点单独部署并开启 `EDGE_SHIELD_DISABLED=true`，见 [Origin Shield](/use/origin-shield)

## 8. 同机部署注意

Control 与 Edge 同机时：

- 8080 / 8081 / 8082 端口不能冲突；管理口保持回环或内网
- Caddy 不要同时监听 443（控制台用 443 时，Edge 需使用独立 IP 或不同端口）
- 大缓存目录单独挂载，避免与控制面数据库争抢 IO

## 9. 常见启动问题

| 现象 | 排查 |
| --- | --- |
| 管理口 401 | 用了全局 `AGENT_TOKEN` 而不是节点令牌；`CONTROL_URL` 指向了错误实例 |
| 节点一直 `pending` / 心跳失败 | Control 无法访问 `AGENT_URL`；防火墙未放行 8082 |
| 数据面 502 | 源站不可达、SNI/回源 Host 配错、源站证书校验失败 |
| 大文件不落盘 | `LARGE_CACHE_ENABLED=false`、小于 `MIN_OBJECT_BYTES`、超过 `MAX_OBJECT_BYTES`、fs 预留不足 |
| 配置不生效 | 域名启用了配置发布但未发布；等待 15 秒同步；检查 `x-lagran-node-id` 是否被反代改写 |
| 质询循环 | 各节点 `CHALLENGE_SECRET` 不一致 |

