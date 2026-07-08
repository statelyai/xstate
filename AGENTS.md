This is a monorepo containing XState, @xstate/store, and related packages.

## Dev environment

- Use pnpm to install dependencies

## PR instructions

- Run `pnpm test` to run the tests in all packages, only for changes that affect mulitple packages.
- Run `pnpm test:core` to only run core XState tests.
- Run `pnpm test:store` to only run @xstate/store tests.
- Run `pnpm typecheck` to make sure that there are no type errors.
- Before making a PR, run `pnpm changeset` to create a changeset with a short description of the changes, and a code example if applicable. Do not include implementation details; only pertinent details for developers using the package.

## XState v6 (alpha)

- v6 alpha syntax differs from v5 — do not assume v5 patterns (e.g. `{ onDone: { actions } }` invoke config is wrong in v6). Verify against the current types/source in `packages/core` before writing machine configs.
