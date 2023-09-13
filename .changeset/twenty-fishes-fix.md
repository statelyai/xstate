---
'xstate': patch
---

Added back UMD builds. Please note that XState now comes with multiple entrypoints and you might need to load all of them (`XState`, `XStateActions`, `XStateGuards`, etc.). It's also worth mentioning that those bundles don't reference each other so they don't actually share any code and some code might be duplicated between them.
