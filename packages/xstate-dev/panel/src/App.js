import React, { useState, useRef } from 'react';
import { Machine } from 'xstate';
import styled from 'styled-components';
import { useEffect } from 'react';
import { StateNodeViz } from './StateNodeViz';
import { StateViz } from './StateViz';
import { getEdges } from './utils';
import { EdgeViz } from './EdgeViz';
import { tracker } from './tracker';

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
  const listeners = new Set();

  function getInitialServices() {
    services = {};
    chrome.devtools.inspectedWindow.eval(
      `Object.keys(window.__XSTATE__.services)`,
      keys => {
        keys.forEach(key => {
          chrome.devtools.inspectedWindow.eval(
            `JSON.stringify(window.__XSTATE__.services['${key}'])`,
            result => {
              services[key] = JSON.parse(result);
              update();
            }
          );
        });
      }
    );
  }

  getInitialServices();

  backgroundPort.onMessage.addListener(message => {
    if (message.name === 'service') {
      services[message.data.sessionId] = {
        machine: message.data.machine,
        state: undefined
      };
      update();
    } else if (message.name === 'state') {
      const state = JSON.parse(message.data.state);

      services[state._sessionid].state = state;
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
  console.log(message);
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

  > * {
    overflow: scroll;
  }
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

  console.log('EDGES', edges);

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

          console.log(serial);

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

function App() {
  const [services, setServices] = useState({});
  const [currentService, setCurrentService] = useState(null);
  const serviceKeys = Object.keys(services);

  const selectedService = currentService ? services[currentService] : null;

  useEffect(() => {
    createPort().subscribe(s => {
      setServices(s);
    });
  }, []);

  useEffect(() => {
    if (serviceKeys.length && !currentService) {
      setCurrentService(serviceKeys[0]);
    }
  }, [serviceKeys]);

  return (
    <StyledApp>
      <select
        value={currentService}
        onChange={e => setCurrentService(e.target.value)}
      >
        <option>Select a service</option>
        {serviceKeys.map(serviceKey => {
          return <option key={serviceKey}>{serviceKey}</option>;
        })}
      </select>
      {selectedService && (
        <>
          <MachineViz key={currentService} selectedService={selectedService} />
          <StateViz state={selectedService.state} />
        </>
      )}
    </StyledApp>
  );
}

export default App;
