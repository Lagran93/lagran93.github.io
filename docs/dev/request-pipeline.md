# 请求流水线

## 目标

Pingora 与 Legacy 共用同一套：

- 规则匹配
- 请求分类
- Cache Key
- 条件请求
- 缓存策略

避免两个数据面行为漂移。

## 阶段

```text
1. Host / 域名解析
2. 规则匹配（路径、方法、Query、Content-Type）
3. Preflight（HTTPS 跳转、Bot、CC、限速、WAF、防盗链）
4. 请求分类（cache / bypass / no-cache / range / websocket）
5. Cache Key
6. L1 / L2 / L3 查找
7. 回源 / 合并回源
8. 响应策略 / TTL / 存储
9. 响应头 / 日志 / 指标
```

## 数据面选择

| 场景 | 数据面 |
| --- | --- |
| 普通 GET/HEAD | Pingora |
| Range / 大文件 | Pingora |
| WebSocket | Legacy |
| 管理接口 | Pingora management / Axum |
| 无法构建 native plan | Legacy 兜底 |

Legacy GET/HEAD 会打印：

```text
legacy GET/HEAD fallback reached
```

大量出现说明有请求未走原生路径，应排查。

## Cache Key

```text
METHOD:host:path[?query]
|lang=<hash>
|origin=<hash>
```

规则/域名可忽略请求头。`Access-Control-Request-*` 当前不进入 GET/HEAD key。

## 测试

- `cargo test -p edge`
- `cargo test -p control`
- 集成测试
- 真实请求验证 `x-lagran-datapath`

完整迁移说明见 [参考](/reference/request-pipeline-migration)。
