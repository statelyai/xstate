import styled from 'styled-components';

const TabButtonsGroup = styled.div`
  display: flex;
  border: 1px solid black;
  padding: 4px;
  height: 100%;
  width: 100%;

  & > button + button {
    margin-left: 4px;
  }
`

export default TabButtonsGroup