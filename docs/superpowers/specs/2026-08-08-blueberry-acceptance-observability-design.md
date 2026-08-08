# Blueberry 验收模式只读观测接口设计

## 目标

为 Task 5 提供可信的 Renderer 运行态状态快照，同时保证默认启动和正式生产运行不暴露调试接口、不改变状态决策、不形成第二状态权威。

## 启用边界

- 只有进程环境变量 `BLUEBERRY_ACCEPTANCE` 严格等于字符串 `1` 时启用。
- `preload.js` 只通过现有 `petAPI` 暴露布尔值 `acceptanceMode`，不暴露环境变量对象或写能力。
- 默认启动、`npm start`、打包应用正常启动时 `acceptanceMode` 为 `false`，`window.__blueberryDebug` 必须不存在。
- 验收启动命令显式设置 `BLUEBERRY_ACCEPTANCE=1`；该模式不用于用户日常运行。

## 只读接口

Renderer 创建唯一状态控制器后，仅在 `window.petAPI.acceptanceMode === true` 时安装：

```js
Object.defineProperty(window, '__blueberryDebug', {
  value: Object.freeze({
    snapshot: function () {
      return stateController.snapshot();
    },
  }),
  writable: false,
  configurable: false,
  enumerable: false,
});
```

- 接口只能返回 `snapshot()` 的状态副本。
- 不提供 `setState`、Hook 注入、计时器控制、优先级修改或 controller 引用。
- 不改变 Hook、Main、状态控制器或 DOM 的正常数据流。

## 验收与风险控制

- 测试证明默认环境下 preload 暴露 `acceptanceMode: false`，显式验收环境为 `true`。
- 静态接线测试证明 debug 对象受严格布尔开关保护，仅调用 `snapshot()`，没有写接口。
- Task 5 用 CDP 调用 `window.__blueberryDebug.snapshot()` 取得运行态权威证据。
- 若接口仍不可达、默认模式意外暴露、或需要改变生产状态逻辑，立即停止。

## 非目标

- 不增加用户设置、调试面板、远程网络接口或生产遥测。
- 不构建、不安装、不修改真实 Codex 配置、不发布。
- 不通过该接口主动触发动画；事件输入仍使用真实 Python Hook fixtures。
