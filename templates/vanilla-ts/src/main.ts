import './style.css';
import { feedbackMachine } from './feedbackMachine';
import {
  AnyMachineSnapshot,
  __unsafe_getAllOwnEventDescriptors,
  createActor
} from 'xstate';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <h1>XState TypeScript template</h1>
    
    <p>
      Open the console to see the state transition updates from <code>feedbackMachine</code>.
    </p>
    <p>
      You can send events in the console via <code>feedbackActor.send({ type: 'someEvent' })</code>.
    </p>
    <p>
      <a href="https://stately.ai/docs">XState documentation</a>
    </p>
  </div>
`;

function getNextTransitions(state: AnyMachineSnapshot) {
  return state._nodes.flatMap((node) => [...node.transitions.values()]).flat(1);
}

const actor = createActor(feedbackMachine);

(window as any).feedbackActor = actor;

actor.subscribe((state) => {
  console.group('State update');
  console.log('%cState value:', 'background-color: #056dff', state.value);
  console.log('%cState:', 'background-color: #056dff', state);
  console.groupCollapsed('%cNext events:', 'background-color: #056dff');
  console.log(
    getNextTransitions(state)
      .map((t) => {
        return `feedbackActor.send({ type: '${t.eventType}' })`;
      })
      .join('\n\n')
  );
  console.groupEnd();
  console.groupEnd();
});

actor.start();
