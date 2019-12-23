import React, {
  useMemo,
  createContext,
  useContext,
  useRef,
  useState
} from 'react';
import JSONTree from 'react-json-tree';
import {
  StateMachine,
  Interpreter,
  StateNode,
  State,
  interpret,
  Machine
} from 'xstate';
import { useService } from '@xstate/react';
import styled from 'styled-components';
import { useEffect } from 'react';
import { getEdges } from './utils';

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

// export const StateNodeViz = ({ machine: stateNode, children = null }) => {
//   const childNodes = getChildren(stateNode);

//   return (
//     <div>
//       {childNodes.map(child => {
//         return <div key={child.id}>{child.id}</div>;
//       })}
//       {children}
//     </div>
//   );
// };

const StyledStateNodeViz = styled.div`
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

const StyledStateNodeState = styled.div`
  border: 2px solid var(--color-fg, black);
  padding: 0.5rem;
  border-radius: var(--border-radius);
  align-self: flex-start;
`;

const StyledStateNodeEvents = styled.div``;

const StyledStateNodeChildrenViz = styled.div`
  display: flex;
  padding: 1rem;
  flex-wrap: wrap;
`;

const EdgeViz = ({ edge }) => {
  return (
    <div>
      <strong>{edge.eventType}</strong>
      {edge.actions.map((action, i) => {
        return <small key={i}>{action.type}</small>;
      })}
    </div>
  );
};

const StateNodeViz = ({ stateNode, state }) => {
  console.log(stateNode, state);
  const childNodes = useMemo(() => {
    return getChildren(stateNode);
  }, []);
  const resolvedState = stateNode.machine.resolveState(state);
  const active = resolvedState.configuration.includes(stateNode);

  const edges = getEdges(stateNode, { depth: 0 });

  console.log(edges);

  return (
    <StyledStateNodeViz
      data-active={active || undefined}
      data-type={stateNode.type}
    >
      <StyledStateNodeState>
        <header>{stateNode.key}</header>
        {!!childNodes.length && (
          <StyledStateNodeChildrenViz>
            {childNodes.map(childNode => {
              return (
                <StateNodeViz
                  stateNode={childNode}
                  state={state}
                  key={childNode.id}
                />
              );
            })}
          </StyledStateNodeChildrenViz>
        )}
      </StyledStateNodeState>
      <StyledStateNodeEvents>
        {edges.map(edge => {
          return <EdgeViz edge={edge} />;
        })}
      </StyledStateNodeEvents>
    </StyledStateNodeViz>
  );
};

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
          <pre>
            {selectedService.state && (
              <JSONTree data={selectedService.state.context} hideRoot={true} />
            )}
          </pre>
        </>
      )}
    </StyledApp>
  );
}

export default App;
