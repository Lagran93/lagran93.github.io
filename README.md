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
├── guide/       项目介绍、快速开始、系统架构
├── deploy/      总览、Control、Edge、DNS、HTTPS/TLS、升级与回滚
├── use/         总览与权限、域名接入、缓存、刷新预热、WAF/CC、
│                证书、配置发布、GeoDNS、Origin Shield
├── ops/         运维总览、监控、备份、故障排查、安全清单
├── dev/         开发总览、本地开发与测试、请求流水线
├── reference/   从主仓库 docs/ 自动同步的完整手册
├── public/      静态资源
└── .vitepress/  站点配置与主题
scripts/
└── sync-reference.mjs   同步主仓库手册到 docs/reference/
```

## 文档来源

导航页（guide / deploy / use / ops / dev）是按当前代码重新梳理的，直接在本仓库维护。

`docs/reference/` **不是手工维护**的，由脚本从主项目仓库同步：

```text
https://github.com/Lagran93/Lagran/tree/main/docs
```

同步规则：

- 只同步公开手册：`manual.md`、`deployment.md`、`development.md`、`architecture.md`、`geodns.md`、`alerting.md`、`request-pipeline-migration.md`、`Origin Shield配置.md` 以及同目录图片
- `todo-bug.md`、`security-review-*.md`、`reviews/` 属于内部记录，不会发布
- 相对链接会改写为 GitHub 链接，避免死链

```bash
npm run docs:sync      # 手动同步（默认读取 ../lagran，可用 LAGRAN_SOURCE_DIR 指定）
```

`npm run docs:dev` 与 `npm run docs:build` 会通过 `predev` / `prebuild` 自动先同步一次。

### CI 说明

GitHub Actions 只检出本仓库，工作区里没有 `../lagran`，因此构建前需要把主仓库检出到同级目录并设置环境变量：

```yaml
- uses: actions/checkout@v4
  with:
    repository: Lagran93/Lagran
    path: .lagran-source
    sparse-checkout: docs
- uses: actions/checkout@v4
- name: Build documentation
  env:
    LAGRAN_SOURCE_DIR: ${{ github.workspace }}/.lagran-source
  run: npm run docs:build
```

否则 `docs:sync` 会以“找不到源仓库”退出并中止构建（不会静默发布过期的参考页）。

## 绑定自定义域名

仓库已内置：

- `docs/public/CNAME` → `docs.lagrancdn.com`
- `.vitepress/config.mts` 的 `sitemap.hostname`

使用自定义域名 `docs.lagrancdn.com`：

1. DNS 添加 CNAME：

   ```text
   docs.lagrancdn.com  CNAME  lagran93.github.io
   ```

2. GitHub 仓库：`Settings → Pages → Build and deployment → Source: GitHub Actions`
3. 等待 GitHub DNS 校验通过，勾选 **Enforce HTTPS**
4. 如果 GitHub 提示域名验证，按提示添加 `_github-pages-challenge-*` TXT 记录

Cloudflare 用户建议先使用 **DNS only（灰云）**，证书签发后再决定是否代理。

VitePress 使用根路径（`base: '/'`），因此自定义域名不需要额外路径前缀。

