---
'xstate': minor
---

The `spawn(...)` action creator has been renamed to `spawnChild(...)` to avoid confusion.

```ts
import { spawnChild, assign } from 'xstate';

const childMachine = createMachine({
  on: {
    someEvent: {
      actions: [
        // spawnChild(...) instead of spawn(...)
        spawnChild('someSrc'),

        // spawn() is used inside of assign()
        assign({
          anotherRef: ({ spawn }) => spawn('anotherSrc')
        })
      ]
    }
  }
});
```
