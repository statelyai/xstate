export type Prop<T, K> = K extends keyof T ? T[K] : never;

export type MaybeLazy<T> = T | (() => T);
