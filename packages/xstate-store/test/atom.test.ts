import { createAtom } from '../src/atom';

it('create atom', () => {
  const nameAtom = createAtom('a');
  const numAtom = createAtom(3);
  const combinedAtom = createAtom((read) =>
    read(nameAtom).repeat(read(numAtom))
  );

  expect(combinedAtom.get()).toBe('aaa');

  nameAtom.set('b');

  expect(combinedAtom.get()).toBe('bbb');

  numAtom.set(5);
});
