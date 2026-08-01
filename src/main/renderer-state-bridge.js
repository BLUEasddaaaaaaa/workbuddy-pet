'use strict';


function createRendererStateBridge() {
  let deliver = null;
  let latestState;
  let hasState = false;

  function publish(state) {
    latestState = state;
    hasState = true;
    if (deliver) deliver(state);
  }

  function attach(nextDeliver) {
    deliver = nextDeliver;
    if (hasState) deliver(latestState);
  }

  function detach() {
    deliver = null;
  }

  function clear() {
    detach();
    latestState = undefined;
    hasState = false;
  }

  return { attach, clear, detach, publish };
}


module.exports = { createRendererStateBridge };
