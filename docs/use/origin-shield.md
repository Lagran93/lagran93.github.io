# Origin Shield

Origin Shield 是区域级的汇聚缓存：多台普通 Edge 反复回源同一个对象时，先向 Shield 请求，Shield 未命中才回源。用于降低源站带宽、连接数与跨节点重复回源。

## 适用场景

- 多台 Edge 反复回源同一批大对象/视频分片
- 源站带宽或连接数已成瓶颈
- 希望把源站请求集中到少数节点，便于源站侧限流和白名单
- 暂时不需要全互联 P2P 缓存

Origin Shield **不是**“任意节点互相取对象”，而是一台（或一组）指定缓存节点。

## 链路

```text
普通 Edge
  → 本地 L1/L2/L3 命中 → 直接返回
  → 本地未命中 → 向 Origin Shield 请求（优先级 -1 的回源目标）
      → Shield 命中 → 返回
      → Shield 未命中 → 回源站
  → Shield 不可用 → 按普通源站池顺序回退
```

- 普通 Edge 请求 Shield 时仍然发送**公开业务域名 Host**，因此 Shield 必须能按该域名路由
- Shield 自身的 cache miss 不再指向 Shield（靠 `EDGE_SHIELD_DISABLED=true` 保证）
- Shield 的证书/SNI 必须匹配内部地址

## 设计约束：Shield 地址来自白名单

普通用户**不能**在域名上填写任意 Shield URL。地址由管理员在控制台登记，域名只能下拉选择：

```text
系统 → Shield 节点 → 新增
  名称：shield-s1
  URL ：https://shield-s1.internal.example.com
  启用：是
```

后端校验（`apps/control/src/api/shield_node.rs`）：

| 规则 | 说明 |
| --- | --- |
| 仅 `http://` / `https://` | 必须是 origin，不含 path、query、fragment、userinfo |
| 必须已在 `shield_nodes` 表中 | 域名 `shield_url` 只能引用白名单内的地址 |
| 只能选择启用中的节点 | 停用后不能保存到新域名 |
| 仍被域名引用时不能停用/删除 | 先解除引用，避免留下悬空配置 |

这样做的原因是 SSRF 防护：否则任意域名所有者都能让 Edge 把源站请求指向内网地址。

::: warning 历史遗留值
如果某域名的 `shield_url` 不在白名单中（例如升级前填写），下拉框会显示“当前值（未登记或已停用）”。请管理员先在「Shield 节点」登记该地址，或把域名改回“关闭”。
:::

## 部署顺序

```text
1. 部署 Shield 节点（可按普通 Edge 安装，但要有独立的大缓存磁盘）
2. Shield 节点设置 EDGE_SHIELD_DISABLED=true 并重启
3. 管理员在「系统 → Shield 节点」登记内部地址并启用
4. 在目标域名设置中选择该 Shield
5. 普通 Edge 保持 EDGE_SHIELD_DISABLED=false
6. 验证冷请求由 Shield 承接
```

### Shield 节点配置

```ini
# /etc/lagran/edge.env（Shield 节点）
LARGE_CACHE_ENABLED=true
LARGE_CACHE_DIR=/var/lib/lagran/large-cache
LARGE_CACHE_MAX_BYTES=21474836480
LARGE_CACHE_MIN_FREE_BYTES=1073741824

# 关键：避免 Shield 的 miss 再次请求自己，形成回源环
EDGE_SHIELD_DISABLED=true
```

### 普通 Edge 配置

```ini
EDGE_SHIELD_DISABLED=false
```

`EDGE_SHIELD_DISABLED` 只对**自身**生效：Shield 节点忽略域名上的 `shield_url`，其他 Edge 仍会使用 Shield。

## 验证

```bash
# 1. 从普通 Edge 取一个冷对象（先刷新掉该 URL 的缓存）
curl -sD - -o /dev/null -H 'Host: cdn.example.com' http://<edge>:8081/file.bin

# 2. Shield 的缓存目录应出现对象
ls -lt /var/lib/lagran/large-cache | head

# 3. Shield 访问日志中应出现该请求
journalctl -u lagran-edge -n 50 | grep cdn.example.com

# 4. 再次从普通 Edge 请求，应为本地命中
curl -sD - -o /dev/null -H 'Host: cdn.example.com' http://<edge>:8081/file.bin
```

也可以使用「缓存诊断」对比普通 Edge 与 Shield 的命中情况。

## 回源环：必须避免的错误

```text
Shield 节点的 shield_url 指向自己
+ Shield 未设置 EDGE_SHIELD_DISABLED=true
→ Shield 的 miss 再次请求自己 → 无限循环，直到超时/耗尽连接
```

检查方法：

```bash
# 确认 Shield 节点上的变量
grep EDGE_SHIELD_DISABLED /etc/lagran/edge.env
systemctl show lagran-edge -p Environment | tr ' ' '\n' | grep SHIELD
```

## 注意事项

- Shield 地址必须能被普通 Edge 访问，但**不要暴露公网**
- Shield 仍接收公开业务域名 Host，因此该域名必须在 Shield 上存在（配置会同步到所有节点）
- Shield 故障时普通 Edge 会按普通源站池回退，不会中断服务
- Shield 是区域汇聚点，建议按区域部署，并监控磁盘、带宽与 fill drop 指标
- 大缓存是节点本地状态：不同 Shield 节点之间不共享分片进度

## 相关

- [缓存规则 · 普通缓存与大对象缓存](/use/cache#普通缓存与大对象缓存)
- [部署 Edge · Origin Shield](/deploy/edge)
- [完整手册 · Origin Shield 配置](/reference/Origin%20Shield配置)
