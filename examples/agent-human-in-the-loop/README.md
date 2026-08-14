# agent-human-in-the-loop

## What it teaches

How to gate an agent's side effects on a human decision: the agent proposes an action and parks in a long-lived `awaitingApproval` state until someone approves, rejects, edits, or lets the review window expire.

## XState features used

- a long-lived state driven by external events, not promises
- transition functions returning context updates (`edit` without leaving the state)
- delayed transition (`after`) for the escalation timeout
- `invoke` for the model and for the gated side effect, final state `output`

## Run it

```bash
pnpm install
pnpm start
```

The demo runs the agent three times: one edited-then-approved run, one rejection, and one run where nobody answers and the agent escalates.

## Inspect it

Inspection is pending a v6-compatible `@statelyai/inspect`. Until then the example prints every state and human decision to stdout.
