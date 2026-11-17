---
"xstate": patch
"@xstate/effect": patch
---

Fix an issue where a queued timer notification from a cancelled timer could prematurely fire a replacement timer that reuses the same explicit ID (#5919). Monotonic occurrence tracking ensures that delayed raise and send actions only fire for their own originating schedule instance.
