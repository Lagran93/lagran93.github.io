# 部署 Edge

Edge 负责实际用户流量、缓存、回源、WAF/CC 与证书终止。

## 1. 在控制台预注册

进入「边缘节点 → 新建节点」，填写：

- 节点名称
- 公网 IP
- 区域 / 国家 / 省 / 市 / ISP
- Agent URL，例如 `http://公网IP:8082`
- 节点令牌

保存后得到节点令牌。

## 2. 安装

```bash
curl -fsSL https://raw.githubusercontent.com/Lagran93/Lagran/main/install.sh \
  | sudo env LAGRAN_REPO=Lagran93/Lagran \
      AGENT_TOKEN='<节点令牌>' NODE_ID='edge-01' \
      bash -s -- edge
```

## 3. 配置

```bash
sudoedit /etc/lagran/edge.env
```

常见配置：

```ini
# 公共数据面
EDGE_LISTEN=0.0.0.0:8081
# 管理口，必须只允许 Control 访问
EDGE_ADMIN_LISTEN=127.0.0.1:8082

CONTROL_URL=http://<control-ip>:8080
AGENT_TOKEN=<与 Control 一致>

CACHE_BACKEND=hybrid
DISK_CACHE_DIR=/var/lib/lagran/cache
MAX_CACHEABLE_BODY=8388608

LARGE_CACHE_ENABLED=true
LARGE_CACHE_DIR=/var/lib/lagran/large-cache
LARGE_CACHE_MIN_OBJECT_BYTES=8388608
LARGE_CACHE_MAX_OBJECT_BYTES=1073741824
LARGE_CACHE_MAX_BYTES=21474836480
RANGE_FILL_MAX_BYTES=33554432
```

完整变量见 [配置参考](/reference/manual#4-3-edge-关键变量)。

## 4. 启动

```bash
sudo systemctl enable --now lagran-edge
sudo systemctl status lagran-edge --no-pager
```

## 5. 验证

```bash
# 管理口
curl -fsS http://127.0.0.1:8082/__lagran/health

# 数据面（替换 Host）
curl -fsS -H 'Host: cdn.example.com' http://127.0.0.1:8081/
```

响应：

```http
x-lagran-datapath: pingora
x-powered-by: lagran-edge
```

Control 节点列表应显示心跳在线。

## 6. 证书与 HTTPS

方式一：控制台上传证书，Edge 拉取并热加载。

方式二：Caddy / 证书文件挂载，配置 SNI。

详见 [HTTPS 与证书](/deploy/tls)。

## 7. 同机部署注意

Control 与 Edge 同机时：

- 端口不能冲突；
- `EDGE_ADMIN_LISTEN` 保持回环；
- Caddy 与 Edge 不要同时抢占 80/443；
- 内存/磁盘要预留大缓存空间。

## 8. 常见启动问题

| 现象 | 排查 |
| --- | --- |
| 管理口 401 | `AGENT_TOKEN` 不一致 |
| 节点离线 | Control 无法访问 `AGENT_URL` |
| 数据面 502 | 源站不可达、SSL 校验、Host 错误 |
| 大文件无缓存 | 大缓存未开启或阈值不对 |
| 配置不生效 | 未重载、未发布版本或版本不匹配 |
