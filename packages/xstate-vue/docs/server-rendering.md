---
title: Server rendering
description: Use XState actors with server-rendered Vue.
---

Create actors per request. Do not share a running actor between users.

Serialize a persisted snapshot on the server and pass it to `useActor(...)` on the client.

```ts
const { snapshot } = useActor(machine, { snapshot: restoredSnapshot });
```

Start browser-only effects after hydration.

For example, restore an order actor from the database for one request, or send a persisted checkout snapshot with the page so the browser resumes the same step.
