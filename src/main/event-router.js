'use strict';


const EVENT_TO_STATE = Object.freeze({
  'session.started': 'idle',
  'turn.prompt_submitted': 'thinking',
  'tool.started': 'working',
  'tool.finished': 'working',
  'permission.requested': 'attention',
  'turn.finished': 'happy',
  'session.ended': 'idle',
});

const VALID_STATES = new Set([...Object.values(EVENT_TO_STATE), 'sleeping']);

const TOP_LEVEL_FIELDS = new Set([
  'schema_version',
  'event_id',
  'source',
  'event_type',
  'occurred_at',
  'session_id',
  'turn_id',
  'tool_use_id',
  'metadata',
]);

const REQUIRED_FIELDS = [
  'schema_version',
  'event_id',
  'source',
  'event_type',
  'occurred_at',
  'session_id',
  'metadata',
];

const METADATA_FIELDS = {
  'session.started': new Set(['session_source']),
  'turn.prompt_submitted': new Set(),
  'tool.started': new Set(['tool_name']),
  'tool.finished': new Set(['tool_name']),
  'permission.requested': new Set(['tool_name']),
  'turn.finished': new Set(),
  'session.ended': new Set(),
};

const SESSION_SOURCES = new Set(['startup', 'resume', 'clear']);


function rejected(error) {
  return { ok: false, statusCode: 400, error };
}


function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}


function isOptionalString(value) {
  return value === undefined || value === null || isNonEmptyString(value);
}


function validateEventEnvelope(event) {
  if (event === null || typeof event !== 'object' || Array.isArray(event)) {
    return rejected('invalid_event');
  }

  for (const field of Object.keys(event)) {
    if (!TOP_LEVEL_FIELDS.has(field)) {
      return rejected('unknown_field');
    }
  }

  for (const field of REQUIRED_FIELDS) {
    if (!Object.hasOwn(event, field)) {
      return rejected(`missing_${field}`);
    }
  }

  if (event.schema_version !== '1.0') {
    return rejected('invalid_schema_version');
  }
  if (!isNonEmptyString(event.event_id)) {
    return rejected('invalid_event_id');
  }
  if (event.source !== 'codex') {
    return rejected('invalid_source');
  }
  if (!Object.hasOwn(EVENT_TO_STATE, event.event_type)) {
    return rejected('invalid_event_type');
  }
  if (
    !isNonEmptyString(event.occurred_at)
    || !event.occurred_at.endsWith('Z')
    || Number.isNaN(Date.parse(event.occurred_at))
  ) {
    return rejected('invalid_occurred_at');
  }
  if (!isNonEmptyString(event.session_id)) {
    return rejected('invalid_session_id');
  }
  if (!isOptionalString(event.turn_id)) {
    return rejected('invalid_turn_id');
  }
  if (!isOptionalString(event.tool_use_id)) {
    return rejected('invalid_tool_use_id');
  }
  if (
    event.metadata === null
    || typeof event.metadata !== 'object'
    || Array.isArray(event.metadata)
  ) {
    return rejected('invalid_metadata');
  }

  const allowedMetadata = METADATA_FIELDS[event.event_type];
  for (const field of Object.keys(event.metadata)) {
    if (!allowedMetadata.has(field)) {
      return rejected('unknown_metadata_field');
    }
  }

  if (
    event.event_type === 'session.started'
    && !SESSION_SOURCES.has(event.metadata.session_source)
  ) {
    return rejected('invalid_session_source');
  }

  if (
    (
      event.event_type === 'tool.started'
      || event.event_type === 'tool.finished'
      || event.event_type === 'permission.requested'
    )
    && !isNonEmptyString(event.metadata.tool_name)
  ) {
    return rejected('invalid_tool_name');
  }

  return { ok: true };
}


function routeEvent(event) {
  const validation = validateEventEnvelope(event);
  if (!validation.ok) {
    return validation;
  }
  return {
    ok: true,
    state: EVENT_TO_STATE[event.event_type],
  };
}


module.exports = {
  EVENT_TO_STATE,
  VALID_STATES,
  validateEventEnvelope,
  routeEvent,
};
