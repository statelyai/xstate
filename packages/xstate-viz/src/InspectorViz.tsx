import * as React from "react";
import {
  createMachine,
  State,
  StateNode,
  SCXML,
  Interpreter,
  EventObject,
} from "xstate";
import { useMachine } from "@xstate/react";
import { MachineViz } from "./MachineViz";
import { assign, createUpdater, ImmerUpdateEvent } from "@xstate/immer";
// import { EventRecordsViz } from './EventRecordsViz';
import { StateViz } from "./StateViz";
import { createContext } from "react";
import { Loader } from "./Loader";
import { flatten, toSCXMLEvent } from "xstate/lib/utils";
import { enableMapSet } from "immer";
enableMapSet();

const parseState = (stateJSON: string): State<any, any> => {
  const state = State.create(JSON.parse(stateJSON));

  delete state.history;

  return state;
};

type ViewUpdateEvent = ImmerUpdateEvent<"view.update", "graph" | "state">;

const viewUpdater = createUpdater<InspectorCtx, ViewUpdateEvent>(
  "view.update",
  (ctx, { input }) => {
    ctx.view = input;
  }
);

export type InspectorEvent =
  | {
      type: "service.register";
      state: string;
      machine: string;
      id: string;
      parent?: string;
    }
  | {
      type: "service.stop";
      id: string;
    }
  | {
      type: "service.state";
      state: string;
      id: string;
    }
  | {
      type: "service.select";
      id: string;
    }
  | ViewUpdateEvent;

interface ServiceDataCtx {
  state: State<any, any>;
  machine: StateNode<any, any>;
  id: string;
  parent?: string;
  events: Array<SCXML.Event<any>>;
}
interface InspectorCtx {
  services: Record<string, ServiceDataCtx>;
  service?: string;
  eventsMap: Map<
    string,
    Array<
      SCXML.Event<EventObject> & {
        timestamp: number;
        origin: string;
        destination: string;
      }
    >
  >;
  view: "graph" | "state";
}

const inspectorMachine = createMachine<InspectorCtx, InspectorEvent>({
  id: "inspector",
  context: {
    services: {},
    service: undefined,
    eventsMap: new Map(),
    view: "graph",
  },
  initial: "pending",
  states: {
    pending: {},
    inspecting: {
      on: {
        "service.state": {
          actions: assign((ctx, e) => {
            const serviceObject = ctx.services[e.id];
            if (!serviceObject) {
              return;
            }

            if (e.state === undefined) {
              return;
            }

            serviceObject.state = parseState(e.state);
            serviceObject.events.unshift(serviceObject.state._event);

            const destination = serviceObject.state._sessionid!;
            const origin = serviceObject.state._event.origin || destination;

            if (!ctx.eventsMap.get(origin)) {
              ctx.eventsMap.set(origin, []);
            }
            if (!ctx.eventsMap.get(destination)) {
              ctx.eventsMap.set(destination, []);
            }

            const events = ctx.eventsMap.get(origin)!;

            events.push({
              ...serviceObject.state._event,
              timestamp: Date.now(),
              origin,
              destination,
            });

            if (!ctx.service) {
              ctx.service = e.id;
            }
          }),
        },
        "service.select": {
          actions: assign((ctx, e) => {
            ctx.service = e.id;
          }),
        },
      },
    },
  },
  on: {
    "service.register": {
      actions: assign((ctx, e) => {
        ctx.services[e.id] = {
          id: e.id,
          parent: e.parent,
          machine: createMachine(JSON.parse(e.machine)),
          state: parseState(e.state),
          events: [],
        };

        if (!ctx.service) {
          ctx.service = e.id;
        }
      }),
      target: ".inspecting",
    },
    "service.stop": {
      actions: assign((ctx, e) => {
        delete ctx.services[e.id];
      }),
    },
    [viewUpdater.type]: { actions: viewUpdater.action },
  },
});

export const ServicesContext = createContext<
  Interpreter<InspectorCtx, any, InspectorEvent>
>(null as any);

export const ServiceDataContext = createContext<ServiceDataCtx>(null as any);

interface Receiver<T> {
  send: (event: T) => void;
  receive: (listener: (e: T) => void) => () => void;
}

export function createReceiver<T>(): Receiver<T> {
  const listeners = new Set<(e: T) => void>();

  return {
    send: (e) => {
      listeners.forEach((listener) => listener(e));
    },
    receive: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const InspectorViz: React.FC<{
  receiver: { receive: (listener: (e: InspectorEvent) => void) => void };
  onEvent: (event: {
    event: SCXML.Event<EventObject>;
    service: string;
  }) => void;
}> = ({ receiver, onEvent }) => {
  const [state, send, service] = useMachine(inspectorMachine);

  React.useEffect(() => {
    const dispose = receiver.receive((event) => {
      console.log("received", event);
      if (event.state) {
        const state = JSON.parse(event.state);
      }
      send(event);
    });

    return dispose;
  }, [receiver]);

  const currentService = state.context.service
    ? state.context.services[state.context.service]
    : undefined;

  const serviceEntries = Object.entries(state.context.services);

  // for displaying events
  const sortedEvents = flatten(
    Array.from(state.context.eventsMap.entries()).map(([dest, events]) => {
      return events;
    })
  ).sort((a, b) => a.timestamp - b.timestamp);

  const destinations = Array.from(state.context.eventsMap.keys());

  console.log(sortedEvents, destinations);

  return (
    <ServicesContext.Provider value={service}>
      <div data-xviz="inspector" data-xviz-view={state.context.view}>
        <header data-xviz="inspector-header">
          {serviceEntries.length > 0 && (
            <select
              onChange={(e) => {
                send({ type: "service.select", id: e.target.value });
              }}
              value={state.context.service}
              data-xviz="inspector-action"
            >
              {Object.keys(state.context.services).map((key) => {
                return (
                  <option data-xviz="service-link" key={key} value={key}>
                    {key}
                  </option>
                );
              })}
            </select>
          )}
        </header>

        {currentService ? (
          <ServiceDataContext.Provider value={currentService}>
            <div data-xviz="service" data-xviz-view={state.context.view}>
              <MachineViz
                machine={currentService.machine}
                state={currentService.state}
                mode="play"
                onEventTap={(data) => {
                  onEvent({
                    event: toSCXMLEvent(
                      { type: data.eventType },
                      { origin: currentService.state._sessionid! }
                    ),
                    service: currentService.id,
                  });
                }}
              />
              {/* <EventRecordsViz events={value.events} /> */}
              <div
                style={{
                  background: "white",
                  color: "black",
                  display: "grid",
                  gridTemplateColumns: `repeat(${destinations.length}, auto)`,
                  gridAutoRows: "min-content",
                }}
              >
                {destinations.map((d) => {
                  return <div key={d}>{d}</div>;
                })}
                {sortedEvents.map((event, i) => {
                  const originIndex = destinations.indexOf(event.origin);
                  const destinationIndex = destinations.indexOf(
                    event.destination
                  );

                  const min = Math.min(originIndex, destinationIndex);
                  const max = Math.max(originIndex, destinationIndex);

                  const dir = Math.sign(destinationIndex - originIndex);

                  return (
                    <div
                      key={i}
                      style={{
                        gridColumnStart: min + 1,
                        gridColumnEnd: max + 1,
                        gridRow: i + 1,
                        outline: "1px solid blue",
                      }}
                      data-xviz-dir={
                        dir === 1 ? "r" : dir === -1 ? "l" : "self"
                      }
                    >
                      <div>{event.name}</div>
                      <svg
                        width="100%"
                        height="14"
                        preserveAspectRatio="xMaxYMid slice"
                        viewBox="0 0 1400 14"
                      >
                        {dir === 1 ? (
                          <polygon points="1400,7 1385,1 1390,6 0,6 0,8 1390,8 1385,13 1400,7"></polygon>
                        ) : dir === -1 ? (
                          <svg
                            width="100%"
                            height="14"
                            preserveAspectRatio="xMinYMid slice"
                            viewBox="0 0 1400 14"
                          >
                            <polygon points="0,7 15,1 10,6 1400,6 1400,8 10,8 15,13 0,7"></polygon>
                          </svg>
                        ) : null}
                      </svg>
                    </div>
                  );
                })}
              </div>
              {/* <table style={{ background: 'white', color: 'black' }}>
                <thead>
                  <tr>
                    {destinations.map((destination) => {
                      return (
                        <th key={destination} style={{ textAlign: 'left' }}>
                          {destination}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sortedEvents.map((event, i) => {
                    const originIndex = destinations.indexOf(event.origin);
                    const destinationIndex = destinations.indexOf(
                      event.destination
                    );

                    const min = Math.min(originIndex, destinationIndex);
                    const max = Math.max(originIndex, destinationIndex);

                    return (
                      <tr key={i}>
                        {min > 0 && <td colSpan={min}></td>}
                        <td>{event.name}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table> */}
              <StateViz state={currentService.state} />
            </div>
          </ServiceDataContext.Provider>
        ) : (
          <Loader>Waiting for connection...</Loader>
        )}
      </div>
    </ServicesContext.Provider>
  );
};
