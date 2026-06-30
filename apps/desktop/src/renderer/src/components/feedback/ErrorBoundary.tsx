import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = { children: ReactNode };
type ErrorBoundaryState = { failed: boolean };

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[renderer/error-boundary]", error.name, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="error-screen">
          <h1>SprintOps encountered an unexpected error</h1>
          <p>Restart the application. Your canonical workspace data has not been changed.</p>
        </main>
      );
    }

    return this.props.children;
  }
}
