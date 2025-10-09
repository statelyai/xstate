import { UseActor } from './UseActor.ts';
import type { AnyMachineSnapshot } from 'xstate';
import { persistedFetchState } from './persistedMachine.ts';

export class UseActorRehydratedState extends UseActor {
  persistedState: AnyMachineSnapshot | undefined = persistedFetchState as AnyMachineSnapshot | undefined;
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
