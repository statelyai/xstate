import { parseMachinesFromFile } from '../parseMachinesFromFile';

describe('Delays', () => {
  it('Should pick up delays in options', () => {
    const machines = parseMachinesFromFile(`
      createMachine({}, {
        delays: {
          SOME_NAME: 400,
          SOMETHING_ELSE: 600,
          WOW: () => 200
        }
      })
    `);

    const result = machines.machines[0];

    const propertyKeys = result.ast?.options?.delays?.properties.map(
      (val) => val.key
    );

    expect(propertyKeys).toEqual(['SOME_NAME', 'SOMETHING_ELSE', 'WOW']);
  });
  it('Should be able to grab all named delays', () => {
    const machines = parseMachinesFromFile(`
      createMachine({
        after: {
          SOME_NAME: {},
          SOMETHING_ELSE: {},
          WOW: {},
        }
      })
    `);

    const result = machines.machines[0];

    expect(Object.keys(result.getAllNamedDelays())).toEqual([
      'SOME_NAME',
      'SOMETHING_ELSE',
      'WOW'
    ]);
  });
});
