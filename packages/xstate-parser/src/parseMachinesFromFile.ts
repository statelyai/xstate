import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import { MachineCallExpression } from './machineCallExpression';
import { MachineParseResult } from './MachineParseResult';
import { ParseResult } from './types';

export const parseMachinesFromFile = (fileContents: string): ParseResult => {
  if (
    !fileContents.includes('createMachine') &&
    !fileContents.includes('Machine')
  ) {
    return {
      machines: []
    };
  }

  const parseResult = parser.parse(fileContents, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx']
  });

  let result: ParseResult = {
    machines: []
  };

  traverse(parseResult as any, {
    CallExpression(path: any) {
      const ast = MachineCallExpression.parse(path.node, {
        file: parseResult
      });
      if (ast) {
        result.machines.push(new MachineParseResult({ ast }));
      }
    }
  });

  return result;
};
