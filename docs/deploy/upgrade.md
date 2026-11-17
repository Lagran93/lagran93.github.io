# 升级与回滚

## 升级顺序

```text
1. 备份数据库（pg_dump）
2. Control
3. Edge（逐台或按区域滚）
4. DNS
5. 前端（重新 generate + 发布静态文件）
```

Control 的数据库迁移在进程启动时自动执行，因此**先备份再升级 Control**。Edge/DNS 与服务端协议向后兼容，但配置发布灰度回执、预热 Range 等新行为需要 Control 与 Edge 版本匹配。

## Control 系统升级

管理员在：

```text
系统设置 → 系统升级
```

流程：

```text
检测 GitHub Release（LAGRAN_UPDATE_REPO）
→ 写入 /var/lib/lagran/update.request
→ lagran-update.path 触发 lagran-update.service（root）
→ 下载 Release bundle 并校验 SHA256SUMS
→ 备份旧二进制到 /var/lib/lagran/update-backup/<tag>-<时间戳>
→ 安全解压（拒绝绝对路径、../ 与链接成员）
→ 替换 control / edge / dns / web
→ 重启已启用的服务
→ 写入 update.status
```

### 单实例保护

存在 `update.request` 或状态为 `queued/running/downloading/installing/restarting` 时，再次触发会返回：

```http
409 update already queued or running
```

前端按钮在升级期间保持禁用，刷新页面后会从 `update.status` 恢复禁用状态。

### 前置条件

旧部署可能缺少更新助手，需要重新执行一次安装器补齐：

```bash
sudo ./install.sh control
```

它会安装 `/opt/lagran/bin/lagran-update`、`lagran-update.path`、`lagran-update.service`。

## Edge 节点升级

控制台：

```text
边缘节点 → 升级
```

流程：

```text
Control 解析 Release 标签
→ POST {agent_url}/__lagran/update
→ Edge 校验令牌后写入 edge-update.request
→ lagran-edge-update.path 触发 root 助手
→ 下载、校验、备份、替换、重启 lagran-edge
```

Edge 助手与状态文件：

```text
/opt/lagran/bin/lagran-edge-update
/etc/lagran/edge-update.env          # 可选：LAGRAN_UPDATE_REPO、路径覆盖
/var/lib/lagran/edge-update.request
/var/lib/lagran/edge-update.status
```

没有安装 `lagran-edge-update` 的旧节点，先在该节点执行：

```bash
sudo ./install.sh edge
```

## 前端升级

前端是静态站点，升级后需要重新构建并替换：

```bash
cd apps/frontend
npm ci
npm run generate            # 产物：apps/frontend/dist
sudo rsync -a --delete dist/ /opt/lagran/web/
```

`NUXT_PUBLIC_API_BASE` 是构建期变量，改变 API 地址必须重新 `generate`。

## 回滚

### 配置回滚（不需要重新部署）

```text
配置发布 → 版本历史 → 选择上一个版本 → 回滚
配置发布 → 发布单 → 回滚当前发布
```

灰度失败时系统会自动回滚，旧配置继续生效。

### 二进制回滚

更新助手在替换前会备份旧二进制：

```bash
ls -lt /var/lib/lagran/update-backup/ | head
# 例：/var/lib/lagran/update-backup/v0.1.9-20261115T101500Z
```

恢复时停止服务、拷回二进制、再启动：

```bash
sudo systemctl stop lagran-control
sudo cp /var/lib/lagran/update-backup/<tag>-<时间戳>/lagran-control /opt/lagran/bin/
sudo systemctl start lagran-control
```

::: warning 数据库迁移不可自动回退
如果新版本带迁移，回滚二进制前需要确认数据库仍兼容，必要时从升级前的 `pg_dump` 恢复。生产升级请先备份。
:::

### 配置发布回滚 vs 系统回滚

- 只改错了域名/规则 → 用配置发布回滚，秒级生效
- 新版本二进制异常 → 二进制回滚 + 数据库按需恢复

## 升级失败排查

```bash
systemctl status lagran-update.service lagran-update.path
journalctl -u lagran-update.service -n 200 --no-pager
cat /var/lib/lagran/update.status

systemctl status lagran-edge-update.service lagran-edge-update.path
journalctl -u lagran-edge-update.service -n 200 --no-pager
cat /var/lib/lagran/edge-update.status
```

如果助手异常退出，可能留下：

```text
/var/lib/lagran/update.request
update.status = running
```

确认没有更新进程后清理这些文件，否则会一直返回 409：

```bash
rm -f /var/lib/lagran/update.request
```

| 现象 | 排查 |
| --- | --- |
| 提示无更新 | `LAGRAN_UPDATE_REPO` 错误；Release 没有对应平台资产；未推送版本标签 |
| 一直 409 | 遗留的 `update.request` 或 `running` 状态 |
| 下载失败 | 节点无法访问 GitHub；需要代理时配置 `HTTPS_PROXY` |
| 校验失败 | `SHA256SUMS` 与资产不匹配；下载被截断 |
| 服务起不来 | `journalctl -u lagran-control`，常见为数据库迁移失败、配置项改名 |
| Edge 升级后离线 | 检查 `AGENT_TOKEN`/`CHALLENGE_SECRET` 是否被覆盖，节点令牌是否仍有效 |

