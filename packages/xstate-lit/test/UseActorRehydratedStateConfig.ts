import { UseActor } from './UseActor.ts';
import { persistedFetchStateConfig } from './persistedMachine.ts';

export class UseActorRehydratedStateConfig extends UseActor {
  persistedState = persistedFetchStateConfig;
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
