import './style.css';
import { feedbackMachine } from './feedbackMachine';
import { interpret } from 'xstate';

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

const actor = interpret(feedbackMachine).start();

(window as any).feedbackActor = actor;

actor.subscribe((state) => {
  console.group('State update');
  console.log('%cState value:', 'background-color: #056dff', state.value);
  console.log('%cState:', 'background-color: #056dff', state);
  console.groupCollapsed('%cNext events:', 'background-color: #056dff');
  console.log(
    state.nextEvents
      .map((eventType) => {
        return `feedbackActor.send({ type: '${eventType}' })`;
      })
      .join('\n\n')
  );
  console.groupEnd();
  console.groupEnd();
});
