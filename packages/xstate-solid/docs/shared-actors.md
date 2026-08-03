---
title: Share actors
description: Share one actor through Solid context.
---

Create an actor reference in a parent and provide it with Solid context.

```tsx
const ActorContext = createContext<ActorRefFrom<typeof machine>>();

function ActorProvider(props: ParentProps) {
  const actorRef = useActorRef(machine);
  return (
    <ActorContext.Provider value={actorRef}>
      {props.children}
    </ActorContext.Provider>
  );
}
```

Descendants call `useContext(ActorContext)` to use the same actor.
