# 证书管理

证书管理负责业务域名的 HTTPS 证书：上传、ACME 签发、下发 Edge 与自动续期。Edge 侧的启用方式见 [HTTPS 与证书](/deploy/tls)。

## 证书列表

```text
证书管理 → 列表
```

| 列 | 说明 |
| --- | --- |
| 域名 | 证书覆盖的域名（含 SAN） |
| 来源 | `upload`（上传）/ `letsencrypt` / `letsencrypt-staging` / `dev` |
| 到期时间 | 临近到期会高亮，并由告警规则提醒 |
| 状态 | 是否已启用、是否已下发 |
| 操作 | 查看、删除、重新下发 |

## 上传证书

```text
证书管理 → 上传证书
域名 → 证书 PEM（包含中间证书链）→ 私钥 PEM → 保存
```

要求：

- PEM 格式，证书与私钥必须匹配
- 证书链要包含中间证书，否则部分 Android/旧客户端会报错
- 支持通配符证书（`*.example.com`），Edge 按 SNI 匹配

保存后：

```text
Control 保存证书
→ 推送到在线 Edge：POST /__lagran/certs/load
→ Edge 热加载（无需重启）
→ 离线节点在下次 GET /api/v1/certs/edge-sync 时拉取
```

## ACME 申请

```text
证书管理 → 申请证书 → 域名 → provider
```

| provider | 用途 |
| --- | --- |
| `letsencrypt-staging` | 联调，避免生产速率限制 |
| `letsencrypt` | 生产签发 |
| `dev` | 本地自签，仅用于开发 |

前置条件：

1. 域名已接入并解析到 Edge
2. Edge 的 80 端口可达（ACME HTTP-01）
3. 源站/域名未被其他 CDN 前置拦截

流程：

```text
Control 生成 challenge 并下发到在线 Edge
→ Let's Encrypt 访问 http://<域名>/.well-known/acme-challenge/<token>
→ Edge 直接响应
→ 验证通过 → 签发 → 保存 → 下发 Edge
```

Control 会定期检查到期时间并自动续期，续期使用同一 provider。

## 证书轮换

```text
1. 上传新证书（保留旧证书）
2. 在域名设置中切换绑定
3. openssl s_client 确认已返回新证书
4. 观察 24 小时后删除旧证书
```

::: warning 不要直接覆盖在用证书
直接删除正在使用的证书会导致该域名 HTTPS 不可用，直到新证书下发完成。
:::

## 验证

```bash
curl -I https://cdn.example.com/
openssl s_client -connect cdn.example.com:443 -servername cdn.example.com </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
```

检查域名、SAN、有效期与证书链。

## 常见问题

| 现象 | 排查 |
| --- | --- |
| 证书未生效 | Edge 是否收到 `certs/load`；节点是否在线；是否已配置 `EDGE_HTTPS_LISTEN` |
| SNI 返回错误证书 | 域名与 SAN 不匹配；同节点上存在更具体的证书 |
| ACME 失败 | 80 端口不可达；域名未指向 Edge；DNS 未生效；生产速率限制 |
| 浏览器证书告警 | 证书链不完整；上传了错误域名的证书；系统时间偏差 |
| 证书过期 | 检查自动续期日志；告警规则是否配置 |
| 重新下发无效 | 该节点管理口不可达；检查 `AGENT_URL` 与防火墙 |

