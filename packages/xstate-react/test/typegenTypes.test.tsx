import { render } from '@testing-library/react';
import { ActorRefFrom, assign, createMachine, TypegenMeta } from 'xstate';
import { createActorContext, useActorRef, useMachine } from '../src/index.ts';

describe('useActorRef', () => {
  it('should handle multiple state.matches when passed TypegenMeta', () => {
    interface TypesMeta extends TypegenMeta {
      matchesStates: 'a' | 'b';
      missingImplementations: {
        actions: never;
        actors: never;
        guards: never;
        delays: never;
      };
    }

    const machine = createMachine({
      types: { typegen: {} as TypesMeta }
    });

    () => {
      const [state] = useMachine(machine, {});
      if (state.matches('a')) {
        return <div>a</div>;
      }

      // matches should still be defined
      if (state.matches('b')) {
        return <div>b</div>;
      }
    };
  });

  it('should handle multiple state.matches when NOT passed TypegenMeta', () => {
    const machine = createMachine({});

    () => {
      const [state] = useMachine(machine, {});
      if (state.matches('a')) {
        return <div>a</div>;
      }

      // matches should still be defined
      if (state.matches('b')) {
        return <div>b</div>;
      }
    };
  });
});

describe('createActorContext', () => {});
