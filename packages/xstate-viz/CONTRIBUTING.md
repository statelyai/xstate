# Contributing

## Local development

To develop and test the `@xstate/viz` components in local projects:

1. In this directory (`/packages/xstate-viz`), run:

```bash
yarn link
```

This will link `@xstate/viz` to the local version.

2. In your local project, run:

```bash
yarn link @xstate/viz
```

And then link the local project's `react` and `react-dom` modules:

```bash
yarn link --cwd ./node_modules/react
yarn link --cwd ./node_modules/react-dom
```

3. In this directory (`/packages/xstate-viz`), link to your local project's `react` and `react-dom`:

```bash
yarn link react
yarn link react-dom
```

4. Start building incrementally:

```bash
yarn watch
```
