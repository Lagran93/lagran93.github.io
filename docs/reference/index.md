# 完整参考

这里保留主项目 `docs/` 目录的完整文档，适合查细节。导航式、整理后的内容请优先看左侧的指南、部署、使用、运维与开发章节。

| 文档 | 内容 |
| --- | --- |
| [使用与调试手册](/reference/manual) | 控制台使用、缓存机制、配置、安全、排障 |
| [部署手册](/reference/deployment) | Control / Edge / DNS / Caddy 完整部署 |
| [开发指南](/reference/development) | 本地开发、测试、缓存、WAF、调度 |
| [架构说明](/reference/architecture) | 组件、通信、数据模型、请求流水线 |
| [GeoDNS 流程](/reference/geodns) | 从 CNAME 到节点打分的完整链路 |
| [告警建议](/reference/alerting) | 稳定性告警规则 |
| [请求流水线迁移](/reference/request-pipeline-migration) | Pingora / Legacy 迁移阶段 |
| [内部评估与路线图](/reference/todo-bug) | 生产稳定性、安全能力与规划记录 |

::: warning
`内部评估与路线图` 是开发过程中的评估记录，可能包含未实现能力和过期结论，不应作为对外承诺。
:::

## 文档维护

- 主项目文档：<https://github.com/Lagran93/Lagran/tree/main/docs>
- 文档站点：<https://github.com/Lagran93/lagran93.github.io>
- 站点基于 VitePress 构建。
