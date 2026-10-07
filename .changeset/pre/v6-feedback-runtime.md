---
"xstate": patch
---

Evaluate applied transition context and input mappers once. Clean up async actor timeouts when `run()` throws synchronously. Report unsuccessful route events as unhandled. Reject obsolete v5 transition keys in production and development, and diagnose misplaced setup internal-event declarations and enqueue-before-rejection mistakes.
