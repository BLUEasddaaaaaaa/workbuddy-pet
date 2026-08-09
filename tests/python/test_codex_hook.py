import json
import unittest
from datetime import datetime, timezone
from pathlib import Path

from hooks.codex_hook import normalize_event


FIXTURE_DIR = Path(__file__).resolve().parents[1] / "fixtures" / "codex"
FIXED_NOW = datetime(2026, 7, 31, 8, 30, 0, tzinfo=timezone.utc)

EXPECTED_TYPES = {
    "session-start.json": "session.started",
    "user-prompt-submit.json": "turn.prompt_submitted",
    "pre-tool-use.json": "tool.started",
    "post-tool-use.json": "tool.finished",
    "permission-request.json": "permission.requested",
    "stop.json": "turn.finished",
    "session-end.json": "session.ended",
}

EXPECTED_METADATA = {
    "session-start.json": {"session_source": "startup"},
    "user-prompt-submit.json": {},
    "pre-tool-use.json": {"tool_name": "Bash"},
    "post-tool-use.json": {"tool_name": "Bash"},
    "permission-request.json": {"tool_name": "Bash"},
    "stop.json": {},
    "session-end.json": {},
}

FORBIDDEN_KEYS = (
    "prompt",
    "tool_input",
    "tool_response",
    "transcript_path",
    "last_assistant_message",
)

FORBIDDEN_VALUES = (
    "private prompt",
    "printf private",
    "private output",
    "private answer",
    "private approval reason",
    "/private/project",
    "/private/secret/transcript.jsonl",
)


def load_fixture(name):
    return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))


def collect_keys(value):
    if isinstance(value, dict):
        keys = set(value)
        for nested in value.values():
            keys.update(collect_keys(nested))
        return keys
    if isinstance(value, list):
        keys = set()
        for nested in value:
            keys.update(collect_keys(nested))
        return keys
    return set()


class NormalizeEventTests(unittest.TestCase):
    def test_supported_hooks_map_to_canonical_events(self):
        for fixture_name, expected_type in EXPECTED_TYPES.items():
            with self.subTest(fixture=fixture_name):
                event = normalize_event(load_fixture(fixture_name), now=FIXED_NOW)

                self.assertEqual(event["schema_version"], "1.0")
                self.assertTrue(event["event_id"].startswith("evt_"))
                self.assertEqual(len(event["event_id"]), 20)
                self.assertEqual(event["source"], "codex")
                self.assertEqual(event["event_type"], expected_type)
                self.assertEqual(event["occurred_at"], "2026-07-31T08:30:00.000Z")
                self.assertEqual(event["session_id"], "thr_test")
                self.assertEqual(event["metadata"], EXPECTED_METADATA[fixture_name])

    def test_event_id_is_stable_for_the_same_hook_input(self):
        payload = load_fixture("pre-tool-use.json")

        first = normalize_event(payload, now=FIXED_NOW)
        second = normalize_event(
            payload,
            now=datetime(2026, 7, 31, 9, 0, 0, tzinfo=timezone.utc),
        )

        self.assertEqual(first["event_id"], second["event_id"])
        self.assertNotEqual(first["occurred_at"], second["occurred_at"])

    def test_session_start_compact_is_ignored(self):
        payload = {**load_fixture("session-start.json"), "source": "compact"}

        self.assertIsNone(normalize_event(payload, now=FIXED_NOW))

    def test_stop_hook_continuation_is_ignored(self):
        payload = {**load_fixture("stop.json"), "stop_hook_active": True}

        self.assertIsNone(normalize_event(payload, now=FIXED_NOW))

    def test_unknown_or_incomplete_events_are_ignored(self):
        cases = (
            {"hook_event_name": "Unknown", "session_id": "thr_test"},
            {"hook_event_name": "Stop"},
            [],
            None,
        )

        for payload in cases:
            with self.subTest(payload=payload):
                self.assertIsNone(normalize_event(payload, now=FIXED_NOW))

    def test_canonical_event_excludes_private_hook_fields(self):
        for fixture_name in EXPECTED_TYPES:
            with self.subTest(fixture=fixture_name):
                event = normalize_event(load_fixture(fixture_name), now=FIXED_NOW)
                event_keys = collect_keys(event)
                serialized = json.dumps(event, ensure_ascii=False)

                for forbidden in FORBIDDEN_KEYS:
                    self.assertNotIn(forbidden, event_keys)
                for forbidden in FORBIDDEN_VALUES:
                    self.assertNotIn(forbidden, serialized)


if __name__ == "__main__":
    unittest.main()
