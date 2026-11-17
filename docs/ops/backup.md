# 备份与恢复

## 必须备份的内容

| 内容 | 为什么 | 频率 |
| --- | --- | --- |
| PostgreSQL | 域名、规则、WAF、证书元数据、配置版本、节点、统计、审计 | 每日（或按 RPO） |
| `/etc/lagran/*.env` | 数据库地址、JWT/AGENT/WAF/CHALLENGE 密钥 | 变更后立即 |
| `/var/lib/lagran/certs` | 上传/ACME 证书私钥（若数据库里有副本也可不备份） | 每日 |
| GeoIP 数据 | `ip2region_*.xdb`、`GeoLite2-*.mmdb` | 更新后 |
| 反向代理配置 | Caddyfile / Nginx 站点配置 | 变更后 |

**不需要**备份：

```text
/var/lib/lagran/cache           普通缓存
/var/lib/lagran/large-cache     大对象缓存
/var/lib/lagran/*.status        升级状态（恢复旧状态反而会阻塞升级）
```

缓存可以重新预热，大对象缓存可以丢弃后自然重建。

## PostgreSQL

```bash
# 自定义格式，支持并行恢复
pg_dump "$DATABASE_URL" -Fc -f /backup/lagran-$(date +%F).dump

# 纯 SQL 备份（便于人工检查）
pg_dump "$DATABASE_URL" -f /backup/lagran-$(date +%F).sql
```

恢复：

```bash
pg_restore -d "$DATABASE_URL" --clean --if-exists -j 4 /backup/lagran-YYYY-MM-DD.dump
```

::: warning 恢复后要重启 Control
`sqlx` 迁移在启动时执行。恢复后重启 `lagran-control`，并用 `/ready` 确认数据库连接正常，再让 Edge 重新拉取配置。
:::

## 文件

```bash
sudo tar -czf /backup/lagran-etc-$(date +%F).tar.gz \
  /etc/lagran \
  /var/lib/lagran/certs \
  /var/lib/lagran/ip2region_v4.xdb \
  /var/lib/lagran/ip2region_v6.xdb \
  /var/lib/lagran/maxmind
```

权限要求：备份文件包含私钥与签名密钥，**必须加密或至少 `0600`**，并限制上传路径。

```bash
chmod 600 /backup/lagran-*.tar.gz
```

## 恢复顺序

```text
1. 安装同版本二进制（install.sh control / edge / dns）
2. 恢复 /etc/lagran（含密钥，必须与备份时一致）
3. 恢复 PostgreSQL
4. 恢复证书与 GeoIP
5. 启动 Control，确认 /health 与 /ready
6. 启动 Edge，确认节点 online
7. 启动 DNS，验证解析
8. 验收：域名、规则、证书、刷新、调度
```

::: danger 密钥必须成套恢复
如果数据库里保存的会话/规则包与恢复的 `JWT_SECRET`、`WAF_RULEPACK_SECRET` 不匹配：

- 所有用户需要重新登录（JWT 失效）
- Edge 会拒绝签名规则包，托管 WAF 规则不生效

因此 `/etc/lagran` 要与数据库一起恢复，或者同时轮换所有相关密钥并重新发布规则包。
:::

## 灾备演练建议

```text
每季度：
1. 在隔离环境用最新备份恢复一次
2. 验证登录、域名列表、规则、证书、节点心跳
3. 验证一次刷新与预热
4. 记录实际 RTO，修正文档
```

## 注意事项

- 配置发布版本保存在数据库中，恢复数据库后 `published_version_id` 一并恢复
- Edge 大缓存是节点本地状态，恢复后处于冷启动，建议对热点 URL 预热
- 不要恢复 `update.request` / `edge-update.request`，否则会阻塞后续升级（409）
- 备份文件要跨机房/跨账号存放，避免与本机一起损坏

