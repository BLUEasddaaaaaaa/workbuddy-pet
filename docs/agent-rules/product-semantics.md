# Blueberry v1.1.0 产品语义与 Hook 映射

## 语义原则

- 技术生命周期事件不能在未确认官方含义时直接解释成用户可见的成功信号。
- Codex `Stop` 表示一轮停止，不证明任务成功。`Stop -> Happy` 是用户仅为 v1.1.0 批准的临时 MVP 例外，v1.2.0 必须重新研究完成可靠性。
- `SessionEnd` 表示主会话结束，不证明任务成功，也不表示应该睡觉。
- 事件含义不明确时，优先使用中性状态，不做正面或负面判断。

## 固定映射

| Codex 或本地条件 | Blueberry 状态 | v1.1.0 行为 |
|---|---|---|
| `SessionStart` | `Idle` | 会话已启动，保持清醒待机。 |
| `UserPromptSubmit` | `Thinking` | Codex 已收到用户任务。 |
| `PreToolUse` | `Working` | Codex 开始使用工具。 |
| `PostToolUse` | `Working` | 单次工具结束但 Codex 可能继续工作；相同 Working 不重启。 |
| `PermissionRequest` | `Attention` | 用户需要查看权限请求。 |
| `Stop` | `Happy` | 仅 v1.1.0 临时视为回合完成反馈。 |
| `SessionEnd` | `Idle` | 结束 Codex 活动态并回到清醒待机，不触发睡眠。 |
| 本地鼠标空闲超时 | `Sleeping` | 睡眠由本地鼠标空闲触发。 |
| 睡眠后的鼠标移动 | `Idle` | 立即唤醒到待机。 |

- v1.1.0 开发期间不得改变该表；更丰富或更精确的行为放到后续明确批准的版本。
