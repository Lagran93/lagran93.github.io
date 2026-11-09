# 本地开发与测试

## 依赖

- Rust stable
- PostgreSQL
- Node.js 18+
- pnpm 或 npm
- 可选：Redis、Docker

## 启动依赖

```bash
docker compose -f deploy/docker-compose.yml up -d
```

或自行启动 PostgreSQL，并设置：

```ini
DATABASE_URL=postgres://lagran:lagran@127.0.0.1/lagran
```

## 启动 Control

```bash
export DATABASE_URL=...
export JWT_SECRET=dev-secret-at-least-32-bytes-long
export SEED_DEMO=true
cargo run -p control
```

首次启动自动迁移并创建：

```text
demo@lagran.dev / demo123
```

## 启动 Edge

```bash
export CONTROL_URL=http://127.0.0.1:8080
export AGENT_TOKEN=dev-agent-token
export EDGE_LISTEN=127.0.0.1:8081
export EDGE_ADMIN_LISTEN=127.0.0.1:8082
cargo run -p edge
```

## 启动前端

```bash
cd apps/frontend
npm ci
npm run dev
```

## 测试

```bash
cargo test --workspace
cargo test -p control
cargo test -p edge
```

集成测试需要 PostgreSQL 与已构建二进制：

```bash
cargo build -p control -p edge -p lagran-dns
cargo test -p integration
```

## 调试

- `RUST_LOG=debug`
- Control `/health` `/ready`
- Edge 管理口 `/__lagran/health`
- 响应头 `x-lagran-datapath` / `x-cache`
- 缓存 meta 文件

## 代码格式

```bash
cargo fmt --all
cargo clippy --workspace --all-targets
```

前端：

```bash
pnpm --dir apps/frontend build
```
