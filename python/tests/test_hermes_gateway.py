"""Static contract tests for the Python/Hermes gateway (no live model required)."""
import importlib.util
import os
import pathlib
import unittest
from unittest import mock

PATH = pathlib.Path(__file__).resolve().parents[1] / "hermes_gateway.py"
spec = importlib.util.spec_from_file_location("kairoq_hermes_gateway", PATH)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class HermesGatewayTests(unittest.TestCase):
    def test_unconfigured_is_not_reported_ready(self):
        with mock.patch.object(module, "MODEL", ""), mock.patch.object(module, "TOKEN", ""):
            self.assertFalse(module.configured())

    def test_generation_needs_real_runtime_and_credentials(self):
        with mock.patch.object(module, "MODEL", ""), mock.patch.object(module, "TOKEN", ""):
            with self.assertRaises(RuntimeError):
                module.generate([{"role":"user","content":"hello"}])

    def test_scoped_sessions_are_stable_and_distinct(self):
        with mock.patch.object(module, "TOKEN", "example-long-secret"):
            one = module.scoped_session_id("conversation-one")
            self.assertEqual(one, module.scoped_session_id("conversation-one"))
            self.assertNotEqual(one, module.scoped_session_id("conversation-two"))
            self.assertEqual(len(one), 36)

    def test_invalid_session_identity_is_rejected(self):
        with mock.patch.object(module, "TOKEN", "example-long-secret"):
            with self.assertRaises(ValueError):
                module.scoped_session_id("")
            with self.assertRaises(ValueError):
                module.scoped_session_id("X" * 129)

    def test_dangerous_tools_are_not_enabled_by_default(self):
        # Operator may explicitly enable audited Hermes toolsets later.
        self.assertNotIn("terminal", module.TOOLSETS)
        self.assertNotIn("shell", module.TOOLSETS)

    def test_iteration_cap_is_bounded(self):
        self.assertGreaterEqual(module.MAX_ITERATIONS, 1)
        self.assertLessEqual(module.MAX_ITERATIONS, 20)

if __name__ == "__main__":
    unittest.main()
