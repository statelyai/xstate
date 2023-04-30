// import { createMachine } from '../src/index.ts';

// // this stopped working in TS 5.0
// // https://github.com/microsoft/TypeScript/issues/53436

// describe('matches', () => {
//   it('should allow matches to be called multiple times in a single branch of code', () => {
//     const machine = createMachine<{ count: number }>({
//       initial: 'a',
//       states: { a: {} }
//     });
//     const state = machine.initialState;

//     if (state.matches('idle')) {
//       ((_accept: number) => {})(state.context.count);
//       // @ts-expect-error
//       ((_accept: string) => {})(state.context.count);
//     } else if (state.matches('latest')) {
//       ((_accept: number) => {})(state.context.count);
//       // @ts-expect-error
//       ((_accept: string) => {})(state.context.count);
//     }
//   });
// });
