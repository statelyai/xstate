---
title: Machine configuration
description: Reference for the top-level state machine configuration.
---

Create state machine logic with `createMachine(...)`.

```ts
const machine = createMachine({
  id: 'request',
  context: { attempts: 0 },
  initial: 'idle',
  states: { idle: {}, loading: {} }
});
```

## Configuration properties

| Property | Description |
| --- | --- |
| `id` | Stable identifier for the root state node. |
| `description` | Human-readable description. |
| `schemas` | Schemas for context, events, input and output. |
| `context` | Initial context value or initializer. |
| `initial` | Initial child state. |
| `states` | Child state nodes. |
| `on` | Transitions available in every child state. |
| `entry` | Transition function run when the machine starts. |
| `exit` | Transition function run when the machine stops. |
| `invoke` | Actor logic invoked for the machine's lifetime. |
| `output` | Output produced on completion. |
| `actors` | Actor logic sources. |
| `actions` | Named action sources. |
| `guards` | Named guard sources. |
| `delays` | Named delay sources. |

## TypeScript

`createMachine(...)` infers state keys and literal transition targets. Use schemas when events or context need explicit types.

## Machine cheatsheet

```ts
const machine = createMachine({
  context: {},
  initial: 'idle',
  states: {
    idle: { on: { start: { target: 'active' } } },
    active: { on: { stop: { target: 'idle' } } }
  }
});
```
