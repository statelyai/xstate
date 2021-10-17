const setupXStateViz = async () => {
  const { inspect } = require('@xstate/inspect/lib/server');
  const WebSocket = require('ws');
  const inspector = inspect({
      server: new WebSocket.Server({
          port: 8888,
      }),
  });

  console.log(
      'XSTATE Inspector : Now Open https://statecharts.io/inspect?server=localhost:8888 in CHROME!',
  );
  return ()=>{
    inspector.disconnect();
  };
};

const startXstateMachine = machine =>
  new Promise(resolve => {
      const interpret = require('xstate').interpret;

      const machineService = interpret(machine, {
          devTools: true,
      })
          .onTransition(s => {
              console.log(
                  'Transition',
                  JSON.stringify(
                      { event: s.event, state: s.value, context: s.context },
                      null,
                      4,
                  ),
              );
              if (s.value === 'finished') {
                  resolve(true);
              }
          })
          .start();

      return machineService;
  });

(async () => {
  try {
      console.log('Starting machines..');

      const closeConnection = await setupXStateViz();

      const {counterMachine} = require('./counter.machine');
      await startXstateMachine(counterMachine);

      console.log('Exiting...');
      return closeConnection();
  } catch (msg) {
      console.log(msg);
  }
})();
