---
title: Server rendering
description: Use XState actors with server-rendered Svelte.
---

Create actors per request. Do not keep one running actor in a server module.

Serialize a persisted snapshot on the server and restore it when the component starts in the browser.

```ts
const actor = useActor(machine, { snapshot: restoredSnapshot });
```

Start browser-only effects after hydration.
