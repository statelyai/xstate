# Contributing an example

These steps assume You've forked the repo and created a branch for your PR. For more info, see the section _Making changes_ in our [CONTRIBUTING.md](https://github.com/statelyai/xstate/blob/main/CONTRIBUTING.md#making-changes).

1. In the CLI, navigate to the `/examples` folder. Start a [new Vite project](https://vitejs.dev/guide/#scaffolding-your-first-vite-project) using the appropiate template (e.g. `react-ts`) and adding the name of the framework at the end of your example's name:

```bash
cd examples
pnpm create vite@latest my-example-react --template react-ts
```

2. Navigate to the project you just created and install `xstate` and any related libraries (e.g. `@xstate/react`):

```bash
cd my-example-react
pnpm i xstate @xstate/react
```

3. Add your XState-powered demo code ✨

4. Preview it:

```bash
pnpm run dev
```

5. Submit a PR!
