---
'xstate': patch
---

Serialize function implementations as portable code expressions.

Functions in guards, actions, delays, and inline machine config now serialize as:

```ts
{ '@type': 'code', lang: 'ts', expr: '() => true' }
```

Values that cannot be represented as code or JSON still serialize with explicit `$unserializable` markers.
