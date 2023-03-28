# Usage with Svelte

In this section you find information for setting up XState in a Svelte project. Nowadays the Svelte docs recommend the usage of Vite for new Svelte or SvelteKit projects. The section directly below is intended for such projects. If you want to integrate XState into older projects that rely on rollup, conduct the section further below.

## Svelte projects based on Vite

XState integrates great with Svelte & SvelteKit, and especially [Svelte stores!](https://svelte.dev/docs#svelte_store). The official `@xstate/svelte` package is recommended to get the most out of XState and Svelte.

- Details about the installation and usage example can be found in the new docs on the page about the [xstate svelte package](https://stately.ai/docs/xstate/packages/xstate-svelte).
- You can also check out a [template](https://stately.ai/docs/xstate/templates) for quickly gettings started with a minimal project.

## Legacy: Svelte projects based on Rollup

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
