'use strict';

const http = require('node:http');

const {
  VALID_STATES,
  routeEvent,
} = require('./event-router');


const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 18920;
const MAX_BODY_BYTES = 16 * 1024;
const DEDUPE_WINDOW_MS = 2_000;


function sendJson(res, statusCode, payload) {
  if (res.writableEnded) return;
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}


function readJsonBody(req, res, maxBodyBytes, onPayload) {
  const chunks = [];
  let receivedBytes = 0;
  let rejected = false;

  req.on('data', (chunk) => {
    if (rejected) return;
    receivedBytes += chunk.length;
    if (receivedBytes > maxBodyBytes) {
      rejected = true;
      sendJson(res, 413, {
        status: 'error',
        message: 'body_too_large',
      });
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', () => {
    if (rejected) return;
    const rawBody = Buffer.concat(chunks).toString('utf8');
    try {
      onPayload(JSON.parse(rawBody || '{}'));
    } catch (_error) {
      sendJson(res, 400, {
        status: 'error',
        message: 'invalid_json',
      });
    }
  });

  req.on('error', () => {
    sendJson(res, 400, {
      status: 'error',
      message: 'request_error',
    });
  });
}


function createEventServer({
  onState,
  now = Date.now,
  dedupeWindowMs = DEDUPE_WINDOW_MS,
  maxBodyBytes = MAX_BODY_BYTES,
  logger = console,
} = {}) {
  const deliverState = typeof onState === 'function' ? onState : () => {};
  const seenEvents = new Map();

  return http.createServer((req, res) => {
    if (req.method !== 'POST') {
      sendJson(res, 405, {
        status: 'error',
        message: 'method_not_allowed',
      });
      return;
    }

    if (req.url !== '/event' && req.url !== '/state') {
      sendJson(res, 404, {
        status: 'error',
        message: 'not_found',
      });
      return;
    }

    readJsonBody(req, res, maxBodyBytes, (payload) => {
      if (req.url === '/state') {
        if (
          payload === null
          || typeof payload !== 'object'
          || Array.isArray(payload)
          || !VALID_STATES.has(payload.state)
        ) {
          sendJson(res, 400, {
            status: 'error',
            message: 'invalid_state',
          });
          return;
        }

        try {
          deliverState(payload.state);
        } catch (error) {
          logger.error(`[workbuddy] renderer state delivery failed: ${error.message}`);
          sendJson(res, 500, {
            status: 'error',
            message: 'state_delivery_failed',
          });
          return;
        }

        sendJson(res, 200, {
          status: 'ok',
          state: payload.state,
        });
        return;
      }

      const routed = routeEvent(payload);
      if (!routed.ok) {
        sendJson(res, routed.statusCode, {
          status: 'error',
          message: routed.error,
        });
        return;
      }

      const timestamp = now();
      for (const [eventId, seenAt] of seenEvents) {
        if (timestamp - seenAt >= dedupeWindowMs) {
          seenEvents.delete(eventId);
        }
      }

      const previous = seenEvents.get(payload.event_id);
      if (previous !== undefined && timestamp - previous < dedupeWindowMs) {
        sendJson(res, 200, {
          status: 'ignored',
          reason: 'duplicate_event',
        });
        return;
      }

      try {
        deliverState(routed.state);
      } catch (error) {
        logger.error(`[workbuddy] renderer state delivery failed: ${error.message}`);
        sendJson(res, 500, {
          status: 'error',
          message: 'state_delivery_failed',
        });
        return;
      }

      seenEvents.set(payload.event_id, timestamp);
      sendJson(res, 200, {
        status: 'ok',
        event_id: payload.event_id,
        state: routed.state,
      });
    });
  });
}


function startEventServer({
  onState,
  host = DEFAULT_HOST,
  port = DEFAULT_PORT,
  logger = console,
  ...serverOptions
} = {}) {
  const server = createEventServer({
    onState,
    logger,
    ...serverOptions,
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`[workbuddy] port ${port} is already in use`);
      return;
    }
    logger.error(`[workbuddy] event server error: ${error.message}`);
  });

  server.listen(port, host, () => {
    if (typeof logger.log === 'function') {
      logger.log(`[workbuddy] event server listening on http://${host}:${port}`);
    }
  });

  return server;
}


module.exports = {
  MAX_BODY_BYTES,
  createEventServer,
  startEventServer,
};
