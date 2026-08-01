'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { createCompletionStatePolicy } = require('../../src/renderer/completion-state-policy');


test('SessionEnd received during happy is deferred until happy finishes', () => {
  const policy = createCompletionStatePolicy();

  policy.onHappyStarted();
  assert.equal(policy.onSleepRequested(true), 'deferred');
  assert.equal(policy.onHappyFinished(), 'sleeping');
});


test('happy returns to idle when no SessionEnd arrives', () => {
  const policy = createCompletionStatePolicy();

  policy.onHappyStarted();
  assert.equal(policy.onHappyFinished(), 'idle');
});


test('new activity cancels a deferred sleep request', () => {
  const policy = createCompletionStatePolicy();

  policy.onHappyStarted();
  assert.equal(policy.onSleepRequested(true), 'deferred');
  policy.onActivity();
  assert.equal(policy.onHappyFinished(), 'idle');
});
