import { createActor } from 'xstate';
import { createMachineFromSCXMLConfig } from '../src/runtime.ts';
import { compileSCXML } from '../src/scxml.ts';

const getErrorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : typeof error === 'object' && error && 'message' in error
      ? String(error.message)
      : String(error);

describe('SCXML errors', () => {
  it('state onError catches SCXML error.communication from failed sends', () => {
    const errorSpy = vi.fn();
    const json = compileSCXML(`
      <scxml xmlns="http://www.w3.org/2005/07/scxml" initial="active" version="1.0" datamodel="ecmascript">
        <state id="active">
          <onentry>
            <send event="PING" target="#_scxml_missing"/>
          </onentry>
        </state>
        <state id="failed"/>
      </scxml>
    `);

    json.states!.active.onError = {
      target: '#failed',
      actions: [
        {
          type: 'captureError',
          params: { '@expr': 'event', '@lang': 'test' }
        }
      ]
    };

    const machine = createMachineFromSCXMLConfig(json, {
      actions: {
        captureError: (event) => {
          errorSpy({
            type: event.type,
            message: getErrorMessage(event.error)
          });
        }
      },
      evaluators: {
        test: ({ source, scope }) => {
          if (source === 'event') {
            return scope.event;
          }
        }
      }
    });

    const actor = createActor(machine).start();

    expect(actor.getSnapshot().value).toBe('failed');
    expect(actor.getSnapshot().status).toBe('active');
    expect(errorSpy).toHaveBeenCalledWith({
      type: 'xstate.error.communication',
      message: 'Unable to dispatch event to target: #_scxml_missing'
    });
  });
});
