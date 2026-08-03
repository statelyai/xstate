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

## Delayed events

```ts
enq.raise({ type: 'search' }, { delay: 300, id: 'debounce' });
enq.cancel('debounce');
```

## TypeScript

Named delay references are checked against configured delay sources.

## Delays cheatsheet

```ts
after: { 1000: { target: 'next' } }
enq.raise(event, { delay: 1000, id: 'timer' });
enq.cancel('timer');
```
