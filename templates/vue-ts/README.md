# XState Vue TypeScript template

A starting point template for using XState with Vue and TypeScript. Create a feedback form using a simple state machine.

Using [Vite](https://vitejs.dev/) as a build tool and to run the local development server.

## [➡️ Open in CodeSandbox](https://codesandbox.io/p/sandbox/github/statelyai/xstate/tree/next/templates/vue-ts?file=%2Fsrc%2FfeedbackMachine.ts)

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/statelyai/xstate/tree/next/templates/vue-ts?file=%2Fsrc%2FfeedbackMachine.ts)


<!-- dependencies and scripts from package.json; feedback events from src/feedbackMachine.ts -->
## Run locally

Requires Node.js 20.19+ or 22.12+ and pnpm.

This starter uses published XState v6 alpha packages. The alpha versions are pinned together; upgrade XState and its framework adapter together when adopting a newer alpha.

```sh
pnpm install
pnpm dev
pnpm build
```

The feedback machine supports Good, Bad, feedback updates, Back, Submit, Close, and Restart. Submit is available only when feedback is nonempty; Restart clears feedback.

Subscribe to the actor to log snapshots when debugging. This starter does not include the v5-only inspector integration.
