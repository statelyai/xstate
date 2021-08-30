import * as fs from 'fs';
import * as path from 'path';
import { StateMachine } from 'xstate';
import { parseMachinesFromFile } from '../parseMachinesFromFile';
import { testUtils } from '../testUtils';

const examples = fs.readdirSync(path.resolve(__dirname, '../../examples'));

describe('Examples', () => {
  examples.forEach((example) => {
    test(example, async () => {
      const exampleMachineImports = require(`../../examples/${example}`);

      const exampleMachines: StateMachine<any, any, any>[] = Object.values(
        exampleMachineImports
      );

      const fileAsString = fs
        .readFileSync(path.resolve(__dirname, '../../examples', example))
        .toString();

      const { machines } = parseMachinesFromFile(fileAsString);

      exampleMachines.forEach((machine, index) => {
        try {
          // @ts-ignore
          const sourceMachineConfig = testUtils.withoutContext(machine.config);

          const machineConfigUnderTest = machines[index].toConfig();

          expect(machineConfigUnderTest).toEqual(sourceMachineConfig);
        } catch (e) {
          if (!e.message.includes('Received: serializes to the same string')) {
            throw e;
          }
        }
      });
    });
  });
});
