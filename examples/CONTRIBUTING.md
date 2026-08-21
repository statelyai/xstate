# Contributing an example

This folder is a corpus of small, self-contained XState examples. Each one is a pnpm workspace package that runs against the version of XState in this repo, not a published release. The standards below keep the corpus consistent and reviewable.

## Scope: one concept per example

An example teaches one thing. State it in the first line of the README, then build the smallest app that demonstrates it.

- Keep examples under 300 lines of source code, excluding config and generated files.
- If an example needs two unrelated concepts to make sense, split it into two examples.
- Prefer plain CSS and no component library. UI chrome is not the subject.

## Naming

| Kind                     | Pattern            | Example               |
| ------------------------ | ------------------ | --------------------- |
| Frontend app             | `domain-framework` | `auth-flow-react`     |
| Backend workflow pattern | `pattern-*`        | `pattern-saga`        |
| `@xstate/store` example  | `store-*`          | `store-counter-react` |
| AI agent example         | `agent-*`          | `agent-tool-loop`     |

Use lowercase kebab-case. The directory name, the `name` field in `package.json`, and the README title must match.

## Dependencies

Depend on workspace packages, never on published versions:

```json
{
  "dependencies": {
    "xstate": "workspace:*",
    "@xstate/react": "workspace:*"
  }
}
```

Pin the following framework and tooling versions. Do not introduce older majors.

| Dependency | Version |
| ---------- | ------- |
| React      | 19      |
| Vite       | 7       |
| Vue        | 3.5     |
| Svelte     | 5       |
| Express    | 5       |

Keep the dependency list minimal. Anything beyond the framework, XState, and the build tool needs a reason in the README.

## XState v6 style

Examples are reference material, so the code must be idiomatic v6.

**Use `setup()` as the entry point.** Declare actors, guards, actions, and delays in `setup()`, then call `.createMachine()`. Reference them by name in the machine config.

```ts
import { setup, createAsyncLogic, types } from 'xstate';

const machine = setup({
  schemas: {
    context: types<{ user: User | null }>(),
    events: {
      submit: types<{ email: string }>()
    }
  },
  actors: {
    authenticate: createAsyncLogic({
      schemas: { input: types<{ email: string }>() },
      run: async ({ input }) => login(input)
    })
  },
  guards: {
    // Guards are standalone functions: they take the narrowest params the
    // rule needs, not the machine's context. Annotate the params — guards
    // deliberately do not get contextual typing from `schemas.context`.
    hasSession: (user: User | null) => user !== null
  }
}).createMachine({
  /* ... */
});
```

Call them explicitly from a transition function, passing the values the rule needs:

```ts
on: {
  submit: ({ context, guards }) => ({
    target: guards.hasSession(context.user) ? 'dashboard' : 'login'
  });
}
```

Write a guard so its signature reads as a reusable function. When a rule needs several values, take a named param object rather than the whole context:

```ts
guards: {
  hasStock: ({ available, quantity }: { available: number; quantity: number }) =>
    available >= quantity;
}
```

```ts
on: {
  addItem: ({ context, guards }) => {
    if (!guards.hasStock(context)) return;
    return { target: 'adding' };
  };
}
```

Avoid `({ context }: { context: WholeContext })` — a guard shaped like a callback of the machine's context is not reusable and is not the idiom.

`delays` are different: a named delay function is called by the runtime with `{ context, event, stateNode }`, so it does take that args object.

```ts
delays: {
  backoff: ({ context }: { context: { attempt: number } }) =>
    100 * 2 ** (context.attempt - 1);
}
```

**Use the `create*Logic` actor creators.** The exported names in `xstate` are:

- `createAsyncLogic` — promise or async function actors (this is the v6 name; there is no `createPromiseLogic`)
- `createCallbackLogic` — callback actors that send and receive events
- `createObservableLogic` and `createEventObservableLogic` — observable actors
- `createListenerLogic` — event listener actors
- `createSubscriptionLogic` — subscription-based actors
- `createLogic`, `createDefaultLogic`, `createAttachedLogic` — lower-level building blocks

**Write code a human would write.** Mechanically converted v4/v5 code is rejected. In particular:

- No IIFE-wrapped guards or assigns inside transition functions. Put the logic in a named guard or action in `setup()`.
- No `(() => { ... })()` blocks standing in for what should be a declarative transition.
- No leftover `predictableActionArguments`, `tsTypes`, or other pre-v5 config keys.
- No `as any` to work around types. If the types fight you, that is a bug worth reporting.

## README

Every example needs a `README.md` with these sections, in this order:

1. **Title** — the directory name.
2. **What it teaches** — one or two sentences naming the concept.
3. **XState features used** — a short list, for example: parallel states, `invoke`, delayed transitions, persistence.
4. **Run it** — the exact commands:

   ```bash
   pnpm install
   pnpm dev # or `pnpm start` for backend examples
   ```

5. **Inspect it** — how to view the running actors in the [Stately Inspector](https://stately.ai/docs/inspector). For browser examples, note that `@statelyai/sdk` is wired up. For headless examples, document the `INSPECT=1` flag (see below).

Keep the README under a page. Explanation of the concept belongs in the docs; the README points at it.

## Inspection

Inspection uses [`@statelyai/sdk`](https://stately.ai/docs/inspector), which works with XState v5 and v6. Add it as a published dependency:

```json
{
  "dependencies": {
    "@statelyai/sdk": "^0.20.1"
  }
}
```

`createInspector()` connects to Stately's hosted relay at `wss://sky.stately.ai` and opens the hosted inspector in your default browser. Machine definitions, snapshots, events, and actor topology are sent to that relay, so keep an example's data uninteresting, and pass a self-hosted `url` if you need it to stay on your own infrastructure.

Browser examples may create the inspector unconditionally:

```ts
import { createInspector } from '@statelyai/sdk';

const inspector = createInspector();

const actor = createActor(machine, { inspect: inspector.inspect });
```

Headless examples — backend workflows, `pattern-*`, and `agent-*` — must put it behind an environment flag so the default run has no external dependency, and must destroy the inspector when the demo ends so the process can exit:

```ts
import { createActor } from 'xstate';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const actor = createActor(machine, { inspect: inspector?.inspect });

// ...at the end of the demo:
inspector?.destroy();
```

Run with inspection:

```bash
INSPECT=1 pnpm start
```

Headless examples may also render their actors with the shared dashboard in [`examples/_shared/actor-ui`](./_shared/actor-ui) instead of writing bespoke UI.

## Checklist before opening a PR

- [ ] Directory name follows the naming pattern and matches `package.json` and the README title.
- [ ] All XState dependencies use `workspace:*`.
- [ ] Framework versions match the pinned table.
- [ ] Machine is built with `setup()`; actors use `create*Logic`.
- [ ] Source is under 300 lines and teaches one concept.
- [ ] `README.md` has all five sections.
- [ ] Inspection works, and headless examples gate it behind `INSPECT=1`.
- [ ] The example is added to the coverage matrix in [`readme.md`](./readme.md).
