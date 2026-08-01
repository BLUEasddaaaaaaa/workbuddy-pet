'use strict';

const STATE_PRIORITY = Object.freeze({
  sleeping: 0,
  idle: 1,
  thinking: 2,
  working: 3,
  happy: 4,
  attention: 5,
});

const MIN_DISPLAY_MS = Object.freeze({
  sleeping: 0,
  idle: 0,
  thinking: 1000,
  working: 1000,
  happy: 3000,
  attention: 3000,
});

const ACTIVE_EXPIRY_MS = 30000;

const EVENT_STATES = Object.freeze({
  'session.started': 'idle',
  'turn.prompt_submitted': 'thinking',
  'tool.started': 'working',
  'tool.finished': 'working',
  'permission.requested': 'attention',
  'turn.finished': 'happy',
  'session.ended': 'sleeping',
});

const ACTIVE_STATES = new Set(['thinking', 'working']);


function createStateCoordinator({
  emitState,
  now = Date.now,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  if (typeof emitState !== 'function') {
    throw new TypeError('emitState must be a function');
  }

  const sessions = new Map();
  let sequence = 0;
  let displayedState = null;
  let displayedAt = 0;
  let holdTimer = null;
  let pending = false;
  let disposed = false;

  function clearHoldTimer() {
    if (holdTimer !== null) {
      clearTimer(holdTimer);
      holdTimer = null;
    }
  }

  function clearSessionExpiry(record) {
    if (record.expiryTimer !== null) {
      clearTimer(record.expiryTimer);
      record.expiryTimer = null;
    }
  }

  function resolveCandidate(fallback = 'idle') {
    let winner = null;
    for (const record of sessions.values()) {
      if (
        winner === null
        || STATE_PRIORITY[record.state] > STATE_PRIORITY[winner.state]
        || (
          STATE_PRIORITY[record.state] === STATE_PRIORITY[winner.state]
          && record.sequence > winner.sequence
        )
      ) {
        winner = record;
      }
    }
    return winner === null ? fallback : winner.state;
  }

  function emit(candidate) {
    clearHoldTimer();
    pending = false;
    displayedState = candidate;
    displayedAt = now();
    emitState(candidate);
  }

  function reconsider(fallback = 'idle') {
    if (disposed) return;
    const candidate = resolveCandidate(fallback);
    if (candidate === displayedState) {
      pending = false;
      return;
    }

    const minimum = displayedState === null ? 0 : MIN_DISPLAY_MS[displayedState];
    const remaining = displayedAt + minimum - now();
    if (remaining <= 0 || candidate === 'attention') {
      emit(candidate);
      return;
    }

    pending = true;
    if (holdTimer === null) {
      holdTimer = setTimer(() => {
        holdTimer = null;
        if (!disposed && pending) {
          pending = false;
          reconsider('idle');
        }
      }, remaining);
    }
  }

  function scheduleExpiry(sessionId, record) {
    clearSessionExpiry(record);
    record.expiryTimer = setTimer(() => {
      record.expiryTimer = null;
      if (disposed || sessions.get(sessionId) !== record || !ACTIVE_STATES.has(record.state)) return;
      sessions.delete(sessionId);
      reconsider('idle');
    }, ACTIVE_EXPIRY_MS);
  }

  function accept(input) {
    if (disposed) return { ok: false, error: 'disposed' };
    if (input === null || typeof input !== 'object') {
      return { ok: false, error: 'invalid_coordination_event' };
    }
    const { eventType, sessionId, state } = input;
    if (
      typeof eventType !== 'string'
      || typeof sessionId !== 'string'
      || sessionId.length === 0
      || EVENT_STATES[eventType] !== state
    ) {
      return { ok: false, error: 'invalid_coordination_event' };
    }

    if (eventType === 'session.ended') {
      const record = sessions.get(sessionId);
      if (record) clearSessionExpiry(record);
      sessions.delete(sessionId);
      reconsider('sleeping');
      return { ok: true };
    }

    let record = sessions.get(sessionId);
    if (record === undefined) {
      record = { state, sequence: 0, updatedAt: 0, expiryTimer: null };
      sessions.set(sessionId, record);
    } else if (eventType === 'session.started') {
      clearSessionExpiry(record);
    }

    record.state = state;
    record.sequence = ++sequence;
    record.updatedAt = now();
    if (ACTIVE_STATES.has(state)) scheduleExpiry(sessionId, record);
    else clearSessionExpiry(record);

    reconsider('idle');
    return { ok: true };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    clearHoldTimer();
    for (const record of sessions.values()) clearSessionExpiry(record);
    sessions.clear();
    pending = false;
  }

  return { accept, dispose };
}


module.exports = {
  ACTIVE_EXPIRY_MS,
  MIN_DISPLAY_MS,
  STATE_PRIORITY,
  createStateCoordinator,
};
