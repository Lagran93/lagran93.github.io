# GeoDNS 调度

## 目标

根据客户端 IP 的地理位置与运营商，选择**最近、线路匹配、负载较低**的 Edge 节点，返回 A 记录。

## 参与组件

```text
lagran-dns        权威 DNS，负责收包、Zone 判定、本地缓存、降级
lagran-control    /api/v1/schedule，负责 GeoIP 解析、节点过滤、打分
ip2region XDB     （或 geoip.dat / JSON）地理位置库
edge_nodes        节点数据：公网 IP、地理位置、ISP、权重、负载、状态
```

## 流程

```text
用户 DNS
→ 客户域名 CNAME 到 Zone
→ lagran-dns 判定是否在 Zone 内
→ 构造调度缓存 key（域名 + 客户端网段/ECS）
→ 命中本地缓存 → 返回
→ 未命中 → GET /api/v1/schedule
     → Control 解析客户端 IP（ECS 优先，否则递归出口 IP）
     → 过滤 status=online 且 public_ip 非空的节点
     → 按地理/权重/负载打分
     → 返回 A 记录与 TTL
→ DNS 返回 A（TTL 与 DNS_TTL 取较小值）
```

## 节点打分

评分公式（`apps/control/src/scheduler`）：

```text
score = clamp(weight, 0, 1000)
      + 5   （国家匹配）
      + 80  （省份匹配）
      + 20  （城市匹配）
      + 40  （ISP 匹配）
      - ⌊CPU% × 0.3⌋
      - ⌊内存% × 0.2⌋
```

示例：

```text
节点 A：weight 100，同省（+80），CPU 10%（-3）  → 177
节点 B：weight 200，仅同国（+5），CPU 60%（-18）→ 187
节点 C：weight 90，同省 + 同 ISP（+120）        → 210
→ 选择 C
```

节点需要配置：

| 字段 | 作用 |
| --- | --- |
| `public_ip` | 返回给客户端的 A 记录，为空则不参与调度 |
| `country` | ISO alpha-2，如 `CN` |
| `province` / `city` | 与地理库字段风格一致（如 `Guangdong` / `Shenzhen`） |
| `isp` | 运营商名称，如 `China Telecom` |
| `weight` | 基础分，0–1000 |
| `status` | `online` 参与；`offline`/`disabled`/`pending` 不参与 |
| `cpu_usage` / `memory_usage` | 心跳上报，用于负载惩罚 |

::: warning 地理覆盖字段是高权重输入
省（+80）与 ISP（+40）足以覆盖 CPU/内存惩罚。因此调度接口只允许持有全局 `AGENT_TOKEN` 的调用方传入 `country/province/city/isp` 覆盖值；未认证调用必须走真实 IP 解析，避免被用来把流量钉到指定节点。
:::

## GeoIP 数据

Control 读取（不是 DNS 读取）：

```ini
# control.env
GEOIP_PATH=/var/lib/lagran/ip2region_v4.xdb
GEOIP_IPV6_PATH=/var/lib/lagran/ip2region_v6.xdb
```

兼容的格式：

| 格式 | 变量 | 说明 |
| --- | --- | --- |
| ip2region XDB | `GEOIP_PATH` / `GEOIP_IP2REGION_PATH` | 推荐，含国家/省/市/ISP/ISO 代码 |
| V2Ray/Loyalsoldier `geoip.dat` | `GEOIP_DAT_PATH` | 仅国家维度 |
| 旧版 JSON | `GEOIP_JSON_PATH` | `[{cidr, country, province, city, isp}]` |

ip2region 记录字段风格：

```text
Country|Province|City|ISP|ISO-alpha2
```

文件缺失时，Control 会记录警告并退化为“仅按权重 + 负载”调度。

## 调度相关的 Control 配置

```ini
SCHEDULE_TTL=30              # 返回给 DNS 的 TTL
SCHEDULE_NODE_CACHE_SECS=5   # 缓存 edge_nodes 的秒数
EDGE_CNAME=cdn.edge.example.com   # 统一接入域名，展示/下发用
```

## DNS 侧缓存与降级

| 配置 | 默认 | 作用 |
| --- | --- | --- |
| `DNS_CACHE_SECS` | `30` | 调度结果缓存时间；也是调度变更的生效延迟上限 |
| `DNS_STALE_SECS` | `300` | Control 不可用时继续使用过期结果的最长时间 |
| `DNS_FALLBACK_IP` | 空 | 完全无缓存且调度失败时的兜底 A 记录，空则 SERVFAIL |
| `DNS_CONTROL_TIMEOUT_MS` | `800` | 调用 Control 的超时 |

::: tip 为什么不把 DNS_CACHE_SECS 调得很小
每个热域名每 `DNS_CACHE_SECS` 至少回源一次；多个 worker 同时未命中会打出多路并发调度请求。从 30 调到 5 意味着调用量约放大 6 倍，Control 慢时容易一起堵在读超时上。
:::

## 验证

```bash
# 直接问权威 DNS
dig @<dns-ip> cdn.example.com A +short

# 模拟不同地区（ECS）
dig @<dns-ip> cdn.example.com A +subnet=1.2.3.0/24 +short
dig @<dns-ip> cdn.example.com A +subnet=8.8.8.0/24 +short

# 直接看调度决策（全局 AGENT_TOKEN）
TOKEN=<全局 AGENT_TOKEN>
curl -sS -H "X-Lagran-Agent-Token: $TOKEN" \
  'http://<control>:8080/api/v1/schedule?domain=cdn.example.com&ip=1.2.3.4' | jq

# 管理员可用 /schedule/test 指定地理覆盖值，预览“钉到某节点”的效果
curl -sS -X POST -H "Authorization: Bearer <控制台 JWT>" -H 'content-type: application/json' \
  -d '{"domain":"cdn.example.com","ip":"1.2.3.4","province":"Guangdong","isp":"China Telecom"}' \
  'http://<control>:8080/api/v1/schedule/test' | jq
```

`/api/v1/schedule` 支持的查询参数：`domain`、`ip`、`subnet`，以及仅对全局令牌生效的 `country`、`province`、`city`、`isp` 覆盖值。

返回应为 Edge 公网 IP，而不是 DNS 服务器 IP。

## 常见问题

| 现象 | 检查 |
| --- | --- |
| 返回 DNS 服务器 IP | CNAME/NS/A 记录配置错误；Zone 未委派 |
| 总选同一个节点 | 权重差距过大；GeoIP 无匹配；该区域只有一个在线节点 |
| A 查询慢 | `DNS_CONTROL_TIMEOUT_MS`、Control 负载、`DNS_CACHE_SECS` 过小 |
| 双机结果不同 | 节点数据/GeoIP 版本/`CONTROL_URL` 不一致；本地缓存时间差 |
| 城市总不匹配 | ip2region 字段写法与节点 `city` 写法不一致（大小写/中英文） |
| 调度变更迟迟不生效 | `DNS_CACHE_SECS` + 下游递归 DNS TTL + 浏览器 DNS 缓存叠加 |
| 客户端 IP 被伪造 | Edge 侧 `TRUST_PROXY_HEADERS` 不要随意开启；调度只信 ECS/出口 IP |

完整链路（含每个步骤的报文细节）见 [GeoDNS 参考](/reference/geodns)。

