import * as fg from 'fast-glob';
import { MachineConfig, parseMachinesFromFile } from '@xstate/parser';
import * as fs from 'fs';

export const scan = async (glob: string) => {
  const files = await fg([glob]);

  const fileMap: Record<
    string,
    {
      config: MachineConfig<any, any, any>;
      options: {
        services: string[];
        delays: string[];
        actions: string[];
        guards: string[];
        devTools: boolean;
      };
    }[]
  > = {};

  for (const file of files) {
    const parseResult = parseMachinesFromFile(fs.readFileSync(file).toString());

    if (parseResult.machines.length > 0) {
      fileMap[file] = parseResult.machines.map((machine) => {
        return {
          config: machine.toConfig() || {},
          options: {
            services:
              machine.ast?.options?.services?.properties.map(
                (property) => property.key
              ) || [],
            actions:
              machine.ast?.options?.actions?.properties.map(
                (property) => property.key
              ) || [],
            delays:
              machine.ast?.options?.delays?.properties.map(
                (property) => property.key
              ) || [],
            guards:
              machine.ast?.options?.guards?.properties.map(
                (property) => property.key
              ) || [],
            devTools: machine.ast?.options?.devTools?.value ?? false
          }
        };
      });
    }
  }

  console.log(JSON.stringify(fileMap, null, 2));
};
