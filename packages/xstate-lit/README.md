# @xstate/lit

The [@xstate/lit](https://github.com/lit/lit) package contains a [Reactive Controller](https://lit.dev/docs/composition/controllers/) for using XState with Lit.

- [Read the full documentation in the XState docs](https://stately.ai/docs/xstate-lit/).
- [Read our contribution guidelines](https://github.com/statelyai/xstate/blob/main/CONTRIBUTING.md).

## Quick Start

1. Install `xstate` and `@xstate/lit`:

```bash
npm i xstate @xstate/lit
```

**Via CDN**

```html
<script src="https://unpkg.com/@xstate/lit/dist/xstate-lit.esm.js"></script>
```

2. Import the `UseMachine` Lit controller:

**`new UseMachine(this, {machine, options?, callback?})`**

```js
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { createBrowserInspector } from '@statelyai/inspect';
import { createMachine } from 'xstate';
import { UseMachine } from '@xstate/lit';

const { inspect } = createBrowserInspector({
  // Comment out the line below to start the inspector
  autoStart: false,
});

const toggleMachine = createMachine({
  id: 'toggle',
  initial: 'inactive',
  states: {
    inactive: {
      on: { TOGGLE: 'active' },
    },
    active: {
      on: { TOGGLE: 'inactive' },
    },
  },
});

@customElement('toggle-component')
export class ToggleComponent extends LitElement {
  toggleController: UseMachine<typeof toggleMachine>;

constructor() {
    super();
    this.toggleController = new UseMachine(this, {
      machine: toggleMachine,
      options: { inspect }
    });
  }

  private get turn() {
    return this.toggleController.snapshot.matches('inactive');
  }

  render() {
    return html`
      <button @click=${() => this.toggleController.send({ type: 'TOGGLE' })}>
        ${this.turn ? 'Turn on' : 'Turn off'}
      </button>
    `;
  }
}
```
