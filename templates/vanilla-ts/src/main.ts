import './style.css';
import { feedbackMachine } from './feedbackMachine';
import { createActor } from 'xstate';

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

const actor = createActor(feedbackMachine);

(window as any).feedbackActor = actor;

actor.subscribe((state) => {
  console.group('State update');
  console.log('%cState value:', 'background-color: #056dff', state.value);
  console.log('%cContext:', 'background-color: #056dff', state.context);
  console.groupEnd();
});

actor.start();
