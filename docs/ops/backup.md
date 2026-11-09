# 备份与恢复

## 必须备份

```text
PostgreSQL
/etc/lagran/*.env
/var/lib/lagran 中的证书、GeoIP、更新状态
Caddy 配置与证书
```

缓存目录通常不需要备份，可以重新预热。

## PostgreSQL

```bash
pg_dump "$DATABASE_URL" -Fc -f /backup/lagran-$(date +%F).dump
```

恢复：

```bash
pg_restore -d "$DATABASE_URL" --clean --if-exists /backup/lagran-YYYY-MM-DD.dump
```

## 文件

```bash
tar -czf /backup/lagran-etc-$(date +%F).tar.gz \
  /etc/lagran /var/lib/lagran/certs /var/lib/lagran/ip2region_v4.xdb
```

## 恢复顺序

```text
1. 安装同版本二进制
2. 恢复 /etc/lagran
3. 恢复 PostgreSQL
4. 恢复证书 / GeoIP
5. 启动 Control
6. 启动 Edge
7. 启动 DNS
8. 验收
```

## 注意

- 配置发布版本在数据库中，恢复数据库后生效。
- Edge 大缓存可以丢弃，重新预热。
- 更新助手状态文件不要随意恢复。
- 备份文件要加密并限制权限。
