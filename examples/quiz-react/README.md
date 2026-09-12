# quiz-react

## What it teaches

A per-question deadline built from a delayed transition, with a separate ticker actor driving the countdown display, and the score accumulated in context.

## XState features used

- Delayed transitions (`after`) as the question deadline
- `createCallbackLogic()` invoked for the one-second display ticker
- Context accumulation (score and answers)
- A self-targeting transition that restarts both the timer and the invoked actor

## How it works

- `answering` invokes the `seconds` actor, which sends `TICK` once a second so the UI can show a countdown. The deadline itself is the `after: { questionTime }` transition, so the display and the timeout never disagree.
- Answering, skipping, and timing out all call the same `advance()` helper. It records the choice (`null` for a skip), updates the score, and targets `answering` again for the next question — re-entering the state restarts the delay and the ticker — or `results` once the questions run out.
- `results` shows a per-question summary and restarts with a fresh context.

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

`@statelyai/sdk` is wired up, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay.
