# connection-manager

## What it teaches

How to model a reconnecting client: connect, hold the link open with a heartbeat, treat a missing pong as a drop, and reconnect with jittered exponential backoff until a maximum attempt count is reached.

## XState features used

- `after` heartbeat with `reenter: true` to rearm the timer
- computed delay with exponential backoff and full jitter
- named guard (`canRetry`) bounding reconnect attempts
- final state `output`, `toPromise`

## Run it

```bash
pnpm install
pnpm start
```

A scripted flaky transport connects, drops after a few pongs, reconnects after two failed dials, drops again, and then fails every dial until the client gives up.

## Inspect it

Run it with `INSPECT=1 pnpm start` to stream this example's actors to the [Stately Inspector](https://stately.ai/docs/inspector). `@statelyai/sdk` opens Stately's hosted inspector in your browser; machine definitions and snapshots are sent to Stately's hosted relay. Without `INSPECT`, the example runs offline and prints to stdout.
