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
  assert.match(source, /idleActionTimer/);
  assert.match(source, /clearTransientTimers/);
});
