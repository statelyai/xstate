import { setTimeout as delay } from 'node:timers/promises';
import { createMachine, createAsyncLogic, types } from 'xstate';

type Measurement = { value: number };
export type Vitals = {
  tirePressure: Measurement | null;
  oilPressure: Measurement | null;
  coolantLevel: Measurement | null;
  battery: Measurement | null;
};
function check(name: string, milliseconds: number) {
  return createAsyncLogic({
    schemas: { output: types<Measurement>() },
    run: async ({ signal }) => {
      console.log('Starting', name);
      await delay(milliseconds, undefined, { signal });
      console.log('Completed', name);
      return { value: 100 };
    }
  });
}
export const vitalsWorkflow = createMachine({
  schemas: { context: types<Vitals>(), output: types<Vitals>() },
  actors: {
    checkTirePressure: check('checkTirePressure', 1000),
    checkOilPressure: check('checkOilPressure', 1500),
    checkCoolantLevel: check('checkCoolantLevel', 500),
    checkBattery: check('checkBattery', 1200)
  },
  id: 'vitalscheck',
  context: {
    tirePressure: null,
    oilPressure: null,
    coolantLevel: null,
    battery: null
  },
  output: ({ context }) => context,
  initial: 'CheckVitals',
  states: {
    CheckVitals: {
      invoke: [
        {
          src: 'checkTirePressure',
          onDone: ({ context, event }) => ({
            context: { ...context, tirePressure: event.output }
          })
        },
        {
          src: 'checkOilPressure',
          onDone: ({ context, event }) => ({
            context: { ...context, oilPressure: event.output }
          })
        },
        {
          src: 'checkCoolantLevel',
          onDone: ({ context, event }) => ({
            context: { ...context, coolantLevel: event.output }
          })
        },
        {
          src: 'checkBattery',
          onDone: ({ context, event }) => ({
            context: { ...context, battery: event.output }
          })
        }
      ],
      always: ({ context }) =>
        Object.values(context).every((value) => value !== null)
          ? { target: 'VitalsChecked' }
          : undefined
    },
    VitalsChecked: { type: 'final' }
  }
});

export const workflow = createMachine({
  schemas: {
    context: types<{ lastReadings: Vitals | null }>(),
    events: { CarTurnedOnEvent: types<{}>(), CarTurnedOffEvent: types<{}>() }
  },
  actors: { vitalscheck: vitalsWorkflow },
  actions: {
    report: (vitals: Vitals) => console.log('Done with vitals check', vitals),
    carOff: () => console.log('Car turned off')
  },
  context: { lastReadings: null },
  id: 'checkcarvitals',
  initial: 'WhenCarIsOn',
  states: {
    WhenCarIsOn: { on: { CarTurnedOnEvent: { target: 'DoCarVitalChecks' } } },
    DoCarVitalChecks: {
      invoke: {
        src: 'vitalscheck',
        onDone: ({ context, event, actions }, enq) => {
          enq(actions.report, event.output);
          return {
            target: 'CheckContinueVitalChecks',
            context: { ...context, lastReadings: event.output }
          };
        }
      }
    },
    CheckContinueVitalChecks: {
      after: { 1000: { target: 'DoCarVitalChecks' } }
    }
  },
  on: {
    CarTurnedOffEvent: ({ actions }, enq) => {
      enq(actions.carOff);
      return { target: '.WhenCarIsOn' };
    }
  }
});
