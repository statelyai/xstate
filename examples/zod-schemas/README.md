# zod-schemas

## What it teaches

How to define context, events, input and output with Zod schemas, and what runtime validation adds on top of the types — invalid payloads are rejected before any transition runs.

## XState features used

- Zod schemas (Standard Schema) in `setup({ schemas })` for `context`, `events`, `input` and `output`
- `standardSchemaValidator()` from `xstate/validation` on both the machine and an actor created with `createAsyncLogic`
- the actor error channel (`actor.subscribe({ error })`) and the resulting `error` status
- `invoke` with a validated `input`, final state `output`, `toPromise`

## Run it

```bash
pnpm install
pnpm start
```

The signup machine accepts one valid submission, then three invalid ones: a malformed email, a payload parsed from JSON whose `plan` is not in the enum, and machine input of the wrong type. Each failure prints on the actor's error channel and leaves the state value untouched.

Two behaviors worth knowing:

- Schemas alone do nothing at runtime. Without `validator: standardSchemaValidator()`, a Zod schema in `schemas` is only a source of types — exactly like `types<T>()`, which never validates. Use `types<T>()` when the data is already trusted, and a Standard Schema plus a validator at the edges where it is not.
- A validation failure on a running actor is not thrown at the `send` call site. It goes to the actor's error channel, and the actor's status becomes `error`. The pure `transition()` API throws instead, because there is no actor to error.

## Inspect it

Run it with `INSPECT=1 pnpm start` to stream this example's actors to the [Stately Inspector](https://stately.ai/docs/inspector). `@statelyai/sdk` opens Stately's hosted inspector in your browser; machine definitions and snapshots are sent to Stately's hosted relay. Without `INSPECT`, the example runs offline and prints to stdout.
