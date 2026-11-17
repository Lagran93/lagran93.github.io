# 项目、权限与域名接入

## 项目与可见范围

- 管理员可看全部项目与域名，包括“未归属项目”的域名
- 普通用户只能看到自己所属项目内的域名、规则、统计与日志
- 新建域名未指定项目时，自动使用该用户自己的 `Default` 项目，保证租户隔离
- 项目的 `owner` 不可被改角色或移除；`user` 角色不能把自己升级为 admin

## 接入域名

```text
域名管理 → 接入域名
或
域名管理 → 接入向导（分步表单，带接入检查）
```

基础字段：

| 字段 | 说明 |
| --- | --- |
| 加速域名 | 例如 `cdn.example.com`，同一个域名只能接入一次 |
| 源站协议 | `http` / `https` |
| 源站端口 | 默认 `80` / `443` |
| 源站主机 | 域名或 IP；支持多源站池（备用源站） |
| 源站 TLS SNI | 源站填 IP 且用 HTTPS 时必填 |
| 回源 Host | 源站虚拟主机要求 Host 时填写 |
| 所属项目 | 决定谁可见、谁可改 |

::: tip 源站填 IP 的 HTTPS 场景
源站证书通常只包含域名 SAN。只填 IP 会导致 TLS 校验失败，必须同时提供 SNI：

```text
源站主机     45.63.84.225
源站协议     https
源站端口     443
源站 TLS SNI test-origin.example.com
回源 Host    test-origin.example.com   # 源站按 Host 区分站点时
```

回源 Host 为空时回退到 SNI，再回退到源站主机。
:::

保存后：

1. 在 DNS 服务商把域名指向：

   ```text
   CNAME → 统一边缘接入域名（多节点/GeoDNS）
   A/AAAA → 某个 Edge 公网 IP（单节点测试）
   ```

2. 等待 Edge 同步配置（约 15 秒）
3. 用响应头确认请求已经过 Edge：

   ```bash
   curl -sD - -o /dev/null https://cdn.example.com/
   ```

   ```http
   X-Powered-By: lagran-edge
   X-Cache: MISS
   ```

4. 如需 HTTPS，先申请或上传证书，见 [证书管理](/use/certificates)
5. 在「缓存规则」配置路径 TTL 与动作，见 [缓存规则](/use/cache)
6. 用「缓存诊断」或域名的「接入检查」验证 DNS、TLS、源站 TCP 与真实缓存路径

## 域名高级设置

「域名管理 → 设置」弹窗按分组组织：

### 缓存

| 设置 | 说明 |
| --- | --- |
| 忽略 URL 查询串 | 缓存键不含 `?query` |
| Cache Key 忽略 Origin | 仅当 `Access-Control-Allow-Origin` 固定时使用 |
| Cache Key 忽略 Accept-Language | 仅当站点不按语言返回不同内容时使用 |

规则中的同名设置会覆盖域名级设置。

### 访问控制

| 设置 | 说明 |
| --- | --- |
| CORS 允许源 | `*` 或具体来源（多个用逗号分隔，取第一个生效） |
| 防盗链 Referer 白名单 | 例如 `example.com,*.example.com`，留空关闭 |

### 回源

| 设置 | 说明 |
| --- | --- |
| 回源鉴权 Header | 注入到回源请求的 Header 名，例如 `x-origin-token` |
| 回源鉴权值 | 只在服务端保存，不回显；留空保存表示保持原值 |
| 回源连接超时 | 毫秒，`0` 表示继承 Edge 全局默认 |
| Origin Shield 地址 | **只能下拉选择**管理员登记的 Shield 节点 |

### 签名 URL 防护

| 设置 | 说明 |
| --- | --- |
| 保护范围 | 全部路径或指定路径 |
| 签名有效期上限 | 秒 |
| 需要签名的路径 | 按行填写路径前缀 |
| 防盗链签名 | 开启后未带签名的热链请求被拒绝 |
| 当前签名密钥 / 上一个密钥 | 支持轮换期间双密钥并存 |

签名参数不进入 Cache Key，因此同一对象的签名 URL 共享一份缓存。

### CC 防御

| 设置 | 说明 |
| --- | --- |
| 全局限流 RPS / 突发 | 整个域名的令牌桶；配置 Edge `REDIS_URL` 后跨节点共享 |
| 每 IP 每秒请求数 / 突发 | 单客户端预算 |
| 连续超限次数后封禁 | 触发封禁的阈值 |
| 封禁时长 | 秒 |
| 模式 | 观察 / 拦截 / 质询相关组合 |
| IP 白名单 | 跳过 CC 的客户端网段 |

### 自定义响应头

按 `Name: Value` 每行一条，保存后由 Edge 统一注入到响应（也会覆盖同名的源站响应头）。

::: warning 修改不会自动清缓存
修改 TTL、忽略 Query、Cache Key 等设置后，已缓存的对象仍按旧规则存在。要么[刷新缓存](/use/prefetch)，要么等待旧对象过期。
:::

## Origin Shield（域名侧）

「Origin Shield 地址」是一个下拉框，选项来自「系统 → Shield 节点」中**启用**的条目：

```text
关闭                        → 直接按源站池回源
shield-s1 · https://shield-s1.internal.example.com
当前值（未登记或已停用）     → 只读展示，便于发现历史遗留配置
```

普通用户**不能**输入任意 URL：后端会校验所选地址必须存在于 `shield_nodes` 白名单中，未登记或已停用的地址无法保存，仍被域名引用的 Shield 节点也不能停用或删除。部署与验证见 [Origin Shield](/use/origin-shield)。

## 验证与诊断

| 工具 | 位置 | 用途 |
| --- | --- | --- |
| 接入检查 | 域名详情页 | DNS、TLS、源站 TCP、缓存路径 |
| 缓存诊断 | 加速服务 → 缓存诊断 | 按 URL 查看每个节点的命中层级与 miss 原因 |
| 缓存规则测试 | 缓存规则 → 测试 | 输入路径/方法查看命中的规则 |

关键响应头：

```http
X-Powered-By: lagran-edge
X-Cache: HIT | MISS | BYPASS | STALE
X-Cache-Status: HIT | MISS            # 兼容旧客户端
X-Lagran-Cache-Reason: <未命中/绕过原因>
Age: <已存活秒数>
X-Lagran-Cache-TTL: <剩余新鲜秒数>
```

完整响应头说明见 [缓存规则](/use/cache#响应头)。

