# durable-execution

## What it teaches

How to drive a machine from `xstate/durable` through a host adapter, so that a workflow can crash and either replay deterministically against a journal or resume from a checkpoint.

## XState features used

- `createDurable` from `xstate/durable` and its explicit transition loop
- host adapter operations: `sendEvent`, `scheduleTimer`, `cancelTimer`, `runLogic`, `executeAction`, `waitForEvent`
- stable effect IDs (`2:1`) and stable actor addresses as journal keys
- `executionId` for deterministic session ids across replays
- checkpointing with `getPersistedSnapshot` plus `nextTransitionIndex`, and `restoreSnapshot` to resume

## Run it

```bash
pnpm install
pnpm start
```

The order workflow charges a card, emails a receipt and waits on a packing timer. Run 1 crashes after three transitions; run 2 replays from the beginning against the journal the crash left behind; run 3 resumes from the checkpoint instead. All three end with the same output, and the side-effect counters stay at one charge and one receipt.

`src/host.ts` is the adapter: an in-memory journal, a mailbox and a timer table. A real host (Temporal, Restate, Inngest) swaps those for its own durable log and durable wait; the contract is unchanged.

Two host responsibilities this adapter makes visible:

- A durable wait must let pending `runLogic` bodies settle before parking, or it waits for an event only their completion can produce.
- Timers belong to the host, so resuming from a checkpoint means re-arming the timers the snapshot records as pending. XState does not reschedule them on a durable host.

## Inspect it

There is no `createActor` here to attach an inspector to: `createDurable` is the journaled runtime, and `createActor` is the in-process one. The journal log printed to stdout is the observability surface for this example. To view a durable execution's actors in the [Stately Inspector](https://stately.ai/docs/inspector), run the same machine under `createActor` instead.
