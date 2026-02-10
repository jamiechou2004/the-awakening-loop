
import './index.css';
import React, { useCallback, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { IntroCinematic } from './components/IntroCinematic';

console.log('App is mounting...');

type ErrorBoundaryState = {
  error: Error | null;
};

class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App render error:', error, info);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div
          style={{
            color: '#ff4d4f',
            background: '#120607',
            minHeight: '100vh',
            padding: '24px',
            fontFamily: 'ui-monospace, SFMono-Regular, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            whiteSpace: 'pre-wrap',
          }}
        >
          <strong>Render failed:</strong>
          {'\n'}
          {error.stack ?? error.message}
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

const Root: React.FC = () => {
  const [introComplete, setIntroComplete] = useState(false);

  const handleIntroComplete = useCallback(() => {
    setIntroComplete(true);
  }, []);

  return introComplete ? <App /> : <IntroCinematic onComplete={handleIntroComplete} />;
};

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </React.StrictMode>
);
