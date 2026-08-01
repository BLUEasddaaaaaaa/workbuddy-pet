const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const { startEventServer } = require('./src/main/event-server');
const { createStateCoordinator } = require('./src/main/state-coordinator');

// ========== 缩放参数 ==========
// 用法: npm start -- --scale=2  (2x 大小 = 512x512)
const scaleArg = process.argv.find(a => a.startsWith('--scale='));
const scale = parseInt(scaleArg ? scaleArg.split('=')[1] : '1') || 1;
const petSize = 160 * scale;
process.env.PET_SCALE = String(scale);

let mainWindow;

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
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

  mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));
  mainWindow.setIgnoreMouseEvents(false);

  // 修复 Windows DWM 在窗口失焦时丢失透明层
  mainWindow.on('blur', () => {
    mainWindow.setBackgroundColor('#00000000');
  });
  mainWindow.on('focus', () => {
    mainWindow.setBackgroundColor('#00000000');
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

// ========== 本地事件服务（Codex Hook → Blueberry 事件 → 宠物状态） ==========
let httpServer = null;
let stateCoordinator = null;

function sendStateToRenderer(state) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('trigger-state', state);
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

app.whenReady().then(() => {
  createWindow();
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

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
