import {
  Action2,
  AnyEventObject,
  AnyStateMachine,
  EventObject,
  MachineContext,
  MetaObject,
  TransitionConfig
} from './types';
import {
  Next_InvokeConfig,
  Next_StateNodeConfig,
  Next_TransitionConfigOrTarget
} from './types.v6';
import { next_createMachine } from './createMachine';
import { rootNode } from 'happy-dom/lib/PropertySymbol.js';

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
  | AssignJSON;

export interface GuardJSON {
  type: string;
  params?: Record<string, unknown>;
}

export interface InvokeJSON {
  id: string;
  src: string;
  input?: Record<string, unknown>;
  onDone?: string;
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
      initial: node.initial,
      type: node.type,
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
              acc[key] = iterTransitions(value);
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
      // after: node.after,
      // always: node.always,
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
        } else {
          enq(x.actions[action.type], action.params);
        }
      }
    };
  }

  function iterTransitions(
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

    return (x, enq) => {
      for (const transition of nextTransitions) {
        const guard = transition.guard
          ? x.guards[transition.guard.type]
          : undefined;
        if (!guard || guard(transition.guard?.params)) {
          transition.action?.(x, enq);
          return {
            target: transition.target
          };
        }
      }
    };
  }

  const rootNodeConfig = iterNode(json);

  return next_createMachine(rootNodeConfig);
}

function isBuiltInActionJSON(action: ActionJSON): action is BuiltInActionJSON {
  return action.type.startsWith('@xstate.');
}
