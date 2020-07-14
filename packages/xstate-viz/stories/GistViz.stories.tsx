import React, { useEffect } from 'react';
import { linkTo } from '@storybook/addon-links';
import { Welcome } from '@storybook/react/demo';

import { MachineViz } from '../src/MachineViz';
import '../themes/dark.scss';
import { useMachine } from '@xstate/react';

import {
  StateNodeDefinition,
  StateNode,
  createMachine,
  AnyStateNodeDefinition
} from 'xstate';
import { useState } from 'react';
import { interpret, assign, send, sendParent, spawn, actions } from 'xstate';
import * as XState from 'xstate';

export function parseMachine(rawMachineJs: string): StateNode<any> {
  const makeMachine = new Function(
    'Machine',
    'interpret',
    'assign',
    'send',
    'sendParent',
    'spawn',
    'raise',
    'actions',
    'XState',
    rawMachineJs
  );

  const machines: Array<StateNode<any>> = [];

  const machineProxy = (config: any, options: any) => {
    const machine = createMachine(config, options);
    machines.push(machine);
    return machine;
  };

  makeMachine(
    machineProxy,
    interpret,
    assign,
    send,
    sendParent,
    spawn,
    actions.raise,
    actions,
    XState
  );

  const machine = machines[machines.length - 1];

  return machine;
}

function stringify(obj) {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'function' && !value.toString().includes('__assign')) {
      return { $$type: 'function', value: value.toString() };
    }
    return value;
  });
}

function parse(str: string) {
  const config = JSON.parse(str, (_, value) => {
    if (value !== null && typeof value === 'object' && '$$type' in value) {
      switch (value.$$type) {
        case 'function':
          const fn = new Function('return ' + value.value);
          return fn();
        default:
          break;
      }
    }

    return value;
  });

  return config;
}

function createMachineFromJSON(
  def: AnyStateNodeDefinition
): StateNode<any, any> {
  return createMachine(parse(JSON.stringify(def)));
}

export default {
  title: 'From Gist'
};

function parseGist(gistQuery: string): string | null {
  const gistMatch = gistQuery.match(/([a-zA-Z0-9]{32})/);

  return !gistMatch ? null : gistMatch[0];
}

const GistViz: React.FC<{ gist: string }> = ({ gist }) => {
  const [machine, setMachine] = useState<StateNode | null>(null);

  useEffect(() => {
    const fn = async () => {
      const gistUrl = parseGist(gist);

      const gistData = await fetch(`https://api.github.com/gists/${gistUrl}`, {
        headers: {
          Accept: 'application/json'
        }
      }).then(async (data) => {
        if (!data.ok) {
          throw new Error((await data.json()).message);
        }

        return data.json();
      });

      const rawText = gistData.files['machine.js'].content;

      const someMachine = parseMachine(rawText);

      const stringified = stringify(someMachine.toJSON());

      setMachine(createMachineFromJSON(parse(stringified)));
    };

    fn();
  }, [gist]);

  return machine ? (
    <MachineViz machine={machine} key={gist} />
  ) : (
    <em>Loading...</em>
  );
};

export const Gists = () => {
  return (
    <div>
      <GistViz gist="https://gist.github.com/baeharam/00975792b466a850460daff7b2417ad1" />
    </div>
  );
};
