# Installation

You can install XState from NPM or Yarn, or you can embed the `<script>` directly from a CDN.

## Package Manager

```bash
npm install xstate@latest --save
# or:
yarn add xstate@latest --save
```

## CDN

You can include XState directly from the [unpkg CDN](https://unpkg.com/xstate@4/dist):

- XState core: [https://unpkg.com/xstate@4/dist/xstate.js](https://unpkg.com/xstate@4/dist/xstate.js)
- XState interpreter: [https://unpkg.com/xstate@4/dist/xstate.interpreter.js](https://unpkg.com/xstate@4/dist/xstate.interpreter.js)

```html
<script src="https://unpkg.com/xstate@4/dist/xstate.js"></script>

<!-- Optional: XState interpreter -->
<script src="https://unpkg.com/xstate@4/dist/xstate.interpreter.js"></script>
```

The variable `XState` will be available globally, which will give you access to the top-level exports. If you included the interpreter, the variable `XStateInterpreter` will be available globally as well.

```js
const { Machine, actions } = XState; // global variable: window.XState
const { interpret } = XStateInterpreter; // global variable: window.XStateInterpreter

const lightMachine = Machine({
  // ...
});

const lightService = interpret(lightMachine);
```
