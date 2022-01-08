---
'xstate': patch
---

The `sendTo(actorRef, event)` action creator introduced in `4.27.0`, which was not accessible from the package exports, can now be used just like other actions:

```js
import { actions } from 'xstate';

const { sendTo } = actions;
```
