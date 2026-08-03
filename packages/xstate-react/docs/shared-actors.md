---
title: Share actors
description: Provide one actor to a React subtree.
---

Create an actor context when several components need the same actor.

```tsx
import { createActorContext } from '@xstate/react';

const Counter = createActorContext(counterMachine);

function App() {
  return (
    <Counter.Provider>
      <CounterView />
    </Counter.Provider>
  );
}

function CounterView() {
  const count = Counter.useSelector((snapshot) => snapshot.context.count);
  const actorRef = Counter.useActorRef();
  return (
    <button onClick={() => actorRef.send({ type: 'increment' })}>
      {count}
    </button>
  );
}
```

Each provider creates one actor for its subtree.
