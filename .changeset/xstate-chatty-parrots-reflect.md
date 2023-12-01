---
'xstate': major
---

IDs for delayed events are no longer derived from event types so this won't work automatically:

```ts
entry: raise({ type: 'TIMER' }, { delay: 200 });
exit: cancel('TIMER');
```

Please use explicit IDs:

```ts
entry: raise({ type: 'TIMER' }, { delay: 200, id: 'myTimer' });
exit: cancel('myTimer');
```
