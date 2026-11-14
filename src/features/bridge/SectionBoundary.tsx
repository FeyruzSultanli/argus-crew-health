import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

import { ErrorState } from '../../ui';

interface Props {
  /** What failed, e.g. "Today's plan". */
  what: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
  attempt: number;
}

/**
 * Error boundary per Bridge section: a failing live query (useLiveQuery rethrows) shows an ErrorState with Retry in
 * that section only; the rest of the Bridge keeps working.
 */
export class SectionBoundary extends Component<Props, State> {
  override state: State = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn(`Bridge section "${this.props.what}" failed`, error, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        <ErrorState
          title={`${this.props.what} could not load`}
          message="The local health data could not be read. Your data is still stored on this device."
          detail={this.state.error.message}
          onRetry={() => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }))}
        />
      );
    }
    return (
      <div key={this.state.attempt} className="contents">
        {this.props.children}
      </div>
    );
  }
}
