#!/usr/bin/env python3
"""Normalize Codex lifecycle hooks into privacy-safe WorkBuddy events."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone


EVENT_TYPES = {
    "SessionStart": "session.started",
    "UserPromptSubmit": "turn.prompt_submitted",
    "PreToolUse": "tool.started",
    "PostToolUse": "tool.finished",
    "PermissionRequest": "permission.requested",
    "Stop": "turn.finished",
    "SessionEnd": "session.ended",
}

TURN_SCOPED_EVENTS = {
    "UserPromptSubmit",
    "PreToolUse",
    "PostToolUse",
    "PermissionRequest",
    "Stop",
}

TOOL_EVENTS = {
    "PreToolUse",
    "PostToolUse",
    "PermissionRequest",
}

TOOL_USE_ID_EVENTS = {
    "PreToolUse",
    "PostToolUse",
}

SESSION_START_SOURCES = {
    "startup",
    "resume",
    "clear",
}


def _required_string(payload: dict, field: str) -> str | None:
    value = payload.get(field)
    if not isinstance(value, str) or not value:
        return None
    return value


def _utc_timestamp(now: datetime | None) -> str:
    instant = now or datetime.now(timezone.utc)
    if instant.tzinfo is None:
        instant = instant.replace(tzinfo=timezone.utc)
    instant = instant.astimezone(timezone.utc)
    return instant.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _event_id(
    *,
    session_id: str,
    turn_id: str | None,
    hook_event_name: str,
    tool_use_id: str | None,
    session_source: str | None,
) -> str:
    fingerprint = json.dumps(
        {
            "session_id": session_id,
            "turn_id": turn_id,
            "hook_event_name": hook_event_name,
            "tool_use_id": tool_use_id,
            "session_source": session_source,
        },
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    digest = hashlib.sha256(fingerprint).hexdigest()[:16]
    return f"evt_{digest}"


def normalize_event(payload: object, now: datetime | None = None) -> dict | None:
    """Return one privacy-filtered WorkBuddy event, or None when ignored."""
    if not isinstance(payload, dict):
        return None

    hook_event_name = _required_string(payload, "hook_event_name")
    session_id = _required_string(payload, "session_id")
    if hook_event_name not in EVENT_TYPES or session_id is None:
        return None

    if hook_event_name == "Stop" and payload.get("stop_hook_active") is not False:
        return None

    session_source = None
    if hook_event_name == "SessionStart":
        session_source = _required_string(payload, "source")
        if session_source not in SESSION_START_SOURCES:
            return None

    turn_id = None
    if hook_event_name in TURN_SCOPED_EVENTS:
        turn_id = _required_string(payload, "turn_id")
        if turn_id is None:
            return None

    tool_name = None
    if hook_event_name in TOOL_EVENTS:
        tool_name = _required_string(payload, "tool_name")
        if tool_name is None:
            return None

    tool_use_id = None
    if hook_event_name in TOOL_USE_ID_EVENTS:
        tool_use_id = _required_string(payload, "tool_use_id")
        if tool_use_id is None:
            return None

    semantic_type = EVENT_TYPES[hook_event_name]
    metadata = {}
    if semantic_type == "session.started":
        metadata["session_source"] = session_source
    elif tool_name is not None:
        metadata["tool_name"] = tool_name

    return {
        "schema_version": "1.0",
        "event_id": _event_id(
            session_id=session_id,
            turn_id=turn_id,
            hook_event_name=hook_event_name,
            tool_use_id=tool_use_id,
            session_source=session_source,
        ),
        "source": "codex",
        "event_type": semantic_type,
        "occurred_at": _utc_timestamp(now),
        "session_id": session_id,
        "turn_id": turn_id,
        "tool_use_id": tool_use_id,
        "metadata": metadata,
    }
