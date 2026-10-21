---
'xstate': minor
---

Change `machine.eventSchema` to validate complete public input events. It now rejects declared internal events and reserved runtime events, while allowing explicitly configured `xstate.route` destinations.

```ts
const result = await machine.eventSchema['~standard'].validate(input);
if (!result.issues) {
  actor.send(result.value);
}
```

This changes the previous alpha schema contract. Use actual machines with `machineVersions().adaptEvents()` to keep validating complete internal/runtime histories. Historical descriptors should provide their own complete history schema. `actor.send()` remains unchanged for trusted runtime delivery and replay. Payload validation requires runtime schemas; `types<T>()` supplies types only.
