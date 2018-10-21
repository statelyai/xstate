import React from 'react';
import styled from 'styled-components';
import { interpret } from 'xstate/lib/interpreter';
import SyntaxHighlighter from 'react-syntax-highlighter';
// import 'highlight.js/styles/monokai.css';
import { Machine as _Machine } from 'xstate';

const StyledState = styled.div`
  display: inline-block;
  border-radius: 0.25rem;
  text-align: left;
  border: 2px solid #dedede;
  margin: 0.5rem 1rem;
  flex-grow: 0;
  flex-shrink: 1;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.1);
  background: white;

  &:not([data-type='machine']) {
    opacity: 0.75;
  }

  &[data-type='machine'] {
    padding: 0.5rem;
  }

  color: #313131;

  & > .children {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: flex-start;
  }

  &:not([data-open='true']) > .children {
    display: none;
  }

  &[data-open='true'] > .children {
    display: flex;
  }

  &[data-active] {
    border-color: #57b0ea;
    opacity: 1;
  }

  &[data-preview]:not([data-active]) {
    border-color: var(--color-primary-faded);
  }

  > header {
    padding: 0.5rem;

    &[data-type-symbol='final' i] {
      --symbol-color: red;
    }

    &[data-type-symbol='history' i] {
      --symbol-color: orange;
    }

    &[data-type-symbol] {
      padding-right: 5em;

      &:after {
        content: attr(data-type-symbol);
        position: absolute;
        top: 0;
        right: 0;
        border-bottom-left-radius: 0.25rem;
        background: var(--symbol-color, gray);
        color: white;
        padding: 0.25rem 0.5rem;
        font-weight: bold;
        font-size: 0.75em;
      }
    }
  }
`;

const StyledEvents = styled.ul`
  padding: 0;
  margin: 0;
  list-style: none;
  padding: 0.5rem;

  &:empty {
    display: none;
  }
`;

const StyledEvent = styled.li`
  list-style: none;
  margin: 0;
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  margin-right: -1.25rem;

  &:not(:last-child) {
    margin-bottom: 0.25rem;
  }
`;

const StyledEventButton = styled.button`
  appearance: none;
  background-color: var(--color-primary-faded);
  border: none;
  color: white;
  font-size: 0.75em;
  font-weight: bold;
  padding: 0.5rem 0.5rem 0.5rem 1rem;
  cursor: pointer;
  border-radius: 2rem;
  margin-bottom: 0.25rem;
  line-height: 1;
  display: inline-flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;

  &:not(:disabled):hover {
    background-color: var(--color-primary);
  }

  &:disabled {
    cursor: not-allowed;
    background: #888;
  }

  &:focus {
    outline: none;
  }

  &:after {
    content: '';
    display: inline-block;
    height: 0.5rem;
    width: 0.5rem;
    border-radius: 50%;
    background-color: white;
    margin-left: 0.5rem;
  }
`;

class StateChartNode extends React.Component {
  state = {
    toggled: this.props.toggled
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
      <StyledState
        key={stateNode.id}
        data-type={stateNode.parent ? stateNode.type : 'machine'}
        data-active={isActive && stateNode.parent}
        data-preview={isPreview && stateNode.parent}
        data-open={this.state.toggled || undefined}
      >
        <header
          data-type-symbol={
            ['history', 'final', 'parallel'].includes(stateNode.type)
              ? stateNode.type.toUpperCase()
              : undefined
          }
        >
          <strong
            onClick={e => {
              e.stopPropagation();
              this.setState({
                toggled: !this.state.toggled
              });
            }}
          >
            {stateNode.key}
          </strong>
        </header>
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
      </StyledState>
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
            toggled={true}
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
