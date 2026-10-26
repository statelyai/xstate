---
'@xstate/test': minor
---

Add experimental `createXStateSourceCoverageSession(machine, control, { runtimeId })` for instrumented v6 source coverage. Sessions collect source outcomes and static microstep identities from a single calculation, preserve refusal observations, support event validation and SUT checks, and leave external effects unexecuted. Pair sessions with source manifests from `@statelyai/sdk/source-coverage` and witness planning/replay from `@statelyai/graph`.

SUT checks are synchronous; promise-returning checks fail instead of reporting coverage early. Failed checks leave the last accepted model snapshot unchanged. Await each session step before starting another.
