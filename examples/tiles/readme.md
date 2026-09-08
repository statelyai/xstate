# Tiles game

This is a simple tiles game, built with:

- XState v6 alpha
- React
- TypeScript
- Vite

## [Open in CodeSandbox](https://codesandbox.io/p/sandbox/github/statelyai/xstate/tree/next/examples/tiles)

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/statelyai/xstate/tree/next/examples/tiles)

<!-- sync:src -->

This example uses the workspace XState v6 alpha. Machine schemas use `types<T>()` for static typing. From the repository root, install dependencies and run `pnpm build` first, then:

```sh
pnpm --dir examples/tiles dev
pnpm --dir examples/tiles build
```

The machine regression tests run with the repository's `pnpm check:examples` command.

Shuffle starts a round. Drag between adjacent cells to swap tiles; canceled or nonadjacent moves clear the selection. Snapshots retain their original tile arrays.
