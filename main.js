const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const http = require('http');

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

// ========== 本地 HTTP 触发服务（CodeBuddy Hook 事件通知） ==========
// POST http://127.0.0.1:18920/state  Body: {"state":"working"|"happy"|"thinking"|"sleeping"|"idle"|"attention"}
// POST http://127.0.0.1:18920/happy  （向后兼容，等价于 state=happy）
//
// CodeBuddy Hook 事件 → 宠物状态映射表：
//   SessionStart      → idle
//   SessionEnd        → sleeping
//   UserPromptSubmit  → thinking
//   PreToolUse        → working
//   PostToolUse       → working
//   Stop              → happy  (stop_hook_active=false 时)
//   Notification      → happy  (idle_prompt) / attention (其他)
//   PreCompact        → idle
let httpServer = null;

// 合法的状态白名单，防止注入非预期状态
const VALID_STATES = new Set(['idle', 'thinking', 'working', 'happy', 'sleeping', 'attention']);

function sendStateToRenderer(state) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!VALID_STATES.has(state)) return;
  mainWindow.webContents.send('trigger-state', state);
}

function startHttpTrigger() {
  httpServer = http.createServer((req, res) => {
    // CORS 头，方便从任何来源调用
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end();
      return;
    }

    // ── /state 路由：通用状态触发 ──────────────────────────────
    if (req.url === '/state') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const state = payload.state;
          if (!state || !VALID_STATES.has(state)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: `invalid state: ${state}. valid: ${[...VALID_STATES].join(',')}` }));
            return;
          }
          sendStateToRenderer(state);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', state }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'error', message: 'invalid json' }));
        }
      });
      return;
    }

    // ── /happy 路由：向后兼容保留 ──────────────────────────────
    if (req.url === '/happy') {
      sendStateToRenderer('happy');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', state: 'happy' }));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  httpServer.listen(18920, '127.0.0.1', () => {
    console.log('[pet] HTTP trigger listening on http://127.0.0.1:18920');
    console.log('[pet]   POST /state  {"state":"working|happy|thinking|sleeping|idle|attention"}');
    console.log('[pet]   POST /happy  (backward compat)');
  });
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
  if (httpServer) httpServer.close();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
