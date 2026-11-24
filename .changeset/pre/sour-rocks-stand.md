---
"@xstate/test": patch
---

Preserve the original error when the test adapter's `send()` throws or rejects. The failure trace shows the completed steps and the attempted event, and the replay fixture retries the failed send.
