import {
  Action,
  Condition,
  EventObject,
  Guard,
  StateNodeConfig,
  TransitionConfig
} from '.';
import { createMachine } from './Machine';
import { toArray, toGuard } from './utils';

interface MachineBuilder<TC, TE extends EventObject>
  extends StateNodeBuilder<TC, TE> {
  context: (context: TC) => void;
}

type TransitionBuilderTarget<TC, TE extends EventObject> =
  | string
  | string[]
  | ((tb: TransitionBuilder<TC, TE>) => string | string[] | undefined | void);

interface StateNodeBuilder<TC, TE extends EventObject> {
  state: (key: string, fn?: (sb: StateNodeBuilder<TC, TE>) => void) => void;
  initialState: (
    key: string,
    fn?: (sb: StateNodeBuilder<TC, TE>) => void
  ) => void;
  entry: (action: Action<TC, TE>) => void;
  exit: (action: Action<TC, TE>) => void;
  on: (eventType: TE['type'], target: TransitionBuilderTarget<TC, TE>) => void;
  after: (
    delay: string | number,
    target: TransitionBuilderTarget<TC, TE>
  ) => void;
}

interface StateNodeBuilderConfig<TC, TE extends EventObject>
  extends StateNodeConfig<TC, any, TE> {
  initial?: string;
  key: string;
  type: StateNodeConfig<TC, any, TE>['type'];
  states: Record<string, StateNodeBuilderConfig<TC, TE>>;
  entry: Array<Action<TC, TE>>;
  exit: Array<Action<TC, TE>>;
  // on: {
  //   [key in TE['type']]?: Array<TransitionBuilderConfig<TC, TE>>;
  // };
  on: {
    [K in TE['type']]?: Array<
      TransitionBuilderConfig<TC, TE extends { type: K } ? TE : never>
    >;
  } & {
    '*'?: Array<TransitionBuilderConfig<TC, TE>>;
  };
  after: Record<string | number, Array<TransitionConfig<TC, TE>>>;
}

interface TransitionBuilderConfig<TC, TE extends EventObject> {
  target: string[];
  actions: Array<Action<TC, TE>>;
  guard?: Guard<TC, TE>;
}

interface TransitionBuilder<TC, TE extends EventObject> {
  action: (action: Action<TC, TE>) => void;
  when: (
    guard: Condition<TC, TE>,
    targetOrBuilder: TransitionBuilderTarget<TC, TE>
  ) => void;
}

interface MachineBuilderConfig<TC, TE extends EventObject>
  extends StateNodeBuilderConfig<TC, TE> {
  id: string;
  context: TC;
}

function createStateNodeBuilder<TC, TE extends EventObject>(
  config: StateNodeBuilderConfig<TC, TE>
): StateNodeBuilder<TC, TE> {
  const buildState: StateNodeBuilder<TC, TE>['state'] = (key, fn) => {
    if (config.type !== 'parallel') {
      config.type = 'compound';
    }

    const childStateNodeConfig: StateNodeBuilderConfig<TC, TE> = {
      key,
      type: 'atomic' as const,
      states: {},
      entry: [],
      exit: [],
      on: {},
      after: {}
    };
    config.states![key] = childStateNodeConfig;

    if (fn) {
      fn(createStateNodeBuilder(childStateNodeConfig));
    }
  };

  const sb: StateNodeBuilder<TC, TE> = {
    initialState: (key, fn) => {
      config.type = 'compound';
      config.initial = key;
      buildState(key, fn);
    },
    state: buildState,
    entry: (action) => {
      config.entry.push(action);
    },
    exit: (action) => {
      config.exit.push(action);
    },
    on: (eventType, targetOrBuilder) => {
      if (!config.on[eventType]) {
        config.on[eventType] = [] as any;
      }

      const defaultTransitionConfig: TransitionBuilderConfig<TC, TE> = {
        target: [],
        actions: []
      };
      // const transitionConfigs: Array<TransitionBuilderConfig<TC, TE>> = [
      //   defaultTransitionConfig
      // ];

      function foo(tob: TransitionBuilderTarget<TC, TE>) {
        if (typeof tob === 'function') {
          const transitionBuilder: TransitionBuilder<TC, TE> = {
            action: (action) => {
              defaultTransitionConfig.actions.push(action);
            },
            when: (guard, subTargetOrBuilder) => {
              defaultTransitionConfig.guard = toGuard(guard);

              foo(subTargetOrBuilder);
            }
          };

          const target = tob(transitionBuilder);

          const targets = target === undefined ? [] : toArray(target);

          defaultTransitionConfig.target = targets;

          config.on[eventType]!.push(defaultTransitionConfig as any); // TODO: fix
        } else {
          const transitionConfig: TransitionBuilderConfig<TC, TE> = {
            target: toArray(tob),
            actions: []
          };

          config.on[eventType]!.push(transitionConfig as any); // TODO: fix
        }
      }

      foo(targetOrBuilder);
    },
    after: (delay, targetOrBuilder) => {
      config.after[delay] = config.after[delay] || [];

      if (typeof targetOrBuilder === 'function') {
        const transitionConfig: TransitionBuilderConfig<TC, TE> = {
          target: [],
          actions: []
        };
        const transitionBuilder: TransitionBuilder<TC, TE> = {
          action: (action) => {
            transitionConfig.actions.push(action);
          },
          // @ts-ignore
          when: (guard, subTargetOrBuilder) => {
            // void
          }
        };

        const target = targetOrBuilder(transitionBuilder);
        const targets = target === undefined ? [] : toArray(target);

        transitionConfig.target = targets;

        config.after[delay].push(transitionConfig);
      }
    }
  };

  return sb;
}

function createMachineBuilder<TC, TE extends EventObject>(
  config: MachineBuilderConfig<TC, TE>
): MachineBuilder<TC, TE> {
  const machineBuilder: MachineBuilder<TC, TE> = {
    ...createStateNodeBuilder(config),
    context: (context) => (config.context = context)
  };

  return machineBuilder;
}

export function buildMachine<TC, TE extends EventObject>(
  machineKey: string,
  fn: (mb: MachineBuilder<TC, TE>) => void
) {
  const config: MachineBuilderConfig<TC, TE> = {
    id: machineKey,
    key: machineKey,
    states: {},
    type: 'compound',
    entry: [],
    exit: [],
    on: {},
    after: {},
    context: null as any
  };

  const mb = createMachineBuilder(config);

  fn(mb);

  return createMachine(config);
}
