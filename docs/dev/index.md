# 开发总览

## 代码结构

```text
apps/control     Axum + sqlx 控制面
apps/edge        Pingora 数据面
apps/dns         权威 DNS
apps/frontend    Nuxt 控制台
crates/          共享库
docs/            文档
deploy/          部署文件
```

## 常用命令

```bash
cargo check --workspace
cargo test --workspace

cargo run -p control
cargo run -p edge
cargo run -p lagran-dns

pnpm --dir apps/frontend dev
```

## 文档

- [本地开发与测试](/dev/development)
- [请求流水线](/dev/request-pipeline)
- [完整开发指南](/reference/development)
