import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { reportReactError } from "../../hooks/useErrorMonitor";

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    reportReactError(error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-red-50">
          <AlertTriangle size={36} className="text-red-400" />
        </div>
        <h2 className="mt-6 text-xl font-black text-[#0f172a]">Algo deu errado</h2>
        <p className="mt-2 max-w-xs text-sm text-[#64748b]">
          Ocorreu um erro inesperado. Tente novamente ou volte ao início.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={this.reset}
            className="flex items-center gap-2 rounded-2xl bg-[#0f172a] px-5 py-3 text-sm font-black text-white"
          >
            <RefreshCw size={15} /> Tentar novamente
          </button>
          <a
            href="/"
            className="flex items-center gap-2 rounded-2xl border border-[#e2e8f0] bg-white px-5 py-3 text-sm font-black text-[#64748b]"
          >
            Ir ao início
          </a>
        </div>
      </div>
    );
  }
}
