import {createRoot} from 'react-dom/client';
import WorkspaceShell from './shell/WorkspaceShell.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<WorkspaceShell />);

// Register the service worker for installability (PWA) and offline shell — production only.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
