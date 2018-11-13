import React, { Component } from 'react';
import { StateChart } from '@statecharts/xstate-viz';
import { Machine } from 'xstate';
import styled from 'styled-components';

const lightMachine = Machine({
  id: 'light',
  initial: 'green',
  states: {
    green: {
      on: {
        TIMER: 'yellow'
      }
    },
    yellow: {
      on: {
        TIMER: 'red'
      }
    },
    red: {
      on: {
        TIMER: 'green'
      }
    }
  }
});

const StyledWhatever = styled.div`
  font-size: 1rem;
`;

class App extends Component {
  ref = React.createRef();
  componentDidMount() {
    console.log(this.ref.current);
  }
  render() {
    return (
      <div style={{ height: '100vh' }}>
        <StateChart machine={lightMachine} />
      </div>
    );
  }
}

export default App;
