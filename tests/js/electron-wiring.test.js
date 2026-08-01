'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');


const REPO_ROOT = path.resolve(__dirname, '..', '..');


function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}


function functionSource(source, signature, nextMarker) {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, `missing ${signature}`);
  const end = source.indexOf(nextMarker, start);
  assert.ok(end > start, `missing boundary after ${signature}`);
  return source.slice(start, end);
}


test('main process composes the standalone event server', () => {
  const source = read('main.js');

  assert.match(source, /require\('\.\/src\/main\/event-server'\)/);
  assert.match(source, /require\('\.\/src\/main\/state-coordinator'\)/);
  assert.match(source, /require\('\.\/src\/main\/renderer-state-bridge'\)/);
  assert.match(source, /createStateCoordinator\(\{\s*emitState: sendStateToRenderer,?\s*\}\)/);
  assert.match(source, /onEvent:\s*\(event\)\s*=>\s*stateCoordinator\.accept\(event\)/);
  assert.match(source, /onState:\s*sendStateToRenderer/);
  assert.doesNotMatch(source, /http\.createServer/);
  assert.doesNotMatch(source, /Access-Control-Allow-Origin/);
  assert.doesNotMatch(source, /req\.url === '\/happy'/);
});


test('main process disposes app-level coordination and closes the event server', () => {
  const source = read('main.js');
  const stopServices = functionSource(source, 'function stopAppServices() {', '\n\n// ========== 全局鼠标');

  assert.match(stopServices, /if \(stateCoordinator\) \{[\s\S]*?stateCoordinator\.dispose\(\);[\s\S]*?stateCoordinator = null;[\s\S]*?\}/);
  assert.equal((stopServices.match(/stateCoordinator\.dispose\(\)/g) || []).length, 1);
  assert.equal((stopServices.match(/stateCoordinator = null/g) || []).length, 1);
  assert.match(stopServices, /if \(httpServer[\s\S]*?httpServer\.close\(\);[\s\S]*?httpServer = null;/);
  assert.match(source, /app\.on\('window-all-closed',[\s\S]*?stopAppServices\(\)/);
  assert.match(source, /app\.on\('before-quit',[\s\S]*?stopAppServices\(\)/);
});


test('main process routes state through the renderer readiness bridge', () => {
  const source = read('main.js');
  const sendState = functionSource(source, 'function sendStateToRenderer(state) {', '\n\nfunction startHttpTrigger');

  assert.match(sendState, /rendererStateBridge\.publish\(state\)/);
  assert.match(source, /rendererStateBridge\.attach\([\s\S]*?webContents\.send\('trigger-state', state\)/);
  assert.match(source, /rendererStateBridge\.detach\(\)/);
  assert.match(source, /rendererStateBridge\.clear\(\)/);
});


test('app-level coordinator and server are not recreated during window activation', () => {
  const source = read('main.js');
  const startTrigger = functionSource(source, 'function startHttpTrigger() {', '\n\nfunction stopAppServices');
  const activateStart = source.indexOf("app.on('activate', async () => {");
  assert.ok(activateStart >= 0);
  const activate = source.slice(activateStart);

  assert.match(startTrigger, /if \(httpServer\) return;/);
  assert.match(startTrigger, /if \(!stateCoordinator\) \{[\s\S]*?createStateCoordinator/);
  assert.match(activate, /await createWindow\(\)/);
  assert.doesNotMatch(activate, /startHttpTrigger|createStateCoordinator|startEventServer/);
});


test('window loading is awaited before renderer delivery is attached', () => {
  const source = read('main.js');
  const createWindow = functionSource(source, 'async function createWindow() {', '\n\n// ========== IPC');
  const load = createWindow.indexOf('await window.loadFile(');
  const attach = createWindow.indexOf('rendererStateBridge.attach(');

  assert.ok(load >= 0);
  assert.ok(attach > load);
});


test('initial services start only after the renderer window is ready', () => {
  const source = read('main.js');
  const readyStart = source.indexOf('app.whenReady().then(async () => {');
  const readyEnd = source.indexOf('\n});', readyStart);
  const ready = source.slice(readyStart, readyEnd);

  assert.ok(readyStart >= 0);
  assert.ok(ready.indexOf('await createWindow();') >= 0);
  assert.ok(ready.indexOf('startMousePoll();') > ready.indexOf('await createWindow();'));
  assert.ok(ready.indexOf('startHttpTrigger();') > ready.indexOf('await createWindow();'));
});


test('preload exposes one external state channel', () => {
  const source = read('preload.js');

  assert.match(source, /onTriggerState/);
  assert.doesNotMatch(source, /onTriggerHappy/);
  assert.doesNotMatch(source, /CodeBuddy/);
  assert.match(source, /reportVisualState:\s*\(state\)\s*=>\s*ipcRenderer\.send\('visual-state-changed', state\)/);
});


test('main accepts visual acknowledgements only from the current window', () => {
  const source = read('main.js');
  const handler = functionSource(source, "ipcMain.on('visual-state-changed'", '\n\n// ========== 本地事件服务');

  assert.match(handler, /event\.sender !== mainWindow\.webContents/);
  assert.match(handler, /mainWindow\.isDestroyed\(\)/);
  assert.match(handler, /VISUAL_STATES\.has\(state\)/);
  assert.match(handler, /stateCoordinator\.observeVisualState\(state\)/);
  assert.doesNotMatch(handler, /\.send\(|\.accept\(|reconsider/);
});


test('renderer consumes only the unified state channel', () => {
  const source = read('src/renderer/renderer.js');

  assert.match(source, /window\.petAPI\.onTriggerState/);
  assert.doesNotMatch(source, /window\.petAPI\.onTriggerHappy/);
  assert.doesNotMatch(source, /CodeBuddy/);
  assert.match(source, /idleActionTimer/);
  assert.match(source, /clearTransientTimers/);
});


test('renderer loads external state policy before renderer code', () => {
  const source = read('src/renderer/index.html');
  const completion = source.indexOf('<script src="completion-state-policy.js"></script>');
  const external = source.indexOf('<script src="external-state-policy.js"></script>');
  const renderer = source.indexOf('<script src="renderer.js"></script>');

  assert.ok(completion >= 0);
  assert.ok(external > completion);
  assert.ok(renderer > external);
});


test('renderer rejects duplicate external state before transition side effects', () => {
  const source = read('src/renderer/renderer.js');
  const functionStart = source.indexOf('function triggerExternalState(state) {');
  const functionEnd = source.indexOf('\n  function updateTargets()', functionStart);
  const body = source.slice(functionStart, functionEnd);

  assert.match(source, /BlueberryExternalStatePolicy\.createExternalStatePolicy\(\)/);
  assert.match(body, /function triggerExternalState\(state\) \{\s*if \(!externalStatePolicy\.shouldApply\(state\)\) return;/);
  assert.match(body, /if \(state !== 'happy' && happyTimer\) \{\s*clearTimeout\(happyTimer\);\s*happyTimer = null;\s*\}/);
  const dedupe = body.indexOf('shouldApply(state)');
  const cancelHappy = body.indexOf('clearTimeout(happyTimer)');
  assert.ok(dedupe < cancelHappy);
  assert.ok(cancelHappy < body.indexOf('completionStatePolicy.onActivity()'));
  assert.ok(cancelHappy < body.indexOf('switch (state)'));
  assert.ok(body.indexOf('shouldApply(state)') < body.indexOf('completionStatePolicy.onActivity()'));
  assert.ok(body.indexOf('shouldApply(state)') < body.indexOf('switch (state)'));
});


test('renderer synchronizes external policy after local visual transitions', () => {
  const source = read('src/renderer/renderer.js');
  const functionBody = (name, nextName) => {
    const start = source.indexOf(`function ${name}`);
    return source.slice(start, source.indexOf(`function ${nextName}`, start));
  };
  const enterSleep = functionBody('enterSleep', 'wakeUp');
  const wakeUp = functionBody('wakeUp', 'scheduleNextIdleAction');
  const setPetState = functionBody('setPetState', 'checkIdleActions');
  const restoreIdle = functionBody('restoreIdle', 'triggerHappy');
  const triggerHappy = functionBody('triggerHappy', 'triggerWorking');
  const triggerWorking = functionBody('triggerWorking', 'triggerAttention');
  const triggerAttention = functionBody('triggerAttention', 'triggerExternalState');
  const triggerExternalState = functionBody('triggerExternalState', 'updateTargets');

  const commitVisualState = functionBody('commitVisualState', 'hideAllActionGifs');
  assert.match(commitVisualState, /externalStatePolicy\.markVisualState\(state\);\s*window\.petAPI\.reportVisualState\(state === 'reading' \? 'idle' : state\);/);
  assert.match(enterSleep, /petContainer\.classList\.add\('sleeping'\);\s*commitVisualState\('sleeping'\);/);
  assert.match(wakeUp, /lastMouseMoveTime = performance\.now\(\);\s*commitVisualState\('idle'\);/);
  assert.match(setPetState, /petShadow\.style\.display = 'block';\s*commitVisualState\(state\);/);
  assert.ok(setPetState.indexOf('return false') < setPetState.indexOf('commitVisualState(state)'));
  assert.ok(setPetState.indexOf("petContainer.classList.add('thinking')") < setPetState.indexOf('commitVisualState(state)'));
  assert.match(setPetState, /lastMouseMoveTime = performance\.now\(\);[^\n]*\n\s*commitVisualState\('idle'\);/);
  assert.match(restoreIdle, /lastMouseMoveTime = performance\.now\(\);\s*commitVisualState\('idle'\);/);
  assert.match(triggerHappy, /petContainer\.classList\.add\('happy'\);[\s\S]*commitVisualState\('happy'\);/);
  assert.match(triggerWorking, /petContainer\.classList\.add\('working'\);[\s\S]*commitVisualState\('working'\);/);
  assert.doesNotMatch(triggerAttention, /if \(happyTimer\) return/);
  assert.doesNotMatch(triggerAttention, /clearTimeout\(happyTimer\)/);
  assert.match(triggerAttention, /petContainer\.classList\.add\('attention'\);[\s\S]*commitVisualState\('attention'\);/);
  assert.match(triggerExternalState, /setPetState\('thinking'\);/);
  assert.doesNotMatch(triggerExternalState, /markVisualState\('thinking'\)/);
});
