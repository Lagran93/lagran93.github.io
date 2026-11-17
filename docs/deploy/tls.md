# HTTPS 与证书

## 证书来源

| 方式 | 适用 | 说明 |
| --- | --- | --- |
| 控制台 ACME（Let's Encrypt） | 单域名，80 端口可达 | HTTP-01；控制面把 challenge 下发到在线 Edge |
| 控制台上传 | 已有证书、通配符、企业证书 | 上传 PEM 后下发到 Edge |
| `dev` 自签 | 本地调试 | `provider: dev`，浏览器会告警 |
| 前置代理（Caddy/Nginx） | 控制台域名 | 只保护控制台，不保护业务域名 |

业务域名的 TLS 由 **Edge 自己终止**；控制台的 TLS 由前置代理负责。两者互不替代。

## 启用 Edge HTTPS

HTTPS 监听默认**关闭**，必须显式配置：

```ini
# /etc/lagran/edge.env
EDGE_HTTPS_LISTEN=0.0.0.0:443
# 可选：跳转端口；留空时从 EDGE_HTTPS_LISTEN 推导，443 时省略端口
# EDGE_HTTPS_REDIRECT_PORT=443
CERT_DIR=/var/lib/lagran/certs
```

```bash
sudo systemctl restart lagran-edge
ss -lntp | grep -E ':443|:8081'
```

- 证书从 `CERT_DIR` 加载，按 SNI 匹配，支持通配符
- 新证书到达后**热加载**，不需要重启
- 域名在控制台开启 HTTPS 后，Edge 在 WAF/缓存之前返回 301/308 跳转

## 控制台上传证书

```text
证书管理 → 上传证书
→ 填写域名（可多个 SAN）
→ 证书 PEM（包含中间证书链）
→ 私钥 PEM
→ 保存
```

保存后 Control 会把证书推送到在线 Edge（`POST /__lagran/certs/load`）；未在线的节点会在下次 `GET /api/v1/certs/edge-sync` 时拉取。

## ACME 签发

```text
证书管理 → 申请证书 → 填写域名 → 选择 provider
provider: letsencrypt | letsencrypt-staging | dev
```

流程：

```text
1. Control 生成 challenge，下发到所有在线 Edge：PUT /__lagran/acme/challenge
2. Let's Encrypt 从公网访问 http://<域名>/.well-known/acme-challenge/<token>
3. Edge 直接响应（Pingora 处理，不经过缓存/回源）
4. 验证通过后签发证书，保存到 certificates 表并推送到 Edge
5. Control 定期检查到期时间并自动续期
```

要求：

- 域名 A/CNAME 已经指向 Edge，且 80 端口可达
- Edge 的 80 端口必须能收到该 Host 的请求（如使用 8081 做 HTTP，需在前置 LB 上把 80 → 8081）
- 生产有速率限制：先用 `letsencrypt-staging` 打通，再切 `letsencrypt`

::: tip 控制台自身的证书
`console.example.com` 的 ACME challenge 由 Control 的 `/.well-known/acme-challenge/:token` 响应，需要在反代中把该路径转发到 `127.0.0.1:8080`（见[部署 Control](/deploy/control#6-前端-反向代理)）。Caddy 也可以直接为控制台自动签发。
:::

## HTTP → HTTPS

```ini
EDGE_HTTPS_LISTEN=0.0.0.0:443
EDGE_HTTPS_REDIRECT_PORT=443
```

跳转只在**域名开启 HTTPS** 后生效，且发生在 WAF 与缓存之前，因此不会导致 POST 被缓存。

## 证书轮换

1. 提前上传新证书（不要直接覆盖正在使用的证书）
2. 在域名设置中切换到新证书
3. 用 `openssl s_client` 确认已返回新证书
4. 观察 24 小时后再删除旧证书

## 验证

```bash
curl -I https://cdn.example.com/
openssl s_client -connect cdn.example.com:443 -servername cdn.example.com </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
```

检查：

- SNI 返回对应域名的证书（不是默认证书）
- 证书链完整（缺中间证书会导致部分 Android/旧客户端失败）
- 到期时间与自动续期
- `X-Cache` 头正常出现（说明请求已进入数据面）

## 故障

| 现象 | 原因 / 处理 |
| --- | --- |
| 443 拒绝连接 | 未设置 `EDGE_HTTPS_LISTEN`，或端口被前置代理占用 |
| 证书不存在 / 默认证书 | 证书未下发；节点离线期间未同步；域名与 SAN 不匹配 |
| ACME 失败 | 80 端口不可达、域名未指向 Edge、DNS 未生效、速率限制 |
| 签发成功但浏览器告警 | 证书链不完整、上传了错误域名的证书 |
| 上传后仍是旧证书 | Edge 未收到 `certs/load` 且未到 30 秒轮询；检查管理口连通性 |
| 质询（challenge）循环 | `CHALLENGE_SECRET` 在各节点不一致，或 HTTPS 下 Cookie 被代理改写 |

