const { createMachine, assign } = require('xstate');
const increment = context => context.count + 1;
const decrement = context => context.count - 1;

module.exports = {
    counterMachine: createMachine({
        initial: 'active',
        context: {
            count: 0,
        },
        states: {
            active: {
                on: {
                    INC: { actions: assign({ count: increment }) },
                    DEC: { actions: assign({ count: decrement }) },
                    Exit: { target: 'finished' },
                },
            },
            finished: {
                final: true,
            },
        },
    }),
};
