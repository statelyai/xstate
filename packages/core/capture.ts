import { ActionObject, EventObject } from './src';
import { raise, log, send, assign, pure } from './src/actions';

function createCapturer(
  captured: ActionObject<any, any>[],
  fn: (...args: any[]) => ActionObject<any, any>
) {
  return (...args: any[]) => {
    captured.push(fn(...args));
  };
}

export function capture<TContext, TEvent extends EventObject>(
  fn: (capturers: any) => void
) {
  const captured: ActionObject<TContext, TEvent>[] = [];

  const capturers = {
    assign: createCapturer(captured, assign),
    send: createCapturer(captured, send),
    raise: createCapturer(captured, raise),
    log: createCapturer(captured, log)
  };

  fn(capturers);

  return pure(() => captured);
}
