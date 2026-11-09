# 快速开始

本文按 **Control → Edge → DNS** 的顺序完成最小可用部署。生产环境请继续阅读 [部署总览](/deploy/)。

## 1. 准备

需要：

- Linux amd64
- PostgreSQL 14+
- 已解析到服务器的域名
- 80/443、8080/8082/53 等端口可用

默认端口：

| 组件 | 端口 |
| --- | --- |
| Control API | `8080` |
| Edge 数据面 | `8081`（HTTP），HTTPS 由配置决定 |
| Edge 管理口 | `8082` |
| DNS | `53`（按部署配置） |

## 2. 安装 Control

```bash
curl -fsSL https://raw.githubusercontent.com/Lagran93/Lagran/main/install.sh \
  | sudo env LAGRAN_REPO=Lagran93/Lagran bash -s -- control
```

安装后配置：

```bash
sudoedit /etc/lagran/control.env
```

至少确认：

```ini
DATABASE_URL=postgres://lagran:密码@127.0.0.1/lagran
JWT_SECRET=<至少 32 字节随机值>
SEED_DEMO=false
REQUIRE_SECURE_SECRETS=true
AGENT_TOKEN=<控制面与边缘共享令牌>
```

启动：

```bash
sudo systemctl restart lagran-control
curl -fsS http://127.0.0.1:8080/health
```

首次登录如果启用了演示数据：

```text
demo@lagran.dev / demo123
```

生产环境务必关闭演示账号并修改密码。

## 3. 注册并安装 Edge

1. 登录控制台，进入「边缘节点」。
2. 新建节点，填写公网 IP、Agent URL、节点令牌。
3. 在边缘服务器执行：

```bash
curl -fsSL https://raw.githubusercontent.com/Lagran93/Lagran/main/install.sh \
  | sudo env LAGRAN_REPO=Lagran93/Lagran \
      AGENT_TOKEN='<节点令牌>' NODE_ID='edge-01' \
      bash -s -- edge
```

4. 配置 `/etc/lagran/edge.env`，重点：

```ini
EDGE_LISTEN=0.0.0.0:8081
EDGE_ADMIN_LISTEN=127.0.0.1:8082
CONTROL_URL=http://<control-ip>:8080
AGENT_TOKEN=<与 Control 一致>
```

5. 启动并验证：

```bash
sudo systemctl restart lagran-edge
curl -fsS http://127.0.0.1:8082/__lagran/health
```

## 4. 安装 DNS（可选）

只有使用 GeoDNS 时才需要：

```bash
curl -fsSL https://raw.githubusercontent.com/Lagran93/Lagran/main/install.sh \
  | sudo env LAGRAN_REPO=Lagran93/Lagran bash -s -- dns
```

配置 `/etc/lagran/dns.env`，准备 ip2region 数据：

```bash
sudo mkdir -p /var/lib/lagran
sudo wget -O /var/lib/lagran/ip2region_v4.xdb \
  https://raw.githubusercontent.com/lionsoul2014/ip2region/master/data/ip2region_v4.xdb
```

启动：

```bash
sudo systemctl restart lagran-dns
```

然后把业务域名 CNAME 到 DNS Zone，并把 Zone 委派给 DNS 服务器。详见 [GeoDNS](/use/geodns)。

## 5. 接入第一个域名

控制台：

```text
域名管理 → 新增域名
→ 填写域名、源站、项目
→ 保存
→ 在 DNS 服务商把域名 CNAME 到 Edge 或 DNS Zone
```

验证：

```bash
curl -I -H 'Host: cdn.example.com' http://<edge-ip>:8081/
```

响应应包含：

```http
x-lagran-datapath: pingora
x-powered-by: lagran-edge
```

## 6. 下一步

- [配置缓存规则](/use/cache)
- [缓存预热](/use/prefetch)
- [WAF 与 CC](/use/waf)
- [配置发布](/use/releases)
- [监控与健康检查](/ops/monitoring)
