---
'@xstate/react': minor
---

The `createHooks(actorRef)` function is introduced, which creates useful global hooks for actors:

```jsx
import { createHooks } from '@xstate/react';
import { authMachine } from './authMachine';
import { interpret } from 'xstate';

// Interpret the machine first (full interpretation control)
const authService = interpret(authMachine).start();

// Create a "hooks object" from the actor
const auth = createHooks(authService);

// ...

const SomeForm = () => {
  // Get full state snapshot and send() function
  const [state, send] = auth.useActor();

  // Get selected state
  const isLoggedIn = auth.useSelector((state) => state.hasTag('authorized'));

  // ...
};
```

For more info, see the RFC: https://github.com/statelyai/rfcs/pull/8
