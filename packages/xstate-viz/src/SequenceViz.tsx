// @ts-nocheck
import * as React from 'react';
import { useReducer, useCallback } from 'react';
import { Interpreter, Actor, createMachine, assign, SCXML } from 'xstate';
import { MachineViz } from './MachineViz';

function getChildActors(service: Interpreter<any, any>): Actor<any, any>[] {
  const actors: Actor<any, any>[] = [];

  service.children.forEach((child) => {
    actors.push(child, ...getChildActors(child as Interpreter<any, any>));
  });

  return actors;
}

const eventsMachine = createMachine<any>({
  id: 'events',
  initial: 'active',
  context: {
    events: []
  },
  states: {
    active: {
      on: {
        EMITTED: {
          actions: assign({
            events: (_, e) => e.event
          })
        }
      }
    }
  }
});

interface SequenceState {
  events: Array<SCXML.Event<any>>;
  actorIds: Set<string>;
}

type SequenceEvent =
  | {
      type: 'EMITTED';
      event: SCXML.Event<any>;
    }
  | {
      type: 'CLEAR';
    };

const eventsReducer = (state: SequenceState, event: SequenceEvent) => {
  if (event.type === 'EMITTED') {
    state.actorIds.add(event.event.origin || '--');
    return {
      ...state,
      events: [...state.events, event.event]
    };
  }

  if (event.type === 'CLEAR') {
    return {
      ...state,
      events: []
    };
  }

  return state;
};

export function SequenceViz({ service }: { service: Interpreter<any, any> }) {
  const [state, dispatch] = useReducer(eventsReducer, {
    events: [],
    actorIds: new Set([service.id])
  });

  React.useEffect(() => {
    const sub = service.subscribe((state) => {
      dispatch({ type: 'EMITTED', event: state._event });
    });
    return sub.unsubscribe;
  }, [service]);

  console.log(Array.from(service.children.values()).map((x) => x.sessionId));

  const activeActorIds = Array.from(service.children.values()).map(
    (x) => x.sessionId
  );

  const actorIds = Array.from(state.actorIds);

  return (
    <table data-xviz="sequence">
      <thead>
        <tr>
          {Array.from(actorIds).map((actorId) => {
            return <th key={actorId}>{actorId}</th>;
          })}
        </tr>
      </thead>
      <tbody>
        {state.events.map((event, i) => {
          const startIndex = 0;
          const endIndex = actorIds.findIndex(
            (actorId) => actorId === event.origin
          );
          return (
            <tr>
              <td></td>
              <td colSpan={endIndex - startIndex}>
                {event.name} ({event.origin})
              </td>
            </tr>
          );
        })}
      </tbody>
      {/* {state.events.map((event, i) => {
        return <div key={i}>{JSON.stringify(event)}</div>;
      })} */}
    </table>
  );
}
