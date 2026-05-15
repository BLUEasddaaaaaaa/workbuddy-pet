# WorkBuddy Pet 🐾

A pixel-art desktop pet that reacts to your CodeBuddy AI coding assistant in real-time — thinking when you send a prompt, working when tools are called, and celebrating with a happy dance when tasks complete!

[English](#english) | [中文](#中文)

---

<a id="english"></a>

## ✨ Features

- **Real-time CodeBuddy integration** — Pet reacts to every AI event: thinking, working, task complete
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
| **Happy** ★ | AI completes task / Task notification popup | `happy.gif` + bounce + sound effect |
| **Attention** | Permission request / Other notifications | `think.gif` + pulse animation |
| **Sleeping** | 60s inactivity / Session end | `pet-sleeping.gif` + breathing pulse |
| **Reading** | Idle random (5% / 10s check) | `read.gif` + floating animation |

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [CodeBuddy](https://www.codebuddy.ai/) (optional, for AI event integration)

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

## 🔗 CodeBuddy Integration

The pet connects to CodeBuddy via its Hook system. When CodeBuddy events fire, the hook script sends state updates to the pet's local HTTP server.

### Hook Event Mapping

| CodeBuddy Hook | Condition | Pet State |
|---------------|-----------|-----------|
| `SessionStart` | — | idle |
| `SessionEnd` | — | sleeping |
| `UserPromptSubmit` | — | thinking |
| `PreToolUse` | — | working |
| `PostToolUse` | — | working |
| `Stop` | `stop_hook_active === false` | **happy** ★ |
| `Stop` | `stop_hook_active === true` | *(skipped)* |
| `Notification` | `notification_type === "idle_prompt"` | **happy** ★ |
| `Notification` | other types | attention |
| `PreCompact` | — | idle |

### Install Hooks

Add the following to `~/.codebuddy/settings.json`:

```json
{
  "hooks": {
    "SessionStart":     [{"type":"command","command":"node /path/to/workbuddy-pet/hooks/codebuddy-hook.js SessionStart"}],
    "SessionEnd":       [{"type":"command","command":"node /path/to/workbuddy-pet/hooks/codebuddy-hook.js SessionEnd"}],
    "UserPromptSubmit": [{"type":"command","command":"node /path/to/workbuddy-pet/hooks/codebuddy-hook.js UserPromptSubmit"}],
    "PreToolUse":       [{"type":"command","command":"node /path/to/workbuddy-pet/hooks/codebuddy-hook.js PreToolUse"}],
    "PostToolUse":      [{"type":"command","command":"node /path/to/workbuddy-pet/hooks/codebuddy-hook.js PostToolUse"}],
    "Stop":             [{"type":"command","command":"node /path/to/workbuddy-pet/hooks/codebuddy-hook.js Stop"}],
    "Notification":     [{"type":"command","command":"node /path/to/workbuddy-pet/hooks/codebuddy-hook.js Notification"}],
    "PreCompact":       [{"type":"command","command":"node /path/to/workbuddy-pet/hooks/codebuddy-hook.js PreCompact"}]
  }
}
```

> Replace `/path/to/workbuddy-pet` with your actual installation path.

Restart CodeBuddy after updating the settings file.

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

### POST /happy

Backward-compatible endpoint (equivalent to `POST /state {"state":"happy"}`).

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
├── main.js                 # Electron main process: window, HTTP server, mouse polling
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
│   └── codebuddy-hook.js   # CodeBuddy Hook script
└── src/renderer/
    ├── index.html          # Main window HTML
    ├── renderer.js         # Core logic: state machine, eye tracking, game loop
    └── style.css           # State animations & layout
```

## 📄 License

[MIT](LICENSE)

---

<a id="中文"></a>

## ✨ 功能特点

- **CodeBuddy 实时联动** — 宠物根据 AI 事件做出反应：思考、工作、任务完成庆祝
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
| **Happy（开心）★** | AI 完成任务 / 任务弹窗 | `happy.gif` + 弹跳 + 音效 |
| **Attention（注意）** | 权限请求 / 其他通知 | `think.gif` + 脉冲动画 |
| **Sleeping（睡眠）** | 60秒无操作 / 会话结束 | `pet-sleeping.gif` + 呼吸脉冲 |
| **Reading（阅读）** | 待机随机(5% / 10秒检查) | `read.gif` + 浮动动画 |

## 🚀 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) v18+
- [CodeBuddy](https://www.codebuddy.ai/)（可选，用于 AI 事件联动）

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

## 🔗 CodeBuddy 联动

桌宠通过 CodeBuddy 的 Hook 系统连接。当 CodeBuddy 事件触发时，Hook 脚本向桌宠的本地 HTTP 服务发送状态更新。

### Hook 事件映射

| CodeBuddy Hook | 条件 | 宠物状态 |
|---------------|------|---------|
| `SessionStart` | — | idle |
| `SessionEnd` | — | sleeping |
| `UserPromptSubmit` | — | thinking |
| `PreToolUse` | — | working |
| `PostToolUse` | — | working |
| `Stop` | `stop_hook_active === false` | **happy** ★ |
| `Stop` | `stop_hook_active === true` | *(跳过)* |
| `Notification` | `notification_type === "idle_prompt"` | **happy** ★ |
| `Notification` | 其他类型 | attention |
| `PreCompact` | — | idle |

### 安装 Hook

将以下内容添加到 `~/.codebuddy/settings.json`：

```json
{
  "hooks": {
    "SessionStart":     [{"type":"command","command":"node /你的安装路径/workbuddy-pet/hooks/codebuddy-hook.js SessionStart"}],
    "SessionEnd":       [{"type":"command","command":"node /你的安装路径/workbuddy-pet/hooks/codebuddy-hook.js SessionEnd"}],
    "UserPromptSubmit": [{"type":"command","command":"node /你的安装路径/workbuddy-pet/hooks/codebuddy-hook.js UserPromptSubmit"}],
    "PreToolUse":       [{"type":"command","command":"node /你的安装路径/workbuddy-pet/hooks/codebuddy-hook.js PreToolUse"}],
    "PostToolUse":      [{"type":"command","command":"node /你的安装路径/workbuddy-pet/hooks/codebuddy-hook.js PostToolUse"}],
    "Stop":             [{"type":"command","command":"node /你的安装路径/workbuddy-pet/hooks/codebuddy-hook.js Stop"}],
    "Notification":     [{"type":"command","command":"node /你的安装路径/workbuddy-pet/hooks/codebuddy-hook.js Notification"}],
    "PreCompact":       [{"type":"command","command":"node /你的安装路径/workbuddy-pet/hooks/codebuddy-hook.js PreCompact"}]
  }
}
```

> 将 `/你的安装路径/workbuddy-pet` 替换为实际安装路径。

更新设置文件后重启 CodeBuddy 即可生效。

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

### POST /happy

向后兼容接口（等价于 `POST /state {"state":"happy"}`）。

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
