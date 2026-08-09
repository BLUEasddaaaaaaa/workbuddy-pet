'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../..');


function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}


test('package identity is Blueberry', () => {
  const packageJson = JSON.parse(read('package.json'));
  const lockJson = JSON.parse(read('package-lock.json'));

  assert.equal(packageJson.name, 'blueberry-pet');
  assert.equal(packageJson.build.appId, 'com.blueberry.pet');
  assert.equal(packageJson.build.productName, 'Blueberry');
  assert.equal(lockJson.name, 'blueberry-pet');
  assert.equal(lockJson.packages[''].name, 'blueberry-pet');
});


test('active runtime interfaces use the Blueberry identity', () => {
  const runtimeFiles = [
    'hooks/codex_hook.py',
    'hooks/codex-hooks.example.json',
    'main.js',
    'preload.js',
    'src/main/event-server.js',
    'src/renderer/index.html',
    'src/renderer/renderer.js',
    'src/renderer/style.css',
    'tests/python/test_codex_hook_integration.py',
  ];

  for (const relativePath of runtimeFiles) {
    const source = read(relativePath);
    assert.doesNotMatch(source, /WorkBuddy|WORKBUDDY|\[workbuddy\]/);
  }

  assert.match(read('hooks/codex_hook.py'), /BLUEBERRY_PORT/);
  assert.match(
    read('hooks/codex-hooks.example.json'),
    /Blueberry ambient Codex activity integration/,
  );
  assert.match(read('src/main/event-server.js'), /\[blueberry\]/);
});


test('current user-facing documents call the product Blueberry', () => {
  const currentDocuments = [
    'README.md',
    '需求文档.md',
    'docs/iterations/README.md',
    'docs/iterations/v1.1.0-codex-hooks.md',
    'docs/iterations/v1.2.0-roadmap.md',
  ];

  for (const relativePath of currentDocuments) {
    const source = read(relativePath);
    assert.doesNotMatch(source, /WorkBuddy/);
    assert.match(source, /Blueberry/);
  }
});
