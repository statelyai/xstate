---
title: Examples
description: Runnable XState projects, grouped by what they demonstrate.
---

The [`examples` directory](https://github.com/statelyai/xstate/tree/next/examples) of the XState repository contains runnable projects. Each one is a small application you can clone and run with `pnpm install && pnpm dev` (or `pnpm start`, depending on the example).

These examples use XState v6 syntax: transition functions that return `{ target, context }`, `createAsyncLogic(...)` and `createCallbackLogic(...)` instead of promise and callback actors, and guards written as `return undefined`. Some were migrated from v5 mechanically and still read more verbosely than code you would write by hand, and a few keep a v5 helper here and there. When something in an example does not match the reference pages, the reference pages are correct. See the [migration guide](xstate-v5-to-v6.md) for how the older shapes map onto the new ones.

## Start here

- [counter](https://github.com/statelyai/xstate/tree/next/examples/counter) — the smallest useful machine: `increment` and `decrement` transitions updating one context value, wired to plain DOM.
- [toggle](https://github.com/statelyai/xstate/tree/next/examples/toggle) — two states and one event, with no context at all.
- [fetch](https://github.com/statelyai/xstate/tree/next/examples/fetch) — `idle` / `loading` / `success` / `failure` around `createAsyncLogic(...)` invoked by the `loading` state.

## UI patterns

- [stopwatch](https://github.com/statelyai/xstate/tree/next/examples/stopwatch) — `createCallbackLogic(...)` invoked by the `running` state sends a tick every 10ms; leaving the state clears the interval.
- [timer](https://github.com/statelyai/xstate/tree/next/examples/timer) — the same ticking pattern, plus events that adjust the duration while the timer is stopped.
- [tiles](https://github.com/statelyai/xstate/tree/next/examples/tiles) — a sliding tile puzzle with named guards deciding whether two tiles are adjacent.
- [snake-react](https://github.com/statelyai/xstate/tree/next/examples/snake-react) — a game loop as an invoked callback actor, with the whole board in context.
- [tic-tac-toe-react](https://github.com/statelyai/xstate/tree/next/examples/tic-tac-toe-react) — turn taking and win detection in a `playing` state, with a `RESET` transition on the machine root.
- [todomvc-react](https://github.com/statelyai/xstate/tree/next/examples/todomvc-react) — the TodoMVC spec, with the todo list and the active filter held in context.
- [friends-list-react](https://github.com/statelyai/xstate/tree/next/examples/friends-list-react) — a parent machine that spawns one child actor per friend and keeps their refs in context.
- [trivia-game-example](https://github.com/statelyai/xstate/tree/next/examples/trivia-game-example) — a quiz whose navigation actions are supplied with `machine.provide(...)` so the machine stays free of router imports.

## 7GUIs

Ports of the [7GUIs](https://eugenkiss.github.io/7guis/) benchmark tasks, in React and Vue:

- [7guis-counter-react](https://github.com/statelyai/xstate/tree/next/examples/7guis-counter-react) and [7guis-1-counter-vue](https://github.com/statelyai/xstate/tree/next/examples/7guis-1-counter-vue) — the counter task.
- [7guis-temperature-react](https://github.com/statelyai/xstate/tree/next/examples/7guis-temperature-react) and [7guis-2-temperature-vue](https://github.com/statelyai/xstate/tree/next/examples/7guis-2-temperature-vue) — two fields that convert into each other without looping.
- [7guis-flight-booker-react](https://github.com/statelyai/xstate/tree/next/examples/7guis-flight-booker-react) — trip type, date validation and a booking request as invoked async logic.

## XState Store

[XState Store](choose-xstate.md) examples, for state that needs events but not states:

- [store-counter-react](https://github.com/statelyai/xstate/tree/next/examples/store-counter-react) — a module-level store read with `useSelector`.
- [local-store-counter-react](https://github.com/statelyai/xstate/tree/next/examples/local-store-counter-react) — the same store created per component with `useStore`.
- [store-tic-tac-toe](https://github.com/statelyai/xstate/tree/next/examples/store-tic-tac-toe) — a full game in one store, including derived win and draw outcomes.

## Backends and persistence

- [express-workflow](https://github.com/statelyai/xstate/tree/next/examples/express-workflow) — an Express API that starts a workflow, restores it from a persisted snapshot on each request, sends the event and persists the result. The pattern behind [backend workflows](backend-workflows.md).
- [persisted-donut-maker](https://github.com/statelyai/xstate/tree/next/examples/persisted-donut-maker) — a multi-step recipe machine whose snapshot is written to disk and restored on the next run.
- [mongodb-persisted-state](https://github.com/statelyai/xstate/tree/next/examples/mongodb-persisted-state) — the same machine with MongoDB as the snapshot store, plus a queue that serializes writes.
- [mongodb-credit-check-api](https://github.com/statelyai/xstate/tree/next/examples/mongodb-credit-check-api) — a credit check API where each external service is `createAsyncLogic(...)` with a Zod input schema.

## Serverless Workflow ports

Ports of the [Serverless Workflow specification](https://github.com/serverlessworkflow/specification/tree/main/examples) examples, each a single runnable `main.ts`. They are the densest collection of workflow shapes in the repository. Use them to see how a particular orchestration pattern looks as a statechart.

- [workflow-hello](https://github.com/statelyai/xstate/tree/next/examples/workflow-hello) — the minimum: one final state with `output`.
- [workflow-async-function](https://github.com/statelyai/xstate/tree/next/examples/workflow-async-function) — one invoked async function with typed input taken from the workflow's own input.
- [workflow-parallel](https://github.com/statelyai/xstate/tree/next/examples/workflow-parallel) — two branches running at once, joining when both are done.
- [workflow-event-based](https://github.com/statelyai/xstate/tree/next/examples/workflow-event-based) — waiting for one of several events, with a named delay as the deadline.
- [workflow-check-inbox](https://github.com/statelyai/xstate/tree/next/examples/workflow-check-inbox) — a root-level callback actor that sends a `reminder` event on an interval, driving a check-then-notify cycle back to `Idle`.
- [workflow-credit-check](https://github.com/statelyai/xstate/tree/next/examples/workflow-credit-check) and [workflow-applicant-request](https://github.com/statelyai/xstate/tree/next/examples/workflow-applicant-request) — decision workflows that branch on the result of an invoked service.
- [workflow-book-lending](https://github.com/statelyai/xstate/tree/next/examples/workflow-book-lending) — a long-running flow that waits on human events between service calls, with a delayed transition for the wait and a nested checkout region.
- [workflow-provision-orders](https://github.com/statelyai/xstate/tree/next/examples/workflow-provision-orders) — order provisioning with a nested `Exception` state whose children handle each kind of missing field.
- [workflow-purchase-order-deadline](https://github.com/statelyai/xstate/tree/next/examples/workflow-purchase-order-deadline) — a deadline on the whole order, with retries handled by an external retry policy library.
- [workflow-car-vitals](https://github.com/statelyai/xstate/tree/next/examples/workflow-car-vitals) — several checks invoked together while the car is on, re-run on a delayed transition.
- [workflow-accumulate-room-readings](https://github.com/statelyai/xstate/tree/next/examples/workflow-accumulate-room-readings) — readings collected into context until a delayed transition ends the window and reports them.
- [workflow-monitor-patient](https://github.com/statelyai/xstate/tree/next/examples/workflow-monitor-patient) — a single monitoring state whose event handlers react to each kind of vital sign alert.
- [workflow-media-scanner](https://github.com/statelyai/xstate/tree/next/examples/workflow-media-scanner) — a file scanning pipeline split across modules.

The remaining `workflow-*` directories cover the rest of the specification's examples: [workflow-async-subflow](https://github.com/statelyai/xstate/tree/next/examples/workflow-async-subflow), [workflow-car-auction-bids](https://github.com/statelyai/xstate/tree/next/examples/workflow-car-auction-bids), [workflow-event-based-service](https://github.com/statelyai/xstate/tree/next/examples/workflow-event-based-service), [workflow-event-greeting](https://github.com/statelyai/xstate/tree/next/examples/workflow-event-greeting), [workflow-filling-water](https://github.com/statelyai/xstate/tree/next/examples/workflow-filling-water), [workflow-finalize-college-app](https://github.com/statelyai/xstate/tree/next/examples/workflow-finalize-college-app), [workflow-greeting](https://github.com/statelyai/xstate/tree/next/examples/workflow-greeting), [workflow-math-problem](https://github.com/statelyai/xstate/tree/next/examples/workflow-math-problem), [workflow-monitor-job](https://github.com/statelyai/xstate/tree/next/examples/workflow-monitor-job), [workflow-new-patient-onboarding](https://github.com/statelyai/xstate/tree/next/examples/workflow-new-patient-onboarding), [workflow-reusing-functions](https://github.com/statelyai/xstate/tree/next/examples/workflow-reusing-functions) and [workflow-send-cloudevent](https://github.com/statelyai/xstate/tree/next/examples/workflow-send-cloudevent).

## Contributing an example

See the [examples readme](https://github.com/statelyai/xstate/blob/next/examples/readme.md) for how to scaffold a new example and open a pull request.

## What next?

- [Get running with the quick start](quick-start.md).
- [Build your first machine step by step](your-first-machine.md).
- [Use XState with your framework](frameworks.md).
- [Migrate an existing v5 codebase](xstate-v5-to-v6.md).
