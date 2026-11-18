# 部署 Control

Control 是配置与数据中心：PostgreSQL、API、认证与权限、配置发布、证书、预热与告警。它不转发业务流量。

## 1. 数据库

安装器默认会在本机 PostgreSQL 上创建角色与数据库。手工创建时：

```sql
CREATE USER lagran WITH PASSWORD 'change-me';
CREATE DATABASE lagran OWNER lagran;
```

```ini
DATABASE_URL=postgres://lagran:change-me@127.0.0.1:5432/lagran
```

密码含 `@`、`:`、`/` 等字符时需要 URL 编码（`@` → `%40`）。远程数据库建议加 `?sslmode=require`。

::: tip 已有数据库
传入 `LAGRAN_DATABASE_URL` 可跳过建库：

```bash
sudo env LAGRAN_REPO=Lagran93/Lagran \
  LAGRAN_DATABASE_URL='postgres://lagran:pass@127.0.0.1:5432/lagran' \
  bash -s -- control < install.sh
```
:::

## 2. 安装

```bash
curl -fsSL https://raw.githubusercontent.com/Lagran93/Lagran/main/install.sh \
  | sudo env LAGRAN_REPO=Lagran93/Lagran bash -s -- control
```

安装内容：

```text
/opt/lagran/bin/lagran-control
/opt/lagran/bin/lagran-update              # root 更新助手
/etc/lagran/control.env
/etc/systemd/system/lagran-control.service
/etc/systemd/system/lagran-update.path     # 监听 update.request
/etc/systemd/system/lagran-update.service
```

## 3. 配置

```bash
sudoedit /etc/lagran/control.env
```

生产最小配置：

```ini
CONTROL_BIND=127.0.0.1:8080
DATABASE_URL=postgres://lagran:密码@127.0.0.1:5432/lagran
JWT_SECRET=<openssl rand -hex 32>
AGENT_TOKEN=<openssl rand -hex 32>
WAF_RULEPACK_SECRET=<openssl rand -hex 32>
REQUIRE_SECURE_SECRETS=true
SEED_DEMO=false
ALLOW_REGISTER=false
CAPTCHA_ENABLED=true
CONTROL_PUBLIC_URL=https://console.example.com
```

### 关键变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `CONTROL_BIND` | `0.0.0.0:8080` | 监听地址，优先于 `CONTROL_HOST`+`CONTROL_PORT` |
| `DATABASE_URL` | 本机 lagran 库 | 必填 |
| `DATABASE_MAX_CONNECTIONS` | `20` | 每副本连接上限（钳制 2–200），总连接数不能超过 PG `max_connections` |
| `JWT_SECRET` | 开发密钥 | 至少 32 字节；`REQUIRE_SECURE_SECRETS=true` 时弱值拒绝启动 |
| `JWT_EXPIRE_HOURS` | `24` | 优先级：`JWT_EXPIRE_HOURS` > `JWT_EXPIRES_SECS` |
| `AGENT_TOKEN` | 空 | **全局**令牌：DNS `/api/v1/schedule` 与 `/metrics` 回退使用 |
| `WAF_RULEPACK_SECRET` | 空 | WAF 规则包签名密钥，Control 与所有 Edge 必须一致；为空时发布接口 503 |
| `ALLOW_REGISTER` | `false` | 打开自助注册；首个注册账号自动成为 admin |
| `CAPTCHA_ENABLED` | `true` | 登录/注册图片验证码 |
| `CORS_ALLOWED_ORIGINS` | 空（宽松） | 逗号分隔的浏览器来源白名单，配置后变为 fail-closed |
| `CONTROL_PUBLIC_URL` | 按 Host 推断 | 控制台公网地址，用于生成节点安装命令 |
| `REDIS_URL` | 空 | 登录限流、验证码、会话缓存、配置缓存、分布式锁 |
| `GEOIP_PATH` | `./data/ip2region_v4.xdb` | GeoDNS 调度用的 ip2region XDB |
| `GEOIP_IPV6_PATH` | 空 | IPv6 客户端地理库 |
| `SCHEDULE_TTL` | `30` | 调度 API 返回的 DNS TTL（钳制 5–3600） |
| `SCHEDULE_NODE_CACHE_SECS` | `5` | 调度器缓存 `edge_nodes` 的秒数 |
| `LOG_RETENTION_DAYS` | `30` | 访问日志/指标/登录日志保留天数，0 表示不清理 |
| `ALERT_EVAL_SECS` | `30` | 告警规则评估间隔（钳制 5–3600） |
| `METRICS_TOKEN` | 空 | `/metrics` 令牌；为空时回退 `AGENT_TOKEN` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | 空 | OTLP/HTTP Trace 导出地址，留空关闭 |
| `LAGRAN_UPDATE_REPO` | `Lagran93/Lagran` | 系统升级检测的仓库 |

完整注释版默认值见仓库根目录 `control.env.example`（约 300 行，逐项标注了 `[必填]`/`[生产建议]`/`[默认]`）。

::: danger `CONTROL_PUBLIC_URL` ≠ `CONTROL_URL`
`CONTROL_PUBLIC_URL` 只由 Control 读取，用于生成安装命令里的控制面地址；Edge/DNS 访问控制面用的是它们各自配置里的 `CONTROL_URL`。两者不能互相替代。
:::

## 4. 启动

```bash
sudo systemctl enable --now lagran-control
sudo systemctl status lagran-control --no-pager
```

启动时自动执行 `sqlx::migrate!` 迁移，**升级前先备份数据库**。健康检查：

```bash
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8080/ready
```

- `/health`：进程存活
- `/ready`：数据库可用
- `/metrics`：Prometheus 文本，需要 `METRICS_TOKEN` 或 `AGENT_TOKEN`

## 5. 创建首位管理员

```text
1. 临时设置 ALLOW_REGISTER=true，重启 lagran-control
2. 打开控制台注册第一个账号（数据库为空时自动获得 admin）
3. 日志确认：first account registered and granted admin
4. 改回 ALLOW_REGISTER=false 并重启
```

之后管理员在「用户管理 / 用户组」中创建账号与权限组。`SEED_DEMO=true` 生成的 `demo@lagran.dev / demo123` 只是普通用户，且与 `REQUIRE_SECURE_SECRETS=true` 互斥。

## 6. 前端 + 反向代理

```bash
curl -fsSL https://raw.githubusercontent.com/Lagran93/Lagran/main/install.sh \
  | sudo env LAGRAN_REPO=Lagran93/Lagran bash -s -- frontend --with-caddy
```

静态文件安装到 `/opt/lagran/web`，`--with-caddy` 会生成一份示例 `Caddyfile`。Caddy 需要同时处理两件事：

```caddyfile
console.example.com {
    root * /opt/lagran/web
    encode gzip

    # 控制面 API（优先于 SPA 路由）
    handle /api/* {
        reverse_proxy 127.0.0.1:8080
    }
    # ACME HTTP-01 由控制面响应
    handle /.well-known/acme-challenge/* {
        reverse_proxy 127.0.0.1:8080
    }
    handle {
        try_files {path} /index.html
        file_server
    }
}
```

Nginx 配置示例：
```
server {
    listen 80;
    server_name console.example.com;

    # ACME HTTP-01 必须保留给控制面
    location /.well-known/acme-challenge/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 其余请求跳转 HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    http2 on;                       # 老版本 nginx 用 listen 443 ssl http2;
    server_name console.example.com;

    ssl_certificate     /etc/letsencrypt/live/console.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/console.example.com/privkey.pem;

    root /opt/lagran/web;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_comp_level 5;
    gzip_min_length 256;
    gzip_proxied any;
    gzip_types
        text/plain text/css text/xml text/javascript
        application/javascript application/json application/xml
        application/rss+xml application/atom+xml application/wasm
        image/svg+xml font/ttf font/otf font/woff font/woff2;

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

::: warning SPA 回退
前端是 SPA（`ssr: false`）。所有非 `/api/*` 路径必须回退到 `index.html`，否则刷新 `/domains` 这类地址会 404。如果登录请求被发到 `localhost:8080`，说明前端 `NUXT_PUBLIC_API_BASE` 或反代配置有误。
:::

## 7. 防火墙

```text
公网：443（控制台）、80（ACME / 跳转）、8081（Edge 管理口回调）
内网：5432、6379
仅本机：8080（由反代访问）
```

::: tip Edge 与 Control 同机
`CONTROL_BIND` 建议改为 `127.0.0.1:8080` 并让反代代理；Edge 的 `CONTROL_URL` 仍写内网可达地址。注意 Caddy/Edge 不要同时抢占 443。
:::

## 8. 验收

- 能登录，能看到「用户组 / Shield 节点」等管理员菜单
- 创建项目与域名，规则保存后生成配置版本
- 边缘节点列表出现 `online` 状态与版本号
- 刷新缓存可下发，并在刷新结果中看到每个节点
- 证书列表可读取，可发起 ACME 申请
- `/metrics` 返回 `lagran_control_up 1` 与 `lagran_control_db_up 1`

