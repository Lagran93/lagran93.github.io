# 部署总览

## 部署顺序

```text
1. PostgreSQL
2. Control
3. 前端 + Caddy
4. Edge（可多台）
5. DNS（可选）
6. 域名接入与验收
```

DNS 只在需要 GeoDNS 时部署；不使用 GeoDNS 时可以直接把域名 CNAME 到 Edge。

## 端口规划

| 端口 | 组件 | 用途 |
| --- | --- | --- |
| `8080` | Control | API / 控制台后端 |
| `8081` | Edge | 公共 HTTP 数据面 |
| `8082` | Edge | 管理口，只对 Control 开放 |
| `8053` | DNS | 权威 DNS，按实际配置 |
| `80/443` | Caddy/Edge | 站点与 HTTPS |

## 系统依赖

- Linux amd64
- PostgreSQL 14+
- systemd
- 可选：Caddy、Redis、Docker

## 构建方式

### 使用 Release / install.sh

推荐生产使用：

```bash
./install.sh control
./install.sh edge
./install.sh dns
./install.sh frontend --with-caddy
```

### 从源码构建

```bash
cargo build --release -p control -p edge -p lagran-dns
```

旧系统 glibc 不兼容时：

```bash
cargo build --release --target x86_64-unknown-linux-musl \
  -p control -p edge -p lagran-dns
```

前端：

```bash
cd apps/frontend
npm ci
npm run generate
```

## 目录约定

| 路径 | 内容 |
| --- | --- |
| `/etc/lagran/control.env` | Control 配置 |
| `/etc/lagran/edge.env` | Edge 配置 |
| `/etc/lagran/dns.env` | DNS 配置 |
| `/opt/lagran/bin` | 二进制 |
| `/opt/lagran/web` | 前端静态文件 |
| `/var/lib/lagran` | 数据、证书、缓存、更新助手状态 |

## 安全基线

- 不要把 `8082` 管理口暴露到公网。
- 生产关闭 `SEED_DEMO`。
- 设置强 `JWT_SECRET` 和 `AGENT_TOKEN`。
- 数据库只监听本机或内网。
- 使用 HTTPS，证书可通过控制台或 ACME 管理。
- 定期备份 PostgreSQL 与 `/var/lib/lagran`。

## 验收清单

```text
Control /health /ready
Edge 管理口 /__lagran/health
Edge 数据面 Host 请求
systemd 三个服务 active
前端登录
域名解析
缓存 HIT/MISS
刷新缓存
```

详细步骤：

- [部署 Control](/deploy/control)
- [部署 Edge](/deploy/edge)
- [部署 DNS](/deploy/dns)
- [HTTPS 与证书](/deploy/tls)
- [升级与回滚](/deploy/upgrade)
- [完整部署手册](/reference/deployment)
