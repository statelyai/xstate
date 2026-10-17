---
'@xstate/test': major
---

The `@xstate/test` entry point exports only the documented API. These exports were removed:

- `checkLinearizable` and the types `LinearizabilityEntry`, `LinearizabilityModel`, `LinearizabilityOptions`, `LinearizabilityResult`
- `runParallelPropertyCommands` and the types `ParallelPropertyCommandsOptions`, `ParallelPropertyCommandsResult`
- `getCurrentScheduler`, `withScheduledSut`, `withScheduledReference`
- `serializeTestTrace`, `extractReplayPath`
- the types `PropertyExecutionConfig`, `PropertyTargetObservation`

The `vitest` peer dependency now accepts Vitest 3 and Vitest 4.
