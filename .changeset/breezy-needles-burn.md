---
'@xstate/inspect': minor
---

A serializer can now be specified as an option for `inspect(...)` in the `.serialize` property. It should be a [replacer function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#the_replacer_parameter):

```js
// ...

inspect({
  // ...
  serialize: (key, value) => {
    if (value instanceof Map) {
      return 'map';
    }

    return value;
  }
});

// ...

// Will be inspected as:
// {
//   type: 'EVENT_WITH_MAP',
//   map: 'map'
// }
someService.send({
  type: 'EVENT_WITH_MAP',
  map: new Map()
});
```
