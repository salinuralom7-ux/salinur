import { HashRouter } from 'react-router-dom';
import { useData } from './store/dataContext';
import { StoreProvider } from './store/StoreContext';
import App from './App';

export default function Root() {
  const { loading, error, reload } = useData();

  if (loading) {
    return (
      <div className="boot">
        <div className="boot-spinner" />
        <p>Loading Phone Factory…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="boot">
        <h2>📡 Can't reach the store</h2>
        <p className="muted">{error}</p>
        <p className="muted">Make sure the API server is running, then try again.</p>
        <button className="btn btn-primary" onClick={reload}>Retry</button>
      </div>
    );
  }

  return (
    <HashRouter>
      <StoreProvider>
        <App />
      </StoreProvider>
    </HashRouter>
  );
}
