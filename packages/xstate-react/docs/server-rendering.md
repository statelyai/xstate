---
title: Server rendering
description: Use XState actors with server-rendered React.
---

Create actors per request. Do not share a running actor between users.

Get a persisted snapshot on the server, serialize it with the page and restore it on the client.

```tsx
const [snapshot] = useActor(machine, {
  snapshot: window.__ACTOR_SNAPSHOT__
});
```

Keep browser-only effects out of server transitions. Start them after hydration or in actor logic that only runs in the browser.

For example, restore an order actor from the database for one request, or send a persisted checkout snapshot with the page so the browser resumes the same step.
