import { html, LitElement } from 'lit';
import type { AnyStateMachine } from 'xstate';
import { fromTransition } from 'xstate/actors';
import { UseMachine } from '../src/index.ts';

const reducer = (state: number, event: { type: 'INC' }): number => {
  if (event.type === 'INC') {
    return state + 1;
  }
  return state;
};

const logic = fromTransition(reducer, 0);

export class UseActorWithTransitionLogic extends LitElement {
  fromTransitionLogicController: UseMachine<AnyStateMachine>;
  constructor() {
    super();
    this.fromTransitionLogicController = new UseMachine(this, {
      machine: logic as unknown as AnyStateMachine
    });
  }

  override createRenderRoot() {
    return this;
  }

  override render() {
    return html` <button
      data-testid="count"
      @click=${() => this.fromTransitionLogicController.send({ type: 'INC' })}
    >
      ${this.fromTransitionLogicController.snapshot.context}
    </button>`;
  }
}

window.customElements.define(
  'use-actor-with-transition-logic',
  UseActorWithTransitionLogic
);

declare global {
  interface HTMLElementTagNameMap {
    'use-actor-with-transition-logic': UseActorWithTransitionLogic;
  }
}
