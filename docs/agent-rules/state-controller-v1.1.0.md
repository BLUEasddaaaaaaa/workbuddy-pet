# Blueberry v1.1.0 状态控制器规则

## 固定优先级

| 优先级 | 状态 |
|---:|---|
| 5 | `Attention` |
| 4 | `Happy` |
| 3 | `Working` |
| 2 | `Thinking` |
| 1 | `Idle` |
| 0 | `Sleeping` |

- 高优先级 Hook 不能打断仍处于最低保护时间内的低优先级动画。
- 优先级只决定保护期内保留哪个唯一候选状态，不赋予立即打断权。

## Pending 规则

- 最多保留一个 `pendingState`，不维护 FIFO 动画历史。
- 没有 pending 时，保护期内到来的新候选成为 pending。
- 已有 pending 时，只允许相同或更高优先级候选替换；更低优先级丢弃。
- 重复状态合并，不重启动画、不延长保护时间、不新增 pending。
- 持续状态保护结束后根据最新 `logicalState` 计算，不机械补播旧事件。

## 最低显示时间

| 条件 | 状态 | 最低保护时间 | 附加规则 |
|---|---|---:|---|
| `SessionStart` | `Idle` | 0 ms | 立即进入清醒待机。 |
| `UserPromptSubmit` | `Thinking` | 2000 ms | 至少显示两秒。 |
| `PreToolUse` | `Working` | 1000 ms | 至少显示一秒。 |
| `PostToolUse` | `Working` | 不新增保护 | 相同 Working 不重启或延长。 |
| `PermissionRequest` | `Attention` | 2000 ms | 一次性动画。 |
| `Stop` | `Happy` | 2000 ms | v1.1.0 一次性动画。 |
| `SessionEnd` | `Idle` | 0 ms | 更新逻辑状态，仍遵守当前动画保护期。 |
| 本地鼠标空闲 | `Sleeping` | 空闲 60000 ms 后触发 | 不由 SessionEnd 触发。 |
| 睡眠后鼠标移动 | `Idle` | 0 ms | 立即唤醒。 |

## 一次性动画与 B 计时方案

- Attention 和 Happy 实际显示满 2000 ms 后，根据最新逻辑状态重新计算；不得写死返回目标。
- 计时从 Renderer 状态控制器应用动画并记录 `visibleSince` 时开始，不从 Python 收到 Hook 或进入 pending 时开始。
- 使用绝对截止时间 `protectedUntil = visibleSince + duration`；定时器回调时重新计算剩余时间，延迟回调不得缩短保护期。
- Idle、Thinking、Working、Sleeping 为持续状态，不因普通计时器到期自动返回。
- 单对话下，Thinking/Working 一直保持，直到新 Hook、SessionEnd 或鼠标睡眠改变状态。
- Renderer 重载可安全回到 Idle；持久化恢复不属于 v1.1.0。

## 唯一状态权威

- 只有 Renderer 内的一个状态控制器可以决定用户可见动画。
- Python 只规范化并转发 Hook，不决定优先级、保护期、pending 或返回状态。
- Electron Main 只校验、去重、转发语义事件，不维护第二套可见状态机。
- Renderer/DOM 动画层只渲染控制器决定，不自行决定下一状态或创建竞争返回计时器。
- 控制器拥有 `logicalState`、`visibleState`、`visibleSince`、`protectedUntil`、`pendingState` 和鼠标空闲截止时间。
- 控制器统一负责优先级、保护期、重复合并、一次性返回、最新状态重算和睡眠/唤醒。
- Sleeping 时收到任意有效 Codex Hook，立即唤醒并应用该 Hook 映射状态，同时重置鼠标空闲计时；惊醒过渡留到后续版本。
- 真正显示 Sleeping 后，睡眠前的 Thinking/Working 不再是有效恢复目标；唤醒基线为 Idle。持续 Hook 会成为新的逻辑状态；Attention/Happy 播放满 2000 ms 后按唤醒以来收到的最新逻辑状态重新计算。
- SessionEnd 只把逻辑状态更新为 Idle。保护中的一次性动画播放完成后再按最新逻辑状态计算。
- 后续设计或修改控制器前重新确认本文件。若实现会产生第二个可见状态权威，立即停止并报告。
