'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  EVENT_TO_STATE,
  VALID_STATES,
  routeEvent,
  validateEventEnvelope,
} = require('../../src/main/event-router');


const EXPECTED_STATES = {
  'session.started': 'idle',
  'turn.prompt_submitted': 'thinking',
  'tool.started': 'working',
  'tool.finished': 'working',
  'permission.requested': 'attention',
  'turn.finished': 'happy',
  'session.ended': 'sleeping',
};


function metadataFor(eventType) {
  if (eventType === 'session.started') {
    return { session_source: 'startup' };
  }
  if (
    eventType === 'tool.started'
    || eventType === 'tool.finished'
    || eventType === 'permission.requested'
  ) {
    return { tool_name: 'Bash' };
  }
  return {};
}


function makeEvent(eventType = 'tool.started', overrides = {}) {
  return {
    schema_version: '1.0',
    event_id: 'evt_1234567890abcdef',
    source: 'codex',
    event_type: eventType,
    occurred_at: '2026-07-31T08:30:00.000Z',
    session_id: 'thr_test',
    turn_id: 'turn_test',
    tool_use_id: eventType.startsWith('tool.') ? 'call_test' : null,
    metadata: metadataFor(eventType),
    ...overrides,
  };
}


test('supported semantic events map to existing pet states', async (t) => {
  assert.deepEqual(EVENT_TO_STATE, EXPECTED_STATES);
  assert.deepEqual(
    [...VALID_STATES].sort(),
    ['attention', 'happy', 'idle', 'sleeping', 'thinking', 'working'],
  );

  for (const [eventType, expectedState] of Object.entries(EXPECTED_STATES)) {
    await t.test(eventType, () => {
      assert.deepEqual(
        routeEvent(makeEvent(eventType)),
        { ok: true, state: expectedState },
      );
    });
  }
});


test('invalid protocol envelopes are rejected without a state', async (t) => {
  const cases = [
    ['bad schema', makeEvent('tool.started', { schema_version: '2.0' }), 'invalid_schema_version'],
    ['bad source', makeEvent('tool.started', { source: 'other' }), 'invalid_source'],
    ['missing event id', makeEvent('tool.started', { event_id: '' }), 'invalid_event_id'],
    ['unknown event', makeEvent('unknown.event'), 'invalid_event_type'],
    ['bad timestamp', makeEvent('tool.started', { occurred_at: 'not-a-date' }), 'invalid_occurred_at'],
    ['missing session', makeEvent('tool.started', { session_id: null }), 'invalid_session_id'],
    ['bad metadata', makeEvent('tool.started', { metadata: [] }), 'invalid_metadata'],
    ['extra top-level field', { ...makeEvent(), prompt: 'private' }, 'unknown_field'],
    ['extra metadata field', makeEvent('tool.started', {
      metadata: { tool_name: 'Bash', command: 'private' },
    }), 'unknown_metadata_field'],
  ];

  for (const [name, event, expectedError] of cases) {
    await t.test(name, () => {
      assert.deepEqual(validateEventEnvelope(event), {
        ok: false,
        statusCode: 400,
        error: expectedError,
      });
      assert.deepEqual(routeEvent(event), {
        ok: false,
        statusCode: 400,
        error: expectedError,
      });
    });
  }
});


test('optional identifiers accept only strings or null', () => {
  assert.deepEqual(
    validateEventEnvelope(makeEvent('tool.started', { turn_id: 42 })),
    { ok: false, statusCode: 400, error: 'invalid_turn_id' },
  );
  assert.deepEqual(
    validateEventEnvelope(makeEvent('tool.started', { tool_use_id: {} })),
    { ok: false, statusCode: 400, error: 'invalid_tool_use_id' },
  );
  assert.deepEqual(
    validateEventEnvelope(makeEvent('session.ended', {
      turn_id: null,
      tool_use_id: null,
    })),
    { ok: true },
  );
});
