// Explicit named re-exports (not `export *`): the root entry must stay
// statically analyzable by Node's CJS export lexer, which loses names that
// only flow through a star re-export when this file is compiled to CJS
// (e.g. preconstruct dev mode under `tsx`).
export {
  createAsyncLogic,
  createCallbackLogic,
  createEmptyActor,
  createEventObservableLogic,
  createListenerLogic,
  createLogic,
  createObservableLogic,
  createSubscriptionLogic,
  listenerLogic,
  subscriptionLogic,
  TimeoutError,
  type AsyncActorLogic,
  type AsyncActorRef,
  type AsyncLogicArgs,
  type AsyncLogicConfig,
  type AsyncLogicEnqueue,
  type AsyncLogicFunction,
  type AsyncSnapshot,
  type CallbackActorLogic,
  type CallbackActorRef,
  type CallbackLogicConfig,
  type CallbackLogicFunction,
  type CallbackSnapshot,
  type EventObservableLogicConfig,
  type EventObservableLogicFunction,
  type ListenerActorLogic,
  type ListenerActorRef,
  type ListenerInput,
  type ListenerSnapshot,
  type LogicActorLogic,
  type LogicActorRef,
  type LogicArgs,
  type LogicConfig,
  type LogicEffect,
  type LogicEffectState,
  type LogicEnqueue,
  type LogicFunction,
  type LogicPatch,
  type LogicSnapshot,
  type ObservableActorLogic,
  type ObservableActorRef,
  type ObservableLogicConfig,
  type ObservableLogicFunction,
  type ObservableSnapshot,
  type SubscriptionActorLogic,
  type SubscriptionActorRef,
  type SubscriptionInput,
  type SubscriptionMappers,
  type SubscriptionSnapshot
} from './actors/index.ts';
export { assertEvent } from './assert.ts';
export {
  Actor,
  createActor,
  type RequiredActorOptionsKeys as RequiredActorOptionsKeys
} from './createActor.ts';
export { createMachine, createStateConfig } from './createMachine.ts';
export {
  createFSM,
  type FSMActorLogic,
  type FSMConfig,
  type FSMSnapshot
} from './fsm.ts';
export { createMachineFromConfig } from './createMachineFromConfig.ts';
export type {
  ActionJSON,
  GuardJSON,
  InvokeJSON,
  MachineJSON,
  StateNodeJSON,
  TransitionJSON
} from './createMachineFromConfig.ts';
export {
  machineConfigToJSON,
  serializeMachine,
  type CodeExpression
} from './serialize.ts';
export { mapState } from './mapState.ts';
export {
  machineVersions,
  type AdaptEventsOptions,
  type EventAdapterHandlers,
  type EventHistorySource,
  type MigrateSnapshotOptions,
  type MachineEventSchema,
  type MachineSnapshotSchema,
  type MachineVersionsOptions,
  type MachineVersionDescriptor,
  type ParsedPersistedSnapshot,
  type PersistedMachineIdentity,
  type PersistedMachineSnapshot,
  type PersistedSnapshotDataFrom,
  type PersistedSnapshotSource,
  type SnapshotMigrationHandlers,
  type PersistedSnapshotFrom
} from './machineVersions.ts';
export {
  types,
  isTypeSchema,
  type StandardSchemaV1,
  type TypeSchema
} from './schema.types.ts';
export type {
  ActorValidationBoundary,
  ActorValidationEventOrigin,
  ActorValidationRequest,
  ActorLogicValidator
} from './validation.types.ts';
export { createSystem, setup } from './setup.ts';
export type {
  AnySetupConfig,
  SetupConfig,
  SetupReturn,
  SetupReturnFromConfig,
  SetupSchemas,
  SystemActorMap,
  SystemConfig,
  SystemRuntime,
  SetupStateSchema,
  SetupStateSchemas
} from './setup.ts';
export { getInitialSnapshot, getNextSnapshot } from './getNextSnapshot.ts';
export type {
  InspectionEvent,
  ActorInspectionEvent,
  TransitionInspectionEvent,
  ActionRecord,
  SentRecord
} from './inspection.ts';
export { SimulatedClock } from './SimulatedClock.ts';
export { type Spawner } from './spawn.ts';
export { isMachineSnapshot, type MachineSnapshot } from './State.ts';
export { StateMachine } from './StateMachine.ts';
export { StateNode } from './StateNode.ts';
export { getStateNodes } from './stateUtils.ts';
export type {
  ActorSystem,
  ActorSystemRuntime,
  AnyActorSystem
} from './system.ts';
export { toPromise } from './toPromise.ts';
export type * from './types.ts';
export { SpecialTargets } from './types.ts';
export type {
  Next_MachineConfig as MachineConfig,
  Next_StateNodeConfig as StateNodeConfig,
  Next_InvokeConfig as InvokeConfig,
  Next_TransitionConfigOrTarget as TransitionConfigOrTarget,
  Sources,
  InferEvents,
  WidenLiterals
} from './types.v6.ts';
export {
  getAllOwnEventDescriptors as __unsafe_getAllOwnEventDescriptors,
  matchesState,
  checkStateIn,
  pathToStateValue,
  toObserver
} from './utils.ts';
export {
  transition,
  initialTransition,
  getMicrosteps,
  getInitialMicrosteps,
  getNextTransitions
} from './transition.ts';
export {
  executeEffects,
  isBuiltInExecutableAction
} from './transitionActions.ts';
export {
  getEffectDescriptor,
  type EffectDescriptor
} from './effectDescriptor.ts';
export { waitFor } from './waitFor.ts';

declare global {
  interface SymbolConstructor {
    readonly observable: symbol;
  }
}
