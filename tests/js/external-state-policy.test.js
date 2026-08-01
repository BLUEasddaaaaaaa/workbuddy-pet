'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { createExternalStatePolicy } = require('../../src/renderer/external-state-policy');


test('repeated working is rejected', () => {
  const policy = createExternalStatePolicy();

  assert.equal(policy.shouldApply('working'), true);
  assert.equal(policy.shouldApply('working'), false);
});


test('attention is recorded as the current approved state', () => {
  const policy = createExternalStatePolicy();

  assert.equal(policy.shouldApply('working'), true);
  assert.equal(policy.shouldApply('attention'), true);
  assert.equal(policy.current(), 'attention');
});


test('repeated happy is rejected so presentation side effects do not replay', () => {
  const policy = createExternalStatePolicy();

  assert.equal(policy.shouldApply('happy'), true);
  assert.equal(policy.shouldApply('happy'), false);
});


for (const transientState of ['attention', 'happy']) {
  test(`${transientState} can replay after the visual state returns to idle`, () => {
    const policy = createExternalStatePolicy();

    assert.equal(policy.shouldApply(transientState), true);
    assert.equal(policy.shouldApply(transientState), false);
    policy.markVisualState('idle');
    assert.equal(policy.current(), 'idle');
    assert.equal(policy.shouldApply(transientState), true);
  });
}


test('independent policy instances do not share state', () => {
  const first = createExternalStatePolicy();
  const second = createExternalStatePolicy();

  assert.equal(first.shouldApply('working'), true);
  assert.equal(second.current(), undefined);
  assert.equal(second.shouldApply('working'), true);
});
