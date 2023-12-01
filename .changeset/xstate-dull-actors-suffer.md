---
'xstate': minor
---

Partial event descriptors are now type-safe:

```ts
createMachine({
  types: {} as {
    events:
      | { type: 'mouse.click.up'; direction: 'up' }
      | { type: 'mouse.click.down'; direction: 'down' }
      | { type: 'mouse.move' }
      | { type: 'keypress' };
  },
  on: {
    'mouse.click.*': {
      actions: ({ event }) => {
        event.type;
        // 'mouse.click.up' | 'mouse.click.down'
        event.direction;
        // 'up' | 'down'
      }
    },
    'mouse.*': {
      actions: ({ event }) => {
        event.type;
        // 'mouse.click.up' | 'mouse.click.down' | 'mouse.move'
      }
    }
  }
});
```
