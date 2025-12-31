import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'

// Improve device debugging: surface real errors/stacks in the console.
window.addEventListener('error', (event) => {
  // eslint-disable-next-line no-console
  console.error('[window.error]', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error instanceof Error ? { message: event.error.message, stack: event.error.stack } : event.error
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = (event as PromiseRejectionEvent).reason;
  // eslint-disable-next-line no-console
  console.error('[unhandledrejection]', reason instanceof Error ? { message: reason.message, stack: reason.stack } : reason);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)