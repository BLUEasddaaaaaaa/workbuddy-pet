# Blueberry 项目关键上下文

本文件只保存恢复任务时必须知道的当前目标、有效决定、已知状态、禁止事项和下一步。详细产品、状态机、测试、子 Agent 与发布规则按 `AGENTS.md` 的索引读取。

## 当前目标

- Blueberry v1.1.0 的目标是完成 Codex Hook 到桌宠动画的最小可用响应闭环。
- 当前版本只考虑一个 Codex 对话。
- 单对话下，Thinking/Working 一直保持，直到新 Hook、SessionEnd 或鼠标睡眠改变状态。
- v1.1.0 复用现有动画，不增加新动画、JSONL 补充事件、多会话、Subagent 行为或复杂权限提醒。
- 当前开发针对 Apple Silicon macOS。

## 当前状态

- 此前复杂的多模块状态仲裁实现已经回滚到稳定基线。
- 回滚保留了失败证据、迭代记录和开发规则。
- 新的 Renderer 唯一状态控制器设计与实施计划已经完成并提交。
- 新状态控制器尚未写入生产代码。
- 当前 v1.1.0 不能描述为完成、验收通过或可以发布。
- `/Applications/Blueberry.app` 仍是此前安装的旧版本，不代表当前 worktree。

## 已确认的关键决定

- Codex Hook 与动画的固定映射以 `docs/agent-rules/product-semantics.md` 为准。
- `Stop -> Happy` 仅是 v1.1.0 的临时 MVP 映射；v1.2.0 必须重新研究可靠的完成信号。
- 用户可见动画只能由一个 Renderer 状态控制器决定。
- v1.1.0 固定优先级为：Attention 5、Happy 4、Working 3、Thinking 2、Idle 1、Sleeping 0。
- 高优先级状态不能打断仍处于最低保护时间内的动画。
- 最多保留一个待播放状态，不维护动画队列。
- 相同或更高优先级候选可以替换待播放状态，更低优先级候选丢弃。
- 重复状态必须合并，不得重启动画或延长保护时间。
- 状态控制器的详细规则以 `docs/agent-rules/state-controller-v1.1.0.md` 为准。

## 强制停止事项

- 第一次有充分证据的修复仍失败时，停止并询问用户，不继续反复补丁。
- 出现产品语义冲突、第二个状态权威或计划外架构扩张时，立即停止。
- 停止后不得继续生产代码修改、下游验收、构建、安装、发布或重新派发子 Agent。
- 不得触碰用户自有且未跟踪的 `.superpowers/` 目录。
- 不得在存在已知失败或缺少必要证据时声称 v1.1.0 完成。

## 下一步

- 按 `docs/superpowers/plans/2026-08-02-blueberry-v1.1.0-renderer-state-controller.md` 执行。
- 首个开发检查点只完成：
  1. `SessionEnd -> Idle` 路由修正及失败测试；
  2. 纯 Renderer 状态控制器及假时钟测试。
- 上述两项通过独立规格审查和代码质量审查后，再决定是否接入 Renderer。
- 尚未获得正式的子 Agent 开发执行授权；当前没有派发新的实现 Agent。
