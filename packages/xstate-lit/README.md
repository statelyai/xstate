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

**`new UseMachine(this, {machine, options?, subscriptionProperty?)`**

```js
import { html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
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

  @state()
  protected _xstate: { [k: string]: unknown } = {};

  constructor() {
    super();
    this.toggleController = new UseMachine(this, {
      machine: toggleMachine,
      options: { inspect },
      subscriptionProperty: '_xstate',
    });
  }

  override updated(props: Map<string, unknown>) {
    super.updated && super.updated(props);
    if (props.has('_xstate')) {
      const { value } = this._xstate;
      const toggleEvent = new CustomEvent('togglechange', {
        detail: value,
      });
      this.dispatchEvent(toggleEvent);
    }
  }

  private get _turn() {
    return this.toggleController.snapshot.matches('inactive');
  }

  render() {
    return html`
      <button @click=${() => this.toggleController.send({ type: 'TOGGLE' })}>
        ${this._turn ? 'Turn on' : 'Turn off'}
      </button>
    `;
  }
}
```

## API

### `new UseMachine(host, {machine, options?, subscriptionProperty?)`

A class that creates an actor from the given machine and starts a service that runs for the lifetime of the component.

#### Constructor Options:

`host`: ReactiveControllerHost: The Lit component host.
`machine`: AnyStateMachine: The XState machine to manage.
`options?`: ActorOptions<TMachine>: Optional options for the actor.
`subscriptionProperty?`: string: Optional property on the host to update with the state snapshot.

#### Return Methods:

`actor` - Returns the actor (state machine) instance.
`snapshot` - Returns the current state snapshot.
`send` - Sends an event to the state machine.
`unsubscribe` - Unsubscribes from state updates.

## Matching States

When using [hierarchical](https://xstate.js.org/docs/guides/hierarchical.html) and [parallel](https://xstate.js.org/docs/guides/parallel.html) machines, the state values will be objects, not strings. In this case, it is best to use [`state.matches(...)`](https://xstate.js.org/docs/guides/states.html#state-methods-and-properties).

```js
${this.myXsateController.snapshot.matches('idle')}
//
${this.myXsateController.snapshot.matches({ loading: 'user' })}
//
${this.myXsateController.snapshot.matches({ loading: 'friends' })}
```

## Persisted and Rehydrated State

You can persist and rehydrate state with `useMachine(...)` via `options.snapshot`:

```js
// Get the persisted state config object from somewhere, e.g. localStorage
// highlight-start
const persistedState = JSON.parse(
  localStorage.getItem('some-persisted-state-key'),
);
// highlight-end

connectedCallback() {
  super.connectedCallback && super.connectedCallback();
  this.fetchController = this.fetchController ?? new UseMachine(this, {
    machine: someMachine,
    options: {
      snapshot: this.persistedState
    }
  });
}

// state will initially be that persisted state, not the machine’s initialState
```
