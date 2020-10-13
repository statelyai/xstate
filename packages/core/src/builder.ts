import { Action, EventObject, StateNodeConfig } from '.';
import { createMachine } from './Machine';

interface MachineBuilder<TC, TE extends EventObject> {
  state: <T extends string>(
    key: T,
    fn?: (sb: StateNodeBuilder<TC, TE>) => void
  ) => void;
  initialState: <T extends string>(
    key: T,
    fn?: (sb: StateNodeBuilder<TC, TE>) => void
  ) => void;
}

interface StateNodeBuilder<TC, TE extends EventObject> {
  state: (key: string, fn?: (sb: StateNodeBuilder<TC, TE>) => void) => void;
  initialState: (
    key: string,
    fn?: (sb: StateNodeBuilder<TC, TE>) => void
  ) => void;
  entry: (action: Action<TC, TE>) => void;
  exit: (action: Action<TC, TE>) => void;
  on: (
    eventType: TE['type'],
    target: string | string[] | ((tb: TransitionBuilder<TC, TE>) => void)
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
}

interface TransitionBuilderConfig<TC, TE extends EventObject> {
  target: string[];
  actions: Array<Action<TC, TE>>;
}

interface TransitionBuilder<TC, TE extends EventObject> {
  action: (action: Action<TC, TE>) => void;
  target: (target: string) => void;
}

interface MachineNodeBuilderConfig<TC, TE extends EventObject>
  extends StateNodeBuilderConfig<TC, TE> {
  id: string;
}

function createStateBuilder<TC, TE extends EventObject>(
  config: StateNodeBuilderConfig<TC, TE>
): StateNodeBuilder<TC, TE> {
  const buildState = (key, fn) => {
    if (config.type !== 'parallel') {
      config.type = 'compound';
    }

    const childStateNodeConfig = {
      key,
      type: 'atomic' as const,
      states: {},
      entry: [],
      exit: [],
      on: {}
    };
    config.states![key] = childStateNodeConfig;

    if (fn) {
      fn(createStateBuilder(childStateNodeConfig));
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
      } else {
        const transitionConfig: TransitionBuilderConfig<TC, TE> = {
          target: [],
          actions: []
        };

        config.on[eventType]!.push(transitionConfig as any);
      }
    }
  };

  return sb;
}

function createMachineBuilder<TC, TE extends EventObject>(
  config: MachineNodeBuilderConfig<TC, TE>
): MachineBuilder<TC, TE> {
  const snb = createStateBuilder(config);

  return snb;
}

export function buildMachine<TC, TE extends EventObject>(
  machineKey: string,
  fn: (mb: MachineBuilder<TC, TE>) => void
) {
  const config: MachineNodeBuilderConfig<TC, TE> = {
    id: machineKey,
    key: machineKey,
    states: {},
    type: 'compound',
    entry: [],
    exit: [],
    on: {}
  };

  const mb = createMachineBuilder(config);

  fn(mb);

  return createMachine(config);
}
