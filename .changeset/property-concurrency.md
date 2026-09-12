---
'@xstate/fast-check': minor
'xstate': minor
---

Property tests can now look for concurrency bugs.

`fastCheckAdapter({ scheduler: true })` generates an `fc.scheduler()` per run.
Wrap the system under test with `withScheduledSut` (or a reference oracle with
`withScheduledReference`) and its `send`, `read`, `settle`, and `advance` calls
resolve in an order chosen by the scheduler, so races between them are explored
instead of always taking the same microtask order. The ordering a failing run
took is recorded as `replay.data.scheduler` and can be rebuilt with
`fc.schedulerFor(ordering)`:

```ts
await propertyTest(counterMachine, {
  adapter: fastCheckAdapter({ numRuns: 100, scheduler: true }),
  events: { INC: fc.constant({}) },
  sut: withScheduledSut(counterSut),
  invariant
});
```

`xstate/graph` also gained a linearizability checker. `checkLinearizable(history,
model)` decides whether a history of overlapping operations could have come from
some sequential order, returning a witness order when it could.
`runParallelPropertyCommands(machine, { prefix, branches, sut })` runs a
sequential prefix and then N branches concurrently against a system under test
and checks the resulting history against the machine itself:

```ts
const result = await runParallelPropertyCommands(counterMachine, {
  prefix: [{ type: 'INC' }],
  branches: [[{ type: 'INC' }], [{ type: 'INC' }]],
  sut: counterSut
});

result.linearizable; // false when the branches raced
```
