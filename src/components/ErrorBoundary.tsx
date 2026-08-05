import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearAndReload = () => {
    try {
      sessionStorage.clear();
      localStorage.removeItem('sarkar_jobs_minimal');
    } catch (_) {}
    window.location.href = '/dashboard';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#080808] flex items-center justify-center p-4">
          <div className="bg-[#0e0e0e] border border-white/10 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl relative">
            <div className="w-14 h-14 bg-red-950/20 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
              <span className="text-red-400 text-2xl font-bold">⚠️</span>
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-gray-400 text-xs mb-6 leading-relaxed">
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReload}
                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg active:scale-95"
              >
                Reload App
              </button>
              <button
                onClick={this.handleClearAndReload}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 font-bold text-[10px] uppercase tracking-wider rounded-xl border border-white/10 transition-all"
              >
                Reset App Cache & Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
