---
'xstate': major
---

The root `xstate` entry no longer exports type-level helpers: `TODO`, `IsAny`, `IsNever`, `Equals`, `Cast`, `Compute`, `Prop`, `HomomorphicOmit`, `LowInfer`, `DoNotInfer`, `SingleOrArray`, `MaybeLazy` and `AnyFunction`. Define equivalents in your own code if you used them. `ConditionalRequired`, `IsNotNever` and `NonReducibleUnknown` remain exported because emitted declarations reference them, and are marked `@experimental`.

`ActorOptions` no longer has the undocumented `parent` option. Create child actors with `invoke`, `spawn(...)` or `enq.spawn(...)`.
