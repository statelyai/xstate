import { UseActor } from './UseActor.ts';
import type { Snapshot } from 'xstate';
import { persistedFetchState } from './persistedMachine.ts';

export class UseActorRehydratedState extends UseActor {
  get persistedState(): Snapshot<any> | undefined {
    return persistedFetchState;
  }
}

window.customElements.define(
  'use-actor-rehydrated-state',
  UseActorRehydratedState
);

declare global {
  interface HTMLElementTagNameMap {
    'use-actor-rehydrated-state': UseActorRehydratedState;
  }
}
