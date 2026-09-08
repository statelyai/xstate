# XState v6 alpha + React - 7GUIs Flight Booker

The 7GUIs Fligt Booker App built with:

- React 18
- XState v6 alpha
- Typescript
- Vite

Visit the [7GUIs project](https://eugenkiss.github.io/7guis/tasks#flight/ 'Flight Booker') for more info.

## Screenshots

![App Screenshot](public/flight-booker.png)

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/statelyai/xstate/tree/next/examples/7guis-flight-booker-react)

<!-- sync:src -->

This example uses the workspace XState v6 alpha. Machine schemas use `types<T>()` for static typing. From the repository root, install dependencies and run `pnpm build` first, then:

```sh
pnpm --dir examples/7guis-flight-booker-react dev
pnpm --dir examples/7guis-flight-booker-react build
```

The machine regression tests run with the repository's `pnpm check:examples` command.
