# WAF 与 CC 防护

## WAF

控制台：

```text
WAF 防护 → 域名 → 启用
```

能力：

- SQL 注入、XSS、路径穿越、RCE、SSRF、XXE、Log4Shell、CRLF、SSTI、NoSQL、LDAP、Java 反序列化
- 扫描器识别
- 托管规则包
- 自定义规则 DSL
- IP / Geo / ASN 黑白名单
- 观察 / 拦截模式
- 日志与告警

## 自定义规则 DSL

支持字段、运算符、动作组合，例如：

```text
ip in 10.0.0.0/8 and path startswith /admin
```

具体语法与字段以控制台规则编辑器提示为准。

## CC 防护

CC 针对 L7 洪水：

- 按 IP / 路径 / 客户端聚合
- 滑动窗口
- 全局阈值
- 攻击模式
- 挑战 / 封禁
- Redis 跨节点共享封禁

## 挑战

支持：

- JS Challenge
- CAPTCHA
- 清除 Cookie

挑战通过后写入 clearance cookie。

## 行为评分

根据请求频率、路径、User-Agent、Header 等累计评分，达到阈值后挑战或封禁。

## 建议

- 先 `monitor` 观察误报。
- 再 `block`。
- 对登录、支付、API 路径单独设置更严格策略。
- 不要把 `EDGE_ADMIN_LISTEN` 暴露到公网。
- WAF 日志与访问日志分开保留。

## 排障

| 现象 | 检查 |
| --- | --- |
| 正常请求被拦截 | WAF 日志、规则命中、IP 黑白名单 |
| 挑战循环 | Cookie 域、HTTPS、浏览器 |
| CC 误封 | 阈值、路径预算、共享封禁 |
| WAF 不生效 | 域名配置、规则包版本、Edge 同步 |
