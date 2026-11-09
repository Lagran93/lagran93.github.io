# 监控与健康检查

## Control

```bash
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8080/ready
curl -fsS http://127.0.0.1:8080/metrics
```

## Edge 管理口

```bash
curl -fsS http://127.0.0.1:8082/__lagran/health
```

只允许 Control 来源访问。

## Edge 数据面

```bash
curl -fsS -H 'Host: cdn.example.com' http://127.0.0.1:8081/
curl -fsS -H 'Host: cdn.example.com' https://cdn.example.com/
```

## 响应头

| 头 | 说明 |
| --- | --- |
| `x-lagran-datapath` | `pingora` / `legacy` |
| `x-cache` | `HIT` / `MISS` / `STALE` / `REVALIDATED` |
| `x-lagran-cache-source` | `l1` / `l2` / `l3` / `origin` |
| `x-lagran-cache-lookup-ms` | 查找耗时 |
| `x-lagran-cache-ttl` | 剩余 TTL |
| `server-timing` | 缓存耗时 |

## 日志

```bash
journalctl -u lagran-control -f
journalctl -u lagran-edge -f
journalctl -u lagran-dns -f
```

## 告警

控制台：

```text
告警中心 → 规则 / 通知渠道 / 事件
```

支持 SMTP、Webhook、Telegram。

建议至少配置：

- 节点离线
- 源站健康失败
- 证书即将到期
- 5xx 激增
- 缓存命中率下降
- WAF/CC 突增
