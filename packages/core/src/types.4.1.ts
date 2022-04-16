export type IndexByType<T extends { type: string }> = {
  [E in T as E['type']]: E;
};
