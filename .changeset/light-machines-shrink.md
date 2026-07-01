---
'xstate': patch
---

Reduce bundle size: a minimal machine + actor now costs ~14.8 kB min+gzip (was ~16.8 kB), with no API changes.

- Machine serialization (`machine.toJSON()`) and the internal listener/subscription actor logic are significantly smaller.
- Long diagnostic error messages are now development-only; production builds throw the same errors with shorter messages.
