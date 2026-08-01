const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const { startEventServer } = require('./src/main/event-server');
const { createStateCoordinator } = require('./src/main/state-coordinator');
const { createRendererStateBridge } = require('./src/main/renderer-state-bridge');

// ========== 缩放参数 ==========
// 用法: npm start -- --scale=2  (2x 大小 = 512x512)
const scaleArg = process.argv.find(a => a.startsWith('--scale='));
const scale = parseInt(scaleArg ? scaleArg.split('=')[1] : '1') || 1;
const petSize = 160 * scale;
process.env.PET_SCALE = String(scale);

let mainWindow;
const rendererStateBridge = createRendererStateBridge();
const VISUAL_STATES = new Set(['sleeping', 'idle', 'thinking', 'working', 'happy', 'attention']);
let httpServer = null;
let stateCoordinator = null;

async function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  const window = new BrowserWindow({
    width: petSize,
    height: petSize,
    x: screenWidth - petSize - 30,
    y: screenHeight - petSize - 60,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow = window;

  window.setIgnoreMouseEvents(false);

  window.on('closed', () => {
    if (mainWindow !== window) return;
    mainWindow = null;
    rendererStateBridge.detach();
  });

  // 修复 Windows DWM 在窗口失焦时丢失透明层
  window.on('blur', () => {
    window.setBackgroundColor('#00000000');
  });
  window.on('focus', () => {
    window.setBackgroundColor('#00000000');
  });

  await window.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));
  if (mainWindow !== window || window.isDestroyed()) return;
  rendererStateBridge.attach((state) => {
    if (mainWindow !== window || window.isDestroyed()) return;
    window.webContents.send('trigger-state', state);
  });
}

// ========== IPC：JS 窗口拖拽 ==========
ipcMain.on('move-window', (_event, dx, dy) => {
  if (!mainWindow) return;
  const [x, y] = mainWindow.getPosition();
  mainWindow.setPosition(x + Math.round(dx), y + Math.round(dy));
  // 修复 Windows DWM 因高频 setPosition 丢失透明层
  mainWindow.setBackgroundColor('#00000000');
});

// 拖拽结束后做一次彻底的透明刷新
ipcMain.on('drag-end', () => {
  if (!mainWindow) return;
  mainWindow.setBackgroundColor('#00000000');
  mainWindow.setIgnoreMouseEvents(false);
});

ipcMain.on('visual-state-changed', (event, state) => {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) return;
  if (!VISUAL_STATES.has(state) || !stateCoordinator) return;
  stateCoordinator.observeVisualState(state);
});

// ========== 本地事件服务（Codex Hook → Blueberry 事件 → 宠物状态） ==========

function sendStateToRenderer(state) {
  rendererStateBridge.publish(state);
}

function startHttpTrigger() {
  if (httpServer) return;
  if (!stateCoordinator) {
    stateCoordinator = createStateCoordinator({
      emitState: sendStateToRenderer,
    });
  }
  httpServer = startEventServer({
    onEvent: (event) => stateCoordinator.accept(event),
    onState: sendStateToRenderer,
    logger: console,
  });
}

function stopAppServices() {
  rendererStateBridge.clear();
  if (stateCoordinator) {
    stateCoordinator.dispose();
    stateCoordinator = null;
  }
  if (httpServer) {
    if (httpServer.listening) httpServer.close();
    httpServer = null;
  }
}

// ========== 全局鼠标位置轮询（推送到渲染进程，实现大范围眼睛跟随） ==========
let mousePollTimer = null;

function startMousePoll() {
  if (mousePollTimer) return;
  mousePollTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const cursorPos = screen.getCursorScreenPoint();
    const bounds = mainWindow.getBounds();
    mainWindow.webContents.send('mouse-position', {
      cursorX: cursorPos.x,
      cursorY: cursorPos.y,
      windowX: bounds.x,
      windowY: bounds.y,
      windowWidth: bounds.width,
      windowHeight: bounds.height,
    });
  }, 16); // ~60fps
}

app.whenReady().then(async () => {
  await createWindow();
  startMousePoll();
  startHttpTrigger();
});

app.on('window-all-closed', () => {
  stopAppServices();
  app.quit();
});

app.on('before-quit', () => {
  stopAppServices();
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});
