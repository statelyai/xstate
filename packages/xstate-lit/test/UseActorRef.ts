import { html, LitElement } from 'lit';
import { createMachine } from 'xstate';
import { UseMachine } from '../src/index.ts';

const machine = createMachine({
  initial: 'inactive',
  states: {
    inactive: {
      on: {
        TOGGLE: 'active'
      }
    },
    active: {
      on: {
        TOGGLE: 'inactive'
      }
    }
  }
});

export class UseActorRef extends LitElement {
  machineController: UseMachine<typeof machine> = {} as UseMachine<
    typeof machine
  >;

  constructor() {
    super();
    this.machineController = new UseMachine(this, {
      machine: machine
    });
  }

  private get turn() {
    return this.machineController.snapshot.matches('inactive');
  }

  override render() {
    return html`
      <button @click=${() => this.machineController.send({ type: 'TOGGLE' })}>
        ${this.turn ? 'Turn on' : 'Turn off'}
      </button>
    `;
  }
}

window.customElements.define('use-actor-ref', UseActorRef);

declare global {
  interface HTMLElementTagNameMap {
    'use-actor-ref': UseActorRef;
  }
}
