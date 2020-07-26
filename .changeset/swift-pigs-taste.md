---
'xstate': minor
---

The `invoke.src` property now accepts an object that describes the invoke source with its `type` and other related metadata. This can be read from the `services` option in the `meta.src` argument:

```js
const machine = createMachine(
  {
    initial: 'searching',
    states: {
      searching: {
        invoke: {
          src: {
            type: 'search',
            endpoint: 'example.com'
          }
          // ...
        }
        // ...
      }
    }
  },
  {
    services: {
      search: (context, event, { src }) => {
        console.log(src);
        // => { endpoint: 'example.com' }
      }
    }
  }
);
```

Specifying a string for `invoke.src` will continue to work the same; e.g., if `src: 'search'` was specified, this would be the same as `src: { type: 'search' }`.
