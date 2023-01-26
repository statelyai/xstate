---
'@xstate/react': minor
---

The `createActorContext(...)` helper has been introduced to make global actors easier to use with React. It outputs a React Context object with the following properties:

- `.Provider` - The React Context provider
- `.useActor(...)` - A hook that can be used to get the current state and send events to the actor
- `.useSelector(...)` - A hook that can be used to select some derived state from the actor's state
- `.useActorRef()` - A hook that can be used to get a reference to the actor that can be passed to other components

Usage:

```jsx
import { createActorContext } from '@xstate/react';
import { someMachine } from './someMachine';

// Create a React Context object that will interpret the machine
const SomeContext = createActorContext(someMachine);

function SomeComponent() {
  // Get the current state and `send` function
  const [state, send] = SomeContext.useActor();

  // Or select some derived state
  const someValue = SomeContext.useSelector((state) => state.context.someValue);

  // Or get a reference to the actor
  const actorRef = SomeContext.useActorRef();

  return (/* ... */);
}

function App() {
  return (
    <SomeContext.Provider>
      <SomeComponent />
    </SomeContext.Provider>
  );
}
```
