import styled from 'styled-components';

const TabButton = styled.button`
  background: transparent;
  border: 1px solid black;
  border-radius: 8px;
  white-space: nowrap;
  cursor: pointer;
  outline: none;

  background-color: ${(props) => props.isActive ? 'skyblue' : 'rgba(0,0,0,0.1);'};
`
export default TabButton