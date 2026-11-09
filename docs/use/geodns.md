# GeoDNS 调度

## 目标

根据客户端 IP 的地理位置，选择距离最近、线路匹配、负载较低的 Edge 节点。

## 参与组件

```text
lagran-dns
lagran-control 调度接口
ip2region XDB
edge_nodes 节点数据
```

## 流程

```text
用户 DNS
→ 业务域名 CNAME 到 Zone
→ lagran-dns 权威查询
→ 构造调度 cache key
→ 调用 Control /schedule
→ Control 解析 GeoIP
→ 过滤在线节点
→ 打分
→ 返回 A 记录
```

## 节点打分

```text
weight
+ 国家匹配
+ 省份匹配
+ 城市匹配
+ ISP 匹配
- CPU 负载
- 内存负载
```

节点需要配置：

- 公网 IP
- 国家（ISO alpha-2）
- 省 / 市
- ISP
- 权重
- 在线状态

## GeoIP

默认：

```ini
GEOIP_PATH=/var/lib/lagran/ip2region_v4.xdb
GEOIP_IPV6_PATH=/var/lib/lagran/ip2region_v6.xdb
```

ip2region 数据字段：

```text
Country|Province|City|ISP|ISO-alpha2
```

兼容旧的 `Country|Region|Province|City|ISP` 与四段格式。

## 降级

- Control 不可用：本地缓存/默认节点。
- 没有在线节点：返回失败。
- GeoIP 无匹配：按权重。
- ECS 缺失：使用递归 DNS 出口 IP。
- 单台 NS 不可达：切换另一台。

## 验证

```bash
dig @<dns-ip> -p 8053 cdn.example.com A +short
```

返回应为 Edge 公网 IP，不是 DNS 服务器 IP。

## 常见问题

| 现象 | 检查 |
| --- | --- |
| 返回 DNS IP | CNAME/NS/A 记录配置错误 |
| 调度总选一个节点 | 权重、GeoIP、优先级 |
| A 查询慢 | 上游 Control 超时、缓存未命中 |
| 双机结果不同 | 节点数据、GeoIP 版本、配置 |
| 城市不匹配 | ip2region 数据字段、节点字段 |

完整流程见 [GeoDNS 参考](/reference/geodns)。
