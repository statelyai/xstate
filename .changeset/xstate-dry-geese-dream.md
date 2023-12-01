---
'xstate': patch
---

Fixed a runtime crash related to machines with their root state's type being final (`createMachine({ type: 'final' })`).
