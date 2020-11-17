import { Action, EventObject, StateNodeConfig, TransitionConfig } from '.';
import { createMachine } from './Machine';
import { toArray } from './utils';

interface MachineBuilder<TC, TE extends EventObject>
  extends StateNodeBuilder<TC, TE> {
  context: (context: TC) => void;
}

type TransitionBuilderTarget<TC, TE extends EventObject> =
  | string
  | string[]
  | ((tb: TransitionBuilder<TC, TE>) => void);

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
}

interface TransitionBuilder<TC, TE extends EventObject> {
  action: (action: Action<TC, TE>) => void;
  target: (target: string) => void;
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
      const transitionConfigs: Array<TransitionBuilderConfig<TC, TE>> = [
        defaultTransitionConfig
      ];

      if (typeof targetOrBuilder === 'function') {
        const transitionBuilder: TransitionBuilder<TC, TE> = {
          target: (target) => {
            defaultTransitionConfig.target.push(target);
          },
          action: (action) => {
            defaultTransitionConfig.actions.push(action);
          }
        };

        targetOrBuilder(transitionBuilder);

        config.on[eventType]!.push(defaultTransitionConfig as any); // TODO: fix
      } else {
        const transitionConfig: TransitionBuilderConfig<TC, TE> = {
          target: toArray(targetOrBuilder),
          actions: []
        };

        config.on[eventType]!.push(transitionConfig as any); // TODO: fix
      }
    },
    after: (delay, targetOrBuilder) => {
      config.after[delay] = config.after[delay] || [];

      if (typeof targetOrBuilder === 'function') {
        const transitionConfig: TransitionBuilderConfig<TC, TE> = {
          target: [],
          actions: []
        };
        const transitionBuilder: TransitionBuilder<TC, TE> = {
          target: (target) => {
            transitionConfig.target.push(target);
          },
          action: (action) => {
            transitionConfig.actions.push(action);
          }
        };

        targetOrBuilder(transitionBuilder);

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
