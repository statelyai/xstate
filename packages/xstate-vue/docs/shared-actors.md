---
title: Share actors
description: Provide one actor to Vue descendants.
---

Create the actor in a parent component, then share its reference with Vue's `provide` and `inject` APIs.

```ts
const actorRef = useActorRef(machine);
provide(actorKey, actorRef);
```

```ts
const actorRef = inject(actorKey)!;
const count = useSelector(actorRef, (snapshot) => snapshot.context.count);
```

Create a unique actor for each application or request.
