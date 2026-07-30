# WorkBuddy Pet 🐾

A low-interruption pixel desktop companion that turns Codex lifecycle events into ambient visual feedback. It shows whether Codex is thinking, using tools, waiting for permission, finished, or inactive without adding a second chat window.

[English](#english) | [中文](#中文)

---

<a id="english"></a>

## ✨ Features

- **Codex Hook integration** — Pet reacts to prompts, local tools, permission requests, completion, and session lifecycle
- **Eye tracking** — Pet's eyes follow your mouse cursor (idle state)
- **Natural blinking** — Random 4-9s blink cycle with 3% double-blink chance
- **Auto sleep** — Falls asleep after 60s of inactivity, wakes on mouse move
- **Idle behaviors** — Random reading (5%) and thinking (5%) animations
- **Draggable** — Drag the pet anywhere on your desktop
- **Completion sound** — Cheerful arpeggio (C5→C6) on task completion
- **Zero interference** — 160×160px transparent always-on-top window
- **Pixel art style** — Cute pixel-art sprites with smooth CSS animations

## 🎬 Animation States

| State | Trigger | Visual |
|-------|---------|--------|
| **Idle** | Default / Session start | Static PNG + SVG eyes tracking cursor |
| **Thinking** | User sends prompt | `think.gif` + floating animation |
| **Working** | AI calls tools (read/write files) | `work.gif` + wobble animation |
| **Happy** ★ | Codex completes a turn | `happy.gif` + bounce + sound effect |
| **Attention** | Codex requests permission | `think.gif` + pulse animation |
| **Sleeping** | 60s inactivity / Session end | `pet-sleeping.gif` + breathing pulse |
| **Reading** | Idle random (5% / 10s check) | `read.gif` + floating animation |

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- Python 3.10+
- Codex with [Hooks](https://learn.chatgpt.com/docs/hooks) enabled

### Install & Run

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/workbuddy-pet.git
cd workbuddy-pet

# Install dependencies
npm install

# Start the pet
npm start
```

The pet will appear in the bottom-right corner of your screen!

### Scale the Pet

```bash
# 2x size (320×320px window)
npm start -- --scale=2
```

## 🔗 Codex Integration

Codex launches a short-lived Python adapter for each configured lifecycle event. The adapter creates a privacy-filtered WorkBuddy event, sends it to `127.0.0.1:18920/event`, writes the neutral Hook result `{}`, and exits.

### Hook Event Mapping

| Codex Hook | Condition | Pet State |
|------------|-----------|-----------|
| `SessionStart` | `startup`, `resume`, or `clear` | idle |
| `SessionEnd` | — | sleeping |
| `UserPromptSubmit` | — | thinking |
| `PreToolUse` | — | working |
| `PostToolUse` | — | working |
| `PermissionRequest` | Approval is required | attention |
| `Stop` | `stop_hook_active === false` | **happy** ★ |
| `Stop` | `stop_hook_active === true` | *(skipped)* |

### Install Hooks

Check the local runtimes:

```bash
python3 --version
node --version
```

Open [`hooks/codex-hooks.example.json`](hooks/codex-hooks.example.json), replace `/absolute/path/to/workbuddy-pet` with this repository's absolute path, and merge its `hooks` entries into `~/.codex/hooks.json`.

Do not overwrite existing hooks: Codex runs all matching definitions. Restart Codex, open `/hooks`, review the source, and trust the exact WorkBuddy definition before testing it.

To uninstall, remove only the WorkBuddy handlers from `~/.codex/hooks.json`. Leave unrelated hooks unchanged.

### Privacy and Failure Behavior

WorkBuddy allowlists event identity, session/turn/tool-call IDs, session start source, and tool name. It does not send or persist prompts, commands, code, paths, transcripts, tool input/output, final messages, environment variables, or credentials.

If WorkBuddy is closed or the loopback request times out, the Hook exits normally without retrying. It never approves, denies, rewrites, blocks, or continues Codex.

### Troubleshooting

- **No reaction:** start WorkBuddy, verify port `18920`, then review trust state with `/hooks`.
- **Port already in use:** close the other process or WorkBuddy instance; the pet window remains available and logs a diagnostic.
- **Python not found:** use an absolute Python 3 path in the Hook command.
- **Hook changed:** review and trust the new definition again; Codex trust is tied to the current Hook hash.

## 🎮 Interaction

| Action | Effect |
|--------|--------|
| **Move mouse** | Pet's eyes follow cursor (idle state) |
| **Drag pet** | Move to any position on screen |
| **Wait 60s** | Pet falls asleep |
| **Move mouse** (while sleeping) | Pet wakes up |

## 🛠️ HTTP API

The pet runs a local HTTP server on `127.0.0.1:18920` for external triggers:

### POST /state

```bash
curl -X POST http://127.0.0.1:18920/state \
  -H "Content-Type: application/json" \
  -d '{"state": "happy"}'
```

Valid states: `idle`, `thinking`, `working`, `happy`, `sleeping`, `attention`

### POST /event

Used by `codex_hook.py` for validated WorkBuddy protocol events. Manual animation checks should use `/state`.

## 📦 Build

```bash
# Windows installer (.exe)
npm run build:win

# macOS (.dmg)
npm run build:mac

# Linux (.AppImage)
npm run build:linux

# All platforms
npm run build:all
```

Build outputs go to the `dist/` directory.

## 🎨 Adding Custom Animations

Place GIF files in the `assets/` directory following the naming convention:

| File | Purpose |
|------|---------|
| `mypet.png` | Idle body sprite (with SVG eye overlay) |
| `think.gif` | Thinking animation |
| `work.gif` | Working animation |
| `happy.gif` | Happy/celebration animation |
| `pet-sleeping.gif` | Sleeping animation |
| `read.gif` | Idle reading animation |
| `attention.gif` | Attention/notification animation (optional, falls back to `think.gif`) |

Requirements:
- Pixel art style, matching `mypet.png`
- Transparent background
- GIF format, looping
- Same canvas size as `mypet.png`

## 📁 Project Structure

```
workbuddy-pet/
├── main.js                 # Electron window, event-server composition, mouse polling
├── preload.js              # IPC bridge (contextBridge)
├── package.json            # Project config & build settings
├── assets/
│   ├── mypet.png           # Pet body sprite (idle)
│   ├── think.gif           # Thinking animation
│   ├── work.gif            # Working animation
│   ├── happy.gif           # Happy animation
│   ├── pet-sleeping.gif    # Sleeping animation
│   └── read.gif            # Reading animation
├── hooks/
│   ├── codex_hook.py               # Privacy-safe Codex adapter
│   └── codex-hooks.example.json    # Codex configuration example
└── src/
    ├── main/
    │   ├── event-router.js         # Protocol validation and state mapping
    │   └── event-server.js         # Loopback HTTP and deduplication
    └── renderer/
        ├── index.html
        ├── renderer.js
        └── style.css
```

## 📄 License

[MIT](LICENSE)

---

<a id="中文"></a>

## ✨ 功能特点

- **Codex Hook 实时联动** — 宠物根据提示、工具调用、权限请求、完成和会话生命周期做出反应
- **眼球追踪** — 宠物眼睛跟随鼠标移动（idle 状态下）
- **自然眨眼** — 4-9 秒随机眨眼，3% 概率双眨
- **自动睡觉** — 60 秒无操作自动入睡，鼠标移动唤醒
- **待机动作** — 随机阅读(5%)和思考(5%)动画
- **可拖拽** — 拖动宠物到桌面任意位置
- **完成音效** — 任务完成时播放欢快琶音（C5→C6）
- **零干扰** — 160×160 像素透明置顶窗口
- **像素风格** — 可爱像素精灵图 + 流畅 CSS 动画

## 🎬 动画状态

| 状态 | 触发条件 | 显示 |
|------|---------|------|
| **Idle（待机）** | 默认 / 会话开始 | 静态 PNG + SVG 眼睛追踪光标 |
| **Thinking（思考）** | 用户发送消息 | `think.gif` + 浮动动画 |
| **Working（工作）** | AI 调用工具 | `work.gif` + 摇晃动画 |
| **Happy（开心）★** | Codex 完成一轮任务 | `happy.gif` + 弹跳 + 音效 |
| **Attention（注意）** | Codex 请求权限 | `think.gif` + 脉冲动画 |
| **Sleeping（睡眠）** | 60秒无操作 / 会话结束 | `pet-sleeping.gif` + 呼吸脉冲 |
| **Reading（阅读）** | 待机随机(5% / 10秒检查) | `read.gif` + 浮动动画 |

## 🚀 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) v18+
- Python 3.10+
- 已启用 [Hooks](https://learn.chatgpt.com/docs/hooks) 的 Codex

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/YOUR_USERNAME/workbuddy-pet.git
cd workbuddy-pet

# 安装依赖
npm install

# 启动桌宠
npm start
```

宠物会出现在屏幕右下角！

### 缩放宠物

```bash
# 2倍大小（320×320像素窗口）
npm start -- --scale=2
```

## 🔗 Codex 联动

Codex 在每个已配置的生命周期事件上启动一个短生命周期 Python 适配器。适配器生成经过隐私过滤的 WorkBuddy 事件，发送到 `127.0.0.1:18920/event`，向 Codex 输出中立结果 `{}` 后退出。

### Hook 事件映射

| Codex Hook | 条件 | 宠物状态 |
|------------|------|---------|
| `SessionStart` | `startup`、`resume` 或 `clear` | idle |
| `SessionEnd` | — | sleeping |
| `UserPromptSubmit` | — | thinking |
| `PreToolUse` | — | working |
| `PostToolUse` | — | working |
| `PermissionRequest` | 需要审批 | attention |
| `Stop` | `stop_hook_active === false` | **happy** ★ |
| `Stop` | `stop_hook_active === true` | *(跳过)* |

### 安装 Hook

先检查本机运行时：

```bash
python3 --version
node --version
```

打开 [`hooks/codex-hooks.example.json`](hooks/codex-hooks.example.json)，将 `/absolute/path/to/workbuddy-pet` 替换为仓库绝对路径，再把其中的 `hooks` 条目合并到 `~/.codex/hooks.json`。

不要覆盖已有 Hook；Codex 会运行所有匹配的定义。重启 Codex 后打开 `/hooks`，审阅来源并信任当前 WorkBuddy 定义。

卸载时只删除 `~/.codex/hooks.json` 中 WorkBuddy 对应的 handler，不要删除其他 Hook。

### 隐私与降级

WorkBuddy 只允许事件标识、session/turn/tool-call ID、会话开始来源和工具名称进入协议。它不发送或持久化提示词、命令、代码、路径、transcript、工具输入输出、最终消息、环境变量或凭证。

桌宠关闭或回环请求超时时，Hook 会正常退出且不重试。它不会替用户批准、拒绝、重写、阻止或继续 Codex。

### 故障排查

- **没有反应：** 启动 WorkBuddy，确认端口 `18920`，再通过 `/hooks` 检查信任状态。
- **端口被占用：** 关闭其他 WorkBuddy 实例或占用进程；桌宠窗口仍会显示并记录诊断。
- **找不到 Python：** 在 Hook command 中使用 Python 3 的绝对路径。
- **Hook 更新后失效：** 重新审阅并信任；Codex 的信任与当前 Hook hash 绑定。

## 🎮 交互

| 操作 | 效果 |
|------|------|
| **移动鼠标** | 宠物眼睛跟随光标（待机状态） |
| **拖拽宠物** | 移动到屏幕任意位置 |
| **等待 60 秒** | 宠物入睡 |
| **移动鼠标**（睡眠中） | 宠物醒来 |

## 🛠️ HTTP API

桌宠在 `127.0.0.1:18920` 运行本地 HTTP 服务：

### POST /state

```bash
curl -X POST http://127.0.0.1:18920/state \
  -H "Content-Type: application/json" \
  -d '{"state": "happy"}'
```

合法状态：`idle`、`thinking`、`working`、`happy`、`sleeping`、`attention`

### POST /event

由 `codex_hook.py` 发送经过验证的 WorkBuddy 协议事件。手动测试动画请继续使用 `/state`。

## 📦 构建

```bash
# Windows 安装包 (.exe)
npm run build:win

# macOS (.dmg)
npm run build:mac

# Linux (.AppImage)
npm run build:linux

# 全平台
npm run build:all
```

构建输出在 `dist/` 目录。

## 🎨 添加自定义动画

将 GIF 文件放入 `assets/` 目录，遵循命名规范：

| 文件 | 用途 |
|------|------|
| `mypet.png` | 待机身体精灵图（配合 SVG 眼睛叠加） |
| `think.gif` | 思考动画 |
| `work.gif` | 工作动画 |
| `happy.gif` | 开心/庆祝动画 |
| `pet-sleeping.gif` | 睡眠动画 |
| `read.gif` | 待机阅读动画 |
| `attention.gif` | 注意/通知动画（可选，缺失时回退到 `think.gif`） |

要求：
- 像素风格，与 `mypet.png` 一致
- 透明背景
- GIF 格式，循环播放
- 画布尺寸与 `mypet.png` 相同

## 📄 许可证

[MIT](LICENSE)
