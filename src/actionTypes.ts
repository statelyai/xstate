const PREFIX = 'xstate';

// xstate-specific action types
export const start = `${PREFIX}.start`;
export const stop = `${PREFIX}.stop`;
export const raise = `${PREFIX}.raise`;
export const send = `${PREFIX}.send`;
export const cancel = `${PREFIX}.cancel`;
export const _null = `${PREFIX}.null`;
export { _null as null };
export const assign = `${PREFIX}.assign`;


