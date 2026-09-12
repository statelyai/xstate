# XState Svelte TypeScript template

A starting point template for using XState with [Svelte](https://svelte.dev) and TypeScript. Create a feedback form using a simple state machine.

Using [Vite](https://vite.dev/) as a build tool and to run the local development server.

## [➡️ Open in CodeSandbox](https://codesandbox.io/p/sandbox/github/statelyai/xstate/tree/main/templates/svelte-ts?file=%2Fsrc%2FfeedbackMachine.ts)

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/statelyai/xstate/tree/main/templates/svelte-ts?file=%2Fsrc%2FfeedbackMachine.ts)

## Stack

- [XState](https://stately.ai/docs) 6 (alpha) with `@xstate/svelte` 6 (alpha)
- Svelte 5
- TypeScript 5.9
- [Vite](https://vite.dev/) 7

## Run locally

```bash
npm install
npm run dev
```

Then build and typecheck with:

```bash
npm run build
npm run check
```

## Inspect it

[`@statelyai/sdk`](https://stately.ai/docs/inspector) is wired up, so running the app opens Stately's hosted inspector with the live actor. Machine definitions and snapshots are sent to Stately's hosted relay; remove the `createInspector()` call in `src/App.svelte` to turn it off.
