# rxjs-observable-actor

## What it teaches

Driving a machine from an RxJS observable with `createEventObservableLogic`: the machine owns the subscription, so entering a state subscribes, leaving it unsubscribes, and the stream completing or erroring lands in `onDone` / `onError`.

## XState features used

- `createEventObservableLogic` with an RxJS observable
- `invoke` with `onDone` and `onError` for stream completion and failure
- Subscription lifetime tied to state entry and exit (pause / resume)
- Final state `output`, `toPromise`

## Run it

```bash
pnpm install
pnpm start
```

Three runs are printed: a stream that completes, a stream interrupted by `pause` and restarted by `resume`, and a stream that errors.

## Inspect it

Run it with `INSPECT=1 pnpm start` to stream this example's actors to the [Stately Inspector](https://stately.ai/docs/inspector). `@statelyai/sdk` opens Stately's hosted inspector in your browser; machine definitions and snapshots are sent to Stately's hosted relay. Without `INSPECT`, the example runs offline and prints to stdout.
