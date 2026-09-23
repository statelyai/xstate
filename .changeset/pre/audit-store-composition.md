---
'@xstate/store': patch
---

Fix writable atom updaters accidentally tracking other atoms, and deliver queued
subscriber notifications before rethrowing subscriber errors.

Preserve live extension state through snapshot undo/redo and custom restore
events. Fix throttled persistence applying `pick` twice or losing changes sent
from `onDone`. Report initial async storage read failures through `onError`, and
make `clearStorage` cancel buffered writes and wait for queued writes before
removing data.

Improve large batches of triggered events while preserving their processing and
effect order.
