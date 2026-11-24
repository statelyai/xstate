---
title: Rejections
description: Reject events with typed reasons and check acceptance before sending.
---

Return `reject([...])` from a transition function to consume an event with one or more reasons. Declare the reasons in `schemas.rejections`. The transition arguments provide a `reject` function typed against those schemas.

```ts
import { createActor, createMachine, types } from 'xstate';

const checkout = createMachine({
  schemas: {
    events: { submit: types<void>() },
    rejections: {
      'email.required': types<void>(),
      'balance.insufficient': types<{ available: number; required: number }>()
    }
  },
  context: { email: '', balance: 20, total: 50 },
  initial: 'editing',
  states: {
    editing: {
      on: {
        submit: ({ context, reject }) => {
          if (!context.email) {
            return reject([{ type: 'email.required' }]);
          }
          if (context.balance < context.total) {
            return reject([{
              type: 'balance.insufficient',
              available: context.balance,
              required: context.total
            }]);
          }
          return { target: 'submitting' };
        }
      }
    },
    submitting: {}
  }
});

const actor = createActor(checkout).start();
const result = actor.getSnapshot().check({ type: 'submit' });
```

A rejection consumes the event along the state's ancestor path. Parent handlers do not run. Returning `undefined` without calling `enq` declines the event and allows normal parent fallback.

The reasons array must contain at least one item. Rejecting handlers cannot enqueue effects or return context updates, targets, input, or reentry instructions. Evaluate rejection conditions before calling `enq`.

Use rejection types and payloads to select and format messages in the UI. `RejectionFrom<typeof checkout>` extracts the declared rejection union. Rejection schemas can also be declared in `setup({ schemas: { rejections: ... } })`. Setup and inline rejection maps are merged, with setup entries overriding inline entries with the same name. Payload types preserve optional fields from the schema input.

With `setup().extend()`, an extension rejection schema replaces any base schema for the same name. Other base rejection schemas remain available.

## Checking an event

`snapshot.check(event)` evaluates transition selection without executing queued effects or changing the snapshot. It checks the supplied event against the current snapshot; it does not predict the result of asynchronous work or guarantee acceptance by a later `send`.

With `@xstate/effect`, `sendAndAwait(actor, event)` resolves to the resulting snapshot when a transition rejects the event. Inspect a snapshot with `check(event)` to get the typed reasons.

| Status | Meaning |
| --- | --- |
| `accepted` | At least one non-forbidden transition accepts the event and no region rejects it. |
| `rejected` | At least one region rejects the event and none accepts it. |
| `partial` | At least one region accepts the event and another rejects it. |
| `unhandled` | No region accepts or rejects the event. Terminal snapshots also return this status. |

The `rejected` and `partial` results include `rejections`, an array of `{ source, reasons }` groups. `source` is the rejecting state's ID. Each reason retains its declared payload type.

`can(event)` returns `true` for `accepted` and `partial`. Rejected events do not trigger `onUnhandledEvent`. Rejection details are returned by `check`; they are not stored on the snapshot or automatically emitted by `send`.

## Parallel states

Each region processes the event independently. A rejection blocks parent fallback on its path and does not veto accepting transitions in sibling regions. Sending an event whose check result is `partial` executes the accepting transitions.

Normal transition-conflict rules still apply. An accepting transition can exit a shared ancestor and the rejecting region. Local rejection does not prevent that exit. A region that ignores the event does not cause partial acceptance.

## JSON definitions

`machineFromJSON` accepts guarded rejection branches. A failed guard tries the next branch. A passing guard with `reject` consumes the event and skips later branches and parent fallback.

```json
{
  "initial": "editing",
  "states": {
    "editing": {
      "on": {
        "submit": [
          {
            "guard": { "type": "emailMissing" },
            "reject": [{ "type": "email.required" }]
          },
          { "target": "submitting" }
        ]
      }
    },
    "submitting": {}
  }
}
```

A rejecting branch cannot also declare `target`, `context`, `actions`, `input`, or `reenter`. Rejection payloads support the same `@expr` and `@code` value expressions as other JSON values. Supply their evaluator and expression language when loading the definition.

Pass runtime rejection schemas through `machineFromJSON(json, { schemas: { rejections: ... } })`. Declared runtime schemas check rejection names and payloads synchronously. Type-only schemas carry TypeScript types without validating payloads. JSON loaded at runtime does not supply a compile-time rejection union.
