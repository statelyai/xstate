# 7GUIs Counter

This is an implementation of [the 7GUIs counter](https://eugenkiss.github.io/7guis/tasks#counter) built with:

- XState v6 alpha
- React
- TypeScript
- Vite

## [Open in CodeSandbox](https://codesandbox.io/p/sandbox/github/statelyai/xstate/tree/next/examples/7guis-counter-react)

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/statelyai/xstate/tree/next/examples/7guis-counter-react)

<!-- sync:src -->

This example uses the workspace XState v6 alpha. Machine schemas use `types<T>()` for static typing. From the repository root, install dependencies and run `pnpm build` first, then:

```sh
pnpm --dir examples/7guis-counter-react dev
pnpm --dir examples/7guis-counter-react build
```

The machine regression tests run with the repository's `pnpm check:examples` command.
