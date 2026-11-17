# 部署 DNS

`lagran-dns` 是可选的权威 DNS，用于 GeoDNS 调度。不部署 DNS 时，域名可以直接 CNAME/A 到 Edge 公网 IP，调度交给普通 DNS 服务商。

## 1. 链路

```text
用户 / 递归 DNS
  → 客户域名 CNAME 到 <zone>
  → lagran-dns 判定是否在 Zone 内
  → 本地调度缓存命中 → 直接返回 A
  → 未命中 → GET {CONTROL_URL}/api/v1/schedule（X-Lagran-Agent-Token）
  → Control 解析客户端 IP 地理信息、过滤在线节点、打分
  → 返回 A 记录 + TTL（与 DNS_TTL 取较小值）
```

## 2. 安装

```bash
curl -fsSL https://raw.githubusercontent.com/Lagran93/Lagran/main/install.sh \
  | sudo env LAGRAN_REPO=Lagran93/Lagran \
      AGENT_TOKEN='<Control 的全局 AGENT_TOKEN>' \
      DNS_ZONE='edge.example.com' \
      DNS_NS_NAME='ns1.edge.example.com' \
      DNS_NS_IP='<DNS 服务器公网 IP>' \
      bash -s -- dns
```

::: warning DNS 用的是全局令牌
与 Edge 不同，`lagran-dns` 调用的是 `/api/v1/schedule`，需要 Control 的**全局** `AGENT_TOKEN`。令牌为空时控制面默认拒绝调度请求（`ALLOW_UNAUTHENTICATED_SCHEDULE` 仅供本地调试）。
:::

## 3. 配置

```bash
sudoedit /etc/lagran/dns.env
```

```ini
DNS_LISTEN=0.0.0.0:53
DNS_TCP=true
DNS_WORKERS=8
DNS_MAX_TCP_CONNECTIONS=512

# 权威 Zone 与 NS/glue
DNS_ZONE=edge.example.com
DNS_NS_NAME=ns1.edge.example.com,ns2.edge.example.com
DNS_NS_IP=203.0.113.53,203.0.113.54
# DNS_SOA_MNAME / DNS_SOA_RNAME 省略时按 Zone 推导

# A 记录 TTL（钳制 5–300），与调度返回 TTL 取较小值
DNS_TTL=30

# 控制面
CONTROL_URL=http://<control-internal>:8080
AGENT_TOKEN=<全局令牌>
DNS_CONTROL_TIMEOUT_MS=800

# 调度缓存与降级
DNS_CACHE_SECS=30
DNS_STALE_SECS=300
# 调度完全失败且无缓存时的兜底 A 记录；留空返回 SERVFAIL
# DNS_FALLBACK_IP=203.0.113.10

# 来源限速（回环地址不限速）
DNS_RATE_LIMIT_PER_SOURCE=100
DNS_RATE_LIMIT_PER_PREFIX=1000
DNS_RATE_LIMIT_MAX_TRACKED=50000
```

关键点：

- `DNS_NS_NAME` 必须与父 Zone 委派出去的 NS 完全一致；`DNS_NS_IP` 是 glue 记录，数量少于 NS 名称时会重复最后一个。
- `DNS_CACHE_SECS` 同时决定了“调度变更的生效延迟上限”。调小一半，控制面调用量大约翻倍。
- `DNS_RATE_LIMIT_PER_SOURCE` 与 `DNS_RATE_LIMIT_PER_PREFIX` 互相独立，只有两者都为 0 才完全关闭限速（启动会打印 warn）。

## 4. GeoIP 数据

调度用的地理库由 **Control** 读取，不是 DNS：

```bash
sudo mkdir -p /var/lib/lagran
sudo wget -O /var/lib/lagran/ip2region_v4.xdb \
  https://raw.githubusercontent.com/lionsoul2014/ip2region/master/data/ip2region_v4.xdb
# 可选：IPv6
sudo wget -O /var/lib/lagran/ip2region_v6.xdb \
  https://raw.githubusercontent.com/lionsoul2014/ip2region/master/data/ip2region_v6.xdb
```

然后在 `control.env` 中设置：

```ini
GEOIP_PATH=/var/lib/lagran/ip2region_v4.xdb
GEOIP_IPV6_PATH=/var/lib/lagran/ip2region_v6.xdb
```

也兼容 V2Ray/Loyalsoldier 的 `geoip.dat`（`GEOIP_DAT_PATH`）与旧版 JSON（`GEOIP_JSON_PATH`）。

## 5. 启动

```bash
sudo systemctl enable --now lagran-dns
sudo systemctl status lagran-dns --no-pager
journalctl -u lagran-dns -f
```

## 6. 委派与 NS

```text
1. 在域名注册商 / 上游 DNS 为 ns1.edge.example.com 等创建 glue A 记录，指向 DNS 服务器 IP
2. 把 edge.example.com 的 NS 委派给这些 NS
3. 客户域名 CNAME 到 cdn.edge.example.com（Zone 内的任意名称）
4. 等待 TTL 生效（原有记录的 TTL 决定切换时间）
```

## 7. 测试

```bash
# 本机
dig @127.0.0.1 cdn.example.com A +short
# 指定端口（未使用 53 时）
dig @<dns-ip> -p 5353 cdn.example.com A +short
# 指定 ECS 观察区域调度
dig @<dns-ip> cdn.example.com A +subnet=1.2.3.0/24 +short
```

返回应为 Edge 公网 IP，而不是 DNS 服务器 IP。

控制台「边缘节点」页也提供了 DNS 测试功能（上游由 `DNS_TEST_SERVER` 指定）。

## 8. 高可用

建议至少两台 DNS：

- 相同 `DNS_ZONE`、`DNS_NS_NAME`、`AGENT_TOKEN`、`CONTROL_URL`
- 相同 GeoIP 数据版本（由 Control 决定，多台 Control 时保持一致）
- NS 同时注册两台，并在注册商处配置两条 glue
- 定期比对解析结果：

```bash
for ip in <dns1> <dns2>; do dig @$ip cdn.example.com A +short; done
```

## 9. 降级行为

| 情况 | 行为 |
| --- | --- |
| Control 不可用 | 使用本地调度缓存；超过 `DNS_CACHE_SECS` 后继续使用 stale 结果，最长 `DNS_STALE_SECS` |
| 完全无缓存且调度失败 | 返回 `DNS_FALLBACK_IP`，未配置则 SERVFAIL |
| 没有在线节点 | 调度返回空，按上一条处理 |
| ECS 缺失 | 使用递归 DNS 出口 IP |
| GeoIP 无匹配 | 仅按权重调度（国家/省/市/ISP 均不加分） |
| 节点 `public_ip` 为空 | 不参与调度 |
| 节点 `offline` / `disabled` | 不参与调度 |
| 单台 NS 不可达 | 递归 DNS 自动切换另一台（依赖两台都委派） |

调度算法与打分细节见 [GeoDNS 调度](/use/geodns)。

