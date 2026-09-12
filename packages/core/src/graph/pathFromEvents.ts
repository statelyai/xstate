import {
  ActorScope,
  ActorLogic,
  ActorSystem,
  EventObject,
  Snapshot
} from '../index.ts';
import { StatePath, Steps, TraversalOptions } from './types.ts';
import { resolveTraversalOptions } from './graph.ts';
import { alterPath } from './alterPath.ts';
import { createMockActorScope } from './actorScope.ts';

export function getPathsFromEvents<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject,
  TInput,
  TSystem extends ActorSystem<any> = ActorSystem<any>
>(
  logic: ActorLogic<TSnapshot, TEvent, TInput, TSystem>,
  events: TEvent[],
  options?: TraversalOptions<TSnapshot, TEvent, TInput>
): Array<StatePath<TSnapshot, TEvent>> {
  const resolvedOptions = resolveTraversalOptions(logic, {
    events,
    ...options
  });
  const actorScope = createMockActorScope() as ActorScope<
    TSnapshot,
    TEvent,
    TSystem
  >;
  const fromState =
    resolvedOptions.fromState ??
    logic.getInitialSnapshot(
      actorScope,
      // TODO: fix this
      options?.input as TInput
    );

  const { serializeState, serializeEvent, filterEvents, stopWhen, limit } =
    resolvedOptions;
  const steps: Steps<TSnapshot, TEvent> = [];
  let state = fromState;
  let stateSerial = serializeState(state, undefined, undefined);
  for (const event of events) {
    if (steps.length >= limit) {
      throw new Error('Traversal limit exceeded');
    }
    const eventSerial = serializeEvent(event);
    let nextEvent: TEvent | undefined = event;
    if (options?.events !== undefined) {
      const candidates =
        typeof options.events === 'function'
          ? options.events(state)
          : options.events;
      nextEvent = undefined;
      for (let index = candidates.length - 1; index >= 0; index--) {
        const candidate = candidates[index];
        if (
          (!filterEvents || filterEvents(state, candidate)) &&
          serializeEvent(candidate) === eventSerial
        ) {
          nextEvent = candidate;
          break;
        }
      }
    } else if (filterEvents && !filterEvents(state, event)) {
      nextEvent = undefined;
    }
    if (!nextEvent || stopWhen?.(state)) {
      throw new Error(
        `Invalid transition from ${stateSerial} with ${eventSerial}`
      );
    }
    steps.push({ state, event });
    const result = logic.transition(state, nextEvent, actorScope);
    const nextState = Array.isArray(result) ? result[0] : result;
    stateSerial = serializeState(nextState, event, state);
    state = nextState;
  }

  // If it is expected to reach a specific state (`toState`) and that state
  // isn't reached, there are no paths
  if (resolvedOptions.toState && !resolvedOptions.toState(state)) {
    return [];
  }

  return [
    alterPath({
      state,
      steps,
      weight: steps.length
    })
  ];
}
