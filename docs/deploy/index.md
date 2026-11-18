# 部署总览

## 部署顺序

```text
1. PostgreSQL（或使用安装器创建的数据库）
2. Control + 首位管理员
3. 前端 + 反向代理（Caddy/Nginx）
4. Edge（可多台，每台一个独立节点令牌）
5. DNS（可选，仅 GeoDNS 需要）
6. 接入域名并验收
```

DNS 只在需要 GeoDNS 时部署；不使用 GeoDNS 时可以直接把域名 CNAME/A 解析到 Edge 公网 IP。

## 安装器

所有组件都由仓库根目录的 `install.sh` 安装，可重复执行（幂等），用于首装、修复和补齐 systemd 单元：

```bash
curl -fsSL https://raw.githubusercontent.com/Lagran93/Lagran/main/install.sh \
  | sudo env LAGRAN_REPO=Lagran93/Lagran bash -s -- <control|edge|dns|frontend> [--with-caddy]
```

常用参数：

| 参数 / 环境变量 | 适用组件 | 说明 |
| --- | --- | --- |
| `--version vX.Y.Z` / `LAGRAN_VERSION` | 全部 | 指定 Release 标签，默认 latest |
| `--prefix /opt/lagran` / `LAGRAN_PREFIX` | 全部 | 安装前缀 |
| `--no-start` | 全部 | 只安装文件与单元，不启动服务 |
| `LAGRAN_DATABASE_URL` | control | 复用现有 PostgreSQL |
| `LAGRAN_JWT_SECRET`、`LAGRAN_AGENT_TOKEN` | control | 覆盖自动生成的值 |
| `AGENT_TOKEN`、`NODE_ID`、`CONTROL_URL`、`AGENT_URL` | edge/dns | 节点令牌与地址 |
| `LAGRAN_WAF_RULEPACK_SECRET` | control/edge | WAF 规则包签名密钥，必须一致 |
| `CHALLENGE_SECRET` | edge | CC/质询清零 Cookie 的 HMAC 密钥，多节点必须一致 |
| `LAGRAN_SEED_DEMO=true` | control | 创建演示账号（勿用于生产） |

完整列表：`./install.sh --help`。

## 端口规划

| 端口 | 组件 | 用途 | 暴露范围 |
| --- | --- | --- | --- |
| `8080` | Control | API 与控制台后端 | 仅反代/内网 |
| `80` | Edge | 公共 HTTP 数据面 | 公网 |
| `443` | Edge | 公共 HTTPS 数据面 | 公网 |
| `8081` | Edge | 管理 / Agent 接口 | 仅 Control |
| `53/udp,tcp` | DNS | 权威 DNS | 公网 |
| `5432` | PostgreSQL | 数据库 | 本机/内网 |
| `6379` | Redis（可选） | Control 会话、Edge CC/限流/L2 | 内网 |

## 系统依赖

- Linux amd64（musl 构建可用于旧 glibc 系统）
- PostgreSQL 14+
- systemd
- 可选：Redis、Caddy 或 Nginx、MaxMind GeoLite2（WAF Geo/ASN）、ip2region XDB（GeoDNS）

## 从源码构建

```bash
# 本机
cargo build --release -p control -p edge -p lagran-dns

# 旧系统兼容
cargo build --release --target x86_64-unknown-linux-musl -p control -p edge -p lagran-dns

# 前端静态站点
cd apps/frontend
npm ci
npm run generate
```

前端是 SPA（`ssr: false`），`NUXT_PUBLIC_API_BASE` 是**构建期**变量，修改后必须重新 `npm run generate`。

## 目录约定

| 路径 | 内容 |
| --- | --- |
| `/opt/lagran/bin` | 三个二进制 + 更新助手 |
| `/opt/lagran/web` | 前端静态文件 |
| `/etc/lagran/` | `control.env`、`edge.env`、`dns.env`、`edge-update.env` |
| `/var/lib/lagran/` | 证书、普通缓存、大缓存、更新请求与状态 |
| `/var/lib/lagran/cache` | `CACHE_BACKEND=disk/hybrid` 时的普通磁盘缓存 |
| `/var/lib/lagran/large-cache` | 大对象缓存 |
| `/var/lib/lagran/update-backup/` | 升级前备份的旧二进制 |

systemd 单元：

```text
lagran-control.service
lagran-edge.service
lagran-dns.service
lagran-update.path / lagran-update.service          # Control 升级
lagran-edge-update.path / lagran-edge-update.service # Edge 升级
```

## 安全基线

- 不要把 `8081` 管理口暴露到公网；`AGENT_URL` 使用内网地址。
- 生产关闭 `SEED_DEMO`，开启 `REQUIRE_SECURE_SECRETS=true`。
- `JWT_SECRET`、`AGENT_TOKEN`、`WAF_RULEPACK_SECRET`、`CHALLENGE_SECRET` 使用随机值，环境文件权限 `0600`。
- 每个 Edge 使用独立节点令牌，不要复用 Control 的全局 `AGENT_TOKEN`。
- 控制面 `/metrics` 建议配置 `METRICS_TOKEN`（未配置时回退 `AGENT_TOKEN`，两者都为空则仅本机安全）。
- 数据库只监听本机或内网，远程连接使用 `sslmode=require`。
- 定期备份 PostgreSQL 与 `/etc/lagran`，见 [备份与恢复](/ops/backup)。

## 验收清单

```text
Control   /health 200，/ready 200
Edge      管理口 /__lagran/health 200，控制台节点显示 online
数据面    curl -H 'Host: <域名>' http://<edge>:8081/ 返回 X-Cache 头
systemd   lagran-control / lagran-edge（/ lagran-dns）active
前端      能登录，能创建项目与域名
DNS       dig @<dns-ip> <域名> A 返回 Edge 公网 IP（GeoDNS 模式）
缓存      同一 URL 第二次请求 X-Cache: HIT
刷新      刷新后再次请求回到 MISS
```

详细步骤：

- [部署 Control](/deploy/control)
- [部署 Edge](/deploy/edge)
- [部署 DNS](/deploy/dns)
- [HTTPS 与证书](/deploy/tls)
- [升级与回滚](/deploy/upgrade)
- [完整部署手册](/reference/deployment)

