---
"xstate": patch
---

Fix conflicting cross-region transitions leaving parallel regions active after their parent exits. Targeted regions that remain active now preserve their input and invoked actors without repeating entry behavior, while their default children are entered normally.
