import json
import os
import socket
import subprocess
import sys
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
HOOK_PATH = REPO_ROOT / "hooks" / "codex_hook.py"
FIXTURE_DIR = REPO_ROOT / "tests" / "fixtures" / "codex"


def load_fixture(name):
    return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))


def reserve_unused_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


class CaptureHandler(BaseHTTPRequestHandler):
    captured_requests = None

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length)
        self.captured_requests.append(
            {
                "path": self.path,
                "host": self.headers.get("Host"),
                "body": json.loads(raw_body.decode("utf-8")),
            }
        )
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"status":"ok"}')

    def log_message(self, _format, *_args):
        return


class HookCliIntegrationTests(unittest.TestCase):
    def run_hook(self, payload, port, raw_input=None):
        if raw_input is None:
            raw_input = json.dumps(payload)
        env = {**os.environ, "BLUEBERRY_PORT": str(port)}
        return subprocess.run(
            [sys.executable, str(HOOK_PATH)],
            input=raw_input,
            text=True,
            capture_output=True,
            env=env,
            timeout=2,
            check=False,
        )

    def start_capture_server(self):
        captured_requests = []
        handler = type(
            "BoundCaptureHandler",
            (CaptureHandler,),
            {"captured_requests": captured_requests},
        )
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        return server, captured_requests

    def test_cli_posts_one_privacy_safe_event_to_loopback(self):
        server, captured = self.start_capture_server()

        completed = self.run_hook(
            load_fixture("pre-tool-use.json"),
            server.server_port,
        )

        self.assertEqual(completed.returncode, 0)
        self.assertEqual(completed.stdout, "{}")
        self.assertEqual(completed.stderr, "")
        self.assertEqual(len(captured), 1)
        self.assertEqual(captured[0]["path"], "/event")
        self.assertEqual(
            captured[0]["host"],
            f"127.0.0.1:{server.server_port}",
        )
        serialized = json.dumps(captured[0]["body"])
        self.assertNotIn("tool_input", captured[0]["body"])
        self.assertNotIn("printf private", serialized)

    def test_malformed_input_exits_neutrally_without_request(self):
        server, captured = self.start_capture_server()

        completed = self.run_hook({}, server.server_port, raw_input="{bad json")

        self.assertEqual(completed.returncode, 0)
        self.assertEqual(completed.stdout, "{}")
        self.assertEqual(completed.stderr, "")
        self.assertEqual(captured, [])

    def test_unknown_event_exits_neutrally_without_request(self):
        server, captured = self.start_capture_server()

        completed = self.run_hook(
            {"hook_event_name": "Unknown", "session_id": "thr_test"},
            server.server_port,
        )

        self.assertEqual(completed.returncode, 0)
        self.assertEqual(completed.stdout, "{}")
        self.assertEqual(completed.stderr, "")
        self.assertEqual(captured, [])

    def test_closed_pet_never_blocks_or_surfaces_an_error(self):
        unavailable_port = reserve_unused_port()
        durations = []

        for _ in range(20):
            started = time.perf_counter()
            completed = self.run_hook(
                load_fixture("user-prompt-submit.json"),
                unavailable_port,
            )
            durations.append(time.perf_counter() - started)

            self.assertEqual(completed.returncode, 0)
            self.assertEqual(completed.stdout, "{}")
            self.assertEqual(completed.stderr, "")

        self.assertLess(max(durations), 0.5)


if __name__ == "__main__":
    unittest.main()
