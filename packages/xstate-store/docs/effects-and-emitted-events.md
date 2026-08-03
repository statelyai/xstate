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

## TypeScript

Emitted event payloads are inferred from the store configuration.

## Effects cheatsheet

```ts
enq.effect(() => runEffect());
enq.emit.notice({ message });
store.on('notice', (event) => console.log(event.message));
```
