# payment-retry-react

## What it teaches

Retrying a failed payment with exponential backoff: the machine loops
`submitting` → `waiting` → `submitting` up to three attempts, waiting twice as
long each time, and gives up in a terminal `failed` state.

## XState features used

- `setup()` with `schemas`, `actors`, and `delays`
- A delay defined as a function of context, for exponential backoff
- Delayed transitions (`after`) with a transition function that bumps the
  attempt counter
- `createAsyncLogic` for the mock gateway call
- `invoke` with `onDone` / `onError`, where `onError` branches between retrying
  and failing

## Run it

```bash
pnpm install
pnpm dev
```

Choose how many gateway failures to simulate and press **Pay**. With two
failures the third attempt succeeds; with four or more, all three attempts are
used and the machine lands in `failed` with a support-contact message. **Cancel**
aborts from either `submitting` or `waiting`.

## Inspect it

This example does not bundle an inspector. To watch the actor live, add
[`@statelyai/inspect`](https://stately.ai/docs/inspector) and pass it to the
hook:

```ts
import { createBrowserInspector } from '@statelyai/inspect';

const inspector = createBrowserInspector();

const [state, send] = useActor(paymentMachine, {
  inspect: inspector.inspect
});
```

Then open https://stately.ai/registry/inspect.

## Notes

The idempotency key is generated once, when the attempt series starts, and every
retry sends the same key. A retry usually means the response was lost, not that
the charge failed, so reusing the key lets the gateway recognize the repeat
request and avoid charging the customer more than once. A fresh key per attempt
would look like a fresh payment.

The gateway is mocked with a delayed promise; no network calls are made. Built
against the XState v6 alpha in this repo (`xstate: workspace:*`).
