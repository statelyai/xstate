# Stopwatch

This is a simple stopwatch, built with:

- XState v6 alpha
- TypeScript
- Vite

## [Open in CodeSandbox](https://codesandbox.io/p/sandbox/github/statelyai/xstate/tree/next/examples/stopwatch)

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/statelyai/xstate/tree/next/examples/stopwatch)

<!-- sync:src -->

This example uses the workspace XState v6 alpha. Machine schemas use `types<T>()` for static typing. From the repository root, install dependencies and run `pnpm build` first, then:

```sh
pnpm --dir examples/stopwatch dev
pnpm --dir examples/stopwatch build
```

The machine regression tests run with the repository's `pnpm check:examples` command.
