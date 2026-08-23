# agent-streaming-response

## What it teaches

How to feed streamed LLM tokens into a machine as events, accumulating them in context, with cancellation mid-stream and a single retry after a stream error.

## XState features used

- `invoke` with `createCallbackLogic` sending one event per token
- context accumulation in a transition function
- actor cleanup on state exit (cancellation aborts the stream)
- delayed transition (`after`) for the retry backoff
- final state `output`, `toPromise`

## Run it

```bash
pnpm install
pnpm start
```

The token stream is mocked with a deterministic `createCallbackLogic` actor so the demo runs offline. A real implementation iterates the SDK's streaming response and calls `sendBack` per token; the cleanup function returned by the callback is where the request is aborted.

The demo runs three scenarios: a stream that completes, one cancelled mid-stream, and one that errors and is retried once.

## Inspect it

Run it with `INSPECT=1 pnpm start` to stream this example's actors to the [Stately Inspector](https://stately.ai/docs/inspector). `@statelyai/sdk` opens Stately's hosted inspector in your browser; machine definitions and snapshots are sent to Stately's hosted relay. Without `INSPECT`, the example runs offline and prints to stdout.
