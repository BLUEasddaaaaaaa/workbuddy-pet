'use strict';

(function exposeExternalStatePolicy(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.BlueberryExternalStatePolicy = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function buildPolicy() {
  function createExternalStatePolicy() {
    let currentState;

    return {
      shouldApply(state) {
        if (state === currentState) return false;
        currentState = state;
        return true;
      },

      markVisualState(state) {
        currentState = state;
      },

      current() {
        return currentState;
      },
    };
  }

  return { createExternalStatePolicy };
}));
