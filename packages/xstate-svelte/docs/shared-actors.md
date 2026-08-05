---
title: Share actors
description: Share one actor through Svelte context.
---

Create the actor in a parent component and put its reference in Svelte context.

```ts
const actorRef = useActorRef(machine);
setContext(actorKey, actorRef);
```

Descendants can read the same reference.

```ts
const actorRef = getContext(actorKey);
const count = useSelector(actorRef, (snapshot) => snapshot.context.count);
```

This works well for a cart shared by checkout components or a session actor shared by one application shell. Create one actor per application or request.
