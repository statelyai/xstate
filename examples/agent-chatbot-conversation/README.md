# agent-chatbot-conversation

## What it teaches

How to model a chat agent's turn-taking — listening, thinking, responding — so that a user interrupting mid-reply (barge-in) cancels the in-flight response, and silence ends the session.

## XState features used

- delayed transitions (`after`) for end-of-turn and inactivity timeouts
- `invoke` with `createAsyncLogic` for the model call and the reply delivery
- leaving a state to cancel its invoked actor (barge-in)
- final state `output`, `toPromise`

## Run it

```bash
pnpm install
pnpm start
```

The model calls are mocked with deterministic `createAsyncLogic` actors so the demo runs offline. Swap the `run` bodies in `src/conversationMachine.ts` for a real chat client — they take the transcript as `input` and return the reply text — and the machine is unchanged.

The scripted demo sends a message, interrupts the agent mid-reply, then goes quiet until the inactivity timer ends the session.

## Inspect it

Inspection is pending a v6-compatible `@statelyai/inspect`. Until then the example prints each state and event to stdout.
