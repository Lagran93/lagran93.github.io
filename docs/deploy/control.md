# 部署 Control

Control 是配置与数据中心，负责 PostgreSQL、API、控制台、配置发布、预热与告警。

## 1. 数据库

```sql
CREATE USER lagran WITH PASSWORD 'change-me';
CREATE DATABASE lagran OWNER lagran;
```

连接串：

```ini
DATABASE_URL=postgres://lagran:change-me@127.0.0.1:5432/lagran
```

密码含 `@`、`:` 等字符时需要 URL 编码。

## 2. 安装

```bash
curl -fsSL https://raw.githubusercontent.com/Lagran93/Lagran/main/install.sh \
  | sudo env LAGRAN_REPO=Lagran93/Lagran bash -s -- control
```

或从源码构建后安装到 `/opt/lagran/bin/lagran-control`。

## 3. 配置

编辑：

```bash
sudoedit /etc/lagran/control.env
```

最小配置：

```ini
DATABASE_URL=postgres://lagran:密码@127.0.0.1:5432/lagran
JWT_SECRET=<至少 32 字节随机值>
AGENT_TOKEN=<Control 与 Edge/DNS 共享令牌>
SEED_DEMO=false
REQUIRE_SECURE_SECRETS=true
CONTROL_PUBLIC_URL=https://console.example.com
```

### 关键变量

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 连接 |
| `JWT_SECRET` | 登录令牌签名密钥 |
| `AGENT_TOKEN` | Agent / DNS 调用鉴权 |
| `SEED_DEMO` | 是否创建演示账号 |
| `REQUIRE_SECURE_SECRETS` | 生产强制强密钥 |
| `CONTROL_PUBLIC_URL` | 控制台公网地址 |
| `LOG_RETENTION_DAYS` | 日志保留天数 |
| `REDIS_URL` | 可选，会话与跨节点能力 |

完整变量见 [配置参考](/reference/manual#4-运行配置参考)。

## 4. 启动

```bash
sudo systemctl enable --now lagran-control
sudo systemctl status lagran-control --no-pager
```

迁移在启动时自动执行：

```text
sqlx::migrate!
```

健康检查：

```bash
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8080/ready
```

## 5. 创建管理员

首次启动后按安装器提示创建管理员，或使用控制台初始化流程。生产环境不要保留演示账号。

## 6. 前端 + Caddy

前端由 Caddy 托管，API 反向代理到 `127.0.0.1:8080`：

```bash
./install.sh frontend --with-caddy
```

检查：

```text
https://console.example.com
```

如果登录请求被发到 `localhost:8080`，检查前端 API base 或 Caddy 反代配置。

## 7. 防火墙

只对外开放：

```text
443（控制台）
80（ACME / 跳转）
```

PostgreSQL、8080 只允许本机或内网访问。

## 8. 验收

- 登录成功
- 创建项目/域名
- 规则保存后配置版本生成
- Edge 心跳在线
- 刷新缓存可下发
- 证书列表可读取
