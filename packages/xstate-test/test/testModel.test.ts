import { TestModel } from '../src/TestModel';

it('tests any behavior', async () => {
  const model = new TestModel(
    {
      initialState: 15,
      transition: (value, event) => {
        if (event.type === 'even') {
          return value / 2;
        } else {
          return value * 3 + 1;
        }
      }
    },
    {
      getEvents: (state) => {
        if (state % 2 === 0) {
          return [{ type: 'even' }];
        }
        return [{ type: 'odd' }];
      }
    }
  );

  const plans = model.getShortestPlansTo((state) => state === 1);

  expect(plans.length).toBeGreaterThan(0);
});
