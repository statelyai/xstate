// oxlint-disable-next-line typescript/ban-ts-comment
// @ts-nocheck: loaded under xstate@5 by the verify child; typechecked as v6 here.
import { createMachine } from 'xstate';

export const first = createMachine({ id: 'first' });
export const second = createMachine({ id: 'second' });
