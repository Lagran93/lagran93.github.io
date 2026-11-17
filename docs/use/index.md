# 使用总览

控制台围绕「概览 → 加速服务 → 运维监控 → 系统」组织，所有业务对象都归属于**项目**，权限由**用户组**和**项目成员关系**共同决定。

## 菜单结构

```text
概览
  └─ 仪表盘
加速服务
  ├─ 域名管理
  ├─ 接入向导
  ├─ 缓存规则
  ├─ 缓存诊断
  ├─ WAF 防护
  ├─ 证书管理
  ├─ 缓存刷新
  ├─ 缓存预热
  └─ 配置发布            （管理员）
运维监控
  ├─ 边缘节点            （管理员）
  ├─ 统计分析
  ├─ 大屏监控
  ├─ 告警中心
  ├─ 访问日志
  ├─ 操作审计            （管理员）
  └─ 登录日志
系统
  ├─ 项目管理
  ├─ 用户管理            （管理员）
  ├─ 用户组              （管理员）
  ├─ Shield 节点         （管理员）
  └─ 系统设置
```

## 角色与权限

三层结构，从外到内依次收敛：

| 层级 | 作用 |
| --- | --- |
| 全局角色 | `admin` 或 `user`。admin 可见全部项目、节点、审计，并可管理用户与用户组 |
| 用户组 | 决定“能否进入某个功能”，权限多组取并集 |
| 项目成员 | 决定“能操作哪些域名/数据”：`owner`/`admin` 读写，`member` 只读 |

模块权限（`系统 → 用户组`）：

```text
domain:read/write      cache:read/write        waf:read/write
cert:read/write        prefetch:read/write     project:read/write
node:read/write        analytics:read          config:read/write
alert:read/write       audit:read              settings:read/write
user:read/write
```

几个要点：

- 模块权限只控制“能否进入该功能页/调用该模块接口”，**不会**扩大可见的域名范围
- 未加入任何用户组的用户沿用项目角色权限
- 全局 admin 不受用户组限制
- 用户组变更在会话缓存 TTL（默认 30 秒）内生效

常见组合：

```text
只读运维组    domain:read, cache:read, waf:read, analytics:read
WAF 值班组    domain:read, waf:read, waf:write
缓存管理员    domain:read, cache:read, cache:write, prefetch:read, prefetch:write
```

## 推荐上手顺序

1. [项目、权限与域名接入](/use/domains)
2. [缓存规则与 Cache Key](/use/cache)
3. [刷新与预热](/use/prefetch)
4. [WAF 与 CC 防护](/use/waf)
5. [证书管理](/use/certificates)
6. [配置发布](/use/releases)
7. [GeoDNS 调度](/use/geodns)
8. [Origin Shield](/use/origin-shield)

## 配置生效时间

| 操作 | 生效方式 |
| --- | --- |
| 编辑域名/规则/WAF（未启用发布） | Edge 每 15 秒拉取，最长约 15 秒生效 |
| 编辑域名/规则/WAF（已启用发布） | 需要创建发布单并审批，见 [配置发布](/use/releases) |
| 刷新缓存 | 立即下发到在线 Edge，失败会重试 |
| 证书 | 推送到在线 Edge，离线节点下次同步 |
| 节点启停 | 节点心跳响应中返回，15 秒内生效 |

