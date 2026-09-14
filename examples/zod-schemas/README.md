# zod-schemas

## What it teaches

How to define context, events, input and output with Zod schemas, what runtime validation adds on top of the types, and where each kind of failure surfaces — invalid incoming events are rejected at the delivery boundary, while faults the machine produces itself error the actor.

## XState features used

- Zod schemas (Standard Schema) in `setup({ schemas })` for `context`, `events`, `input` and `output`
- `standardSchemaValidator()` from `xstate/validation` on both the machine and an actor created with `createAsyncLogic`
- `onRejectedEvent` on `createActor` options, the root actor's dead-letter hook, including the Standard Schema `issues` it carries
- the actor error channel (`actor.subscribe({ error })`) and the resulting `error` status
- `invoke` with a validated `input`, final state `output`, `toPromise`

## Run it

```bash
pnpm install
pnpm start
```

The signup machine accepts one valid submission, then four failures: a malformed email, a payload parsed from JSON whose `plan` is not in the enum, machine input of the wrong type, and a machine that raises an event its own schema rejects.

Three behaviors worth knowing:

- Schemas alone do nothing at runtime. Without `validator: standardSchemaValidator()`, a Zod schema in `schemas` is only a source of types — exactly like `types<T>()`, which never validates. Use `types<T>()` when the data is already trusted, and a Standard Schema plus a validator at the edges where it is not.
- An event arriving from outside with an invalid payload is rejected before delivery. `send` does not throw, the actor does not transition and does not error — its status stays `active`. The rejection is reported to `onRejectedEvent` with the failing `issues`, and to [inspection](https://stately.ai/docs/inspection) observers as a `@xstate.deadletter` event. A pure `transition(...)` call returns the snapshot unchanged plus a `@xstate.deadLetter` effect.
- Values the machine produces itself — input, context, output, emitted events and delayed raised events — are machine bugs when they fail their schema, so they error the actor, and the pure APIs throw.

## Inspect it

Run it with `INSPECT=1 pnpm start` to stream this example's actors to the [Stately Inspector](https://stately.ai/docs/inspector). `@statelyai/sdk` opens Stately's hosted inspector in your browser; machine definitions and snapshots are sent to Stately's hosted relay. Without `INSPECT`, the example runs offline and prints to stdout.
