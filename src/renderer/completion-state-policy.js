'use strict';

(function exposeCompletionStatePolicy(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.BlueberryCompletionStatePolicy = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function buildPolicy() {
  function createCompletionStatePolicy() {
    let sleepAfterHappy = false;

    return {
      onHappyStarted() {
        sleepAfterHappy = false;
      },

      onSleepRequested(happyActive) {
        if (happyActive) {
          sleepAfterHappy = true;
          return 'deferred';
        }
        return 'sleeping';
      },

      onActivity() {
        sleepAfterHappy = false;
      },

      onHappyFinished() {
        const nextState = sleepAfterHappy ? 'sleeping' : 'idle';
        sleepAfterHappy = false;
        return nextState;
      },
    };
  }

  return { createCompletionStatePolicy };
}));
