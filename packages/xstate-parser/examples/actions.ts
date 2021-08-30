import { actions, createMachine } from 'xstate';

const {
  after,
  assign,
  cancel,
  done,
  escalate,
  forwardTo,
  log,
  pure,
  raise,
  respond,
  send,
  sendParent,
  sendUpdate,
  start,
  stop
} = actions;

export const machine = createMachine({
  entry: [
    after(400),
    assign({}),
    cancel(''),
    done(''),
    escalate(''),
    forwardTo(''),
    log(),
    pure(() => {
      return [];
    }),
    raise(''),
    respond(''),
    send(''),
    sendParent(''),
    sendUpdate(),
    start(''),
    stop('')
  ]
});
