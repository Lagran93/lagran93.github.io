# 运维总览

## 日常检查

```bash
systemctl status lagran-control lagran-edge lagran-dns --no-pager
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8082/__lagran/health
```

## 关键指标

- 请求量 / 带宽
- 缓存命中率
- L1/L2/L3 命中
- 源站错误率
- 5xx / 504
- 节点在线数
- 证书到期
- WAF / CC 事件
- 预热失败

## 日志

| 日志 | 位置 |
| --- | --- |
| Control | journalctl / 文件 |
| Edge | journalctl / 文件 |
| 访问日志 | 控制台或 Edge 日志 |
| 登录日志 | 控制台 |
| 操作审计 | 控制台 |

## 推荐巡检

```text
每日：服务状态、5xx、证书、节点在线
每周：缓存命中率、大缓存空间、备份
每月：升级、密钥轮换、告警演练
```

## 相关页面

- [监控与健康检查](/ops/monitoring)
- [备份与恢复](/ops/backup)
- [故障排查](/ops/troubleshooting)
- [安全清单](/ops/security)
