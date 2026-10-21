import {
  createMachine,
  setup,
  types,
  type ActorRefFrom,
  type ContextFrom,
  type SnapshotFrom
} from '../../../src/index.ts';
const plain = createMachine({
  schemas: { context: types<{ count: number }>() },
  context: { count: 0 }
});
const named = createMachine({
  id: 'counter',
  version: '1',
  schemas: { context: types<{ count: number }>() },
  context: { count: 0 }
});
const configured = setup({
  schemas: { context: types<{ count: number }>() }
}).createMachine({ id: 'counter', context: { count: 0 } });
declare const plainRef: ActorRefFrom<typeof plain>;
declare const namedRef: ActorRefFrom<typeof named>;
declare const configuredRef: ActorRefFrom<typeof configured>;
export const plainSnapshot: SnapshotFrom<typeof plain> = plainRef.getSnapshot();
export const namedSnapshot: SnapshotFrom<typeof named> = namedRef.getSnapshot();
export const configuredSnapshot: SnapshotFrom<typeof configured> =
  configuredRef.getSnapshot();
export const count: ContextFrom<typeof plain>['count'] = 1;
