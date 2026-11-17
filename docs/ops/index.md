# 运维总览

## 日常检查

```bash
systemctl status lagran-control lagran-edge lagran-dns --no-pager

# 控制面
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8080/ready

# 边缘管理口
curl -fsS http://127.0.0.1:8082/__lagran/health

# 数据面（应出现 X-Cache 头）
curl -sD - -o /dev/null -H 'Host: cdn.example.com' http://127.0.0.1:8081/
```

## 关键指标

| 类别 | 指标 |
| --- | --- |
| 流量 | 请求量、带宽、状态码分布 |
| 缓存 | 命中率、L1/L2/L3 命中、`X-Lagran-Cache-Reason` 分布 |
| 大缓存 | `used/available` 字节、填充丢弃/拒绝、fs 预留水位 |
| 回源 | 回源错误率、超时、源站健康、failover 次数 |
| 节点 | 在线数、CPU/内存、版本号、最后心跳时间 |
| 安全 | WAF 命中、CC 封禁、质询通过率 |
| 可用性 | 证书到期时间、告警 firing 数 |

## 日志

| 日志 | 位置 | 说明 |
| --- | --- | --- |
| 服务日志 | `journalctl -u lagran-*` | 启动、迁移、同步、错误 |
| 访问日志 | 控制台「访问日志」 | Edge 批量上报，保留 `LOG_RETENTION_DAYS` 天 |
| 登录日志 | 控制台「登录日志」 | 登录成功/失败、IP、UA |
| 操作审计 | 控制台「操作审计」 | 配置变更、发布、节点操作 |
| WAF 事件 | 控制台「WAF 防护 → 事件」 | 命中规则、动作、客户端 IP |

## 推荐巡检节奏

```text
每日：服务状态、5xx/回源超时、证书到期、节点在线、告警是否有新增
每周：缓存命中率趋势、大缓存水位与 fill 丢弃、磁盘使用、备份是否成功
每月：版本升级、密钥轮换（JWT/AGENT/CHALLENGE/WAF_RULEPACK）、告警演练、恢复演练
```

## 变更操作清单

| 操作 | 风险 | 前置动作 |
| --- | --- | --- |
| 升级 Control | 中（数据库迁移） | `pg_dump` 备份 |
| 升级 Edge | 低（可逐台） | 确认 `NODE_ID`/令牌未被覆盖 |
| 修改缓存规则 | 中 | 先看规则测试，必要时刷新缓存 |
| 修改 WAF 规则集 | 高（可能误杀） | 先用观察模式 |
| 轮换 `WAF_RULEPACK_SECRET` | 中 | Control 与所有 Edge 同步修改 |
| 轮换 `CHALLENGE_SECRET` | 中 | 所有 Edge 同时重启 |
| 启用 Shield | 中 | 先设置 `EDGE_SHIELD_DISABLED=true` |

## 相关页面

- [监控与健康检查](/ops/monitoring)
- [备份与恢复](/ops/backup)
- [故障排查](/ops/troubleshooting)
- [安全清单](/ops/security)

