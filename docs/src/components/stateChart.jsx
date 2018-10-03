import React from 'react';
import styled from 'styled-components';

const StyledMiniState = styled.div`
  --state-border-color: blue;
  padding: 0.25rem;
  text-align: center;
  border: 2px solid var(--state-border-color);
  margin: 0.125rem;
  flex-grow: 0;
  flex-shrink: 1;

  & > .children {
    display: none;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: flex-start;
  }

  &[data-open='true'] > .children {
    display: flex;
  }
`;

export class StateChart extends React.Component {
  state = {
    toggleStates: {}
  };
  renderStates(stateNode) {
    return (
      <StyledMiniState
        key={stateNode.id}
        data-open={
          this.state.toggleStates[stateNode.id] === undefined
            ? true
            : this.state.toggleStates[stateNode.id]
        }
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
        <strong>{stateNode.key}</strong>
        <div className="children">
          {Object.keys(stateNode.states || []).map(key => {
            const childStateNode = stateNode.states[key];

            return this.renderStates(childStateNode);
          })}
        </div>
      </StyledMiniState>
    );
  }
  render() {
    const { machine, state = machine.initialState } = this.props;

    const stateNodes = machine.getStateNodes(state);
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
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap'
          }}
        >
          {this.renderStates(this.props.machine)}
        </div>
      </section>
    );
  }
}
