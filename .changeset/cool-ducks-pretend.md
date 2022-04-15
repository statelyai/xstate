---
'xstate': patch
---

Removing the timeout that's built in to `waitFor` is now supported by explicitly passing an `Infinity` value.

Example usage:

```js
import { waitFor } from 'xstate/lib/waitFor';

// This will
const loggedInState = await waitFor(
  loginService,
  (state) => state.hasTag('loggedIn'),
  { timeout: Infinity }
);
```

This fixes a bug that causes `waitFor` to reject with an error immediately due to the behaviour of `setTimeout`.
