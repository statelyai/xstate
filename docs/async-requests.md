---
title: Handle async requests
description: Build a search feature with debounce, cancellation, errors and retry.
---

This guide builds a complete search box. It debounces typing, cancels a request when the query changes, shows errors, retries on demand, and renders from the actor.

## 1. Write the async logic

`createAsyncLogic(...)` describes one request. Its `input` schema types and validates what the request needs. Pass the `signal` to `fetch` so XState can abort the request when its state is exited.

```ts
import { createActor, createAsyncLogic, setup } from 'xstate';
import { z } from 'zod';

const searchLogic = createAsyncLogic({
  schemas: { input: z.object({ query: z.string() }) },
  run: async ({ input, signal }) => {
    const response = await fetch(
      `/api/search?q=${encodeURIComponent(input.query)}`,
      { signal }
    );

    if (!response.ok) {
      throw new Error(`Search failed with status ${response.status}`);
    }

    return response.json() as Promise<string[]>;
  }
});
```

## 2. Define the schemas

Schemas give the machine its context and event types, and validate them at runtime.

```ts
const searchSetup = setup({
  schemas: {
    context: z.object({
      query: z.string(),
      results: z.array(z.string()),
      errorMessage: z.string().nullable()
    }),
    events: {
      'query.change': z.object({ query: z.string() }),
      search: z.object({}),
      retry: z.object({})
    }
  },
  actors: { searchLogic }
});
```

## 3. Model the states

Typing is handled at the root, so a new query is accepted in every state. The transition cancels the pending delayed `search` event and raises a new one, which is the debounce.

```ts
const searchMachine = searchSetup.createMachine({
  context: { query: '', results: [], errorMessage: null },
  initial: 'idle',
  on: {
    'query.change': ({ context, event }, enq) => {
      enq.cancel('debounce');
      enq.raise({ type: 'search' }, { delay: 300, id: 'debounce' });

      return {
        target: '.debouncing',
        context: { ...context, query: event.query }
      };
    },
    search: { target: '.searching' }
  },
  states: {
    idle: {},
    debouncing: {},
    searching: {
      invoke: {
        src: 'searchLogic',
        input: ({ context }) => ({ query: context.query }),
        timeout: 10_000,
        onDone: ({ context, event }) => ({
          target: 'success',
          context: { ...context, results: event.output, errorMessage: null }
        }),
        onError: ({ context, event }) => ({
          target: 'failure',
          context: { ...context, errorMessage: String(event.error) }
        }),
        onTimeout: ({ context }) => ({
          target: 'failure',
          context: { ...context, errorMessage: 'Search timed out' }
        })
      }
    },
    success: {},
    failure: { on: { retry: { target: 'searching' } } }
  }
});
```

Three behaviors come out of this shape:

- **Debounce.** Each keystroke cancels the delayed `search` event and schedules another one 300ms later. The event is only delivered after a 300ms pause in typing.
- **Stale request cancellation.** A keystroke during `searching` leaves that state, which stops the invoked actor and aborts its `fetch`. A response that arrives after that is ignored.
- **Retry.** `failure` keeps the query in context, so `retry` re-enters `searching` with the same input.

## 4. Wire it to the UI

`actor.select(...)` returns a readable for one derived value. It notifies only when that value changes, so each part of the UI updates independently.

```ts
const actor = createActor(searchMachine).start();

const input = document.querySelector('input')!;
const list = document.querySelector('ul')!;
const status = document.querySelector('.status')!;
const retryButton = document.querySelector('button')!;

input.addEventListener('input', () => {
  actor.send({ type: 'query.change', query: input.value });
});

retryButton.addEventListener('click', () => {
  actor.send({ type: 'retry' });
});

const results = actor.select((snapshot) => snapshot.context.results);
const state = actor.select((snapshot) => snapshot.value);

results.subscribe((values) => {
  list.replaceChildren(
    ...values.map((value) => {
      const item = document.createElement('li');
      item.textContent = value;
      return item;
    })
  );
});

state.subscribe((value) => {
  status.textContent = value === 'searching' ? 'Searching…' : '';
  retryButton.hidden = value !== 'failure';
});
```

> **Warning:** `subscribe(...)` does not replay the current value. Call `results.get()` and `state.get()` once for the first render.

In a component, use your framework's binding instead of subscribing by hand. See [use with your framework](frameworks.md) for React, Vue, Svelte and Solid.

## What next?

- [Async logic](async-logic.md) for why requests are modeled as states.
- [Invoke actors](invoke.md) for the full `invoke` configuration, including `onSnapshot`.
- [Add retries and timeouts](retries-and-timeouts.md) to limit attempts and back off between them.
- [Selectors](selectors.md) for derived reads and custom equality.
