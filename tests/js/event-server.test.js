'use strict';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const http = require('node:http');
const test = require('node:test');

const {
  createEventServer,
  startEventServer,
} = require('../../src/main/event-server');


function makeEvent(overrides = {}) {
  return {
    schema_version: '1.0',
    event_id: 'evt_1234567890abcdef',
    source: 'codex',
    event_type: 'tool.started',
    occurred_at: '2026-07-31T08:30:00.000Z',
    session_id: 'thr_test',
    turn_id: 'turn_test',
    tool_use_id: 'call_test',
    metadata: { tool_name: 'Bash' },
    ...overrides,
  };
}


function request({ port, path = '/event', method = 'POST', body = '' }) {
  return new Promise((resolve, reject) => {
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: text ? JSON.parse(text) : null,
          });
        });
      },
    );
    req.on('error', reject);
    req.end(payload);
  });
}


async function listenForTest(t, options = {}) {
  const events = [];
  const states = [];
  const server = createEventServer({
    onEvent: (event) => events.push(event),
    onState: (state) => states.push(state),
    ...options,
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return {
    port: server.address().port,
    server,
    events,
    states,
  };
}


test('POST /event routes one accepted event', async (t) => {
  const { port, events, states } = await listenForTest(t);

  const response = await request({ port, body: makeEvent() });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    status: 'ok',
    event_id: 'evt_1234567890abcdef',
    state: 'working',
  });
  assert.deepEqual(events, [{
    eventType: 'tool.started',
    sessionId: 'thr_test',
    state: 'working',
  }]);
  assert.deepEqual(Object.keys(events[0]).sort(), ['eventType', 'sessionId', 'state']);
  for (const privateField of [
    'metadata',
    'turn_id',
    'tool_use_id',
    'prompt',
    'command',
    'path',
    'input',
    'output',
  ]) {
    assert.equal(Object.hasOwn(events[0], privateField), false);
  }
  assert.deepEqual(states, []);
  assert.equal(response.headers['access-control-allow-origin'], undefined);
});


test('duplicate event ids are suppressed only inside the two-second window', async (t) => {
  let now = 1_000;
  const { port, events, states } = await listenForTest(t, { now: () => now });
  const event = makeEvent();

  const first = await request({ port, body: event });
  now = 2_999;
  const duplicate = await request({ port, body: event });
  now = 3_001;
  const later = await request({ port, body: event });

  assert.equal(first.body.status, 'ok');
  assert.deepEqual(duplicate.body, {
    status: 'ignored',
    reason: 'duplicate_event',
  });
  assert.equal(later.body.status, 'ok');
  assert.equal(events.length, 2);
  assert.deepEqual(events, [
    { eventType: 'tool.started', sessionId: 'thr_test', state: 'working' },
    { eventType: 'tool.started', sessionId: 'thr_test', state: 'working' },
  ]);
  assert.deepEqual(states, []);
});


test('POST /state remains available for manual animation checks', async (t) => {
  const { port, events, states } = await listenForTest(t);

  const response = await request({
    port,
    path: '/state',
    body: { state: 'attention' },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { status: 'ok', state: 'attention' });
  assert.deepEqual(events, []);
  assert.deepEqual(states, ['attention']);
});


test('HTTP boundary rejects malformed, unknown, and oversized requests', async (t) => {
  const { port, events, states } = await listenForTest(t);
  const cases = [
    {
      name: 'invalid json',
      request: { port, body: '{bad json' },
      statusCode: 400,
    },
    {
      name: 'invalid envelope',
      request: { port, body: { schema_version: '2.0' } },
      statusCode: 400,
    },
    {
      name: 'invalid manual state',
      request: { port, path: '/state', body: { state: 'unknown' } },
      statusCode: 400,
    },
    {
      name: 'unknown route',
      request: { port, path: '/missing', body: {} },
      statusCode: 404,
    },
    {
      name: 'unsupported method',
      request: { port, method: 'GET', body: '' },
      statusCode: 405,
    },
    {
      name: 'oversized body',
      request: { port, body: 'x'.repeat((16 * 1024) + 1) },
      statusCode: 413,
    },
  ];

  for (const entry of cases) {
    await t.test(entry.name, async () => {
      const response = await request(entry.request);
      assert.equal(response.statusCode, entry.statusCode);
    });
  }
  assert.deepEqual(events, []);
  assert.deepEqual(states, []);
});


test('occupied port logs a diagnostic without an unhandled error', async (t) => {
  const blocker = http.createServer();
  blocker.listen(0, '127.0.0.1');
  await once(blocker, 'listening');
  t.after(() => new Promise((resolve) => blocker.close(resolve)));

  const messages = [];
  const candidate = startEventServer({
    onEvent: () => {},
    onState: () => {},
    port: blocker.address().port,
    logger: {
      log: () => {},
      error: (message) => messages.push(message),
    },
  });

  const [error] = await once(candidate, 'error');

  assert.equal(error.code, 'EADDRINUSE');
  assert.equal(messages.length, 1);
  assert.match(messages[0], /already in use/);
});
