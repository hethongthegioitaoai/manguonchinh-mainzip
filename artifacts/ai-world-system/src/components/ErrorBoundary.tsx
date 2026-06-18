import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-8">
          <div className="max-w-lg w-full border border-destructive/40 bg-destructive/5 p-8 space-y-4">
            <div className="font-orbitron text-2xl font-bold text-destructive tracking-widest">
              SYSTEM ERROR
            </div>
            <div className="font-mono text-xs text-muted-foreground border border-border/40 bg-card/50 p-4 break-all">
              {this.state.error?.message ?? "Unknown error"}
            </div>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = "/dashboard";
              }}
              className="font-orbitron text-xs tracking-widest border border-primary text-primary bg-primary/10 hover:bg-primary/20 px-6 py-2 transition-all"
            >
              RESTART SYSTEM
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
