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

This works well for a cart shared by checkout components or a session actor shared by one application shell. Create one actor per application or request.
