# Blueberry 项目关键上下文

本文件只保存恢复任务时必须知道的当前目标、有效决定、已知状态、禁止事项和下一步。详细产品、状态机、测试、子 Agent 与发布规则按 `AGENTS.md` 的索引读取。

## 当前目标

- Blueberry v1.1.0 的目标是完成 Codex Hook 到桌宠动画的最小可用响应闭环。
- 当前版本只考虑一个 Codex 对话。
- 单对话下，Thinking/Working 一直保持，直到新 Hook、SessionEnd 或鼠标睡眠改变状态。
- v1.1.0 复用现有动画，不增加新动画、JSONL 补充事件、多会话、Subagent 行为或复杂权限提醒。
- 当前开发针对 Apple Silicon macOS。

## 当前状态

- Blueberry v1.1.0 的冻结候选提交为 `18c2cb61c6571349b0b5078bfdca4e0fa5dbd6cd`。
- 发布阶段 1–8 已通过：候选冻结、干净构建、制品身份、审计安装、安装版本运行验收、真实单对话 Codex Hook 验收、失败降级和真实回滚验收。
- 两轮安装运行的状态顺序均为：Idle → Thinking → Working → Attention → Happy → Idle。
- 真实 Codex PreToolUse/PostToolUse 已驱动安装版 Blueberry 显示 Working，重复 Working 没有重启动画。
- PermissionRequest 与 SessionEnd 本轮没有自然触发，使用安装运行时 Python fixtures 验证，不得描述为真实 Codex 自然触发。
- Apple Silicon DMG SHA-256 为 `7aea9e804bbc29b72696ad433d0351713e6f9b770ad1892657e2d51f94808fd6`。
- 当前应用仅支持 Apple Silicon，未使用 Developer ID 正式签名，也未经过 Apple notarization。
- v1.1.0 可以描述为“本地 release candidate 已通过验收”，但 GitHub 发布完成前不能描述为“已发布到 GitHub”。

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

- 完成阶段九的上下文记录与最终文档检查。
- 执行完整自动化测试、文档检查和候选身份复核。
- 执行阶段十：确认 Git 分支范围，推送代码，按冻结候选创建版本标签和 GitHub 测试/预发布 Release。
- 上传 `Blueberry-1.1.0-arm64.dmg`，重新下载 GitHub Release 制品并核对 SHA-256。
- GitHub Release 必须明确披露 Apple Silicon only、未签名、未公证以及条件 Hook 的验收边界。
