import React from 'react';
import styled from 'styled-components';
import { interpret } from 'xstate/lib/interpreter';
import SyntaxHighlighter from 'react-syntax-highlighter';
import 'highlight.js/styles/monokai.css';
import { Machine as _Machine } from 'xstate';

const StyledMiniState = styled.div`
  padding: 0.25rem;
  text-align: left;
  border: 2px solid #dedede;
  margin: 0.5rem;
  flex-grow: 0;
  flex-shrink: 1;
  opacity: 0.8;

  & > .children {
    display: none;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: flex-start;
  }

  &[data-open='true'] > .children {
    display: flex;
  }

  &[data-active] {
    border-color: #57b0ea;
    opacity: 1;
  }

  &[data-preview]:not([data-active]) {
    outline: 1px solid green;
  }
`;

const StyledEvents = styled.ul`
  padding: 0;
  margin: 0;
  list-style: none;
`;

const StyledEvent = styled.li`
  list-style: none;
  margin: 0;
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  margin-right: -1rem;
  margin-bottom: 0.25rem;
`;

const StyledEventButton = styled.button`
  appearance: none;
  background: #57b0ea;
  color: white;
  font-size: 0.75em;
  font-weight: bold;
  padding: 0.5em 1em;
  border-radius: 2em;
  margin-bottom: 0.25em;
  line-height: 1;
`;

class StateChartNode extends React.Component {
  state = {
    toggleStates: {}
  };
  render() {
    const {
      stateNode,
      current,
      preview,
      onEvent,
      onPreEvent,
      onExitPreEvent
    } = this.props;
    const isActive = current.matches(stateNode.path) || undefined;
    const isPreview = preview
      ? preview.matches(stateNode.path) || undefined
      : undefined;

    return (
      <StyledMiniState
        key={stateNode.id}
        data-type={stateNode.type}
        data-active={isActive && stateNode.parent}
        data-preview={isPreview && stateNode.parent}
        data-open={
          this.state.toggleStates[stateNode.id] === undefined
            ? true
            : this.state.toggleStates[stateNode.id]
        }
      >
        <strong
          onClick={e => {
            e.stopPropagation();
            this.setState({
              toggleStates: {
                ...this.state.toggleStates,
                [stateNode.id]: !this.state.toggleStates[stateNode.id]
              }
            });
          }}
        >
          {stateNode.key}
        </strong>
        <div className="children">
          {Object.keys(stateNode.states || []).map(key => {
            const childStateNode = stateNode.states[key];

            return (
              <StateChartNode
                stateNode={childStateNode}
                current={current}
                preview={preview}
                key={childStateNode.id}
                onEvent={onEvent}
                onPreEvent={onPreEvent}
                onExitPreEvent={onExitPreEvent}
              />
            );
          })}
        </div>
        <StyledEvents>
          {stateNode.ownEvents.map(ownEvent => {
            const disabled = current.nextEvents.indexOf(ownEvent) === -1;
            return (
              <StyledEvent>
                <StyledEventButton
                  onClick={() => onEvent(ownEvent)}
                  onMouseOver={() => onPreEvent(ownEvent)}
                  onMouseOut={() => onExitPreEvent()}
                  disabled={disabled}
                >
                  {ownEvent}
                </StyledEventButton>
              </StyledEvent>
            );
          })}
        </StyledEvents>
      </StyledMiniState>
    );
  }
}

const StyledStateChart = styled.div`
  display: inline-grid;
  grid-template-columns: 50% 50%;
  grid-template-rows: auto;
  font-family: sans-serif;
  font-size: 12px;
`;

export class StateChart extends React.Component {
  state = {
    current: this.props.machine.initialState,
    preview: undefined
  };
  interpreter = interpret(this.props.machine).onTransition(current => {
    this.setState({ current });
  });
  componentDidMount() {
    console.log(this.interpreter);
    this.interpreter.start();
  }
  render() {
    const { machine } = this.props;
    const { current, preview } = this.state;

    const stateNodes = machine.getStateNodes(current);
    const events = new Set();

    stateNodes.forEach(stateNode => {
      const potentialEvents = Object.keys(stateNode.on);

      potentialEvents.forEach(event => {
        const transitions = stateNode.on[event];

        transitions.forEach(transition => {
          if (transition.target !== undefined) {
            events.add(event);
          }
        });
      });
    });

    return (
      <section>
        <StyledStateChart>
          <StateChartNode
            stateNode={this.props.machine}
            current={current}
            preview={preview}
            onEvent={this.interpreter.send.bind(this)}
            onPreEvent={event =>
              this.setState({ preview: this.interpreter.nextState(event) })
            }
            onExitPreEvent={() => this.setState({ preview: undefined })}
          />
          <SyntaxHighlighter
            language="json"
            wrapLines={true}
            useInlineStyles={false}
            lineProps={line => ({ 'data-line': line })}
          >
            {JSON.stringify(machine.config, null, 2)}
          </SyntaxHighlighter>
        </StyledStateChart>
      </section>
    );
  }
}
