import { Context, Effect } from 'effect';
import {
  createActor,
  type Actor,
  type ActorOptions,
  type AnyActorLogic,
  type RequiredActorOptionsKeys
} from 'xstate';
import { bindEffectHost, createEffectHost } from './internal.ts';
import type { RequirementsFrom } from './types.ts';

export function createEffectActor<TLogic extends AnyActorLogic>(
  logic: TLogic,
  options?: ActorOptions<TLogic> & {
    [K in RequiredActorOptionsKeys<TLogic>]: unknown;
  }
): Effect.Effect<Actor<TLogic>, never, RequirementsFrom<TLogic>> {
  return Effect.contextWith((context: Context.Context<any>) =>
    Effect.sync(() => {
      const actor = createActor(logic, options as any);
      bindEffectHost(actor, createEffectHost(context));
      actor.start();
      return actor;
    })
  ) as unknown as Effect.Effect<Actor<TLogic>, never, RequirementsFrom<TLogic>>;
}
