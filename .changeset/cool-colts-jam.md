---
'@xstate/graph': major
'@xstate/test': minor
---

`getAdjacencyMap` will now only process events that are passed into `options.events`. Previously, it would attempt to process every event per state, and if there wasn't a case in the `options.events` then a payload-less event would be created -- which is problematic for events that required a payload and could lead to an invalid `context`. The consequence of this change is that `options.events` must always be explicitly passed into `getAdjacencyMap` (see test changes).
