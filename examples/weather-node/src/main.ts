#!/usr/bin/env vite-node --script
import { createMachine, interpret, fromPromise, waitFor } from 'xstate';
const args = process.argv.slice(2);
import fetch from 'node-fetch';

const weatherMachine = createMachine(
  {
    id: 'weather',
    initial: 'gettingGeoCoords',
    states: {
      gettingGeoCoords: {
        invoke: {
          src: 'getGeoCoords',
          input: ({ event }) => ({
            city: event.input.city
          }),
          onDone: {
            target: 'gettingWeather',
            actions: 'assignGeoCoords'
          }
        }
      },
      gettingWeather: {
        invoke: {
          src: 'getWeather',
          onDone: {
            target: 'success',
            actions: 'assignWeather'
          }
        }
      },
      success: {
        type: 'final'
      }
    }
  },
  {
    actors: {
      getGeoCoords: fromPromise(({ input }) => {
        return fetch(`https://geocode.xyz/${input.city}?json=1`).then((res) =>
          res.json()
        );
      }),
      getWeather: fromPromise(({ input }) => {
        return { temp: 42 };
      })
    }
  }
);

const actor = interpret(weatherMachine, {
  input: {
    // read from command line
    city: args[0]
  }
});

actor.subscribe((s) => {
  console.log(s.event, s.context);
});

console.log(args);

actor.start();

setTimeout(() => {}, 5000);
