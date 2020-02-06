import React, { useState, useRef } from 'react';
import { Machine } from 'xstate';
import styled from 'styled-components';
import { useEffect } from 'react';
import { StateNodeViz } from './StateNodeViz';
import StateTab from './components/StateTab';
import { getEdges } from './utils';
import { EdgeViz } from './EdgeViz';
import { tracker } from './tracker';
import EventsLog from './EventsLog';
import TabButton from './components/TabButton';
import TabButtonsGroup from './components/TabButtonsGroup';

const chrome = window.chrome;

// Chrome stuff
const tabId = chrome.devtools.inspectedWindow.tabId.toString();
const backgroundPort = chrome.runtime.connect({ name: tabId });

function createPort() {

  let services = {};
  let listeners = new Set();

  backgroundPort.onMessage.addListener(message => {    
    if (message && message.source === 'xstate-devtools' && message.data) {
      console.log('App.js received: message:', message)
      console.log('App.js before update: services:', services)
      if (message.data.type === "retrievingInitialServices") {
        services = JSON.parse(message.data.services)
        update()
      } else if (message.data.type === 'stateUpdate') {
        const {state, eventData, sessionId} = message.data
        if (Object.keys(services).includes(sessionId)) {
          const parsedEventData = JSON.parse(eventData)
          console.log('injected->devtools diff:', Date.now() - parsedEventData.time)
          services[sessionId].eventsLog.push({
            eventData: parsedEventData
          })
          services[sessionId].statesAfterEvent.push(JSON.parse(state))
          update()
        }
      } else if (message.data.type === 'registerService') {
        const {machine, state, sessionId} = message.data
        if (!Object.keys(services).includes(sessionId)) {
          services[sessionId] = {
            state: JSON.parse(state),
            machine: JSON.parse(machine),
            eventsLog: [],
            statesAfterEvent: []  
          }
          update()
        }
      }
      console.log('App.js after updatee: services:', services)
    }
  });

  function update() {
    listeners.forEach(listener => {
      listener({ ...services });
    });
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      listener({ ...services });
    }
  };
}

// End chrome stuff

export function getChildren(stateNode) {
  if (!stateNode.states) return [];

  return Object.keys(stateNode.states).map(key => {
    return stateNode.states[key];
  });
}

export const StyledStateNodeViz = styled.div`
  display: inline-grid;
  grid-template-columns: auto auto;
  grid-column-gap: 0.5rem;
  opacity: 0.5;
  transition: all 0.3s ease-out;
  margin: 1rem;

  &[data-active] {
    opacity: 1;
  }
`;

export const StyledStateNodeState = styled.div`
  border: 2px solid var(--color-fg, black);
  padding: 0.5rem;
  border-radius: var(--border-radius);
  align-self: flex-start;
`;

export const StyledStateNodeEvents = styled.div`
  display: flex;
  flex-direction: column;
`;

export const StyledStateNodeChildrenViz = styled.div`
  display: flex;
  padding: 1rem;
  flex-wrap: wrap;
`;

const StyledApp = styled.main`
  --color-fg: ${chrome.devtools.panels.themeName === 'dark' ? 'white' : 'black'}
  --border-radius: .5rem;
  display: grid;
  grid-template-rows: 2rem 1fr 1fr;
  grid-template-columns: 100%;
  color: var(--color-fg);
  height: 100%;
  max-height: 100%;

  display: flex;
  flex-direction: column;
`;

export function serializeEdge(edge) {
  const cond = edge.cond ? `[${edge.cond.toString().replace(/\n/g, '')}]` : '';
  return `${edge.source.id}:${edge.eventType}${cond}->${
    edge.target ? edge.target.map(t => t.id).join('|') : edge.source.id
  }`;
}

const MachineViz = ({ selectedService }) => {
  const svgRef = useRef(null);
  const state = selectedService.state;
  const edges = getEdges(Machine(selectedService.machine));

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    tracker.update('svg', svgRef.current);
  }, []);

  return (
    <section>
      <StateNodeViz
        stateNode={Machine(selectedService.machine)}
        state={selectedService.state}
      ></StateNodeViz>
      <svg
        width="100%"
        height="100%"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          // @ts-ignore
          '--color': 'gray',
          overflow: 'visible',
          pointerEvents: 'none'
        }}
        ref={svgRef}
      >
        <defs>
          <marker
            id="marker"
            markerWidth="4"
            markerHeight="4"
            refX="2"
            refY="2"
            markerUnits="strokeWidth"
            orient="auto"
          >
            <path d="M0,0 L0,4 L4,2 z" fill="var(--color-edge)" />
          </marker>
          <marker
            id="marker-preview"
            markerWidth="4"
            markerHeight="4"
            refX="2"
            refY="2"
            markerUnits="strokeWidth"
            orient="auto"
          >
            <path d="M0,0 L0,4 L4,2 z" fill="var(--color-edge-active)" />
          </marker>
        </defs>
        {edges.map(edge => {
          const serial = serializeEdge(edge);

          // const svgRect = this.svgRef.current.getBoundingClientRect();

          return <EdgeViz edge={edge} key={serial} />;

          // return (
          //   <Edge
          //     key={serial}
          //     svg={svgRef.current}
          //     edge={edge}
          //     preview={
          //       edge.eventType === state.previewEvent &&
          //       current.matches(edge.source.path.join('.')) &&
          //       !!state.preview &&
          //       state.preview.matches(
          //         edge.target
          //           ? edge.target[0].path.join('.')
          //           : edge.source.path.join('.')
          //       )
          //     }
          //   />
          // );
        })}
      </svg>
    </section>
  );
};



const views = {
  GRAPH: 'graph',
  STATE: 'state',
  EVENTS_LOG: 'eventsLog'
}

const Select = styled.select`
    background: none;
    height: 100%;
    border: 1px solid black;
    width: 100%;
`

const TopBar = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 2px;

  & > * + * {
    margin-left: 4px;
  }
`

function App() {
  const [services, setServices] = useState({});
  const [currentServiceId, setCurrentServiceId] = useState(null);
  const [activeView, setActiveView] = useState(views.GRAPH);
  const serviceIds = Object.keys(services);

  const selectedService = currentServiceId ? services[currentServiceId] : null;

  useEffect(() => {
    createPort().subscribe(s => {
      setServices(s);
    });
  }, []);

  useEffect(() => {
    if (serviceIds.length && !currentServiceId) {
      setCurrentServiceId(serviceIds[0]);
    }
  }, [serviceIds]);

  return (
    <StyledApp>
      <TopBar>
        <TabButtonsGroup>
          <TabButton isActive={activeView === views.GRAPH} onClick={() => setActiveView(views.GRAPH)}>Graph</TabButton>
          <TabButton isActive={activeView === views.STATE} onClick={() => setActiveView(views.STATE)}>State</TabButton>
          <TabButton isActive={activeView === views.EVENTS_LOG} onClick={() => setActiveView(views.EVENTS_LOG)}>Events Log</TabButton>
        </TabButtonsGroup>
        <Select
          value={currentServiceId === null ? '' : currentServiceId}
          onChange={e => setCurrentServiceId(e.target.value)}
        >
          <option>Select a service</option>
          {serviceIds.map(serviceId => {
          return <option key={serviceId}>{services[serviceId].machine.id} ({serviceId})</option>;
          })}
        </Select>
      </TopBar>
      {selectedService && (
        <div style={{border: '1px solid black', height: '100%'}}>
          {activeView === views.GRAPH && <MachineViz key={currentServiceId} selectedService={selectedService} />}
          {activeView === views.STATE && <StateTab finiteState={selectedService.state && selectedService.state.value} extendedState={selectedService.state && selectedService.state.context}/>}
          {activeView === views.EVENTS_LOG && selectedService && <EventsLog eventsLog={selectedService.eventsLog} statesAfterEvent={selectedService.statesAfterEvent} machine={Machine(selectedService.machine)}/>}
        </div>
      )}
    </StyledApp>
  );
}

export default App;
