---
'@xstate/react': minor
---

`useActor` and `useSelector` now throw when the actor reaches an error state, allowing errors to be caught by React error boundaries.

```tsx
import { createMachine } from 'xstate';
import { useActor } from '@xstate/react';
import { ErrorBoundary } from 'react-error-boundary';

const machine = createMachine({
  initial: 'idle',
  states: {
    idle: {
      on: {
        fetch: 'loading'
      }
    },
    loading: {
      invoke: {
        src: fromPromise(async () => {
          throw new Error('Network error');
        }),
        onDone: 'success'
        // Without onError, the actor enters an error state
      }
    },
    success: {}
  }
});

function App() {
  return (
    <ErrorBoundary fallback={<p>Something went wrong</p>}>
      <ActorComponent />
    </ErrorBoundary>
  );
}

function ActorComponent() {
  // If the actor errors, the error will be thrown
  // and caught by the nearest error boundary
  const [snapshot, send] = useActor(machine);

  return <div>{snapshot.value}</div>;
}
```
