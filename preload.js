const { contextBridge, ipcRenderer } = require('electron');

const scale = parseInt(process.env.PET_SCALE) || 1;

contextBridge.exposeInMainWorld('petAPI', {
  platform: process.platform,
  scale: scale,
  moveWindow: (dx, dy) => ipcRenderer.send('move-window', dx, dy),
  dragEnd: () => ipcRenderer.send('drag-end'),
  onMousePosition: (callback) => {
    ipcRenderer.on('mouse-position', (_event, pos) => callback(pos));
  },
  // 通用状态触发（Codex Hook 事件 → Blueberry 状态）
  // state: 'idle' | 'thinking' | 'working' | 'happy' | 'sleeping' | 'attention'
  onTriggerState: (callback) => {
    ipcRenderer.on('trigger-state', (_event, state) => callback(state));
  },
});
