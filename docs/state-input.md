---
title: State input
description: Pass typed data to a state when it is entered.
---

A state can declare an input schema. Transitions that target the state pass `input` alongside `target`, and the state's own functions read it from their arguments.

Declare the schema in `setup(...)`:

```ts
const uploadSetup = setup({
  states: {
    idle: {},
    uploading: {
      schemas: { input: z.object({ fileName: z.string() }) }
    }
  }
});
```

Then pass `input` from the transition:

```ts
const uploadMachine = uploadSetup.createMachine({
  initial: 'idle',
  states: {
    idle: {
      on: {
        upload: { target: 'uploading', input: { fileName: 'report.pdf' } }
      }
    },
    uploading: {
      entry: ({ input }) => console.log(input.fileName)
    }
  }
});
```

State input is available to the target state's `entry`, `exit`, `on`, `after`, `timeout`, `onTimeout` and `output` functions. It persists across self-transitions and is replaced the next time the state is entered.

## Computing input

A transition function can compute input from context and the event.

```ts
idle: {
  on: {
    upload: ({ context, event }) => ({
      target: 'uploading',
      input: { fileName: event.fileName, token: context.authToken }
    })
  }
}
```

## Initial state input

The `initial` property accepts an object form so the initial state receives input too. A plain string is still used when the state needs none.

```ts
uploadSetup.createMachine({
  initial: { target: 'uploading', input: { fileName: 'report.pdf' } },
  states: {
    uploading: { entry: ({ input }) => console.log(input.fileName) }
  }
});
```

Nested states work the same way: a parent's `initial` passes input to its child.

## Reading input from a snapshot

`snapshot.getInputs()` returns the current inputs keyed by state node ID.

```ts
const inputs = actor.getSnapshot().getInputs();
inputs['(machine).uploading']; // { fileName: 'report.pdf' }
```

Use state input for data that belongs to one state rather than to the whole machine:

- a checkout `paying` state that needs the selected payment method
- a media player `buffering` state that needs the track being loaded
- a form `submitting` state that needs the validated values

> **Warning:** State input is not [actor input](input-output.md), which is passed once when an actor is created, and it is not action `params`, which belong to a named action call. State input belongs to a state and is provided by whichever transition enters it.

## TypeScript

Input is typed by the state's `schemas.input`. Transitions targeting the state require a matching `input`, and `({ input })` is typed inside that state's functions. Modular state configs created with `setup(...).createStateConfig(...)` are typed the same way. See [setup and provide](setup-and-provide.md).

## State input cheatsheet

```ts
const s = setup({
  states: { loading: { schemas: { input: z.object({ id: z.string() }) } } }
});

s.createMachine({
  initial: { target: 'loading', input: { id: 'a1' } },
  states: {
    loading: {
      entry: ({ input }) => input.id,
      on: { retry: { target: 'loading', input: { id: 'a2' } } }
    }
  }
});

actor.getSnapshot().getInputs();
```
