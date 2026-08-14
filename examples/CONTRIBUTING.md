# Contributing an example

This folder is a corpus of small, self-contained XState examples. Each one is a pnpm workspace package that runs against the version of XState in this repo, not a published release. The standards below keep the corpus consistent and reviewable.

## Scope: one concept per example

An example teaches one thing. State it in the first line of the README, then build the smallest app that demonstrates it.

- Keep examples under 300 lines of source code, excluding config and generated files.
- If an example needs two unrelated concepts to make sense, split it into two examples.
- Prefer plain CSS and no component library. UI chrome is not the subject.

## Naming

| Kind | Pattern | Example |
| --- | --- | --- |
| Frontend app | `domain-framework` | `auth-flow-react` |
| Backend workflow pattern | `pattern-*` | `pattern-saga` |
| `@xstate/store` example | `store-*` | `store-counter-react` |
| AI agent example | `agent-*` | `agent-tool-loop` |

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
| --- | --- |
| React | 19 |
| Vite | 7 |
| Vue | 3.5 |
| Svelte | 5 |
| Express | 5 |

Keep the dependency list minimal. Anything beyond the framework, XState, and the build tool needs a reason in the README.

## XState v6 style

Examples are reference material, so the code must be idiomatic v6.

**Use `setup()` as the entry point.** Declare actors, guards, actions, and delays in `setup()`, then call `.createMachine()`. Reference them by name in the machine config.

```ts
import { setup, createAsyncLogic } from 'xstate';

const machine = setup({
  types: {
    context: {} as { user: User | null },
    events: {} as { type: 'SUBMIT'; email: string }
  },
  actors: {
    authenticate: createAsyncLogic(async ({ input }) => login(input))
  },
  guards: {
    hasSession: ({ context }) => context.user !== null
  }
}).createMachine({
  /* ... */
});
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

5. **Inspect it** — how to view the running actors in the [Stately Inspector](https://stately.ai/docs/inspector). For browser examples, note that `@statelyai/inspect` is wired up and link to https://stately.ai/registry/inspect. For headless examples, document the `INSPECT=1` flag (see below).

Keep the README under a page. Explanation of the concept belongs in the docs; the README points at it.

## Inspection

Browser examples may create the inspector unconditionally in development.

Headless examples — backend workflows, `pattern-*`, and `agent-*` — must put it behind an environment flag so the default run has no external dependency:

```ts
import { createActor } from 'xstate';
import { createBrowserInspector } from '@statelyai/inspect';

const inspector = process.env.INSPECT === '1' ? createBrowserInspector() : undefined;

const actor = createActor(machine, { inspect: inspector?.inspect });
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
