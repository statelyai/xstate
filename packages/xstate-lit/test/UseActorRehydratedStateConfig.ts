import { UseActor } from './UseActor.ts';
import type { Snapshot } from 'xstate';
import { persistedFetchStateConfig } from './persistedMachine.ts';

export class UseActorRehydratedStateConfig extends UseActor {
  get persistedState(): Snapshot<any> | undefined {
    return persistedFetchStateConfig;
  }
}

window.customElements.define(
  'use-actor-rehydrated-state-config',
  UseActorRehydratedStateConfig
);

declare global {
  interface HTMLElementTagNameMap {
    'use-actor-rehydrated-state-config': UseActorRehydratedStateConfig;
  }
}
