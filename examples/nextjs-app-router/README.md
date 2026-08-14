# nextjs-app-router

## What it teaches

How to split state between server and client in the Next.js App Router: a server action restores a persisted machine for the session, sends it one event, and persists it again, while a client component runs a separate machine for local UI state.

## XState features used

- `getPersistedSnapshot()` and `createActor(machine, { snapshot })` on the server
- a guard blocking `pay` on an empty cart
- `useMachine` from `@xstate/react` in a client component

## Run it

```bash
pnpm install
pnpm dev # http://localhost:3000
```

The **Add item**, **Pay**, and **Reset** buttons post to one server action. It advances the checkout machine stored against a `checkout-session` cookie in a module-level `Map` — swap that for a database in a real app; it resets when the dev server restarts. **Show help** is a client machine that never reaches the server.

`pnpm build` requires the workspace packages to be built first:

```bash
pnpm build # from the repo root, once
cd examples/nextjs-app-router && pnpm build
```

`next build` typechecks everything it imports, and in this monorepo `xstate` resolves to preconstruct's dev-mode entry, which re-exports raw `.ts` sources. Building the packages replaces those with real `.js`/`.d.ts` output. `pnpm dev` works either way.

## Inspect it

Inspection is pending a v6-compatible `@statelyai/inspect`. Until then the page renders the checkout machine's state and context on every request.
