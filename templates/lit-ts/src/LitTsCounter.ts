import { html, LitElement } from 'lit';
import { state } from 'lit/decorators.js';
import { type InspectionEvent } from 'xstate';
import { counterMachine } from './counterMachine.js';
import { UseMachine } from '../../../packages/xstate-lit/src/index.js';
// import { UseMachine } from '@xstate/lit';
import { styles } from './styles/lit-ts-counter-styles.css.js';

export class LitTsCounter extends LitElement {
  static override styles = [styles];

  #inspectEventsHandler: (inspEvent: InspectionEvent) => void =
    this.#inspectEvents.bind(this);

  counterController: UseMachine<typeof counterMachine> = new UseMachine(this, {
    machine: counterMachine,
    options: {
      inspect: this.#inspectEventsHandler
    },
    subscriptionProperty: '_xstate'
  });

  @state()
  _xstate: { [k: string]: unknown } = {};

  override updated(props: Map<string, unknown>) {
    super.updated && super.updated(props);

    if (props.has('_xstate')) {
      const { context, value } = this._xstate;
      const detail = { ...(context || {}), value };
      const counterEvent = new CustomEvent('counterchange', {
        bubbles: true,
        detail
      });
      this.dispatchEvent(counterEvent);
    }
  }

  #inspectEvents(inspEvent: InspectionEvent) {
    if (
      inspEvent.type === '@xstate.snapshot' &&
      inspEvent.event.type === 'xstate.stop'
    ) {
      this._xstate = {};
    }
  }

  get #disabled() {
    return this.counterController.snapshot.matches('disabled');
  }

  override render() {
    return html`
      <div aria-disabled="${this.#disabled}">
        <span>
          <button
            ?disabled="${this.#disabled}"
            data-counter="increment"
            @click=${() => this.counterController.send({ type: 'INC' })}
          >
            Increment
          </button>
          <button
            ?disabled="${this.#disabled}"
            data-counter="decrement"
            @click=${() => this.counterController.send({ type: 'DEC' })}
          >
            Decrement
          </button>
        </span>
        <p>${this.counterController.snapshot.context.counter}</p>
      </div>
      <div>
        <button @click=${() => this.counterController.send({ type: 'TOGGLE' })}>
          ${this.#disabled ? 'Enabled counter' : 'Disabled counter'}
        </button>
        <span><slot></slot></span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lit-ts-counter': LitTsCounter;
  }
}
