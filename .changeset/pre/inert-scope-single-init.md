---
'xstate': patch
---

Pure transition functions (`initialTransition`, `transition`, and the deprecated `getInitialSnapshot`/`getNextSnapshot`) no longer run the logic's initialization twice. Previously the internal inert actor scope eagerly computed an initial snapshot, so init-time side effects such as `context` factories executed once extra with `undefined` input.
