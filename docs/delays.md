---
title: Delays
description: Configure delayed transitions and delayed events.
---

Use `after` for a transition that occurs after a state has been active for a duration.

```ts
loading: { after: { 5_000: { target: 'timedOut' } } }
```

The timer starts when the state is entered and is canceled when the state is exited.

## Named delays

```ts
const appSetup = setup({ delays: { retryDelay: 1_000 } });
```

## Duration formats

A delay is a number of milliseconds, or a duration string: `'250ms'`, `'5s'`, `'1.5s'`, or an ISO 8601 duration such as `'PT1M30S'`, `'PT2H'` or `'P1D'`. Plain `'5m'` and `'1h'` are not accepted.

```ts
loading: { after: { '5s': { target: 'timedOut' } } }
```

A string is looked up in the configured delays first, and parsed as a duration only when no delay of that name exists.

## Delayed events

```ts
enq.raise({ type: 'search' }, { delay: 300, id: 'debounce' });
enq.cancel('debounce');
```

Use delayed transitions for behavior tied to the current state. Use delayed events when another transition may replace or cancel the pending event.

## `after` and `timeout`

`after` schedules a transition at a point in time after a state is entered. A state [`timeout`](timeouts.md) expresses a deadline for the work the state represents and takes its `onTimeout` transition when it expires. Both timers can be used on the same state, and both are canceled when the state is exited. Invocations and async logic accept a `timeout` as well; an invoke `timeout` must be a number of milliseconds, while async logic also accepts duration strings.

Common examples include:

- moving a notification from `visible` to `hidden` after five seconds
- waiting before retrying a failed request
- debouncing search input by canceling the previous delayed event

## TypeScript

Named delay references are checked against configured delay sources.

## Delays cheatsheet

```ts
after: { 1000: { target: 'next' } }
enq.raise(event, { delay: 1000, id: 'timer' });
enq.cancel('timer');
```
