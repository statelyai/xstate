---
title: "XState Effect: Quick start"
description: Combine event-driven workflows with Effect services, cancellation and testing.
---

XState models how a workflow responds to events. Effect runs the work inside it. Use them together when a process needs both:

- **Explicit states:** show whether a release is waiting for approval, deploying, failed or complete.
- **Events over time:** accept approval from a person, cancellation from a UI or retry from an operator.
- **Effect services:** provide the same dependencies, clock and tracing to the machine's work.
- **Scoped lifetime:** stop the actor and interrupt its hosted Effects when its scope closes.

## Install

This package is experimental. It targets XState v6 alpha and Effect 4.

```bash
npm install @xstate/effect@alpha xstate@alpha effect@^4
```

## Model a release approval

A release waits for approval for up to 30 seconds. Approval starts deployment; cancellation is available while waiting or deploying. If deployment fails, an operator can retry.

<!-- example from examples/effect-workflows/src/approval.ts -->

```ts
import { Context, Effect, Schema } from 'effect';
import {
  createEffectActor,
  fromEffect,
  send,
  setupEffect,
  waitFor
} from '@xstate/effect';

export class Deployments extends Context.Service<
  Deployments,
  { readonly deploy: (release: string) => Effect.Effect<string, Error> }
>()('@app/Deployments') {}

const deploy = fromEffect({
  schemas: { input: Schema.Struct({ release: Schema.String }) },
  effect: ({ input }) => Deployments.use((api) => api.deploy(input.release))
});

export const approvalMachine = setupEffect({
  schemas: { input: Schema.Struct({ release: Schema.String }) },
  actors: { deploy }
}).createMachine({
  context: ({ input }) => ({ release: input.release, url: '' }),
  initial: 'awaitingApproval',
  states: {
    awaitingApproval: {
      after: { 30000: { target: 'expired' } },
      on: {
        APPROVE: { target: 'deploying' },
        CANCEL: { target: 'cancelled' }
      }
    },
    deploying: {
      invoke: {
        src: 'deploy',
        input: ({ context }) => ({ release: context.release }),
        onDone: ({ context, event }) => ({
          target: 'deployed',
          context: { ...context, url: event.output }
        }),
        onError: { target: 'failed' }
      },
      on: { CANCEL: { target: 'cancelled' } }
    },
    failed: {
      on: {
        RETRY: { target: 'deploying' },
        CANCEL: { target: 'cancelled' }
      }
    },
    deployed: { type: 'final' },
    expired: { type: 'final' },
    cancelled: { type: 'final' }
  }
});

export const program = Effect.gen(function* () {
  const actor = yield* createEffectActor(approvalMachine, {
    input: { release: 'v1.2.0' }
  });
  // A UI, webhook or CLI can send this event after a person approves.
  yield* send(actor, { type: 'APPROVE' });
  const snapshot = yield* waitFor(actor, (s) => s.matches('deployed'), {
    timeout: '5 seconds'
  });
  return snapshot.context.url;
});

export const result = await Effect.runPromise(
  program.pipe(
    Effect.scoped,
    Effect.provideService(Deployments, {
      // Replace this demo service with your deployment API.
      deploy: (release) => Effect.succeed(`https://example.com/${release}`)
    })
  )
);
console.log(result); // 'https://example.com/v1.2.0'
```

The service is a local demo, so the example runs without credentials. Replace `Deployments` with your API implementation when connecting it to your application.

The machine makes the workflow rules visible:

- `APPROVE` starts deployment only from `awaitingApproval`.
- `after` expires an unanswered approval using Effect's clock.
- Leaving `deploying` interrupts the invoked Effect. Your service can use Effect's interruption and cleanup support to release local resources.
- `failed` accepts `RETRY`; completed and cancelled workflows are final.

Effect provides the deployment service and owns the actor's lifetime. You can test the same machine with a different service and `TestClock`.

<details>
<summary>Cancellation and external work</summary>

Interrupting the local deployment Effect does not undo a deployment already accepted by an external API. If your API supports cancellation or rollback, model that operation explicitly.

</details>

## Run Effect-backed logic

Start Effect-backed logic with `createEffectActor`, inside an Effect scope.

<details>
<summary>Why use createEffectActor?</summary>

`createEffectActor` supplies the Effect runtime that hosts the actor's Effects. Starting Effect-backed logic with XState's `createActor` puts it in the `error` status because that host is missing.

</details>

## How it runs

- XState calculates the next snapshot and the actions to run from each event.
- An Effect fiber processes the actor's mailbox in order.
- Timers use Effect's `Clock`; declared Effect actions run without blocking the mailbox.
- Child actors use the same Effect host and its services.

Use `waitFor`, `join` or `snapshots` to read the result of a send. The actor processes events asynchronously.

## Next steps

- [Actors](actors.md): scopes, services and lifetime.
- [Observing actors](observing-actors.md): snapshots, results and event streams.
- [Effect actor logic](effect-logic.md): tasks, upload progress and deployment feeds.
- [Testing and errors](testing-and-errors.md): deadlines, retries and typed failures.
