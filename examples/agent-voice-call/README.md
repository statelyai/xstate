# agent-voice-call

## What it teaches

How to model a call-center voice agent: ringing through greeting, a listening/speaking loop that supports barge-in, intent routing to per-topic flows, and a hangup that is handled from any state.

## XState features used

- root-level `on` for the hangup that can arrive in any state
- branching transition functions for intent routing
- delayed transitions (`after`) as speech duration and hold music
- final state `output`, `toPromise`

## Run it

```bash
pnpm install
pnpm start
```

Three scripted calls run in sequence: a billing question, a caller who barges in over the clarification prompt, and a caller who hangs up while waiting on a transfer. The ASR and intent classifier are plain functions, so the example is fully offline.

## Inspect it

Run it with `INSPECT=1 pnpm start` to stream this example's actors to the [Stately Inspector](https://stately.ai/docs/inspector). `@statelyai/sdk` opens Stately's hosted inspector in your browser; machine definitions and snapshots are sent to Stately's hosted relay. Without `INSPECT`, the example runs offline and prints to stdout.
