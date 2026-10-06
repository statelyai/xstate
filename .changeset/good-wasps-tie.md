---
"xstate": minor
---

Add `machine.serialize()` to return the canonical machine definition without importing a version-specific serializer. Add `machine.serializeForInspection()` and `serializeMachineForInspection(machine)` to transport invoke topology, including inline actor callbacks, in a versioned inspection envelope.

```ts
const definition = machine.serialize();
const inspection = machine.serializeForInspection();
```

Inspection output uses placeholders for anonymous inline actors and cannot be revived as an executable machine. Executable serialization and original JSON roundtrips are unchanged.
