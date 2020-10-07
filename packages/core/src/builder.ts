import { Action, EventObject, MachineConfig, StateNodeConfig } from '.';

interface MachineBuilder<TC, TE extends EventObject> {
  state: <T extends string>(
    key: T,
    fn?: (sb: StateNodeBuilder<TC, TE>) => void
  ) => void;
  initial: <T extends string>(key: T) => void;
}

interface StateNodeBuilder<TC, TE extends EventObject> {
  state: (key: string, fn?: (sb: StateNodeBuilder<TC, TE>) => void) => void;
  initial: (key: string) => void;
  entry: (action: Action<TC, TE>) => void;
  exit: (action: Action<TC, TE>) => void;
  on: (eventType: string, target: string) => void;
}

interface TransitionBuilderConfig<TC, TE extends EventObject> {
  target: string;
  actions: Array<Action<TC, TE>>;
}

interface StateNodeBuilderConfig<TC, TE extends EventObject> {
  initial?: string;
  type: StateNodeConfig<TC, any, TE>['type'];
  states: Record<string, StateNodeBuilderConfig<TC, TE>>;
  entry: Array<Action<TC, TE>>;
  exit: Array<Action<TC, TE>>;
  on: {
    [key in TE['type']]?: Array<TransitionBuilderConfig<TC, TE>>;
  };
}

function createStateBuilder<TC, TE extends EventObject>(
  config: StateNodeBuilderConfig<TC, TE>
): StateNodeBuilder<TC, TE> {
  const sb: StateNodeBuilder<TC, TE> = {
    initial: (key) => {
      config.initial = key;
    },
    state: (key, fn) => {
      const childStateNodeConfig = {
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
    },
    entry: (action) => {
      config.entry.push(action);
    },
    exit: (action) => {
      config.exit.push(action);
    },
    on: (eventType, target) => {
      if (!config.on[eventType]) {
        config.on[eventType] = [];
      }

      config.on[eventType]!.push({ target });
    }
  };

  return sb;
}

function createMachineBuilder<TC, TE extends EventObject>(
  config: Partial<MachineConfig<TC, any, TE>>
): MachineBuilder<TC, TE> {
  const mb: MachineBuilder<TC, TE> = {
    initial: (key) => {
      config.initial = key;
    },
    state: (key, fn) => {
      const childStateConfig: StateNodeBuilderConfig<TC, TE> = {
        type: 'atomic',
        states: {},
        entry: [],
        exit: [],
        on: {}
      };

      config.states![key] = childStateConfig;

      if (!fn) {
        return;
      }

      const sb = createStateBuilder(childStateConfig);

      fn(sb);
    }
  };

  return mb;
}

function buildMachine<TC, TE extends EventObject>(
  machineKey: string,
  fn: (mb: MachineBuilder<TC, TE>) => void
) {
  const config: Partial<MachineConfig<any, any, any>> = {
    id: machineKey,
    states: {}
  };

  const mb = createMachineBuilder(config);

  fn(mb);

  return config;
}

const someMachine = buildMachine(
  'something',
  (machine: MachineBuilder<any, any>) => {
    machine.initial('green');

    machine.state('green', (state) => {
      state.on('TIMER', 'yellow');
    });

    machine.state('yellow', (state) => {
      state.on('TIMER', 'red');
    });

    machine.state('red', (state) => {
      state.initial('walk');
      state.state('walk', (walkState) => {
        walkState.on('COUNTDOWN', 'wait');
      });
      state.state('wait', (waitState) => {
        waitState.on('COUNTDOWN', 'stop');
      });
      state.state('stop');
    });
  }
);
