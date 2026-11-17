# 完整参考

本目录页面由 `npm run docs:sync` 从主仓库 [`Lagran93/Lagran/docs`](https://github.com/Lagran93/Lagran/tree/main/docs) **自动同步**，用于查细节。日常使用请优先看左侧的指南、部署、使用、运维与开发章节（那些是按当前代码重新梳理的导航式文档）。

::: tip 同步机制
- 同步脚本：`scripts/sync-reference.mjs`
- 触发时机：`npm run docs:dev` / `npm run docs:build` 前自动执行（`predev` / `prebuild`）
- 只同步面向用户的公开手册；`todo-bug.md`、`security-review-*.md`、`reviews/` 属于内部记录，不会发布到本站
- 页面内的相对链接会被改写为 GitHub 链接，避免死链
:::

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [使用与调试手册](/reference/manual) | 控制台使用、缓存机制、配置项、安全、排障全流程 |
| [完整部署手册](/reference/deployment) | Control / Edge / DNS / 反向代理的逐步部署 |
| [开发指南](/reference/development) | 本地开发、测试、缓存、WAF、调度 |
| [架构说明](/reference/architecture) | 组件、通信、数据模型、请求流水线、设计取舍 |
| [GeoDNS 流程](/reference/geodns) | 从 CNAME 到节点打分的完整链路 |
| [Origin Shield 配置](/reference/Origin%20Shield配置) | Shield 部署、TLS/Host 要求、高可用与验证 |
| [告警建议](/reference/alerting) | 稳定性告警规则建议 |
| [请求流水线迁移](/reference/request-pipeline-migration) | Pingora / Legacy 迁移阶段与剩余工作 |

## 与本站导航页的关系

| 想看 | 看这里 |
| --- | --- |
| 我应该怎么一步步做 | 导航页（指南 / 部署 / 使用 / 运维） |
| 某个环境变量的默认值和钳制范围 | 主仓库 `*.env.example`，或参考页 |
| 某个行为的精确语义 | 参考页 + 源码 |
| 内部路线图与评审记录 | 主仓库 `docs/todo-bug.md`（**仅 GitHub**） |

## 文档维护

| 仓库 | 用途 |
| --- | --- |
| [Lagran93/Lagran](https://github.com/Lagran93/Lagran) | 源码与参考手册 |
| [Lagran93/lagran93.github.io](https://github.com/Lagran93/lagran93.github.io) | 本站（VitePress） |

发现参考页内容过时：先更新主仓库 `docs/`，再在本仓库执行 `npm run docs:sync`。
发现导航页内容过时：直接在本仓库修改对应 Markdown 并提 PR。
