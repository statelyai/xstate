import { NULL_EVENT } from '../constants.ts';
import type { AnyStateMachine, AnyTransitionDefinition } from '../types.ts';
import type { AnyStateNode } from './types.ts';

export const ALWAYS_SIGNAL = 'xstate.always';

export type SignalKind =
  | 'event'
  | 'always'
  | 'after'
  | 'route'
  | 'done-state'
  | 'done-actor'
  | 'error-actor'
  | 'snapshot-actor';

export interface CompiledSignalRoute {
  signal: string;
  eventType: string;
  kind: SignalKind;
  source: string;
  targets: string[];
  reenter: boolean;
  guarded: boolean;
  transition: AnyTransitionDefinition;
  toJSON: () => {
    signal: string;
    eventType: string;
    kind: SignalKind;
    source: string;
    targets: string[];
    reenter: boolean;
    guarded: boolean;
  };
}

export interface CompiledSignal {
  signal: string;
  kind: SignalKind;
  routes: CompiledSignalRoute[];
}

export interface CompiledMachineSignals {
  routes: CompiledSignalRoute[];
  signals: CompiledSignal[];
  bySignal: Record<string, CompiledSignal>;
  toJSON: () => {
    routes: ReturnType<CompiledSignalRoute['toJSON']>[];
    signals: Array<{
      signal: string;
      kind: SignalKind;
      routes: ReturnType<CompiledSignalRoute['toJSON']>[];
    }>;
  };
}

export interface CompileMachineSignalsOptions {
  includeEventless?: boolean;
}

function toSignalKind(signal: string): SignalKind {
  if (signal === ALWAYS_SIGNAL) {
    return 'always';
  }
  if (signal === 'xstate.route') {
    return 'route';
  }
  if (signal.startsWith('xstate.after.')) {
    return 'after';
  }
  if (signal.startsWith('xstate.done.state.')) {
    return 'done-state';
  }
  if (signal.startsWith('xstate.done.actor.')) {
    return 'done-actor';
  }
  if (signal.startsWith('xstate.error.actor.')) {
    return 'error-actor';
  }
  if (signal.startsWith('xstate.snapshot.')) {
    return 'snapshot-actor';
  }
  return 'event';
}

function collectStateNodes(rootStateNode: AnyStateNode): AnyStateNode[] {
  const result: AnyStateNode[] = [];
  const stack: AnyStateNode[] = [rootStateNode];

  while (stack.length) {
    const stateNode = stack.pop()!;
    result.push(stateNode);
    for (const child of Object.values(stateNode.states)) {
      stack.push(child);
    }
  }

  return result.sort((a, b) => a.order - b.order);
}

function createRoute(
  eventType: string,
  transition: AnyTransitionDefinition
): CompiledSignalRoute {
  const signal = eventType === NULL_EVENT ? ALWAYS_SIGNAL : eventType;
  const kind = toSignalKind(signal);
  const source = `#${transition.source.id}`;
  const targets = (transition.target ?? []).map((target) => `#${target.id}`);

  const route: CompiledSignalRoute = {
    signal,
    eventType,
    kind,
    source,
    targets,
    reenter: transition.reenter,
    guarded: transition.guard !== undefined,
    transition,
    toJSON: () => ({
      signal,
      eventType,
      kind,
      source,
      targets,
      reenter: transition.reenter,
      guarded: transition.guard !== undefined
    })
  };

  return route;
}

export function compileMachineSignals(
  machine: AnyStateMachine,
  options: CompileMachineSignalsOptions = {}
): CompiledMachineSignals {
  const includeEventless = options.includeEventless ?? false;
  const routes: CompiledSignalRoute[] = [];
  const routesBySignal = new Map<string, CompiledSignalRoute[]>();

  const addRoute = (route: CompiledSignalRoute) => {
    routes.push(route);
    const existing = routesBySignal.get(route.signal);
    if (existing) {
      existing.push(route);
      return;
    }
    routesBySignal.set(route.signal, [route]);
  };

  for (const stateNode of collectStateNodes(machine.root)) {
    for (const transitions of stateNode.transitions.values()) {
      for (const transition of transitions) {
        addRoute(createRoute(transition.eventType, transition));
      }
    }

    if (!includeEventless || !stateNode.always) {
      continue;
    }

    for (const transition of stateNode.always) {
      addRoute(createRoute(transition.eventType, transition));
    }
  }

  const signals: CompiledSignal[] = Array.from(routesBySignal.entries()).map(
    ([signal, signalRoutes]) => ({
      signal,
      kind: toSignalKind(signal),
      routes: signalRoutes
    })
  );

  const bySignal = Object.fromEntries(
    signals.map((signal) => [signal.signal, signal])
  );

  return {
    routes,
    signals,
    bySignal,
    toJSON: () => ({
      routes: routes.map((route) => route.toJSON()),
      signals: signals.map((signal) => ({
        signal: signal.signal,
        kind: signal.kind,
        routes: signal.routes.map((route) => route.toJSON())
      }))
    })
  };
}
