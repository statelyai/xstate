import {
  EventObject,
  AnyStateMachine,
  StateNode,
  AnyActorLogic,
  EventFromLogic,
  Snapshot,
  InputFrom,
  SnapshotFrom,
  isMachineSnapshot
} from '../index.ts';
import type {
  SerializedEvent,
  SerializedSnapshot,
  StatePath,
  DirectedGraphEdge,
  DirectedGraphNode,
  DirectedGraphDiagnostic,
  TraversalOptions,
  AnyStateNode,
  TraversalConfig
} from './types.ts';
import { createMockActorScope } from './actorScope.ts';
import {
  getAllOwnEvents,
  matchesEvent,
  matchesEventDescriptor
} from '../utils.ts';

/**
 * Returns all state nodes of the given `node`.
 *
 * @public
 * @param stateNode State node to recursively get child state nodes from
 * @public
 */
export function getDescendantStateNodes(stateNode: {
  states: Record<string, AnyStateNode | StateNode<never, EventObject>>;
}): AnyStateNode[] {
  const { states } = stateNode;
  const nodes = Object.keys(states).reduce((accNodes, stateKey) => {
    const childStateNode = states[stateKey] as AnyStateNode;
    const childStateNodes = getDescendantStateNodes(childStateNode);

    accNodes.push(childStateNode, ...childStateNodes);
    return accNodes;
  }, [] as AnyStateNode[]);

  return nodes;
}

function getChildren(stateNode: AnyStateNode): AnyStateNode[] {
  if (!stateNode.states) {
    return [];
  }

  const children = Object.keys(stateNode.states).map((key) => {
    return stateNode.states[key];
  });

  return children;
}

/** @public */
export function serializeSnapshot(snapshot: Snapshot<any>): SerializedSnapshot {
  const { value, context } = snapshot as any;
  const machineSnapshot = isMachineSnapshot(snapshot) ? snapshot : undefined;
  const inputs = machineSnapshot?.getInputs();
  const history = machineSnapshot?.historyValue;
  return JSON.stringify({
    value,
    context: Object.keys(context ?? {}).length ? context : undefined,
    // Equal values and root contexts can still make different decisions when
    // their state inputs or remembered history differ. Empty records remain
    // omitted to preserve the keys of machines that do not use these features.
    stateInputs: inputs && Object.keys(inputs).length ? inputs : undefined,
    historyValue:
      history && Object.keys(history).length
        ? Object.fromEntries(
            Object.entries(history).map(([id, nodes]) => [
              id,
              nodes.map((node) => node.id)
            ])
          )
        : undefined
  }) as SerializedSnapshot;
}

function serializeEvent<TEvent extends EventObject>(
  event: TEvent
): SerializedEvent {
  return JSON.stringify(event) as SerializedEvent;
}

function resolveEventCases<TSnapshot>(
  cases: object,
  state: TSnapshot,
  defaults?: EventObject[]
): EventObject[] {
  const events: EventObject[] = [];
  const sources = cases as Record<
    string,
    readonly object[] | ((state: TSnapshot) => readonly object[])
  >;
  const entries = Object.entries(sources).filter(
    ([, source]) => source !== undefined
  );
  const applicable = (type: string) =>
    !defaults ||
    defaults.some((event) => matchesEventDescriptor(type, event.type));
  for (const [type, source] of entries) {
    if (!applicable(type)) {
      continue;
    }
    const samples = typeof source === 'function' ? source(state) : source;
    if (!Array.isArray(samples) || !samples.length) {
      throw new Error(`Event cases for "${type}" must be a non-empty array`);
    }
    for (const payload of samples) {
      const event = { ...payload, type };
      if (
        !defaults ||
        defaults.some(
          ({ type: descriptor, ...pattern }) =>
            matchesEventDescriptor(type, descriptor) &&
            matchesEvent(event, pattern)
        )
      ) {
        events.push(event);
      }
    }
  }
  return [
    ...events,
    ...(defaults?.filter(
      (event) => !entries.some(([type]) => type === event.type)
    ) ?? [])
  ];
}

function createDefaultMachineOptions<TMachine extends AnyStateMachine>(
  machine: TMachine,
  options?: TraversalOptions<
    SnapshotFrom<TMachine>,
    EventFromLogic<TMachine>,
    InputFrom<TMachine>
  >
): TraversalOptions<
  SnapshotFrom<TMachine>,
  EventFromLogic<TMachine>,
  InputFrom<TMachine>
> {
  const traversalOptions: TraversalOptions<
    SnapshotFrom<TMachine>,
    EventFromLogic<TMachine>,
    InputFrom<TMachine>
  > = {
    serializeState: serializeSnapshot,
    serializeEvent,
    ...options,
    events: (state) => getAllOwnEvents(state) as EventFromLogic<TMachine>[],
    fromState:
      options?.fromState ??
      (machine.getInitialSnapshot(
        createMockActorScope(),
        options?.input
      ) as SnapshotFrom<TMachine>)
  };

  return traversalOptions;
}

/** @public */
export function toDirectedGraph(
  stateMachine: AnyStateNode | AnyStateMachine
): DirectedGraphNode {
  const stateNode = (
    isMachineLogic(stateMachine) ? stateMachine.root : stateMachine
  ) as AnyStateNode; // TODO: accept only machines

  const diagnostics: DirectedGraphDiagnostic[] = [];
  const transitions = [
    ...[...stateNode.transitions.values()].flat(),
    ...(stateNode.always ?? [])
  ];
  const edges: DirectedGraphEdge[] = transitions.flatMap(
    (t, transitionIndex) => {
      if (t.to) {
        diagnostics.push({
          code: 'dynamic-target',
          stateId: stateNode.id,
          eventType: t.eventType,
          transitionId: `${stateNode.id}:${transitionIndex}`,
          message:
            'Transition function destinations require execution or source analysis.'
        });
      }
      // A transition function computes its target when it runs, so there is
      // no static edge to draw; a targetless transition stays in its state.
      const targets = t.target ?? (t.to ? [] : [stateNode]);

      return targets.map((target, targetIndex) => {
        const edge: DirectedGraphEdge = {
          id: `${stateNode.id}:${transitionIndex}:${targetIndex}`,
          source: stateNode,
          target: target as AnyStateNode,
          transition: t,
          label: {
            text: t.eventType,
            toJSON: () => ({ text: t.eventType })
          },
          toJSON: () => {
            const { label } = edge;

            return { source: stateNode.id, target: target.id, label };
          }
        };

        return edge;
      });
    }
  );

  const children = getChildren(stateNode).map(toDirectedGraph);
  diagnostics.push(...children.flatMap((child) => child.analysis.diagnostics));
  const graph = {
    id: stateNode.id,
    stateNode: stateNode,
    children,
    edges,
    analysis: {
      transitionTargetsComplete: diagnostics.length === 0,
      diagnostics
    },
    toJSON: () => {
      const { id, children, edges: graphEdges } = graph;
      return { id, children, edges: graphEdges, analysis: graph.analysis };
    }
  };

  return graph;
}

function isMachineLogic(logic: unknown): logic is AnyStateMachine {
  if (!logic || typeof logic !== 'object') {
    return false;
  }

  const machine = logic as Partial<AnyStateMachine>;
  const root = machine.root as Partial<AnyStateNode> | undefined;

  return (
    !!root &&
    typeof root === 'object' &&
    typeof root.id === 'string' &&
    typeof root.states === 'object' &&
    typeof root.transitions?.values === 'function' &&
    typeof machine.getStateNodeById === 'function' &&
    typeof machine.resolveState === 'function' &&
    typeof machine.getTransitionData === 'function'
  );
}

export function resolveTraversalOptions<TLogic extends AnyActorLogic>(
  logic: TLogic,
  traversalOptions?: TraversalOptions<
    SnapshotFrom<TLogic>,
    EventFromLogic<TLogic>,
    InputFrom<TLogic>
  >,
  defaultOptions?: TraversalOptions<
    SnapshotFrom<TLogic>,
    EventFromLogic<TLogic>,
    InputFrom<TLogic>
  >
): TraversalConfig<SnapshotFrom<TLogic>, EventFromLogic<TLogic>> {
  const resolvedDefaultOptions =
    defaultOptions ??
    (isMachineLogic(logic)
      ? (createDefaultMachineOptions(
          logic,
          traversalOptions as any
        ) as TraversalOptions<
          SnapshotFrom<TLogic>,
          EventFromLogic<TLogic>,
          InputFrom<TLogic>
        >)
      : undefined);
  const serializeState =
    traversalOptions?.serializeState ??
    resolvedDefaultOptions?.serializeState ??
    ((state) => JSON.stringify(state));
  const eventSource =
    traversalOptions?.events ?? resolvedDefaultOptions?.events ?? [];
  const traversalConfig: TraversalConfig<
    SnapshotFrom<TLogic>,
    EventFromLogic<TLogic>
  > = {
    serializeState,
    serializeEvent,
    filterEvents: undefined,
    limit: Infinity,
    toState: undefined,
    // Traversal should not continue past the `toState` predicate
    // since the target state has already been reached at that point
    stopWhen: traversalOptions?.toState,
    ...resolvedDefaultOptions,
    ...traversalOptions,
    // Synthetic completion/delay events are supported by the machine runtime.
    events: (typeof eventSource === 'function' || Array.isArray(eventSource)
      ? eventSource
      : (state: SnapshotFrom<TLogic>) =>
          resolveEventCases(
            eventSource,
            state,
            isMachineSnapshot(state) ? getAllOwnEvents(state) : undefined
          )) as TraversalConfig<
      SnapshotFrom<TLogic>,
      EventFromLogic<TLogic>
    >['events'],
    fromState: traversalOptions?.fromState ?? resolvedDefaultOptions?.fromState
  };

  return traversalConfig;
}

/** @public */
export function joinPaths<
  TSnapshot extends Snapshot<unknown>,
  TEvent extends EventObject
>(
  headPath: StatePath<TSnapshot, TEvent>,
  tailPath: StatePath<TSnapshot, TEvent>
): StatePath<TSnapshot, TEvent> {
  const secondPathSource = tailPath.steps[0].state;

  if (secondPathSource !== headPath.state) {
    throw new Error(`Paths cannot be joined`);
  }

  return {
    state: tailPath.state,
    // e.g. [A, B, C] + [C, D, E] = [A, B, C, D, E]
    steps: headPath.steps.concat(tailPath.steps.slice(1)),
    weight: headPath.weight + tailPath.weight
  };
}
