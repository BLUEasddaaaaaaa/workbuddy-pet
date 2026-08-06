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
  assert.doesNotMatch(source, /http\.createServer/);
  assert.doesNotMatch(source, /Access-Control-Allow-Origin/);
  assert.doesNotMatch(source, /req\.url === '\/happy'/);
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
  assert.match(source, /handleMouseSleep/);
  assert.match(source, /handleMouseActivity/);
  assert.match(source, /requestIdleAction/);
});


test('renderer delegates all visible state decisions to one state controller', () => {
  const html = read('src/renderer/index.html');
  const source = read('src/renderer/renderer.js');

  assert.match(html, /<script src="state-controller\.js"><\/script>\s*<script src="renderer\.js"><\/script>/);
  assert.doesNotMatch(html, /completion-state-policy\.js/);

  assert.equal((source.match(/BlueberryStateController\.createStateController\s*\(/g) || []).length, 1);
  assert.match(source, /onTriggerState\s*\(function \(state\) \{\s*stateController\.handleHookState\(state\);\s*\}\)/);

  for (const competingAuthority of [
    'completionStatePolicy',
    'happyTimer',
    'workingTimer',
    'attentionTimer',
    'ATTENTION_DURATION',
    'WORKING_TIMEOUT',
    'triggerHappy',
    'triggerWorking',
    'triggerAttention',
    'triggerExternalState',
  ]) {
    assert.doesNotMatch(source, new RegExp(competingAuthority));
  }
});
