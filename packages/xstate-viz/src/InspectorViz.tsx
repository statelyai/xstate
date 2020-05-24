import * as React from 'react';
import { createMachine, State, StateNode, SCXML } from 'xstate';
import { useMachine } from '@xstate/react';
import { MachineViz } from './MachineViz';
import { assign } from '@xstate/immer';
import { EventRecordsViz } from './EventRecordsViz';
import { StateViz } from './StateViz';

const parseState = (stateJSON: string): State<any, any> => {
  const state = State.create(JSON.parse(stateJSON));

  delete state.history;

  return state;
};

type InspectorEvent =
  | {
      type: 'service.register';
      state: string;
      machine: string;
      id: string;
    }
  | {
      type: 'service.state';
      state: string;
      id: string;
    };

const inspectorMachine = createMachine<
  {
    services: Record<
      string,
      {
        state: State<any, any>;
        machine: StateNode<any, any>;
        id: string;
        events: SCXML.Event<any>[];
      }
    >;
  },
  InspectorEvent
>({
  id: 'inspector',
  context: {
    services: {}
  },
  initial: 'pending',
  states: {
    pending: {},
    inspecting: {
      on: {
        'service.state': {
          actions: assign((ctx, e) => {
            const serviceObject = ctx.services[e.id];
            serviceObject.state = parseState(e.state);
            serviceObject.events.unshift(serviceObject.state._event);
          })
        }
      }
    }
  },
  on: {
    'service.register': {
      actions: assign((ctx, e) => {
        ctx.services[e.id] = {
          id: e.id,
          machine: createMachine(JSON.parse(e.machine)),
          state: parseState(e.state),
          events: []
        };
      }),
      target: '.inspecting'
    }
  }
});

export const InspectorViz: React.FC = () => {
  const [state, send] = useMachine(inspectorMachine);
  console.log(state);

  React.useEffect(() => {
    const handler = (event) => {
      console.log(event.data);
      if ('type' in event.data) {
        send(event.data);
      }
    };

    window.addEventListener('message', handler);

    return () => {
      window.removeEventListener('message', handler);
    };
  }, []);

  return (
    <div data-xviz="inspector">
      {Object.entries(state.context.services).map(([key, value]) => {
        return (
          <div data-xviz="service" key={key}>
            <MachineViz machine={value.machine} state={value.state} />
            <EventRecordsViz events={value.events} />
            <StateViz state={value.state} />
          </div>
        );
      })}
    </div>
  );
};
