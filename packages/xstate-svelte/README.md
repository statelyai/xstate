# @xstate/svelte

This package contains utilities for using [XState](https://github.com/statelyai/xstate) with [Svelte](https://github.com/sveltejs/svelte).

- [Read the full documentation in the XState docs](https://xstate.js.org/docs/packages/xstate-svelte/).
- [Read our contribution guidelines](https://github.com/statelyai/xstate/blob/main/CONTRIBUTING.md).

## Quick Start

1. Install `xstate` and `@xstate/svelte`:

```bash
npm i xstate @xstate/svelte
```

**Via CDN**

```html
<script src="https://unpkg.com/@xstate/svelte/dist/xstate-svelte.min.js"></script>
```

By using the global variable `XStateSvelte`

2. Import `useMachine`

```svelte
<script>
  import { useMachine } from '@xstate/svelte';
  import { createMachine } from 'xstate';

  const toggleMachine = createMachine({
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

  const { state, send } = useMachine(toggleMachine);
</script>

<button on:click={() => send('TOGGLE')}>
  {$state.value === 'inactive'
    ? 'Click to activate'
    : 'Active! Click to deactivate'}
</button>
```
