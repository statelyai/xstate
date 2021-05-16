import { createMachine, interpret } from 'xstate';

const fetchMachine = createMachine({
  initial: 'idle',
  states: {
    idle: {
      on: {
        FETCH: 'loading'
      }
    },
    loading: {
      invoke: {
        id: 'dogFetch',
        src: (context, event) =>
          fetch('https://dog.ceo/api/breeds/image/random').then((response) =>
            response.json()
          ),
        onDone: {
          target: 'success'
        },
        onError: {
          target: 'failure'
        }
      }
    },
    success: {
      on: {
        RETRY: 'loading'
      }
    },
    failure: {
      on: {
        RETRY: 'loading'
      }
    }
  }
});

const fetchService = interpret(fetchMachine)
  .onTransition((state) => {
    console.log(state);
  })
  .start();

fetchService.send('FETCH');
