# 监控与健康检查

## 健康检查端点

| 端点 | 组件 | 说明 |
| --- | --- | --- |
| `GET /health` | Control | 进程存活，返回版本号 |
| `GET /ready` | Control | 数据库可用 |
| `GET /metrics` | Control | Prometheus 文本，**需要令牌** |
| `GET /__lagran/health` | Edge 管理口 | 进程存活 |
| `GET /__lagran/metrics` | Edge 管理口 | Prometheus 文本 |

```bash
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8080/ready

# Control 指标：METRICS_TOKEN 优先，未配置时回退 AGENT_TOKEN
curl -fsS -H "X-Lagran-Metrics-Token: $METRICS_TOKEN" http://127.0.0.1:8080/metrics

# Edge 指标
curl -fsS -H "X-Lagran-Agent-Token: $AGENT_TOKEN" http://127.0.0.1:8082/__lagran/metrics
```

::: warning `/metrics` 会泄露租户信息
控制面 `/metrics` 会输出所有域名的名称、源站 URL 与节点清单。现在要求 `METRICS_TOKEN`（未配置时回退 `AGENT_TOKEN`），支持 `X-Lagran-Metrics-Token`、`X-Lagran-Agent-Token` 与 `Authorization: Bearer`。

代码在**两个令牌都为空时不做校验**（保持本机可用）。因此生产环境至少要配置其中一个令牌，并且只让监控系统从内网访问该端口。
:::

## Control 指标

```text
lagran_control_up                     进程存活
lagran_control_info{version=...}      构建版本
lagran_control_db_up                  数据库可达
域名/节点按状态分组计数
逐源站健康与连续失败次数
证书到期时间戳
24h 请求/命中率/WAF 事件
当前 firing 的告警与启用中的通知渠道
```

## Edge 指标

按域名分组：

```text
lagran_edge_up
lagran_edge_domains
lagran_edge_requests_total{domain="..."}
lagran_edge_cache_hits_total{domain="..."}
lagran_edge_cache_misses_total{domain="..."}
lagran_edge_bytes_sent_total{domain="..."}
```

数据面与回源：

```text
lagran_edge_datapath_pingora_total
lagran_edge_datapath_legacy_total
lagran_edge_downstream_cancels_total
lagran_edge_origin_timeouts_total
lagran_edge_origin_errors_total
lagran_edge_origin_stream_requests_total
lagran_edge_origin_stream_bytes_total
lagran_edge_origin_stream_errors_total
```

大对象 / Range：

```text
lagran_edge_chunk_requests_total
lagran_edge_chunk_origin_runs_total
lagran_edge_chunk_fallbacks_total
lagran_edge_chunk_fill_drops_total
lagran_edge_chunk_fill_dropped_bytes_total
lagran_edge_chunk_fill_drop_queue_total
lagran_edge_chunk_fill_drop_budget_total
lagran_edge_chunk_fill_drop_send_total
lagran_edge_chunk_fill_rejects_total
lagran_edge_chunk_fill_rejected_bytes_total
lagran_edge_chunk_origin_attempts_total
lagran_edge_chunk_origin_failures_total
```

大缓存水位：

```text
lagran_large_cache_used_bytes                   已提交 + 预留
lagran_large_cache_available_bytes              准入余量
lagran_large_cache_capacity_bytes               配置容量
lagran_large_cache_fs_reserved_bytes            进行中写入的预留
lagran_large_cache_min_free_bytes               MIN_FREE 配置值（不是预留）
lagran_large_cache_fs_available_bytes           文件系统可用字节
lagran_large_cache_fs_admission_headroom_bytes  扣除预留与 MIN_FREE 后的余量
```

### 如何解读 fill drop 与 fill reject

| 指标 | 含义 |
| --- | --- |
| `chunk_fill_drops_total` | 已进入写队列、随后被丢弃的分片数 |
| `chunk_fill_dropped_bytes_total` | 实际丢弃的字节（确实从源站读了） |
| `chunk_fill_drop_queue_total` | 因**单 fill 队列**上限丢弃 |
| `chunk_fill_drop_budget_total` | 因**进程预算**丢弃 |
| `chunk_fill_rejects_total` | 在写入前就被拒绝的 fill 数量 |
| `chunk_fill_rejected_bytes_total` | 被拒绝 fill 的**计划**字节数（并不代表已读取/浪费） |

如果 `drop_budget` 持续增长，说明 `LARGE_CACHE_FILL_QUEUE_TOTAL_BYTES` 偏小或磁盘过热；`rejects` 增长更像容量或文件系统预留触顶。

## 关键响应头

| 头 | 说明 |
| --- | --- |
| `X-Powered-By` | `lagran-edge` |
| `X-Cache` | `HIT` / `MISS` / `BYPASS` / `STALE` |
| `X-Cache-Status` | 与 `X-Cache` 相同的兼容头 |
| `X-Lagran-Cache-Reason` | 未命中/绕过原因 |
| `Age` | 已存活秒数 |
| `X-Lagran-Cache-TTL` | 剩余新鲜秒数 |
| `X-Lagran-Datapath` | `pingora` / `legacy` |
| `x-lagran-waf` / `x-lagran-waf-rule` | WAF 拦截时出现 |
| `x-lagran-cc` | CC 拦截/质询时出现 |
| `x-lagran-error` | 结构化错误码，如 `WAF_BLOCKED` |

## 日志

```bash
journalctl -u lagran-control -f
journalctl -u lagran-edge -f
journalctl -u lagran-dns -f

# 只看错误
journalctl -u lagran-edge -p err -n 100 --no-pager
```

Edge 访问日志默认缓冲后批量上报；本地 `ACCESS_LOG_JSON=true` 可改为 JSON 行以便采集。

## 链路追踪

```ini
# control.env
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318   # 自动追加 /v1/traces
OTEL_SERVICE_NAME=lagran-control
OTEL_TRACES_SAMPLER_ARG=1.0
```

未配置时完全关闭，不产生导出开销。

## 告警

控制台「告警中心」：

```text
告警中心 → 规则 / 通知渠道 / 事件
```

| 通知渠道 | 说明 |
| --- | --- |
| SMTP | 邮件 |
| Webhook | 支持 HMAC-SHA256 签名校验 |
| Telegram | 支持自定义 Bot API 地址与代理 |

评估周期为 `ALERT_EVAL_SECS`（默认 30 秒）。同一规则 + 对象只保留一条 `firing` 事件，恢复后更新为 `resolved`。

建议至少配置：

- 节点离线（超过 N 个心跳周期未上报）
- 源站健康连续失败
- 证书 30 天内到期
- 5xx / 回源超时突增
- 缓存命中率显著下降
- WAF/CC 事件突增
- 大缓存 fs 余量不足 / fill reject 激增

## 大屏与统计

- 「统计分析」：按域名/节点、时间序列、汇总
- 「大屏监控」：独立全屏布局，每 10 秒刷新，适合值班室
- 「访问日志」：按域名/状态码/时间筛选，支持导出 CSV

