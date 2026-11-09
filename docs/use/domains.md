# 项目与域名

## 项目

- 管理员可看全部项目。
- 普通用户只能看到自己所属项目。
- 新建域名时可选择项目；不选则进入个人 Default 项目。

## 接入域名

```text
域名管理 → 新增域名
```

填写：

| 字段 | 说明 |
| --- | --- |
| 域名 | 例如 `cdn.example.com` |
| 源站 | `https://origin.example.com` |
| 项目 | 归属项目 |
| 协议 | HTTP / HTTPS |
| 端口 | 源站端口 |

保存后：

1. 在 DNS 服务商把域名 CNAME 到 Edge 或 GeoDNS Zone。
2. 等待 DNS 生效。
3. 验证响应头。

## 高级设置

域名高级设置包含：

- 忽略 URL 查询串
- Cache Key 忽略请求头（Origin / Accept-Language）
- CORS 允许源
- 防盗链 Referer 白名单
- 源站超时
- 自定义响应头
- 速率限制
- CC 防护
- 签名 URL
- Origin 鉴权
- 配置发布提示

### Cache Key 忽略请求头

```text
Origin           [继承域名] [忽略] [区分]
Accept-Language  [继承域名] [忽略] [区分]
```

仅当响应内容不随该头变化时忽略：

- `Access-Control-Allow-Origin` 固定时才忽略 Origin；
- 单语言站点才忽略 Accept-Language。

## 验证

```bash
curl -I https://cdn.example.com/
```

关键响应头：

```http
x-lagran-datapath: pingora
x-cache: HIT | MISS
x-lagran-cache-source: l1 | l2 | l3 | origin
x-powered-by: lagran-edge
```
