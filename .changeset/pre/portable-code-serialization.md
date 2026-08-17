---
'xstate': patch
---

Serialize inline machine functions as code expressions.

Inline guards, actions, transitions, route functions, delays, and expression-capable machine config now serialize as:

```ts
{ '@code': '() => true', '@lang': 'ts' }
```

Nonportable values such as actor logic, runtime schemas, root implementation functions, class instances, symbols, and bigints are omitted from the serialized JSON instead of being marked.
