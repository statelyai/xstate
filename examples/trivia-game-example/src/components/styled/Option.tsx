import styled, { css } from "styled-components";

export const Option = styled.button<{ variant: string | undefined }>`
  background: transparent;
  border-radius: 3px;
  border: 2px solid palevioletred;
  padding: 0.25em 1em;
  font-size: 30px;
  margin: 10px;
  width: 40%;
  @media only screen and (max-width: 801px) {
    width: 90%;
  }
  ${(props) =>
    props.variant === "success" &&
    css`
      background-color: #c3e6cb;
      color: white;
      border: solid thin #3d9cab;
      box-shadow: 0px 1px 10px #d2da4a;
      margin: 10px;
      width: 40%;
      color: #464646;
    `};

  ${(props) =>
    props.variant === "danger" &&
    css`
      background-color: #f5c6cb;
      color: white;
      border: solid thin #3d9cab;
      box-shadow: 0px 1px 10px #d2da4a;
      margin: 10px;
      width: 40%;
      color: #464646;
    `};
`;
