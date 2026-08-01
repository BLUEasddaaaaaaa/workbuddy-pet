'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { createExternalStatePolicy } = require('../../src/renderer/external-state-policy');


test('probing a state does not record it until the visual transition is marked', () => {
  const policy = createExternalStatePolicy();

  assert.equal(policy.shouldApply('working'), true);
  assert.equal(policy.current(), null);
  assert.equal(policy.shouldApply('working'), true);
  policy.markVisualState('working');
  assert.equal(policy.shouldApply('working'), false);
});


test('repeated happy is rejected so presentation side effects do not replay', () => {
  const policy = createExternalStatePolicy();

  assert.equal(policy.shouldApply('happy'), true);
  policy.markVisualState('happy');
  assert.equal(policy.shouldApply('happy'), false);
});


for (const transientState of ['attention', 'happy']) {
  test(`${transientState} can replay after the visual state returns to idle`, () => {
    const policy = createExternalStatePolicy();

    assert.equal(policy.shouldApply(transientState), true);
    assert.equal(policy.current(), null);
    policy.markVisualState(transientState);
    assert.equal(policy.shouldApply(transientState), false);
    policy.markVisualState('idle');
    assert.equal(policy.current(), 'idle');
    assert.equal(policy.shouldApply(transientState), true);
  });
}


test('an uncommitted candidate does not mutate the current visual state', () => {
  const policy = createExternalStatePolicy();

  policy.markVisualState('happy');
  assert.equal(policy.shouldApply('attention'), true);
  assert.equal(policy.current(), 'happy');
  assert.equal(policy.shouldApply('happy'), false);
});


test('independent policy instances do not share state', () => {
  const first = createExternalStatePolicy();
  const second = createExternalStatePolicy();

  assert.equal(first.shouldApply('working'), true);
  assert.equal(second.current(), null);
  assert.equal(second.shouldApply('working'), true);
});
