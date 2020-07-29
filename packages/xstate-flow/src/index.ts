import {
  EventObject,
  Guard,
  TransitionConfig,
  TransitionsConfig
} from 'xstate';

namespace Flow {
  export interface Task<TC, TE extends EventObject> {
    id: string;
    initial: 'pending';
    type?: 'compound' | 'parallel' | 'final';
    states: {
      pending: {
        invoke?: {
          src: string;
          onDone: 'success';
        };
        states?: Record<string, Task<TC, TE>>;
        on?: TransitionsConfig<TC, TE>;
      };
      success: {
        type: 'final';
      };
    };
    onDone?: string;
  }

  export interface Gateway<TC, TE extends EventObject> {
    id: string;
    on?: TransitionsConfig<TC, TE>;
    always?: Array<TransitionConfig<TC, TE>>;
  }
}

export function task<TC, TE extends EventObject>(
  src: string
): Flow.Task<TC, TE> {
  return {
    id: src,
    initial: 'pending',
    states: {
      pending: {
        invoke: {
          src,
          onDone: 'success'
        }
      },
      success: {
        type: 'final'
      }
    }
  };
}

export function receiveTask<TC, TE extends EventObject>(
  event: TE['type']
): Flow.Task<TC, TE> {
  return {
    id: `receive(${event})`,
    initial: 'pending',
    states: {
      pending: {
        on: {
          [event]: { target: 'success' }
        }
      },
      success: {
        type: 'final'
      }
    }
  } as Flow.Task<TC, TE>;
}

export function sequence<TC, TE extends EventObject>(
  ...tasks: Array<Flow.Task<TC, TE> | Flow.Gateway<TC, TE>>
): Flow.Task<TC, TE> {
  const states = {};

  tasks.forEach((t, i) => {
    if (t.id === 'exclusive') {
      states[t.id] = t;
      return;
    }

    if (i === tasks.length - 1) {
      states[t.id] = {
        ...t,
        type: 'final'
      };
    } else {
      states[t.id] = {
        ...t,
        onDone: tasks[i + 1].id
      };
    }
  });

  return {
    id: 'process',
    initial: 'pending',
    states: {
      pending: {
        initial: tasks[0].id,
        states,
        onDone: 'success'
      },
      success: {
        type: 'final'
      }
    }
  } as Flow.Task<TC, TE>;
}

export interface GatewayTrigger<TC, TE extends EventObject> {
  event?: string;
  cond?: Guard<TC, TE>;
}

export function exclusive<TC, TE extends EventObject>(
  ...tuples: Array<[GatewayTrigger<TC, TE>, Flow.Task<TC, TE>]>
): Array<Flow.Gateway<TC, TE> | Flow.Task<TC, TE>> {
  const eventless = tuples.every(([trigger]) => {
    return trigger.event === undefined;
  });

  const inner = eventless
    ? {
        always: tuples.map((tuple) => {
          const [trigger, task] = tuple;

          return {
            target: `#${task.id}`,
            cond: trigger.cond
          };
        })
      }
    : {
        on: tuples.map((tuple) => {
          const [trigger, task] = tuple;

          return {
            target: `#${task.id}`,
            event: trigger.event!,
            cond: trigger.cond
          };
        })
      };
  return [
    {
      id: 'exclusive',
      ...inner
    },
    ...tuples.map(([, task]) => task)
  ];
}
