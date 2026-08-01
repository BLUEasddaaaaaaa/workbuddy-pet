'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { createRendererStateBridge } = require('../../src/main/renderer-state-bridge');


test('state published before attach is buffered and replayed exactly once', () => {
  const bridge = createRendererStateBridge();
  const delivered = [];

  bridge.publish('working');
  assert.deepEqual(delivered, []);
  bridge.attach((state) => delivered.push(state));

  assert.deepEqual(delivered, ['working']);
});


test('states published after attach are delivered immediately', () => {
  const bridge = createRendererStateBridge();
  const delivered = [];

  bridge.attach((state) => delivered.push(state));
  bridge.publish('thinking');
  bridge.publish('working');

  assert.deepEqual(delivered, ['thinking', 'working']);
});


test('detach buffers only the latest state and reattach replays it', () => {
  const bridge = createRendererStateBridge();
  const first = [];
  const second = [];

  bridge.attach((state) => first.push(state));
  bridge.publish('working');
  bridge.detach();
  bridge.publish('happy');
  bridge.publish('sleeping');
  bridge.attach((state) => second.push(state));

  assert.deepEqual(first, ['working']);
  assert.deepEqual(second, ['sleeping']);
});


test('bridge does not suppress duplicate states', () => {
  const bridge = createRendererStateBridge();
  const delivered = [];

  bridge.attach((state) => delivered.push(state));
  bridge.publish('happy');
  bridge.publish('happy');

  assert.deepEqual(delivered, ['happy', 'happy']);
});


test('clear removes buffered state and detaches delivery', () => {
  const bridge = createRendererStateBridge();
  const delivered = [];

  bridge.publish('working');
  bridge.clear();
  bridge.attach((state) => delivered.push(state));

  assert.deepEqual(delivered, []);
});
