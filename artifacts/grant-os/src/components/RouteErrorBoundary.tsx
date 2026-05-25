import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "wouter";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  children: ReactNode;
  resetKey: string;
  dashboard?: boolean;
};

type State = {
  error: Error | null;
};

export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Route render failed", error, info);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    const homeHref = this.props.dashboard ? "/dashboard" : "/";
    return (
      <div className="p-8">
        <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <div className="flex gap-3">
            <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">This page could not be displayed.</p>
              <p className="mt-1 text-xs">{this.state.error.message || "An unexpected rendering error occurred."}</p>
              <Link href={homeHref}>
                <Button variant="outline" size="sm" className="mt-4 h-8 bg-white text-xs">
                  Return to {this.props.dashboard ? "dashboard" : "home"}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
