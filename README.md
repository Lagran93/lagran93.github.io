# Lagran CDN 文档站

基于 [VitePress](https://vitepress.dev/) 的 Lagran CDN 文档站点，使用 GitHub Pages 发布。

## 本地开发

需要 Node.js 18+。

```bash
npm install
npm run docs:dev
```

打开终端输出的本地地址。

## 构建

```bash
npm run docs:build
npm run docs:preview
```

构建产物位于：

```text
docs/.vitepress/dist
```

## 发布

仓库已包含 GitHub Actions：

```text
.github/workflows/deploy.yml
```

推送到 `main` 后会自动构建并部署到 GitHub Pages。

首次使用时，在 GitHub 仓库设置中：

```text
Settings → Pages → Build and deployment → Source: GitHub Actions
```

## 目录

```text
docs/
├── guide/       入门、快速开始、架构
├── deploy/      Control / Edge / DNS / TLS / 升级
├── use/         域名、缓存、预热、WAF、证书、发布、GeoDNS
├── ops/         监控、备份、排查、安全
├── dev/         本地开发、请求流水线
├── reference/   原始完整文档
└── public/      静态资源
```

## 文档来源

主要整理自主项目仓库：

```text
https://github.com/Lagran93/Lagran/tree/main/docs
```

`docs/reference/` 保留完整原始手册，便于查阅细节；其余页面为重新梳理后的导航式文档。


## 绑定自定义域名

仓库已内置：



使用自定义域名 docs.lagrancdn.com：

1. DNS 添加 CNAME：



2. GitHub 仓库：



3. 等待 GitHub DNS 校验通过，勾选 **Enforce HTTPS**。

4. 如果 GitHub 提示域名验证，按提示添加：



Cloudflare 用户建议先使用 **DNS only（灰云）**，证书签发后再决定是否代理。

VitePress 使用根路径：



因此自定义域名不需要额外路径前缀。
