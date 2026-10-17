// Type-level plumbing shared by xstate's own types. Only the helpers that
// emitted declarations reference (`ConditionalRequired`, `IsNotNever`,
// `NonReducibleUnknown`) are re-exported from the package entry point.

/**
 * @remarks
 * `T | unknown` reduces to `unknown` and that can be problematic when it comes
 * to contextual typing. It especially is a problem when the union has a
 * function member, like here:
 *
 * ```ts
 * declare function test(
 *   cbOrVal: ((arg: number) => unknown) | unknown
 * ): void;
 * test((arg) => {}); // oops, implicit any
 * ```
 *
 * This type can be used to avoid this problem. This union represents the same
 * value space as `unknown`.
 *
 * Type-level plumbing, not for direct use. Exported only because emitted
 * declarations of inferred actor logic types (such as the input of
 * `createAsyncLogic(...)`) reference it; it may change without notice.
 * @experimental
 */
export type NonReducibleUnknown = {} | null | undefined;

export type AnyFunction = (...args: any[]) => any;

export type IsNever<T> = [T] extends [never] ? true : false;

/**
 * Type-level plumbing, not for direct use. Exported only because framework
 * adapter declarations reference it; it may change without notice.
 *
 * @experimental
 */
export type IsNotNever<T> = [T] extends [never] ? false : true;

export type Compute<A> = { [K in keyof A]: A[K] } & unknown;

export type Prop<T, K> = K extends keyof T ? T[K] : never;

export type Equals<A1, A2> =
  (<A>() => A extends A2 ? true : false) extends <A>() => A extends A1
    ? true
    : false
    ? true
    : false;

export type IsAny<T> = Equals<T, any>;

export type Cast<A, B> = A extends B ? A : B;

// @TODO: we can't use native `NoInfer` as we need those:
// https://github.com/microsoft/TypeScript/pull/61092
// https://github.com/microsoft/TypeScript/pull/61077
// but even with those fixes native NoInfer still doesn't work - further issues have to be reproduced and fixed
export type DoNotInfer<T> = [T][T extends any ? 0 : any];

export type LowInfer<T> = T & NonNullable<unknown>;

/**
 * Type-level plumbing, not for direct use. Exported only because framework
 * adapter declarations reference it; it may change without notice.
 *
 * @experimental
 */
export type ConditionalRequired<
  T,
  Condition extends boolean
> = Condition extends true ? Required<T> : T;

export type SingleOrArray<T> = readonly T[] | T;

export type HomomorphicOmit<T, K extends keyof any> = {
  [P in keyof T as Exclude<P, K>]: T[P];
};

export type TODO = any;
