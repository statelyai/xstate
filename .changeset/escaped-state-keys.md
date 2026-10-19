---
'xstate': major
---

State keys cannot contain an unescaped `.`, which separates path segments. Creating a machine with such a key throws `State key "foo.bar" contains "." — nest the states or escape it as "foo\\.bar".` To use a literal dot, write the key escaped. The escaped form is then the key everywhere: state values, implicit ids, `matches(...)`, targets and persisted snapshots. It never collides with a nested `foo` → `bar`.

```ts
// Before
states: { 'foo.bar': {} }, on: { GO: { target: 'foo\\.bar' } }

// After
states: { 'foo\\.bar': {} }, on: { GO: { target: 'foo\\.bar' } }
// snapshot.value === 'foo\\.bar'
```

Two implicit state ids can no longer coincide, and any duplicate state id now throws.
