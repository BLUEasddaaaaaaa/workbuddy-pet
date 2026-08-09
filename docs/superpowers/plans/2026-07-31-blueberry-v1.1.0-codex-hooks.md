# Blueberry v1.1.0 Codex Hooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 CodeBuddy 桌宠改造成能安全监听 Codex 生命周期事件的 Apple Silicon macOS MVP，同时复用已有动画和交互。

**Architecture:** Codex 为每个 Hook 事件启动一个短生命周期 Python 进程。Python 仅抽取白名单字段，生成稳定的 Blueberry 事件并通过回环 HTTP 发送给 Electron；Electron 主进程验证、去重和路由事件，渲染进程继续负责已有动画、音效、睡眠与鼠标交互。

**Tech Stack:** Electron 35、Node.js 内置 `node:test`、Python 3.10+ 标准库、Codex Hooks、loopback HTTP、electron-builder。

---

## 0. 实施原则与范围

- 正式设计：[v1.1.0 Codex Hooks Design](../specs/2026-07-31-blueberry-v1.1.0-codex-hooks-design.md)
- Codex Hook 契约：[OpenAI Codex Hooks 官方文档](https://learn.chatgpt.com/docs/hooks)
- 本计划只交付 v1.1.0 的 Codex 事件闭环，不增加新动画、LLM、RAG、音乐监听或健康提醒。
- Hook 始终输出 `{}`、退出码为 `0`，不返回审批、拒绝、重写或继续执行指令。
- 所有新逻辑先写失败测试，再写最小实现。
- 每个任务独立提交，方便回滚和面试时展示迭代轨迹。
- 开始执行前使用 `superpowers:using-git-worktrees` 创建隔离工作树；不要直接在当前 `main` 分支实现。

## 1. 文件职责

### 新建

| 文件 | 单一职责 |
|---|---|
| `hooks/codex_hook.py` | 读取 Codex Hook JSON、隐私过滤、事件归一化、单次 HTTP 投递、中立退出 |
| `hooks/codex-hooks.example.json` | 可复制到 `~/.codex/hooks.json` 的配置示例 |
| `src/main/event-router.js` | 纯函数验证事件协议并映射到桌宠状态 |
| `src/main/event-server.js` | 回环 HTTP、16 KB 限制、去重、路由与降级 |
| `tests/fixtures/codex/*.json` | 官方字段形状的固定 Hook 输入样例 |
| `tests/python/test_codex_hook.py` | Python 映射、隐私、stdout 和降级测试 |
| `tests/python/test_codex_hook_integration.py` | Python 子进程到测试 HTTP 服务的集成测试 |
| `tests/js/event-router.test.js` | 事件协议和状态映射测试 |
| `tests/js/event-server.test.js` | HTTP 状态码、体积限制、去重和端口占用测试 |
| `docs/iterations/evidence/v1.1.0-acceptance.md` | 自动化、人工、性能与构建验收证据 |

### 修改

| 文件 | 改动 |
|---|---|
| `main.js` | 删除内联 CodeBuddy HTTP 逻辑，接入 `event-server.js` |
| `preload.js` | 保留统一 `trigger-state` 通道，删除旧 `/happy` 专用桥接 |
| `src/renderer/renderer.js` | 更新 Codex 注释并清理跨状态残留计时器 |
| `src/renderer/style.css` | 仅把 CodeBuddy 注释改为 Codex，不改变视觉 |
| `package.json` | 版本升至 1.1.0，增加测试命令，macOS 构建固定为 arm64 |
| `package-lock.json` | 与 `package.json` 同步 |
| `README.md` | 改为 Codex 安装、卸载、隐私和故障排查说明 |
| `docs/iterations/v1.1.0-codex-hooks.md` | 记录实际实现与验收结论 |

### 删除

| 文件 | 原因 |
|---|---|
| `hooks/codebuddy-hook.js` | v1.1.0 已替换 CodeBuddy 集成，避免两套 Hook 成为双重事实来源 |

## Task 1：建立 Python Hook 契约与固定样例

**Files:**

- Create: `tests/fixtures/codex/session-start.json`
- Create: `tests/fixtures/codex/user-prompt-submit.json`
- Create: `tests/fixtures/codex/pre-tool-use.json`
- Create: `tests/fixtures/codex/post-tool-use.json`
- Create: `tests/fixtures/codex/permission-request.json`
- Create: `tests/fixtures/codex/stop.json`
- Create: `tests/fixtures/codex/session-end.json`
- Create: `tests/python/test_codex_hook.py`
- Create: `hooks/codex_hook.py`

- [ ] **Step 1：写入七个官方字段形状的 fixture**

每个 fixture 使用固定的 `session_id: "thr_test"` 和 `turn_id: "turn_test"`。工具样例使用：

```json
{
  "session_id": "thr_test",
  "turn_id": "turn_test",
  "transcript_path": "/private/secret/transcript.jsonl",
  "cwd": "/private/project",
  "hook_event_name": "PreToolUse",
  "model": "test-model",
  "permission_mode": "default",
  "tool_name": "Bash",
  "tool_use_id": "call_test",
  "tool_input": {
    "command": "printf private"
  }
}
```

其余文件只更换 `hook_event_name` 和该事件的官方字段：

- `SessionStart`：`source: "startup"`
- `UserPromptSubmit`：`prompt: "private prompt"`
- `PostToolUse`：增加 `tool_response: {"output": "private output"}`
- `PermissionRequest`：`tool_name: "Bash"`，不伪造 `tool_use_id`
- `Stop`：`stop_hook_active: false`、`last_assistant_message: "private answer"`
- `SessionEnd`：`reason: "other"`

- [ ] **Step 2：写失败的归一化测试**

测试必须逐项断言：

```python
EXPECTED_TYPES = {
    "session-start.json": "session.started",
    "user-prompt-submit.json": "turn.prompt_submitted",
    "pre-tool-use.json": "tool.started",
    "post-tool-use.json": "tool.finished",
    "permission-request.json": "permission.requested",
    "stop.json": "turn.finished",
    "session-end.json": "session.ended",
}
```

并覆盖：

```python
self.assertIsNone(normalize_event({**session_start, "source": "compact"}))
self.assertIsNone(normalize_event({**stop, "stop_hook_active": True}))
self.assertIsNone(normalize_event({"hook_event_name": "Unknown", "session_id": "thr_test"}))
self.assertIsNone(normalize_event({"hook_event_name": "Stop"}))
```

隐私断言对序列化后的 canonical event 搜索以下字段和值，结果必须全部不存在：

```python
FORBIDDEN = (
    "prompt",
    "tool_input",
    "tool_response",
    "transcript_path",
    "last_assistant_message",
    "private prompt",
    "printf private",
    "/private/project",
    "/private/secret/transcript.jsonl",
)
```

- [ ] **Step 3：运行测试并确认失败**

Run:

```bash
python3 -m unittest tests.python.test_codex_hook -v
```

Expected: `ModuleNotFoundError` 或 `ImportError`，因为 `hooks/codex_hook.py` 尚不存在。

- [ ] **Step 4：实现最小归一化函数**

`hooks/codex_hook.py` 暴露：

```python
def normalize_event(payload: object, now: datetime | None = None) -> dict | None:
    """Return one privacy-filtered Blueberry event, or None when ignored."""
```

实现固定映射：

```python
EVENT_TYPES = {
    "SessionStart": "session.started",
    "UserPromptSubmit": "turn.prompt_submitted",
    "PreToolUse": "tool.started",
    "PostToolUse": "tool.finished",
    "PermissionRequest": "permission.requested",
    "Stop": "turn.finished",
    "SessionEnd": "session.ended",
}
```

输出字段严格限定为：

```python
{
    "schema_version": "1.0",
    "event_id": event_id,
    "source": "codex",
    "event_type": semantic_type,
    "occurred_at": utc_iso_timestamp,
    "session_id": session_id,
    "turn_id": turn_id_or_none,
    "tool_use_id": tool_use_id_or_none,
    "metadata": metadata,
}
```

`metadata` 只允许：

- `session.started`：`{"session_source": source}`
- 工具及权限事件：`{"tool_name": tool_name}`
- 其他事件：`{}`

`event_id` 使用 `session_id`、`turn_id`、`hook_event_name`、`tool_use_id`、`SessionStart.source` 的 JSON 序列化结果计算 SHA-256，格式为 `evt_` 加前 16 个十六进制字符。

- [ ] **Step 5：再次运行测试**

Run:

```bash
python3 -m unittest tests.python.test_codex_hook -v
```

Expected: 全部通过。

- [ ] **Step 6：提交**

```bash
git add hooks/codex_hook.py tests/fixtures/codex tests/python/test_codex_hook.py
git commit -m "feat: normalize Codex hook events"
```

## Task 2：实现短生命周期 HTTP 投递和中立退出

**Files:**

- Modify: `hooks/codex_hook.py`
- Create: `tests/python/test_codex_hook_integration.py`

- [ ] **Step 1：写失败的 CLI 集成测试**

测试启动绑定到 `127.0.0.1` 随机端口的 `ThreadingHTTPServer`，再以子进程运行：

```python
completed = subprocess.run(
    [sys.executable, str(HOOK_PATH)],
    input=json.dumps(fixture),
    text=True,
    capture_output=True,
    env={**os.environ, "BLUEBERRY_PORT": str(server.server_port)},
    timeout=1,
    check=False,
)
```

断言：

```python
self.assertEqual(completed.returncode, 0)
self.assertEqual(completed.stdout, "{}")
self.assertEqual(completed.stderr, "")
self.assertEqual(captured["path"], "/event")
self.assertEqual(captured["host"], "127.0.0.1")
self.assertNotIn("tool_input", json.dumps(captured["body"]))
```

另加三个用例：

- malformed stdin：不发请求，stdout 为 `{}`。
- 未支持事件：不发请求，stdout 为 `{}`。
- 端口没有服务：20 次执行全部正常退出，单次耗时小于 500 ms。

- [ ] **Step 2：运行测试并确认失败**

```bash
python3 -m unittest tests.python.test_codex_hook_integration -v
```

Expected: 请求捕获断言失败，因为 HTTP 投递尚未实现。

- [ ] **Step 3：实现 CLI**

固定配置：

```python
PET_HOST = "127.0.0.1"
PET_PORT = int(os.environ.get("BLUEBERRY_PORT", "18920"))
POST_TIMEOUT_SECONDS = 0.2
```

实现：

```python
def post_event(event: dict) -> None:
    body = json.dumps(event, separators=(",", ":")).encode("utf-8")
    connection = http.client.HTTPConnection(
        PET_HOST,
        PET_PORT,
        timeout=POST_TIMEOUT_SECONDS,
    )
    try:
        connection.request(
            "POST",
            "/event",
            body=body,
            headers={
                "Content-Type": "application/json",
                "Content-Length": str(len(body)),
            },
        )
        response = connection.getresponse()
        response.read()
    except (OSError, TimeoutError, http.client.HTTPException):
        pass
    finally:
        connection.close()
```

入口行为：

```python
def main() -> int:
    try:
        payload = json.loads(sys.stdin.read())
        event = normalize_event(payload)
        if event is not None:
            post_event(event)
    except (ValueError, TypeError, OSError):
        pass
    sys.stdout.write("{}")
    return 0
```

不得写 stderr，不得重试，不得输出 `decision`、`continue`、`systemMessage` 或 `hookSpecificOutput`。

- [ ] **Step 4：运行全部 Python 测试**

```bash
python3 -m unittest discover -s tests/python -p "test_*.py" -v
```

Expected: 全部通过。

- [ ] **Step 5：提交**

```bash
git add hooks/codex_hook.py tests/python/test_codex_hook_integration.py
git commit -m "feat: deliver Codex events without blocking"
```

## Task 3：建立纯 JavaScript 事件路由

**Files:**

- Create: `src/main/event-router.js`
- Create: `tests/js/event-router.test.js`

- [ ] **Step 1：写失败的映射和协议测试**

测试七种映射：

```javascript
const EXPECTED_STATES = {
  'session.started': 'idle',
  'turn.prompt_submitted': 'thinking',
  'tool.started': 'working',
  'tool.finished': 'working',
  'permission.requested': 'attention',
  'turn.finished': 'happy',
  'session.ended': 'sleeping',
};
```

并断言以下输入被拒绝且不产生 state：

- `schema_version !== "1.0"`
- `source !== "codex"`
- 缺少 `event_id`、`event_type`、`occurred_at` 或 `session_id`
- 未支持的 `event_type`
- 非对象 `metadata`
- 顶层出现 `prompt`、`tool_input` 或其他非协议字段
- `metadata` 出现非白名单键

- [ ] **Step 2：运行并确认失败**

```bash
node --test tests/js/event-router.test.js
```

Expected: `MODULE_NOT_FOUND`。

- [ ] **Step 3：实现纯函数**

导出：

```javascript
module.exports = {
  EVENT_TO_STATE,
  VALID_STATES,
  validateEventEnvelope,
  routeEvent,
};
```

返回契约：

```javascript
routeEvent(event);
// accepted: { ok: true, state: 'working' }
// rejected: { ok: false, statusCode: 400, error: 'invalid_event_type' }
```

验证器使用顶层字段白名单：

```javascript
const TOP_LEVEL_FIELDS = new Set([
  'schema_version',
  'event_id',
  'source',
  'event_type',
  'occurred_at',
  'session_id',
  'turn_id',
  'tool_use_id',
  'metadata',
]);
```

并按事件限制 metadata：

```javascript
const METADATA_FIELDS = {
  'session.started': new Set(['session_source']),
  'tool.started': new Set(['tool_name']),
  'tool.finished': new Set(['tool_name']),
  'permission.requested': new Set(['tool_name']),
  'turn.prompt_submitted': new Set(),
  'turn.finished': new Set(),
  'session.ended': new Set(),
};
```

- [ ] **Step 4：运行测试**

```bash
node --test tests/js/event-router.test.js
```

Expected: 全部通过。

- [ ] **Step 5：提交**

```bash
git add src/main/event-router.js tests/js/event-router.test.js
git commit -m "feat: route Blueberry events to pet states"
```

## Task 4：建立可独立测试的回环事件服务器

**Files:**

- Create: `src/main/event-server.js`
- Create: `tests/js/event-server.test.js`

- [ ] **Step 1：写失败的 HTTP 测试**

使用 Node `http.request`，每个测试监听随机端口并在结束后关闭 server。覆盖：

| 请求 | 预期 |
|---|---|
| 合法 `POST /event` | `200`，调用一次 `onState("working")` |
| 2 秒内相同 `event_id` | 第二次 `200` + `duplicate_event`，不重复调用 |
| 2 秒后相同 `event_id` | 再次处理 |
| 合法 `POST /state` | `200`，保留手动测试能力 |
| 非法 JSON/协议 | `400` |
| 非 POST | `405` |
| 未知路由 | `404` |
| body 超过 16 KB | `413` |
| 18920 被占用 | 写诊断日志，不抛出未处理异常 |

- [ ] **Step 2：运行并确认失败**

```bash
node --test tests/js/event-server.test.js
```

Expected: `MODULE_NOT_FOUND`。

- [ ] **Step 3：实现服务器**

导出：

```javascript
module.exports = {
  MAX_BODY_BYTES,
  createEventServer,
  startEventServer,
};
```

构造参数：

```javascript
createEventServer({
  onState,
  now = Date.now,
  dedupeWindowMs = 2000,
  maxBodyBytes = 16 * 1024,
  logger = console,
});
```

服务器必须：

- 只由 `startEventServer` 绑定 `127.0.0.1:18920`。
- 在解析 JSON 前按 Buffer 字节数执行 16 KB 限制。
- 调用 `routeEvent` 后才进入去重表。
- 每次请求清理超过两秒的旧 event ID，避免常驻内存增长。
- 不设置 `Access-Control-Allow-Origin: *`。
- `onState` 抛错时返回 `500` 并记录诊断，但不终止进程。
- `EADDRINUSE` 只记录 `[blueberry] port 18920 is already in use`。

- [ ] **Step 4：运行全部 JavaScript 测试**

```bash
node --test tests/js/*.test.js
```

Expected: 全部通过。

- [ ] **Step 5：提交**

```bash
git add src/main/event-server.js tests/js/event-server.test.js
git commit -m "feat: accept validated loopback events"
```

## Task 5：接入 Electron 并清理状态计时器

**Files:**

- Modify: `main.js`
- Modify: `preload.js`
- Modify: `src/renderer/renderer.js`
- Modify: `src/renderer/style.css`

- [ ] **Step 1：记录接入前的手动基线**

启动桌宠后依次执行：

```bash
curl -sS -X POST http://127.0.0.1:18920/state \
  -H "Content-Type: application/json" \
  -d '{"state":"thinking"}'

curl -sS -X POST http://127.0.0.1:18920/state \
  -H "Content-Type: application/json" \
  -d '{"state":"working"}'

curl -sS -X POST http://127.0.0.1:18920/state \
  -H "Content-Type: application/json" \
  -d '{"state":"happy"}'
```

Expected: 思考、工作、开心动画均可见，开心音效只播放一次。

- [ ] **Step 2：替换 `main.js` 的内联 HTTP 代码**

删除 `require("http")` 和旧 `startHttpTrigger` 实现，增加：

```javascript
const { startEventServer } = require('./src/main/event-server');

function sendStateToRenderer(state) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('trigger-state', state);
}

function startHttpTrigger() {
  httpServer = startEventServer({
    onState: sendStateToRenderer,
    logger: console,
  });
}
```

窗口创建、拖拽、鼠标轮询和关闭流程保持不变。

- [ ] **Step 3：移除旧专用 IPC**

从 `preload.js` 删除 `onTriggerHappy`，从 `renderer.js` 删除对应监听。`onTriggerState` 是唯一外部状态入口。

- [ ] **Step 4：修复跨状态残留计时器**

在 `renderer.js` 增加 `idleActionTimer`，保存原来 `setPetState` 内未保存的 timeout。增加：

```javascript
function clearTransientTimers() {
  if (idleActionTimer) {
    clearTimeout(idleActionTimer);
    idleActionTimer = null;
  }
  if (workingTimer) {
    clearTimeout(workingTimer);
    workingTimer = null;
  }
  if (attentionTimer) {
    clearTimeout(attentionTimer);
    attentionTimer = null;
  }
}
```

状态优先级必须满足：

- `happyTimer` 存在时忽略 thinking、working、attention 和 sleeping。
- working 进入前清除 thinking/reading/attention 计时器。
- attention 进入前清除 thinking/reading/working 计时器。
- sleeping 进入前清除所有非 happy 计时器。
- thinking、working、attention 和 happy 会唤醒 sleeping。
- 每个 working 事件刷新 30 秒 timeout。

- [ ] **Step 5：运行自动化测试和手动快速序列**

```bash
python3 -m unittest discover -s tests/python -p "test_*.py" -v
node --test tests/js/*.test.js
```

然后快速发送 `thinking → working → attention → working → happy`。Expected: 不出现旧 timeout 导致的中途 idle，不重复播放完成音效。

- [ ] **Step 6：提交**

```bash
git add main.js preload.js src/renderer/renderer.js src/renderer/style.css
git commit -m "feat: connect Codex events to existing animations"
```

## Task 6：配置真实 Codex Hooks 并更新公开文档

**Files:**

- Create: `hooks/codex-hooks.example.json`
- Delete: `hooks/codebuddy-hook.js`
- Modify: `README.md`

- [ ] **Step 1：创建配置示例**

配置事件：

```text
SessionStart matcher ^(startup|resume|clear)$
UserPromptSubmit
PreToolUse
PostToolUse
PermissionRequest
Stop
SessionEnd
```

每个 handler：

```json
{
  "type": "command",
  "command": "python3 \"/absolute/path/to/workbuddy-pet/hooks/codex_hook.py\"",
  "timeout": 1
}
```

`SessionStart` 使用 matcher 排除 compact；其他事件不增加无效 matcher。

- [ ] **Step 2：删除 CodeBuddy Hook**

```bash
git rm hooks/codebuddy-hook.js
```

- [ ] **Step 3：重写 README 的集成部分**

README 必须包含：

- 产品定位：Codex 的环境式状态与陪伴层，不是第二聊天窗口。
- 七种事件到六种状态的映射。
- `python3 --version`、`node --version` 前置检查。
- 把示例中的脚本路径替换为本机绝对路径。
- 合并到 `~/.codex/hooks.json`，不要覆盖用户已有 Hook。
- 使用 Codex `/hooks` 审阅并信任配置。
- 卸载步骤：只删除 Blueberry 对应 handler。
- 隐私边界和不持久化说明。
- Blueberry 关闭、端口占用、Hook 未信任的排查方式。
- `POST /event` 只供 Hook 使用，`POST /state` 供手动测试。

- [ ] **Step 4：静态检查文档**

```bash
rg -n "CodeBuddy|codebuddy|/happy|Access-Control-Allow-Origin" \
  README.md main.js preload.js src hooks \
  -g '!hooks/codex-hooks.example.json'
```

Expected: 没有遗留的运行时 CodeBuddy 描述；历史设计文档不在此扫描范围。

- [ ] **Step 5：提交**

```bash
git add README.md hooks/codex-hooks.example.json hooks/codebuddy-hook.js
git commit -m "docs: document Codex hook setup"
```

## Task 7：版本、测试命令与 Apple Silicon 构建

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1：更新包元数据**

设置：

```json
{
  "version": "1.1.0",
  "description": "An ambient pixel desktop companion that visualizes Codex agent activity.",
  "scripts": {
    "start": "electron .",
    "dev": "electron . --dev",
    "test:js": "node --test tests/js/*.test.js",
    "test:python": "python3 -m unittest discover -s tests/python -p \"test_*.py\" -v",
    "test": "npm run test:js && npm run test:python",
    "build:mac": "electron-builder --mac --arm64"
  }
}
```

关键词用 `codex` 替换 `codebuddy`。Windows/Linux 构建脚本可保留，但不是本版验收范围。

- [ ] **Step 2：同步 lockfile**

```bash
npm install --package-lock-only
```

Expected: 根包名、版本和 devDependencies 与 `package.json` 一致。

- [ ] **Step 3：运行全量自动化测试**

```bash
npm test
```

Expected: Python 与 JavaScript 测试全部通过。

- [ ] **Step 4：构建 arm64 DMG**

```bash
npm run build:mac
```

Expected: `dist/` 产生 arm64 macOS 应用和 DMG；本版不签名、不公证。

- [ ] **Step 5：检查产物架构**

```bash
file "dist/mac-arm64/Blueberry Pet.app/Contents/MacOS/Blueberry Pet"
```

Expected: 输出包含 `Mach-O 64-bit executable arm64`。

- [ ] **Step 6：提交**

```bash
git add package.json package-lock.json
git commit -m "build: prepare Blueberry v1.1.0 for arm64 macOS"
```

## Task 8：真实 Codex 验收与证据归档

**Files:**

- Create: `docs/iterations/evidence/v1.1.0-acceptance.md`
- Modify: `docs/iterations/v1.1.0-codex-hooks.md`
- Modify: `../notes/blueberry-interview-notes.md`

- [ ] **Step 1：安装本机 Hook 配置**

先只读检查 `~/.codex/hooks.json`。若文件存在，合并 Blueberry handler；若不存在，从示例创建。命令中的脚本使用当前仓库的绝对路径：

```text
/Users/molan/Documents/Codex/2026-07-30/zhe-ge/outputs/workbuddy/workbuddy-pet/hooks/codex_hook.py
```

在 Codex `/hooks` 中审阅并信任新配置。不要使用 `--dangerously-bypass-hook-trust` 作为日常启动方式。

- [ ] **Step 2：执行六状态真实/fixture 验收**

| 场景 | 结果 |
|---|---|
| 启动或恢复 Codex session | Idle |
| 提交一个任务 | 500 ms 内 Thinking |
| 执行安全只读本地工具 | Working，无 idle 闪烁 |
| 触发权限请求或使用 fixture | Attention，不代替审批 |
| 完成只读小任务 | Happy + 一次音效，3 秒后 Idle |
| 发送 SessionEnd fixture | Sleeping，新活动可唤醒 |

- [ ] **Step 3：执行降级验收**

逐项验证：

- Blueberry 关闭时运行 20 次 Hook，Codex 不显示 Hook 失败，单次退出小于 500 ms。
- 发送 malformed、unknown、oversized 和 duplicate event。
- 占用 18920 后启动桌宠，窗口仍可用并输出清晰诊断。
- 连续发送快速状态序列，不出现崩溃和完成音效重复。
- 捕获的 canonical event 中不存在隐私禁止字段。

- [ ] **Step 4：记录真实证据**

`v1.1.0-acceptance.md` 必须写入：

- 测试日期、macOS 版本、arm64、Python/Node/Electron 版本。
- 每条自动化命令、通过数量和退出码。
- 20 次延迟的最大值与中位数。
- 六状态验收结论。
- 降级验收结论。
- DMG 路径和二进制架构结果。
- 未签名、未公证、未验证 Intel Mac 的明确限制。

只记录实际观察值；未通过的项目写 `Fail` 并保留原因，不把版本标为完成。

- [ ] **Step 5：更新迭代与求职记录**

只有全部发布门槛通过后：

- 将 `v1.1.0-codex-hooks.md` 状态改为 `Accepted`。
- 写入实际 changes、evidence、known limitations、retrospective 和 next decision。
- 在 `blueberry-interview-notes.md` 增加“从需求到验收证据”的案例，区分设计成果与已验证成果。

- [ ] **Step 6：最终验证**

```bash
git status --short
git diff --check
npm test
```

Expected: 无非预期文件、无空白错误、测试全部通过。

- [ ] **Step 7：提交**

```bash
git add docs/iterations README.md
git commit -m "docs: record Blueberry v1.1.0 acceptance"
```

个人求职笔记位于 Git 仓库外，不加入公开提交。

## 完成定义

只有同时满足以下条件，v1.1.0 才能对外称为“完成”：

- Python、JavaScript 和 Hook-to-HTTP 测试全部通过。
- 七个语义事件正确驱动六种已有状态。
- Blueberry 不可用时 Codex 不受影响。
- Hook 不改变工具、权限或 turn 行为。
- 20 次可用/不可用路径均满足 500 ms 门槛。
- canonical event 不含禁止的隐私字段。
- Apple Silicon DMG 构建并安装运行成功。
- 公开 README、迭代记录、验收证据与求职表达边界一致。

若任一门槛失败，保留失败证据，修复后重跑对应门槛，不通过改文案规避失败。
