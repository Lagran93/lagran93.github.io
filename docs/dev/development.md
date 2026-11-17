# 本地开发与测试

## 依赖

| 依赖 | 版本 | 说明 |
| --- | --- | --- |
| Rust | 见 `rust-toolchain.toml` | 使用仓库固定的工具链 |
| PostgreSQL | 14+ | 必需 |
| Node.js | ≥ 20 | 前端（`engines` 要求） |
| npm | ≥ 10 | 仓库使用 npm，不是 pnpm |
| Redis | 7.x（可选） | Control 会话/限流锁定、Edge CC/限流/L2 缓存 |
| Docker | 可选 | 只用来跑 compose 依赖 |

::: tip tokio 被固定为 `=1.53.1`
Pingora 0.9 与更新版本 tokio 的 `BufStream` 行为不兼容，workspace 已固定版本。不要单独 `cargo update tokio`。
:::

## 启动依赖

```bash
POSTGRES_PASSWORD='change-me' REDIS_PASSWORD='change-me-redis' \
  docker compose -f deploy/docker-compose.yml up -d
```

compose 强制要求 `POSTGRES_PASSWORD`（不会用弱默认值），端口只绑定 `127.0.0.1`。

或自行准备 PostgreSQL：

```ini
DATABASE_URL=postgres://lagran:lagran@127.0.0.1:5432/lagran
```

## 启动 Control

```bash
export DATABASE_URL=postgres://lagran:change-me@127.0.0.1:5432/lagran
export JWT_SECRET=dev-secret-at-least-32-bytes-long
export ALLOW_REGISTER=true      # 首次注册即 admin
export CAPTCHA_ENABLED=false    # 本地免验证码
cargo run -p control
```

启动时自动执行迁移。首次启动后打开控制台注册第一个账号（自动成为 admin），随后可关闭 `ALLOW_REGISTER`。

需要演示数据时：

```bash
SEED_DEMO=true cargo run -p control   # 创建 demo@lagran.dev / demo123（普通用户）
```

::: warning 演示数据与强密钥互斥
`SEED_DEMO=true` 与 `REQUIRE_SECURE_SECRETS=true` 同时开启会拒绝启动，避免生产误用演示账号。
:::

## 启动 Edge

```bash
cargo run -p edge
```

常用环境变量：

```bash
CONTROL_URL=http://127.0.0.1:8080
AGENT_TOKEN=<控制台节点令牌>
NODE_ID=edge-local
EDGE_LISTEN=127.0.0.1:8081
EDGE_ADMIN_LISTEN=127.0.0.1:8082
AGENT_URL=http://127.0.0.1:8082
ORIGIN_URL=http://127.0.0.1:19090     # 没有域名配置时的默认源站
CHALLENGE_SECRET=dev-challenge-secret
WAF_RULEPACK_SECRET=dev-rulepack-secret
LARGE_CACHE_ENABLED=true
LARGE_CACHE_DIR=./data/large-cache
RUST_LOG=info
```

## 启动前端

```bash
cd apps/frontend
npm ci
NUXT_PUBLIC_API_BASE=http://localhost:8080 npm run dev
```

生产构建：

```bash
npm run generate     # 产物在 apps/frontend/dist
npm run build        # 需要 Node 服务时使用
```

## 测试

### 单元 / 集成（Rust）

```bash
cargo test --workspace
cargo test -p control
cargo test -p edge
cargo clippy --workspace --all-targets
```

### 端到端脚本

`tests/integration/*.sh` 会自己起 Control + Edge + 模拟源站（使用 `target/debug` 下的二进制、随机端口、临时日志）：

```bash
cargo build -p control -p edge -p lagran-dns   # 脚本依赖 debug 二进制

bash tests/integration/smoke.sh
bash tests/integration/cache-rules.sh
bash tests/integration/cache-diagnostics.sh
bash tests/integration/multi-origin.sh
bash tests/integration/failover-https.sh
bash tests/integration/config-releases.sh
bash tests/integration/waf.sh
bash tests/integration/waf-advanced.sh
bash tests/integration/cc.sh
bash tests/integration/p1-hardening.sh
bash tests/integration/p2-hardening.sh
bash tests/integration/dns.sh
bash tests/integration/schedule.sh
bash tests/integration/ttl.sh
bash tests/integration/users.sh
bash tests/integration/nodes.sh
bash tests/integration/alerting.sh
bash tests/integration/purge-scope.sh
bash tests/integration/backup-origin.sh
bash tests/integration/cert-binding.sh
bash tests/integration/origin-health.sh
bash tests/integration/head-h2.sh
bash tests/integration/http-optimizations.sh
bash tests/integration/no-cache-preflight.sh
bash tests/integration/dead-origin.sh
bash tests/integration/fresh-db.sh
bash tests/integration/admin-port.sh
bash tests/integration/ws-echo.sh
```

需要：`DATABASE_URL` 可达、`curl`、`jq`、`rustc`。

### 模拟源站

```bash
# 单文件 Rust 源站（无需 crate）
rustc -O tools/mock-origin/origin.rs -o target/mock-origin
target/mock-origin 9090          # 端口参数，默认 9090

# 测试钩子：MOCK_ROOT_STATUS=500 让 GET / 不健康，MOCK_SLOW=1 模拟慢响应
MOCK_ROOT_STATUS=500 target/mock-origin 9090

# 或使用 Python 版
python3 tools/mock-origin/server.py
```

## 调试

| 手段 | 说明 |
| --- | --- |
| `RUST_LOG=debug` | 详细日志；`RUST_LOG=control=info,sqlx=warn` 减少噪音 |
| Control `/health` `/ready` | 进程与数据库 |
| Edge `/__lagran/health` | 进程 |
| 响应头 | `X-Lagran-Datapath` / `X-Cache` / `X-Lagran-Cache-Reason` |
| 缓存诊断接口 | `POST /__lagran/cache-diagnose` |
| 大缓存 meta | `/var/lib/lagran/large-cache/**.meta.json` |

## 代码规范

- Rust：`cargo fmt --all`、`cargo clippy --workspace --all-targets`，PR 不允许新增 warning
- 共享策略放 `RequestPipeline` / `cache::policy`，不要在 Pingora 与 Legacy 各写一份
- 新增配置项必须同步写入对应的 `*.env.example`，并注明默认值与钳制范围
- 迁移文件命名 `YYYYMMDDHHMMSS_描述.sql`，只增不改
- 前端：`npm run generate` 必须通过（SPA 模式，注意 `import.meta.client` 边界）

## 提交前检查

```bash
cargo fmt --all --check
cargo clippy --workspace --all-targets
cargo test --workspace
bash tests/integration/smoke.sh
```

