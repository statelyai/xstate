import React from 'react';
import styled from 'styled-components';
import { interpret } from 'xstate/lib/interpreter';

const StyledMiniState = styled.div`
  padding: 0.25rem;
  text-align: center;
  border: 2px solid #dedede;
  margin: 0.125rem;
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
`;

const StyledEvent = styled.button`
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
    const { stateNode, current, onEvent } = this.props;
    const isActive = current.matches(stateNode.path) || undefined;

    return (
      <StyledMiniState
        key={stateNode.id}
        data-type={stateNode.type}
        data-active={isActive}
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
                key={childStateNode.id}
                onEvent={onEvent}
              />
            );
          })}
        </div>
        <div>
          {stateNode.ownEvents.map(ownEvent => {
            const disabled = current.nextEvents.indexOf(ownEvent) === -1;
            return (
              <StyledEvent
                onClick={() => onEvent(ownEvent)}
                disabled={disabled}
              >
                {ownEvent}
              </StyledEvent>
            );
          })}
        </div>
      </StyledMiniState>
    );
  }
}

const StyledStateChart = styled.div`
  display: inline-grid;
  grid-template-columns: 50% 50%;
  grid-template-rows: auto;
  font-family: sans-serif;
  font-size: 14px;
`;

export class StateChart extends React.Component {
  state = {
    current: this.props.machine.initialState
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
    const { current } = this.state;

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
            onEvent={this.interpreter.send.bind(this)}
          />
          <ul>
            {current.nextEvents.map(nextEvent => {
              return (
                <button
                  key={nextEvent}
                  onClick={() => this.interpreter.send(nextEvent)}
                >
                  {nextEvent}
                </button>
              );
            })}
            <li>{JSON.stringify(current.value)}</li>
          </ul>
        </StyledStateChart>
      </section>
    );
  }
}
