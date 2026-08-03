---
title: Server rendering
description: Use XState actors with server-rendered Solid.
---

Create actors per request. Do not share a running actor between users.

Serialize a persisted snapshot on the server and restore it on the client.

```ts
const [snapshot] = useActor(machine, { snapshot: restoredSnapshot });
```

Start browser-only effects after hydration.
