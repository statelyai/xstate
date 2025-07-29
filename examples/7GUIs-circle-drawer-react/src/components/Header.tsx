import { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
};

export default function Header({ ...props }: Props) {
  return <header {...props}>{props.children}</header>;
}
