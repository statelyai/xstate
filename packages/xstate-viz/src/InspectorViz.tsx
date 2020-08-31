import React, { useEffect, useState } from "react";
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
import { SCXMLSequenceEvent, SequenceDiagramViz } from "./SequenceViz";
import { Tab, TabList, TabPanel, TabPanels, Tabs } from "@reach/tabs";
import { EventPanelViz } from "./EventPanelViz";
import { EventTapEvent } from "./machineVizMachine";
import { Resizable } from "./Resizable";

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
      sessionId: string;
      parent?: string;
      source?: string;
    }
  | {
      type: "service.stop";
      sessionId: string;
    }
  | {
      type: "service.state";
      state: string;
      sessionId: string;
    }
  | { type: "service.event"; event: string; sessionId: string }
  | {
      type: "service.select";
      sessionId: string;
    }
  | ViewUpdateEvent;

interface ServiceDataCtx {
  state: State<any, any>;
  machine: StateNode<any, any>;
  id: string;
  sessionId: string;
  parent?: string;
  source?: string;
  events: Array<SCXML.Event<any>>;
  status: "running" | "stopped";
}
interface InspectorCtx {
  services: Record<string, ServiceDataCtx>;
  service?: string;
  events: Array<SCXMLSequenceEvent>;
  eventsMap: Map<string, Array<SCXMLSequenceEvent>>;
  view: "graph" | "state";
}

const inspectorMachine = createMachine<InspectorCtx, InspectorEvent>({
  id: "inspector",
  context: {
    services: {},
    service: undefined,
    events: [],
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
            const serviceObject = ctx.services[e.sessionId];
            if (!serviceObject) {
              return;
            }

            if (e.state === undefined) {
              return;
            }

            serviceObject.state = parseState(e.state);
            serviceObject.events.unshift(serviceObject.state._event);

            const dest = serviceObject.state._sessionid;
            const origin = serviceObject.state._event.origin || dest;

            if (!ctx.eventsMap.get(origin)) {
              ctx.eventsMap.set(origin, []);
            }
            if (!ctx.eventsMap.get(dest)) {
              ctx.eventsMap.set(dest, []);
            }

            const originEvents = ctx.eventsMap.get(origin)!;

            const event = {
              ...serviceObject.state._event,
              timestamp: Date.now(),
              origin,
              dest,
            };

            originEvents.push(event);
            // ctx.events.push(event);

            if (!ctx.service) {
              ctx.service = e.sessionId;
            }
          }),
        },
        "service.event": {
          actions: assign((ctx, e) => {
            const serviceObject = ctx.services[e.sessionId];
            if (!serviceObject) {
              return;
            }

            const eventObject = JSON.parse(e.event) as SCXML.Event<any>;

            serviceObject.events.unshift(eventObject);

            const dest = serviceObject.sessionId;
            const origin =
              eventObject.name === "xstate.init"
                ? serviceObject.parent || dest
                : eventObject.origin || dest;

            if (!ctx.eventsMap.get(origin)) {
              ctx.eventsMap.set(origin, []);
            }
            if (!ctx.eventsMap.get(dest)) {
              ctx.eventsMap.set(dest, []);
            }

            const originEvents = ctx.eventsMap.get(origin)!;

            const event = {
              ...eventObject,
              timestamp: Date.now(),
              origin,
              dest,
            };

            originEvents.push(event);
            ctx.events.push(event);

            if (!ctx.service) {
              ctx.service = e.sessionId;
            }
          }),
        },
        "service.select": {
          actions: assign((ctx, e) => {
            console.log(e);
            ctx.service = e.sessionId;
          }),
        },
      },
    },
  },
  on: {
    "service.register": {
      actions: assign((ctx, e) => {
        ctx.services[e.sessionId] = {
          id: e.id,
          sessionId: e.sessionId,
          parent: e.parent,
          machine: createMachine(JSON.parse(e.machine)),
          state: parseState(e.state),
          source: e.source,
          events: [],
          status: "running",
        };

        if (!ctx.service) {
          ctx.service = e.sessionId;
        }
      }),
      target: ".inspecting",
    },
    "service.stop": {
      actions: assign((ctx, e) => {
        const serviceData = ctx.services[e.sessionId];
        if (!serviceData) {
          console.warn(
            `Service with session ID ${e.sessionId} doesn't exist; cannot be stopped.`
          );
        } else {
          serviceData.status = "stopped";
        }
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

const InspectorHeaderViz: React.FC<{
  services: Record<string, ServiceDataCtx>;
  service: string;
  onSelectService: (service: string) => void;
}> = ({ services, service, onSelectService }) => {
  const serviceEntries = Object.entries(services);

  return (
    <header data-xviz="inspector-header">
      <img src="/xstate.svg" data-xviz="logo" />
      {serviceEntries.length > 0 && (
        <select
          onChange={(e) => {
            onSelectService(e.target.value);
          }}
          value={service}
          data-xviz="inspector-action"
        >
          {Object.keys(services).map((key) => {
            return (
              <option data-xviz="service-link" key={key} value={key}>
                {key}
              </option>
            );
          })}
        </select>
      )}
    </header>
  );
};

export const InspectorViz: React.FC<{
  receiver: { receive: (listener: (e: InspectorEvent) => void) => void };
  onEvent: (event: {
    event: SCXML.Event<EventObject>;
    service: string;
  }) => void;
  panels?: Record<string, JSX.Element>;
}> = ({ receiver, onEvent, panels }) => {
  const [state, send, inspectorService] = useMachine(inspectorMachine);

  useEffect(() => {
    const dispose = receiver.receive((event) => {
      send(event);
    });

    return dispose;
  }, [receiver]);

  const currentService = state.context.service
    ? state.context.services[state.context.service]
    : undefined;

  // for displaying events
  const sortedEvents = state.context.events;

  const resolvedState = currentService?.machine.resolveState(
    currentService.state
  );

  return (
    <ServicesContext.Provider value={inspectorService}>
      <div data-xviz="inspector" data-xviz-view={state.context.view}>
        <InspectorHeaderViz
          services={state.context.services}
          service={state.context.service}
          onSelectService={(service) => {
            send({ type: "service.select", sessionId: service });
          }}
        />
        {currentService ? (
          <ServiceDataContext.Provider value={currentService}>
            <div data-xviz="service" data-xviz-view={state.context.view}>
              <MachineViz
                machine={currentService.machine}
                state={currentService.state}
                mode="play"
                onEventTap={(eventTapEvent) => {
                  onEvent({
                    event: toSCXMLEvent(
                      { type: eventTapEvent.eventType },
                      {
                        origin: currentService.state._sessionid,
                      }
                    ),
                    service: currentService.id,
                  });
                }}
              />
              <SequenceDiagramViz events={sortedEvents} />

              <Resizable data-xviz="service-sidebar">
                <Tabs defaultIndex={0}>
                  <TabList>
                    <Tab>State</Tab>
                    <Tab>Events</Tab>
                    {panels &&
                      Object.keys(panels).map((key) => {
                        return <Tab key={key}>{key}</Tab>;
                      })}
                  </TabList>
                  <TabPanels>
                    <TabPanel>
                      <StateViz state={currentService.state} />
                    </TabPanel>
                    <TabPanel>
                      <EventPanelViz
                        events={sortedEvents}
                        state={resolvedState}
                        onEvent={(eventObject) => {
                          onEvent({
                            event: toSCXMLEvent(eventObject, {
                              origin: currentService.state._sessionid,
                            }),
                            service: currentService.id,
                          });
                        }}
                      />
                    </TabPanel>
                    {panels &&
                      Object.values(panels).map((panel, i) => {
                        return <TabPanel key={i}>{panel}</TabPanel>;
                      })}
                  </TabPanels>
                </Tabs>
              </Resizable>
            </div>
          </ServiceDataContext.Provider>
        ) : (
          <Loader>Waiting for connection...</Loader>
        )}
      </div>
    </ServicesContext.Provider>
  );
};
