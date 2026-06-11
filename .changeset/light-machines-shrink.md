---
'xstate': patch
---

Reduce bundle size: a minimal machine + actor now costs ~14.8 kB min+gzip (was ~16.8 kB), with no API changes.

- Apps that don't use atoms no longer bundle the reactive system — actors notify subscribers directly, and atom↔actor reactivity (`createAtom(() => actor.get())`) is wired up lazily on first atom use.
- Machine serialization (`machine.toJSON()`) and the internal listener/subscription actor logic are significantly smaller.
- Long diagnostic error messages are now development-only; production builds throw the same errors with shorter messages.
