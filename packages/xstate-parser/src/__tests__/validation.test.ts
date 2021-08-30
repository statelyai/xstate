import { parseMachinesFromFile } from '../parseMachinesFromFile';

describe('Validation and failsafes', () => {
  describe('When the code does not contain createMachine or Machine', () => {
    it('Should return an empty object', () => {
      expect(
        parseMachinesFromFile(`
        const hello = 2;
      `)
      ).toEqual({
        machines: []
      });
    });
  });
});
