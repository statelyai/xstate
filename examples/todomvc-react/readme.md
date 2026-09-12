# TodoMVC React

This is an implementation of [TodoMVC](https://todomvc.com/) built with:

- XState v6 alpha
- React
- TypeScript
- Vite

## How to run

You may run the example locally with:

```shell
    cd examples/todomvc-react
    pnpm install
    pnpm run dev
```

**OR**

[Open in CodeSandbox](https://codesandbox.io/p/sandbox/github/statelyai/xstate/tree/next/examples/todomvc-react)

**OR**

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/statelyai/xstate/tree/next/examples/todomvc-react)

<!-- sync:src -->

This example uses the workspace XState v6 alpha. Machine schemas use `types<T>()` for static typing. From the repository root, install dependencies and run `pnpm build` first, then:

```sh
pnpm --dir examples/todomvc-react dev
pnpm --dir examples/todomvc-react build
```

The machine regression tests run with the repository's `pnpm check:examples` command.
