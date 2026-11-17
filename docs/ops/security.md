# 安全清单

## 上线前必须完成

- [ ] `SEED_DEMO=false`，且已确认数据库里没有演示账号
- [ ] `REQUIRE_SECURE_SECRETS=true`
- [ ] `JWT_SECRET` 为 32 字节以上随机值（`openssl rand -hex 32`）
- [ ] `AGENT_TOKEN` 为强随机值，只在 Control 与 DNS 之间共享
- [ ] **每个 Edge 使用独立节点令牌**，不复用全局 `AGENT_TOKEN`
- [ ] `WAF_RULEPACK_SECRET` 已配置，Control 与所有 Edge 一致
- [ ] `CHALLENGE_SECRET` 已配置，所有 Edge 一致
- [ ] `ALLOW_REGISTER=false`（首个管理员创建完成之后）
- [ ] `8082` 管理口只允许 Control 来源访问，`AGENT_URL` 使用内网地址
- [ ] Control `8080` 只暴露给反向代理
- [ ] PostgreSQL 不暴露公网，远程连接使用 `sslmode=require`
- [ ] `/metrics` 配置了 `METRICS_TOKEN`（或 `AGENT_TOKEN`），且只从内网抓取
- [ ] 控制台强制 HTTPS，反向代理设置安全响应头
- [ ] 环境文件权限 `0600`，属主为服务用户
- [ ] 管理员账号使用强密码并启用验证码（`CAPTCHA_ENABLED=true`）
- [ ] 已配置数据库与 `/etc/lagran` 备份，并做过一次恢复演练
- [ ] 日志保留策略符合合规要求（`LOG_RETENTION_DAYS`）

## 推荐加固

### 网络

```text
公网：443（业务 + 控制台）、80（ACME/跳转）、53（DNS）
内网：8082（Edge 管理口）、5432、6379
仅本机：8080
```

- Edge 管理口用安全组/iptables 限定来源
- 不要给 `EDGE_ADMIN_LISTEN` 配 `0.0.0.0`
- Shield 内部地址不要暴露公网

### 密钥轮换

| 密钥 | 轮换方式 | 影响 |
| --- | --- | --- |
| `JWT_SECRET` | 修改后重启 Control | 所有用户需重新登录 |
| `AGENT_TOKEN` | Control 与 DNS 同步修改 | DNS 调度短暂失败 |
| `WAF_RULEPACK_SECRET` | 先改 Control 与所有 Edge，再重启 Control | 规则包自动重新签名 |
| `CHALLENGE_SECRET` | 所有 Edge 同时修改并重启 | 已通过的质询需要重新验证 |
| 节点令牌 | 控制台重置该节点令牌并更新 `edge.env` | 该节点短时离线 |

### 控制台与 API

- 配置 `CORS_ALLOWED_ORIGINS` 收窄跨域（留空为宽松回显）
- 控制台使用 Bearer token（localStorage），`/api/*` 必须由反代保护并强制 HTTPS
- 依赖用户组限制模块权限，不要给所有人 `settings:write` 或 `user:write`
- 定期检查「操作审计」与「登录日志」中的异常

### 业务防护

- 新域名先开启 WAF 观察模式，再切拦截
- 敏感路径启用签名 URL
- 源站只接受 Edge 的回源鉴权 Header（拒绝直连）
- 防盗链配置 Referer 白名单，必要时开启签名
- 静态资源目录单独配置规则，避免被 `Cookie`/`Authorization` 绕过缓存
- CC 与限流配置跨节点 Redis 共享，避免单节点阈值被轮询绕过

## 签名 URL

```text
域名设置 → 签名 URL 防护
→ 保护范围（全部路径 / 指定路径）
→ 签名有效期上限
→ 生成签名密钥
→ 在业务侧生成带 expires + signature 的 URL
```

校验方式：

```text
规范化串 = METHOD \n host \n path \n 去签名参数并排序的 query \n expires
签名     = HMAC-SHA256(secret, 规范化串)
参数     = ?expires=<unix>&signature=<hex>（也接受 sig）
```

- 签名参数在到达缓存/源站前被移除，**不进入 Cache Key**
- 失败原因写入 `X-Lagran-Cache-Reason`：`signed-url-missing` / `signed-url-expired` / `signed-url-invalid` / `signed-url-config`
- 支持轮换：新旧密钥同时有效，切换后删除旧密钥

## 回源鉴权

Edge 回源时注入域名配置的 Header：

```ini
# 域名设置 → 回源
回源鉴权 Header = x-origin-token
回源鉴权值      = <只在服务端保存，不回显>
```

源站校验后放行，防止绕过 CDN 直连源站。该 Header 不会返回给客户端；客户端伪造的同名 Header 会被移除。

## 防盗链

| 方式 | 说明 |
| --- | --- |
| Referer 白名单 | `example.com,*.example.com`，留空关闭 |
| 签名 URL | 带签名的请求视为合法热链 |
| `x-lagran-hotlink-ok` | **内部标记**，由 Edge 校验签名后设置；客户端伪造会被剥离 |

## 不要做

- 不要把所有域名都设为「忽略 Query」（容易缓存到带 token 的越权内容）
- 不要让源站接受任意 `Host` 与任意来源
- 不要在日志中打印 Token、Cookie、私钥或回源鉴权值
- 不要使用示例/默认密钥，不要跳过证书校验
- 不要为了省事关闭 `REQUIRE_SECURE_SECRETS`
- 不要在没有观察期的情况下直接启用高安全级别或行为评分

## 应急

| 场景 | 处置 |
| --- | --- |
| 密钥泄露 | 立即轮换对应密钥；强制所有用户重新登录；检查审计日志 |
| 被刷流量 | 临时切「攻击中」安全级别 + 收紧限流 + 封禁网段；必要时下线该域名 |
| 源站被打 | 源站只放行 Edge 回源 IP，开启回源鉴权，启用 Shield 汇聚 |
| 配置误发布 | 配置发布回滚；必要时全站刷新 |
| 节点被入侵 | 控制台停用节点 → 重置令牌 → 重装系统与 Edge |

