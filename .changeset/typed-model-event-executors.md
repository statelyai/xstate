---
'xstate': minor
---

`TestParam` event executors now receive the full typed event instead of only its
`type`. This is a breaking type change for model tests that annotate the `step`
argument, and event payloads are now preserved when the executor is called.

Before, `step.event` was typed as `{ type: 'SUBMIT' }`, so reading a payload
required a cast:

```ts
await path.test({
  events: {
    SUBMIT: ({ event }) => {
      const { value } = event as { value: string };
      submit(value);
    }
  }
});
```

Now the event is narrowed to the matching member of the machine's event union:

```ts
await path.test({
  events: {
    SUBMIT: ({ event }) => submit(event.value)
  }
});
```

Remove casts like the one above. Executors that destructure a payload which the
event type does not declare will now fail to typecheck.
