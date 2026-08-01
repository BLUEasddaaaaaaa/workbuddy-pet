'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');


const REPO_ROOT = path.resolve(__dirname, '..', '..');


function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}


test('main process composes the standalone event server', () => {
  const source = read('main.js');

  assert.match(source, /require\('\.\/src\/main\/event-server'\)/);
  assert.match(source, /require\('\.\/src\/main\/state-coordinator'\)/);
  assert.match(source, /createStateCoordinator\(\{\s*emitState: sendStateToRenderer,?\s*\}\)/);
  assert.match(source, /onEvent:\s*\(event\)\s*=>\s*stateCoordinator\.accept\(event\)/);
  assert.match(source, /onState:\s*sendStateToRenderer/);
  assert.doesNotMatch(source, /http\.createServer/);
  assert.doesNotMatch(source, /Access-Control-Allow-Origin/);
  assert.doesNotMatch(source, /req\.url === '\/happy'/);
});


test('main process disposes app-level coordination and closes the event server', () => {
  const source = read('main.js');

  assert.match(source, /if \(stateCoordinator\) \{[\s\S]*?stateCoordinator\.dispose\(\);[\s\S]*?stateCoordinator = null;[\s\S]*?\}/);
  assert.match(source, /if \(httpServer[\s\S]*?httpServer\.close\(\);[\s\S]*?httpServer = null;/);
  assert.match(source, /app\.on\('window-all-closed',[\s\S]*?stopAppServices\(\)/);
  assert.match(source, /app\.on\('before-quit',[\s\S]*?stopAppServices\(\)/);
});


test('preload exposes one external state channel', () => {
  const source = read('preload.js');

  assert.match(source, /onTriggerState/);
  assert.doesNotMatch(source, /onTriggerHappy/);
  assert.doesNotMatch(source, /CodeBuddy/);
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
  const functionEnd = source.indexOf('\n  }', functionStart);
  const body = source.slice(functionStart, functionEnd);

  assert.match(source, /BlueberryExternalStatePolicy\.createExternalStatePolicy\(\)/);
  assert.match(body, /function triggerExternalState\(state\) \{\s*if \(!externalStatePolicy\.shouldApply\(state\)\) return;/);
  assert.ok(body.indexOf('shouldApply(state)') < body.indexOf('completionStatePolicy.onActivity()'));
  assert.ok(body.indexOf('shouldApply(state)') < body.indexOf('switch (state)'));
});
