# WAF 与 CC 防护

WAF 在 Edge 上执行，位于 HTTPS 跳转之后、缓存之前。请求体**不会**被检查（WAF 在代理读取 body 之前运行），检查范围是路径、Query、User-Agent、Referer、Method、IP 与任意请求头。

## WAF 页面结构

「WAF 防护」页面顶部选择域名，然后切换标签页：

```text
概览    近 7 天命中趋势、按类型/动作分布、Top IP / 规则 / 路径
防护设置 开关、模式、安全级别、托管规则集
规则     自定义规则（DSL）
IP 名单  IP / CIDR 黑白名单
Geo/ASN  国家/地区与 ASN 黑白名单
共享封禁 跨节点 CC/WAF 封禁记录，可手动封禁/解封
事件     命中事件明细
```

## 防护设置

| 设置 | 说明 |
| --- | --- |
| 开启 WAF 防护 | 关闭后该域名的 IP 名单与全部规则都不生效 |
| 防护模式 | `观察` 只记录不拦截；`拦截` 直接返回 403 阻断页 |
| 安全级别 | `off` / `低` / `中` / `高` / `攻击中` |
| 托管规则集 | 见下表，可多选 |

安全级别决定“额外质询”的强度（静态资源通常除外）：

| 级别 | 行为 |
| --- | --- |
| `off` | 只执行 IP 名单与显式规则 |
| `低` | 对空 User-Agent 的 GET/HEAD 发起质询 |
| `中` | 在低级别基础上，对扫描器 UA 与空 UA 质询 |
| `高` | 对所有文档类 GET/HEAD（HTML 导航）质询 |
| `攻击中` | 对所有 GET/HEAD 质询，适合正在被攻击时临时开启 |

托管规则集（版本随 Release 更新）：

| ID | 名称 | 覆盖内容 |
| --- | --- | --- |
| `owasp-core` | OWASP 核心防护 | SQL 注入、XSS、路径穿越、命令执行、SSRF、XXE、Log4Shell、协议异常 |
| `injection-extended` | 注入扩展防护 | 模板注入（SSTI）、NoSQL、LDAP、Java 反序列化、WebShell |
| `ssrf-xxe` | SSRF / XXE 防护 | 云元数据访问、内网探测、外部实体 |
| `scanner-guard` | 扫描器与协议基线 | 常见扫描器 UA、敏感探测路径、空字节、超长请求 |

### 规则包（签名与灰度）

托管规则集由 Control 打包成**签名规则包**下发到 Edge：

```text
WAF 防护 → 防护设置 → 规则包
→ 发布（publish）/ 回滚（rollback）/ 转 retired
```

- 签名密钥为 `WAF_RULEPACK_SECRET`，Control 与所有 Edge 必须一致
- 密钥为空时 Edge 拒绝所有签名规则包，发布接口返回 503
- 轮换密钥：先改 Control 与所有 Edge，再重启 Control；启动时会用新密钥自校验当前 active 规则包，验签失败则原地重新签名
- 回滚会切回上一个可用版本，转 `retired` 后不能再被激活

## 自定义规则 DSL

```text
ip in "10.0.0.0/8" and path prefix "/admin"
user_agent contains "curl" or header:x-debug equals "1"
not (query contains "token=") and method equals "GET"
```

语法：

```text
expr      := or
or        := and ("OR" and)*
and       := unary ("AND" unary)*
unary     := "NOT" unary | "(" expr ")" | condition
condition := field operator "string"

field  := path | query | user_agent | ua | referer | method | ip | header:<name>
op     := contains | equals | eq | prefix | suffix | in（仅 ip）
```

限制（超出会在保存时被拒绝）：

```text
表达式长度 ≤ 2048
嵌套深度 ≤ 16
节点数   ≤ 64
单个值   ≤ 256
```

不支持正则与代码执行，避免 ReDoS。规则动作：`block` / `allow` / `log` / `challenge`。

## IP 名单与 Geo/ASN 名单

| 名单 | 匹配 | 说明 |
| --- | --- | --- |
| IP 名单 | IPv4/IPv6、CIDR | 白名单跳过其余 WAF 检查；黑名单直接拦截 |
| Geo/ASN | 国家/地区（ISO 代码）、ASN | 黑名单优先于白名单；白名单为“准入门槛”，命中后仍继续执行后续规则 |

Geo/ASN 判定使用 Edge 本地 MaxMind GeoLite2 数据库：

```ini
# edge.env
GEOIP_COUNTRY_DB=/var/lib/lagran/maxmind/GeoLite2-Country.mmdb
GEOIP_ASN_DB=/var/lib/lagran/maxmind/GeoLite2-ASN.mmdb
```

- 数据库缺失时：Geo/ASN **黑名单不生效**，白名单 fail-closed（拒绝），其余 WAF 功能正常
- 客户端 IP 取可信来源：仅在配置 `TRUST_PROXY_HEADERS=true` 且来源在 `TRUSTED_PROXIES` 内时才信任 `X-Forwarded-For`

## CC 防护

CC 针对 L7 洪水，配置入口有两处：

- 「域名管理 → 设置 → CC 防御」：全局限流 RPS/突发、每 IP RPS/突发、封禁阈值与时长、IP 白名单
- 「WAF 防护 → 共享封禁」：查看/手动封禁与解封

机制：

```text
客户端聚合：IPv4 按 /24、IPv6 按 /64
滑动窗口：按路径统计，带路径预算
全局阈值 + 自动攻击模式：整体流量突增时收紧
挑战：PoW 质询 + 签名 clearance Cookie
封禁：按阈值与时长自动写入共享封禁表
```

- 配置 Edge `REDIS_URL` 后，限流与封禁**跨节点共享**；Redis 故障时回退为单进程 bucket
- `CHALLENGE_SECRET` 在所有 Edge 上必须一致，否则质询通过后换到另一节点会被重新质询
- `lagran_clearance` Cookie 是内部标记，不转发源站、不影响缓存

## 质询（Challenge）

```text
1. 规则/安全级别判定为 challenge
2. Edge 返回 PoW 挑战页（x-lagran-challenge 头）
3. 浏览器计算答案并提交 /__lagran/challenge/verify
4. Edge 校验 HMAC 签名 nonce + PoW，签发 HttpOnly clearance Cookie
5. 后续请求携带 Cookie 直接放行
```

- nonce 一次性使用，重放会被拒绝
- 难度由域名配置决定（1–6），并受 `CHALLENGE_SECRET` 保护
- 质询页只允许跳回本域路径，避免开放重定向

## 行为评分

`CC_BEHAVIOR_ENABLED=false` 默认关闭。开启后按请求频率、路径、UA、Header 等累计评分，达到阈值后质询或封禁。属于启发式能力，**上线前务必在观察模式验证误报**。

## 建议

- 新域名先 `观察` 模式跑 3–7 天，看「事件」与「概览」中的 Top 规则
- 再切 `拦截`，并逐步开启 `injection-extended`、`scanner-guard`
- 对登录、支付、API 路径单独配置更严格的规则与限流
- 静态资源目录排除在 `高`/`攻击中` 安全级别的质询之外（默认已排除）
- 不要把 `EDGE_ADMIN_LISTEN` 暴露到公网
- WAF 事件与访问日志分开保留，便于合规审计

## 排障

| 现象 | 检查 |
| --- | --- |
| 正常请求被拦截 | 事件页中的命中规则与动作；IP/Geo 黑名单；托管规则集是否过严 |
| 质询循环 | 各节点 `CHALLENGE_SECRET` 是否一致；Cookie 域与 HTTPS；前置代理是否改写 Cookie |
| CC 误封 | 每 IP 阈值、路径预算、全局阈值；共享封禁列表；是否开启了行为评分 |
| WAF 不生效 | 域名是否开启 WAF；模式是否仍是观察；规则包是否已发布并下发；Edge 是否拿到最新配置 |
| Geo/ASN 名单无效 | MaxMind 库路径是否正确、文件是否存在、是否需要重启 Edge |
| 拦截页没有 `x-lagran-waf` 头 | 请求可能来自缓存的旧 403，或未经过 WAF（检查 HTTPS 跳转与数据面） |

WAF 拦截响应会携带：

```http
x-lagran-waf: blocked
x-lagran-waf-rule: <命中规则>
x-lagran-error: WAF_BLOCKED
```

