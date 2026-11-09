# 升级与回滚

## 控制面系统升级

管理员在：

```text
系统设置 → 系统升级
```

流程：

```text
检测 GitHub Release
→ 写入 update.request
→ lagran-update.path 触发 root 助手
→ 下载 / 校验 SHA256
→ 备份旧二进制
→ 替换 control / edge / dns / web
→ 重启已启用服务
```

### 单实例保护

存在 `update.request` 或状态为 `running/queued/downloading/installing/restarting` 时：

```http
409 update already queued or running
```

前端按钮在升级期间保持禁用；页面刷新后从 `update.status` 恢复禁用状态。

### 前置条件

旧部署需要重新执行：

```bash
./install.sh control
```

安装 `lagran-update.path`、`lagran-update.service` 和更新助手。

## Edge 节点升级

```text
边缘节点 → 升级
```

流程：

```text
Control 解析 Release
→ 调用节点 /__lagran/update
→ Edge 写入更新请求
→ root 助手下载、校验、替换、重启
```

需要 `install.sh edge` 安装 `lagran-edge-update`。

## 升级顺序

```text
1. Control
2. Edge
3. DNS
4. 前端
```

配置发布场景下，升级后还需要发布版本。

## 回滚

### 配置回滚

```text
配置发布 → 版本历史 → 回滚
```

### 发布单回滚

```text
配置发布 → 发布单 → 回滚
```

### 二进制回滚

更新助手保留旧二进制备份：

```text
/var/lib/lagran/update-backup/ 或 edge-update-backup/
```

按实际安装脚本路径恢复。

## 升级失败

检查：

```bash
systemctl status lagran-update.service
journalctl -u lagran-update.service -n 100 --no-pager
cat /var/lib/lagran/update.status
```

如果更新助手异常退出留下：

```text
/var/lib/lagran/update.request
update.status = running
```

确认没有更新进程后清理，否则会一直返回 409。
