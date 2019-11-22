import React, {
  useMemo,
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
} from 'react';
import {
  StateMachine,
  Interpreter,
  StateNode,
  State,
  assign,
  createMachine,
  interpret,
} from 'xstate';
import { useService } from '@xstate/react';
import styled from 'styled-components';

import { produce, Draft, applyPatches } from 'immer';

function createState<TC>(ctx: TC, fn: (context: Draft<TC>) => string) {
  const patches = [] as any[];
  let state: string;

  produce(
    ctx,
    draft => {
      state = fn(draft);
    },
    patch => patches.push(patch)
  );

  return {
    target: state!,
    actions: assign(ctx => applyPatches(ctx, patches)),
  };
}

const machine = createMachine({
  initial: 'green',
  id: 'light',
  context: {
    count: 0,
  },
  states: {
    green: {
      after: {
        1000: createState({ count: 0 }, ctx => {
          ctx.count++;

          return 'yellow';
        }),
      },
    },
    yellow: {
      after: {
        500: 'red',
      },
    },
    red: {
      after: {
        2000: 'green',
      },
    },
  },
});

export function getChildren(machine: StateNode): StateNode[] {
  if (!machine.states) return [];

  return Object.keys(machine.states).map(key => {
    return machine.states[key];
  });
}

export const MachineViz: React.FC<{
  machine: StateMachine<any, any, any>;
}> = ({ machine }) => {
  return (
    <div>
      <pre>{JSON.stringify(machine.initialState, null, 2)}</pre>
    </div>
  );
};

const StateContext = createContext<State<any, any>>({} as any);

const StyledStateNodeViz = styled.div`
  border: 1px solid black;
  margin-bottom: 1rem;
  display: inline-block;

  &[data-type='atomic'][data-active] {
    background: blue;
    color: white;
  }
`;

const StyledStateNodeChildrenViz = styled.div`
  display: grid;
  padding: 1rem;
  grid-column-gap: 1rem;
  grid-row-gap: 1rem;
  grid-template-columns: repeat(3, auto);
  grid-template-rows: auto;
`;

const StateNodeViz: React.FC<{
  stateNode: StateNode<any, any>;
}> = ({ stateNode }) => {
  const childNodes = useMemo(() => {
    return getChildren(stateNode);
  }, []);
  const state = useContext(StateContext);
  const active = state.configuration.includes(stateNode);

  return (
    <StyledStateNodeViz
      data-active={active || undefined}
      // data-type={stateNode.type}
    >
      <header>{stateNode.key}</header>
      <StyledStateNodeChildrenViz>
        {childNodes.map(childNode => {
          return <StateNodeViz stateNode={childNode} key={childNode.id} />;
        })}
      </StyledStateNodeChildrenViz>
    </StyledStateNodeViz>
  );
};

export const ServiceViz: React.FC<{
  service: Interpreter<any, any>;
}> = ({ service }) => {
  const [state] = useService(interpret(machine).start());

  console.log(state);

  return (
    <StateContext.Provider value={state}>
      <StateNodeViz stateNode={service.machine} />
    </StateContext.Provider>
  );
};
