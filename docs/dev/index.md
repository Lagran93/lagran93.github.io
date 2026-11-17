# 开发总览

## 代码结构

```text
apps/
├── control/      Axum + sqlx 控制面（bin: lagran-control）
│   ├── migrations/   sqlx 迁移（启动时自动执行）
│   └── src/
│       ├── api/          路由与处理器
│       ├── repository/   数据访问
│       ├── service/      业务逻辑（配置发布、证书、预热、告警、调度…）
│       ├── scheduler/    GeoIP + 节点打分
│       └── middleware/   JWT、权限
├── edge/         Pingora 数据面（bin: lagran-edge）
│   ├── src/agent/     与控制面同步（配置、证书、心跳、上报）
│   ├── src/cache/     policy / memory / disk / l2 / large / flight
│   ├── src/server/    监听、请求处理、WAF/CC、访问日志
│   ├── src/security/  签名 URL、回源鉴权、可信代理
│   ├── src/waf/       托管规则、Geo/ASN、规则包
│   └── src/pingora_edge.rs  Pingora 生命周期与原生数据面
├── dns/          权威 DNS（bin: lagran-dns）
└── frontend/     Nuxt 4 SPA 控制台
crates/
├── lagran-cache/    CacheBackend 抽象 + MemoryCache
├── lagran-metrics/  指标辅助
├── lagran-common/   公共配置类型
├── lagran-model/    共享模型
└── lagran-waf-dsl/  自定义 WAF 规则 DSL
proto/          gRPC 占位（未接入）
deploy/         docker-compose、k8s、nginx、脚本
infra/          ansible、terraform
tests/integration/  端到端脚本
tools/          mock-origin、dns、load-test
```

## 常用命令

```bash
# 依赖（PostgreSQL 必需，Redis 可选）
# compose 强制要求 POSTGRES_PASSWORD，不会使用弱默认值
POSTGRES_PASSWORD='change-me' REDIS_PASSWORD='change-me-redis' \
  docker compose -f deploy/docker-compose.yml up -d

# 编译检查
cargo check --workspace
cargo test --workspace
cargo clippy --workspace --all-targets
cargo fmt --all

# 本地运行（二进制在 target/debug，集成测试依赖该路径）
DATABASE_URL=postgres://lagran:change-me@127.0.0.1:5432/lagran cargo run -p control
cargo run -p edge
cargo run -p lagran-dns

# 前端（npm，不是 pnpm）
cd apps/frontend
npm ci
npm run dev
```

一键拉起依赖（等价于上面的 compose 命令）：

```bash
POSTGRES_PASSWORD='change-me' REDIS_PASSWORD='change-me-redis' bash scripts/dev-up.sh
```

## 本地地址

| 组件 | 地址 |
| --- | --- |
| Control API | `http://localhost:8080` |
| 控制台 dev server | `http://localhost:3000`（`NUXT_PUBLIC_API_BASE=http://localhost:8080`） |
| Edge 数据面 | `http://localhost:8081` |
| Edge 管理口 | `http://127.0.0.1:8082` |
| DNS | `127.0.0.1:53`（需 root） |

## 文档

- [本地开发与测试](/dev/development)
- [请求流水线](/dev/request-pipeline)
- [完整开发指南](/reference/development)
- [架构说明](/reference/architecture)

## CI 与发布

- push / PR：Rust 测试、clippy、前端静态构建
- 推送 `v*` 标签：产出 musl 静态二进制 Release bundle + `SHA256SUMS`

```bash
git tag v0.1.9
git push origin v0.1.9
```

