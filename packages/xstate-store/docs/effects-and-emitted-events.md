---
title: Effects and emitted events
description: Run effects and notify external subscribers.
---

Declare emitted event schemas, then use the enqueue argument to schedule effects after the context transition.

```ts
import { createStore } from '@xstate/store';
import { z } from 'zod';

const store = createStore({
  schemas: {
    emitted: {
      'document.saved': z.object({ id: z.string() })
    }
  },
  context: { document: null as Document | null },
  on: {
    save: (context, event: { document: Document }, enq) => {
      enq.effect(() => saveDocument(event.document));
      enq.emit['document.saved']({ id: event.document.id });
      return { document: event.document };
    }
  }
});
```

Subscribe to emitted events without observing every context change.

```ts
store.on('document.saved', (event) => console.log(event.id));
```

Effects run after the next context is calculated. Emitted events notify external consumers without becoming store transitions.

Use effects to write a draft to storage or send analytics. Use emitted events to notify a toast system or close a dialog after a save.

Use `store.inspect(...)` to observe every store transition without changing store behavior.

```ts
const subscription = store.inspect((event) => {
  console.log(event.event, store.getSnapshot().context);
});

subscription.unsubscribe();
```

## TypeScript

Emitted event payloads are inferred from the store configuration.

## Effects cheatsheet

```ts
enq.effect(() => runEffect());
enq.emit.notice({ message });
enq.trigger.refresh();
store.on('notice', (event) => console.log(event.message));
store.inspect((event) => console.log(event));
```
