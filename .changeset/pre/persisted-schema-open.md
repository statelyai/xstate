---
'xstate': patch
---

The persisted snapshot JSON schema now accepts unknown fields on the envelope, on `children` entries and on `timers` entries. Readers should ignore fields they don't recognize; future 6.x releases may add optional fields.
