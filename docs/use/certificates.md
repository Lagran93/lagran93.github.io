# 证书管理

## 证书列表

```text
证书管理 → 上传证书
```

填写：

- 域名
- 证书 PEM
- 私钥 PEM
- 备注

保存后下发 Edge，Edge 热加载 SNI。

## ACME

1. 域名 A/CNAME 指向 Edge。
2. 80 端口可达。
3. 选择 Staging 测试。
4. 成功后切生产 Let's Encrypt。

生产有速率限制，失败时先用 Staging 排查。

## 证书轮换

- 提前上传新证书。
- 修改域名绑定。
- 观察生效后再删除旧证书。
- 不要直接覆盖正在使用的证书。

## 验证

```bash
curl -Iv https://cdn.example.com/
openssl s_client -connect cdn.example.com:443 -servername cdn.example.com
```

检查域名、有效期、证书链。

## 常见问题

| 现象 | 排查 |
| --- | --- |
| 证书未生效 | Edge 是否收到、是否重载 |
| SNI 错误 | 域名与证书 SAN |
| ACME 失败 | 80 端口、DNS、限流 |
| 浏览器警告 | 证书链不完整 |
| 证书过期 | 到期告警、自动续期 |
