import React, { useState, useRef } from 'react';
import { Machine } from 'xstate';
import styled from 'styled-components';
import { useEffect } from 'react';
import { StateNodeViz } from './StateNodeViz';
import { StateViz } from './StateViz';
import { getEdges } from './utils';
import { EdgeViz } from './EdgeViz';
import { tracker } from './tracker';
import EventsLog from './EventsLog';

const chrome = window.chrome;

// Chrome stuff
const tabId = chrome.devtools.inspectedWindow.tabId.toString();
const backgroundPort = chrome.runtime.connect({ name: tabId });

function createPort() {
  backgroundPort.postMessage({
    name: 'init',
    tabId: chrome.devtools.inspectedWindow.tabId
  });

  let services = {};
  let listeners = new Set();

  function getInitialServices() {
    services = {};

    chrome.devtools.inspectedWindow.eval(`JSON.stringify(window.__XSTATE__.services)`,
     (serializedContentScriptServices) => {
       const contentScriptServices = JSON.parse(serializedContentScriptServices)

      services = contentScriptServices
      update()
     })

  }

  getInitialServices();

  backgroundPort.onMessage.addListener(message => {
    console.log('App: message:', message)
    console.log('services:', services)
    
    if (message.name === 'state') {
      const state = JSON.parse(message.data.state);

      const eventData = JSON.parse(message.data.eventData);

      services[message.data.sessionId].state = state;
      
      const eventListing = {
        eventData: eventData,
        stateAfter: state
      }

      services[message.data.sessionId].eventsLog.push(eventListing)

      update();
    } else if (message.name === 'reloaded') {
      getInitialServices();
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

backgroundPort.onMessage.addListener(message => {
});
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

const ViewButtonsGroup = styled.div`
  display: flex;
  border: 1px solid black;
  padding: 4px;
  height: 100%;

  & > button + button {
    margin-left: 4px;
  }
`

const views = {
  GRAPH: 'graph',
  EXTENDED_STATE: 'extendedState',
  EVENTS_LOG: 'eventsLog'
}

const Button = styled.button`
  background: transparent;
  border: 1px solid black;
  border-radius: 8px;
  white-space: nowrap;
  cursor: pointer;
  outline: none;

  background-color: ${(props) => props.isActive ? 'skyblue' : 'rgba(0,0,0,0.1);'};
`

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

  console.log('App: services:', services)

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
        <ViewButtonsGroup style={{display: 'flex', border: '1px solid black'}}>
          <Button isActive={activeView === views.GRAPH} onClick={() => setActiveView(views.GRAPH)}>Graph</Button>
          <Button isActive={activeView === views.EXTENDED_STATE} onClick={() => setActiveView(views.EXTENDED_STATE)}>Extended State</Button>
          <Button isActive={activeView === views.EVENTS_LOG} onClick={() => setActiveView(views.EVENTS_LOG)}>Events Log</Button>
        </ViewButtonsGroup>
        <Select
          value={currentServiceId === null ? '' : currentServiceId}
          onChange={e => setCurrentServiceId(e.target.value)}
        >
          <option>Select a service</option>
          {serviceIds.map(serviceKey => {
            return <option key={serviceKey}>{serviceKey}</option>;
          })}
        </Select>
      </TopBar>
      {selectedService && (
        <div style={{border: '1px solid black', height: '100%'}}>
          {activeView === views.GRAPH && <MachineViz key={currentServiceId} selectedService={selectedService} />}
          {activeView === views.EXTENDED_STATE && <StateViz state={selectedService.state} />}
          {activeView === views.EVENTS_LOG && selectedService && <EventsLog eventsLog={selectedService.eventsLog} machine={Machine(selectedService.machine)}/>}
        </div>
      )}
    </StyledApp>
  );
}

export default App;
