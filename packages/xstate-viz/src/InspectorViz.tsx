import * as React from 'react';
import { createMachine, State, StateNode, SCXML, Interpreter } from 'xstate';
import { useMachine } from '@xstate/react';
import { MachineViz } from './MachineViz';
import { assign } from '@xstate/immer';
// import { EventRecordsViz } from './EventRecordsViz';
import { StateViz } from './StateViz';
import { createContext } from 'react';

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
    }
  | {
      type: 'service.select';
      id: string;
    };

interface InspectorCtx {
  services: Record<
    string,
    {
      state: State<any, any>;
      machine: StateNode<any, any>;
      id: string;
      events: SCXML.Event<any>[];
    }
  >;
  service?: string;
}

const inspectorMachine = createMachine<InspectorCtx, InspectorEvent>({
  id: 'inspector',
  context: {
    services: {},
    service: undefined
  },
  initial: 'pending',
  states: {
    pending: {},
    inspecting: {
      on: {
        'service.state': {
          actions: assign((ctx, e) => {
            const serviceObject = ctx.services[e.id];
            if (!serviceObject) {
              return;
            }

            serviceObject.state = parseState(e.state);
            serviceObject.events.unshift(serviceObject.state._event);

            if (!ctx.service) {
              ctx.service = e.id;
            }
          })
        },
        'service.select': {
          actions: assign((ctx, e) => {
            ctx.service = e.id;
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

const ServicesContext = createContext<
  Interpreter<InspectorCtx, any, InspectorEvent>
>(null as any);

export const InspectorViz: React.FC = () => {
  const [state, send, service] = useMachine(inspectorMachine);

  React.useEffect(() => {
    const handler = (event) => {
      if ('type' in event.data) {
        send(event.data);
      }
    };

    window.addEventListener('message', handler);

    return () => {
      window.removeEventListener('message', handler);
    };
  }, []);

  const currentService = state.context.service
    ? state.context.services[state.context.service]
    : undefined;

  return (
    <ServicesContext.Provider value={service}>
      <div data-xviz="inspector">
        <div data-xviz="services">
          {Object.keys(state.context.services).map((key) => {
            return (
              <div
                data-xviz="service-link"
                key={key}
                onClick={() => send({ type: 'service.select', id: key })}
              >
                {key}
              </div>
            );
          })}
        </div>

        {Object.entries(state.context.services).map(([key, service]) => {
          return (
            <div
              data-xviz="service"
              key={key}
              hidden={currentService !== service || undefined}
            >
              <MachineViz machine={service.machine} state={service.state} />
              {/* <EventRecordsViz events={value.events} /> */}
              <StateViz state={service.state} />
            </div>
          );
        })}
      </div>
    </ServicesContext.Provider>
  );
};
