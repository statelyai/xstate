# Usage with Svelte

XState integrates great with Svelte, and especially [Svelte stores!](https://svelte.dev/docs#svelte_store)

The only gotcha is that you'll need this extra package.

```js
npm install @rollup/plugin-replace --save-dev
```

Import the new package in rollup.config.js

```js
import replace from '@rollup/plugin-replace';
```

Then add this to the plugins array in rollup.config.js.

```js
replace({
  'process.env.NODE_ENV': process.env.NODE_ENV
});
```

### machine.js

```js
import { createMachine } from 'xstate';

// This machine is completely decoupled from Svelte
export const toggleMachine = createMachine({
  id: 'toggle',
  initial: 'inactive',
  states: {
    inactive: {
      on: { TOGGLE: 'active' }
    },
    active: {
      on: { TOGGLE: 'inactive' }
    }
  }
});
```

### App.svelte - Standard usage

```html
<script>
    import {interpret} from 'xstate';
    import {toggleMachine} from './machine';

    let current;

    const toggleService = interpret(toggleMachine)
        .onTransition((state) => {
            current = state;
        }).start()
</script>

<button on:click={() => toggleService.send('TOGGLE')}>
    {current.matches('inactive') ? 'Off' : 'On'}
</button>
```

### App.svelte - Store usage

The toggleService has a `.subscribe` function that is similar to Svelte stores, so it can be used as a readable store.

```html
<script>
    import {interpret} from 'xstate';
    import {toggleMachine} from './machine';

    const toggleService = interpret(toggleMachine).start();
</script>

<button on:click={() => toggleService.send('TOGGLE')}>
    {$toggleService.matches('inactive') ? 'Off' : 'On'}
</button>
```

If you're not familiar with the '\$' syntax, it basically just reads the value of a store.
