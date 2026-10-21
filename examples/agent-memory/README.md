# agent-memory

## What it teaches

How to keep an agent's context window bounded: when the message history crosses a threshold, a summarizer actor folds the oldest messages into a summary, and the conversation resumes with a shorter window.

## XState features used

- `invoke` with `createAsyncLogic` for the completion and the summarizer
- an `always` transition for the window check
- context replacement (old messages swapped for a summary)
- final state `output`, `waitFor`, `toPromise`

## Run it

```bash
pnpm install
pnpm start
```

Both the completion and the summarizer are mocked with deterministic `createAsyncLogic` actors so the demo runs offline. Swap their `run` bodies for real client calls — each takes the current summary and messages as `input` — and the machine is unchanged.

The demo sends seven messages, which triggers two compactions.

## Inspect it

Run it with `INSPECT=1 pnpm start` to stream this example's actors to the [Stately Inspector](https://stately.ai/docs/inspector). `@statelyai/sdk` opens Stately's hosted inspector in your browser; machine definitions and snapshots are sent to Stately's hosted relay. Without `INSPECT`, the example runs offline and prints to stdout.
