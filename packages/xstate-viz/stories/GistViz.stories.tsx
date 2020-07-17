import React, { useEffect } from 'react';
import { linkTo } from '@storybook/addon-links';
import { Welcome } from '@storybook/react/demo';

import { MachineViz } from '../src/MachineViz';
import '../themes/dark.scss';
import './style.scss';
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
          if (
            !value.value.startsWith('function') &&
            !value.value.startsWith('(')
          ) {
            return () => {}; // TODO: fix { fn() {... } }
          }
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

      setMachine(createMachineFromJSON(JSON.parse(stringified)));
    };

    fn();
  }, [gist]);

  return machine ? (
    <MachineViz
      machine={machine}
      key={gist}
      onStateNodeTap={(id) => {
        console.log('tapped', id);
      }}
      onEventTap={(e) => {
        console.log('tapped', e);
      }}
    />
  ) : (
    <em>Loading...</em>
  );
};

const gists = [
  // 'https://gist.github.com/thm-design/d0ca21173047526d7935c253e6bf02ed',
  // 'https://gist.github.com/knownasilya/80f61974ad2ac0e73ec81862ed9d758f',
  // 'https://gist.github.com/Elanhant/f6c30b31ff7d3138edeb58470bc778c5',
  // 'https://gist.github.com/bpedersen/7d1af0ca6733c72269f259d2061a2d9a',
  // 'https://gist.github.com/monzie9000/db50d7a6ff3dd65205f4eb48089c445c',
  // 'https://gist.github.com/gkatai/34c84b5df1c0a24634d10f8be59bbae4',
  // 'https://gist.github.com/bfillmer/aaf56d9a0d1c52a99ae1993f62a08ac3',
  // 'https://gist.github.com/abejfehr/f630e288703668630abbe38cf7b9e234',
  // 'https://gist.github.com/JamieMason/3b277df080742d0e93b032feaef1a397',
  // 'https://gist.github.com/JamieMason/446eb971c2c1dc3b9e55043e72e97f22',
  // 'https://gist.github.com/hudde91/98d1671db9f5d7fa102a4286da0c8ca2',
  // 'https://gist.github.com/baeharam/00975792b466a850460daff7b2417ad1',
  // 'https://gist.github.com/Arif9878/85813599f383cdacba51b49cf0fbe6d1',
  // 'https://gist.github.com/Arif9878/742bd0f9703d2f0640710e9b765008e8',
  // 'https://gist.github.com/patwaririshab/11927b08d5f31060b4889a7b74849ea9',
  // 'https://gist.github.com/arochagabriel/2c71f3f7f89ff6fb1accf938e0fdf3af',
  // 'https://gist.github.com/patwaririshab/c3722432a31d03748423dd6feacc1af6',
  // 'https://gist.github.com/Zendor18/dca35e09ea84451c20956d06f7cf4e2d',
  // 'https://gist.github.com/asmbatha/f9ebd4dcba2f61dcc1bf624c1a60eeab',
  // 'https://gist.github.com/NikitaIT/8ffba1c0f62ff3eaa4f5650215babfbc',
  // 'https://gist.github.com/seansu4you87/a8fe3f24271fb2603cfa3db237d951af',
  // 'https://gist.github.com/vin-e/9d2e59c6d3113929fc50bfb9fe44ef6b',
  // 'https://gist.github.com/beHitesh/aab686bd755889facf398316ac08f5fb',
  // 'https://gist.github.com/wdcryer/917203272be8aeb88316335191f67acf',
  // 'https://gist.github.com/muratbeser/ea0a22b2e9782d6c5fca89adbcdfcebc',
  // 'https://gist.github.com/mnhthng-thms/f416c15f331fab381b21373f74be6537',
  // 'https://gist.github.com/mattpocock/51750cbf84e82ae7e556bba59c38259e',
  // 'https://gist.github.com/nicholas-robson/074f1bb4d4df3d6e34eee2ff2a9074fd',
  // 'https://gist.github.com/acusticdemon/1dcc4f4c1e70f53a193a261c5873e04a',
  // 'https://gist.github.com/raphaelbadia/62f6604d1666e68272b3e6ccb5bf391a',
  // 'https://gist.github.com/Addono/2cccde93b8c36974fc5ebe6e4c147595',
  // 'https://gist.github.com/nyx2014/e3bb3c044598886f8f8fab0ef8082643',
  // 'https://gist.github.com/baeharam/8e282b20b01907eb00677c27fd9e1164',
  // 'https://gist.github.com/mnhthng-thms/98adca0067abdc733dbbf14686f5e37a',
  // 'https://gist.github.com/simontegg/ae79d618288e8fcb3b501cdb4edc4948',
  'https://gist.github.com/simmo/7a0312c690f898a7023d4712c8ee26ce'
];

export const Gists = () => {
  return (
    <>
      {gists.map((gist) => {
        return <GistViz gist={gist} key={gist} />;
      })}
    </>
  );
};
