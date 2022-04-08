---
'xstate': minor
---

The `waitFor(...)` helper function, which asynchronously _waits_ for an actor's emitted value to satisfy a `predicate` before a `timeout`, is now available.

Example usage:

```js
import { waitFor } from 'xstate/lib/waitFor';

// ...
const loginService = interpret(loginMachine).start();

const loggedInState = await waitFor(loginService, (state) =>
  state.hasTag('loggedIn')
);

loggedInState.hasTag('loggedIn'); // true
```
