---
title: 内部评估与路线图
description: 生产稳定性、安全能力和后续规划的评估记录。
outline: [2, 3]
---

> 本文为完整原始文档，整理自主项目 `docs/todo-bug.md`。

1、“缓存诊断”功能诊断大视频文件（比如：http://www.akgo.net/api/file/stream?code=7hLeWcmQ）时候出错;
2、“域名诊断”弹出modal框中提示https证书 TLS 校验失败：invalid peer certificate: UnknownIssuer，实际在浏览器中访问没有问题；
3、"域名接入向导"页面，第4步骤DNS与验证页面，当为普通用户时显示：“edge.example.com 可解析到任意在线节点 IP：暂无在线节点；如部署了统一边缘接入域名，也可使用 CNAME。”，固定显示edge.example.com不合适，且不显示节点IP；
====
1、普通用户浏览“大屏监控”的时候，不断请求GET /api/v1/nodes 接口而返回403错误，请修正。
====
1、缓存预热失败edge-kr-01: warmed=0 failed=1 (warmed 0 path(s), failed 1); edge-kr-02: warmed=0 failed=1 (warmed 0 path(s), failed 1)，在访问日志可以看到状态301、缓存HTTPS_REDIRECT的日志信息；
2、优化移动端（包括手机端）顶部导航栏和breadcrumb的显示；
===
1、除了“边缘节点离线”监控警告之外，把其他告警中心的相关权限（功能）下放到普通用户；
2、新增登录、注册验证码功能；
3、“域名管理”页面变更域名所属项目时，当有很多项目名称同名时，分不清到底是哪个用户的项目，请优化；
===
1、版本信息嵌入短git hash;
2、waf增强请求体级规则、速率型 Bot 规则和完整 OWASP CRS;
3、继续丰富大屏监控的显示内容;
出一套CDN系统，或者跟有需求者进行合作也行。
https://console.akgo.net
管理员(请勿修改密码,谢谢)：
用户名：admin@lagran.dev
密码：admin123
普通用户：
用户名：user_demo@lagran.dev
密码：user_demo123
谢谢管理员大大的不杀之恩。

update users set password_hash='$2b$12$xh0/tXnK0EJpUuNg/uIzp.QhfuqpI8lKs.JdR7X.F2lgOSRVAw.XW' where email='admin@lagran.dev'

admin123
$2b$12$xh0/tXnK0EJpUuNg/uIzp.QhfuqpI8lKs.JdR7X.F2lgOSRVAw.XW

1、版本信息嵌入短git hash;
2、继续丰富大屏监控的显示内容;
3、新增github的工作流文件，以便使用github的action功能；
4、新增从github获取文件，并一键安装部署脚本；

如果待加速的域名没有cname到edge的ip，“域名诊断”时会显示诊断失败，而不是给出相应提示。

1、检查一下缓存语义，在更加符合互联网规范的前提下，优化并完善全部代码中的缓存语义。
2、请确认目前开发状态是否“普通域名限流为单进程内存态”？如果是，请进一步优化为跨edge共享；
3、继续优化、增强waf功能；
4、继续优化、增强指纹与行为分析功能；
5、评估新增“L4/云清洗”功能的可行性；

{"error":"password must contain letters and digits"}

test-origin.akgo.net是45.63.84.225服务器上众多http虚拟主机中的一个，
源站协议：HTTP
源站主机：test-origin.akgo.net
源站端口：80
上面配置可以正常使用，如何实现用
源站协议：HTTP
源站主机：45.63.84.225
源站端口：80
也能正常回原？
新增用户组、用户权限控制，进行权限颗粒度的细化；

普通用户使用"访问日志"页面查询“最近100条”、“最近200条”等过滤查询，实际获取到的数据并没有100条、200条，请修正。
新增用户登录日志功能；管理员可以查看所有用户的登录日志，普通用户只能查看自己账号的登录日志。

自从“缓存语义规范化；普通域名限速共享”之后，用户通过edge打开网页的加载速度比之前明显变慢了，另外访问未接入加入的域名（比如：http://s1.akgo.net），手机端via浏览器会显示“the network connection was lost”，请检查源码；

# 总体判断

当前系统已经具备一个可用 CDN 的核心能力：

- 多域名、多源站、源站池、Origin Shield
- 缓存规则、TTL、Vary、条件请求 / 304
- Range、大文件磁盘缓存
- 缓存标签与刷新
- WAF、CC、限流、Bot 防护
- TLS / ACME、HTTP/2、H2 回源
- 节点健康检查、远程升级
- 操作审计、告警

但如果对标企业级 CDN，还缺少几类“平台级”能力。下面按优先级列出。

---

# P0：影响生产稳定性和 SLA 的能力

## 1. 流媒体与长连接超时模型

这次 `/api/file/stream` 的 504 就是典型问题。

需要补齐：

```text
连接超时
响应头超时
首字节超时
body chunk 空闲超时
整体传输不设总超时
```

避免当前这种：

```text
整个视频响应必须在 10 秒内完成
→ 大视频必然 504
```

同时需要：

- HLS / DASH 分片缓存
- Range 请求合并
- 视频首帧预热
- 直播流不落缓存
- 慢客户端背压
- 客户端断开时及时取消回源

这是当前最优先的生产问题。

---

## 2. 多节点缓存一致性

当前缓存主要是节点本地：

```text
CACHE_BACKEND=memory / disk / hybrid
```

企业级 CDN 需要：

- 一致性哈希
- 二层共享缓存
- 同一对象跨节点请求合并
- 跨节点 purge 广播
- purge 成功/失败确认
- 缓存版本号
- 节点扩容后缓存迁移

否则会出现：

```text
节点 A HIT
节点 B MISS
purge 后部分节点仍有旧内容
```

建议：

```text
边缘内存缓存
→ 区域共享 Redis / 对象存储
→ 源站
```

并支持：

```text
request coalescing
stale-while-revalidate
stale-if-error
background revalidation
```

---

## 3. 配置版本化、灰度、回滚

当前配置发布更像“直接下发”。

企业级需要：

- 配置版本号
- 变更 diff
- 按节点/区域灰度
- 百分比发布
- 一键回滚
- 发布失败自动回滚
- 配置审计
- 配置校验
- 禁止无效规则上线

例如：

```text
10% 节点 → 50% → 100%
```

否则一条错误的缓存规则可能瞬间影响全部域名。

---

## 4. 可观测性

需要从“有日志”升级为“可运营”。

建议补齐：

- Prometheus / OpenTelemetry 指标
- 分布式追踪
- 每域名、每规则、每状态码指标
- 缓存命中率
- 回源带宽
- 回源错误率
- P50/P95/P99 延迟
- 4xx/5xx 比例
- 边缘节点容量
- 磁盘使用率
- 大文件缓存命中和回源字节
- 告警规则
- SLO / 错误预算

重点指标：

```text
cache_hit_ratio
origin_latency
origin_error_rate
edge_5xx_rate
bandwidth_saved
revalidation_304_ratio
large_cache_evictions
```

---

## 5. 源站保护

企业级 CDN 必须防止源站被打穿。

需要：

- 回源熔断
- 回源重试预算
- 回源并发限制
- 单域名回源 QPS 限制
- 源站健康检查
- 慢源站摘除
- 回源超时分级
- 请求合并
- 源站鉴权
- 回源 mTLS
- 固定回源 IP
- 自定义回源 Host / SNI 已具备

---

## 6. 安全能力

### 已有

- WAF
- CC
- 限流
- Bot 防护
- 热链
- CORS

### 还需要

- 托管 WAF 规则集
- OWASP CRS
- 自定义规则 DSL
- IP / Geo / ASN 黑白名单
- 威胁情报
- L3/L4 DDoS 清洗
- 七层 DDoS
- 请求走私防护
- Header 规范化
- API Schema 防护
- 签名 URL
- Token 鉴权
- JWT 校验
- Origin 鉴权
- 防盗链签名
- 客户端证书 mTLS
- 密钥轮换
- 敏感信息脱敏
- 日志合规保留

签名 URL 是目前比较明显的缺口。

---

# P1：企业客户常见需求

## 7. 多租户与权限

需要：

- 组织 / 项目 / 域名三级权限
- RBAC
- 只读、运维、管理员角色
- SSO / OIDC / SAML
- MFA
- API Token
- Token 权限范围
- 操作审计已具备，可继续加强
- 配额
- 用量统计
- 账单
- 子账号

---

## 8. 证书与 TLS

已有 ACME，但企业级还需要：

- 自定义证书上传
- 证书到期提醒
- 自动续期失败告警
- 多证书 SNI
- 证书钉扎
- OCSP Stapling
- HSTS
- TLS 版本策略
- 双向 TLS
- 国密 / 商密支持（如目标市场需要）

---

## 9. HTTP/3

目前边缘侧没有看到完整的 HTTP/3 / QUIC 支持。

企业级 CDN 通常需要：

```text
HTTP/3
QUIC
0-RTT
Alt-Svc
```

尤其对移动端和弱网视频场景收益明显。

---

## 10. 压缩与媒体优化

需要：

- Brotli
- Zstandard
- 动态压缩
- 图片自动 WebP/AVIF
- 图片裁剪、缩放、质量
- 视频转码
- 视频截图
- HLS/DASH 打包
- 按设备返回不同格式

这部分是 CDN 产品差异化的重要来源。

---

## 11. API、CLI、IaC

企业客户通常要求：

- OpenAPI 完整文档
- API SDK
- CLI
- Terraform Provider
- GitHub Actions
- 批量导入导出
- 配置模板
- 环境隔离
- 沙箱域名

---

# P2：平台化与差异化

## 12. 流量调度

- Anycast
- DNS GSLB
- 按地理调度
- 按运营商调度
- 按延迟调度
- 按成本调度
- 故障自动切换
- 容量感知调度

## 13. 边缘计算

- Edge Functions
- 轻量 JS/WASM
- 请求/响应改写
- A/B 测试
- 灰度发布
- 边缘鉴权

## 14. 高级缓存

- ESI
- 边缘组装
- 负缓存
- 预热
- 预取
- 缓存预留
- 按标签批量刷新
- 缓存分析
- 回源节省报告

## 15. 运维体系

- 蓝绿升级
- 灰度升级
- 自动回滚
- 节点自动注册
- 节点 Drain
- 混沌测试
- 压测平台
- 故障演练
- 多区域容灾
- PostgreSQL 主备 / PITR
- Redis 高可用
- 配置备份恢复

---

# 建议的实施顺序

## 第一阶段：稳定性

```text
1. 流媒体超时模型
2. 大文件/视频流式回源
3. 多节点缓存一致性
4. 可观测性与告警
5. 配置版本化与回滚
```

## 第二阶段：企业能力

```text
6. 签名 URL / Origin 鉴权
7. RBAC / SSO / API Token
8. 配额 / 用量 / 账单
9. 灰度发布
10. 证书生命周期
```

## 第三阶段：产品差异化

```text
11. HTTP/3
12. 图片/视频优化
13. 边缘计算
14. 智能调度
15. 实时分析
```

---

# 最关键的三个缺口

如果只能优先做三件事：

```text
1. 流媒体长连接与超时模型
2. 多节点共享缓存与一致性
3. 可观测性 + 灰度发布 + 回滚
```

这三项决定系统能不能从“能用”进入“企业可运营”。

其次是：

```text
签名 URL
RBAC / SSO
配额计费
HTTP/3
```

---

# 当前最应该立即修的点

结合你刚遇到的 504：

```text
/api/file/stream 视频流
→ 10 秒源站超时
→ 504
```

这不是缓存 TTL 问题，而是**流式传输超时模型**问题。

建议先把：

```text
连接超时
首字节超时
chunk 空闲超时
整体传输
```

拆开，并让视频流走真正的流式透传，而不是全量收集或全量缓存填充。

这会直接改善视频播放成功率，也是企业级 CDN 的基础能力。


# 最终清理完成

本轮完成了迁移后的收尾，并增加了线上验收手段。

---

# 1. 修复 LargeCache 关闭时的 no-cache 回落

之前存在一个漏洞：

```text
no-cache GET
+ LargeCache 未启用
→ try_large_revalidation 直接返回
→ native_plan 对 no-cache 返回 None
→ 落入 legacy
```

现在：

```text
no-cache GET
→ 先执行普通 SharedCache 条件校验
→ 再判断 LargeCache
```

[apps/edge/src/pingora_edge.rs](apps/edge/src/pingora_edge.rs)

集成测试已覆盖：

```text
no-cache without large cache returns 200
no-cache without large cache revalidates
no-cache without large cache uses origin-304
no-cache GET uses Pingora
```

---

# 2. 小范围 Range 已在 Pingora

## 命中完整缓存

```text
Range: bytes=0-3
→ SharedCache 完整对象
→ Pingora serve_normal_range
→ 206 + 4 bytes
→ x-cache: HIT
```

## 未命中

```text
Range
→ Pingora native streaming
→ 206
→ x-cache: BYPASS
→ range-bypass
```

legacy slice cache 不再参与正常 Range。

---

# 3. WebSocket 明确 legacy-only

```rust
if is_websocket_upgrade(&session.req_header().headers) {
    return self.handle_in_process(session).await;
}
```

WebSocket 不再进入 Pingora HTTP proxy。

---

# 4. 数据面标识

所有响应可带：

```http
x-lagran-datapath: pingora
```

或：

```http
x-lagran-datapath: legacy
```

集成测试已断言：

```text
normal GET uses Pingora
no-cache GET uses Pingora
range cache uses Pingora
```

---

# 5. 数据面指标

新增 Prometheus 指标：

```text
lagran_edge_datapath_pingora_total
lagran_edge_datapath_legacy_total
```

用于确认迁移结果：

```text
sum(rate(lagran_edge_datapath_legacy_total[5m]))
```

理想状态：

```text
legacy 只出现在 WebSocket / 管理接口 / 兜底
普通 GET / Range / no-cache 的 legacy 计数不增长
```

---

# 6. Legacy 入口已标记为兜底

[apps/edge/src/server/handler.rs](apps/edge/src/server/handler.rs)

`proxy_handler` 现在是明确的 legacy-only 入口：

```text
WebSocket
管理接口
native plan 不可用时的兜底
```

如果普通 GET/HEAD 意外进入 legacy，会记录：

```text
WARN legacy GET/HEAD fallback reached
```

并带上：

```text
host
method
path
```

这样可以持续观察是否存在未迁移路径。

---

# 7. 当前路由

```text
普通 GET / HEAD
→ Pingora native

no-cache 普通对象
→ Pingora try_normal_revalidation

no-cache LargeCache
→ Pingora try_large_revalidation

Range 命中完整对象
→ Pingora serve_normal_range

Range 未命中
→ Pingora native streaming

Cookie / Auth / rule bypass GET
→ Pingora streaming

WebSocket
→ legacy

管理接口
→ 管理监听器 / legacy
```

---

# 8. 验证

## Cache rules

```text
ALL CACHE RULE CHECKS PASSED
```

## Cache diagnostics

```text
ALL CACHE DIAGNOSTIC CHECKS PASSED
```

包括：

```text
normal GET uses Pingora
no-cache without large cache revalidates
no-cache without large cache uses origin-304
no-cache GET uses Pingora
range cache uses Pingora
range miss streams from origin
open-ended range streams through Pingora
```

## 单元测试

```text
control: 25 passed
edge:    97 passed
```

## 构建

```text
cargo build --release --target x86_64-unknown-linux-musl -p edge
成功
```

---

# 9. 为什么还没有删除 legacy GET/HEAD 代码

legacy 仍然需要处理：

```text
WebSocket
管理接口
未知域名 / 节点禁用 / native plan 构建失败时的兜底
```

如果直接删除 legacy GET/HEAD 缓存代码，会破坏这些兜底路径。

正确做法是：

```text
先观察 datapath_legacy_total 和 legacy fallback WARN
确认无正常 GET/HEAD 落入 legacy
再删除 legacy 中不可达的缓存分支
```

当前已经具备观察手段：

- `x-lagran-datapath`
- `lagran_edge_datapath_legacy_total`
- `legacy GET/HEAD fallback reached` 日志

---

# 10. 部署

```bash
cargo build --release --target x86_64-unknown-linux-musl -p edge

sudo install -m 755 \
  target/x86_64-unknown-linux-musl/release/lagran-edge \
  /opt/lagran/bin/

sudo systemctl restart lagran-edge
```

---

# 11. 迁移结论

```text
RequestPipeline
  → 统一 preflight
  → 统一 policy
  → 统一 classify
  → 统一 cache key
  → 统一条件请求入口

Pingora
  → 普通 GET/HEAD
  → no-cache / 304
  → Range
  → LargeCache
  → streaming

Legacy
  → WebSocket
  → 管理/兜底
```

正常缓存 GET/HEAD 数据面已经完成从 legacy 到 Pingora 的迁移。

下一步是基于线上 `datapath_legacy_total` 与 fallback WARN 观察一段时间，然后删除 legacy 中已不可达的缓存代码。

==============
# 安全能力落地可行性评估

## 总体判断

当前安全能力主要覆盖：

```text
WAF 基础签名
CC
限流
Bot 基础评分
Referer 防盗链
CORS
IP allow/deny
```

但距离企业级安全体系还有明显差距，尤其是：

```text
请求 body 检测
OWASP CRS / 异常评分
自定义规则表达能力
Geo / ASN
签名 URL / Token
JWT / mTLS
请求走私 / Header 规范化
API Schema
```

其中：

- **签名 URL** 最容易落地，应优先做
- **Header 规范化 + 请求走私防护** 是基础安全能力，成本低、收益高
- **OWASP CRS 全量兼容** 成本很高，不建议从零手写
- **L3/L4 DDoS** 不应由 Edge 应用单独解决，需要基础设施配合

---

# 一、能力现状与可行性

| 能力 | 当前状态 | 可行性 | 建议 |
|---|---|---|---|
| 托管 WAF 规则集 | 有内置 managed 签名，无版本化规则包 | 高 | 做签名规则包 + 版本化下发 |
| OWASP CRS | 无 | 中 | 不建议全量手写；做 CRS 子集或 Coraza sidecar |
| 自定义规则 DSL | 仅 field/op/value | 中高 | 做表达式 DSL v1 |
| IP 黑白名单 | 已有 | 高 | 补 ASN / Geo |
| Geo 黑白名单 | Edge 无 GeoIP | 中 | Edge 加载 GeoLite2 |
| ASN 黑白名单 | 无 | 中 | 需要 ASN 数据库 |
| 威胁情报 | 无 | 中低 | 依赖商业/公开 feed |
| L3/L4 DDoS | 无 | 低（应用层） | 需要清洗中心 / Anycast / BGP |
| 七层 DDoS | 有 CC/限流 | 中高 | 增加自适应和全局策略 |
| 请求走私防护 | 依赖 Hyper/Pingora | 高 | 增加严格校验 |
| Header 规范化 | 部分 | 高 | 统一 canonicalization |
| API Schema 防护 | 无 | 中 | OpenAPI + JSON Schema |
| 签名 URL | 无 | 高 | 第一优先 |
| Token 鉴权 | 无 | 高 | 先做 HMAC / opaque token |
| JWT 校验 | 仅控制面 | 中高 | Edge 增加 JWKS |
| Origin 鉴权 | 无 | 高 | 固定头 / HMAC / mTLS |
| 防盗链签名 | 仅 Referer | 高 | 复用签名 URL |
| 客户端 mTLS | 无 | 中 | Pingora + CA 管理 |
| 密钥轮换 | 无 | 高 | 先做 key id / overlap |
| 敏感信息脱敏 | 部分 | 高 | 日志字段级 redaction |
| 日志合规保留 | 有保留天数 | 中 | 增加导出 / WORM / 法务保留 |

---

# 二、重点能力评估

## 1. 签名 URL

### 可行性：高

这是当前最值得先做的安全能力。

建议设计：

```text
canonical = method + host + path + expires + key_id + client_ip(optional)
signature = HMAC-SHA256(secret, canonical)
```

URL：

```text
?expires=...&kid=...&sig=...
```

需要支持：

- 过期时间
- key id
- 路径绑定
- 方法绑定
- 可选 IP 绑定
- 时钟偏移
- 常量时间比较
- 密钥轮换
- 签名失败 403

### 关键 CDN 问题

签名参数会进入 query，导致缓存 key 碎片化：

```text
/file?a=1&sig=xxx1
/file?a=1&sig=xxx2
```

建议：

```text
先验签
→ 再移除签名参数
→ 用规范化后的 URL 做缓存 key
```

否则签名 URL 会完全失去 CDN 缓存收益。

### 工作量

约 2-3 周：

- Edge 验签模块
- Control 密钥管理
- 缓存 key 规范化
- 密钥轮换
- 测试

**优先级：P0**

---

## 2. Origin 鉴权 + 防盗链签名

### 可行性：高

可以和签名 URL 共用一套 HMAC 框架。

Origin 鉴权方式：

```text
固定 Header
HMAC Header
mTLS
```

防盗链签名：

```text
签名 URL
或 Referer + HMAC
```

工作量：

```text
Origin Header 鉴权：1 周
HMAC Origin：1-2 周
防盗链签名：复用签名 URL，1 周
```

**优先级：P0/P1**

---

## 3. Header 规范化与请求走私防护

### 可行性：高

当前依赖 Hyper/Pingora 解析，但企业级需要显式防护：

```text
Content-Length + Transfer-Encoding 同时存在
多个 Content-Length
Transfer-Encoding: chunked, gzip
Header 名称大小写混用
Header 前导/尾随空格
控制字符
obs-fold
H2 伪 Header
非法 Host
```

建议：

```text
统一 canonical header map
WAF / cache / origin 使用同一份规范化结果
严格模式下直接 400
```

工作量：

```text
规范化：1-2 周
走私校验：1-2 周
测试：1 周
```

**优先级：P0**

---

## 4. 托管 WAF 规则集

### 可行性：高

当前 managed 规则是硬编码签名，缺少：

```text
规则版本
签名校验
灰度发布
回滚
规则包下发
```

建议：

```text
Control 管理规则包
→ 签名 / 校验
→ Edge 拉取
→ 热加载
```

规则包内容：

```json
{
  "version": "...",
  "rules": [...],
  "signature": "..."
}
```

工作量：3-4 周。

**优先级：P1**

---

## 5. OWASP CRS

### 可行性：中

Current WAF 的问题：

```text
只看 path/query/header
不看 body
没有异常评分
没有 CRS 的转换函数和规则链
```

完整 CRS 不能靠简单加正则实现。

### 两种方案

#### 方案 A：Rust 实现 CRS 子集

实现：

```text
SQLi
XSS
LFI
RCE
Scanner
Protocol
```

加异常评分。

优点：

- 无额外进程
- 延迟低

缺点：

- 不是完整 CRS
- 误报/漏报需要持续调优

工作量：6-10 周。

#### 方案 B：Coraza / ModSecurity sidecar

```text
Pingora → Unix Socket / localhost → Coraza
```

优点：

- 完整 CRS
- 规则生态成熟

缺点：

- 多一个进程
- 增加延迟和运维复杂度
- 需要 body 缓冲
- 与现有 Rust WAF 需要统一 verdict

工作量：4-6 周集成，但长期维护更可控。

**建议：**

```text
不要从零手写完整 CRS
先做 Rust 规则引擎 + CRS 子集
企业客户强制要求完整 CRS 时再接 Coraza sidecar
```

**优先级：P1**

---

## 6. 自定义规则 DSL

当前：

```text
field + op + value
```

只有：

```text
contains
equals
prefix
suffix
```

企业需要：

```text
AND / OR / NOT
正则
CIDR
Geo / ASN
Header 组合
Body 字段
频率条件
计数窗口
转换函数
```

建议 DSL v1：

```text
method == "POST"
and path starts_with "/api/"
and header["content-type"] contains "json"
and geo in ["CN","HK"]
and rate(ip, 60s) > 100
```

落地方式：

```text
Parser
→ AST
→ 编译为规则
→ 统一 verdict
```

工作量：

```text
DSL v1：3-4 周
可视化编辑器：2-3 周
```

**优先级：P1**

---

## 7. IP / Geo / ASN 黑白名单

### IP

已有，可继续增强：

```text
CIDR
IPv6
优先级
allow 优先于 deny
```

### Geo

Control 已有 GeoIP 调度表，但 Edge 没有请求级 Geo。

建议 Edge 加载：

```text
MaxMind GeoLite2 Country
或 IP2Location
```

### ASN

需要 ASN 数据库：

```text
MaxMind GeoLite2 ASN
```

工作量：

```text
GeoIP 加载 + 热更新：2 周
ASN：1-2 周
控制台配置：1 周
```

风险：

- 数据授权
- 内存占用
- 更新频率
- IPv6 覆盖

**优先级：P1**

---

## 8. 威胁情报

### 可行性：中低

需要：

```text
商业/公开 feed
去重
TTL
Redis 共享
误报处理
```

风险：

- feed 授权
- 数据质量
- 误封
- 更新延迟

建议：

```text
先做可插拔 threat feed 接口
默认不启用
支持 allowlist 覆盖
```

工作量：4-6 周。

**优先级：P2**

---

## 9. L3/L4 DDoS

### 可行性：低（应用层无法独立完成）

Rust Edge 只能做：

```text
连接数限制
SYN 相关系统参数
每 IP 并发限制
慢连接超时
```

真正的 L3/L4 清洗需要：

```text
Anycast
BGP
清洗中心
云厂商 DDoS 防护
XDP / eBPF
```

建议：

```text
不要承诺应用层解决 L3/L4
与云厂商 / 清洗服务配合
```

**优先级：基础设施项目**

---

## 10. 七层 DDoS

### 可行性：中高

已有 CC 和限流，可增强：

```text
全局 RPS
路径级 RPS
IP 并发连接
慢速攻击
Header 慢速
Body 慢速
自适应阈值
Bot 行为评分
```

工作量：4-6 周。

**优先级：P1**

---

## 11. API Schema 防护

### 可行性：中

需要：

```text
OpenAPI 3 导入
JSON Schema 校验
Body 缓冲
路径匹配
误报模式
```

只对：

```text
Content-Type: application/json
小 body
API 路径
```

启用。

工作量：

```text
基础 JSON Schema：4-5 周
OpenAPI 导入/UI：3-4 周
```

**优先级：P2**

---

## 12. JWT 校验

### 可行性：中高

Edge 需要：

```text
JWKS 拉取
缓存
RS256 / ES256
iss / aud / exp / nbf
kid 轮换
```

工作量：2-3 周。

注意：

```text
不要只做 HS256 共享密钥
否则多节点密钥分发困难
```

**优先级：P1**

---

## 13. mTLS

### 可行性：中

Pingora 支持客户端证书校验，但需要：

```text
CA 管理
每域名 client CA
证书吊销 CRL / OCSP
证书生命周期
控制台
```

工作量：4-6 周。

**优先级：P2**

---

## 14. 密钥轮换

### 可行性：高

这是签名 URL / JWT / Origin 鉴权的共同基础。

需要：

```text
key id
active / next key
双 key 验证窗口
控制面轮换
Edge 热加载
审计
```

工作量：2-3 周。

**建议先于签名 URL 完成基础 key 管理。**

**优先级：P0**

---

## 15. 敏感信息脱敏

### 可行性：高

当前访问日志记录：

```text
path
query
user-agent
referer
```

需要：

```text
query 参数脱敏
Authorization
Cookie
自定义 Header
手机号 / 邮箱 / 身份证
WAF 日志
```

工作量：1-2 周。

**优先级：P1**

---

## 16. 日志合规保留

已有：

```text
LOG_RETENTION_DAYS
```

还需要：

```text
不可篡改存储
导出
法务保留
按项目隔离
删除审计
```

工作量：2-4 周，取决于存储方案。

**优先级：P2**

---

# 三、推荐实施顺序

## 第一阶段：基础安全闭环（4-6 周）

```text
1. 密钥管理与轮换
2. 签名 URL
3. Origin 鉴权
4. 防盗链签名
5. Header 规范化
6. 请求走私防护
7. 敏感日志脱敏
```

这些成本低、收益高，且不依赖复杂规则引擎。

---

## 第二阶段：WAF 能力升级（6-10 周）

```text
1. 请求 body 检测
2. 异常评分
3. CRS 子集
4. 自定义规则 DSL v1
5. Geo / ASN 黑白名单
6. 七层 DDoS 增强
```

---

## 第三阶段：企业身份与 API 防护（8-12 周）

```text
1. JWT / JWKS
2. mTLS
3. API Schema
4. 威胁情报接口
5. 日志合规导出
```

---

## 第四阶段：基础设施安全

```text
1. L3/L4 DDoS 清洗
2. Anycast / BGP
3. 威胁情报商业 feed
4. 全量 CRS / Coraza sidecar
```

---

# 四、总体工作量

按 1 名资深 Rust + 1 名控制面/前端工程师估算：

| 阶段 | 工作量 |
|---|---|
| 基础安全闭环 | 4-6 周 |
| WAF 升级 | 6-10 周 |
| 身份与 API 防护 | 8-12 周 |
| 基础设施安全 | 外部依赖，3-6 个月 |

总计：

```text
核心应用层安全能力：约 4-6 个月
完整企业级安全体系：约 8-12 个月
```

---

# 五、最建议立即做的三件事

```text
1. 密钥管理 + 签名 URL
2. Header 规范化 + 请求走私防护
3. WAF body 检测 + 异常评分
```

原因：

- 签名 URL 是当前最明显缺口
- Header/走私防护是低成本高收益
- 当前 WAF 不看 body，无法支撑 CRS 和 API 防护

---

# 六、关键风险

## WAF 误报

需要：

```text
monitor 模式
灰度
按域名关闭单条规则
误报样本
```

## Body 检测内存

需要：

```text
最大 body
Content-Type 白名单
流式跳过
视频/上传不检测
```

## 签名 URL 与缓存

必须：

```text
验签后移除签名参数
规范化缓存 key
```

否则缓存命中率会归零。

## CRS 完整性

不要承诺“完整 OWASP CRS”，除非接入 Coraza/ModSecurity。

## L3/L4

不要用应用层代码承诺 L3/L4 清洗能力。

---

# 结论

```text
签名 URL、Origin 鉴权、密钥轮换、Header 规范化、请求走私防护、日志脱敏
→ 可行性高，建议立即做

托管 WAF 规则包、DSL v1、Geo/ASN、JWT、七层 DDoS 增强
→ 可行性中高，建议第二阶段

OWASP CRS 全量、API Schema、mTLS、威胁情报
→ 可行性中等，需要独立设计

L3/L4 DDoS
→ 应用层无法独立解决，必须依赖清洗基础设施
```

最优先落地：

```text
1. 密钥管理
2. 签名 URL
3. Header 规范化 / 请求走私
4. WAF body 检测
```

当前 Origin auth 未覆盖预取任务；预取回源仍需后续补充。
完善control、edge、dns常用的子命令功能。

Nov 09 15:17:07 s1.akgo.net lagran-edge[28397]: 2026-11-09T07:17:07.653083Z  WARN edge::server::handler: legacy GET/HEAD fallback reached host=www.akgo.net method=GET path=/api/file/stream
Nov 09 15:17:10 s1.akgo.net lagran-edge[28397]: 2026-11-09T07:17:10.138499Z  WARN edge::server::handler: origin failed, trying next origin origin=https://45.63.84.225:443
Nov 09 15:17:10 s1.akgo.net lagran-edge[28397]: 2026-11-09T07:17:10.138685Z  WARN edge::server::handler: origin fetch failed error=read origin body: length limit exceeded origin=https://45.63.84.225:443
Nov 09 15:17:10 s1.akgo.net lagran-edge[28397]: 2026-11-09T07:17:10.138794Z  WARN edge::server::prefetch: prefetch request failed domain=www.akgo.net path=/api/file/stream?code=E7HNQc5L status=502 Bad Gateway
Nov 09 15:21:27 s1.akgo.net lagran-edge[28397]: 2026-11-09T07:21:27.878345Z  WARN edge::server::handler: legacy GET/HEAD fallback reached host=test.akgo.net method=GET path=/testfile.10m.bin
Nov 09 15:21:29 s1.akgo.net lagran-edge[28397]: 2026-11-09T07:21:29.726101Z  WARN edge::server::handler: origin failed, trying next origin origin=https://45.63.84.225:443
Nov 09 15:21:29 s1.akgo.net lagran-edge[28397]: 2026-11-09T07:21:29.726244Z  WARN edge::server::handler: origin fetch failed error=read origin body: length limit exceeded origin=https://45.63.84.225:443
Nov 09 15:21:29 s1.akgo.net lagran-edge[28397]: 2026-11-09T07:21:29.726343Z  WARN edge::server::prefetch: prefetch request failed domain=test.akgo.net path=/testfile.10m.bin status=502 Bad Gateway
Nov 09 15:23:02 s1.akgo.net lagran-edge[28397]: 2026-11-09T07:23:02.479642Z  WARN edge::server::handler: legacy GET/HEAD fallback reached host=console.lagrancdn.com method=GET path=/_nuxt/DeGFQcFx.js
预热大文件比如“https://www.akgo.net/api/file/stream?code=E7HNQc5L”和“https://test.akgo.net/testfile.10m.bin”
预热小文件比如“https://console.lagrancdn.com/_nuxt/DeGFQcFx.js”也警告“legacy GET/HEAD fallback”
预热文件的时候，如果cache key中的lang和label参数与实际用户的lang和label参数不一致，是否预热的必要性就大打折扣了，如何处理这个问题？

用户在control前端页面在升级control和edge的时候，当后台还在进行升级的时候，用户可以多次点击升级按钮，请避免这种情况（即升级完成之前用户再次不能点击升级按钮）。
用VitePress新建一个针对本项目的文档网站，计划所有文档托管到github pages。项目目录跟本项目同级（我已经创建好lagran93.github.io文件夹，你可以在这个目录中完成源代码），文档主要来自本项目根目录中docs文件夹中的md文件，你可以分门别类重新梳理全部文档，主要内容为部署、使用、调试、维护手册等，使得更加简洁明、清晰易用了。

优化“缓存预热”页面UI：
1、把目前的“手动预热”区域取消，在“新增定时任务”左边新增“手动预热”按钮，点击按钮，弹出手动预热表单弹出框进行手动预热操作；
2、把“执行概览”分成四个小卡片展示，就像“仪表盘”页面上四个小卡片一样；
3、“定时预热”、“预热任务”区域不变。