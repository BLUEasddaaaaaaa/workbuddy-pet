# Blueberry Agent Rules Index

本文件只保存所有任务都必须遵守的底线和专题规则入口。不要默认读取整个 `docs/agent-rules/`；只读取当前任务对应的文件。

## 全局底线

- 不得擅自改变产品语义、验收标准、隐私边界或动画含义；存在歧义时停止并询问用户。
- 第一次有充分证据的修复仍失败，或者出现新的状态权威/架构冲突时，保存证据并停止，不得连续堆补丁。
- 已知必需行为失败或尚未验证时，不得声称版本完成、通过验收或可以发布。
- 不得触碰用户自有且未跟踪的 `.superpowers/` 目录。
- 不得把一次 HTTP 200、单元测试、截图、子 Agent 报告或单轮运行结果替代为其他层级的证据。
- 触发停止条件后，未经用户明确确认，不得继续生产代码修改、下游测试、构建、安装、发布或重新派发子 Agent。

## 按任务读取规则

| 当前任务涉及 | 开始操作前必须读取 |
|---|---|
| 上下文压缩、恢复旧任务、关键定义查询或修改 `docs/context.md` | `docs/agent-rules/context-continuity.md` |
| Codex Hook 含义、事件映射、动画产品语义 | `docs/agent-rules/product-semantics.md` |
| 状态、优先级、保护时间、pending、一次性动画、睡眠或 Renderer 状态权威 | `docs/agent-rules/state-controller-v1.1.0.md` |
| 派发、实现、审查或验收子 Agent | `docs/agent-rules/subagent-workflow.md` |
| 编写/修改测试、运行验收、判断证据或声称通过 | `docs/agent-rules/testing-and-acceptance.md` |
| 构建、安装、替换 `/Applications/Blueberry.app`、打包或发布 | `docs/agent-rules/release-and-packaging.md` |

- 一个任务涉及多个领域时，只组合读取对应文件。
- 专题规则与用户当前明确决定冲突时，以用户当前决定为准，并同步更新相关规则后再实施。
- 两份专题规则相互冲突时停止并报告，不得自行选择更容易实现的一条。
- 历史计划、迭代记录和验收证据不覆盖本索引或当前专题规则；它们只能提供历史背景。
