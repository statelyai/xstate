import { Component, ErrorInfo } from 'react';
import { PropsNode, State } from '../../common/types';
import DisplayError from './DisplayError';

class ErrorBoundary extends Component<PropsNode, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return <DisplayError />;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
