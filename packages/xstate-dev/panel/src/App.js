import React, { useState } from 'react';
import { Machine } from 'xstate';
import styled from 'styled-components';
import { useEffect } from 'react';
import { StateNodeViz } from './StateNodeViz';
import { StateViz } from './StateViz';

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
      console.log('registering', message.data);

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

export const StyledStateNodeEvents = styled.div``;

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
          <StateNodeViz
            key={currentService}
            stateNode={Machine(selectedService.machine)}
            state={selectedService.state}
          ></StateNodeViz>
          <StateViz state={selectedService.state} />
        </>
      )}
    </StyledApp>
  );
}

export default App;
