# Installation

:::warning These XState v4 docs are no longer maintained

XState v5 is out now! [Read more about XState v5](https://stately.ai/blog/2023-12-01-xstate-v5)

🆕 Find more about [installing XState](https://stately.ai/docs/installation) in our new docs.
:::

You can install XState from NPM or Yarn, or you can embed the `<script>` directly from a CDN.

## Package Manager

```bash
npm install xstate@latest --save
# or:
yarn add xstate@latest --save
```

## CDN

You can include XState directly from the [unpkg CDN](https://unpkg.com/xstate@4/dist/):

- XState core: [https://unpkg.com/xstate@4/dist/xstate.js](https://unpkg.com/xstate@4/dist/xstate.js)
- XState web: [https://unpkg.com/xstate@4/dist/xstate.web.js](https://unpkg.com/xstate@4/dist/xstate.web.js)
  - Browser-friendly, ES module build

```html
<script src="https://unpkg.com/xstate@4/dist/xstate.js"></script>
```

The variable `XState` will be available globally, which will give you access to the top-level exports.

```js
const { createMachine, actions, interpret } = XState; // global variable: window.XState

const lightMachine = createMachine({
  // ...
});

const lightService = interpret(lightMachine);
```
