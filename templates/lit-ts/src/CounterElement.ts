import { html, LitElement } from 'lit';
import { state } from 'lit/decorators.js';
import { type InspectionEvent, type SnapshotFrom } from 'xstate';
import { counterMachine } from './counterMachine.js';
import { UseMachine } from '@xstate/lit';
import { styles } from './styles/counter-element-styles.css.js';

export class CounterElement extends LitElement {
  static override styles = [styles];

  #inspectEventsHandler: (inspEvent: InspectionEvent) => void =
    this.#inspectEvents.bind(this);

  #callbackHandler: (snapshot: SnapshotFrom<any>) => void =
    this.#callbackCounterController.bind(this);

  counterController: UseMachine<typeof counterMachine> = new UseMachine(this, {
    machine: counterMachine,
    options: {
      inspect: this.#inspectEventsHandler
    },
    callback: this.#callbackHandler
  });

  @state()
  xstate: typeof this.counterController.snapshot =
    this.counterController.snapshot;

  override updated(props: Map<string, unknown>) {
    super.updated && super.updated(props);
    if (props.has('xstate')) {
      const { context, value } = this.xstate;
      const detail = { ...(context || {}), value };
      const counterEvent = new CustomEvent('counterchange', {
        bubbles: true,
        detail
      });
      this.dispatchEvent(counterEvent);
    }
  }

  #callbackCounterController(snapshot: typeof this.counterController.snapshot) {
    this.xstate = snapshot;
  }

  #inspectEvents(inspEvent: InspectionEvent) {
    if (
      inspEvent.type === '@xstate.snapshot' &&
      inspEvent.event.type === 'xstate.stop'
    ) {
      this.xstate = {} as unknown as typeof this.counterController.snapshot;
    }
  }

  get #disabled() {
    return this.counterController.snapshot.matches('disabled');
  }

  #send(event: any) {
    this.counterController.send(event);
  }

  override render() {
    return html`
      <div aria-disabled="${this.#disabled}">
        <span>
          <button
            ?disabled="${this.#disabled}"
            data-counter="increment"
            @click=${() => this.#send({ type: 'INC' })}
          >
            Increment
          </button>
          <button
            ?disabled="${this.#disabled}"
            data-counter="decrement"
            @click=${() => this.#send({ type: 'DEC' })}
          >
            Decrement
          </button>
        </span>
        <p>${this.counterController.snapshot.context.counter}</p>
      </div>
      <div>
        <button @click=${() => this.#send({ type: 'TOGGLE' })}>
          ${this.#disabled ? 'Enabled counter' : 'Disabled counter'}
        </button>
        <span><slot></slot></span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'counter-element': CounterElement;
  }
}
