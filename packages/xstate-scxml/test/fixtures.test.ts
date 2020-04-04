import * as fs from 'fs';
import { xml2js } from 'xml-js';
import { toSCXML } from '../src';

const testGroups = {
  actionSend: ['send1']
  // assign: ['assign_obj_literal']
};

describe('toSCXML', () => {
  const testGroupKeys = Object.keys(testGroups);
  // const testGroupKeys = ['scxml-prefix-event-name-matching'];

  testGroupKeys.forEach((testGroupName) => {
    testGroups[testGroupName].forEach((testName) => {
      const scxmlSource = `@scion-scxml/test-framework/test/${testGroupName}/${testName}.scxml`;
      const scxmlDefinition = fs.readFileSync(require.resolve(scxmlSource), {
        encoding: 'utf-8'
      });

      const machine = require(`./fixtures/${testGroupName}/${testName}`)
        .default;

      it(`${testGroupName}/${testName}`, () => {
        expect(xml2js(toSCXML(machine))).toEqual(
          xml2js(scxmlDefinition, {
            ignoreComment: true,
            ignoreDeclaration: true
          })
        );
      });
    });
  });
});
