# 快速开始

本文按 **Control → Edge → DNS（可选）** 的顺序完成最小可用部署。生产环境请继续阅读 [部署总览](/deploy/)。

## 1. 准备

需要：

- Linux amd64（建议 4 核 8 GB 以上；大缓存节点预留独立磁盘）
- PostgreSQL 14+
- 已解析到服务器的域名
- 可用端口（见下表）

默认端口：

| 组件 | 端口 | 说明 |
| --- | --- | --- |
| Control API | `8080` | 生产只通过反向代理暴露 |
| Edge 数据面 | `8081` | 公共 HTTP；HTTPS 由 Edge 自己终止 |
| Edge 管理口 | `8082` | **只允许 Control 来源访问** |
| DNS | `53/udp,tcp` | 需要 root 或 `CAP_NET_BIND_SERVICE` |
| PostgreSQL | `5432` | 只监听本机或内网 |

## 2. 安装 Control

```bash
curl -fsSL https://raw.githubusercontent.com/Lagran93/Lagran/main/install.sh \
  | sudo env LAGRAN_REPO=Lagran93/Lagran bash -s -- control
```

安装器会创建数据库、写入 `/etc/lagran/control.env`、安装 `lagran-control.service`，并安装系统升级助手 `lagran-update.path`。如果没有可用的 PostgreSQL，也可以传入现成的连接串：

```bash
sudo env LAGRAN_REPO=Lagran93/Lagran \
  LAGRAN_DATABASE_URL='postgres://user:pass@host:5432/db' \
  bash -s -- control < install.sh
```

安装后确认关键配置：

```bash
sudoedit /etc/lagran/control.env
```

```ini
DATABASE_URL=postgres://lagran:密码@127.0.0.1:5432/lagran
# 至少 32 字节随机值：openssl rand -hex 32
JWT_SECRET=<随机值>
# 全局令牌：只用于 DNS 调度接口（/api/v1/schedule）
AGENT_TOKEN=<随机值>
# WAF 规则包签名密钥，必须与所有 Edge 一致
WAF_RULEPACK_SECRET=<随机值>
SEED_DEMO=false
REQUIRE_SECURE_SECRETS=true
CONTROL_PUBLIC_URL=https://console.example.com
```

::: warning 三种令牌不要混用
- `JWT_SECRET`：控制台登录令牌签名。
- `AGENT_TOKEN`（控制面）：**全局**令牌，只有 DNS 调度、导出类接口使用。
- 节点令牌：每个 Edge 独立生成（控制台创建节点时给出），Edge 用它上报心跳、拉取配置和证书。

把全局 `AGENT_TOKEN` 直接抄到 `edge.env` 是常见错误：节点会被控制面拒绝或被绑定到错误节点。
:::

启动并检查：

```bash
sudo systemctl restart lagran-control
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8080/ready
```

## 3. 创建第一个管理员

项目不提供公开管理员密码。首次部署按以下步骤取号：

1. 临时把 `ALLOW_REGISTER=true`，重启 `lagran-control`；
2. 打开控制台注册第一个账号——数据库中没有账号时，**第一个注册账号自动成为 admin**，日志会打印 `first account registered and granted admin`；
3. 拿到管理员后立刻改回 `ALLOW_REGISTER=false` 并重启。

演示账号 `demo@lagran.dev / demo123` 只在 `SEED_DEMO=true` 时创建，且只是普通用户、不会获得管理员权限；它与 `REQUIRE_SECURE_SECRETS=true` 同时开启时控制面会拒绝启动。

生产环境如果要安装控制台前端：

```bash
curl -fsSL https://raw.githubusercontent.com/Lagran93/Lagran/main/install.sh \
  | sudo env LAGRAN_REPO=Lagran93/Lagran bash -s -- frontend --with-caddy
```

详见 [部署 Control](/deploy/control) 与 [HTTPS 与证书](/deploy/tls)。

## 4. 注册并安装 Edge

1. 登录控制台，进入「边缘节点 → 新建节点」，填写公网 IP、区域/国家/省/市/ISP、权重，以及 **Agent URL**（例如 `http://10.0.0.12:8082`）。
2. 保存后会得到该节点专属的令牌。
3. 在边缘服务器上执行：

```bash
curl -fsSL https://raw.githubusercontent.com/Lagran93/Lagran/main/install.sh \
  | sudo env LAGRAN_REPO=Lagran93/Lagran \
      AGENT_TOKEN='<节点令牌>' NODE_ID='edge-01' \
      CONTROL_URL='http://<control-ip>:8080' \
      AGENT_URL='http://<edge-internal-ip>:8082' \
      bash -s -- edge
```

4. 复核 `/etc/lagran/edge.env`：

```ini
EDGE_LISTEN=0.0.0.0:8081
EDGE_ADMIN_LISTEN=127.0.0.1:8082     # Control 与 Edge 不同机时改为内网地址
NODE_ID=edge-01
CONTROL_URL=http://<control-ip>:8080
AGENT_URL=http://<edge-internal-ip>:8082
AGENT_TOKEN=<该节点的独立令牌>
CHALLENGE_SECRET=<与所有 Edge 一致，install.sh 会自动生成>
```

5. 启动并验证：

```bash
sudo systemctl enable --now lagran-edge
curl -fsS http://127.0.0.1:8082/__lagran/health
```

控制台「边缘节点」列表中的状态应在 15 秒内变为 `online`。

::: tip 管理口隔离
`AGENT_URL` 必须指向管理口（`8082`），不能写公共数据口（`8081`）。`EDGE_ADMIN_LISTEN` 设置后，管理接口只在管理口接受，数据口返回 405。
:::

## 5. 安装 DNS（可选）

只有使用 GeoDNS 时才需要。直接把域名 CNAME/A 到 Edge 公网 IP 也能工作。

```bash
curl -fsSL https://raw.githubusercontent.com/Lagran93/Lagran/main/install.sh \
  | sudo env LAGRAN_REPO=Lagran93/Lagran \
      AGENT_TOKEN='<与 Control 的全局 AGENT_TOKEN 相同>' \
      DNS_ZONE='edge.example.com' \
      DNS_NS_NAME='ns1.edge.example.com' \
      DNS_NS_IP='<本机公网 IP>' \
      bash -s -- dns
```

```bash
sudo systemctl enable --now lagran-dns
dig @127.0.0.1 cdn.example.com A +short
```

Zone/NS/SOA、限速与降级见 [部署 DNS](/deploy/dns)，调度原理见 [GeoDNS 调度](/use/geodns)。

## 6. 接入第一个域名

控制台「域名管理 → 接入域名」（或「接入向导」）：

```text
加速域名   cdn.example.com
源站协议   https
源站端口   443
源站主机   origin.example.com（IP 也可以）
源站 TLS SNI   源站只有域名证书时必填
回源 Host      虚拟主机要求 Host 时必填
所属项目       团队成员可见
```

保存后，在 DNS 服务商把 `cdn.example.com` 解析到：

- 统一边缘接入域名（`EDGE_CNAME`，需要 GeoDNS/多节点时），或
- 某个 Edge 的公网 IP（单节点测试）。

验证：

```bash
curl -I -H 'Host: cdn.example.com' http://<edge-ip>:8081/
```

响应应包含：

```http
X-Powered-By: lagran-edge
X-Cache: MISS          # 第二次请求应为 HIT
X-Lagran-Cache-Reason:  # 仅在未命中/绕过时出现
```

::: warning 新配置不会立刻出现
Edge 默认每 15 秒拉取一次配置，新接入的域名最多延迟约 15 秒生效。若该域名已启用配置发布，还需要创建并审批发布单。
:::

## 7. 下一步

- [配置缓存规则与 Cache Key](/use/cache)
- [刷新与预热](/use/prefetch)
- [WAF 与 CC 防护](/use/waf)
- [配置发布与灰度](/use/releases)
- [Origin Shield](/use/origin-shield)
- [监控与健康检查](/ops/monitoring)

