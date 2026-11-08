---
'xstate': patch
---

Stopping a machine actor that has many children is much faster. Each stopped child used to copy all of the remaining children, so stopping 1,000 children with random IDs (e.g. `crypto.randomUUID()`) could take over a second.
