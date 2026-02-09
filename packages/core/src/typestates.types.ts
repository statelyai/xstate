import { StandardSchemaV1 } from './schema.types';
import { MachineContext } from './types';

// Typestates
export interface TypeStateSchema {
  context?: StandardSchemaV1;
  states?: Record<string, TypeStateSchema>;
}

export type TypeStateSchemas = Record<string, TypeStateSchema>;

export interface TypeState {
  context?: MachineContext;
  states?: Record<string, TypeState>;
}

export interface TypeStates {
  [K in string]: TypeState;
}

export type TypeStateFromSchema<T extends TypeStateSchema> = (T extends {
  context: infer Ctx;
}
  ? Ctx extends StandardSchemaV1
    ? { context: StandardSchemaV1.InferOutput<Ctx> & MachineContext }
    : {}
  : {}) &
  (T extends { states: infer S }
    ? S extends Record<string, TypeStateSchema>
      ? { states: { [K in keyof S]: TypeStateFromSchema<S[K]> } }
      : {}
    : {});

export type TypeStateFromSchemas<T extends TypeStateSchemas> = {
  [K in keyof T]: TypeStateFromSchema<T[K]>;
};

/**
 * Turn a path like ["bar","baz"] into an XState-style nested state value: {
 * bar: "baz" }
 */
type ValueFromPath<P extends readonly string[]> = P extends readonly [
  infer A extends string
]
  ? A
  : P extends readonly [infer A extends string, ...infer R extends string[]]
    ? { [K in A]: ValueFromPath<R> }
    : never;

export type TargetAndContextFromTypeStates<T> = _TargetsFromStates<T, [], {}>;

/** Collect leaf+intermediate targets as { value, context } pairs */
export type TargetAndContextFrom<T> = T extends { states: infer S }
  ? _TargetsFromStates<S, [], {}>
  : never;

type _TargetsFromStates<S, PathAcc extends readonly string[], CtxAcc> =
  S extends Record<string, any>
    ? {
        [K in keyof S & string]:  // this node
          | _NodeResult<S[K], [...PathAcc, K], CtxAcc>
          // its children (if any)
          | _ChildrenResult<S[K], [...PathAcc, K], CtxAcc>;
      }[keyof S & string]
    : never;

type _NodeResult<Node, P extends readonly string[], CtxAcc> = Node extends {
  context: infer Ctx;
}
  ? { target: ValueFromPath<P>; context: CtxAcc & Ctx }
  : { target: ValueFromPath<P>; context?: CtxAcc };

type _ChildrenResult<Node, P extends readonly string[], CtxAcc> = Node extends {
  context?: infer Ctx;
  states: infer ChildStates;
}
  ? _TargetsFromStates<ChildStates, P, CtxAcc & (Ctx extends object ? Ctx : {})>
  : never;

/** Helper for your accept() example */
export type AcceptArg<T> = TargetAndContextFrom<T>;
declare function accept<T>(arg: AcceptArg<T>): void;

// ---------- Example ----------
type MyTypeStates = {
  states: {
    foo: { context: { foo: string } };
    bar: {
      context: { bar: number };
      states: {
        baz: { context: { baz: boolean } };
      };
    };
  };
};

type Test = TargetAndContextFrom<MyTypeStates>;

accept<MyTypeStates>({
  target: 'foo',
  context: { foo: 'hi' }
});

accept<MyTypeStates>({
  target: 'bar',
  context: { bar: 31 }
});

accept<MyTypeStates>({
  target: { bar: 'baz' },
  context: { bar: 31, baz: true }
});

// @ts-expect-error missing baz when value implies bar.baz
accept<MyTypeStates>({
  target: { bar: 'baz' },
  context: { bar: 31 }
});
