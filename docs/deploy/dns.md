# 部署 DNS

`lagran-dns` 是可选组件，用于 GeoDNS 调度。不部署 DNS 时，域名可以直接 CNAME 到 Edge。

## 1. 架构

```text
用户 DNS
  → 业务域名 CNAME 到 Zone
  → lagran-dns 权威解析
  → 查询 Control 调度接口
  → 返回评分最高的 Edge A 记录
```

## 2. 安装

```bash
curl -fsSL https://raw.githubusercontent.com/Lagran93/Lagran/main/install.sh \
  | sudo env LAGRAN_REPO=Lagran93/Lagran bash -s -- dns
```

## 3. GeoIP 数据

使用 ip2region XDB：

```bash
sudo mkdir -p /var/lib/lagran

sudo wget -O /var/lib/lagran/ip2region_v4.xdb \
  https://raw.githubusercontent.com/lionsoul2014/ip2region/master/data/ip2region_v4.xdb

# 可选
sudo wget -O /var/lib/lagran/ip2region_v6.xdb \
  https://raw.githubusercontent.com/lionsoul2014/ip2region/master/data/ip2region_v6.xdb
```

## 4. 配置

```bash
sudoedit /etc/lagran/dns.env
```

关键项：

```ini
DNS_LISTEN=0.0.0.0:8053
CONTROL_URL=http://<control-ip>:8080
AGENT_TOKEN=<与 Control 一致>
GEOIP_PATH=/var/lib/lagran/ip2region_v4.xdb
GEOIP_IPV6_PATH=/var/lib/lagran/ip2region_v6.xdb
```

## 5. 启动

```bash
sudo systemctl enable --now lagran-dns
sudo systemctl status lagran-dns --no-pager
```

## 6. 委派与 NS

1. 在域名注册商创建 glue 记录，指向 DNS 服务器 IP。
2. 将业务 Zone 的 NS 改为这些 DNS 服务器。
3. 业务域名 CNAME 到 Zone 中的一个名称。
4. 等待 TTL 生效。

## 7. 测试

```bash
dig @<dns-ip> -p 8053 cdn.example.com A
dig @<dns-ip> -p 8053 cdn.example.com A +short
```

返回应为 Edge 公网 IP，而不是 DNS 服务器 IP。

## 8. 双机

建议至少两台 DNS：

- 相同 Zone 配置；
- 相同 GeoIP 数据；
- 相同 Control 地址与 Token；
- NS 同时注册两台；
- 定期比对解析结果。

## 9. 降级

| 情况 | 行为 |
| --- | --- |
| Control 不可用 | 使用本地/缓存调度或降级 |
| 没有在线节点 | 返回失败/ SERVFAIL，按实现 |
| ECS 缺失 | 使用递归 DNS 出口 IP |
| GeoIP 无匹配 | 按国家/默认权重调度 |
| 节点 public_ip 为空 | 不参与调度 |
| 节点 offline | 不参与调度 |
| 单台 NS 不可达 | 递归 DNS 切换另一台 |

详细流程见 [GeoDNS](/use/geodns) 与 [完整流程](/reference/geodns)。
