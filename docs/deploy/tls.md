# HTTPS 与证书

## 证书来源

| 方式 | 适用 |
| --- | --- |
| 控制台上传 | 已有证书、通配符、企业证书 |
| ACME HTTP-01 | 单域名，80 端口可达 |
| Caddy 自动证书 | 控制台/前置代理 |
| 手动文件挂载 | 自定义部署 |

## 控制台上传

```text
证书管理 → 上传证书
→ 域名
→ 证书 PEM
→ 私钥 PEM
→ 保存
→ 下发 Edge
```

Edge 会热加载 SNI，不需要重启。

## ACME

1. 域名 A/CNAME 指向 Edge。
2. 80 端口可达。
3. 控制台选择 Staging 先测试。
4. 成功后切换生产 Let's Encrypt。

注意生产速率限制。

## Caddy

```text
console.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

Edge 数据面如由 Caddy 前置，要避免 Caddy 与 Edge 同时监听 443。

## HTTP → HTTPS

- 在 Edge 配置 HTTPS 监听与证书。
- 设置 `EDGE_HTTPS_REDIRECT_PORT=443`。
- 确保 80 端口用于 ACME 或跳转。

## 验证

```bash
curl -Iv https://cdn.example.com/
openssl s_client -connect cdn.example.com:443 -servername cdn.example.com
```

检查：

- SNI 返回正确证书；
- 证书链完整；
- 到期时间；
- HTTP/2 / HTTP/3（如启用）。

## 故障

| 现象 | 原因 |
| --- | --- |
| 证书不存在 | 未上传或未下发 |
| SNI 错误 | 域名证书未匹配 |
| ACME 失败 | 80 端口不可达、DNS 错误、速率限制 |
| 浏览器警告 | 证书链不完整、域名不匹配 |
| 上传后仍旧证书 | Edge 未重载或缓存 |
