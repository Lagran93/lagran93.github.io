# 安全清单

## 必须

- [ ] `SEED_DEMO=false`
- [ ] `REQUIRE_SECURE_SECRETS=true`
- [ ] `JWT_SECRET` 至少 32 字节随机值
- [ ] `AGENT_TOKEN` 强随机，Control/Edge/DNS 一致
- [ ] 8082 管理口只允许 Control 来源
- [ ] PostgreSQL 不暴露公网
- [ ] 控制台强制 HTTPS
- [ ] 管理员启用强密码
- [ ] 定期备份数据库与证书
- [ ] 日志保留符合合规要求

## 建议

- 单独的系统用户运行服务
- 限制 `EnvironmentFile` 权限
- 配置 Caddy 安全头
- 开启 WAF / CC
- 为敏感路径启用签名 URL
- 使用 Origin 鉴权保护源站
- 配置防盗链
- 监控异常登录与审计日志
- 定期轮换 Token / 密钥

## 签名 URL

```text
域名 → 签名 URL
→ 设置密钥、路径、TTL
→ 生成带 sig 的 URL
```

参数不进入 cache key，避免每个签名生成一份缓存。

## Origin 鉴权

Edge 回源时注入：

```http
X-Origin-Auth: <secret>
```

源站校验后放行，防止绕过 CDN 直连。

## 防盗链

- Referer 白名单
- 签名 URL 作为热链绕过
- `x-lagran-hotlink-ok` 仅内部可信

## 不要做

- 不要把管理口暴露公网
- 不要在日志打印 Token / Cookie / 密码
- 不要使用演示密钥
- 不要忽略证书校验
- 不要给所有路径开启“忽略 Query”
