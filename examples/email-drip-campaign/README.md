# email-drip-campaign

## What it teaches

A long-running timed sequence — welcome, day-1 tip, day-3 send — where engagement events branch the sequence and an unsubscribe halts it from any state.

## XState features used

- `setup()` with `schemas` and named `delays`
- delayed transitions (`after`) with a function that branches on context
- machine-level `on` handlers for events that can arrive in any state
- `invoke` with `createAsyncLogic` (mock email sender)
- final state `output`, `toPromise`

## Run it

```bash
pnpm install
pnpm start
```

Two subscribers run at once. Ada opens and clicks the day-1 tip, so the day-3 send branches to the upsell; Bob unsubscribes before day 1 and his sequence stops with only the welcome email sent. The mail sender is a mock, so the run is offline.

Campaign delays are milliseconds (`day1: 600`, `day3: 700`) so the demo finishes in a couple of seconds. Only the numbers in `delays` differ from a real campaign.

The `start` script passes `--conditions=module` so that Node resolves `xstate` to this repo's source.

## Inspect it

Run it with `INSPECT=1 pnpm start` to stream this example's actors to the [Stately Inspector](https://stately.ai/docs/inspector). `@statelyai/sdk` opens Stately's hosted inspector in your browser; machine definitions and snapshots are sent to Stately's hosted relay. Without `INSPECT`, the example runs offline and prints to stdout.
