import { createContext, useContext } from 'react';
import { AnyActorRef, EmittedFrom } from 'xstate';
import { useActor } from './useActor';
import { useSelector } from './useSelector';

/**
 * Creates and returns React hooks that can be used in any component:
 * - `obj.useActor()` - hook returns the same tuple as `useActor(actorRef)`
 * - `obj.useSelector(selector, compare?)` - hook returns the same selected value as `useSelector(actorRef, selector, compare)`
 *
 * It also returns two useful values:
 * - `obj.actorRef` - the original `actorRef`
 * - `obj.Provider` - can be used to provide a different `actorRef` value
 *
 * @example
 *
 * ```jsx
 * const authService = interpret(authMachine).start();
 *
 * const auth = createHooks(authService);
 *
 * // ...
 *
 * const Component = () => {
 *   const [state, send] = auth.useActor();
 *
 *   const isLoggedIn = auth.useSelector(state => state.hasTag('authenticated'));
 *
 *   // ...
 * }
 * ```
 * @param actorRef The actor ref (such as an invoked machine) to create hooks from
 * @returns an object containing:
 * - `.useActor()`
 * - `.useSelector(selector, compare?)`
 * - `.actorRef`
 * - `.Provider`
 */
export function createHooks<TActorRef extends AnyActorRef>(
  actorRef: TActorRef
): {
  actorRef: TActorRef;
  /**
   * The React context provider component, used for overriding the default `actorRef`.
   *
   * @example
   * ```jsx
   * const App = () => {
   *   return <obj.Provider value={someOtherActorRef}>
   *     // ...
   *   </obj.Provider>
   * };
   */
  Provider: React.Provider<TActorRef>;
  /**
   * Returns a tuple of `[snapshot, send]`:
   * - The `snapshot` is the latest observed value from the `actorRef`
   * - The `send(event)` function sends an event to the `actorRef`
   *
   * @example
   * ```js
   * const [state, send] = obj.useActor();
   *
   * return <button onClick={() => send({ type: 'EVENT' })} />
   * ```
   */
  useActor(): [EmittedFrom<TActorRef>, TActorRef['send']];
  /**
   * Selects a value from the `actorRef` using the `selector` and an optional `comparator`
   *
   * @example
   * ```js
   * const values = obj.useSelector(state => {
   *   return state.context.values;
   * }, (a, b) => shallowCompare(a, b));
   *
   * const count = obj.useSelector(state => {
   *   return state.context.count;
   * });
   * ```
   */
  useSelector: <T>(
    selector: (snapshot: EmittedFrom<TActorRef>) => T,
    comparator?: ((a: T, b: T) => boolean) | undefined
  ) => T;
} {
  const actorContext = createContext(actorRef);

  return {
    actorRef,
    Provider: actorContext.Provider,
    useActor: () => {
      const actorRef = useContext(actorContext);
      return useActor(actorRef);
    },
    useSelector: <T>(
      selector: (snapshot: EmittedFrom<TActorRef>) => T,
      comparator?: (a: T, b: T) => boolean
    ) => {
      const actorRef = useContext(actorContext);
      return useSelector(actorRef, selector, comparator);
    }
  };
}
