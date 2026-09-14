# traffic-light

## What it teaches

Delayed transitions drive a state machine on their own: a traffic light cycles between three lamps on timers, an event can cut a phase short, and a fault mode swaps the whole cycle out for two parallel regions.

## XState features used

- Delayed transitions (`after`) with named `delays`
- Nested (hierarchical) states and a parent-level transition
- Parallel states for the fault mode
- Entry actions and context updates
- `createActor()` and snapshot subscriptions

## Walkthrough

The machine has two top-level states: `operating` and `fault`.

**`operating` is a cycle of three child states.** Each lamp is a state, and each one leaves on a timer:

```ts
green: {
  after: { greenDuration: { target: 'yellow' } }
}
```

`after` schedules a transition when the state is entered. Leave the state for any other reason and the timer is cancelled — nothing else is needed to clean it up. The delay names (`greenDuration`, `yellowDuration`, `redDuration`) are declared in `setup({ delays })`, so all the timing lives in one place and can be swapped out in tests.

**An event can beat the timer.** `green` also handles `pedestrianRequest`:

```ts
on: {
  pedestrianRequest: () => ({
    target: 'yellow',
    context: { pedestrianWaiting: true }
  })
}
```

Whichever comes first — the delay or the button — causes the transition; the other is discarded. That is the whole implementation of "the button shortens the green phase".

**`red` records the crossing** in an entry action, which runs once each time the state is entered, incrementing `cycles` and clearing `pedestrianWaiting`.

**`fault` overrides the cycle.** The `fault` event is declared on the `operating` parent, so it applies no matter which lamp is lit. The `fault` state is `type: 'parallel'`: its `lamp` and `buzzer` regions are both active, each running its own two-state loop on its own delay, so the lamp flashes faster than the buzzer beeps. `reset` returns to `operating`, which restarts at its initial state, `green`.

## Run it

```bash
pnpm install
pnpm dev
```

## Inspect it

`@statelyai/sdk` is wired up, so running the example opens Stately's hosted [inspector](https://stately.ai/docs/inspector) with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay.
