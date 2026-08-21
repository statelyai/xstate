---
title: Serialization
description: Treat machine definitions as data.
---

A machine definition can be represented as data. Serialize it to JSON, store or send it, and build a running machine from it again.

Call `serializeMachine(machine)` to get the JSON-serializable definition.

```ts
const json = serializeMachine(machine);
localStorage.setItem('checkout-definition', JSON.stringify(json));
```

`serializeMachine()` never throws. Values that cannot be represented as data are handled explicitly: inline functions become code expressions, and runtime-only values are omitted.

Serialize a config that was never passed to `createMachine()` with `machineConfigToJSON(config)`.

Use machine-as-data for cases such as:

- storing machine definitions in a database and loading them per tenant
- editing machines in a visual editor and sending the definition over the wire
- importing definitions produced by another tool or another language

## What survives serialization

States, transitions, targets, serialized action objects, guard references, string actor `src` names, `after` delays, `timeout`/`onTimeout`, `meta`, `description`, `tags`, `output`, `context` values, the legacy top-level `internalEvents` list, `version`, and any other JSON-safe data on the config all survive.

Inline functions become code expressions:

```ts
{
  "@code": "({ context }) => ({ target: 'done' })",
  "@lang": "ts"
}
```

A definition is fully portable when it contains no `@code` expressions. A code expression is text, so a revived machine only runs it when you supply an evaluator.

These values are omitted rather than serialized:

- actor logic objects, including inline `invoke.src` logic (the whole `invoke` is dropped when its `src` cannot be named)
- runtime schemas such as Zod schemas in `schemas`
- `schemas.internalEvents` declarations; restore those schemas when reviving if runtime validation is needed
- root `actions`, `guards`, `actors` and `delays` sources that are functions
- class instances, `Date`s, `bigint` and `symbol` values, including inside arrays

> **Warning:** Named source keys are not preserved when their values are functions. The definition records where a source is _used_ (`invoke: { src: 'worker' }`, `guard: { type: 'canFinish' }`), and you supply the implementations when reviving.

## Reviving a machine

`createMachineFromConfig(json, sources?)` builds a machine from a plain JSON definition.

```ts
import { createMachineFromConfig, type MachineJSON } from 'xstate';

const definition: MachineJSON = {
  initial: 'idle',
  version: '1.0.0',
  states: {
    idle: { on: { START: { target: 'running' } } },
    running: {
      entry: [{ type: '@xstate.raise', event: { type: 'kick' } }],
      invoke: { src: 'worker', onDone: { target: 'done' } },
      on: {
        kick: [
          { target: 'done', guard: { type: 'canFinish', params: { limit: 3 } } }
        ]
      },
      after: { 1000: { target: 'done' } }
    },
    done: { type: 'final', output: { ok: true } }
  }
};

const machine = createMachineFromConfig(definition, {
  actors: { worker: workerLogic },
  guards: { canFinish: ({ context }) => context.retries < 3 }
});
```

The second argument supplies the runtime sources the definition refers to: `actions`, `guards`, `actors`, `delays`, and `evaluators` for code expressions. A machine built this way can also be cloned with different sources through [`provide()`](setup-and-provide.md).

Actions in JSON are objects. The built-in vocabulary is `{ type: '@xstate.raise', event, id?, delay? }`, `{ type: '@xstate.emit', event }`, `{ type: '@xstate.assign', context }`, `{ type: '@xstate.cancel', id }` and `{ type: '@xstate.log', args }`. Any other `{ type, params }` object is a custom action resolved against the `actions` sources. Guards are `{ type, params? }` references resolved against `guards`.

Machines built from JSON round-trip losslessly. Serializing a revived machine returns its original definition.

```ts
const revived = createMachineFromConfig(
  JSON.parse(JSON.stringify(serializeMachine(machine)))
);
```

`createMachineFromConfig()` validates the definition as it builds. Illegal definitions (a history state without a target, a transition whose target set is not a legal configuration) throw with the JSON path of the offending node.

Some v6 features have no JSON representation yet: state `input`, `enq.listen`/`enq.subscribeTo`, and `choice` functions. Definitions that rely on them are not fully portable.

## TypeScript

`MachineJSON` types a machine definition; `StateNodeJSON`, `TransitionJSON`, `ActionJSON`, `GuardJSON` and `InvokeJSON` type its parts. `CodeExpression` types a `@code` object.

`createMachineFromConfig()` returns `AnyStateMachine`. A definition loaded at runtime has no static context or event types, so validate persisted data and narrow events with schemas where it matters.

## Serialization cheatsheet

```ts
const json = serializeMachine(machine);
const definitionJSON = machineConfigToJSON(config);

const machine = createMachineFromConfig(JSON.parse(stored), {
  actions: { track },
  guards: { canFinish },
  actors: { worker: workerLogic }
});
```
