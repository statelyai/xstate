import { html, LitElement } from 'lit';
import type { Snapshot } from 'xstate';
import { fromPromise } from 'xstate/actors';
import { fetchMachine } from './fetchMachine.ts';
import { UseMachine } from '../src/index.ts';

const onFetch = () =>
  new Promise<string>((res) => {
    setTimeout(() => res('some data'), 50);
  });

const fMachine = fetchMachine.provide({
  actors: {
    fetchData: fromPromise(onFetch)
  }
});

export class UseActor extends LitElement {
  fetchController: UseMachine<typeof fetchMachine> = new UseMachine(this, {
    machine: fMachine,
    options: {
      snapshot: this.persistedState
    }
  });

  get persistedState(): Snapshot<any> | undefined {
    return undefined;
  }

  override createRenderRoot() {
    return this;
  }

  override render() {
    return html`
      <slot></slot>
      <div>
        ${this.fetchController.snapshot.matches('idle')
          ? html`
              <button
                @click=${() => this.fetchController.send({ type: 'FETCH' })}
              >
                Fetch
              </button>
            `
          : ''}
        ${this.fetchController.snapshot.matches('loading')
          ? html` <div>Loading...</div> `
          : ''}
        ${this.fetchController.snapshot.matches('success')
          ? html`
              <div>
                Success! Data:
                <div data-testid="data">
                  ${this.fetchController.snapshot.context.data}
                </div>
              </div>
            `
          : ''}
      </div>
    `;
  }
}

window.customElements.define('use-actor', UseActor);

declare global {
  interface HTMLElementTagNameMap {
    'use-actor': UseActor;
  }
}
