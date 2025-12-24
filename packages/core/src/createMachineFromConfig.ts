import {
  Action2,
  AnyEventObject,
  AnyStateMachine,
  EventObject,
  MachineContext,
  MetaObject
} from './types';
import {
  Next_InvokeConfig,
  Next_StateNodeConfig,
  Next_TransitionConfigOrTarget
} from './types.v6';
import { createMachine } from './createMachine';

export interface RaiseJSON {
  type: '@xstate.raise';
  event: EventObject;
  id?: string;
  delay?: number;
}

export interface CancelJSON {
  type: '@xstate.cancel';
  id: string;
}

export interface LogJSON {
  type: '@xstate.log';
  args: any[];
}

export interface EmitJSON {
  type: '@xstate.emit';
  event: AnyEventObject;
}

export interface AssignJSON {
  type: '@xstate.assign';
  context: MachineContext;
}

export interface ScxmlAssignJSON {
  type: 'scxml.assign';
  /** SCXML location attribute - the context property to assign to */
  location: string;
  /** SCXML expr attribute - expression to evaluate */
  expr: string;
}

export type BuiltInActionJSON =
  | RaiseJSON
  | CancelJSON
  | LogJSON
  | EmitJSON
  | AssignJSON;

export interface CustomActionJSON {
  type: string;
  params?: Record<string, unknown>;
}

export type ActionJSON =
  | CustomActionJSON
  | RaiseJSON
  | CancelJSON
  | LogJSON
  | EmitJSON
  | AssignJSON
  | ScxmlAssignJSON;

export interface GuardJSON {
  type: string;
  params?: Record<string, unknown>;
}

export interface InvokeJSON {
  id?: string;
  src: string;
  input?: Record<string, unknown>;
  onDone?: TransitionJSON | TransitionJSON[];
  onError?: TransitionJSON | TransitionJSON[];
  onSnapshot?: TransitionJSON | TransitionJSON[];
}

export interface TransitionJSON {
  target?: string | string[];
  actions?: ActionJSON[];
  guard?: GuardJSON;
  description?: string;
  reenter?: boolean;
  meta?: MetaObject;
}

export interface StateNodeJSON {
  id?: string;
  key?: string;
  type?: 'atomic' | 'compound' | 'parallel' | 'final' | 'history';
  initial?: string;
  states?: Record<string, StateNodeJSON>;
  on?: Record<string, TransitionJSON | TransitionJSON[]>;
  after?: Record<string, TransitionJSON | TransitionJSON[]>;
  always?: TransitionJSON | TransitionJSON[];
  invoke?: InvokeJSON | InvokeJSON[];
  entry?: ActionJSON[];
  exit?: ActionJSON[];
  meta?: MetaObject;
  description?: string;
  history?: 'shallow' | 'deep';
  target?: string;
  output?: unknown;
  context?: Record<string, unknown>;
}
export interface MachineJSON extends StateNodeJSON {
  version?: string;
}

/** Evaluates an SCXML expression with context variables available via `with`. */
function evaluateExpr(
  context: MachineContext,
  expr: string,
  event: AnyEventObject | null
): unknown {
  const fnBody = `
with (context) {
  return (${expr});
}
  `;
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function('context', '_event', fnBody);
  return fn(context, event ? { name: event.type, data: event } : undefined);
}

export function createMachineFromConfig(json: MachineJSON): AnyStateMachine {
  function iterNode(node: StateNodeJSON) {
    const nodeConfig: Next_StateNodeConfig<
      any,
      any,
      any,
      any,
      any,
      any,
      any,
      any,
      any,
      any,
      any
    > = {
      id: node.id,
      initial: node.initial,
      type: node.type,
      history: node.history,
      target: node.target,
      states: node.states
        ? Object.entries(node.states).reduce(
            (acc, [key, value]) => {
              acc[key] = iterNode(value);
              return acc;
            },
            {} as Record<
              string,
              Next_StateNodeConfig<
                any,
                any,
                any,
                any,
                any,
                any,
                any,
                any,
                any,
                any,
                any
              >
            >
          )
        : undefined,
      on: node.on
        ? Object.entries(node.on).reduce(
            (acc, [key, value]) => {
              acc[key] = getTransitionConfig(value);
              return acc;
            },
            {} as Record<
              string,
              Next_TransitionConfigOrTarget<
                any,
                any,
                any,
                any,
                any,
                any,
                any,
                any,
                any
              >
            >
          )
        : undefined,
      always: node.always ? getTransitionConfig(node.always) : undefined,
      // after: node.after,
      entry: node.entry ? iterActions(node.entry) : undefined,
      exit: node.exit ? iterActions(node.exit) : undefined,
      // invoke: node.invoke,
      meta: node.meta
    };

    return nodeConfig;
  }

  function iterInvokes(
    invokes: InvokeJSON | InvokeJSON[]
  ): Next_InvokeConfig<any, any, any, any, any, any, any, any> {
    const nextInvokes = Array.isArray(invokes) ? invokes : [invokes];
    return nextInvokes.map((invoke) => ({
      src: invoke.src,
      input: invoke.input,
      onDone: invoke.onDone
    }));
  }

  function iterActions(
    actions: ActionJSON[]
  ): Action2<any, any, any, any, any, any, any> {
    return (x, enq) => {
      let context: MachineContext | undefined;
      for (const action of actions) {
        if (isBuiltInActionJSON(action)) {
          switch (action.type) {
            case '@xstate.raise':
              enq.raise(action.event, {
                id: action.id,
                delay: action.delay
              });
              break;
            case '@xstate.cancel':
              enq.cancel(action.id);
              break;
            case '@xstate.log':
              enq.log(...action.args);
              break;
            case '@xstate.emit':
              enq.emit(action.event);
              break;
            case '@xstate.assign':
              context ??= {};
              Object.assign(context, action.context);
              break;
            default:
              throw new Error(
                `Unknown built-in action: ${(action as any).type}`
              );
          }
        } else if (action.type === 'scxml.assign') {
          // SCXML-style assign with location and expr
          context ??= {};
          const scxmlAction = action as ScxmlAssignJSON;
          context[scxmlAction.location] = evaluateExpr(
            x.context,
            scxmlAction.expr,
            x.event
          );
        } else {
          enq(x.actions[action.type], (action as CustomActionJSON).params);
        }
      }
      return {
        context
      };
    };
  }

  function getTransitionConfig(
    transition: TransitionJSON | TransitionJSON[]
  ): Next_TransitionConfigOrTarget<
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any
  > {
    const transitions = Array.isArray(transition) ? transition : [transition];
    const nextTransitions = transitions.map((transition) => ({
      target: transition.target,
      action: transition.actions ? iterActions(transition.actions) : undefined,
      guard: transition.guard,
      description: transition.description,
      reenter: transition.reenter
    }));

    const transitionFn = (x, enq) => {
      for (const transition of nextTransitions) {
        let guardPassed = true;
        if (transition.guard) {
          if (transition.guard.type === 'scxml.cond') {
            // SCXML inline condition expression - evaluate with context vars
            const expr = transition.guard.params?.expr as string;
            if (expr) {
              guardPassed = !!evaluateExpr(x.context, expr, x.event);
            }
          } else {
            // Custom guard from implementations
            const guard = x.guards[transition.guard.type];
            guardPassed = !guard || guard(transition.guard.params);
          }
        }
        if (guardPassed) {
          const { context } = transition.action?.(x, enq) ?? {};
          // Target must be a single string - stateUtils wraps it in array
          const target = Array.isArray(transition.target)
            ? transition.target[0]
            : transition.target;
          return {
            target,
            context,
            reenter: transition.reenter
          };
        }
      }
    };

    transitionFn.config = transitions;
    return transitionFn;
  }

  const rootNodeConfig = iterNode(json);
  const contextConfig = json.context ? { context: json.context } : {};

  return createMachine({
    ...rootNodeConfig,
    ...contextConfig
  } as any) as unknown as AnyStateMachine;
}

function isBuiltInActionJSON(action: ActionJSON): action is BuiltInActionJSON {
  return action.type.startsWith('@xstate.');
}
